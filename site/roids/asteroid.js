'use strict';

const _MOBILE = /Mobi|Android|iPhone|iPad|iPod|tablet/i.test(navigator.userAgent)
             || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
const _AST_SPEED_MULT = _MOBILE ? 0.6 : 1.0;

const ASTEROID_SIZES = {
  large:  { radius: 45, score: 20,  speed: 44  * _AST_SPEED_MULT },
  medium: { radius: 22, score: 50,  speed: 77  * _AST_SPEED_MULT },
  small:  { radius: 10, score: 100, speed: 132 * _AST_SPEED_MULT },
};

// 6% faster per level beyond 1, capped at 100%
let _asteroidLevelMult = 1.0;
function setAsteroidLevel(lvl) {
  _asteroidLevelMult = Math.min(1 + (lvl - 1) * 0.06, 2.0);
}

class Asteroid {
  constructor(x, y, size, vx, vy) {
    this.x = x;
    this.y = y;
    this.size = size;
    const s = ASTEROID_SIZES[size];
    this.radius = s.radius;
    this.score  = s.score;

    if (vx !== undefined && vy !== undefined) {
      this.vx = vx;
      this.vy = vy;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const spd   = s.speed * _asteroidLevelMult * (0.6 + Math.random() * 0.8);
      this.vx = Math.cos(angle) * spd;
      this.vy = Math.sin(angle) * spd;
    }

    this.rotation = 0;
    this.rotSpeed = (Math.random() - 0.5) * 1.5;
  }

  update(dt, W, H) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotSpeed * dt;

    if (this.x < -this.radius)      this.x += W + this.radius * 2;
    if (this.x > W + this.radius)   this.x -= W + this.radius * 2;
    if (this.y < -this.radius)      this.y += H + this.radius * 2;
    if (this.y > H + this.radius)   this.y -= H + this.radius * 2;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const r = this.radius;
    ctx.strokeStyle = '#f5c8a0';
    ctx.lineWidth   = 1.5;
    ctx.fillStyle   = 'rgba(245,200,160,0.15)';

    // Single continuous butt outline
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.50);                                                      // top crack cleft
    ctx.bezierCurveTo( r*0.18, -r*0.80,  r*0.82, -r*0.62,  r*0.86, -r*0.05);    // right cheek top arc
    ctx.bezierCurveTo( r*0.90,  r*0.38,  r*0.52,  r*0.76,  0,       r*0.82);     // right side down to bottom
    ctx.bezierCurveTo(-r*0.52,  r*0.76, -r*0.90,  r*0.38, -r*0.86, -r*0.05);    // bottom up left side
    ctx.bezierCurveTo(-r*0.82, -r*0.62, -r*0.18, -r*0.80,  0,      -r*0.50);    // left cheek top arc back to crack
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Butt crack — slight curve from cleft downward
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.50);
    ctx.quadraticCurveTo(r * 0.04, r * 0.10, 0, r * 0.44);
    ctx.stroke();

    ctx.restore();
  }

  split() {
    const next = this.size === 'large' ? 'medium' : this.size === 'medium' ? 'small' : null;
    if (!next) return [];
    return [_childAsteroid(this, next), _childAsteroid(this, next)];
  }
}

function _childAsteroid(parent, size) {
  const spd   = ASTEROID_SIZES[size].speed * _asteroidLevelMult * (0.8 + Math.random() * 0.6);
  const angle = Math.atan2(parent.vy, parent.vx) + (Math.random() - 0.5) * Math.PI;
  return new Asteroid(parent.x, parent.y, size, Math.cos(angle) * spd, Math.sin(angle) * spd);
}

function spawnAsteroid(W, H, safeX, safeY, safeRadius, size = 'large') {
  let x, y;
  do {
    x = Math.random() * W;
    y = Math.random() * H;
  } while (safeX !== undefined && Math.hypot(x - safeX, y - safeY) < safeRadius);
  return new Asteroid(x, y, size);
}
