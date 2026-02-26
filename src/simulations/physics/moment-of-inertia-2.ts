import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Moment of Inertia: Rolling objects down an incline.
 * Compares solid sphere, hollow sphere, solid cylinder, hollow cylinder, and disc.
 * Objects with lower I/(mR²) roll faster.
 * For rolling without slipping: a = g sin(θ) / (1 + I/(mR²))
 */
const MomentOfInertia2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("moment-of-inertia-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let inclineAngle = 30; // degrees
  let gravity = 9.81;
  let rampLength = 3; // meters
  let showFormulas = 1;

  interface RollingObject {
    name: string;
    iOverMR2: number; // I/(mR²) ratio
    color: string;
    position: number; // distance along ramp
    velocity: number;
    angle: number; // rotation angle
    finished: boolean;
  }

  let objects: RollingObject[] = [];

  function createObjects(): RollingObject[] {
    return [
      { name: "Solid Sphere", iOverMR2: 2 / 5, color: "#3b82f6", position: 0, velocity: 0, angle: 0, finished: false },
      { name: "Solid Cylinder", iOverMR2: 1 / 2, color: "#22c55e", position: 0, velocity: 0, angle: 0, finished: false },
      { name: "Hollow Sphere", iOverMR2: 2 / 3, color: "#f59e0b", position: 0, velocity: 0, angle: 0, finished: false },
      { name: "Hollow Cylinder", iOverMR2: 1, color: "#ef4444", position: 0, velocity: 0, angle: 0, finished: false },
      { name: "Thin Disc", iOverMR2: 1 / 2, color: "#a855f7", position: 0, velocity: 0, angle: 0, finished: false },
    ];
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      objects = createObjects();
    },

    update(dt: number, params: Record<string, number>) {
      inclineAngle = params.inclineAngle ?? 30;
      gravity = params.gravity ?? 9.81;
      rampLength = params.rampLength ?? 3;
      showFormulas = params.showFormulas ?? 1;

      time += dt;

      const sinTheta = Math.sin((inclineAngle * Math.PI) / 180);
      const R = 0.05; // 5cm radius

      for (const obj of objects) {
        if (obj.finished) continue;

        // a = g sin(θ) / (1 + I/(mR²))
        const accel = (gravity * sinTheta) / (1 + obj.iOverMR2);
        obj.velocity += accel * dt;
        obj.position += obj.velocity * dt;
        obj.angle += (obj.velocity / R) * dt;

        if (obj.position >= rampLength) {
          obj.position = rampLength;
          obj.finished = true;
        }
      }
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Moment of Inertia — Rolling Down an Incline", W / 2, 28);

      const angleRad = (inclineAngle * Math.PI) / 180;

      // Ramp geometry
      const rampStartX = W * 0.12;
      const rampStartY = H * 0.18;
      const rampPixelLen = W * 0.55;
      const rampEndX = rampStartX + rampPixelLen * Math.cos(angleRad);
      const rampEndY = rampStartY + rampPixelLen * Math.sin(angleRad);

      // Draw ramp
      ctx.beginPath();
      ctx.moveTo(rampStartX, rampStartY);
      ctx.lineTo(rampEndX, rampEndY);
      ctx.lineTo(rampEndX, rampStartY);
      ctx.closePath();
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ramp surface
      ctx.beginPath();
      ctx.moveTo(rampStartX, rampStartY);
      ctx.lineTo(rampEndX, rampEndY);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Angle arc
      ctx.beginPath();
      ctx.arc(rampEndX, rampEndY, 40, -Math.PI, -Math.PI + angleRad);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText(`${inclineAngle}°`, rampEndX - 55, rampEndY - 5);

      // Draw rolling objects on ramp
      const objRadius = 14;
      const laneSpacing = objRadius * 2.5;
      const normalX = -Math.sin(angleRad);
      const normalY = Math.cos(angleRad);

      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const frac = obj.position / rampLength;

        // Position along ramp
        const cx = rampStartX + frac * (rampEndX - rampStartX) + normalX * (objRadius + i * laneSpacing);
        const cy = rampStartY + frac * (rampEndY - rampStartY) - normalY * (objRadius + i * laneSpacing);

        // Draw object
        ctx.beginPath();
        ctx.arc(cx, cy, objRadius, 0, Math.PI * 2);
        ctx.fillStyle = obj.color + "40";
        ctx.fill();
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rotation indicator (line on the ball)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + objRadius * 0.8 * Math.cos(obj.angle),
          cy + objRadius * 0.8 * Math.sin(obj.angle)
        );
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Small dot at center
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fillStyle = obj.color;
        ctx.fill();
      }

      // Legend / ranking panel
      const panelX = W * 0.72;
      const panelY = 50;
      const panelW = W * 0.25;

      ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, objects.length * 40 + 50, 8);
      ctx.fill();

      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Objects (fastest → slowest)", panelX + 10, panelY + 20);

      // Sort by position (furthest = fastest)
      const sorted = [...objects].sort((a, b) => b.position - a.position);

      for (let i = 0; i < sorted.length; i++) {
        const obj = sorted[i];
        const y = panelY + 40 + i * 38;

        // Position indicator bar
        const barW = (obj.position / rampLength) * (panelW - 70);
        ctx.fillStyle = obj.color + "40";
        ctx.beginPath();
        ctx.roundRect(panelX + 10, y - 5, barW, 16, 3);
        ctx.fill();

        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = obj.color;
        ctx.textAlign = "left";
        ctx.fillText(`${i + 1}. ${obj.name}`, panelX + 10, y + 7);

        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "right";
        ctx.fillText(`I = ${obj.iOverMR2 === 1 ? "1" : obj.iOverMR2.toFixed(3)}mR²`, panelX + panelW - 10, y + 7);

        ctx.fillStyle = "#64748b";
        ctx.fillText(`v = ${obj.velocity.toFixed(2)} m/s`, panelX + panelW - 10, y + 22);
      }

      // Formula panel
      if (showFormulas) {
        const fY = H - 100;
        ctx.font = "13px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "left";

        ctx.fillStyle = "#38bdf8";
        ctx.fillText("a = g sin(θ) / (1 + I/mR²)", 16, fY);
        ctx.fillStyle = "#22c55e";
        ctx.fillText("v = √(2gh / (1 + I/mR²))", 16, fY + 20);

        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Lower I/mR² ⟹ faster acceleration ⟹ reaches bottom first", 16, fY + 45);

        ctx.textAlign = "right";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("Solid sphere (2/5) wins", W - 16, fY);
        ctx.fillStyle = "#ef4444";
        ctx.fillText("Hollow cylinder (1) loses", W - 16, fY + 20);
      }

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("t = " + time.toFixed(2) + "s  |  Objects with smaller I/(mR²) convert more PE to translational KE", W / 2, H - 10);
    },

    reset() {
      time = 0;
      objects = createObjects();
    },

    destroy() {},

    getStateDescription(): string {
      const sorted = [...objects].sort((a, b) => b.position - a.position);
      const ranking = sorted.map((o, i) => `${i + 1}.${o.name}(v=${o.velocity.toFixed(2)}m/s)`).join(", ");
      return (
        `Moment of Inertia rolling race: incline ${inclineAngle}°, g=${gravity}m/s², ramp=${rampLength}m, t=${time.toFixed(2)}s. ` +
        `a = g sin(θ)/(1+I/mR²). Ranking: ${ranking}. ` +
        `Lower I/mR² means faster rolling.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MomentOfInertia2Factory;
