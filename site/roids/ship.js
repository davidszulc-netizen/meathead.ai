'use strict';

const SHIP_ROTATION_SPEED    = 3.5;
const SHIP_TARGET_ROT_SPEED  = 10;   // rad/s — fast snap for touch-aim
const SHIP_THRUST            = 420;
const SHIP_DRAG              = 0.98;
const SHIP_MAX_SPEED         = 1200;
const INVINCIBILITY_DURATION = 3.0;
const HYPERSPACE_DEATH_CHANCE = 0.1;

class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.radius = 14;
    this.invincible = 0;
    this.alive = true;
    this.thrusting = false;
    this.targetAngle = null;  // set by mobile touch input
  }

  update(dt, keys, W, H) {
    if (!this.alive) return;

    // Touch-aim: rotate toward targetAngle if set
    if (this.targetAngle !== null) {
      let diff = this.targetAngle - this.angle;
      // normalise to [-PI, PI]
      while (diff >  Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const maxRot = SHIP_TARGET_ROT_SPEED * dt;
      if (Math.abs(diff) <= maxRot) {
        this.angle = this.targetAngle;
        this.targetAngle = null;
      } else {
        this.angle += Math.sign(diff) * maxRot;
      }
    }

    if (keys.left)  this.angle -= SHIP_ROTATION_SPEED * dt;
    if (keys.right) this.angle += SHIP_ROTATION_SPEED * dt;

    this.thrusting = !!keys.up;
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * SHIP_THRUST * dt;
      this.vy += Math.sin(this.angle) * SHIP_THRUST * dt;
    }

    this.vx *= Math.pow(SHIP_DRAG, dt * 60);
    this.vy *= Math.pow(SHIP_DRAG, dt * 60);

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > SHIP_MAX_SPEED) {
      this.vx = (this.vx / speed) * SHIP_MAX_SPEED;
      this.vy = (this.vy / speed) * SHIP_MAX_SPEED;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < 0) this.x += W;
    if (this.x > W) this.x -= W;
    if (this.y < 0) this.y += H;
    if (this.y > H) this.y -= H;

    if (this.invincible > 0) this.invincible -= dt;
  }

  shoot() {
    if (!this.alive) return null;
    const tipX = this.x + Math.cos(this.angle) * 22;
    const tipY = this.y + Math.sin(this.angle) * 22;
    return new Bullet(tipX, tipY, this.angle, false);
  }

  hyperspace(W, H, asteroids) {
    if (!this.alive) return false;
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.vx = 0;
    this.vy = 0;
    const onAsteroid = asteroids.some(a => Math.hypot(this.x - a.x, this.y - a.y) < a.radius + this.radius);
    if (Math.random() < HYPERSPACE_DEATH_CHANCE || onAsteroid) return true;
    this.invincible = 0.5;
    return false;
  }

  applyImpulse(ivx, ivy) {
    this.vx += ivx;
    this.vy += ivy;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > SHIP_MAX_SPEED) {
      this.vx = (this.vx / speed) * SHIP_MAX_SPEED;
      this.vy = (this.vy / speed) * SHIP_MAX_SPEED;
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const H = 7; // half-height of tube body

    // Tube body — light minty green fill
    ctx.fillStyle   = '#d4f0d4';
    ctx.strokeStyle = '#aaddaa';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(-14, -H, 28, H * 2, 4);
    ctx.fill(); ctx.stroke();

    // Nozzle / cap at front
    ctx.fillStyle   = '#fff';
    ctx.strokeStyle = '#ccc';
    ctx.beginPath();
    ctx.roundRect(14, -4, 8, 8, 2);
    ctx.fill(); ctx.stroke();

    // Crimp ridges at back
    ctx.strokeStyle = '#aaddaa';
    ctx.lineWidth   = 1;
    for (const dx of [0, -3]) {
      ctx.beginPath();
      ctx.moveTo(-14 + dx, -H * 0.85);
      ctx.lineTo(-14 + dx,  H * 0.85);
      ctx.stroke();
    }

    // Label "roids"
    ctx.fillStyle     = '#2a6e2a';
    ctx.font          = 'bold 7px sans-serif';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText('roids', -1, 0);

    // Thrust flame at the back crimp end
    if (this.thrusting && Math.random() > 0.3) {
      ctx.strokeStyle = '#aaddaa';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(-14, -4);
      ctx.lineTo(-22 - Math.random() * 10, 0);
      ctx.lineTo(-14,  4);
      ctx.stroke();
    }

    ctx.restore();
  }
}
