<?php
// Per-camera Scribe configuration — the single source of truth for both the
// Chrome extension and the local python tools, so venue-specific tuning stops
// living as constants in code.
//
// GET  ?k=<key>[&device=<id>]            -> current config (defaults if unset)
// POST ?k=<key>[&device=<id>]  {json}    -> merge and store
//
// Defaults are deliberately GENERIC: no mask, no language assumptions, neutral
// venue. An unconfigured camera must behave sanely, not like the pilot lobby.
require __DIR__ . '/scribe_token_lib.php';

scribe_require_key();
header('Content-Type: application/json');

const SETTINGS_FILE = __DIR__ . '/scribe_settings_data_v7q2.php';

function settings_defaults() {
    return [
        // 'generic' | 'business' | 'home' — selects prompt framing.
        'venue' => 'generic',
        // Languages spoken in the space. Empty = let vendors auto-detect.
        // Populated by the extension's Detect button after sampling clips.
        'languages' => [],
        // Dominant language for vendors that accept only one ('' = auto).
        'primary_language' => '',
        // Screen/display rectangles to blank before people-counting, in a
        // 640x360 frame. Empty = no masking (safe default: masking the wrong
        // region hides real people).
        'mask_regions' => [],
        // null = derive from the clip itself rather than a fixed threshold.
        'noise_floor' => null,
        // Free-text description of the space, written by the owner and fed to
        // the models as scene context. Structured fields cannot express "a TV
        // plays at low volume in view" or "customers speak Spanish, staff speak
        // Mandarin to each other" — this can, and people describe their own
        // room far better than they answer dropdowns.
        'hints' => '',
        'notes' => '',
    ];
}

// Starter template offered to a camera that has never been configured.
function settings_hint_template() {
    return "Camera location: \n"
         . "Background audio (TV, radio, music — and how loud): \n"
         . "Languages — customers: \n"
         . "Languages — staff: \n"
         . "What matters most to hear: ";
}

function settings_load() {
    if (!file_exists(SETTINGS_FILE)) return [];
    foreach (file(SETTINGS_FILE) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '<?php')) continue;
        $d = json_decode($line, true);
        if (is_array($d)) return $d;
    }
    return [];
}

function settings_save(array $all) {
    $tmp = SETTINGS_FILE . '.tmp';
    file_put_contents($tmp, "<?php exit; ?>\n" . json_encode($all) . "\n", LOCK_EX);
    rename($tmp, SETTINGS_FILE);
}

$device = $_GET['device'] ?? 'default';
$all = settings_load();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON object required']);
        exit;
    }
    $cur = array_merge(settings_defaults(), $all[$device] ?? []);
    foreach (settings_defaults() as $field => $_) {
        if (array_key_exists($field, $body)) $cur[$field] = $body[$field];
    }
    $cur['updated'] = gmdate('c');
    $all[$device] = $cur;
    settings_save($all);
    echo json_encode(['ok' => true, 'device' => $device, 'settings' => $cur]);
    exit;
}

echo json_encode([
    'device' => $device,
    'configured' => isset($all[$device]),
    'settings' => array_merge(settings_defaults(), $all[$device] ?? []),
    'hint_template' => settings_hint_template(),
]);
