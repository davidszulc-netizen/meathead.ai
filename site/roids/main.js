'use strict';

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
window.addEventListener('resize', resize);
resize();

// ── Mobile detection ──────────────────────────────────────────────────────────
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|tablet/i.test(navigator.userAgent)
      || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
}
const IS_MOBILE = isMobile();

// ── State machine ─────────────────────────────────────────────────────────────
const STATE = { INTRO:'INTRO', PLAYING:'PLAYING', PAUSED:'PAUSED',
                LEVEL_UP:'LEVEL_UP', GAME_OVER:'GAME_OVER', AD:'AD',
                SPONSOR_THANKS:'SPONSOR_THANKS' };
let state = STATE.INTRO;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = { left:false, right:false, up:false, down:false, space:false };
const keyMap = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up',
                 ArrowDown:'down', ' ':'space' };

window.addEventListener('keydown', e => {
  if (keyMap[e.key] !== undefined) { e.preventDefault(); keys[keyMap[e.key]] = true; }
  if (e.key === 'Escape')    handleEsc();
  if (e.key === 'ArrowDown' && state === STATE.PLAYING) { keys.down = false; handleHyperspace(); }
});

window.addEventListener('keyup', e => {
  if (keyMap[e.key] !== undefined) keys[keyMap[e.key]] = false;
  if (e.key === 'ArrowUp') Sound.stopThrust();
});

// ── Mobile: touch-to-start (gameplay touches handled by MobileInput) ─────────
if (IS_MOBILE) {
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    Sound.unlock();
    if (state === STATE.INTRO) {
      initMobileAndStart();
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
let sponsorThanksTimer = 0;
let ship = null, asteroids = [], bullets = [], ufo = null;
let particles = new ParticleSystem();
let ufoTimer = 0;
const UFO_INTERVAL   = 20;
const FIRE_INTERVAL  = 0.2;
const LEVEL_UP_DELAY = 2.5;
let fireTimer = 0, levelUpTimer = 0;
let thrustWasOn = false;
let blinkTimer = 0, blinkOn = true;

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  doubleLifeMode = localStorage.getItem('doubleLifeNextGame') === '1';
  if (doubleLifeMode) localStorage.removeItem('doubleLifeNextGame');
  score = 0; lives = doubleLifeMode ? 6 : 3; level = 1; extraLifeAt = 10000;
  ship = new Ship(W / 2, H / 2);
  ship.invincible = INVINCIBILITY_DURATION;
  particles.clear();
  if (IS_MOBILE) MobileInput.calibrate();
  spawnLevel();
  state = STATE.PLAYING;
  enterFullscreen();
}

function initMobileAndStart() {
  if (state !== STATE.INTRO) return;
  MobileInput.init(keys, handleHyperspace);
  startGame();
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
  particles.explode(ship.x, ship.y, 40, 60, 250, 1.5, '#f5c8a0');
  ship.alive = false;
  lives--;
  if (lives <= 0) {
    setTimeout(() => {
      if (score > hiScore) hiScore = score;
      Sound.stopBeat(); Sound.stopUFO();
      leaveFullscreen();
      state = STATE.GAME_OVER;
      setTimeout(() => {
        if (Math.random() < 0.33) {
          state = STATE.AD;
          showAd((wasClicked) => {
            if (wasClicked) {
              localStorage.setItem('doubleLifeNextGame', '1');
              sponsorThanksTimer = 3.5;
              state = STATE.SPONSOR_THANKS;
            } else {
              state = STATE.INTRO;
            }
          });
        } else {
          state = STATE.INTRO;
        }
      }, 2000);
    }, 1500);
  } else {
    setTimeout(respawnShip, 2000);
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
        particles.explode(a.x, a.y, a.size === 'large' ? 20 : a.size === 'medium' ? 12 : 7, 40, 160, 0.7, '#f5c8a0');
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
        particles.explode(ufo.x, ufo.y, 16, 50, 200, 0.8, '#c8f0c8');
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
}

function updateLevelUp(dt) {
  particles.update(dt);
  levelUpTimer -= dt;
  if (levelUpTimer <= 0) {
    level++;
    spawnLevel();
    if (!ship || !ship.alive) ship = new Ship(W / 2, H / 2);
    ship.invincible = INVINCIBILITY_DURATION;
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
    ctx.fillText('roids', -1, 0);

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
  const cx = W * 0.62;
  const cy = H * 0.54;
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

  ctx.font = 'bold 52px "Courier New", monospace';
  ctx.fillText('ROIDS', W / 2, py + 68);

  ctx.font = '16px "Courier New", monospace';
  ctx.fillStyle = '#f5c8a0';
  ctx.fillText('Maximum Relief Edition', W / 2, py + 92);

  ctx.font = '15px "Courier New", monospace';
  ctx.fillStyle = '#aaa';
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
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    ctx.fillText(line, px + 24, py + 110 + i * 28);
  });
  ctx.textAlign = 'center';

  if (IS_MOBILE && blinkOn) {
    ctx.fillStyle = '#fff';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('— TAP TO START —', W / 2, py + panelH - 36);
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
  ctx.fillText('ESC to resume', W / 2, H / 2 + 56);
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

function drawSponsorThanks() {
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5c8a0';
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.fillText('THANK YOU FOR VISITING', W / 2, H / 2 - 60);
  ctx.fillText('OUR SPONSOR!', W / 2, H / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText('\u2605 DOUBLE LIFE MODE ENABLED \u2605', W / 2, H / 2 + 40);
  ctx.fillStyle = '#aaa';
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText('Your next game starts with 6 lives', W / 2, H / 2 + 76);
  ctx.textAlign = 'left';
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function loop(timestamp) {
  requestAnimationFrame(loop);
  const dt = lastTime === null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  blinkTimer += dt;
  if (blinkTimer >= 0.5) { blinkTimer = 0; blinkOn = !blinkOn; }

  // 30% slower simulation on mobile
  const gameDt = IS_MOBILE ? dt * 0.7 : dt;

  if      (state === STATE.INTRO)     { drawIntro(); }
  else if (state === STATE.PLAYING)   { update(gameDt); drawScene(); }
  else if (state === STATE.PAUSED)    { drawScene(); drawPause(); }
  else if (state === STATE.LEVEL_UP)  { updateLevelUp(gameDt); drawScene(); drawLevelUp(); }
  else if (state === STATE.GAME_OVER) { drawScene(); drawGameOver(); }
  else if (state === STATE.SPONSOR_THANKS) {
    sponsorThanksTimer -= dt;
    drawSponsorThanks();
    if (sponsorThanksTimer <= 0) state = STATE.INTRO;
  }
  // STATE.AD: HTML overlay handles rendering
}

// Desktop click-to-start (mobile uses touchstart above)
canvas.addEventListener('click', () => {
  Sound.unlock();
  if (!IS_MOBILE && state === STATE.INTRO) startGame();
});

if (!IS_MOBILE) DesktopInput.init(keys, handleHyperspace, canvas);

requestAnimationFrame(loop);
