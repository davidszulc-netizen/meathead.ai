'use strict';

// m-7: roundRect() polyfill — Safari and older browsers lack native support
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r = 0) {
    // r=0 default prevents TypeError if caller omits the optional radii argument
    const rr = typeof r === 'number' ? [r, r, r, r] : [r[0]??0, r[1]??r[0]??0, r[2]??r[0]??0, r[3]??r[1]??r[0]??0];
    const [tl, tr, br, bl] = rr;
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let W = 0, H = 0;
let _starCache = null, _asteroidCache = null;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  // Invalidate cached intro canvases on resize
  _starCache = null;
  _asteroidCache = null;
}
// m-5: Debounce resize — mobile browsers fire resize continuously as toolbar shows/hides
let _resizeDebounce = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeDebounce);
  _resizeDebounce = setTimeout(resize, 150);
});
resize();

// M-6: localStorage helpers — try/catch guards against SecurityError in Safari Incognito
function safeLocalGet(key)      { try { return localStorage.getItem(key);    } catch (e) { console.warn('localStorage.getItem failed:', e); return null; } }
function safeLocalSet(key, val) { try { localStorage.setItem(key, val);      } catch (e) { console.warn('localStorage.setItem failed:', e); } }
function safeLocalRemove(key)   { try { localStorage.removeItem(key);        } catch (e) { console.warn('localStorage.removeItem failed:', e); } }

// ── Mobile detection ──────────────────────────────────────────────────────────
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|tablet/i.test(navigator.userAgent)
      || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
}
const IS_MOBILE = isMobile();

// ── State machine ─────────────────────────────────────────────────────────────
const STATE = { INTRO:'INTRO', PLAYING:'PLAYING', PAUSED:'PAUSED',
                LEVEL_UP:'LEVEL_UP', GAME_OVER:'GAME_OVER', TUTORIAL:'TUTORIAL' };
let state = STATE.INTRO;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = { left:false, right:false, up:false, down:false, space:false };
const keyMap = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up',
                 ArrowDown:'down', ' ':'space' };

window.addEventListener('keydown', e => {
  if (keyMap[e.key] !== undefined) { e.preventDefault(); keys[keyMap[e.key]] = true; }
  if (e.repeat) return; // guard: ignore held-key repeats for one-shot actions
  if (e.key === 'Escape')    handleEsc();
  if (e.key === 'ArrowDown' && state === STATE.PLAYING) { keys.down = false; handleHyperspace(); }
});

window.addEventListener('keyup', e => {
  if (keyMap[e.key] !== undefined) keys[keyMap[e.key]] = false;
  if (e.key === 'ArrowUp') Sound.stopThrust();
});

// ── Mobile: touch-to-start (gameplay touches handled by MobileInput) ─────────
// MobileInput.init() is called ONCE at startup here to prevent listener accumulation.
// Previously it was called inside initMobileAndStart() on every game start, causing
// touchstart/move/end handlers to stack up across multiple games.
if (IS_MOBILE) {
  MobileInput.init(keys, handleHyperspace);
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    Sound.unlock();
    if (state === STATE.TUTORIAL) tutNext();
    else if (state === STATE.INTRO) {
      const t0 = e.touches[0];
      const tx = t0 ? t0.clientX : 0;
      const ty = t0 ? t0.clientY : 0;
      if (IS_MOBILE && tx > W * 0.70 && ty < 60) {
        // Help button — re-show tutorial from step 0
        _tutStep = 0; _tutT = 0; _tutCycles = 0;
        state = STATE.TUTORIAL;
      } else if (IS_MOBILE && !safeLocalGet('tutorialSeen')) {
        _tutStep = 0; _tutT = 0; _tutCycles = 0;
        state = STATE.TUTORIAL;
      } else {
        startGame();
      }
    }
  }, { passive: false });
}

// ── Fullscreen helpers (mobile only) ─────────────────────────────────────────
function enterFullscreen() {
  if (!IS_MOBILE) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) req.call(el, { navigationUI: 'hide' }).catch(() => {});
}

function leaveFullscreen() {
  if (!IS_MOBILE) return;
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if (!isFs) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit) exit.call(document).catch(() => {});
}


// ── Game vars ─────────────────────────────────────────────────────────────────
let score = 0, hiScore = 0, lives = 3, level = 1, extraLifeAt = 10000;
let doubleLifeMode = false;
let ship = null, asteroids = [], bullets = [], ufo = null;
let particles = new ParticleSystem();
let ufoTimer = 0;
const UFO_INTERVAL   = 20;
const FIRE_INTERVAL  = 0.2;
const LEVEL_UP_DELAY = 2.5;
let fireTimer = 0, levelUpTimer = 0;
let thrustWasOn = false;
let blinkTimer = 0, blinkOn = true;

// C-2: dt-based timers replacing setTimeout — these tick only inside update(), so they
// automatically pause when the game loop stops executing (e.g. when state !== PLAYING).
let _respawnTimer = 0;          // seconds until ship respawns after death (lives > 0)
let _gameOverTimer = 0;         // seconds until GAME_OVER state is entered (lives === 0)
let _gameOverAutoReturnTimer = 0; // seconds until auto-return from GAME_OVER to INTRO

// m-14: Named constants for particle explosion parameters
const SHIP_EXPLODE_COUNT = 40, SHIP_EXPLODE_SPEED_MIN = 60, SHIP_EXPLODE_SPEED_MAX = 250, SHIP_EXPLODE_LIFE = 1.5;
const UFO_EXPLODE_COUNT  = 16, UFO_EXPLODE_SPEED_MIN  = 50, UFO_EXPLODE_SPEED_MAX  = 200, UFO_EXPLODE_LIFE  = 0.8;
const ASTEROID_EXPLODE_COUNTS = { large: 20, medium: 12, small: 7 };
const ASTEROID_EXPLODE_SPEED_MIN = 40, ASTEROID_EXPLODE_SPEED_MAX = 160, ASTEROID_EXPLODE_LIFE = 0.7;

// ── Helpers ───────────────────────────────────────────────────────────────────

// fireImmediate(): direct fire entry point for mouse/touch input — bypasses keys.space
// state machine entirely. One shared function; both input modules call it rather than
// inlining shoot() logic independently.
function fireImmediate() {
  if (!ship || !ship.alive || state !== STATE.PLAYING) return;
  if (bullets.filter(b => !b.fromUFO).length < 4) {
    const b = ship.shoot();
    if (b) { bullets.push(b); Sound.fire(); }
  }
  fireTimer = 0;
}

function totalForLevel(lvl) { return Math.min(lvl + 1, 20); }

function spawnLevel() {
  setAsteroidLevel(level);
  const count = totalForLevel(level);
  asteroids = [];
  for (let i = 0; i < count; i++)
    asteroids.push(spawnAsteroid(W, H, W / 2, H / 2, 150, 'large'));
  bullets = [];
  ufo = null;
  ufoTimer = UFO_INTERVAL * (0.5 + Math.random());
  Sound.startBeat(asteroids.length, count);
}

function startGame() {
  doubleLifeMode = safeLocalGet('doubleLifeNextGame') === '1'; // M-6: safe localStorage read
  if (doubleLifeMode) safeLocalRemove('doubleLifeNextGame');   // M-6: safe localStorage remove
  score = 0; lives = doubleLifeMode ? 6 : 3; level = 1; extraLifeAt = 10000;
  // C-2 follow-up: clear dt-timers on new game so stale state from a previous session can't fire
  _respawnTimer = 0; _gameOverTimer = 0; _gameOverAutoReturnTimer = 0;
  ship = new Ship(W / 2, H / 2);
  ship.invincible = INVINCIBILITY_DURATION;
  particles.clear();
  if (IS_MOBILE) MobileInput.calibrate();
  spawnLevel();
  state = STATE.PLAYING;
  enterFullscreen();
  if (!window.Capacitor && IS_MOBILE) history.pushState({ gameActive: true }, '');
}

function initMobileAndStart() {
  if (state !== STATE.INTRO) return;
  startGame(); // MobileInput.init() already called once at startup
}

function respawnShip() {
  ship = new Ship(W / 2, H / 2);
  ship.invincible = INVINCIBILITY_DURATION;
}

function handleEsc() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    Sound.stopBeat(); Sound.stopUFO(); Sound.stopThrust();
    leaveFullscreen();
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    Sound.startBeat(asteroids.length, totalForLevel(level));
    if (ufo) Sound.startUFO();
    enterFullscreen();
  }
}

function handleHyperspace() {
  if (!ship || !ship.alive) return;
  Sound.hyperspace();
  if (ship.hyperspace(W, H, asteroids)) killShip();
}

function killShip() {
  Sound.stopThrust();
  Sound.shipExplode();
  // m-14: named explosion constants replace magic numbers
  particles.explode(ship.x, ship.y, SHIP_EXPLODE_COUNT, SHIP_EXPLODE_SPEED_MIN, SHIP_EXPLODE_SPEED_MAX, SHIP_EXPLODE_LIFE, '#f5c8a0');
  ship.alive = false;
  lives--;
  if (lives <= 0) {
    // C-2: was setTimeout(..., 1500) — now a dt-timer so it pauses with the game
    _gameOverTimer = 1.5;
  } else {
    // C-2: was setTimeout(respawnShip, 2000) — now a dt-timer so it pauses with the game
    _respawnTimer = 2.0;
  }
}

function addScore(pts) {
  score += pts;
  if (score >= extraLifeAt) { lives++; extraLifeAt += 10000; Sound.extraLife(); }
}

// ── Collisions ────────────────────────────────────────────────────────────────
function overlaps(ax, ay, ar, bx, by, br) {
  return Math.hypot(ax - bx, ay - by) < ar + br;
}

function checkCollisions() {
  // Player bullets vs asteroids
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    if (b.fromUFO) continue;
    for (let ai = asteroids.length - 1; ai >= 0; ai--) {
      const a = asteroids[ai];
      if (overlaps(b.x, b.y, b.radius, a.x, a.y, a.radius)) {
        bullets.splice(bi, 1);
        const children = a.split();
        asteroids.splice(ai, 1);
        asteroids.push(...children);
        addScore(a.score);
        Sound.asteroidExplode(a.size);
        // m-14: named explosion constants
        particles.explode(a.x, a.y, ASTEROID_EXPLODE_COUNTS[a.size], ASTEROID_EXPLODE_SPEED_MIN, ASTEROID_EXPLODE_SPEED_MAX, ASTEROID_EXPLODE_LIFE, '#f5c8a0');
        Sound.updateBeat(asteroids.length, totalForLevel(level));
        break;
      }
    }
  }

  // Player bullets vs UFO
  if (ufo) {
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.fromUFO) continue;
      if (overlaps(b.x, b.y, b.radius, ufo.x, ufo.y, ufo.radius)) {
        bullets.splice(bi, 1);
        addScore(ufo.score);
        particles.explode(ufo.x, ufo.y, UFO_EXPLODE_COUNT, UFO_EXPLODE_SPEED_MIN, UFO_EXPLODE_SPEED_MAX, UFO_EXPLODE_LIFE, '#c8f0c8');
        Sound.asteroidExplode('medium');
        Sound.stopUFO();
        ufo = null;
        ufoTimer = UFO_INTERVAL * (0.8 + Math.random());
        break;
      }
    }
  }

  if (!ship || !ship.alive || ship.invincible > 0) return;

  // Ship vs asteroids
  for (const a of asteroids) {
    if (overlaps(ship.x, ship.y, ship.radius * 0.7, a.x, a.y, a.radius * 0.85)) {
      killShip(); return;
    }
  }

  // Ship vs UFO bullets
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    if (!b.fromUFO) continue;
    if (overlaps(b.x, b.y, b.radius + 2, ship.x, ship.y, ship.radius * 0.7)) {
      bullets.splice(bi, 1); killShip(); return;
    }
  }

  // Ship vs UFO body
  if (ufo && overlaps(ship.x, ship.y, ship.radius * 0.7, ufo.x, ufo.y, ufo.radius)) {
    killShip();
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
let lastTime = null;

function update(dt) {
  particles.update(dt);

  // Thrust sound gating
  if (ship && ship.alive && keys.up) {
    if (!thrustWasOn) { Sound.startThrust(); thrustWasOn = true; }
  } else {
    if (thrustWasOn) { Sound.stopThrust(); thrustWasOn = false; }
  }

  if (ship) ship.update(dt, keys, W, H);

  // Auto-fire (hold space, max 4 player bullets)
  if (keys.space && ship && ship.alive) {
    fireTimer -= dt;
    if (fireTimer <= 0) {
      if (bullets.filter(b => !b.fromUFO).length < 4) {
        const b = ship.shoot();
        if (b) { bullets.push(b); Sound.fire(); }
      }
      fireTimer = FIRE_INTERVAL;
    }
  } else {
    fireTimer = 0;
  }

  for (const a of asteroids) a.update(dt, W, H);

  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update(dt, W, H);
    if (bullets[i].dead) bullets.splice(i, 1);
  }

  // UFO spawning
  if (!ufo) {
    ufoTimer -= dt;
    if (ufoTimer <= 0) { ufo = new UFO(W, H); Sound.startUFO(); }
  }

  // UFO AI
  if (ufo) {
    ufo.update(dt);
    if (!ufo.alive) {
      Sound.stopUFO(); ufo = null;
      ufoTimer = UFO_INTERVAL * (0.5 + Math.random());
    } else if (ship && ship.alive) {
      const b = ufo.tryFire(ship.x, ship.y);
      if (b) bullets.push(b);
    }
  }

  checkCollisions();

  // Level clear
  if (asteroids.length === 0 && !ufo) {
    Sound.stopBeat();
    state = STATE.LEVEL_UP;
    levelUpTimer = LEVEL_UP_DELAY;
  }

  // C-2: dt-based respawn/game-over timers — run inside update() so they pause with the game
  if (_respawnTimer > 0) {
    _respawnTimer -= dt;
    if (_respawnTimer <= 0) { _respawnTimer = 0; respawnShip(); }
  }
  if (_gameOverTimer > 0) {
    _gameOverTimer -= dt;
    if (_gameOverTimer <= 0) {
      _gameOverTimer = 0;
      if (score > hiScore) hiScore = score;
      Sound.stopBeat(); Sound.stopUFO();
      leaveFullscreen();
      state = STATE.GAME_OVER;
      _gameOverAutoReturnTimer = 2.0;
    }
  }
}

function updateLevelUp(dt) {
  particles.update(dt);
  levelUpTimer -= dt;
  if (levelUpTimer <= 0) {
    level++;
    spawnLevel();
    if (!ship || !ship.alive) ship = new Ship(W / 2, H / 2);
    ship.invincible = INVINCIBILITY_DURATION;
    // C-2 follow-up: clear pending death timers — edge case where ship dies as last asteroid
    // is cleared causes these timers to fire mid-next-level if not reset here
    _respawnTimer = 0; _gameOverTimer = 0;
    state = STATE.PLAYING;
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '20px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${String(score).padStart(6, '0')}`, 20, 36);
  if (doubleLifeMode) {
    ctx.fillStyle = '#f5c8a0';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('\u2605 2X LIVES', 20, 56);
    ctx.fillStyle = '#fff';
    ctx.font = '20px "Courier New", monospace';
  }
  if (!IS_MOBILE) {
    ctx.textAlign = 'center';
    ctx.fillText(`HI  ${String(hiScore).padStart(6, '0')}`, W / 2, 36);
    ctx.textAlign = 'right';
    ctx.fillText(`LEVEL  ${level}`, W - 20, 36);
    ctx.textAlign = 'left';
  }

  for (let i = 0; i < lives; i++) {
    ctx.save();
    ctx.translate(20 + i * 32, 60);
    ctx.scale(0.6, 0.6);

    // Tube body
    ctx.fillStyle   = '#d4f0d4';
    ctx.strokeStyle = '#aaddaa';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(-14, -7, 28, 14, 4);
    ctx.fill(); ctx.stroke();

    // Nozzle
    ctx.fillStyle   = '#fff';
    ctx.strokeStyle = '#ccc';
    ctx.beginPath();
    ctx.roundRect(14, -4, 8, 8, 2);
    ctx.fill(); ctx.stroke();

    // Crimp ridges
    ctx.strokeStyle = '#aaddaa';
    ctx.lineWidth   = 1;
    for (const dx of [0, -3]) {
      ctx.beginPath();
      ctx.moveTo(-14 + dx, -6);
      ctx.lineTo(-14 + dx,  6);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle    = '#2a6e2a';
    ctx.font         = 'bold 7px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ROIDS', -1, 0);

    ctx.restore();
  }
}

function drawScene() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (const a of asteroids) a.draw(ctx);
  for (const b of bullets)   b.draw(ctx);
  if (ufo)  ufo.draw(ctx);
  if (ship) ship.draw(ctx);
  particles.draw(ctx);
  drawHUD();
}

// ── Intro screen (mobile: rich; desktop: simple) ──────────────────────────────

// Seeded RNG for deterministic asteroid shape
function makeSeeded(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function drawStarfield() {
  if (!_starCache || _starCache.width !== W || _starCache.height !== H) {
    _starCache = document.createElement('canvas');
    _starCache.width  = W;
    _starCache.height = H;
    const sc = _starCache.getContext('2d');
    sc.fillStyle = '#000';
    sc.fillRect(0, 0, W, H);
    const rng = makeSeeded(42);
    for (let i = 0; i < 120; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const r = 0.5 + rng() * 1.5;
      sc.beginPath();
      sc.arc(x, y, r, 0, Math.PI * 2);
      sc.fillStyle = `rgba(255,255,255,${0.4 + rng() * 0.6})`;
      sc.fill();
    }
  }
  ctx.drawImage(_starCache, 0, 0);
}

function drawIntroButt() {
  const targetRadius = Math.min(W, H) * 0.28;
  const panelBottom = H / 2 + (IS_MOBILE ? 155 : 160);
  const cx = W / 2;
  const cy = Math.min(panelBottom + targetRadius * 0.5, H - targetRadius - 8);
  const cacheSize = Math.ceil(targetRadius * 3);

  if (!_asteroidCache
      || _asteroidCache.width  !== cacheSize
      || _asteroidCache.height !== cacheSize) {
    _asteroidCache = document.createElement('canvas');
    _asteroidCache.width  = cacheSize;
    _asteroidCache.height = cacheSize;
    const ac  = _asteroidCache.getContext('2d');
    const ocx = cacheSize / 2;
    const ocy = cacheSize / 2;

    const r = targetRadius;

    // Soft glow behind the butt
    const glow = ac.createRadialGradient(ocx, ocy, 0, ocx, ocy, r * 1.1);
    glow.addColorStop(0,   'rgba(245,200,160,0.22)');
    glow.addColorStop(1,   'rgba(245,200,160,0)');
    ac.fillStyle = glow;
    ac.fillRect(0, 0, cacheSize, cacheSize);

    ac.strokeStyle = '#f5c8a0';
    ac.lineWidth   = 3;
    ac.fillStyle   = 'rgba(245,200,160,0.22)';

    // Single continuous butt outline
    ac.beginPath();
    ac.moveTo(ocx,            ocy - r*0.50);
    ac.bezierCurveTo(ocx + r*0.18, ocy - r*0.80,  ocx + r*0.82, ocy - r*0.62,  ocx + r*0.86, ocy - r*0.05);
    ac.bezierCurveTo(ocx + r*0.90, ocy + r*0.38,  ocx + r*0.52, ocy + r*0.76,  ocx,          ocy + r*0.82);
    ac.bezierCurveTo(ocx - r*0.52, ocy + r*0.76,  ocx - r*0.90, ocy + r*0.38,  ocx - r*0.86, ocy - r*0.05);
    ac.bezierCurveTo(ocx - r*0.82, ocy - r*0.62,  ocx - r*0.18, ocy - r*0.80,  ocx,          ocy - r*0.50);
    ac.closePath();
    ac.fill();
    ac.stroke();

    // Butt crack
    ac.beginPath();
    ac.moveTo(ocx, ocy - r * 0.50);
    ac.quadraticCurveTo(ocx + r * 0.04, ocy + r * 0.10, ocx, ocy + r * 0.44);
    ac.stroke();
  }

  const s = _asteroidCache.width;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, -1);
  ctx.drawImage(_asteroidCache, -s / 2, -s / 2);
  ctx.restore();
}

function drawInstructionsPanel() {
  const panelW = Math.min(W * 0.82, 460);
  const panelH = IS_MOBILE ? 310 : 320;
  const px = W / 2 - panelW / 2;
  const py = H / 2 - panelH / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 14);
    ctx.fill();
  } else {
    ctx.fillRect(px, py, panelW, panelH);
  }

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';

  // Cream tube above panel
  if (IS_MOBILE) {
    _tutCreamBottle(W / 2, py - 65, 0, 5.25, 1);
  } else {
    _tutCreamBottle(W / 2, py - 52, 0, 3.5, 1);
  }

  const subtitleY = IS_MOBILE ? py + 8 : py + 68;
  ctx.font = '24px "Courier New", monospace';
  ctx.fillStyle = '#f5c8a0';
  ctx.fillText('Maximum Relief Edition', W / 2, subtitleY);

  ctx.font = '17px "Courier New", monospace';
  ctx.fillStyle = '#ddd';
  const lines = IS_MOBILE
    ? [
        'TAP           Aim + Fire',
        'SWIPE         Thrust',
        'TWO-FINGER SWIPE  Hyperspace',
      ]
    : [
        '↑ / LEFT DRAG    Thrust',
        '← / →            Rotate',
        'SPACE / ANY KEY  Fire',
        '↓ / RIGHT CLICK  Hyperspace',
        'LEFT CLICK       Aim + Fire',
        'ESC              Pause',
      ];
  const ctrlY0 = IS_MOBILE ? subtitleY + 32 : py + 110;

  // Help button — upper-right corner of screen (visible above panel)
  if (IS_MOBILE) {
    ctx.save();
    ctx.textAlign    = 'right';
    ctx.font         = '30px "Courier New", monospace';
    ctx.fillStyle    = 'rgba(255,255,255,0.65)';
    ctx.fillText('? Help', W - 16, 42);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    ctx.fillText(line, px + 24, ctrlY0 + i * 28);
  });
  ctx.textAlign = 'center';

  if (IS_MOBILE && blinkOn) {
    ctx.fillStyle = '#fff';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('— TOUCH TO START —', W / 2, py + panelH - 36);
  }

  if (hiScore > 0) {
    ctx.fillStyle = '#888';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText(`HI SCORE  ${String(hiScore).padStart(6, '0')}`, W / 2, py + panelH + 24);
  }

  ctx.textAlign = 'left';
}

function drawRoidCreamButton() {
  if (!blinkOn) return;

  const panelH = 320; // desktop panel height
  const py  = H / 2 - panelH / 2;
  const bx  = W / 2;
  const by  = py + panelH + 60;

  ctx.save();
  ctx.translate(bx, by);

  const tw = 164, th = 28;

  // Tube body — cream white
  ctx.fillStyle   = '#f0f5f0';
  ctx.strokeStyle = '#999';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw - 18, th, 5);
  ctx.fill(); ctx.stroke();

  // Green label band
  ctx.fillStyle = '#2a7a2a';
  ctx.beginPath();
  ctx.roundRect(-tw / 2 + 5, -th / 2 + 5, tw - 32, th - 10, 2);
  ctx.fill();

  // Label text
  ctx.fillStyle    = '#c8f0c8';
  ctx.font         = 'bold 8px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ROIDS CREAM', -12, 0);

  // Cap — right end
  ctx.fillStyle   = '#ddd';
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(tw / 2 - 20, -10, 12, 20, 2);
  ctx.fill(); ctx.stroke();

  // Nozzle tip
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.roundRect(tw / 2 - 8, -4, 8, 8, 2);
  ctx.fill(); ctx.stroke();

  // Crimp lines at left end
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth   = 1;
  for (const dx of [-tw / 2 + 2, -tw / 2 + 5]) {
    ctx.beginPath();
    ctx.moveTo(dx, -th / 2 + 3);
    ctx.lineTo(dx,  th / 2 - 3);
    ctx.stroke();
  }

  // "Click to apply" prompt below
  ctx.fillStyle    = '#fff';
  ctx.font         = '14px "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.fillText('— CLICK TO APPLY —', 0, th / 2 + 10);

  ctx.restore();
}

function drawIntro() {
  drawStarfield();
  drawIntroButt();
  drawInstructionsPanel();
  if (!IS_MOBILE) drawRoidCreamButton();
}


function drawPause() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px "Courier New", monospace';
  ctx.fillText('PAUSED', W / 2, H / 2);
  ctx.font = '20px "Courier New", monospace';
  if (IS_MOBILE) {
    ctx.fillText('Tap screen to resume', W / 2, H / 2 + 48);
    ctx.fillText('Back < to Quit', W / 2, H / 2 + 76);
  } else {
    ctx.fillText('ESC to resume', W / 2, H / 2 + 56);
  }
  ctx.textAlign = 'left';
}

function drawLevelUp() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.fillText(`LEVEL ${level + 1}`, W / 2, H / 2);
  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 72px "Courier New", monospace';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
  ctx.font = '28px "Courier New", monospace';
  ctx.fillText(`SCORE  ${String(score).padStart(6, '0')}`, W / 2, H / 2 + 40);
  ctx.textAlign = 'left';
}


// ── Tutorial (first-run onboarding, mobile only) ──────────────────────────────

let _tutStep = 0, _tutT = 0, _tutCycles = 0;
const TUT_STEP_DUR    = 4.0;
const TUT_SHOW_PROMPT = 2;

function tutNext() {
  _tutStep++; _tutT = 0; _tutCycles = 0;
  if (_tutStep >= 3) { safeLocalSet('tutorialSeen', '1'); state = STATE.INTRO; }
}

function updateTutorial(dt) {
  _tutT += dt;
  if (_tutT >= TUT_STEP_DUR) { _tutT -= TUT_STEP_DUR; _tutCycles++; }
}

// Cream bottle for tutorial scenes — matches HUD lives indicator.
// angle: nozzle (+X side) points in this direction; scale defaults to 2.5.
function _tutCreamBottle(x, y, angle, scale, alpha) {
  const sc = scale ?? 2.5;
  ctx.save();
  ctx.globalAlpha = alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(angle ?? 0);
  ctx.scale(sc, sc);

  ctx.fillStyle   = '#d4f0d4';
  ctx.strokeStyle = '#aaddaa';
  ctx.lineWidth   = 1.5 / sc;
  ctx.beginPath();
  ctx.roundRect(-14, -7, 28, 14, 4);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle   = '#fff';
  ctx.strokeStyle = '#ccc';
  ctx.beginPath();
  ctx.roundRect(14, -4, 8, 8, 2);
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = '#aaddaa';
  ctx.lineWidth   = 1 / sc;
  for (const dx of [0, -3]) {
    ctx.beginPath();
    ctx.moveTo(-14 + dx, -6);
    ctx.lineTo(-14 + dx,  6);
    ctx.stroke();
  }

  ctx.fillStyle    = '#2a6e2a';
  ctx.font         = 'bold 7px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ROIDS', -1, 0);

  ctx.restore();
}

// Exact Asteroid.draw() replica so tutorial matches in-game look
function _tutRealAst(x, y, r, rot, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(rot ?? 0);
  ctx.strokeStyle = '#f5c8a0';
  ctx.lineWidth   = 1.5;
  ctx.fillStyle   = 'rgba(245,200,160,0.15)';
  ctx.beginPath();
  ctx.moveTo(0, -r*0.50);
  ctx.bezierCurveTo( r*0.18,-r*0.80,  r*0.82,-r*0.62,  r*0.86,-r*0.05);
  ctx.bezierCurveTo( r*0.90, r*0.38,  r*0.52, r*0.76,  0,       r*0.82);
  ctx.bezierCurveTo(-r*0.52, r*0.76, -r*0.90, r*0.38, -r*0.86, -r*0.05);
  ctx.bezierCurveTo(-r*0.82,-r*0.62, -r*0.18,-r*0.80,  0,      -r*0.50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r*0.50);
  ctx.quadraticCurveTo(r*0.04, r*0.10, 0, r*0.44);
  ctx.stroke();
  ctx.restore();
}

// Touch-point indicator for tutorial gestures.
// Shows one or two contact dots at (tipX, tipY).
// twoFinger: dots are separated along the local X axis so they stack
//            correctly after rotation (e.g. rotation=-PI/2 → side by side on screen).
function _tutHand(tipX, tipY, rotation, twoFinger, alpha) {
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(rotation ?? 0);
  ctx.globalAlpha = alpha ?? 1;

  function dot(lx, ly) {
    ctx.beginPath();
    ctx.arc(lx, ly, 16, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
  }

  if (twoFinger) {
    dot(-14, 0);
    dot( 14, 0);
  } else {
    dot(0, 0);
  }

  ctx.restore();
}

// Swipe trail; returns the current tip position {tx,ty} for hand placement
function _tutTrail(x0, y0, x1, y1, progress, alpha) {
  const tx = x0 + (x1 - x0) * progress;
  const ty = y0 + (y1 - y0) * progress;
  ctx.save();
  const grad = ctx.createLinearGradient(x0, y0, tx, ty);
  grad.addColorStop(0, 'rgba(200,220,255,0)');
  grad.addColorStop(1, `rgba(200,220,255,${alpha * 0.45})`);
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 16;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.restore();
  return { tx, ty };
}

function _tutLabel(line1, line2) {
  ctx.save();
  ctx.textAlign   = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur  = 12;
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 34px "Courier New", monospace';
  ctx.fillText(line1, W / 2, 70);
  if (line2) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font      = '22px "Courier New", monospace';
    ctx.fillText(line2, W / 2, 100);
  }
  ctx.restore();
}

function _tutNav(showContinue) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(W / 2 + (i - 1) * 22, 28, 6, 0, Math.PI * 2);
    ctx.fillStyle = i === _tutStep ? '#fff' : 'rgba(255,255,255,0.28)';
    ctx.fill();
  }
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = 'rgba(255,255,255,0.35)';
  ctx.textAlign   = 'right';
  ctx.font        = '14px "Courier New", monospace';
  ctx.fillText('Back to skip', W - 16, 24);
  if (showContinue && blinkOn) {
    ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.textAlign = 'center';
    ctx.font      = '18px "Courier New", monospace';
    ctx.fillText('Tap to continue →', W / 2, H - 84);
  }
  ctx.restore();
}

// ── Step 0: TAP — Aim + Fire (moving asteroid, three sequential taps) ──────────
function _tutStep0() {
  const p = _tutT / TUT_STEP_DUR;
  const T = _tutT;

  // Fast background asteroids
  _tutRealAst(W*0.82 - T*W*0.22, H*0.14, 13, T*0.9,  0.40);
  _tutRealAst(W*0.10 + T*W*0.19, H*0.58, 11, -T*1.1, 0.36);
  _tutRealAst(W*0.68 - T*W*0.17, H*0.80, 16, T*0.7,  0.42);
  _tutRealAst(W*0.35 + T*W*0.24, H*0.20, 9,  -T*1.3, 0.34);
  _tutRealAst(W*0.90 - T*W*0.26, H*0.50, 14, T*1.0,  0.38);
  _tutRealAst(W*0.15 + T*W*0.21, H*0.70, 10, -T*0.8, 0.32);

  // Asteroid drifts right; position is deterministic from _tutT
  const AST_SPEED = W * 0.068;
  const AST_R     = 22;
  const AST_Y     = H * 0.36;
  const astX      = W * 0.26 + AST_SPEED * _tutT;
  const astRot    = _tutT * 0.35;

  // Fixed tap target: where the asteroid is at the third-tap moment. All three
  // taps land at this same spot — asteroid drifts in from the left, third bullet
  // makes kill contact. Ship aims at the fixed point throughout (no chasing).
  const TAP_P    = [0.12, 0.38, 0.64];
  const NOZZLE_DIST = 22 * 0.6;
  // fixTapX is where the asteroid IS when the third bullet ARRIVES (tapP+travel).
  // Bullets 1 and 2 hit empty space ahead; only bullet 3 coincides with the asteroid.
  const fixTapX  = W * 0.26 + AST_SPEED * ((TAP_P[2] + 0.15) * TUT_STEP_DUR);
  const fixTapY  = AST_Y;

  // Ship in lower-left — nozzle always aimed at the fixed target
  const shipX    = W * 0.12, shipY = H * 0.66;
  const aimAngle = Math.atan2(fixTapY - shipY, fixTapX - shipX);
  _tutCreamBottle(shipX, shipY, aimAngle, 0.6, 1);

  // Nozzle tip (fixed since aim is fixed)
  const nozzleX  = shipX + Math.cos(aimAngle) * NOZZLE_DIST;
  const nozzleY  = shipY + Math.sin(aimAngle) * NOZZLE_DIST;
  const contY    = fixTapY - AST_R - 2;

  // Asteroid: intact until third bullet hits (killP=0.79), then splits into two
  // small fragments that drift apart. Cycle gap (p=0.97-1.0) both fragments gone.
  const killP = TAP_P[2] + 0.15; // = 0.79
  if (p < killP) {
    _tutRealAst(astX, AST_Y, AST_R, astRot, 1);
  } else {
    const sp = p - killP;
    const drift = sp * TUT_STEP_DUR * W * 0.048;
    _tutRealAst(fixTapX - drift * 0.75, fixTapY - drift * 0.65, 11, astRot + sp * 3.0, 1);
    _tutRealAst(fixTapX + drift * 0.85, fixTapY + drift * 0.40, 11, astRot - sp * 2.5, 1);
  }

  // Three taps — all at the same fixed spot
  TAP_P.forEach(tapP => {
    const hIn  = tapP - 0.07;
    const hOut = tapP + 0.09;
    if (p > hIn && p < hOut) {
      let fa, descent;
      if (p <= tapP) {
        fa      = (p - hIn) / (tapP - hIn);
        descent = 38 * (1 - fa);
      } else {
        const lp = (p - tapP) / (hOut - tapP);
        fa       = 1 - lp;
        descent  = 28 * lp;
      }
      _tutHand(fixTapX, contY - descent, Math.PI, false, fa * 0.86);
    }

    const bEnd = tapP + 0.15;
    if (p >= tapP && p < bEnd) {
      const bp = (p - tapP) / 0.15;
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(
        nozzleX + (fixTapX - nozzleX) * bp,
        nozzleY + (fixTapY - nozzleY) * bp,
        3.5, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
  });

  // Starburst at kill point — 16 rays expanding and fading, matching in-game debris style
  if (p >= killP && p < killP + 0.12) {
    const sp  = p - killP;
    const fa  = 1 - sp / 0.12;
    const rOuter = AST_R * (0.8 + sp * 14.0);
    ctx.save();
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const angle  = (i / 16) * Math.PI * 2;
      const bright = i % 2 === 0 ? 1.0 : 0.55;
      ctx.globalAlpha  = fa * bright;
      ctx.strokeStyle  = i % 3 === 0 ? '#f5c8a0' : '#fff';
      ctx.beginPath();
      ctx.moveTo(fixTapX + Math.cos(angle) * 3, fixTapY + Math.sin(angle) * 3);
      ctx.lineTo(fixTapX + Math.cos(angle) * rOuter, fixTapY + Math.sin(angle) * rOuter);
      ctx.stroke();
    }
    ctx.restore();
  }

  _tutLabel('TAP', 'Aim + Fire');
  _tutNav(_tutCycles >= TUT_SHOW_PROMPT);
}

// ── Step 1: SWIPE — Thrust ────────────────────────────────────────────────────
function _tutStep1() {
  const p   = _tutT / TUT_STEP_DUR;
  const sx0 = W * 0.45, sy0 = H * 0.68;
  const sx1 = W * 0.45, sy1 = H * 0.22;
  const sa  = -Math.PI / 2; // pointing up
  const swX = W * 0.68, swY0 = H * 0.74, swY1 = H * 0.24;

  // Fast background asteroids
  const T = _tutT;
  _tutRealAst(W*0.88 - T*W*0.23, H*0.14, 14, T*0.8,  0.42);
  _tutRealAst(W*0.55 - T*W*0.18, H*0.78, 10, T*1.2,  0.36);
  _tutRealAst(W*0.40 + T*W*0.24, H*0.30, 15, -T*0.9, 0.40);
  _tutRealAst(W*0.18 + T*W*0.22, H*0.88, 13, -T*0.7, 0.38);
  _tutRealAst(W * 0.74 - p * W * 0.04, H * 0.56, 13, -p * 0.40, 0.38);

  // Swipe gesture: appear → swipe → fade
  let swP = 0, fa = 0;
  if (p > 0.06 && p < 0.74) {
    if      (p < 0.16) fa = (p - 0.06) / 0.10;
    else if (p < 0.62) { fa = 1; swP = (p - 0.16) / 0.46; }
    else               fa = 1 - (p - 0.62) / 0.12;
    const { tx, ty } = _tutTrail(swX, swY0, swX, swY1, Math.min(swP, 1), fa);
    _tutHand(tx, ty, 0, false, fa * 0.84); // rotation=0 → finger points UP
  }

  // Ship: ease-in thrust phase, then constant velocity drift off top of screen.
  // No deceleration — once thrust ends the ship continues at terminal speed.
  const THRUST_END = 0.50;
  const sy_mid     = H * 0.44; // position at end of thrust (65% of total travel)
  let   shipX = sx0, shipY = sy0, thrustFrac = 0;

  if (p > 0.16) {
    if (p <= THRUST_END) {
      const tp  = (p - 0.16) / (THRUST_END - 0.16); // 0→1 during thrust
      shipY     = sy0 + (sy_mid - sy0) * (tp * tp);  // ease-in: accelerating only
      shipX     = sx0;
      thrustFrac = tp;
    } else {
      // Terminal velocity = derivative of tp^2 at tp=1 × (sy_mid−sy0)/(THRUST_END−0.16)
      const velY = 2 * (sy_mid - sy0) / (THRUST_END - 0.16); // negative (upward)
      shipY = sy_mid + velY * (p - THRUST_END);
      shipX = sx0;
    }
  }

  // Thrust flame (only during thrust phase)
  if (thrustFrac > 0) {
    const inten = Math.min(thrustFrac * 2.0, 1);
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(sa + Math.PI);
    const len  = 28 * inten;
    const grad = ctx.createRadialGradient(6, 0, 0, 6, 0, len);
    grad.addColorStop(0,    'rgba(255,255,255,0.95)');
    grad.addColorStop(0.25, 'rgba(245,200,160,0.8)');
    grad.addColorStop(1,    'rgba(245,200,160,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(len * 0.4, 0, len * 0.6, 6 * inten, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Fade out as ship approaches and exits the top edge
  const shipAlpha = shipY < H * 0.12 ? Math.max(0, shipY / (H * 0.12)) : 1;
  if (shipAlpha > 0) _tutCreamBottle(shipX, shipY, sa, 0.6, shipAlpha);

  _tutLabel('SWIPE', 'Thrust');
  _tutNav(_tutCycles >= TUT_SHOW_PROMPT);
}

// ── Step 2: TWO-FINGER SWIPE — Hyperspace ────────────────────────────────────
function _tutStep2() {
  const p   = _tutT / TUT_STEP_DUR;
  const sx1 = W * 0.50, sy1 = H * 0.48;
  const sx2 = W * 0.28, sy2 = H * 0.30;

  const T = _tutT;

  // Fast background asteroids
  _tutRealAst(W*0.92 - T*W*0.23, H*0.16, 13, T*1.1,  0.40);
  _tutRealAst(W*0.08 + T*W*0.20, H*0.38, 10, -T*0.9, 0.36);
  _tutRealAst(W*0.50 - T*W*0.18, H*0.80, 14, T*0.8,  0.42);
  _tutRealAst(W*0.22 + T*W*0.25, H*0.22, 9,  -T*1.3, 0.34);
  _tutRealAst(W*0.82 - T*W*0.21, H*0.58, 12, T*1.0,  0.38);
  _tutRealAst(W*0.35 + T*W*0.17, H*0.88, 11, -T*0.7, 0.32);
  // Three ambient asteroids drifting
  _tutRealAst(W*0.18 + T*W*0.020, H*0.62 - T*H*0.008, 20, p*0.25, 0.42);
  _tutRealAst(W*0.76 - T*W*0.016, H*0.34 + T*H*0.010, 15, -p*0.35, 0.42);
  _tutRealAst(W*0.60 + T*W*0.012, H*0.72 - T*H*0.018, 11, p*0.50, 0.36);

  // Collision-course asteroid: starts at only 10% of its path (far away) and
  // arrives at the old ship position at p=0.60 — the ship is fully gone by p=0.40,
  // giving 0.8 s of clear empty space before the asteroid passes through.
  const collArrP  = 0.60;
  const collStart = 0.10;
  const collSpd   = (1.0 - collStart) / collArrP; // = 1.50
  const collFrac  = p <= collArrP
    ? collStart + p * collSpd
    : 1.0 + (p - collArrP) * collSpd;
  const collX = W*0.88 + (sx1 - W*0.88) * collFrac;
  const collY = H*0.10 + (sy1 - H*0.10) * collFrac;
  let collAlpha;
  if      (p < 0.25)      collAlpha = 1;
  else if (p < 0.40)      collAlpha = 0.75 + 0.25 * Math.sin(T * Math.PI * 8);
  else if (p < collArrP)  collAlpha = 1;
  else { const post = p - collArrP; collAlpha = post < 0.25 ? 1 : Math.max(0, 1 - (post - 0.25) / 0.08); }
  _tutRealAst(collX, collY, 26, T * 0.9, collAlpha);

  // Two-finger swipe left: wide trail + two-finger hand
  const swX0 = W * 0.64, swX1 = W * 0.30, swY = H * 0.60;
  let fp = 0, fa = 0;
  if (p > 0.06 && p < 0.60) {
    if      (p < 0.16) fa = (p - 0.06) / 0.10;
    else if (p < 0.46) { fa = 1; fp = (p - 0.16) / 0.30; }
    else               fa = 1 - (p - 0.46) / 0.14;

    const sp  = Math.min(fp, 1);
    const tipX = swX0 + (swX1 - swX0) * sp;
    // Wide trail suggesting two fingers
    ctx.save();
    const grad = ctx.createLinearGradient(swX0, swY, tipX, swY);
    grad.addColorStop(0, 'rgba(200,220,255,0)');
    grad.addColorStop(1, `rgba(200,220,255,${fa * 0.38})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 44;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(swX0, swY);
    ctx.lineTo(tipX, swY);
    ctx.stroke();
    ctx.restore();
    _tutHand(tipX, swY, -Math.PI / 2, true, fa * 0.86); // -PI/2 → fingers point LEFT
  }

  // Ship: visible → flicker (p=0.28) → fully gone (p=0.40) → reappear (p=0.62).
  // Asteroid arrives at old position at p=0.60 — ship has been gone for 0.8 s.
  let a1 = 1, a2 = 0;
  if      (p > 0.28 && p < 0.40) a1 = 0.5 + 0.5 * Math.sin((p - 0.28) / 0.12 * Math.PI * 10);
  else if (p > 0.40 && p < 0.62) a1 = 0;
  else if (p > 0.62 && p < 0.72) { a1 = 0; a2 = (p - 0.62) / 0.10; }
  else if (p >= 0.72)             { a1 = 0; a2 = 1; }

  if (a1 > 0) _tutCreamBottle(sx1, sy1, 0,   0.6, a1);
  if (a2 > 0) _tutCreamBottle(sx2, sy2, 0.4, 0.6, a2);

  // Vanish ring at old position
  if (p > 0.40 && p < 0.56) {
    const rp = (p - 0.40) / 0.16;
    ctx.save();
    ctx.globalAlpha = (1 - rp) * 0.80;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(sx1, sy1, Math.min(W, H) * 0.14 * rp, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Appear ring at new position
  if (p > 0.62 && p < 0.72) {
    const rp = (p - 0.62) / 0.10;
    ctx.save();
    ctx.globalAlpha = (1 - rp) * 0.60;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(sx2, sy2, Math.min(W, H) * 0.09 * rp, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _tutLabel('TWO-FINGER SWIPE', 'Hyperspace');
  _tutNav(_tutCycles >= TUT_SHOW_PROMPT);
}

function drawTutorial() {
  drawStarfield();
  if      (_tutStep === 0) _tutStep0();
  else if (_tutStep === 1) _tutStep1();
  else if (_tutStep === 2) _tutStep2();
}

// ── Capacitor: back button + background pause ─────────────────────────────────
(function initCapacitorListeners() {
  const plugins = window.Capacitor && window.Capacitor.Plugins;
  if (!plugins) return;

  const App = plugins.App;
  if (App) {
    // Hardware back button: pause when playing, exit when paused, else go to intro
    App.addListener('backButton', () => {
      if (state === STATE.PLAYING || state === STATE.LEVEL_UP) {
        state = STATE.PAUSED;
        Sound.stopBeat(); Sound.stopUFO(); Sound.stopThrust();
        leaveFullscreen();
      } else if (state === STATE.PAUSED) {
        App.exitApp();
      } else if (state === STATE.GAME_OVER) {
        state = STATE.INTRO;
      } else if (state === STATE.TUTORIAL) {
        safeLocalSet('tutorialSeen', '1');
        state = STATE.INTRO;
      } else if (state === STATE.INTRO) {
        App.exitApp();
      }
    });

    // App goes to background: pause game to stop audio and simulation
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && state === STATE.PLAYING) {
        state = STATE.PAUSED;
        Sound.stopBeat(); Sound.stopUFO(); Sound.stopThrust();
        leaveFullscreen();
      }
    });
  }
})();

// ── Browser (non-Capacitor) mobile back button → pause ────────────────────────
(function initBrowserBackButton() {
  if (window.Capacitor || !IS_MOBILE) return;
  window.addEventListener('popstate', () => {
    if (state === STATE.PLAYING || state === STATE.LEVEL_UP) {
      state = STATE.PAUSED;
      Sound.stopBeat(); Sound.stopUFO(); Sound.stopThrust();
      leaveFullscreen();
      history.pushState({ gameActive: true }, ''); // re-arm for next back press
    } else if (state === STATE.PAUSED) {
      state = STATE.INTRO;
      leaveFullscreen();
    }
  });
})();

// ── Main loop ─────────────────────────────────────────────────────────────────
function loop(timestamp) {
  requestAnimationFrame(loop);
  const dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  blinkTimer += dt;
  if (blinkTimer >= 0.5) { blinkTimer = 0; blinkOn = !blinkOn; }

  const playing = state === STATE.PLAYING || state === STATE.LEVEL_UP;
  document.body.classList.toggle('is-playing', playing);

  // 30% slower simulation on mobile
  const gameDt = IS_MOBILE ? dt * 0.7 : dt;

  if      (state === STATE.TUTORIAL)  { updateTutorial(dt); drawTutorial(); }
  else if (state === STATE.INTRO)     { drawIntro(); }
  else if (state === STATE.PLAYING)   { update(gameDt); drawScene(); }
  else if (state === STATE.PAUSED)    { drawScene(); drawPause(); }
  else if (state === STATE.LEVEL_UP)  { updateLevelUp(gameDt); drawScene(); drawLevelUp(); }
  else if (state === STATE.GAME_OVER) {
    // C-2: auto-return to INTRO is now a dt-timer (was nested setTimeout)
    if (_gameOverAutoReturnTimer > 0) {
      _gameOverAutoReturnTimer -= dt;
      if (_gameOverAutoReturnTimer <= 0) { _gameOverAutoReturnTimer = 0; state = STATE.INTRO; }
    }
    drawScene(); drawGameOver();
  }
}

// Desktop click-to-start (mobile uses touchstart above)
canvas.addEventListener('click', () => {
  Sound.unlock();
  if (!IS_MOBILE && state === STATE.INTRO) startGame();
});

if (!IS_MOBILE) DesktopInput.init(keys, handleHyperspace, canvas);

requestAnimationFrame(loop);
