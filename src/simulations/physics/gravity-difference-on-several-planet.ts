import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const GravityDifferenceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gravity-difference-on-several-planet") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let mass = 10;
  let dropTime = 0;
  let isDropping = false;

  interface Planet {
    name: string;
    gravity: number;
    color: string;
    radius: number;
    ballY: number;
    landed: boolean;
  }

  const planets: Planet[] = [
    { name: "Mercury", gravity: 3.7, color: "#a0a0a0", radius: 0.38, ballY: 0, landed: false },
    { name: "Venus", gravity: 8.87, color: "#e8cda0", radius: 0.95, ballY: 0, landed: false },
    { name: "Earth", gravity: 9.81, color: "#4a90d9", radius: 1.0, ballY: 0, landed: false },
    { name: "Mars", gravity: 3.71, color: "#c1440e", radius: 0.53, ballY: 0, landed: false },
    { name: "Jupiter", gravity: 24.79, color: "#c88b3a", radius: 2.0, ballY: 0, landed: false },
    { name: "Saturn", gravity: 10.44, color: "#e8d5a3", radius: 1.7, ballY: 0, landed: false },
    { name: "Uranus", gravity: 8.87, color: "#7ec8e3", radius: 1.3, ballY: 0, landed: false },
    { name: "Neptune", gravity: 11.15, color: "#3f54ba", radius: 1.25, ballY: 0, landed: false },
  ];

  const DROP_HEIGHT = 100; // meters

  function resetDrop() {
    dropTime = 0;
    isDropping = true;
    for (const p of planets) {
      p.ballY = 0;
      p.landed = false;
    }
  }

  function drawPlanet(p: Planet, cx: number, baseY: number, colW: number) {
    const planetRadius = Math.min(colW * 0.3, 30) * p.radius;
    const surfaceY = baseY;
    const topY = surfaceY - height * 0.55;
    const dropRange = surfaceY - topY - 20;

    // Draw planet circle
    const grad = ctx.createRadialGradient(cx - planetRadius * 0.3, surfaceY - planetRadius * 0.3, planetRadius * 0.1, cx, surfaceY, planetRadius * 1.5);
    grad.addColorStop(0, p.color);
    grad.addColorStop(1, "#111");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, surfaceY, planetRadius, Math.PI, 0);
    ctx.fill();

    // Surface line
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - colW * 0.4, surfaceY);
    ctx.lineTo(cx + colW * 0.4, surfaceY);
    ctx.stroke();

    // Ball position
    const frac = Math.min(p.ballY / DROP_HEIGHT, 1);
    const ballScreenY = topY + frac * dropRange;

    // Draw ball
    ctx.fillStyle = "#ff6b6b";
    ctx.shadowColor = "#ff6b6b";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, ballScreenY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Weight text
    const weight = mass * p.gravity;
    ctx.fillStyle = "#e0e0e0";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${weight.toFixed(1)} N`, cx, surfaceY + planetRadius + 20);

    // Planet name
    ctx.fillStyle = p.color;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(p.name, cx, surfaceY + planetRadius + 38);

    // Gravity value
    ctx.fillStyle = "#888";
    ctx.font = "10px monospace";
    ctx.fillText(`g=${p.gravity} m/s²`, cx, surfaceY + planetRadius + 52);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      resetDrop();
    },

    update(dt: number, params: Record<string, number>) {
      const newMass = params.mass ?? 10;
      const dropHeight = params.dropHeight ?? 100;
      if (newMass !== mass) {
        mass = newMass;
      }

      if (isDropping) {
        dropTime += dt;
        let allLanded = true;
        for (const p of planets) {
          if (!p.landed) {
            p.ballY = 0.5 * p.gravity * dropTime * dropTime;
            if (p.ballY >= dropHeight) {
              p.ballY = dropHeight;
              p.landed = true;
            } else {
              allLanded = false;
            }
          }
        }
        if (allLanded) {
          isDropping = false;
        }
      }

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Gravity on Different Planets", width / 2, 28);

      // Mass info
      ctx.fillStyle = "#aaa";
      ctx.font = "13px monospace";
      ctx.fillText(`Mass: ${mass.toFixed(1)} kg  |  Drop height: ${DROP_HEIGHT} m`, width / 2, 50);

      const margin = 20;
      const colW = (width - margin * 2) / planets.length;
      const baseY = height - 80;

      for (let i = 0; i < planets.length; i++) {
        const cx = margin + colW * i + colW / 2;
        drawPlanet(planets[i], cx, baseY, colW);
      }

      // Scale bar
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const topLine = baseY - height * 0.55;
      ctx.beginPath();
      ctx.moveTo(margin, topLine);
      ctx.lineTo(width - margin, topLine);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#666";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Start", margin, topLine - 4);

      // Auto-restart indicator
      if (!isDropping) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        ctx.fillStyle = `rgba(100,200,255,${pulse * 0.8})`;
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Adjust mass to restart drop", width / 2, height - 15);
      }
    },

    reset() {
      time = 0;
      resetDrop();
    },

    destroy() {},

    getStateDescription() {
      const descriptions = planets.map((p) => {
        const w = (mass * p.gravity).toFixed(1);
        return `${p.name}: g=${p.gravity} m/s², weight=${w} N`;
      });
      return `Gravity comparison for ${mass.toFixed(1)} kg object. ${descriptions.join(". ")}. Drop time=${dropTime.toFixed(2)}s.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default GravityDifferenceFactory;
