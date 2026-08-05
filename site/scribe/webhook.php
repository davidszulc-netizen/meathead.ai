<?php
// Scribe staging webhook receiver.
// Ring POSTs event notifications here. Staging behavior: log everything
// (headers + body) so we can inspect exactly what Ring sends, then 200 OK.
// HMAC signature verification is logged but not yet enforced.

$logFile = __DIR__ . '/scribe_webhook_log_k7x2m9.txt';   // obscured name, staging only

$entry = [
    'time'    => gmdate('c'),
    'method'  => $_SERVER['REQUEST_METHOD'],
    'headers' => function_exists('getallheaders') ? getallheaders() : [],
    'query'   => $_GET,
    'body'    => file_get_contents('php://input'),
];

file_put_contents($logFile, json_encode($entry) . "\n", FILE_APPEND | LOCK_EX);

header('Content-Type: application/json');
echo json_encode(['status' => 'received']);
