<?php
// Scribe staging OAuth provider — token exchange endpoint.
// Ring's servers POST here to exchange an authorization code (or refresh token)
// for access/refresh tokens. Standard OAuth 2.0 shapes, staging-only issuance.

require __DIR__ . '/scribe_config.php';

// Staging diagnostics: record exactly what Ring sends during the handshake.
file_put_contents(__DIR__ . '/scribe_token_log_k7x2m9.txt', json_encode([
    'time'    => gmdate('c'),
    'method'  => $_SERVER['REQUEST_METHOD'],
    'headers' => function_exists('getallheaders') ? getallheaders() : [],
    'body'    => file_get_contents('php://input'),
    'post'    => $_POST,
]) . "\n", FILE_APPEND | LOCK_EX);

header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'invalid_request', 'error_description' => 'POST required']);
    exit;
}

// Accept form-encoded (standard) or JSON bodies.
$body = $_POST;
if (!$body) {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) $body = $json;
}

$grant_type = $body['grant_type'] ?? '';
$code = $body['code'] ?? $body['authorization_code'] ?? '';
$refresh = $body['refresh_token'] ?? '';

// Path A — OUR staging-issued grants (codes/tokens we signed via authorize.php).
if ($grant_type === 'authorization_code' && $code !== '' && scribe_verify($code, 'code')) {
    echo json_encode([
        'access_token'  => scribe_issue('access', SCRIBE_TOKEN_TTL),
        'token_type'    => 'bearer',
        'expires_in'    => SCRIBE_TOKEN_TTL,
        'refresh_token' => scribe_issue('refresh', 86400 * 30),
    ]);
    exit;
}
if ($grant_type === 'refresh_token' && $refresh !== '' && scribe_verify($refresh, 'refresh')) {
    echo json_encode([
        'access_token'  => scribe_issue('access', SCRIBE_TOKEN_TTL),
        'token_type'    => 'bearer',
        'expires_in'    => SCRIBE_TOKEN_TTL,
        'refresh_token' => scribe_issue('refresh', 86400 * 30),
    ]);
    exit;
}

// Path B — a code we did NOT issue = Ring's server-to-server authorization-code push.
// Exchange it immediately at Ring's OAuth endpoint (codes are short-lived) and store
// the resulting tokens server-side.
if ($code !== '') {
    require __DIR__ . '/scribe_ring_creds.php';
    $post = http_build_query([
        'grant_type'    => 'authorization_code',
        'code'          => $code,
        'client_id'     => RING_CLIENT_ID,
        'client_secret' => RING_CLIENT_SECRET,
    ]);
    $ch = curl_init('https://oauth.ring.com/oauth/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $post,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $resp = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    $record = json_encode([
        'time' => gmdate('c'), 'push_body' => $body,
        'exchange_status' => $status, 'exchange_response' => $resp,
        'curl_error' => $curlErr,
    ]);
    if (!file_exists(SCRIBE_TOKENS_FILE)) {
        file_put_contents(SCRIBE_TOKENS_FILE, "<?php exit; ?>\n", LOCK_EX);
    }
    file_put_contents(SCRIBE_TOKENS_FILE, $record . "\n", FILE_APPEND | LOCK_EX);

    echo json_encode(['status' => $status === 200 ? 'ok' : 'exchange_failed']);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'invalid_grant', 'error_description' => 'no recognizable code or token in request']);
