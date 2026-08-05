<?php
// Watcher push endpoint: the PC watcher POSTs its freshest token set here after
// every refresh so server-side endpoints (ring_events/ring_clip) stay current.
// Key-gated; body is JSON {access_token, refresh_token, expires_at_ms}.
require __DIR__ . '/scribe_token_lib.php';

scribe_require_key();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST only']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body) || empty($body['access_token']) || empty($body['refresh_token'])) {
    http_response_code(400);
    echo json_encode(['error' => 'access_token and refresh_token required']);
    exit;
}

scribe_live_token_write([
    'access_token' => $body['access_token'],
    'refresh_token' => $body['refresh_token'],
    'expires_at_ms' => (int)($body['expires_at_ms'] ?? (time() + 14400 - 300) * 1000),
    'refreshed_by' => 'watcher',
]);
echo json_encode(['ok' => true]);
