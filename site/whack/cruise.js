class CruiseMissile {
  constructor(trumpX, trumpY, canvasW, canvasH) {
    this.canvasW  = canvasW;
    this.canvasH  = canvasH;
    this.trumpX   = trumpX;
    this.trumpY   = trumpY;

    this.L = Math.min(canvasW, canvasH) * 0.055;  // half body length
    this.W = this.L * 0.18;                         // half body width
    this.hitR      = Math.min(canvasW, canvasH) * 0.058; // player tap radius
    this.trumpHitR = Math.min(canvasW, canvasH) * 0.10;  // hits-Trump radius

    // Spawn from left or right edge at a random Y
    const fromLeft = Math.random() < 0.5;
    const yFrac    = 0.25 + Math.random() * 0.48;
    this.x = fromLeft ? -this.L * 2 : canvasW + this.L * 2;
    this.y = canvasH * yFrac;

    // 20% aimed at Trump, 80% fly past (aimed at far edge near Trump's height)
    let targetX, targetY;
    if (Math.random() < 0.20) {
      targetX = trumpX;
      targetY = trumpY;
    } else {
      // Aim at the opposite edge, offset enough to clear Trump
      const missOffset = this.trumpHitR * (1.8 + Math.random() * 2.5);
      const sign       = Math.random() < 0.5 ? -1 : 1;
      targetX = fromLeft ? canvasW + this.L * 2 : -this.L * 2;
      targetY = trumpY + sign * missOffset;
    }

    const dx   = targetX - this.x;
    const dy   = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Speed: crosses screen width (~min(w,h) in portrait) in ~4 seconds
    const spd  = Math.min(canvasW, canvasH) * 0.00025;
    this.vx    = (dx / dist) * spd;
    this.vy    = (dy / dist) * spd;
    this.angle = Math.atan2(dy, dx);

    this.state        = 'flying'; // 'flying' | 'hit' | 'hit_trump' | 'done'
    this.hitTrump     = false;
    this.particles    = [];
    this.trailPos     = [];
    this.trailTimer   = 0;
    this.flashProgress = 0;
    this.doneTimer    = 0;
  }

  update(dt) {
    for (const t of this.trailPos) t.life -= dt / 620;
    this.trailPos = this.trailPos.filter(t => t.life > 0);

    if (this.state === 'flying') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 38;
        this.trailPos.push({ x: this.x, y: this.y, life: 1.0 });
        if (this.trailPos.length > 18) this.trailPos.shift();
      }

      // Check hit on Trump
      const dx2 = this.x - this.trumpX;
      const dy2 = this.y - this.trumpY;
      if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < this.trumpHitR) {
        this.state        = 'hit_trump';
        this.hitTrump     = true;
        this.flashProgress = 1.0;
        this._spawnParticles('#ff4444');
        this.doneTimer = 1000;
        return;
      }

      // Off-screen without hitting Trump
      const m = this.L * 3;
      if (this.x < -m || this.x > this.canvasW + m ||
          this.y < -m || this.y > this.canvasH + m) {
        this.state = 'done';
      }
    } else if (this.state === 'hit' || this.state === 'hit_trump') {
      this.flashProgress = Math.max(0, this.flashProgress - dt / 380);
      for (const p of this.particles) {
        p.x  += p.vx * dt * 0.06;
        p.y  += p.vy * dt * 0.06;
        p.vy += 0.22;
        p.life -= dt / 500;
      }
      this.particles = this.particles.filter(p => p.life > 0);
      if (this.state === 'hit') {
        if (this.particles.length === 0 && this.flashProgress <= 0) this.state = 'done';
      } else {
        this.doneTimer -= dt;
        if (this.doneTimer <= 0) this.state = 'done';
      }
    }
  }

  hit() {
    if (this.state !== 'flying') return false;
    this.state        = 'hit';
    this.flashProgress = 1.0;
    this._spawnParticles('#ffff44');
    return true;
  }

  isDone()      { return this.state === 'done'; }
  didHitTrump() { return this.hitTrump; }

  _spawnParticles(primaryColor) {
    const cols = [primaryColor, '#ff8800', '#ffcc00', '#ffff88', '#ffffff'];
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 6;
      this.particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5,
        life: 1.0,
        color: cols[Math.floor(Math.random() * cols.length)],
        size: 3 + Math.random() * 6,
      });
    }
  }

  draw(ctx) {
    // Trail
    for (let i = 0; i < this.trailPos.length; i++) {
      const t    = this.trailPos[i];
      const frac = (i + 1) / this.trailPos.length;
      ctx.save();
      ctx.globalAlpha = t.life * 0.28 * frac;
      ctx.fillStyle   = '#aaa';
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.W * (0.4 + frac * 0.7), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.state === 'hit' || this.state === 'hit_trump') {
      if (this.flashProgress > 0) {
        ctx.save();
        ctx.globalAlpha  = this.flashProgress * 0.85;
        ctx.strokeStyle  = this.hitTrump ? '#ff2200' : '#ffff44';
        ctx.lineWidth    = this.L * 0.22 * this.flashProgress;
        ctx.beginPath();
        ctx.arc(this.x, this.y,
          this.L * (1.3 + (1 - this.flashProgress) * 1.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (const p of this.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle   = p.color;
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
    ctx.rotate(this.angle);

    const L = this.L;
    const W = this.W;

    // Exhaust flame (at tail = -L in local space)
    const flicker = 0.78 + Math.random() * 0.44;
    const fg = ctx.createLinearGradient(-L, 0, -L - L * 0.6 * flicker, 0);
    fg.addColorStop(0,   'rgba(255,210,50,0.92)');
    fg.addColorStop(0.5, 'rgba(255,90,20,0.65)');
    fg.addColorStop(1,   'rgba(255,30,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-L, -W * 0.55);
    ctx.quadraticCurveTo(-L - L * 0.6 * flicker, 0, -L, W * 0.55);
    ctx.closePath();
    ctx.fill();

    // Slender body
    const bg = ctx.createLinearGradient(0, -W, 0, W);
    bg.addColorStop(0,   '#aaaaaa');
    bg.addColorStop(0.4, '#eeeeee');
    bg.addColorStop(1,   '#666666');
    ctx.fillStyle = bg;
    ctx.fillRect(-L, -W, L * 2, W * 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth   = W * 0.14;
    ctx.strokeRect(-L, -W, L * 2, W * 2);

    // Pointed nose (right end = +L)
    ctx.fillStyle = '#880000';
    ctx.beginPath();
    ctx.moveTo(L, -W);
    ctx.lineTo(L + L * 0.65, 0);
    ctx.lineTo(L, W);
    ctx.closePath();
    ctx.fill();

    // Top wing
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(L * 0.1, -W);
    ctx.lineTo(L * 0.3, -W * 3.0);
    ctx.lineTo(-L * 0.3, -W * 3.0);
    ctx.lineTo(-L * 0.45, -W);
    ctx.closePath();
    ctx.fill();
    // Bottom wing
    ctx.beginPath();
    ctx.moveTo(L * 0.1, W);
    ctx.lineTo(L * 0.3, W * 3.0);
    ctx.lineTo(-L * 0.3, W * 3.0);
    ctx.lineTo(-L * 0.45, W);
    ctx.closePath();
    ctx.fill();

    // Red stripe near nose
    ctx.fillStyle = '#cc2200';
    ctx.fillRect(L * 0.35, -W * 0.6, L * 0.32, W * 1.2);

    ctx.restore();
  }
}
