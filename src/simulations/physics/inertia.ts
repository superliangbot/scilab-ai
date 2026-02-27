import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const InertiaFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("inertia") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let mass1 = 1; // kg
  let mass2 = 5; // kg
  let springK = 20; // N/m
  let drivingFreq = 2; // Hz
  let damping = 0.1;

  // State for each mass
  let y1 = 0;
  let vy1 = 0;
  let y2 = 0;
  let vy2 = 0;
  let handY = 0;

  const trail1: number[] = [];
  const trail2: number[] = [];
  const maxTrail = 200;

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      engine.reset();
    },
    update(dt: number, params: Record<string, number>) {
      mass1 = params.mass1 ?? 1;
      mass2 = params.mass2 ?? 5;
      springK = params.springK ?? 20;
      drivingFreq = params.drivingFreq ?? 2;
      damping = params.damping ?? 0.1;

      time += dt;

      // Driving oscillation
      handY = 60 * Math.sin(2 * Math.PI * drivingFreq * time);

      // Spring forces on mass 1
      const springForce1 = -springK * (y1 - handY) - damping * vy1;
      const a1 = springForce1 / mass1;
      vy1 += a1 * dt;
      y1 += vy1 * dt;

      // Spring forces on mass 2
      const springForce2 = -springK * (y2 - handY) - damping * vy2;
      const a2 = springForce2 / mass2;
      vy2 += a2 * dt;
      y2 += vy2 * dt;

      trail1.push(y1);
      trail2.push(y2);
      if (trail1.length > maxTrail) trail1.shift();
      if (trail2.length > maxTrail) trail2.shift();
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Inertia — Resistance to Change in Motion", width / 2, 25);

      const baseY = height * 0.45;
      const leftX = width * 0.3;
      const rightX = width * 0.7;

      // Draw hands
      const drawHand = (hx: number, hy: number) => {
        ctx.save();
        ctx.fillStyle = "#e8b88a";
        ctx.beginPath();
        ctx.ellipse(hx, hy, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c49070";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Fingers
        for (let i = -1; i <= 1; i++) {
          ctx.fillStyle = "#e8b88a";
          ctx.beginPath();
          ctx.ellipse(hx + i * 8, hy - 14, 4, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      };

      // Draw spring
      const drawSpring = (sx: number, sy1: number, sy2: number) => {
        ctx.save();
        ctx.strokeStyle = "#78909c";
        ctx.lineWidth = 2;
        const coils = 8;
        const amp = 8;
        const len = sy2 - sy1;
        ctx.beginPath();
        ctx.moveTo(sx, sy1);
        for (let i = 0; i <= coils; i++) {
          const t = i / coils;
          const py = sy1 + t * len;
          const px = sx + (i % 2 === 0 ? -amp : amp);
          if (i === 0 || i === coils) ctx.lineTo(sx, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      };

      // Draw mass
      const drawMass = (mx: number, my: number, m: number, color: string, label: string) => {
        const radius = 15 + m * 3;
        ctx.save();

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.arc(mx + 3, my + 3, radius, 0, Math.PI * 2);
        ctx.fill();

        // Mass body
        const grad = ctx.createRadialGradient(mx - radius * 0.3, my - radius * 0.3, 0, mx, my, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "#333");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${m.toFixed(1)}kg`, mx, my);
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = "#aaa";
        ctx.font = "11px sans-serif";
        ctx.fillText(label, mx, my + radius + 18);
        ctx.restore();
      };

      // Left side: mass 1 (light)
      const hand1Y = baseY + handY * 0.5;
      drawHand(leftX, hand1Y - 50);
      drawSpring(leftX, hand1Y - 38, baseY + y1 * 0.5 - 15 - mass1 * 3);
      drawMass(leftX, baseY + y1 * 0.5, mass1, "#ef5350", "Light Mass");

      // Right side: mass 2 (heavy)
      const hand2Y = baseY + handY * 0.5;
      drawHand(rightX, hand2Y - 50);
      drawSpring(rightX, hand2Y - 38, baseY + y2 * 0.5 - 15 - mass2 * 3);
      drawMass(rightX, baseY + y2 * 0.5, mass2, "#42a5f5", "Heavy Mass");

      // Amplitude comparison graph
      const graphY = height * 0.72;
      const graphH = height * 0.22;
      const graphW = width * 0.8;
      const graphX = width * 0.1;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(graphX, graphY, graphW, graphH);
      ctx.strokeStyle = "#555";
      ctx.strokeRect(graphX, graphY, graphW, graphH);

      // Zero line
      ctx.strokeStyle = "#555";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(graphX, graphY + graphH / 2);
      ctx.lineTo(graphX + graphW, graphY + graphH / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const maxVal = 80;

      // Trail 1
      if (trail1.length > 1) {
        ctx.strokeStyle = "#ef5350";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < trail1.length; i++) {
          const x = graphX + (i / maxTrail) * graphW;
          const y = graphY + graphH / 2 - (trail1[i] / maxVal) * (graphH / 2 - 5);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Trail 2
      if (trail2.length > 1) {
        ctx.strokeStyle = "#42a5f5";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < trail2.length; i++) {
          const x = graphX + (i / maxTrail) * graphW;
          const y = graphY + graphH / 2 - (trail2[i] / maxVal) * (graphH / 2 - 5);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.fillStyle = "#ef5350";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`■ Light (${mass1.toFixed(1)}kg)`, graphX + 5, graphY + 14);
      ctx.fillStyle = "#42a5f5";
      ctx.fillText(`■ Heavy (${mass2.toFixed(1)}kg)`, graphX + 120, graphY + 14);
      ctx.fillStyle = "#ccc";
      ctx.textAlign = "center";
      ctx.fillText("Displacement over time", graphX + graphW / 2, graphY + 14);

      // Explanation
      ctx.fillStyle = "#aaa";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Greater mass → greater inertia → smaller response to same driving force", width / 2, height - 8);
    },
    reset() {
      time = 0;
      y1 = 0;
      vy1 = 0;
      y2 = 0;
      vy2 = 0;
      handY = 0;
      trail1.length = 0;
      trail2.length = 0;
    },
    destroy() {},
    getStateDescription(): string {
      const amp1 = trail1.length > 0 ? Math.max(...trail1.map(Math.abs)) : 0;
      const amp2 = trail2.length > 0 ? Math.max(...trail2.map(Math.abs)) : 0;
      return `Inertia demonstration: Two masses (${mass1}kg and ${mass2}kg) on springs driven at ${drivingFreq}Hz. Light mass amplitude≈${amp1.toFixed(1)}, heavy mass amplitude≈${amp2.toFixed(1)}. The heavier mass has greater inertia and resists the driving force more, oscillating with smaller amplitude.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default InertiaFactory;
