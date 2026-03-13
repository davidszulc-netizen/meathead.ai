'use strict';

const UFO_SPEED         = 60;
const UFO_FIRE_INTERVAL = 2.0;
const UFO_ZIGZAG_INTERVAL = 1.2;

class UFO {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.side = Math.random() < 0.5 ? 'left' : 'right';
    this.x = this.side === 'left' ? 0 : W;
    this.y = Math.random() * H;
    this.vx = this.side === 'left' ? UFO_SPEED : -UFO_SPEED;
    this.vy = (Math.random() - 0.5) * UFO_SPEED;
    this.radius = 16;
    this.score = 1000;
    this.fireTimer = UFO_FIRE_INTERVAL * 0.5;
    this.zigzagTimer = UFO_ZIGZAG_INTERVAL;
    this.alive = true;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.0);
    const palette = [
      { fill: '#2d8a00', stroke: '#55bb11', crease: 'rgba(0,50,0,0.55)',   shine: 'rgba(160,255,80,0.5)',  stem: '#3a7a00' },
      { fill: '#cc2200', stroke: '#ff4422', crease: 'rgba(60,0,0,0.55)',   shine: 'rgba(255,180,160,0.5)', stem: '#3a7a00' },
      { fill: '#b8a000', stroke: '#ffe033', crease: 'rgba(50,40,0,0.55)',  shine: 'rgba(255,240,120,0.5)', stem: '#3a7a00' },
    ];
    this.colours = palette[Math.floor(Math.random() * palette.length)];
  }

  update(dt) {
    this.rotation += this.rotSpeed * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.zigzagTimer -= dt;
    if (this.zigzagTimer <= 0) {
      this.vy = (Math.random() - 0.5) * UFO_SPEED * 2;
      this.zigzagTimer = UFO_ZIGZAG_INTERVAL * (0.5 + Math.random());
    }

    if (this.y < 0) this.y += this.H;
    if (this.y > this.H) this.y -= this.H;

    if (this.side === 'left'  && this.x > this.W + this.radius * 2) this.alive = false;
    if (this.side === 'right' && this.x < -this.radius * 2)          this.alive = false;

    this.fireTimer -= dt;
  }

  tryFire(shipX, shipY) {
    if (this.fireTimer > 0) return null;
    this.fireTimer = UFO_FIRE_INTERVAL * (0.7 + Math.random() * 0.6);
    const angle = Math.atan2(shipY - this.y, shipX - this.x) + (Math.random() - 0.5) * 0.6;
    return new Bullet(this.x, this.y, angle, true, BULLET_LIFE * 0.5);
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Body — thin jalapeño, pointing up at rest
    ctx.fillStyle   = this.colours.fill;
    ctx.strokeStyle = this.colours.stroke;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -15);                                      // pointed tip
    ctx.bezierCurveTo( 5, -10,  6,  4,  3, 12);             // right side
    ctx.bezierCurveTo( 1,  15, -1,  15, -3, 12);            // bottom round
    ctx.bezierCurveTo(-6,  4,  -5, -10,  0, -15);           // left side
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central crease
    ctx.strokeStyle = this.colours.crease;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(1, 0, 1, 6, 0, 11);
    ctx.stroke();

    // Shine highlight
    ctx.strokeStyle = this.colours.shine;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -11);
    ctx.bezierCurveTo(-4, -4, -4, 3, -2, 8);
    ctx.stroke();

    // Stem — curves from tip
    ctx.strokeStyle = this.colours.stem;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.bezierCurveTo(2, -20, 5, -22, 4, -26);
    ctx.stroke();

    ctx.restore();
  }
}
