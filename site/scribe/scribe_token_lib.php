<?php
// Shared Ring token access for server-side API endpoints.
// The watcher on David's PC is the primary token manager and pushes every
// rotation here via tokens_write.php. If the watcher is down long enough for
// the access token to expire, this lib refreshes (rotating) under a lock and
// persists, and the watcher recovers via its live-record bootstrap.
require_once __DIR__ . '/scribe_ring_creds.php';

const SCRIBE_LIVE_TOKEN_FILE = __DIR__ . '/scribe_live_token_q8x1r4.php';
const RING_API_BASE = 'https://api.amazonvision.com';

function scribe_live_token_read() {
    if (!file_exists(SCRIBE_LIVE_TOKEN_FILE)) return null;
    $lines = file(SCRIBE_LIVE_TOKEN_FILE);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '<?php')) continue;
        $rec = json_decode($line, true);
        if (is_array($rec)) return $rec;
    }
    return null;
}

function scribe_live_token_write(array $rec) {
    $rec['updated'] = gmdate('c');
    $tmp = SCRIBE_LIVE_TOKEN_FILE . '.tmp';
    file_put_contents($tmp, "<?php exit; ?>\n" . json_encode($rec) . "\n", LOCK_EX);
    rename($tmp, SCRIBE_LIVE_TOKEN_FILE);
}

// Returns a currently-valid access token, refreshing (and persisting the
// rotation) only if expired. Throws on failure.
function scribe_access_token() {
    $rec = scribe_live_token_read();
    if (!$rec) throw new Exception('no live token on server — start the watcher once to seed it');
    if (($rec['expires_at_ms'] ?? 0) / 1000 > time() + 60) {
        return $rec['access_token'];
    }
    // Expired: refresh under an exclusive lock so concurrent requests don't
    // both consume the single-use refresh token.
    $lock = fopen(SCRIBE_LIVE_TOKEN_FILE . '.lock', 'c');
    flock($lock, LOCK_EX);
    try {
        $rec = scribe_live_token_read();   // re-read: another request may have refreshed
        if (($rec['expires_at_ms'] ?? 0) / 1000 > time() + 60) return $rec['access_token'];
        $ch = curl_init('https://oauth.ring.com/oauth/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'grant_type' => 'refresh_token',
                'refresh_token' => $rec['refresh_token'],
                'client_id' => RING_CLIENT_ID,
                'client_secret' => RING_CLIENT_SECRET,
            ]),
            // PHP curl sends NO Accept/User-Agent by default; oauth.ring.com
            // rejects such requests with 406 (Python requests always worked
            // because it sends Accept: */*).
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Content-Type: application/x-www-form-urlencoded',
                'User-Agent: Scribe/1.0',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($code !== 200) throw new Exception("token refresh failed ($code): " . substr($body, 0, 200));
        $tok = json_decode($body, true);
        scribe_live_token_write([
            'access_token' => $tok['access_token'],
            'refresh_token' => $tok['refresh_token'] ?? $rec['refresh_token'],
            'expires_at_ms' => (time() + (int)($tok['expires_in'] ?? 14400) - 300) * 1000,
            'refreshed_by' => 'server',
        ]);
        return $tok['access_token'];
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function scribe_api_get(string $path) {
    $ch = curl_init(RING_API_BASE . $path);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . scribe_access_token()],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($code !== 200) throw new Exception("Ring API $path -> $code: " . substr($body, 0, 300));
    return json_decode($body, true);
}

function scribe_require_key() {
    header('Cache-Control: no-store');
    header('Access-Control-Allow-Origin: *');   // key-gated; called from the ring.com extension
    $k = $_GET['k'] ?? ($_POST['k'] ?? '');
    if (!hash_equals(SCRIBE_TOKENS_READ_KEY, $k)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'forbidden']);
        exit;
    }
}
