class ICBM {
  constructor(x, y, canvasW, canvasH, trumpX, trumpY, speedMult = 1.0) {
    this.x = x;
    this.y = y;
    this.canvasW = canvasW;
    this.canvasH = canvasH;

    this.L = Math.min(canvasW, canvasH) * 0.040;  // half body length
    this.W = this.L * 1.14;                        // half body width (very wide)
    this.hitR = Math.min(canvasW, canvasH) * 0.09; // tap hit radius

    // Holes in the upper half of the screen launch downward so they stay visible longer
    const launchDown = y < canvasH * 0.5;

    // 20% of missiles aimed at Trump; 80% fly off at random angles
    if (Math.random() < 0.30 && trumpX !== undefined) {
      this.angle = Math.atan2(trumpY - y, trumpX - x);
    } else {
      const dir       = Math.random() < 0.5 ? -1 : 1;
      const spread    = dir * (0.26 + Math.random() * 0.52);
      const baseAngle = launchDown ? Math.PI / 2 : -Math.PI / 2;
      this.angle      = baseAngle + spread;
    }
    const speed = Math.min(canvasW, canvasH) * 0.00025 * speedMult;
    this.vx = Math.cos(this.angle) * speed;
    this.vy = Math.sin(this.angle) * speed;

    this.state   = 'flying';  // 'flying' | 'hit' | 'escaped' | 'done'
    this.escaped = false;
    this.particles  = [];
    this.smokeTrail = [];
    this.smokeTimer = 0;
    this.doneTimer  = 0;
    this.flashProgress = 0;
  }

  update(dt) {
    // Decay smoke trail
    for (const s of this.smokeTrail) s.life -= dt / 900;
    this.smokeTrail = this.smokeTrail.filter(s => s.life > 0);

    if (this.state === 'flying') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Add smoke puff every 40 ms
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 40;
        if (this.smokeTrail.length < 22) {
          this.smokeTrail.push({ x: this.x, y: this.y, life: 1.0 });
        }
      }

      // Off-screen → escaped
      const margin = this.L * 2;
      if (this.x < -margin || this.x > this.canvasW + margin ||
          this.y < -margin || this.y > this.canvasH + margin) {
        this.state   = 'escaped';
        this.escaped = true;
        this.doneTimer = 200;
      }
    } else if (this.state === 'hit') {
      this.flashProgress = Math.max(0, this.flashProgress - dt / 350);
      for (const p of this.particles) {
        p.x  += p.vx * dt * 0.06;
        p.y  += p.vy * dt * 0.06;
        p.vy += 0.22;
        p.life -= dt / 520;
      }
      this.particles = this.particles.filter(p => p.life > 0);
      if (this.particles.length === 0 && this.flashProgress <= 0) {
        this.state = 'done';
      }
    } else if (this.state === 'escaped') {
      this.doneTimer -= dt;
      if (this.doneTimer <= 0) this.state = 'done';
    }
  }

  hit() {
    if (this.state !== 'flying') return false;
    this.state = 'hit';
    this.flashProgress = 1.0;
    this._spawnParticles();
    return true;
  }

  isDone() { return this.state === 'done'; }

  _spawnParticles() {
    const cols = ['#ff2200','#ff6600','#ffaa00','#ffff44','#ffffff'];
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 7;
      this.particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
        life: 1.0,
        color: cols[Math.floor(Math.random() * cols.length)],
        size: 4 + Math.random() * 8,
      });
    }
  }

  draw(ctx) {
    // Smoke trail (drawn first, under everything)
    for (let i = 0; i < this.smokeTrail.length; i++) {
      const s = this.smokeTrail[i];
      const t = (i + 1) / this.smokeTrail.length;
      ctx.save();
      ctx.globalAlpha = s.life * 0.30 * t;
      ctx.fillStyle = '#aaaaaa';
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.W * (0.5 + t * 0.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.state === 'hit') {
      // Explosion flash ring
      if (this.flashProgress > 0) {
        ctx.save();
        ctx.globalAlpha = this.flashProgress * 0.85;
        ctx.strokeStyle = '#ffff44';
        ctx.lineWidth = this.L * 0.22 * this.flashProgress;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.L * (1.4 + (1 - this.flashProgress) * 1.8), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // Explosion particles
      for (const p of this.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }

    if (this.state !== 'flying') return;

    ctx.save();
    ctx.translate(this.x, this.y);
    // rotate so nose points in direction of travel
    ctx.rotate(this.angle + Math.PI / 2);

    const L = this.L;
    const W = this.W;

    // ── Flame exhaust (at tail = +L) ─────────────────────────────────────────
    const flicker = 0.75 + Math.random() * 0.5;
    const fg = ctx.createLinearGradient(0, L, 0, L + L * 0.85 * flicker);
    fg.addColorStop(0,   'rgba(255,220,50,0.92)');
    fg.addColorStop(0.4, 'rgba(255,100,20,0.70)');
    fg.addColorStop(1,   'rgba(255,50,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-W * 0.65, L);
    ctx.quadraticCurveTo(0, L + L * 0.85 * flicker, W * 0.65, L);
    ctx.closePath();
    ctx.fill();

    // ── Rocket body ───────────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(-W, 0, W, 0);
    bg.addColorStop(0,   '#555');
    bg.addColorStop(0.3, '#bbb');
    bg.addColorStop(0.6, '#eee');
    bg.addColorStop(1,   '#777');
    ctx.fillStyle = bg;
    ctx.fillRect(-W, -L, W * 2, L * 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = W * 0.14;
    ctx.strokeRect(-W, -L, W * 2, L * 2);

    // ── Red nose cone ─────────────────────────────────────────────────────────
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(-W, -L);
    ctx.quadraticCurveTo(0, -L * 1.75, W, -L);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#880000';
    ctx.lineWidth = W * 0.12;
    ctx.stroke();

    // ── Fins ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = '#7a3a00';
    ctx.beginPath();
    ctx.moveTo(-W, L * 0.45);
    ctx.lineTo(-W * 2.4, L * 1.0);
    ctx.lineTo(-W, L);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W, L * 0.45);
    ctx.lineTo(W * 2.4, L * 1.0);
    ctx.lineTo(W, L);
    ctx.closePath();
    ctx.fill();

    // ── ☢ Radioactive symbol on body ─────────────────────────────────────────
    ctx.save();
    const sr = W * 0.68;
    // Center dot
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(0, 0, sr * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // Three blades
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI / 3) - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * sr * 0.30, Math.sin(a) * sr * 0.30);
      ctx.arc(0, 0, sr * 0.65, a + 0.38, a + (Math.PI * 2 / 3) - 0.38);
      ctx.arc(0, 0, sr * 0.30, a + (Math.PI * 2 / 3) - 0.38, a + 0.38, true);
      ctx.closePath();
      ctx.fillStyle = '#ffdd00';
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }
}
