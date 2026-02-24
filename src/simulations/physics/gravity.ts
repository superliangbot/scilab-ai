import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface FallingObject {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
  label: string;
  color: string;
  radius: number;
  active: boolean;
}

const GravityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gravity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let zoom = 1;
  let showTraces = 1;
  let showForce = 1;
  let launchSpeed = 5;

  // Earth
  let earthX = 0;
  let earthY = 0;
  const earthRadius = 60;
  const earthMass = 5.972e24; // kg
  const G_real = 6.674e-11;
  const G_sim = 2000; // simulation gravitational constant

  let objects: FallingObject[] = [];
  let launched = false;

  function initState() {
    time = 0;
    launched = false;
    earthX = width / 2;
    earthY = height / 2;

    objects = [
      {
        x: earthX,
        y: earthY - earthRadius * zoom - 40,
        vx: 0, vy: 0,
        trail: [],
        label: "Apple",
        color: "#ef4444",
        radius: 8,
        active: true,
      },
      {
        x: earthX + earthRadius * zoom + 80,
        y: earthY,
        vx: 0, vy: -launchSpeed,
        trail: [],
        label: "Moon",
        color: "#d1d5db",
        radius: 10,
        active: false,
      },
    ];
  }

  function drawBackground() {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Stars
    const rng = (s: number) => {
      let x = Math.sin(s) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 120; i++) {
      const sx = rng(i * 7.1) * width;
      const sy = rng(i * 13.3) * height;
      const sr = rng(i * 3.7) * 1 + 0.3;
      ctx.globalAlpha = 0.2 + rng(i * 11.1) * 0.4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEarth() {
    const r = earthRadius * zoom;

    // Atmosphere glow
    const glow = ctx.createRadialGradient(earthX, earthY, r, earthX, earthY, r * 1.3);
    glow.addColorStop(0, "rgba(96, 165, 250, 0.2)");
    glow.addColorStop(1, "rgba(96, 165, 250, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(earthX, earthY, r * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Earth body
    const grad = ctx.createRadialGradient(earthX - r * 0.3, earthY - r * 0.3, 0, earthX, earthY, r);
    grad.addColorStop(0, "#60a5fa");
    grad.addColorStop(0.4, "#2563eb");
    grad.addColorStop(0.7, "#1d4ed8");
    grad.addColorStop(1, "#1e3a5f");
    ctx.beginPath();
    ctx.arc(earthX, earthY, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Continents (simplified)
    ctx.fillStyle = "#22c55e88";
    // Americas
    ctx.beginPath();
    ctx.ellipse(earthX - r * 0.2, earthY - r * 0.15, r * 0.15, r * 0.25, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Eurasia
    ctx.beginPath();
    ctx.ellipse(earthX + r * 0.2, earthY - r * 0.1, r * 0.25, r * 0.15, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Africa
    ctx.beginPath();
    ctx.ellipse(earthX + r * 0.1, earthY + r * 0.2, r * 0.1, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#93c5fd";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth", earthX, earthY + r + 16);
  }

  function drawObjects() {
    for (const obj of objects) {
      if (!obj.active && !launched) continue;

      // Trail
      if (showTraces > 0.5 && obj.trail.length > 1) {
        ctx.strokeStyle = obj.color + "60";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < obj.trail.length; i++) {
          if (i === 0) ctx.moveTo(obj.trail[i].x, obj.trail[i].y);
          else ctx.lineTo(obj.trail[i].x, obj.trail[i].y);
        }
        ctx.stroke();

        // Trail dots
        for (let i = 0; i < obj.trail.length; i += 5) {
          ctx.fillStyle = obj.color + "40";
          ctx.beginPath();
          ctx.arc(obj.trail[i].x, obj.trail[i].y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Object
      const grad = ctx.createRadialGradient(
        obj.x - obj.radius * 0.3, obj.y - obj.radius * 0.3, 0,
        obj.x, obj.y, obj.radius
      );
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, obj.color);
      grad.addColorStop(1, obj.color + "88");
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Label
      ctx.fillStyle = obj.color;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(obj.label, obj.x, obj.y - obj.radius - 5);

      // Force vector
      if (showForce > 0.5) {
        const dx = earthX - obj.x;
        const dy = earthY - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > earthRadius * zoom + 5) {
          const forceMag = G_sim / (dist * dist) * 5000;
          const arrowLen = Math.min(40, forceMag);
          const nx = dx / dist;
          const ny = dy / dist;

          ctx.strokeStyle = "#ef444488";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y);
          ctx.lineTo(obj.x + nx * arrowLen, obj.y + ny * arrowLen);
          ctx.stroke();

          // Arrow head
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          const tipX = obj.x + nx * arrowLen;
          const tipY = obj.y + ny * arrowLen;
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX - ny * 4 - nx * 6, tipY + nx * 4 - ny * 6);
          ctx.lineTo(tipX + ny * 4 - nx * 6, tipY - nx * 4 - ny * 6);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Distance line
      const dx = obj.x - earthX;
      const dy = obj.y - earthY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const distInRadii = dist / (earthRadius * zoom);

      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`r = ${distInRadii.toFixed(1)} R⊕`, obj.x, obj.y + obj.radius + 14);
    }
  }

  function drawPhysicsInfo() {
    const py = height - 80;
    ctx.fillStyle = "rgba(10, 10, 26, 0.85)";
    ctx.beginPath();
    ctx.roundRect(10, py, width - 20, 70, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("F = GMm/r²  |  g = GM/r² ≈ 9.8 m/s² at surface", 20, py + 18);
    ctx.fillText("Slow throw → parabolic fall  |  Fast enough → orbit (v = √(GM/r))", 20, py + 38);
    ctx.fillText(`Launch speed: ${launchSpeed.toFixed(1)}  |  Orbital speed (surface): √(gR) ≈ 7.9 km/s`, 20, py + 58);
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Gravity — From Falling Apples to Orbits", width / 2, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("Objects fall toward Earth; with enough horizontal speed, they orbit", width / 2, 50);
  }

  return {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initState();
    },

    update(dt: number, params: Record<string, number>) {
      zoom = params.zoom ?? 1;
      showTraces = params.showTraces ?? 1;
      showForce = params.showForce ?? 1;
      const newSpeed = params.launchSpeed ?? 5;

      if (Math.abs(newSpeed - launchSpeed) > 0.1) {
        launchSpeed = newSpeed;
        initState();
        return;
      }

      time += dt;

      if (!launched) {
        launched = true;
        // Activate moon with launch speed
        objects[1].active = true;
        objects[1].x = earthX + earthRadius * zoom + 80;
        objects[1].y = earthY;
        objects[1].vx = 0;
        objects[1].vy = -launchSpeed;
      }

      // Physics for each object
      for (const obj of objects) {
        if (!obj.active) continue;

        const dx = earthX - obj.x;
        const dy = earthY - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check collision with Earth
        if (dist < earthRadius * zoom + obj.radius) {
          obj.vx = 0;
          obj.vy = 0;
          // Push to surface
          const nx = dx / dist;
          const ny = dy / dist;
          obj.x = earthX - nx * (earthRadius * zoom + obj.radius);
          obj.y = earthY - ny * (earthRadius * zoom + obj.radius);
          continue;
        }

        // Gravity
        const forceMag = G_sim / (dist * dist);
        const ax = forceMag * dx / dist;
        const ay = forceMag * dy / dist;

        obj.vx += ax * dt * 60;
        obj.vy += ay * dt * 60;
        obj.x += obj.vx * dt * 60;
        obj.y += obj.vy * dt * 60;

        // Record trail
        obj.trail.push({ x: obj.x, y: obj.y });
        if (obj.trail.length > 600) obj.trail.shift();
      }
    },

    render() {
      drawBackground();
      drawEarth();
      drawObjects();
      drawPhysicsInfo();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {
      objects = [];
    },

    getStateDescription(): string {
      const descs = objects.filter(o => o.active).map(o => {
        const dx = o.x - earthX;
        const dy = o.y - earthY;
        const dist = Math.sqrt(dx * dx + dy * dy) / (earthRadius * zoom);
        const speed = Math.sqrt(o.vx * o.vx + o.vy * o.vy);
        return `${o.label}: r=${dist.toFixed(1)}R⊕, v=${speed.toFixed(1)}`;
      });
      return `Gravity: ${descs.join(". ")}. Launch speed: ${launchSpeed.toFixed(1)}. F=GMm/r². Low speed → object falls back (parabolic). High speed → stable orbit (v=√(GM/r)). Demonstrates Newton's universal gravitation.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      earthX = width / 2;
      earthY = height / 2;
    },
  };
};

export default GravityFactory;
