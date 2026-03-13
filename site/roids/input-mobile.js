'use strict';

// ── MobileInput ───────────────────────────────────────────────────────────────
// Touch-based controls for mobile:
//   Tap          → rotate ship toward tap point + fire
//   Swipe        → rotate ship toward swipe direction + thrust impulse
//   Two-finger   → hyperspace

const TAP_MAX_DIST      = 20;     // px — max movement to still count as a tap
const TAP_MAX_DURATION  = 300;    // ms
const SWIPE_MIN_DIST    = 30;     // px — min movement for a swipe
const IMPULSE_FACTOR    = 0.8;    // scales swipe (length × speed) into velocity
const IMPULSE_MAX       = 600;    // cap on impulse magnitude

let _keys        = null;
let _hyperspaceCb = null;
let _canvas      = null;

// Primary-touch tracking
let _touchId        = null;
let _touchStartX    = 0;
let _touchStartY    = 0;
let _touchStartTime = 0;

// Two-finger swipe tracking
let _twoFingerStartY = 0;
let _twoFingerActive = false;

// ── Helpers ──────────────────────────────────────────────────────────────────
function getShip() {
  return (typeof ship !== 'undefined') ? ship : null;
}

function angleFromShipTo(x, y) {
  const s = getShip();
  if (!s) return 0;
  return Math.atan2(y - s.y, x - s.x);
}

// ── Touch handlers ───────────────────────────────────────────────────────────
function onTouchStart(e) {
  e.preventDefault();
  if (typeof Sound !== 'undefined') Sound.unlock();

  // Two-finger gesture → track for swipe-to-hyperspace
  if (e.touches.length >= 2 && !_twoFingerActive) {
    _twoFingerActive  = true;
    _twoFingerStartY  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    return;
  }

  if (_touchId !== null) return; // already tracking a gesture

  const t = e.changedTouches[0];
  _touchId        = t.identifier;
  _touchStartX    = t.clientX;
  _touchStartY    = t.clientY;
  _touchStartTime = performance.now();
}

function onTouchMove(e) {
  e.preventDefault();

  // Detect two-finger swipe
  if (_twoFingerActive && e.touches.length >= 2) {
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const dy   = Math.abs(midY - _twoFingerStartY);
    if (dy >= SWIPE_MIN_DIST) {
      _twoFingerActive = false;
      if (_hyperspaceCb) _hyperspaceCb();
    }
  }
}

function onTouchEnd(e) {
  e.preventDefault();

  // Reset two-finger tracking when fingers lift
  if (e.touches.length < 2) _twoFingerActive = false;

  const t = Array.from(e.changedTouches).find(c => c.identifier === _touchId);
  if (!t) return;
  _touchId = null;

  if (typeof state === 'undefined' || state !== STATE.PLAYING) return;

  const s = getShip();
  if (!s || !s.alive) return;

  const dx   = t.clientX - _touchStartX;
  const dy   = t.clientY - _touchStartY;
  const dist = Math.hypot(dx, dy);
  const dur  = (performance.now() - _touchStartTime) / 1000; // seconds

  if (dist < TAP_MAX_DIST && dur * 1000 < TAP_MAX_DURATION) {
    // ── TAP → aim + fire ──
    s.targetAngle = angleFromShipTo(t.clientX, t.clientY);

    if (_keys) {
      _keys.space = true;
      // Release after one frame-ish so only one shot fires per tap
      setTimeout(() => { if (_keys) _keys.space = false; }, 100);
    }

  } else if (dist >= SWIPE_MIN_DIST) {
    // ── SWIPE → aim + thrust impulse ──
    const swipeAngle = Math.atan2(dy, dx);
    s.targetAngle = swipeAngle;

    const speed     = dist / Math.max(dur, 0.05);          // px/s
    let magnitude   = (dist * speed * IMPULSE_FACTOR) / 1000;
    magnitude       = Math.min(magnitude, IMPULSE_MAX);

    s.applyImpulse(
      Math.cos(swipeAngle) * magnitude,
      Math.sin(swipeAngle) * magnitude
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
const MobileInput = {
  init(keysRef, onHyperspace) {
    _keys         = keysRef;
    _hyperspaceCb = onHyperspace;
    _canvas       = document.getElementById('gameCanvas');

    _canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    _canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    _canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

    return true; // no permissions needed
  },

  calibrate() {
    // No-op — no motion sensors to calibrate
  },

  destroy() {
    if (_canvas) {
      _canvas.removeEventListener('touchstart', onTouchStart);
      _canvas.removeEventListener('touchmove',  onTouchMove);
      _canvas.removeEventListener('touchend',   onTouchEnd);
    }
    _keys = null;
    _hyperspaceCb = null;
    _canvas = null;
  },
};
