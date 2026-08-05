<?php
// Staging-only: retrieve stored Ring token-exchange records. Gated by a read key;
// the data file itself is exit-guarded against direct web reads.
require __DIR__ . '/scribe_ring_creds.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

if (!hash_equals(SCRIBE_TOKENS_READ_KEY, $_GET['k'] ?? '')) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

if (isset($_GET['live'])) {
    // Freshest token record (watcher-pushed or server-refreshed).
    require __DIR__ . '/scribe_token_lib.php';
    echo json_encode(['live' => scribe_live_token_read()]);
    exit;
}

if (!file_exists(SCRIBE_TOKENS_FILE)) {
    echo json_encode(['records' => []]);
    exit;
}

$lines = array_filter(array_map('trim', file(SCRIBE_TOKENS_FILE)));
$records = [];
foreach ($lines as $line) {
    if (str_starts_with($line, '<?php')) continue;
    $records[] = json_decode($line, true);
}
echo json_encode(['records' => $records]);
