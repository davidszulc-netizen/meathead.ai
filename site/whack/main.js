// ---- State constants ----
const GS = { INTRO: 0, PLAYING: 1, GAME_OVER: 2, AD: 3, LEVEL_INTRO: 4, PAUSED: 5 };
const GAME_DURATION = 60000; // ms

// Pentagon center (shared by world map, trump, and hole layout)
const PENTAGON_CY_FRAC = 0.56;

// ---- Hole positions (pentagon) ----
function computeHoles(w, h) {
  const cx = w / 2;
  const cy = h * PENTAGON_CY_FRAC;
  const r  = Math.min(w, h) * 0.28;
  // Six holes in a hexagon — one per world leader
  return Array.from({ length: 6 }, (_, i) => ({
    x: cx + r * Math.cos(-Math.PI / 2 + i * (Math.PI / 3)),
    y: cy + r * Math.sin(-Math.PI / 2 + i * (Math.PI / 3)),
    charIndex: i,
  }));
}

// ---- World Map ----
// Continent data: arrays of [longitude, latitude] pairs (improved detail)
const CONTINENTS = {
  northAmerica: [
    [-168,72],[-155,72],[-140,70],[-120,68],[-100,72],[-85,67],[-82,62],
    [-72,47],[-65,47],[-52,47],[-67,45],[-70,43],[-74,40],[-79,34],
    [-80,26],[-83,22],[-87,15],[-77,8],[-79,9],[-83,10],[-87,14],
    [-90,16],[-96,20],[-105,22],[-110,24],[-117,32],[-120,34],
    [-122,37],[-124,42],[-124,49],[-130,54],[-138,59],[-150,60],
    [-153,60],[-158,56],[-163,55],[-166,60],[-168,66],[-168,72]
  ],
  greenland: [
    [-46,60],[-28,60],[-18,62],[-16,70],[-22,76],[-38,83],
    [-56,83],[-64,78],[-62,70],[-52,65],[-46,60]
  ],
  southAmerica: [
    [-77,8],[-75,10],[-68,11],[-63,10],[-60,8],[-55,5],[-50,5],
    [-44,2],[-35,-5],[-36,-8],[-35,-12],[-38,-14],[-40,-18],
    [-42,-22],[-43,-23],[-46,-24],[-48,-28],[-50,-30],[-52,-33],
    [-55,-36],[-58,-38],[-60,-42],[-63,-46],[-65,-55],[-68,-55],
    [-66,-47],[-65,-43],[-63,-40],[-60,-36],[-58,-28],
    [-55,-12],[-52,-5],[-52,2],[-55,5],[-60,8]
  ],
  europe: [
    [-10,36],[-8,38],[-8,44],[-2,44],[0,43],[3,43],[5,36],
    [10,37],[15,38],[18,40],[16,38],[12,38],[15,37],
    [20,38],[22,37],[25,37],[28,42],[30,46],[27,55],
    [25,58],[28,64],[26,70],[22,71],[16,70],[15,70],
    [12,64],[8,58],[5,58],[2,52],[0,50],[-3,50],
    [-5,48],[-5,44],[-10,36]
  ],
  africa: [
    [-17,16],[-15,10],[-12,5],[-8,5],[-5,5],[0,5],[5,5],[9,4],
    [10,1],[8,-2],[10,-5],[13,-5],[15,-8],[18,-18],[22,-30],
    [26,-35],[30,-32],[34,-26],[36,-20],[40,-14],[44,-12],
    [48,-10],[50,-10],[44,8],[45,12],[43,14],[50,12],[50,14],
    [43,12],[40,16],[38,18],[37,22],[38,28],[32,32],
    [25,37],[10,37],[-5,36],[-17,16]
  ],
  asia: [
    [28,70],[30,55],[30,46],[37,37],[40,36],[42,37],[48,30],
    [52,25],[57,23],[60,20],[65,22],[62,25],[68,24],[68,28],
    [72,24],[73,22],[73,18],[75,14],[77,10],[78,8],
    [80,9],[80,10],[82,12],[84,14],[86,18],[88,22],
    [92,20],[96,18],[100,14],[104,10],[108,14],
    [110,18],[114,20],[117,22],[120,22],
    [122,27],[125,32],[128,36],[130,33],[135,34],
    [140,36],[141,38],[142,44],[140,47],
    [135,56],[126,53],[115,53],[105,52],[100,55],
    [95,56],[85,60],[80,72],[60,73],[28,72]
  ],
  india: [
    [68,24],[62,25],[60,20],[57,23],[58,22],[60,22],[65,22],
    [68,24],[68,28],[72,24],[73,22],[73,18],[75,14],[77,10],
    [78,8],[80,9],[80,10],[82,12],[84,14],[86,18],[88,22],[88,24],[85,24],[80,26],[76,28],[72,28],[68,28]
  ],
  seAsia: [
    [100,14],[104,10],[108,14],[110,18],[114,20],[117,22],[120,22],
    [116,4],[112,2],[108,2],[104,4],[102,6],[100,4],[100,8],[98,10],[100,14]
  ],
  japan: [
    [130,31],[131,33],[133,34],[136,36],[140,38],[141,41],
    [140,43],[141,45],[143,44],[141,38],[136,35],[132,32],[130,31]
  ],
  australia: [
    [114,-22],[118,-20],[122,-18],[128,-14],[130,-12],[136,-12],
    [137,-12],[140,-18],[144,-18],[148,-20],[152,-24],
    [154,-27],[152,-32],[151,-36],[147,-38],[145,-39],
    [138,-36],[130,-33],[118,-34],[115,-35],[114,-29],[114,-22]
  ],
  newZealand: [
    [172,-34],[174,-36],[175,-38],[174,-42],[172,-44],[170,-42],[172,-34]
  ],
  alaska: [
    [-168,55],[-160,55],[-155,57],[-150,58],[-140,58],[-135,58],
    [-132,56],[-136,57],[-140,58],[-148,60],[-155,60],
    [-160,63],[-168,65],[-168,55]
  ],
};

// Country highlights: home nations of the 5 mole characters
const COUNTRY_HIGHLIGHTS = [
  // Khomeini — Iran
  { pts: [[44,37],[46,39],[50,39],[55,38],[60,37],[63,36],[63,28],[58,25],[52,25],[46,28],[44,37]],
    color: 'rgba(160,30,220,0.38)', border: 'rgba(220,120,255,0.65)' },
  // Putin — Russia (simplified western + Siberia main body)
  { pts: [[28,68],[40,72],[60,73],[100,72],[140,72],[168,64],[168,52],[140,48],[120,44],[105,45],[80,50],[55,55],[40,55],[28,60],[28,68]],
    color: 'rgba(30,60,200,0.32)', border: 'rgba(80,140,255,0.60)' },
  // Castro — Cuba
  { pts: [[-84,22],[-82,23],[-79,23],[-75,22],[-74,20],[-76,19],[-80,19],[-83,20],[-84,22]],
    color: 'rgba(30,160,30,0.45)', border: 'rgba(80,255,80,0.70)' },
  // Maduro — Venezuela
  { pts: [[-73,11],[-70,12],[-65,11],[-62,10],[-60,9],[-60,5],[-62,4],[-63,2],[-67,1],[-71,4],[-73,7],[-73,11]],
    color: 'rgba(210,170,0,0.42)', border: 'rgba(255,220,50,0.70)' },
  // Xi — China
  { pts: [[73,40],[80,48],[90,50],[100,52],[110,52],[120,50],[128,48],[131,44],[122,32],[120,22],[110,18],[104,10],[100,14],[96,18],[92,20],[88,24],[82,28],[78,34],[73,40]],
    color: 'rgba(210,20,20,0.35)', border: 'rgba(255,80,80,0.62)' },
  // Kim Jong Un — North Korea
  { pts: [[124,38],[126,43],[128,42],[130,40],[130,37],[128,36],[126,37],[124,38]],
    color: 'rgba(180,30,30,0.48)', border: 'rgba(255,90,90,0.75)' },
];

function drawWorldMap(ctx, cx, cy, mapR, rotDeg, cloudDeg) {
  const now = Date.now();

  // Helper: lon/lat → canvas xy with rotation offset + optional extra wrap
  function ll(lon, lat, extraWrap) {
    return [
      cx + ((lon + rotDeg + (extraWrap || 0)) / 180) * mapR,
      cy - (lat / 90) * mapR * 0.76,
    ];
  }
  function llCloud(lon, lat, extraWrap) {
    return [
      cx + ((lon + cloudDeg + (extraWrap || 0)) / 180) * mapR,
      cy - (lat / 90) * mapR * 0.76,
    ];
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, mapR, 0, Math.PI * 2);
  ctx.clip();

  // ── 7. Ocean with shimmer ────────────────────────────────────────────────
  const shimmer = Math.sin(now * 0.0007) * 0.035;
  const ocean = ctx.createRadialGradient(cx - mapR*0.28, cy - mapR*0.22, mapR*0.05, cx, cy, mapR*1.05);
  ocean.addColorStop(0,   `rgb(${Math.round(88+shimmer*55)},${Math.round(188+shimmer*30)},${Math.round(235+shimmer*15)})`);
  ocean.addColorStop(0.35, '#1a72c0');
  ocean.addColorStop(0.75, '#0a4a84');
  ocean.addColorStop(1,    '#051830');
  ctx.fillStyle = ocean;
  ctx.fillRect(cx - mapR, cy - mapR, mapR * 2, mapR * 2);

  // ── Grid (lat lines fixed, lon lines rotate) ─────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, gy] = ll(0, lat);
    ctx.beginPath(); ctx.moveTo(cx - mapR, gy); ctx.lineTo(cx + mapR, gy); ctx.stroke();
  }
  for (let lon = -180; lon < 180; lon += 30) {
    for (const w of [0, -360, 360]) {
      const gx = cx + ((lon + rotDeg + w) / 180) * mapR;
      if (gx < cx - mapR || gx > cx + mapR) continue;
      ctx.beginPath(); ctx.moveTo(gx, cy - mapR); ctx.lineTo(gx, cy + mapR); ctx.stroke();
    }
  }
  // Equator
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  const [, eqY] = ll(0, 0);
  ctx.beginPath(); ctx.moveTo(cx - mapR, eqY); ctx.lineTo(cx + mapR, eqY); ctx.stroke();

  // ── Draw polygon with rotation wrapping ──────────────────────────────────
  function drawPoly(points, fill, stroke, lw) {
    for (const w of [0, -360, 360]) {
      ctx.fillStyle   = fill;
      ctx.strokeStyle = stroke || 'rgba(0,0,0,0.25)';
      ctx.lineWidth   = lw || 1.2;
      ctx.beginPath();
      points.forEach(([lon, lat], i) => {
        const x = cx + ((lon + rotDeg + w) / 180) * mapR;
        const y = cy - (lat / 90) * mapR * 0.76;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // ── ⑧ More detailed continents ───────────────────────────────────────────
  const landBase  = '#4aaa42';
  const landDark  = '#3a8a34';
  const landLight = '#5ec255';
  const iceColor  = '#d8eef8';

  drawPoly(CONTINENTS.southAmerica, landBase);
  drawPoly(CONTINENTS.northAmerica, landDark);
  drawPoly(CONTINENTS.alaska,       landDark);
  drawPoly(CONTINENTS.greenland,    iceColor, 'rgba(100,160,220,0.4)');
  drawPoly(CONTINENTS.europe,       landLight);
  drawPoly(CONTINENTS.africa,       '#6abf44');
  drawPoly(CONTINENTS.asia,         landDark);
  drawPoly(CONTINENTS.india,        '#4aaa42');
  drawPoly(CONTINENTS.seAsia,       '#3a8a34');
  drawPoly(CONTINENTS.japan,        landBase);
  drawPoly(CONTINENTS.australia,    '#d4a844');
  drawPoly(CONTINENTS.newZealand,   '#d4a844');

  // ── ② Country highlights ─────────────────────────────────────────────────
  for (const ch of COUNTRY_HIGHLIGHTS) {
    drawPoly(ch.pts, ch.color, ch.border, 1.8);
  }

  // ── Ice caps ─────────────────────────────────────────────────────────────
  ctx.fillStyle = iceColor;
  ctx.fillRect(cx - mapR, cy - mapR,      mapR * 2, mapR * 0.12);
  ctx.fillRect(cx - mapR, cy + mapR*0.84, mapR * 2, mapR * 0.16);

  // ── ⑤ Animated cloud wisps ───────────────────────────────────────────────
  const cloudSeeds = [
    [  20, 12, 0.09], [ -35, 28, 0.07], [  85, -8, 0.10],
    [ 148, 18, 0.08], [ -82,-22, 0.06], [ 195,  6, 0.09],
    [-155, 32, 0.07], [ 108, 36, 0.08], [  42,-38, 0.07],
  ];
  ctx.save();
  for (const [clon, clat, cScale] of cloudSeeds) {
    for (const w of [0, -360, 360]) {
      const [cx2, cy2] = llCloud(clon + w, clat);
      const inRange = cx2 > cx - mapR && cx2 < cx + mapR &&
                      cy2 > cy - mapR && cy2 < cy + mapR;
      if (!inRange) continue;
      const cr = mapR * cScale;
      const cg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, cr);
      cg.addColorStop(0,   'rgba(255,255,255,0.52)');
      cg.addColorStop(0.5, 'rgba(255,255,255,0.18)');
      cg.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, cr * 1.9, cr * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ── ④ Specular hot-spot (sharp elliptical highlight) ─────────────────────
  const specX = cx - mapR * 0.40, specY = cy - mapR * 0.36;
  const spec = ctx.createRadialGradient(specX, specY, 0, specX, specY, mapR * 0.52);
  spec.addColorStop(0,    'rgba(255,255,255,0.48)');
  spec.addColorStop(0.35, 'rgba(255,255,255,0.14)');
  spec.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.save();
  ctx.scale(1, 0.62);
  ctx.translate(0, cy / 0.62 * (1 - 0.62));
  ctx.fillStyle = spec;
  ctx.fillRect(cx - mapR, (cy - mapR) / 0.62, mapR * 2, mapR * 2 / 0.62);
  ctx.restore();

  // ── ⑥ Day / night terminator ─────────────────────────────────────────────
  const termX = cx + mapR * 0.30;
  const term = ctx.createRadialGradient(termX, cy, mapR * 0.05, termX + mapR * 0.15, cy, mapR * 1.10);
  term.addColorStop(0,   'rgba(0,0,0,0)');
  term.addColorStop(0.55,'rgba(0,0,15,0.18)');
  term.addColorStop(1,   'rgba(0,0,25,0.58)');
  ctx.fillStyle = term;
  ctx.fillRect(cx - mapR, cy - mapR, mapR * 2, mapR * 2);

  // Residual soft sheen (reduced, spec now does most of the work)
  const sheen = ctx.createRadialGradient(cx - mapR*0.38, cy - mapR*0.32, 0, cx, cy, mapR);
  sheen.addColorStop(0,    'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.50, 'rgba(255,255,255,0.01)');
  sheen.addColorStop(1,    'rgba(0,10,40,0.28)');
  ctx.fillStyle = sheen;
  ctx.fillRect(cx - mapR, cy - mapR, mapR * 2, mapR * 2);

  ctx.restore();

  // ── ③ Atmosphere glow (outside clip region) ───────────────────────────────
  ctx.save();
  const atmo = ctx.createRadialGradient(cx, cy, mapR * 0.94, cx, cy, mapR * 1.22);
  atmo.addColorStop(0,   'rgba(70,150,255,0.38)');
  atmo.addColorStop(0.45,'rgba(50,110,220,0.14)');
  atmo.addColorStop(1,   'rgba(20,55,180,0)');
  ctx.fillStyle = atmo;
  ctx.beginPath();
  ctx.arc(cx, cy, mapR * 1.22, 0, Math.PI * 2);
  ctx.fill();

  // Border ring
  ctx.beginPath();
  ctx.arc(cx, cy, mapR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.58)';
  ctx.lineWidth   = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, mapR - 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100,180,255,0.32)';
  ctx.lineWidth   = 3;
  ctx.stroke();
  ctx.restore();
}

// ---- Globals ----
let canvas, ctx;
let state = GS.INTRO;
let score = 0;
let timeLeft = GAME_DURATION;
let moles = [];
let trump;
let holes = [];
let lastTime = null;
let nextPopDelay = 2000;
let popCountdown = 2000;
let gameOverTimer = 0;
let shakeAmount = 0;
let shakeDuration = 0;

// Globe rotation (degrees)
let globeRotDeg  = 0;
let globeCloudDeg = 0;

// Parallax clouds
const CLOUD_DEFS = [
  { x: 0.08, speed: 0.000028, w: 0.18, h: 0.055 },
  { x: 0.38, speed: 0.000048, w: 0.13, h: 0.045 },
  { x: 0.62, speed: 0.000030, w: 0.20, h: 0.060 },
  { x: 0.85, speed: 0.000050, w: 0.14, h: 0.040 },
];
const clouds = CLOUD_DEFS.map(d => ({ ...d }));

// Score popups
let scorePopups = [];

// Screen flash on hit
let flashAlpha = 0;

// Combo scale pulse

// Level state
let currentLevel = 1;
let icbms        = [];
let cruises      = [];
let icbmSpawnTimer   = 0;
let cruiseSpawnTimer = 0;
let prepauseState    = GS.PLAYING;

// Persistent high score
let highScore = parseInt(localStorage.getItem('wwwamHighScore') || '0', 10);

// ---- Init ----
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    handleHit((e.clientX - r.left) * sx, (e.clientY - r.top) * sy);
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    const t = e.changedTouches[0];
    handleHit((t.clientX - r.left) * sx, (t.clientY - r.top) * sy);
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state === GS.PLAYING) {
        prepauseState = state;
        state = GS.PAUSED;
        Sound.stopMusic();
      } else if (state === GS.PAUSED) {
        state = prepauseState;
        Sound.startMusic(currentLevel);
      }
    }
  });

  requestAnimationFrame(loop);
});

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  rebuildLayout();
}

function rebuildLayout() {
  const w = canvas.width, h = canvas.height;
  holes = computeHoles(w, h);
  moles = holes.map((ho) => new Mole(ho.x, ho.y, ho.charIndex));
  if (!trump) {
    trump = new Trump();
    trump.onImpact = () => { shakeAmount = 5; shakeDuration = 150; };
  }
  // Trump's scale matches world-leader head size: headR = 26*scale ≈ min(w,h)*0.075*0.82
  const trumpScale = Math.min(w, h) * 0.0023;
  trump.resize(w / 2, h * PENTAGON_CY_FRAC - Math.min(w, h) * 0.06, Math.max(0.75, trumpScale));
}

// ---- Game loop ----
function loop(ts) {
  requestAnimationFrame(loop);
  if (lastTime === null) { lastTime = ts; return; }
  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;
  update(dt);
  drawScene();
}

function update(dt) {
  if (state === GS.PAUSED) return;
  if (trump) trump.update(dt);
  if (shakeDuration > 0) {
    shakeDuration -= dt;
    if (shakeDuration <= 0) { shakeDuration = 0; shakeAmount = 0; }
  }

  // Globe rotation
  globeRotDeg   += dt * 0.003;  // ~3 deg/s → full rotation ≈ 2 min
  globeCloudDeg += dt * 0.005;  // clouds drift ~1.7× faster

  // Sky clouds drift right, wrap around
  for (const c of clouds) {
    c.x += c.speed * dt;
    if (c.x > 1.25) c.x = -c.w;
  }

  // Score popup physics
  const dtS = dt / 1000;
  for (const p of scorePopups) {
    p.life -= dtS * 1.6;
    p.y    -= dt * 0.055;
  }
  scorePopups = scorePopups.filter(p => p.life > 0);

  // Screen flash decay
  flashAlpha = Math.max(0, flashAlpha - dt * 0.004);

if (state === GS.PLAYING) {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; endGame(); return; }

    if (currentLevel === 1) {
      // ── Level 1: mole whacking ─────────────────────────────────────────────
      _updateMoles(dt);
      _runMoleScheduler(dt);

    } else if (currentLevel === 2) {
      // ── Level 2: ICBM intercept ────────────────────────────────────────────
      _updateICBMs(dt);
      _runICBMScheduler(dt);

    } else {
      // ── Level 3+: combined — moles + ICBMs + cruise missiles ─────────────
      // Each level beyond 3 ICBMs move 5% faster and moles are visible 5% shorter
      _updateMoles(dt);
      _runMoleScheduler(dt);
      _updateICBMs(dt);
      _runICBMScheduler(dt);
      _updateCruises(dt);
      _runCruiseScheduler(dt);
    }

  } else if (state === GS.GAME_OVER) {
    gameOverTimer -= dt;
    if (gameOverTimer <= 0) {
      state = GS.AD;
      if (Math.random() < 0.5) {
        Ads.show(() => { prepareNextLevel(); }, 'Next Level \u25B6');
      } else {
        prepareNextLevel();
      }
    }
  } else {
    // INTRO / LEVEL_INTRO — keep moles bobbing in background
    for (const m of moles) m.update(dt);
  }
}

// ── Mole update helpers ──────────────────────────────────────────────────────
function _updateMoles(dt) {
  for (const m of moles) {
    const wasUp = m.state === 1 || m.state === 2;
    m.update(dt);
    if (wasUp && m.state === 0 && m.escaped) {
      Sound.escape();
    }
  }
}

function _runMoleScheduler(dt) {
  const elapsed      = GAME_DURATION - timeLeft;
  const t01          = Math.min(elapsed / GAME_DURATION, 1);
  nextPopDelay       = 2000 - t01 * 1300;
  // Each level beyond 3 reduces visible time by 5% (compounding)
  const visibleMult  = Math.pow(0.95, Math.max(0, currentLevel - 3));
  const visibleMs    = (2500 - t01 * 1300) * visibleMult;
  const maxSimul     = elapsed > 40000 ? 3 : 2;
  popCountdown   -= dt;
  if (popCountdown <= 0) {
    popCountdown = nextPopDelay;
    const downMoles = moles.filter(m => m.isDown());
    const active    = moles.filter(m => !m.isDown()).length;
    if (downMoles.length > 0 && active < maxSimul) {
      downMoles[Math.floor(Math.random() * downMoles.length)].popUp(visibleMs);
    }
  }
}

// ── ICBM update helpers ──────────────────────────────────────────────────────
function _updateICBMs(dt) {
  for (const b of icbms) {
    const wasFlying = b.state === 'flying';
    b.update(dt);
    if (wasFlying && b.escaped) { Sound.escape(); }
  }
  icbms = icbms.filter(b => !b.isDone());
}

function _runICBMScheduler(dt) {
  const elapsed   = GAME_DURATION - timeLeft;
  const t2        = Math.min(elapsed / GAME_DURATION, 1);
  const spawnDelay = 2000 - t2 * 1300;
  const maxICBMs   = elapsed > 40000 ? 4 : 3;
  icbmSpawnTimer -= dt;
  if (icbmSpawnTimer <= 0) {
    icbmSpawnTimer = spawnDelay;
    if (icbms.filter(b => b.state === 'flying').length < maxICBMs) {
      const hole      = holes[Math.floor(Math.random() * holes.length)];
      // Each level beyond 3 ICBMs move 5% faster (compounding)
      const speedMult = Math.pow(1.05, Math.max(0, currentLevel - 3));
      icbms.push(new ICBM(hole.x, hole.y, canvas.width, canvas.height,
        trump ? trump.x : undefined, trump ? trump.y : undefined, speedMult));
    }
  }
}

// ── Cruise missile update helpers ────────────────────────────────────────────
function _updateCruises(dt) {
  for (const cm of cruises) {
    const wasFlying = cm.state === 'flying';
    cm.update(dt);
    if (wasFlying && cm.didHitTrump()) {
      // 20% score penalty
      score = Math.max(0, Math.round(score * 0.80));
      flashAlpha = 0.35;  // red-tinted flash handled in drawScene
      Sound.ouch();
    }
  }
  cruises = cruises.filter(cm => !cm.isDone());
}

function _runCruiseScheduler(dt) {
  const elapsed     = GAME_DURATION - timeLeft;
  const t3          = Math.min(elapsed / GAME_DURATION, 1);
  const spawnDelay  = 8000 - t3 * 4000;  // 8s → 4s
  cruiseSpawnTimer -= dt;
  if (cruiseSpawnTimer <= 0) {
    cruiseSpawnTimer = spawnDelay + (Math.random() - 0.5) * 1500;
    if (trump) {
      cruises.push(new CruiseMissile(
        trump.x, trump.y, canvas.width, canvas.height
      ));
    }
  }
}

function endGame() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('wwwamHighScore', String(highScore));
  }
  state = GS.GAME_OVER;
  gameOverTimer = 2000;
  trump.grinning = true;
  Sound.stopMusic();
  Sound.gameOver();
}

function prepareNextLevel() {
  currentLevel++; // Increments forever; levels ≥ 3 all use level-3 mechanics with scaling
  timeLeft         = GAME_DURATION;
  popCountdown     = 2000;
  icbms            = [];
  cruises          = [];
  icbmSpawnTimer   = 1500;
  cruiseSpawnTimer = 8000;
  for (const m of moles) { m.state = 0; m.progress = 0; m.escaped = false; }
  trump.grinning = false;
  // MAGA hat: 33% chance on levels above 3
  trump.wearingHat = currentLevel > 3 && Math.random() < 0.33;
  state = GS.LEVEL_INTRO;
}

function resetGame() {
  score        = 0;
  scorePopups  = [];
  flashAlpha   = 0;
  timeLeft     = GAME_DURATION;
  popCountdown = 2000;
  currentLevel = 1;
  icbms        = [];
  cruises      = [];
  icbmSpawnTimer   = 0;
  cruiseSpawnTimer = 0;
  for (const m of moles) { m.state = 0; m.progress = 0; m.escaped = false; }
  trump.grinning = false;
  trump.wearingHat = false;
  state = GS.INTRO;
}

// ---- Input ----
function handleHit(cx, cy) {
  if (state === GS.INTRO) {
    state = GS.PLAYING;
    Sound.startMusic(1);
    return;
  }
  if (state === GS.LEVEL_INTRO) {
    state = GS.PLAYING;
    Sound.startMusic(currentLevel);
    return;
  }
  if (state !== GS.PLAYING) return;

  let hitSomething = false;

  // ── Check cruise missiles first (level 3+) ────────────────────────────────
  const levelBonus = (currentLevel - 1) * 5;
  if (currentLevel >= 3) {
    for (const cm of cruises) {
      if (cm.state !== 'flying') continue;
      const dx = cx - cm.x; const dy = cy - cm.y;
      if (Math.sqrt(dx*dx + dy*dy) < cm.hitR) {
        if (cm.hit()) {
          const pts = 15 + levelBonus;
          score += pts;
          scorePopups.push({ x: cm.x, y: cm.y - 20, pts, life: 1.0 });
          flashAlpha = 0.18;
          if (trump) trump.swing(cm.x, cm.y);
          Sound.whack();
          hitSomething = true;
          break;
        }
      }
    }
  }

  // ── Check ICBMs (levels 2+) ───────────────────────────────────────────────
  if (!hitSomething && currentLevel >= 2) {
    for (const b of icbms) {
      if (b.state !== 'flying') continue;
      const dx = cx - b.x; const dy = cy - b.y;
      if (Math.sqrt(dx*dx + dy*dy) < b.hitR) {
        if (b.hit()) {
          const pts = 20 + levelBonus;
          score += pts;
          scorePopups.push({ x: b.x, y: b.y - 20, pts, life: 1.0 });
          flashAlpha = 0.18;
          if (trump) trump.swing(b.x, b.y);
          Sound.whack();
          hitSomething = true;
          break;
        }
      }
    }
  }

  // ── Check moles (levels 1 & 3+) ──────────────────────────────────────────
  if (!hitSomething && (currentLevel === 1 || currentLevel >= 3)) {
    const holeRx = Math.min(canvas.width, canvas.height) * 0.075;
    const headR  = holeRx * 0.82;
    for (const m of moles) {
      if (m.state === 1 || m.state === 2) {
        const headY = m.y - m.progress * headR * 1.85;
        const dx = cx - m.x; const dy = cy - headY;
        if (Math.sqrt(dx*dx + dy*dy) < headR) {
          if (m.hit()) {
            const pts = 10 + levelBonus;
            score += pts;
            scorePopups.push({ x: m.x, y: m.y - 20, pts, life: 1.0 });
            flashAlpha = 0.18;
            if (trump) trump.swing(m.x, m.y);
            Sound.whack();
            hitSomething = true;
            break;
          }
        }
      }
    }
  }

  if (!hitSomething) Sound.miss();
}

// ---- Drawing ----
function drawScene() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Screen shake
  const shaking = shakeAmount > 0 && shakeDuration > 0;
  if (shaking) {
    const decay = shakeAmount * (shakeDuration / 260);
    ctx.save();
    ctx.translate((Math.random()*2-1)*decay, (Math.random()*2-1)*decay);
  }

  // Sky / ground background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0,    '#5ba8d4');
  bg.addColorStop(0.42, '#87CEEB');
  bg.addColorStop(0.52, '#4a8c2a');
  bg.addColorStop(1,    '#2d5a1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Ground texture dots
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let gx = 0; gx < w; gx += 30)
    for (let gy = h * 0.52; gy < h; gy += 30) {
      ctx.beginPath();
      ctx.arc(gx+15, gy+15, 4, 0, Math.PI*2);
      ctx.fill();
    }

  // Parallax clouds (sky layer, before world map)
  _drawClouds(ctx, w, h);

  const holeRx = Math.min(w, h) * 0.075;
  const holeRy = holeRx * 0.55;
  const mapCx  = w / 2;
  const mapCy  = h * PENTAGON_CY_FRAC;
  const mapR   = Math.min(w, h) * 0.41;   // large enough to contain all holes

  // 1. World map circle — drawn first, behind everything
  drawWorldMap(ctx, mapCx, mapCy, mapR, globeRotDeg, globeCloudDeg);

  // 2. Trump in the center — drawn before moles so moles pop in front
  if (trump) trump.draw(ctx);

  // 3. Holes / moles — always draw so holes are visible as ICBM launch pads too
  for (const m of moles) m.draw(ctx, holeRx, holeRy);

  // 4. ICBMs (levels 2 & 3)
  if (currentLevel >= 2) {
    for (const b of icbms) b.draw(ctx);
  }

  // 5. Cruise missiles (level 3+)
  if (currentLevel >= 3) {
    for (const cm of cruises) cm.draw(ctx);
  }

  // 6. Score popups
  _drawPopups(ctx, w, h);

  // 7. Vignette
  _drawVignette(ctx, w, h);

  // 8. Level-specific alert tint
  if (state === GS.PLAYING && currentLevel >= 2) {
    const pulse = 0.06 + Math.abs(Math.sin(Date.now() * 0.0025)) * 0.07;
    ctx.save();
    ctx.fillStyle = `rgba(200,0,0,${pulse})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 9. Screen flash on hit (white) / cruise-trump hit (red)
  if (flashAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    // If a cruise just hit trump the flash will be slightly red-orange
    const hitByMissile = cruises.some(cm => cm.hitTrump && cm.state !== 'done');
    ctx.fillStyle = hitByMissile ? '#ff2200' : '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 10. HUD / overlays
  if      (state === GS.INTRO)        drawIntro(w, h);
  else if (state === GS.LEVEL_INTRO)  drawLevelIntro(w, h);
  else if (state === GS.PLAYING)      drawHUD(w, h);
  else if (state === GS.PAUSED)       { drawHUD(w, h); drawPaused(w, h); }
  else if (state === GS.GAME_OVER)    drawGameOver(w, h);

  if (shaking) ctx.restore();
}

function drawHUD(w, h) {
  const fs = Math.max(18, Math.min(w, h) * 0.04);
  ctx.save();
  ctx.font = `bold ${fs}px Arial`;
  ctx.lineWidth = 3;

  // Score
  ctx.fillStyle   = '#fff';
  ctx.strokeStyle = '#000';
  ctx.textAlign     = 'left';
  ctx.textBaseline  = 'top';
  ctx.strokeText(`Score: ${score}`, 16, 16);
  ctx.fillText(`Score: ${score}`, 16, 16);

  // Level badge (bottom-left of score)
  ctx.font      = `bold ${Math.round(fs * 0.58)}px Arial`;
  ctx.fillStyle = currentLevel === 3 ? '#ff8c00' : currentLevel === 2 ? '#ff4444' : '#88ff88';
  ctx.strokeText(`Level ${currentLevel}`, 16, 16 + fs * 1.2);
  ctx.fillText(`Level ${currentLevel}`, 16, 16 + fs * 1.2);

  // Timer — red + pulsing in last 10s
  const secs   = Math.ceil(timeLeft / 1000);
  const mm     = String(Math.floor(secs / 60)).padStart(2,'0');
  const ss     = String(secs % 60).padStart(2,'0');
  const urgent = timeLeft < 10000;
  const pulse  = urgent ? 1 + Math.sin(Date.now() * 0.012) * 0.18 : 1;
  ctx.save();
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.translate(w - 16, 16 + fs * 0.5);
  ctx.scale(pulse, pulse);
  ctx.translate(0, -fs * 0.5);
  ctx.font        = `bold ${fs}px Arial`;
  ctx.fillStyle   = urgent ? '#ff3333' : '#fff';
  ctx.strokeStyle = urgent ? '#660000' : '#000';
  if (urgent) {
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur  = 12;
  }
  ctx.strokeText(`${mm}:${ss}`, 0, 0);
  ctx.fillText(`${mm}:${ss}`, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.restore();
}

function drawPaused(w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);
  const fs = Math.max(22, Math.min(w, h) * 0.055);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle   = '#ffffff';
  ctx.font        = `bold ${fs * 1.5}px Impact, Arial`;
  ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
  ctx.fillText('PAUSED', w / 2, h * 0.45);
  ctx.shadowBlur = 0;
  ctx.font      = `${fs * 0.55}px Arial`;
  ctx.fillStyle = '#cccccc';
  ctx.fillText('Press ESC to resume', w / 2, h * 0.55);
  ctx.restore();
}

function drawIntro(w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);
  const fs = Math.max(22, Math.min(w, h) * 0.055);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffee00';
  ctx.font = `bold ${fs * 1.5}px Impact, Arial`;
  ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 14;
  ctx.fillText('World Wide', w/2, h*0.30);
  ctx.fillText('Whack-a-Mole', w/2, h*0.40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${fs * 0.7}px Arial`;
  ctx.fillText('Tap / Click to Start!', w/2, h*0.5);
  ctx.font = `${fs * 0.5}px Arial`;
  ctx.fillStyle = '#ddd';
  ctx.fillText('Help the President Save the World!', w/2, h*0.58);
  if (highScore > 0) {
    ctx.font      = `bold ${fs * 0.55}px Arial`;
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#aa8800'; ctx.shadowBlur = 8;
    ctx.fillText(`🏆 Best Score: ${highScore}`, w/2, h*0.68);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawGameOver(w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, w, h);
  const fs = Math.max(22, Math.min(w, h) * 0.055);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#44ee44';
  ctx.font = `bold ${fs * 1.4}px Impact, Arial`;
  ctx.shadowColor = '#00aa00'; ctx.shadowBlur = 16;
  ctx.fillText(`LEVEL ${currentLevel} COMPLETE!`, w/2, h*0.33);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${fs}px Arial`;
  ctx.fillText(`Score: ${score}`, w/2, h*0.45);
  // High score line
  if (score >= highScore && highScore > 0) {
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${fs * 0.75}px Impact, Arial`;
    ctx.shadowColor = '#aa8800'; ctx.shadowBlur = 10;
    ctx.fillText('★ NEW HIGH SCORE! ★', w/2, h*0.54);
    ctx.shadowBlur = 0;
  } else if (highScore > 0) {
    ctx.font      = `${fs * 0.55}px Arial`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`Best: ${highScore}`, w/2, h*0.54);
  }
  ctx.font = `${fs * 0.52}px Arial`;
  ctx.fillStyle = '#aaa';
  ctx.fillText('Ad coming up…', w/2, h*0.63);
  ctx.restore();
}

function drawLevelIntro(w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, w, h);
  const fs = Math.max(22, Math.min(w, h) * 0.055);
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  if (currentLevel === 2) {
    ctx.fillStyle   = '#ff3333';
    ctx.font        = `bold ${fs * 1.7}px Impact, Arial`;
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 20;
    ctx.fillText('LEVEL 2', w/2, h*0.28);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffee00';
    ctx.font      = `bold ${fs * 0.9}px Arial`;
    ctx.fillText('\u2622 Nuclear ICBMs Incoming! \u2622', w/2, h*0.42);
    ctx.fillStyle = '#fff';
    ctx.font      = `bold ${fs * 0.72}px Arial`;
    ctx.fillText('Tap / Click to Launch Defenses!', w/2, h*0.53);
    ctx.fillStyle = '#ccc';
    ctx.font      = `${fs * 0.50}px Arial`;
    ctx.fillText('Destroy the missiles before they escape!', w/2, h*0.62);
  } else {
    ctx.fillStyle   = '#ff8c00';
    ctx.font        = `bold ${fs * 1.7}px Impact, Arial`;
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20;
    ctx.fillText(`LEVEL ${currentLevel}`, w/2, h*0.26);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff9999';
    ctx.font      = `bold ${fs * 0.68}px Arial`;
    ctx.fillText('Watch out for Cruise Missiles!', w/2, h*0.56);
    ctx.fillStyle = '#fff';
    ctx.font      = `bold ${fs * 0.68}px Arial`;
    ctx.fillText('Tap / Click to Begin!', w/2, h*0.65);
    ctx.fillStyle = '#ccc';
    ctx.font      = `${fs * 0.48}px Arial`;
    ctx.fillText('Cruise missiles hitting the president reduce your score!', w/2, h*0.73);
  }
  ctx.restore();
}

// ---- Graphic helpers ----

function _drawCloud(ctx, c, w, h) {
  const cx = c.x * w;
  const cy = h * 0.10 + (c.h * h * 0.5);
  const cw = c.w * w;
  const ch = c.h * h;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.80)';
  // Three overlapping ellipses + flat base
  ctx.beginPath();
  ctx.ellipse(cx,             cy,           cw*0.48, ch*0.70, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + cw*0.30,   cy + ch*0.08, cw*0.36, ch*0.60, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - cw*0.28,   cy + ch*0.12, cw*0.30, ch*0.52, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + cw*0.08,   cy + ch*0.28, cw*0.50, ch*0.42, 0, 0, Math.PI*2);
  ctx.fill();
  // Slight shadow underside
  ctx.fillStyle = 'rgba(160,190,220,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ch*0.38, cw*0.46, ch*0.20, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function _drawClouds(ctx, w, h) {
  for (const c of clouds) _drawCloud(ctx, c, w, h);
}

function _drawPopups(ctx, w, h) {
  for (const p of scorePopups) {
    const alpha = Math.min(1, p.life * 2);
    const sc    = 0.7 + (1 - p.life) * 0.5;
    const text  = `+${p.pts}`;
    const fs    = Math.max(20, Math.min(w, h) * 0.042);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.scale(sc, sc);
    ctx.font        = `bold ${fs}px Arial`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth   = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle   = '#ffffff';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

function _drawVignette(ctx, w, h) {
  ctx.save();
  const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.30, w/2, h/2, Math.max(w,h)*0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
