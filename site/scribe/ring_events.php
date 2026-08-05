<?php
// Recent camera events for the tap-to-translate clip browser. Key-gated.
// Returns the first device plus its recent event history, newest first.
require __DIR__ . '/scribe_token_lib.php';

scribe_require_key();
header('Content-Type: application/json');

try {
    $devs = scribe_api_get('/v1/devices')['data'] ?? [];
    if (!$devs) throw new Exception('no devices visible on linked account');
    $device = $devs[0];
    $deviceId = $device['id'];
    // Optional: `before` (epoch ms) pages history backward from that moment via
    // the API's ISO page[key] cursor — lets the extension find events from any
    // past date, not just the most recent page.
    $path = "/v1/history/devices/$deviceId/events";
    $before = (int)($_GET['before'] ?? 0);
    if ($before > 0) {
        $path .= '?' . http_build_query(['page[key]' => gmdate('Y-m-d\TH:i:s\Z', (int)($before / 1000))]);
    }
    $events = scribe_api_get($path)['data'] ?? [];

    $out = [];
    $seen = [];
    foreach ($events as $ev) {
        $a = $ev['attributes'] ?? [];
        if (!isset($a['start'], $a['end'])) continue;
        $start = (int)$a['start'];
        if (isset($seen[$start])) continue;   // history lists near-duplicates
        $seen[$start] = true;
        $out[] = [
            'start_ms' => $start,
            'end_ms' => (int)$a['end'],
            'dur_s' => round(((int)$a['end'] - $start) / 1000),
            'type' => $a['event_type'] ?? null,
        ];
        if (count($out) >= 40) break;
    }
    echo json_encode([
        'device' => ['id' => $deviceId,
                     'name' => $device['attributes']['name'] ?? 'camera'],
        'events' => $out,
    ]);
} catch (Exception $e) {
    http_response_code(502);
    echo json_encode(['error' => $e->getMessage()]);
}
