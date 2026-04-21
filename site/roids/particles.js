'use strict';

class Particle {
  constructor(x, y, angle, speed, life, colour = '#c8f0c8') {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = life;
    this.maxLife = life;
    this.length = 4 + Math.random() * 6;
    this.colour = colour;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    // m-4: inline alpha — no per-particle save()/restore(); ParticleSystem.draw() resets globalAlpha
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.vx * 0.1 * this.length * alpha,
               this.y + this.vy * 0.1 * this.length * alpha);
    ctx.stroke();
  }

  get dead() { return this.life <= 0; }
}

// m-6: Hard cap prevents unbounded particle count from simultaneous explosions on low-end devices
const MAX_PARTICLES = 200;

class ParticleSystem {
  constructor() { this.particles = []; }

  explode(x, y, count = 20, speedMin = 50, speedMax = 180, life = 0.8, colour = '#c8f0c8') {
    // m-6: only spawn up to the remaining capacity
    const spawnCount = Math.min(count, MAX_PARTICLES - this.particles.length);
    for (let i = 0; i < spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      this.particles.push(new Particle(x, y, angle, speed, life * (0.5 + Math.random() * 0.5), colour));
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].dead) this.particles.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.particles) p.draw(ctx);
    ctx.globalAlpha = 1; // m-4: restore after batch particle draw (particles set inline alpha)
  }

  clear() { this.particles = []; }
}
