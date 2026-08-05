<?php
// Clip download proxy: fetches one event's MP4 (with audio) from the Ring API
// and streams it to the browser. Key-gated. Params: ts (epoch ms), dur (ms).
// Two-step: POST download -> 303 presigned URL -> stream GET to output
// (never buffers the full clip in PHP memory).
require __DIR__ . '/scribe_token_lib.php';

scribe_require_key();
set_time_limit(300);

$ts = (int)($_GET['ts'] ?? 0);
$dur = (int)($_GET['dur'] ?? 0);
if ($ts <= 0 || $dur <= 0 || $dur > 15 * 60 * 1000) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'ts (epoch ms) and dur (ms, <=15min) required']);
    exit;
}

try {
    $deviceId = $_GET['device'] ?? '';
    if ($deviceId === '') {
        $devs = scribe_api_get('/v1/devices')['data'] ?? [];
        if (!$devs) throw new Exception('no devices visible');
        $deviceId = $devs[0]['id'];
    }

    // Step 1: request the clip; capture the presigned redirect without following.
    $ch = curl_init(RING_API_BASE . "/v1/devices/$deviceId/media/video/download");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . scribe_access_token(),
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'timestamp' => $ts,
            'duration' => $dur,
            'audio_options' => ['audio_enabled' => true],
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 120,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $redirect = curl_getinfo($ch, CURLINFO_REDIRECT_URL);
    curl_close($ch);
    if (!in_array($code, [301, 302, 303, 307, 308]) || !$redirect) {
        throw new Exception("download request -> $code (no redirect): " . substr($resp, -300));
    }

    if (isset($_GET['mode']) && $_GET['mode'] === 'url') {
        // Fast path for the extension: hand back the presigned CDN URL so the
        // client downloads directly from Ring — relaying 40MB through shared
        // PHP hosting dominated caption latency.
        header('Content-Type: application/json');
        echo json_encode(['url' => $redirect]);
        exit;
    }

    if (isset($_GET['debug'])) {
        // Diagnose step 2 without streaming: fetch a byte range and report.
        $ch = curl_init($redirect);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 120,
        ]);
        $body = curl_exec($ch);
        header('Content-Type: application/json');
        echo json_encode([
            'redirect_host' => parse_url($redirect, PHP_URL_HOST),
            'step2_http' => curl_getinfo($ch, CURLINFO_RESPONSE_CODE),
            'step2_err' => curl_error($ch),
            'step2_bytes' => $body === false ? -1 : strlen($body),
            'step2_head_hex' => $body === false ? '' : bin2hex(substr($body, 0, 16)),
            'step2_body_text' => ($body !== false && strlen($body) < 2000) ? $body : '(binary/large)',
        ]);
        curl_close($ch);
        exit;
    }

    // Step 2: stream the presigned URL straight through to the client.
    // Video headers are deferred until the first chunk proves it's MP4 —
    // Ring returns a JSON error body (e.g. MEDIA_NOT_FOUND) on the presigned
    // URL itself when the event has no stored media.
    while (ob_get_level() > 0) ob_end_clean();   // defeat output buffering for streaming
    $first = true;
    $errbuf = '';
    $ch = curl_init($redirect);
    curl_setopt_array($ch, [
        CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$first, &$errbuf, $ts) {
            if ($first) {
                $first = false;
                if ($chunk !== '' && $chunk[0] === '{') {   // MP4 never starts with '{'
                    $errbuf = $chunk;
                    return strlen($chunk);
                }
                header('Content-Type: video/mp4');
                header('Content-Disposition: attachment; filename="event_' . $ts . '.mp4"');
            }
            if ($errbuf !== '') {
                $errbuf .= $chunk;
                return strlen($chunk);
            }
            echo $chunk;
            flush();
            return strlen($chunk);
        },
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 300,
    ]);
    $ok = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($errbuf !== '') {
        http_response_code(502);
        header('Content-Type: application/json');
        $ring = json_decode($errbuf, true);
        $detail = $ring['errors'][0]['detail'] ?? substr($errbuf, 0, 200);
        echo json_encode(['error' => 'Ring media: ' . $detail]);
    } elseif (!$ok && $first) {
        http_response_code(502);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'stream failed: ' . $err]);
    } elseif (!$ok) {
        error_log('ring_clip stream truncated: ' . $err);
    }
} catch (Exception $e) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => $e->getMessage()]);
}
