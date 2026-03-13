'use strict';

// ── DesktopInput ──────────────────────────────────────────────────────────────
// Additional desktop controls:
//   Any non-reserved key  → fire
//   Left click            → aim + fire
//   Left click + drag     → aim + thrust impulse
//   Right click           → hyperspace

const _RESERVED_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Escape',
  'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock',
  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
  'PageUp','PageDown','Home','End','Insert','Delete','Backspace',
  'PrintScreen','ScrollLock','Pause','NumLock',
]);

const MOUSE_CLICK_MAX_DIST     = 20;   // px
const MOUSE_CLICK_MAX_DURATION = 300;  // ms
const MOUSE_DRAG_MIN_DIST      = 30;   // px
const MOUSE_IMPULSE_FACTOR     = 0.8;
const MOUSE_IMPULSE_MAX        = 600;

let _dKeys         = null;
let _dHyperspaceCb = null;
let _dCanvas       = null;

let _mouseDown      = false;
let _mouseStartX    = 0;
let _mouseStartY    = 0;
let _mouseStartTime = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
function _getShip() {
  return (typeof ship !== 'undefined') ? ship : null;
}

function _angleFromShipTo(x, y) {
  const s = _getShip();
  if (!s) return 0;
  return Math.atan2(y - s.y, x - s.x);
}

function _triggerFire() {
  if (!_dKeys) return;
  _dKeys.space = true;
  setTimeout(() => { if (_dKeys) _dKeys.space = false; }, 100);
}

// ── Any non-reserved key fires ────────────────────────────────────────────────
function _onExtraKey(e) {
  if (_RESERVED_KEYS.has(e.key)) return;
  if (typeof state === 'undefined' || state !== STATE.PLAYING) return;
  _triggerFire();
}

// ── Mouse handlers ────────────────────────────────────────────────────────────
function _onMouseDown(e) {
  if (e.button === 2) {
    // Right click → hyperspace
    if (typeof state !== 'undefined' && state === STATE.PLAYING) {
      if (_dHyperspaceCb) _dHyperspaceCb();
    }
    return;
  }
  if (e.button !== 0) return;
  _mouseDown      = true;
  _mouseStartX    = e.clientX;
  _mouseStartY    = e.clientY;
  _mouseStartTime = performance.now();
}

function _onMouseUp(e) {
  if (e.button !== 0 || !_mouseDown) return;
  _mouseDown = false;

  if (typeof state === 'undefined' || state !== STATE.PLAYING) return;

  const s = _getShip();
  if (!s || !s.alive) return;

  const dx   = e.clientX - _mouseStartX;
  const dy   = e.clientY - _mouseStartY;
  const dist = Math.hypot(dx, dy);
  const dur  = (performance.now() - _mouseStartTime) / 1000; // seconds

  if (dist < MOUSE_CLICK_MAX_DIST && dur * 1000 < MOUSE_CLICK_MAX_DURATION) {
    // ── Click → aim + fire ──
    s.targetAngle = _angleFromShipTo(e.clientX, e.clientY);
    _triggerFire();

  } else if (dist >= MOUSE_DRAG_MIN_DIST) {
    // ── Drag → aim + thrust impulse ──
    const angle   = Math.atan2(dy, dx);
    s.targetAngle = angle;

    const speed     = dist / Math.max(dur, 0.05);
    let magnitude   = (dist * speed * MOUSE_IMPULSE_FACTOR) / 1000;
    magnitude       = Math.min(magnitude, MOUSE_IMPULSE_MAX);

    s.applyImpulse(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
  }
}

function _onContextMenu(e) {
  e.preventDefault();
}

// ── Public API ────────────────────────────────────────────────────────────────
const DesktopInput = {
  init(keysRef, onHyperspace, canvas) {
    _dKeys         = keysRef;
    _dHyperspaceCb = onHyperspace;
    _dCanvas       = canvas;

    window.addEventListener('keydown',     _onExtraKey);
    _dCanvas.addEventListener('mousedown', _onMouseDown);
    window.addEventListener('mouseup',     _onMouseUp);       // window catches drag-out releases
    _dCanvas.addEventListener('contextmenu', _onContextMenu);
  },

  destroy() {
    window.removeEventListener('keydown',   _onExtraKey);
    window.removeEventListener('mouseup',   _onMouseUp);
    if (_dCanvas) {
      _dCanvas.removeEventListener('mousedown',   _onMouseDown);
      _dCanvas.removeEventListener('contextmenu', _onContextMenu);
    }
    _dKeys = null; _dHyperspaceCb = null; _dCanvas = null;
  },
};
