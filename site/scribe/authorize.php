<?php
// Scribe staging OAuth provider — authorization endpoint.
// Ring redirects the user here to link their Ring account to Scribe.
// Staging behavior: single approve button, no real login (one known staging user).

require __DIR__ . '/scribe_config.php';

// Staging diagnostics: record what Ring passes to the authorize page.
file_put_contents(__DIR__ . '/scribe_authorize_log_k7x2m9.txt', json_encode([
    'time'   => gmdate('c'),
    'method' => $_SERVER['REQUEST_METHOD'],
    'get'    => $_GET,
    'post'   => array_diff_key($_POST, ['approve' => 1]),
]) . "\n", FILE_APPEND | LOCK_EX);

$redirect_uri = $_GET['redirect_uri'] ?? $_POST['redirect_uri'] ?? '';
$state        = $_GET['state'] ?? $_POST['state'] ?? '';
$client_id    = $_GET['client_id'] ?? $_POST['client_id'] ?? '';
$nonce        = $_GET['nonce'] ?? '';
$time_param   = $_GET['time'] ?? '';

// Ring's real account-association arrival: ?nonce=<HMAC-SHA256(K,"time:account_id")>&time=<ms>
// (docs: one-way linking — Ring already pushed the auth code to our Token Exchange URL
// server-to-server before sending the user here). Staging: log, accept, confirm.
if ($nonce !== '') {
    require __DIR__ . '/scribe_ring_creds.php';
    $age_ok = $time_param !== '' && abs(time() - (int)((float)$time_param / 1000)) < 600;
    file_put_contents(__DIR__ . '/scribe_authorize_log_k7x2m9.txt', json_encode([
        'time' => gmdate('c'), 'type' => 'ring_nonce_association',
        'get' => $_GET, 'nonce_age_ok' => $age_ok,
    ]) . "\n", FILE_APPEND | LOCK_EX);
    ?><!DOCTYPE html>
    <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scribe — Linked</title><meta name="robots" content="noindex, nofollow">
    <style>body{font-family:'Segoe UI',system-ui,sans-serif;background:#f8fafc;color:#1e293b;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;max-width:420px;padding:2rem;text-align:center}
    .ok{color:#15803d;font-size:2rem;margin-bottom:.6rem}</style></head>
    <body><div class="card"><div class="ok">&#10003;</div>
    <h1 style="font-size:1.25rem;margin-bottom:.5rem">Your Ring account is linked to Scribe</h1>
    <p style="color:#475569;font-size:.92rem">Staging environment — you can close this page. Scribe will begin processing your camera events.</p>
    </div></body></html><?php
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['approve'])) {
    if (!preg_match('#^https://#', $redirect_uri)) {
        http_response_code(400);
        exit('Invalid redirect_uri');
    }
    $code = scribe_issue('code', SCRIBE_CODE_TTL);
    $sep = str_contains($redirect_uri, '?') ? '&' : '?';
    $target = $redirect_uri . $sep . 'code=' . urlencode($code)
            . ($state !== '' ? '&state=' . urlencode($state) : '');
    header('Location: ' . $target);
    exit;
}
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Ring to Scribe</title>
    <meta name="robots" content="noindex, nofollow">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; background: #f8fafc;
               display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
                max-width: 420px; padding: 2rem; text-align: center; }
        h1 { font-size: 1.3rem; font-weight: 800; color: #0f172a; margin-bottom: .6rem; }
        p { font-size: .92rem; line-height: 1.6; color: #475569; margin-bottom: 1.2rem; }
        button { background: #2563eb; color: #fff; border: 0; border-radius: 8px;
                 padding: .7rem 1.6rem; font-size: 1rem; font-weight: 600; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .stage { display: inline-block; background: #fef3c7; color: #92400e; font-size: .75rem;
                 font-weight: 600; padding: .2rem .6rem; border-radius: 999px; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <span class="stage">Staging environment</span>
        <h1>Link your Ring account to Scribe</h1>
        <p>Scribe will transcribe the audio from your Ring camera events into text.
           Approving creates the link for this staging test.</p>
        <form method="post">
            <input type="hidden" name="redirect_uri" value="<?php echo htmlspecialchars($redirect_uri); ?>">
            <input type="hidden" name="state" value="<?php echo htmlspecialchars($state); ?>">
            <input type="hidden" name="client_id" value="<?php echo htmlspecialchars($client_id); ?>">
            <button type="submit" name="approve" value="1">Approve link</button>
        </form>
    </div>
</body>
</html>
