import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ClayShootingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("clay-shooting") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let gravity = 9.81; // m/s^2 (scaled to px)
  let bulletSpeed = 500; // px/s
  let targetSpeed = 150; // px/s
  let windSpeed = 0; // px/s

  // Cannon state
  let cannonAngle = 45; // degrees, oscillates
  let cannonOscillationSpeed = 30; // degrees per second
  const cannonX = 80;
  let cannonY = 0; // set on init

  // Bullets
  interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    trail: Array<{ x: number; y: number }>;
    active: boolean;
    age: number;
  }
  const bullets: Bullet[] = [];

  // Clay targets
  interface ClayTarget {
    x: number;
    y: number;
    vx: number;
    vy: number;
    active: boolean;
    radius: number;
  }
  const targets: ClayTarget[] = [];

  // Explosions
  interface Explosion {
    x: number;
    y: number;
    age: number;
    maxAge: number;
    particles: Array<{ dx: number; dy: number; speed: number; color: string }>;
  }
  const explosions: Explosion[] = [];

  // Game state
  let score = 0;
  let shotsFired = 0;
  let targetSpawnTimer = 0;
  let targetSpawnInterval = 2.0; // seconds
  let mouseDown = false;
  let canFire = true;
  let fireDelay = 0;

  // Event handlers (stored for cleanup)
  let handleMouseDown: ((e: MouseEvent) => void) | null = null;
  let handleMouseUp: ((e: MouseEvent) => void) | null = null;
  let handleTouchStart: ((e: TouchEvent) => void) | null = null;
  let handleTouchEnd: ((e: TouchEvent) => void) | null = null;

  function getGroundY(): number {
    return height * 0.85;
  }

  function fire(): void {
    if (!canFire) return;

    const angleRad = (cannonAngle * Math.PI) / 180;
    const barrelLen = 40;
    const startX = cannonX + Math.cos(angleRad) * barrelLen;
    const startY = cannonY - Math.sin(angleRad) * barrelLen;

    const bullet: Bullet = {
      x: startX,
      y: startY,
      vx: bulletSpeed * Math.cos(angleRad),
      vy: -bulletSpeed * Math.sin(angleRad),
      trail: [{ x: startX, y: startY }],
      active: true,
      age: 0,
    };

    bullets.push(bullet);
    shotsFired++;
    canFire = false;
    fireDelay = 0.3; // seconds between shots
  }

  function spawnTarget(): void {
    // Targets launch from right side or left side randomly
    const fromRight = Math.random() > 0.4;
    const launchX = fromRight ? width + 10 : -10;
    const launchY = getGroundY() - Math.random() * height * 0.2;

    // Launch angle upward and across
    const angleRange = 20 + Math.random() * 40; // 20-60 degrees upward
    const angleRad = (angleRange * Math.PI) / 180;

    const speed = targetSpeed * (0.8 + Math.random() * 0.4);
    const dir = fromRight ? -1 : 1;

    const target: ClayTarget = {
      x: launchX,
      y: launchY,
      vx: dir * speed * Math.cos(angleRad),
      vy: -speed * Math.sin(angleRad),
      active: true,
      radius: 12,
    };

    targets.push(target);
  }

  function createExplosion(x: number, y: number): void {
    const particles: Explosion["particles"] = [];
    const numParticles = 12 + Math.floor(Math.random() * 8);
    const colors = ["#ff6b35", "#ffa500", "#ffcc00", "#ff4444", "#ff8800"];

    for (let i = 0; i < numParticles; i++) {
      const angle = (Math.PI * 2 * i) / numParticles + (Math.random() - 0.5) * 0.5;
      particles.push({
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        speed: 30 + Math.random() * 60,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    explosions.push({
      x,
      y,
      age: 0,
      maxAge: 0.6,
      particles,
    });
  }

  function checkCollisions(): void {
    for (const bullet of bullets) {
      if (!bullet.active) continue;

      for (const target of targets) {
        if (!target.active) continue;

        const dx = bullet.x - target.x;
        const dy = bullet.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < target.radius + 4) {
          // Hit!
          bullet.active = false;
          target.active = false;
          score++;
          createExplosion(target.x, target.y);
        }
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    cannonY = getGroundY();
    time = 0;
    score = 0;
    shotsFired = 0;
    bullets.length = 0;
    targets.length = 0;
    explosions.length = 0;
    targetSpawnTimer = 0;
    canFire = true;
    fireDelay = 0;

    // Set up click/touch handlers
    handleMouseDown = (_e: MouseEvent) => {
      mouseDown = true;
      fire();
    };
    handleMouseUp = () => {
      mouseDown = false;
    };
    handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      mouseDown = true;
      fire();
    };
    handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      mouseDown = false;
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
  }

  function update(dt: number, params: Record<string, number>): void {
    gravity = params.gravity ?? 9.81;
    bulletSpeed = params.bulletSpeed ?? 500;
    targetSpeed = params.targetSpeed ?? 150;
    windSpeed = params.windSpeed ?? 0;

    time += dt;

    // Oscillate cannon angle (30 to 80 degrees)
    cannonAngle = 55 + 25 * Math.sin(time * cannonOscillationSpeed * (Math.PI / 180) * 2);
    cannonY = getGroundY();

    // Fire delay cooldown
    if (!canFire) {
      fireDelay -= dt;
      if (fireDelay <= 0) {
        canFire = true;
      }
    }

    // Spawn targets
    targetSpawnTimer += dt;
    if (targetSpawnTimer >= targetSpawnInterval) {
      targetSpawnTimer -= targetSpawnInterval;
      spawnTarget();
    }

    // Gravity scale: convert m/s^2 to px/s^2 (use a multiplier for visual appeal)
    const gravityPx = gravity * 40;

    // Update bullets
    for (const bullet of bullets) {
      if (!bullet.active) continue;

      bullet.vy += gravityPx * dt;
      bullet.vx += windSpeed * dt * 0.5;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.age += dt;

      // Record trail (limit length)
      bullet.trail.push({ x: bullet.x, y: bullet.y });
      if (bullet.trail.length > 60) bullet.trail.shift();

      // Remove if off screen or too old
      if (bullet.x < -50 || bullet.x > width + 50 || bullet.y > height + 50 || bullet.age > 8) {
        bullet.active = false;
      }
    }

    // Update targets
    for (const target of targets) {
      if (!target.active) continue;

      target.vy += gravityPx * dt;
      target.vx += windSpeed * dt * 0.3;
      target.x += target.vx * dt;
      target.y += target.vy * dt;

      // Remove if off screen
      if (target.x < -50 || target.x > width + 50 || target.y > height + 50) {
        target.active = false;
      }
    }

    // Update explosions
    for (const exp of explosions) {
      exp.age += dt;
    }

    // Check collisions
    checkCollisions();

    // Clean up inactive objects
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!bullets[i].active) bullets.splice(i, 1);
    }
    for (let i = targets.length - 1; i >= 0; i--) {
      if (!targets[i].active) targets.splice(i, 1);
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
      if (explosions[i].age >= explosions[i].maxAge) explosions.splice(i, 1);
    }
  }

  function drawBackground(): void {
    // Sky gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.3, "#0d1530");
    bgGrad.addColorStop(0.6, "#142040");
    bgGrad.addColorStop(0.85, "#1a3020");
    bgGrad.addColorStop(1, "#0f1f10");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    ctx.save();
    const starSeed = 42;
    for (let i = 0; i < 50; i++) {
      const sx = ((starSeed * (i + 1) * 7919) % width);
      const sy = ((starSeed * (i + 1) * 104729) % (height * 0.5));
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 2 + i));
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.6})`;
      ctx.fill();
    }
    ctx.restore();

    // Ground
    const groundY = getGroundY();
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
    groundGrad.addColorStop(0, "#2d5016");
    groundGrad.addColorStop(0.3, "#1e3a0e");
    groundGrad.addColorStop(1, "#0f1f05");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Ground line
    ctx.strokeStyle = "rgba(100, 200, 80, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();
  }

  function drawCannon(): void {
    const angleRad = (cannonAngle * Math.PI) / 180;
    const barrelLen = 40;

    ctx.save();

    // Cannon base (wheels)
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.arc(cannonX - 12, cannonY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cannonX + 12, cannonY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cannonX - 12, cannonY, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cannonX + 12, cannonY, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#555";
    for (const wx of [cannonX - 12, cannonX + 12]) {
      for (let a = 0; a < 4; a++) {
        const sa = (a * Math.PI) / 2 + time * 0.5;
        ctx.beginPath();
        ctx.moveTo(wx, cannonY);
        ctx.lineTo(wx + Math.cos(sa) * 8, cannonY + Math.sin(sa) * 8);
        ctx.stroke();
      }
    }

    // Cannon barrel
    ctx.translate(cannonX, cannonY);
    ctx.rotate(-angleRad);

    const barrelGrad = ctx.createLinearGradient(0, -6, 0, 6);
    barrelGrad.addColorStop(0, "#666");
    barrelGrad.addColorStop(0.5, "#888");
    barrelGrad.addColorStop(1, "#555");
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(0, -6, barrelLen, 12);

    // Barrel rim
    ctx.fillStyle = "#777";
    ctx.fillRect(barrelLen - 4, -8, 4, 16);

    // Barrel opening
    ctx.fillStyle = "#222";
    ctx.fillRect(barrelLen, -4, 2, 8);

    ctx.restore();

    // Cannon pivot
    ctx.beginPath();
    ctx.arc(cannonX, cannonY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#555";
    ctx.fill();
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Angle indicator arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cannonX, cannonY, 30, -angleRad, 0);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${cannonAngle.toFixed(0)}\u00B0`, cannonX + 34, cannonY - 8);
    ctx.restore();

    // "Click to fire" hint
    if (canFire) {
      const hintAlpha = 0.4 + 0.3 * Math.sin(time * 4);
      ctx.fillStyle = `rgba(255, 255, 255, ${hintAlpha})`;
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Click to fire!", cannonX, cannonY + 30);
    }
  }

  function drawBullets(): void {
    ctx.save();

    for (const bullet of bullets) {
      if (!bullet.active) continue;

      // Trail
      if (bullet.trail.length > 1) {
        for (let i = 1; i < bullet.trail.length; i++) {
          const alpha = (i / bullet.trail.length) * 0.6;
          const r = (i / bullet.trail.length) * 2;
          ctx.beginPath();
          ctx.arc(bullet.trail[i].x, bullet.trail[i].y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
          ctx.fill();
        }

        // Trail line
        ctx.beginPath();
        ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
        for (let i = 1; i < bullet.trail.length; i++) {
          ctx.lineTo(bullet.trail[i].x, bullet.trail[i].y);
        }
        ctx.strokeStyle = "rgba(255, 200, 50, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Bullet glow
      const glow = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, 12);
      glow.addColorStop(0, "rgba(255, 220, 100, 0.6)");
      glow.addColorStop(1, "rgba(255, 220, 100, 0)");
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Bullet
      const bGrad = ctx.createRadialGradient(bullet.x - 1, bullet.y - 1, 0, bullet.x, bullet.y, 4);
      bGrad.addColorStop(0, "#ffffaa");
      bGrad.addColorStop(0.5, "#ffcc00");
      bGrad.addColorStop(1, "#cc8800");
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = bGrad;
      ctx.fill();
    }

    ctx.restore();
  }

  function drawTargets(): void {
    ctx.save();

    for (const target of targets) {
      if (!target.active) continue;

      // Clay pigeon - orange disc shape
      const r = target.radius;

      // Shadow/glow
      const glow = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, r + 6);
      glow.addColorStop(0, "rgba(255, 100, 50, 0.2)");
      glow.addColorStop(1, "rgba(255, 100, 50, 0)");
      ctx.beginPath();
      ctx.arc(target.x, target.y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Clay disc
      const discGrad = ctx.createRadialGradient(target.x - 2, target.y - 2, 0, target.x, target.y, r);
      discGrad.addColorStop(0, "#ff8844");
      discGrad.addColorStop(0.6, "#cc5522");
      discGrad.addColorStop(1, "#993311");
      ctx.beginPath();
      ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
      ctx.fillStyle = discGrad;
      ctx.fill();

      // Disc edge
      ctx.strokeStyle = "rgba(255, 200, 150, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(target.x, target.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffaa66";
      ctx.fill();
    }

    ctx.restore();
  }

  function drawExplosions(): void {
    ctx.save();

    for (const exp of explosions) {
      const progress = exp.age / exp.maxAge;

      for (const p of exp.particles) {
        const px = exp.x + p.dx * p.speed * progress;
        const py = exp.y + p.dy * p.speed * progress;
        const alpha = 1 - progress;
        const radius = 2 + progress * 3;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(")", `, ${alpha})`).replace("rgb", "rgba");

        // Parse hex color and apply alpha
        const r = parseInt(p.color.slice(1, 3), 16);
        const g = parseInt(p.color.slice(3, 5), 16);
        const b = parseInt(p.color.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }

      // Central flash
      if (progress < 0.3) {
        const flashAlpha = (1 - progress / 0.3) * 0.8;
        const flashR = 15 + progress * 30;
        const flash = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, flashR);
        flash.addColorStop(0, `rgba(255, 255, 200, ${flashAlpha})`);
        flash.addColorStop(0.5, `rgba(255, 200, 50, ${flashAlpha * 0.5})`);
        flash.addColorStop(1, `rgba(255, 100, 0, 0)`);
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, flashR, 0, Math.PI * 2);
        ctx.fillStyle = flash;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawWindIndicator(): void {
    if (Math.abs(windSpeed) < 0.5) return;

    ctx.save();
    const indX = width / 2;
    const indY = 50;

    // Wind arrow
    const arrowLen = Math.min(Math.abs(windSpeed) * 0.8, 60);
    const dir = windSpeed > 0 ? 1 : -1;

    ctx.strokeStyle = "rgba(150, 200, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(indX - dir * arrowLen / 2, indY);
    ctx.lineTo(indX + dir * arrowLen / 2, indY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(indX + dir * arrowLen / 2, indY);
    ctx.lineTo(indX + dir * arrowLen / 2 - dir * 8, indY - 5);
    ctx.moveTo(indX + dir * arrowLen / 2, indY);
    ctx.lineTo(indX + dir * arrowLen / 2 - dir * 8, indY + 5);
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(150, 200, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Wind: ${windSpeed.toFixed(0)} px/s`, indX, indY - 12);

    ctx.restore();
  }

  function drawPhysicsAnnotations(): void {
    ctx.save();

    // Show velocity decomposition on the first active bullet
    const activeBullet = bullets.find(b => b.active);
    if (activeBullet) {
      const bx = activeBullet.x;
      const by = activeBullet.y;

      // Velocity vector
      const vecScale = 0.06;
      const vxDraw = activeBullet.vx * vecScale;
      const vyDraw = activeBullet.vy * vecScale;

      // Total velocity
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + vxDraw, by + vyDraw);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(vyDraw, vxDraw);
      ctx.beginPath();
      ctx.moveTo(bx + vxDraw, by + vyDraw);
      ctx.lineTo(bx + vxDraw - 8 * Math.cos(angle - 0.4), by + vyDraw - 8 * Math.sin(angle - 0.4));
      ctx.moveTo(bx + vxDraw, by + vyDraw);
      ctx.lineTo(bx + vxDraw - 8 * Math.cos(angle + 0.4), by + vyDraw - 8 * Math.sin(angle + 0.4));
      ctx.stroke();

      // Horizontal component (v_x = constant)
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + vxDraw, by);
      ctx.stroke();

      // Vertical component (v_y changes with gravity)
      ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
      ctx.beginPath();
      ctx.moveTo(bx + vxDraw, by);
      ctx.lineTo(bx + vxDraw, by + vyDraw);
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
      ctx.fillText(`v_x = ${Math.abs(activeBullet.vx).toFixed(0)}`, bx + vxDraw / 2 - 15, by - 8);

      ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
      ctx.fillText(`v_y = ${Math.abs(activeBullet.vy).toFixed(0)}`, bx + vxDraw + 5, by + vyDraw / 2);

      const speed = Math.sqrt(activeBullet.vx ** 2 + activeBullet.vy ** 2);
      ctx.fillStyle = "rgba(59, 130, 246, 0.8)";
      ctx.fillText(`|v| = ${speed.toFixed(0)}`, bx + vxDraw + 5, by + vyDraw - 5);
    }

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 220;
    const panelH = 140;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Clay Shooting", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 40);
    ctx.fillText(`Gravity: ${gravity.toFixed(1)} m/s\u00B2`, panelX + 10, panelY + 56);
    ctx.fillText(`Bullet speed: ${bulletSpeed} px/s`, panelX + 10, panelY + 72);
    ctx.fillText(`Target speed: ${targetSpeed} px/s`, panelX + 10, panelY + 88);

    if (Math.abs(windSpeed) > 0.5) {
      ctx.fillText(`Wind: ${windSpeed.toFixed(0)} px/s`, panelX + 10, panelY + 104);
    }

    // Physics note
    ctx.fillStyle = "rgba(200, 200, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("x(t) = v\u2080cos\u03B8\u00B7t", panelX + 10, panelY + 120);
    ctx.fillText("y(t) = v\u2080sin\u03B8\u00B7t - \u00BDgt\u00B2", panelX + 10, panelY + 134);

    ctx.restore();
  }

  function drawScorePanel(): void {
    ctx.save();
    const panelW = 150;
    const panelH = 70;
    const panelX = width - panelW - 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    // Score
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${score}`, panelX + 10, panelY + 22);

    // Shots fired
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Shots: ${shotsFired}`, panelX + 10, panelY + 42);

    // Accuracy
    const accuracy = shotsFired > 0 ? ((score / shotsFired) * 100).toFixed(0) : "0";
    ctx.fillText(`Accuracy: ${accuracy}%`, panelX + 10, panelY + 58);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawWindIndicator();
    drawCannon();
    drawTargets();
    drawBullets();
    drawExplosions();
    drawPhysicsAnnotations();
    drawInfoPanel();
    drawScorePanel();
  }

  function reset(): void {
    time = 0;
    score = 0;
    shotsFired = 0;
    bullets.length = 0;
    targets.length = 0;
    explosions.length = 0;
    targetSpawnTimer = 0;
    canFire = true;
    fireDelay = 0;
  }

  function destroy(): void {
    if (canvas && handleMouseDown) {
      canvas.removeEventListener("mousedown", handleMouseDown);
    }
    if (canvas && handleMouseUp) {
      canvas.removeEventListener("mouseup", handleMouseUp);
    }
    if (canvas && handleTouchStart) {
      canvas.removeEventListener("touchstart", handleTouchStart);
    }
    if (canvas && handleTouchEnd) {
      canvas.removeEventListener("touchend", handleTouchEnd);
    }
    handleMouseDown = null;
    handleMouseUp = null;
    handleTouchStart = null;
    handleTouchEnd = null;
    bullets.length = 0;
    targets.length = 0;
    explosions.length = 0;
  }

  function getStateDescription(): string {
    const accuracy = shotsFired > 0 ? ((score / shotsFired) * 100).toFixed(0) : "0";
    return (
      `Clay Shooting: Projectile motion demonstration. ` +
      `Gravity: ${gravity} m/s^2, bullet speed: ${bulletSpeed} px/s, target speed: ${targetSpeed} px/s. ` +
      `Wind: ${windSpeed} px/s. Cannon angle: ${cannonAngle.toFixed(0)} deg. ` +
      `Score: ${score}/${shotsFired} (${accuracy}% accuracy). ` +
      `Active bullets: ${bullets.length}, active targets: ${targets.length}. ` +
      `Horizontal motion: x = v0*cos(theta)*t (constant velocity). ` +
      `Vertical motion: y = v0*sin(theta)*t - 0.5*g*t^2 (gravity acceleration). ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    cannonY = getGroundY();
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default ClayShootingFactory;
