const STATE = { DOWN: 0, RISING: 1, UP: 2, FALLING: 3, HIT: 4 };
const RISE_MS = 220;
const FALL_MS = 280;
const HIT_FLASH_MS = 380;

// Each draw function receives (ctx, x, headY, r) and renders a detailed portrait
const CHARACTERS = [
  { name: 'Khomeini', draw: drawKhomeini  },
  { name: 'Putin',    draw: drawPutin     },
  { name: 'Castro',   draw: drawCastro    },
  { name: 'Maduro',   draw: drawMaduro    },
  { name: 'Xi',       draw: drawXi        },
  { name: 'Kim',      draw: drawKimJongUn },
];

// ── Shared helpers ──────────────────────────────────────────────────────────

function faceGrad(ctx, x, y, r, baseColor, highlightColor) {
  const g = ctx.createRadialGradient(x - r*0.25, y - r*0.2, r*0.1, x, y, r);
  g.addColorStop(0, highlightColor);
  g.addColorStop(1, baseColor);
  return g;
}

function drawEye(ctx, ex, ey, r, irisColor) {
  // White
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ex, ey, r*0.52, r*0.38, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f5f0e8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = r*0.08;
  ctx.stroke();
  // Iris
  ctx.beginPath();
  ctx.arc(ex, ey+r*0.04, r*0.26, 0, Math.PI*2);
  ctx.fillStyle = irisColor;
  ctx.fill();
  // Pupil
  ctx.beginPath();
  ctx.arc(ex, ey+r*0.04, r*0.13, 0, Math.PI*2);
  ctx.fillStyle = '#0a0808';
  ctx.fill();
  // Highlight
  ctx.beginPath();
  ctx.arc(ex+r*0.08, ey-r*0.06, r*0.07, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  ctx.restore();
}

function drawBrow(ctx, x, y, r, angle, thickness, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.45, y + Math.tan(angle)*(r*0.45));
  ctx.quadraticCurveTo(x, y - r*0.06, x + r*0.45, y + Math.tan(-angle)*(r*0.45));
  ctx.stroke();
  ctx.restore();
}

function drawNose(ctx, x, y, r) {
  ctx.save();
  // Bridge
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = r*0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - r*0.1);
  ctx.quadraticCurveTo(x + r*0.12, y + r*0.18, x + r*0.06, y + r*0.28);
  ctx.stroke();
  // Nostrils
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x - r*0.12, y + r*0.28, r*0.1, r*0.07, -0.4, 0, Math.PI*2);
  ctx.ellipse(x + r*0.12, y + r*0.28, r*0.1, r*0.07, 0.4, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// ── Portrait: Khomeini ──────────────────────────────────────────────────────
function drawKhomeini(ctx, x, y, r) {
  // Black turban
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y - r*0.55, r*0.85, r*0.62, 0, 0, Math.PI*2);
  ctx.fillStyle = '#111';
  ctx.fill();
  // Turban wrap highlight
  ctx.strokeStyle = '#333';
  ctx.lineWidth = r*0.06;
  ctx.beginPath();
  ctx.ellipse(x, y - r*0.55, r*0.78, r*0.55, 0.15, Math.PI*0.7, Math.PI*2.1);
  ctx.stroke();
  ctx.restore();

  // Face — medium brown, oval (slightly long)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + r*0.05, r*0.78, r, 0, 0, Math.PI*2);
  ctx.fillStyle = faceGrad(ctx, x, y, r, '#7a5220', '#c49a60');
  ctx.fill();
  ctx.restore();

  // Heavy dark eyebrows
  ctx.save();
  ctx.strokeStyle = '#1a1008';
  ctx.lineWidth = r*0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.52, y - r*0.28);
  ctx.quadraticCurveTo(x - r*0.3, y - r*0.38, x - r*0.05, y - r*0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r*0.05, y - r*0.3);
  ctx.quadraticCurveTo(x + r*0.3, y - r*0.38, x + r*0.52, y - r*0.28);
  ctx.stroke();
  ctx.restore();

  // Eyes — dark brown
  drawEye(ctx, x - r*0.28, y - r*0.12, r*0.28, '#3a2010');
  drawEye(ctx, x + r*0.28, y - r*0.12, r*0.28, '#3a2010');

  // Long nose
  ctx.save();
  ctx.strokeStyle = 'rgba(60,30,10,0.35)';
  ctx.lineWidth = r*0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - r*0.08);
  ctx.quadraticCurveTo(x + r*0.14, y + r*0.22, x + r*0.08, y + r*0.36);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x - r*0.14, y + r*0.36, r*0.11, r*0.07, -0.4, 0, Math.PI*2);
  ctx.ellipse(x + r*0.14, y + r*0.36, r*0.11, r*0.07, 0.4, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Dense white beard covering lower face
  ctx.save();
  const beardGrad = ctx.createLinearGradient(x, y+r*0.2, x, y+r*1.1);
  beardGrad.addColorStop(0, '#c8c0b0');
  beardGrad.addColorStop(1, '#e8e0d0');
  ctx.fillStyle = beardGrad;
  ctx.beginPath();
  ctx.moveTo(x - r*0.72, y + r*0.28);
  ctx.quadraticCurveTo(x - r*0.8, y + r*0.7, x - r*0.6, y + r*1.1);
  ctx.quadraticCurveTo(x, y + r*1.3, x + r*0.6, y + r*1.1);
  ctx.quadraticCurveTo(x + r*0.8, y + r*0.7, x + r*0.72, y + r*0.28);
  ctx.quadraticCurveTo(x, y + r*0.18, x - r*0.72, y + r*0.28);
  ctx.closePath();
  ctx.fill();
  // Beard texture lines
  ctx.strokeStyle = 'rgba(150,140,130,0.4)';
  ctx.lineWidth = r*0.03;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i*r*0.18, y + r*0.32);
    ctx.quadraticCurveTo(x + i*r*0.22, y + r*0.75, x + i*r*0.15, y + r*1.1);
    ctx.stroke();
  }
  ctx.restore();

  // Black robe collar
  ctx.save();
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath();
  ctx.moveTo(x - r*0.7, y + r*0.9);
  ctx.lineTo(x - r*0.9, y + r*1.4);
  ctx.lineTo(x + r*0.9, y + r*1.4);
  ctx.lineTo(x + r*0.7, y + r*0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Portrait: Putin ─────────────────────────────────────────────────────────
function drawPutin(ctx, x, y, r) {
  // Pale skin, wide face
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + r*0.05, r*0.88, r, 0, 0, Math.PI*2);
  ctx.fillStyle = faceGrad(ctx, x, y, r, '#c8a888', '#eeddc0');
  ctx.fill();
  ctx.restore();

  // Receding dark blond hair — very thin strip
  ctx.save();
  ctx.fillStyle = '#9a8060';
  ctx.beginPath();
  ctx.ellipse(x, y - r*0.82, r*0.82, r*0.3, 0, 0, Math.PI*2);
  ctx.fill();
  // Side patches
  ctx.beginPath();
  ctx.ellipse(x - r*0.7, y - r*0.55, r*0.25, r*0.38, -0.3, 0, Math.PI*2);
  ctx.ellipse(x + r*0.7, y - r*0.55, r*0.25, r*0.38, 0.3, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Heavy, slightly furrowed brows — cold expression
  ctx.save();
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = r*0.11;
  ctx.lineCap = 'round';
  // Left brow — angled downward inward (menacing)
  ctx.beginPath();
  ctx.moveTo(x - r*0.52, y - r*0.32);
  ctx.lineTo(x - r*0.1, y - r*0.42);
  ctx.stroke();
  // Right brow
  ctx.beginPath();
  ctx.moveTo(x + r*0.1, y - r*0.42);
  ctx.lineTo(x + r*0.52, y - r*0.32);
  ctx.stroke();
  ctx.restore();

  // Eyes — narrow, steel blue, slightly squinting
  ctx.save();
  // Upper eyelid shadow (squint)
  ctx.fillStyle = 'rgba(80,60,40,0.18)';
  ctx.beginPath();
  ctx.ellipse(x - r*0.28, y - r*0.18, r*0.3, r*0.12, 0, 0, Math.PI*2);
  ctx.ellipse(x + r*0.28, y - r*0.18, r*0.3, r*0.12, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  drawEye(ctx, x - r*0.28, y - r*0.16, r*0.27, '#4a6888');
  drawEye(ctx, x + r*0.28, y - r*0.16, r*0.27, '#4a6888');

  // Nose — broad, slightly bulbous
  drawNose(ctx, x, y + r*0.08, r);

  // Thin cold mouth — slight downward
  ctx.save();
  ctx.strokeStyle = '#8a5a50';
  ctx.lineWidth = r*0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.32, y + r*0.48);
  ctx.quadraticCurveTo(x, y + r*0.52, x + r*0.32, y + r*0.46);
  ctx.stroke();
  ctx.restore();

  // Strong jaw shadow
  ctx.save();
  ctx.strokeStyle = 'rgba(140,100,70,0.3)';
  ctx.lineWidth = r*0.18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.72, y + r*0.5);
  ctx.quadraticCurveTo(x, y + r*1.08, x + r*0.72, y + r*0.5);
  ctx.stroke();
  ctx.restore();

  // Dark suit / collar
  ctx.save();
  ctx.fillStyle = '#1c2a3a';
  ctx.beginPath();
  ctx.moveTo(x - r*0.7, y + r*0.88);
  ctx.lineTo(x - r*1.0, y + r*1.4);
  ctx.lineTo(x + r*1.0, y + r*1.4);
  ctx.lineTo(x + r*0.7, y + r*0.88);
  ctx.closePath();
  ctx.fill();
  // White shirt strip
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(x - r*0.1, y + r*0.9);
  ctx.lineTo(x - r*0.08, y + r*1.4);
  ctx.lineTo(x + r*0.08, y + r*1.4);
  ctx.lineTo(x + r*0.1, y + r*0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Portrait: Castro ────────────────────────────────────────────────────────
function drawCastro(ctx, x, y, r) {
  // Olive-brown skin, long oval face
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + r*0.08, r*0.82, r, 0, 0, Math.PI*2);
  ctx.fillStyle = faceGrad(ctx, x, y, r, '#7a5828', '#c09858');
  ctx.fill();
  ctx.restore();

  // Olive green military cap / beret
  ctx.save();
  ctx.fillStyle = '#3a5030';
  // Cap brim
  ctx.beginPath();
  ctx.ellipse(x, y - r*0.72, r*0.92, r*0.18, 0, 0, Math.PI*2);
  ctx.fill();
  // Cap body
  ctx.beginPath();
  ctx.moveTo(x - r*0.88, y - r*0.72);
  ctx.quadraticCurveTo(x - r*0.82, y - r*1.22, x, y - r*1.18);
  ctx.quadraticCurveTo(x + r*0.82, y - r*1.22, x + r*0.88, y - r*0.72);
  ctx.closePath();
  ctx.fill();
  // Cap highlight
  ctx.fillStyle = '#4a6840';
  ctx.beginPath();
  ctx.ellipse(x - r*0.15, y - r*1.0, r*0.35, r*0.12, -0.3, 0, Math.PI*2);
  ctx.fill();
  // Cap badge (small gold star)
  ctx.fillStyle = '#d4a800';
  ctx.beginPath();
  const bx = x, by = y - r*0.82;
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
    const ia = (i * 4 * Math.PI / 5) + Math.PI * 0.3 - Math.PI / 2;
    i === 0 ? ctx.moveTo(bx + Math.cos(-Math.PI/2) * r*0.1, by + Math.sin(-Math.PI/2) * r*0.1)
            : ctx.lineTo(bx + Math.cos(a) * r*0.1, by + Math.sin(a) * r*0.1);
    ctx.lineTo(bx + Math.cos(ia) * r*0.05, by + Math.sin(ia) * r*0.05);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Thick dark bushy eyebrows — greying at edges
  ctx.save();
  ctx.strokeStyle = '#2a1a08';
  ctx.lineWidth = r*0.13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.52, y - r*0.26);
  ctx.quadraticCurveTo(x - r*0.28, y - r*0.36, x - r*0.06, y - r*0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r*0.06, y - r*0.28);
  ctx.quadraticCurveTo(x + r*0.28, y - r*0.36, x + r*0.52, y - r*0.26);
  ctx.stroke();
  // Grey streaks in brows
  ctx.strokeStyle = 'rgba(200,190,170,0.4)';
  ctx.lineWidth = r*0.05;
  ctx.beginPath();
  ctx.moveTo(x - r*0.45, y - r*0.28);
  ctx.lineTo(x - r*0.15, y - r*0.34);
  ctx.stroke();
  ctx.restore();

  // Eyes — dark, intense
  drawEye(ctx, x - r*0.28, y - r*0.1, r*0.28, '#2a1808');
  drawEye(ctx, x + r*0.28, y - r*0.1, r*0.28, '#2a1808');

  // Nose — prominent, long
  ctx.save();
  ctx.strokeStyle = 'rgba(80,50,15,0.35)';
  ctx.lineWidth = r*0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - r*0.06);
  ctx.quadraticCurveTo(x + r*0.15, y + r*0.22, x + r*0.1, y + r*0.36);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x - r*0.13, y + r*0.36, r*0.12, r*0.08, -0.4, 0, Math.PI*2);
  ctx.ellipse(x + r*0.13, y + r*0.36, r*0.12, r*0.08, 0.4, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Long scraggly grey-white beard — Castro's signature
  ctx.save();
  const beardGrad = ctx.createLinearGradient(x, y + r*0.3, x, y + r*1.35);
  beardGrad.addColorStop(0, '#888070');
  beardGrad.addColorStop(0.4, '#b0a898');
  beardGrad.addColorStop(1, '#d8d0c0');
  ctx.fillStyle = beardGrad;
  ctx.beginPath();
  ctx.moveTo(x - r*0.68, y + r*0.32);
  ctx.quadraticCurveTo(x - r*0.78, y + r*0.75, x - r*0.55, y + r*1.2);
  ctx.quadraticCurveTo(x - r*0.2, y + r*1.38, x, y + r*1.4);
  ctx.quadraticCurveTo(x + r*0.2, y + r*1.38, x + r*0.55, y + r*1.2);
  ctx.quadraticCurveTo(x + r*0.78, y + r*0.75, x + r*0.68, y + r*0.32);
  ctx.quadraticCurveTo(x, y + r*0.22, x - r*0.68, y + r*0.32);
  ctx.closePath();
  ctx.fill();
  // Scraggly beard texture lines
  ctx.strokeStyle = 'rgba(120,110,100,0.45)';
  ctx.lineWidth = r*0.03;
  ctx.lineCap = 'round';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i*r*0.16, y + r*0.34);
    ctx.quadraticCurveTo(
      x + i*r*0.22 + (Math.random()-0.5)*r*0.1, y + r*0.75,
      x + i*r*0.14, y + r*1.2
    );
    ctx.stroke();
  }
  ctx.restore();

  // Olive green military jacket
  ctx.save();
  ctx.fillStyle = '#3a5030';
  ctx.beginPath();
  ctx.moveTo(x - r*0.72, y + r*0.9);
  ctx.lineTo(x - r*0.98, y + r*1.4);
  ctx.lineTo(x + r*0.98, y + r*1.4);
  ctx.lineTo(x + r*0.72, y + r*0.9);
  ctx.closePath();
  ctx.fill();
  // Jacket highlight / lapel
  ctx.fillStyle = '#4a6840';
  ctx.beginPath();
  ctx.moveTo(x - r*0.72, y + r*0.9);
  ctx.lineTo(x - r*0.2, y + r*0.95);
  ctx.lineTo(x - r*0.15, y + r*1.4);
  ctx.lineTo(x - r*0.98, y + r*1.4);
  ctx.closePath();
  ctx.fill();
  // Shoulder epaulette suggestion
  ctx.fillStyle = '#d4a800';
  ctx.beginPath();
  ctx.ellipse(x - r*0.82, y + r*0.95, r*0.14, r*0.06, -0.2, 0, Math.PI*2);
  ctx.ellipse(x + r*0.82, y + r*0.95, r*0.14, r*0.06, 0.2, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// ── Portrait: Maduro ────────────────────────────────────────────────────────
function drawMaduro(ctx, x, y, r) {
  // Brown/tan skin, wide round face
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + r*0.06, r*0.92, r, 0, 0, Math.PI*2);
  ctx.fillStyle = faceGrad(ctx, x, y, r, '#9a6a30', '#d4a060');
  ctx.fill();
  ctx.restore();

  // Dark slicked-back hair
  ctx.save();
  const hairGrad = ctx.createLinearGradient(x, y-r, x, y-r*0.6);
  hairGrad.addColorStop(0, '#080808');
  hairGrad.addColorStop(1, '#2a1810');
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.moveTo(x - r*0.9, y - r*0.55);
  ctx.quadraticCurveTo(x - r*0.8, y - r*1.08, x, y - r*1.12);
  ctx.quadraticCurveTo(x + r*0.8, y - r*1.08, x + r*0.9, y - r*0.55);
  ctx.quadraticCurveTo(x + r*0.6, y - r*0.72, x, y - r*0.7);
  ctx.quadraticCurveTo(x - r*0.6, y - r*0.72, x - r*0.9, y - r*0.55);
  ctx.fill();
  ctx.restore();

  // Thick dark brows
  ctx.save();
  ctx.strokeStyle = '#080808';
  ctx.lineWidth = r*0.13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.52, y - r*0.28);
  ctx.quadraticCurveTo(x - r*0.26, y - r*0.36, x - r*0.06, y - r*0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r*0.06, y - r*0.3);
  ctx.quadraticCurveTo(x + r*0.26, y - r*0.36, x + r*0.52, y - r*0.28);
  ctx.stroke();
  ctx.restore();

  // Eyes — dark brown
  drawEye(ctx, x - r*0.3, y - r*0.12, r*0.29, '#2a1808');
  drawEye(ctx, x + r*0.3, y - r*0.12, r*0.29, '#2a1808');

  // Wide, full nose
  ctx.save();
  ctx.strokeStyle = 'rgba(80,45,15,0.35)';
  ctx.lineWidth = r*0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - r*0.04);
  ctx.quadraticCurveTo(x + r*0.16, y + r*0.2, x + r*0.1, y + r*0.32);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x - r*0.16, y + r*0.32, r*0.14, r*0.09, -0.35, 0, Math.PI*2);
  ctx.ellipse(x + r*0.16, y + r*0.32, r*0.14, r*0.09, 0.35, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // BIG thick bushy mustache — Maduro signature
  ctx.save();
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath();
  ctx.moveTo(x - r*0.5, y + r*0.3);
  ctx.quadraticCurveTo(x - r*0.38, y + r*0.2, x, y + r*0.22);
  ctx.quadraticCurveTo(x + r*0.38, y + r*0.2, x + r*0.5, y + r*0.3);
  ctx.quadraticCurveTo(x + r*0.45, y + r*0.48, x + r*0.12, y + r*0.46);
  ctx.quadraticCurveTo(x, y + r*0.5, x - r*0.12, y + r*0.46);
  ctx.quadraticCurveTo(x - r*0.45, y + r*0.48, x - r*0.5, y + r*0.3);
  ctx.fill();
  // Mustache texture
  ctx.strokeStyle = 'rgba(80,70,60,0.3)';
  ctx.lineWidth = r*0.03;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i*r*0.18, y + r*0.22);
    ctx.lineTo(x + i*r*0.14, y + r*0.46);
    ctx.stroke();
  }
  ctx.restore();

  // Sash / suit collar (Venezuelan flag colors suggestion)
  ctx.save();
  ctx.fillStyle = '#cc2200';
  ctx.beginPath();
  ctx.moveTo(x - r*0.75, y + r*0.88);
  ctx.lineTo(x - r*1.0, y + r*1.4);
  ctx.lineTo(x + r*1.0, y + r*1.4);
  ctx.lineTo(x + r*0.75, y + r*0.88);
  ctx.fill();
  // Gold stripe
  ctx.fillStyle = '#e8c000';
  ctx.beginPath();
  ctx.moveTo(x - r*0.55, y + r*0.92);
  ctx.lineTo(x - r*0.72, y + r*1.4);
  ctx.lineTo(x - r*0.5, y + r*1.4);
  ctx.lineTo(x - r*0.33, y + r*0.92);
  ctx.fill();
  ctx.restore();
}

// ── Portrait: Xi Jinping ────────────────────────────────────────────────────
function drawXi(ctx, x, y, r) {
  // Round face, light yellowish skin
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + r*0.06, r*0.9, r*0.98, 0, 0, Math.PI*2);
  ctx.fillStyle = faceGrad(ctx, x, y, r, '#c8a060', '#e8cc98');
  ctx.fill();
  ctx.restore();

  // Neat black hair with side parting
  ctx.save();
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath();
  ctx.moveTo(x - r*0.88, y - r*0.52);
  ctx.quadraticCurveTo(x - r*0.82, y - r*1.1, x + r*0.1, y - r*1.12);
  ctx.quadraticCurveTo(x + r*0.82, y - r*1.1, x + r*0.88, y - r*0.52);
  ctx.quadraticCurveTo(x + r*0.62, y - r*0.7, x + r*0.1, y - r*0.72);
  ctx.quadraticCurveTo(x - r*0.62, y - r*0.7, x - r*0.88, y - r*0.52);
  ctx.fill();
  // Parting line — slightly left of center
  ctx.strokeStyle = '#1e1e1e';
  ctx.lineWidth = r*0.04;
  ctx.beginPath();
  ctx.moveTo(x - r*0.15, y - r*0.72);
  ctx.lineTo(x - r*0.12, y - r*1.08);
  ctx.stroke();
  ctx.restore();

  // Brows — moderate, slightly angled
  ctx.save();
  ctx.strokeStyle = '#1a1008';
  ctx.lineWidth = r*0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.5, y - r*0.28);
  ctx.quadraticCurveTo(x - r*0.28, y - r*0.38, x - r*0.06, y - r*0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r*0.06, y - r*0.3);
  ctx.quadraticCurveTo(x + r*0.28, y - r*0.38, x + r*0.5, y - r*0.28);
  ctx.stroke();
  ctx.restore();

  // Eyes — almond shaped, dark brown
  ctx.save();
  // Slight epicanthic fold — draw eye with angled lid
  for (const side of [-1, 1]) {
    const ex = x + side * r * 0.3;
    const ey = y - r*0.14;
    ctx.beginPath();
    ctx.ellipse(ex, ey, r*0.27, r*0.2, side*0.15, 0, Math.PI*2);
    ctx.fillStyle = '#f0ebe0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = r*0.06;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey + r*0.04, r*0.13, 0, Math.PI*2);
    ctx.fillStyle = '#1a0808';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex, ey + r*0.04, r*0.07, 0, Math.PI*2);
    ctx.fillStyle = '#050505';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + r*0.06, ey, r*0.05, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    // Upper lid line
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = r*0.05;
    ctx.beginPath();
    ctx.moveTo(ex - r*0.27, ey + r*0.02);
    ctx.quadraticCurveTo(ex, ey - r*0.22, ex + r*0.27, ey + r*0.02);
    ctx.stroke();
  }
  ctx.restore();

  // Nose — medium
  drawNose(ctx, x, y + r*0.1, r);

  // Slight diplomatic smile
  ctx.save();
  ctx.strokeStyle = '#8a6040';
  ctx.lineWidth = r*0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.3, y + r*0.48);
  ctx.quadraticCurveTo(x, y + r*0.6, x + r*0.3, y + r*0.48);
  ctx.stroke();
  ctx.restore();

  // Red collar / Mao suit
  ctx.save();
  ctx.fillStyle = '#b80000';
  ctx.beginPath();
  ctx.moveTo(x - r*0.72, y + r*0.88);
  ctx.lineTo(x - r*0.98, y + r*1.4);
  ctx.lineTo(x + r*0.98, y + r*1.4);
  ctx.lineTo(x + r*0.72, y + r*0.88);
  ctx.closePath();
  ctx.fill();
  // Mao collar detail — small stand-up collar
  ctx.fillStyle = '#c81010';
  ctx.beginPath();
  ctx.moveTo(x - r*0.22, y + r*0.88);
  ctx.lineTo(x - r*0.18, y + r*1.05);
  ctx.lineTo(x + r*0.18, y + r*1.05);
  ctx.lineTo(x + r*0.22, y + r*0.88);
  ctx.fill();
  ctx.restore();
}

// ── Portrait: Kim Jong Un ────────────────────────────────────────────────────
function drawKimJongUn(ctx, x, y, r) {
  // Round plump face, light yellowish skin
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y + r*0.08, r*0.96, r*0.98, 0, 0, Math.PI*2);
  ctx.fillStyle = faceGrad(ctx, x, y, r, '#b89850', '#ddc888');
  ctx.fill();
  ctx.restore();

  // Distinctive undercut / flat-top box-cut black hair
  ctx.save();
  ctx.fillStyle = '#0a0a0a';
  // Flat top rectangle
  ctx.fillRect(x - r*0.92, y - r*1.14, r*1.84, r*0.52);
  // Rounded top cap
  ctx.beginPath();
  ctx.ellipse(x, y - r*0.90, r*0.92, r*0.36, 0, Math.PI, Math.PI*2);
  ctx.fill();
  // Shaved sides — shadow
  ctx.fillStyle = '#1e1e1e';
  ctx.beginPath();
  ctx.ellipse(x - r*0.88, y - r*0.65, r*0.18, r*0.34, -0.12, 0, Math.PI*2);
  ctx.ellipse(x + r*0.88, y - r*0.65, r*0.18, r*0.34,  0.12, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Chubby cheeks
  ctx.save();
  ctx.fillStyle = 'rgba(200,140,90,0.24)';
  ctx.beginPath();
  ctx.ellipse(x - r*0.70, y + r*0.14, r*0.30, r*0.24, 0, 0, Math.PI*2);
  ctx.ellipse(x + r*0.70, y + r*0.14, r*0.30, r*0.24, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Short, slightly arched brows
  ctx.save();
  ctx.strokeStyle = '#1a1008';
  ctx.lineWidth   = r*0.10;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.48, y - r*0.30);
  ctx.quadraticCurveTo(x - r*0.26, y - r*0.38, x - r*0.06, y - r*0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r*0.06, y - r*0.32);
  ctx.quadraticCurveTo(x + r*0.26, y - r*0.38, x + r*0.48, y - r*0.30);
  ctx.stroke();
  ctx.restore();

  // Eyes — small, slightly narrowed
  drawEye(ctx, x - r*0.28, y - r*0.14, r*0.26, '#1a0808');
  drawEye(ctx, x + r*0.28, y - r*0.14, r*0.26, '#1a0808');

  // Wide nose
  drawNose(ctx, x, y + r*0.10, r);

  // Small neutral/pouty mouth
  ctx.save();
  ctx.strokeStyle = '#8a5040';
  ctx.lineWidth   = r*0.08;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r*0.26, y + r*0.46);
  ctx.quadraticCurveTo(x, y + r*0.52, x + r*0.26, y + r*0.46);
  ctx.stroke();
  ctx.restore();

  // Dark Mao suit / standing collar
  ctx.save();
  ctx.fillStyle = '#1a1f28';
  ctx.beginPath();
  ctx.moveTo(x - r*0.72, y + r*0.86);
  ctx.lineTo(x - r*0.98, y + r*1.4);
  ctx.lineTo(x + r*0.98, y + r*1.4);
  ctx.lineTo(x + r*0.72, y + r*0.86);
  ctx.closePath();
  ctx.fill();
  // Standing collar
  ctx.fillStyle = '#252c38';
  ctx.beginPath();
  ctx.moveTo(x - r*0.22, y + r*0.86);
  ctx.lineTo(x - r*0.18, y + r*1.08);
  ctx.lineTo(x + r*0.18, y + r*1.08);
  ctx.lineTo(x + r*0.22, y + r*0.86);
  ctx.closePath();
  ctx.fill();
  // Center button strip
  ctx.strokeStyle = '#333a44';
  ctx.lineWidth   = r*0.05;
  ctx.beginPath();
  ctx.moveTo(x, y + r*0.88);
  ctx.lineTo(x, y + r*1.4);
  ctx.stroke();
  // Buttons
  ctx.fillStyle = '#444c58';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y + r*(0.98 + i*0.15), r*0.04, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Mole class ──────────────────────────────────────────────────────────────
class Mole {
  constructor(x, y, charIndex) {
    this.x = x;
    this.y = y;
    this.char = CHARACTERS[charIndex];
    this.state = STATE.DOWN;
    this.progress = 0;
    this.flashProgress = 0;
    this.popTimer = 0;
    this.escaped = false;
    // Impact particles
    this.particles = [];
    // Wobble when UP
    this.wobblePhase = 0;
  }

  popUp(visibleMs) {
    if (this.state !== STATE.DOWN) return;
    this.state = STATE.RISING;
    this.progress = 0;
    this.popTimer = visibleMs;
    this.escaped = false;
  }

  hit() {
    if (this.state !== STATE.UP && this.state !== STATE.RISING) return false;
    this.state = STATE.HIT;
    this.progress = 0;
    this.flashProgress = 1;
    this._spawnParticles();
    return true;
  }

  isDown() { return this.state === STATE.DOWN; }

  _spawnParticles() {
    this.particles = [];
    for (let i = 0; i < 18; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 3 + Math.random() * 5;
      this.particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        color: ['#ffee00','#ff8800','#ff4400','#ffffff'][Math.floor(Math.random()*4)],
        size: 3 + Math.random() * 5,
      });
    }
  }

  update(dt) {
    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += 0.3;
      p.life -= dt / 400;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    switch (this.state) {
      case STATE.RISING:
        this.progress += dt / RISE_MS;
        if (this.progress >= 1) { this.progress = 1; this.state = STATE.UP; }
        break;
      case STATE.UP:
        this.wobblePhase += dt * 0.006;
        this.popTimer -= dt;
        if (this.popTimer <= 0) {
          this.state = STATE.FALLING;
          this.progress = 1;
          this.escaped = true;
        }
        break;
      case STATE.FALLING:
        this.progress -= dt / FALL_MS;
        if (this.progress <= 0) { this.progress = 0; this.state = STATE.DOWN; }
        break;
      case STATE.HIT:
        this.progress += dt / HIT_FLASH_MS;
        this.flashProgress = Math.max(0, 1 - this.progress * 1.5);
        if (this.progress >= 1) { this.progress = 0; this.state = STATE.DOWN; }
        break;
    }
  }

  draw(ctx, holeRx, holeRy) {
    const { x, y } = this;

    // Draw hole with depth shadow
    ctx.save();
    const holeShadow = ctx.createRadialGradient(x, y, holeRx*0.2, x, y, holeRx);
    holeShadow.addColorStop(0, '#0a0500');
    holeShadow.addColorStop(1, '#2a1500');
    ctx.beginPath();
    ctx.ellipse(x, y, holeRx, holeRy * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = holeShadow;
    ctx.fill();
    // Hole rim highlight
    ctx.strokeStyle = '#5a3510';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Inner rim
    ctx.strokeStyle = '#3a2008';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, holeRx*0.88, holeRy*0.35, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    const visibleFrac = this.progress;
    if (visibleFrac <= 0) return;

    const headR = holeRx * 0.82;
    const headY = y - visibleFrac * headR * 1.85;
    const clipBottom = y + holeRy * 0.25;

    // Glow aura when fully UP
    if (this.state === STATE.UP) {
      ctx.save();
      ctx.shadowColor = '#ffe080';
      ctx.shadowBlur  = headR * 0.55;
      ctx.beginPath();
      ctx.arc(x, headY, headR * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,100,0.12)';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Wobble offset when UP
    const wobbleX = this.state === STATE.UP ? Math.sin(this.wobblePhase) * headR * 0.04 : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - holeRx * 2.5, -9999, holeRx * 5, clipBottom + 9999);
    ctx.clip();

    // Draw detailed portrait (each function draws face + hair + clothing)
    this.char.draw(ctx, x + wobbleX, headY, headR);

    // Last name on chest
    const nameFontSize = Math.round(headR * 0.3);
    ctx.font = `bold ${nameFontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, headR * 0.09);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(this.char.name, x + wobbleX, headY + headR * 1.15);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.char.name, x + wobbleX, headY + headR * 1.15);

    ctx.restore();

    // Hit flash / shockwave
    if (this.flashProgress > 0) {
      this._drawFlash(ctx, x, headY, headR, this.flashProgress);
    }
  }

  _drawFlash(ctx, x, y, r, alpha) {
    ctx.save();
    // Shockwave ring
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = '#ffee00';
    ctx.lineWidth = r * 0.18 * alpha;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.2 + (1 - alpha) * 1.2), 0, Math.PI*2);
    ctx.stroke();

    // Star burst
    ctx.globalAlpha = alpha;
    const spikes = 10;
    const outerR = r * (1.6 + (1-alpha)*0.4);
    const innerR = r * 1.0;
    ctx.fillStyle = '#ffee00';
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? outerR : innerR;
      const px = x + Math.cos(angle) * rr;
      const py = y + Math.sin(angle) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // POW text
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff2200';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = r * 0.06;
    ctx.font = `bold ${Math.round(r * 0.7)}px Impact, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('POW!', x, y);
    ctx.fillText('POW!', x, y);
    ctx.restore();
  }
}
