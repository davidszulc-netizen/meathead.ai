class Trump {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;

    this.REST_ANGLE = Math.PI * 0.68;    // resting: arm from left shoulder, mallet at hip-left
    this.armAngle   = this.REST_ANGLE;

    // Wind-up → slam → bounce → return
    this.phase    = 'idle';  // idle | windup | slam | bounce | return
    this.progress = 0;
    this.fromAngle  = this.REST_ANGLE;
    this.windAngle  = 0;    // angle for wind-up (opposite side)
    this.targetAngle = 0;   // angle toward hole
    this.bounceAngle = 0;

    // Trail: store last N arm angles for motion blur
    this.trail = [];
    this.trailMax = 6;

    // Impact shake callback — set by main.js
    this.onImpact = null;

    // Animation extras: body bob, face redness, hair sway
    this.bobPhase    = 0;
    this.faceRedness = 0;
    this.hairSway    = 0;

    // Eye gaze — normalized direction toward swing target
    this.gazeX = 0;
    this.gazeY = 0;

    // Grin — activated on level complete
    this.grinning = false;

    // MAGA hat — toggled per level
    this.wearingHat = false;
  }

  resize(cx, cy, scale) {
    this.x = cx;
    this.y = cy;
    this.scale = scale;
  }

  swing(holeX, holeY) {
    const dx = holeX - this.x;
    const dy = holeY - this.y;
    this.targetAngle = Math.atan2(dy, dx);

    // Eye gaze: normalized direction toward target
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.gazeX = dx / dist;
    this.gazeY = dy / dist;

    // Wind-up angle: 180° offset from target, biased upward
    this.windAngle = this.targetAngle - Math.PI + Math.PI * 0.25;

    this.phase = 'windup';
    this.progress = 0;
    this.fromAngle = this.armAngle;
    this.trail = [];
  }

  update(dt) {
    // Body bob — always running
    this.bobPhase += dt * 0.003;

    // Face redness: ramp up during windup, fade otherwise
    if (this.phase === 'windup') {
      this.faceRedness = Math.min(1, this.faceRedness + dt * 0.010);
    } else {
      this.faceRedness = Math.max(0, this.faceRedness - dt * 0.004);
    }

    // Hair sway: oscillates during slam/bounce, damps otherwise
    if (this.phase === 'slam' || this.phase === 'bounce') {
      this.hairSway = Math.sin(this.progress * Math.PI * 6) * 0.10;
    } else {
      this.hairSway *= 0.88;
    }

    if (this.phase === 'windup') {
      this.progress += dt / 160;
      if (this.progress >= 1) {
        this.armAngle = this.windAngle;
        this.phase = 'slam';
        this.progress = 0;
        this.fromAngle = this.windAngle;
        this.trail = [];
      } else {
        this.armAngle = this._lerp(this.fromAngle, this.windAngle, this._easeOut(this.progress));
      }

    } else if (this.phase === 'slam') {
      this.progress += dt / 90;   // very fast slam
      this.trail.unshift(this.armAngle);
      if (this.trail.length > this.trailMax) this.trail.pop();

      if (this.progress >= 1) {
        this.armAngle = this.targetAngle;
        this.bounceAngle = this.targetAngle - 0.45; // slight bounce-back
        this.phase = 'bounce';
        this.progress = 0;
        this.fromAngle = this.targetAngle;
        this.trail = [];
        if (this.onImpact) this.onImpact();
      } else {
        this.armAngle = this._lerp(this.fromAngle, this.targetAngle, this._easeIn(this.progress));
      }

    } else if (this.phase === 'bounce') {
      this.progress += dt / 120;
      if (this.progress >= 1) {
        this.armAngle = this.bounceAngle;
        this.phase = 'return';
        this.progress = 0;
        this.fromAngle = this.bounceAngle;
      } else {
        this.armAngle = this._lerp(this.fromAngle, this.bounceAngle, this.progress);
      }

    } else if (this.phase === 'return') {
      this.progress += dt / 380;
      if (this.progress >= 1) {
        this.armAngle = this.REST_ANGLE;
        this.phase = 'idle';
        this.trail = [];
        this.gazeX = 0;
        this.gazeY = 0;
      } else {
        this.armAngle = this._lerp(this.fromAngle, this.REST_ANGLE, this._easeOut(this.progress));
        // Fade gaze back toward center
        const fade = 1 - this._easeOut(this.progress);
        this.gazeX *= fade > 0 ? fade : 0;
        this.gazeY *= fade > 0 ? fade : 0;
      }
    }
  }

  _lerp(a, b, t) { return a + (b - a) * t; }
  _easeIn(t)  { return t * t * t; }
  _easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  draw(ctx) {
    const { x, y, scale } = this;

    // Body bob: gentle vertical sine oscillation
    const bobY = Math.sin(this.bobPhase) * 2;

    ctx.save();
    ctx.translate(x, y + bobY * scale);
    ctx.scale(scale, scale);

    // ── Body ─────────────────────────────────────────────────────────────────
    // Suit jacket
    const suitGrad = ctx.createLinearGradient(-30, 10, 30, 65);
    suitGrad.addColorStop(0, '#2040a0');
    suitGrad.addColorStop(1, '#0a2060');
    ctx.fillStyle = suitGrad;
    ctx.beginPath();
    ctx.moveTo(-30, 12);
    ctx.quadraticCurveTo(-36, 30, -34, 65);
    ctx.lineTo(34, 65);
    ctx.quadraticCurveTo(36, 30, 30, 12);
    ctx.closePath();
    ctx.fill();

    // Lapels
    ctx.fillStyle = '#1a3080';
    ctx.beginPath();
    ctx.moveTo(-10, 12);
    ctx.lineTo(-22, 30);
    ctx.lineTo(-8, 48);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(22, 30);
    ctx.lineTo(8, 48);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fill();

    // White shirt strip
    ctx.fillStyle = '#f8f8f0';
    ctx.beginPath();
    ctx.moveTo(-7, 14);
    ctx.lineTo(-5, 65);
    ctx.lineTo(5, 65);
    ctx.lineTo(7, 14);
    ctx.closePath();
    ctx.fill();

    // Red power tie — extra long, hangs below body (signature Trump style)
    ctx.fillStyle = '#cc1010';
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(6, 14);
    ctx.lineTo(9, 48);
    ctx.lineTo(5, 66);
    ctx.lineTo(0, 78);
    ctx.lineTo(-5, 66);
    ctx.lineTo(-9, 48);
    ctx.closePath();
    ctx.fill();
    // Tie highlight
    ctx.fillStyle = '#ee2020';
    ctx.beginPath();
    ctx.moveTo(-2, 14);
    ctx.lineTo(2, 14);
    ctx.lineTo(5, 48);
    ctx.lineTo(0, 52);
    ctx.lineTo(-5, 48);
    ctx.closePath();
    ctx.fill();

    // Pocket square
    ctx.fillStyle = '#fff';
    ctx.fillRect(20, 18, 8, 7);
    ctx.fillStyle = '#dd1010';
    ctx.fillRect(21, 17, 6, 3);

    // ── Head ─────────────────────────────────────────────────────────────────
    // Uses faceGrad() and drawEye() from mole.js (global scope).
    const hx = 0, hy = -8, hr = 26;

    // Neck
    ctx.fillStyle = '#c86510';
    ctx.beginPath();
    ctx.roundRect(hx - 9, hy + hr - 10, 18, 14, 3);
    ctx.fill();

    // Face — spray-tan orange radial gradient, slightly oval
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(hx, hy + hr*0.04, hr*0.88, hr, 0, 0, Math.PI*2);
    ctx.fillStyle = faceGrad(ctx, hx, hy, hr, '#c06010', '#f09040');
    ctx.fill();
    ctx.restore();

    // Jowls — puffy lower cheeks
    ctx.fillStyle = 'rgba(190,75,10,0.28)';
    ctx.beginPath();
    ctx.ellipse(hx - hr*0.80, hy + hr*0.24, hr*0.30, hr*0.38, -0.3, 0, Math.PI*2);
    ctx.ellipse(hx + hr*0.80, hy + hr*0.24, hr*0.30, hr*0.38,  0.3, 0, Math.PI*2);
    ctx.fill();

    // Face redness overlay (windup excitement flush)
    if (this.faceRedness > 0) {
      ctx.fillStyle = `rgba(210,30,10,${this.faceRedness * 0.28})`;
      ctx.beginPath();
      ctx.ellipse(hx, hy + hr*0.04, hr*0.88, hr, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = `rgba(240,60,20,${this.faceRedness * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(hx - hr*0.45, hy + hr*0.10, hr*0.28, hr*0.22, 0, 0, Math.PI*2);
      ctx.ellipse(hx + hr*0.45, hy + hr*0.10, hr*0.28, hr*0.22, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // White orbital rings around eyes (signature Trump feature)
    ctx.fillStyle = 'rgba(255,235,205,0.48)';
    ctx.beginPath();
    ctx.ellipse(hx - hr*0.38, hy - hr*0.08, hr*0.37, hr*0.28, 0, 0, Math.PI*2);
    ctx.ellipse(hx + hr*0.38, hy - hr*0.08, hr*0.37, hr*0.28, 0, 0, Math.PI*2);
    ctx.fill();

    // Eyebrows — thin, slightly arched, golden-blonde
    ctx.save();
    ctx.strokeStyle = '#88661a';
    ctx.lineWidth   = hr * 0.09;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - hr*0.68, hy - hr*0.46);
    ctx.quadraticCurveTo(hx - hr*0.38, hy - hr*0.56, hx - hr*0.08, hy - hr*0.46);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + hr*0.08, hy - hr*0.46);
    ctx.quadraticCurveTo(hx + hr*0.38, hy - hr*0.56, hx + hr*0.68, hy - hr*0.46);
    ctx.stroke();
    ctx.restore();

    // Eyes — steel blue iris with gaze tracking
    this._drawTrumpEye(ctx, hx - hr*0.38, hy - hr*0.08, hr*0.28, '#4060a8');
    this._drawTrumpEye(ctx, hx + hr*0.38, hy - hr*0.08, hr*0.28, '#4060a8');

    // Eye bags / lower lid puffiness (distinctive Trump look)
    ctx.fillStyle = 'rgba(165,72,10,0.30)';
    ctx.beginPath();
    ctx.ellipse(hx - hr*0.38, hy + hr*0.14, hr*0.32, hr*0.14, 0, 0, Math.PI*2);
    ctx.ellipse(hx + hr*0.38, hy + hr*0.14, hr*0.32, hr*0.14, 0, 0, Math.PI*2);
    ctx.fill();

    // Nose — bulbous, prominent
    ctx.save();
    ctx.strokeStyle = 'rgba(148,68,10,0.35)';
    ctx.lineWidth   = hr * 0.10;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy - hr*0.04);
    ctx.quadraticCurveTo(hx + hr*0.20, hy + hr*0.25, hx + hr*0.08, hy + hr*0.40);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(hx - hr*0.16, hy + hr*0.40, hr*0.14, hr*0.09, -0.35, 0, Math.PI*2);
    ctx.ellipse(hx + hr*0.16, hy + hr*0.40, hr*0.14, hr*0.09,  0.35, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Mouth
    if (this.grinning) {
      // Big grin with teeth (level complete celebration)
      ctx.save();
      ctx.fillStyle = '#801800';
      ctx.beginPath();
      ctx.moveTo(hx - hr*0.42, hy + hr*0.50);
      ctx.quadraticCurveTo(hx, hy + hr*0.78, hx + hr*0.42, hy + hr*0.50);
      ctx.closePath();
      ctx.fill();
      // Teeth
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(hx - hr*0.36, hy + hr*0.52);
      ctx.quadraticCurveTo(hx, hy + hr*0.58, hx + hr*0.36, hy + hr*0.52);
      ctx.lineTo(hx + hr*0.36, hy + hr*0.58);
      ctx.lineTo(hx - hr*0.36, hy + hr*0.58);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      // Mild upward curve (gentle smile)
      ctx.save();
      ctx.strokeStyle = '#a05020';
      ctx.lineWidth   = hr * 0.09;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(hx - hr*0.34, hy + hr*0.55);
      ctx.quadraticCurveTo(hx, hy + hr*0.64, hx + hr*0.34, hy + hr*0.55);
      ctx.stroke();
      ctx.restore();
    }

    // ── Signature combover hair (with sway during slam) ───────────────────────
    ctx.save();
    ctx.rotate(this.hairSway);
    const hairGrad = ctx.createLinearGradient(hx - hr*1.08, hy - hr*1.12, hx + hr, hy - hr*0.62);
    hairGrad.addColorStop(0,   '#d48820');
    hairGrad.addColorStop(0.5, '#e8a030');
    hairGrad.addColorStop(1,   '#c07018');
    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.moveTo(hx - hr,      hy - hr*0.40);
    ctx.quadraticCurveTo(hx - hr*1.16, hy - hr*1.44, hx - hr*0.38, hy - hr*1.28);
    ctx.quadraticCurveTo(hx + hr*0.20,  hy - hr*1.46, hx + hr*0.85, hy - hr*1.12);
    ctx.quadraticCurveTo(hx + hr*1.24,  hy - hr*0.82, hx + hr,      hy - hr*0.40);
    ctx.quadraticCurveTo(hx + hr*0.65,  hy - hr*0.76, hx + hr*0.08, hy - hr*0.72);
    ctx.quadraticCurveTo(hx - hr*0.44,  hy - hr*0.72, hx - hr,      hy - hr*0.40);
    ctx.closePath();
    ctx.fill();
    // Combover strand lines
    ctx.strokeStyle = 'rgba(170,100,10,0.40)';
    ctx.lineWidth   = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(hx - hr*0.77 + i*hr*0.31, hy - hr*0.97);
      ctx.quadraticCurveTo(hx - hr*0.46 + i*hr*0.31, hy - hr*0.67, hx + hr*0.38 + i*hr*0.19, hy - hr*0.59);
      ctx.stroke();
    }
    ctx.restore();  // end hair sway rotate

    // ── MAGA hat (levels 4+, 33% chance per level) ──────────────────────────
    if (this.wearingHat) {
      ctx.save();
      ctx.rotate(this.hairSway * 0.5);
      // Brim
      ctx.fillStyle = '#cc1010';
      ctx.beginPath();
      ctx.ellipse(hx, hy - hr*0.62, hr*1.28, hr*0.18, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#880808';
      ctx.lineWidth = hr * 0.04;
      ctx.stroke();
      // Crown
      const capGrad = ctx.createLinearGradient(hx, hy - hr*1.52, hx, hy - hr*0.62);
      capGrad.addColorStop(0, '#dd2020');
      capGrad.addColorStop(1, '#aa0c0c');
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.moveTo(hx - hr*0.92, hy - hr*0.62);
      ctx.quadraticCurveTo(hx - hr*0.96, hy - hr*1.30, hx, hy - hr*1.42);
      ctx.quadraticCurveTo(hx + hr*0.96, hy - hr*1.30, hx + hr*0.92, hy - hr*0.62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#880808';
      ctx.lineWidth = hr * 0.04;
      ctx.stroke();
      // "MAGA" text
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${hr * 0.30}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MAGA', hx, hy - hr*1.00);
      ctx.restore();
    }

    // ── Arm + mallet — anchored to right shoulder ─────────────────────────────
    ctx.save();
    ctx.translate(-28, 14);  // left shoulder pivot point

    // Motion blur trail
    const trailCount = this.trail.length;
    for (let i = 0; i < trailCount; i++) {
      const t = this.trail[i];
      const tAlpha = ((trailCount - i) / (trailCount + 1)) * 0.28;
      ctx.save();
      ctx.globalAlpha = tAlpha;
      ctx.rotate(t);
      this._drawArm(ctx, true);
      ctx.restore();
    }

    // Main arm
    ctx.save();
    ctx.rotate(this.armAngle);
    this._drawArm(ctx, false);
    ctx.restore();

    ctx.restore();   // end shoulder pivot

    ctx.restore();
  }

  _drawTrumpEye(ctx, ex, ey, r, irisColor) {
    const gazeMax = r * 0.12;
    const gx = this.gazeX * gazeMax;
    const gy = this.gazeY * gazeMax;
    // White
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, r*0.52, r*0.38, 0, 0, Math.PI*2);
    ctx.fillStyle = '#f5f0e8';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = r*0.08;
    ctx.stroke();
    // Iris (offset by gaze)
    ctx.beginPath();
    ctx.arc(ex + gx, ey + r*0.04 + gy, r*0.26, 0, Math.PI*2);
    ctx.fillStyle = irisColor;
    ctx.fill();
    // Pupil (offset by gaze)
    ctx.beginPath();
    ctx.arc(ex + gx, ey + r*0.04 + gy, r*0.13, 0, Math.PI*2);
    ctx.fillStyle = '#0a0808';
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(ex + gx + r*0.08, ey - r*0.06 + gy, r*0.07, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    ctx.restore();
  }

  _drawArm(ctx, ghost) {
    // Upper arm
    const armGrad = ghost ? null : ctx.createLinearGradient(12, -7, 12, 7);
    if (!ghost) {
      armGrad.addColorStop(0, '#f0a838');
      armGrad.addColorStop(1, '#c07010');
    }
    ctx.fillStyle = ghost ? '#e88820' : armGrad;
    ctx.beginPath();
    ctx.roundRect(12, -7, 42, 14, 7);
    ctx.fill();

    // Shirt cuff
    ctx.fillStyle = ghost ? '#e8e0c0' : '#f5f0e0';
    ctx.beginPath();
    ctx.roundRect(48, -7, 12, 14, 4);
    ctx.fill();

    // Hand (fist)
    const handGrad = ghost ? null : ctx.createRadialGradient(64, -1, 2, 64, 0, 11);
    if (!ghost) {
      handGrad.addColorStop(0, '#f0b050');
      handGrad.addColorStop(1, '#c87018');
    }
    ctx.fillStyle = ghost ? '#e8901a' : handGrad;
    ctx.beginPath();
    ctx.ellipse(64, 0, 11, 9, 0, 0, Math.PI*2);
    ctx.fill();
    if (!ghost) {
      // Knuckle lines
      ctx.strokeStyle = 'rgba(150,70,10,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(60 + i*3.5, -3, 2, Math.PI*0.9, Math.PI*0.1, true);
        ctx.stroke();
      }
    }

    // Mallet handle
    const handleGrad = ghost ? null : ctx.createLinearGradient(72, -5, 72, 5);
    if (!ghost) {
      handleGrad.addColorStop(0, '#a87840');
      handleGrad.addColorStop(1, '#6B3F1A');
    }
    ctx.fillStyle = ghost ? '#8B5030' : handleGrad;
    ctx.beginPath();
    ctx.roundRect(70, -5, 32, 10, 3);
    ctx.fill();
    if (!ghost) {
      // Handle grain lines
      ctx.strokeStyle = 'rgba(80,40,10,0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(74 + i*8, -5);
        ctx.lineTo(74 + i*8, 5);
        ctx.stroke();
      }
    }

    // Mallet head — big and imposing
    const malletGrad = ghost ? null : ctx.createLinearGradient(100, -22, 130, 22);
    if (!ghost) {
      malletGrad.addColorStop(0, '#8B5E3C');
      malletGrad.addColorStop(0.4, '#6B3F1A');
      malletGrad.addColorStop(1, '#3d1f08');
    }
    ctx.fillStyle = ghost ? '#5a3010' : malletGrad;
    ctx.beginPath();
    ctx.roundRect(100, -22, 38, 44, 5);
    ctx.fill();

    if (!ghost) {
      // Metal band at top and bottom of head
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.roundRect(100, -22, 38, 6, [5, 5, 0, 0]);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(100, 16, 38, 6, [0, 0, 5, 5]);
      ctx.fill();

      // Face of mallet — highlight
      ctx.fillStyle = 'rgba(255,220,150,0.18)';
      ctx.beginPath();
      ctx.roundRect(134, -18, 4, 36, 2);
      ctx.fill();

      // Impact surface texture cracks (for dramatic effect)
      ctx.strokeStyle = 'rgba(40,20,5,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(108, -10); ctx.lineTo(114, 5); ctx.lineTo(108, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(120, -15); ctx.lineTo(125, 0); ctx.lineTo(118, 12);
      ctx.stroke();
    }
  }
}
