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
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.colour;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.vx * 0.1 * this.length * alpha,
               this.y + this.vy * 0.1 * this.length * alpha);
    ctx.stroke();
    ctx.restore();
  }

  get dead() { return this.life <= 0; }
}

class ParticleSystem {
  constructor() { this.particles = []; }

  explode(x, y, count = 20, speedMin = 50, speedMax = 180, life = 0.8, colour = '#c8f0c8') {
    for (let i = 0; i < count; i++) {
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

  draw(ctx) { for (const p of this.particles) p.draw(ctx); }

  clear() { this.particles = []; }
}
