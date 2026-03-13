'use strict';

const BULLET_SPEED = 420;
const BULLET_LIFE  = 1.275;

class Bullet {
  constructor(x, y, angle, fromUFO = false, life = BULLET_LIFE) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * BULLET_SPEED;
    this.vy = Math.sin(angle) * BULLET_SPEED;
    this.life = life;
    this.fromUFO = fromUFO;
    this.radius = 8;
  }

  update(dt, W, H) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.x < 0) this.x += W;
    if (this.x > W) this.x -= W;
    if (this.y < 0) this.y += H;
    if (this.y > H) this.y -= H;
  }

  draw(ctx) {
    ctx.save();
    const dir   = Math.atan2(this.vy, this.vx);
    const alpha = Math.min(1, this.life / BULLET_LIFE);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.fromUFO ? 'rgba(255,140,100,0.9)' : 'rgba(150,230,150,0.9)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y,
                this.radius * (1.4 + Math.random() * 0.3),
                this.radius * (0.6 + Math.random() * 0.2),
                dir, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  get dead() { return this.life <= 0; }
}
