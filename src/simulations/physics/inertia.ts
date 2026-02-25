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
  let oscFrequency = 1.5; // Hz of the hand
  let oscAmplitude = 60; // pixels of hand displacement

  // State
  let handY = 0; // oscillating hand displacement
  let block1Y = 0; // block 1 displacement
  let block1Vy = 0;
  let block2Y = 0;
  let block2Vy = 0;
  const springK = 200; // spring constant N/m
  const damping = 0.5;

  // Trail for showing motion history
  let trail1: number[] = [];
  let trail2: number[] = [];
  const trailLen = 120;

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      this.reset();
    },
    update(dt: number, params: Record<string, number>) {
      mass1 = params.mass1 ?? 1;
      mass2 = params.mass2 ?? 5;
      oscFrequency = params.oscFrequency ?? 1.5;
      oscAmplitude = params.oscAmplitude ?? 60;

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      // Hand oscillates sinusoidally
      handY = oscAmplitude * Math.sin(2 * Math.PI * oscFrequency * time);

      // Spring force on block1: F = -k * (block1Y - handY) - damping * v
      const f1 = -springK * (block1Y - handY) - damping * block1Vy;
      const a1 = f1 / mass1;
      block1Vy += a1 * dtClamped;
      block1Y += block1Vy * dtClamped;

      // Spring force on block2
      const f2 = -springK * (block2Y - handY) - damping * block2Vy;
      const a2 = f2 / mass2;
      block2Vy += a2 * dtClamped;
      block2Y += block2Vy * dtClamped;

      // Record trails
      trail1.push(block1Y);
      trail2.push(block2Y);
      if (trail1.length > trailLen) trail1.shift();
      if (trail2.length > trailLen) trail2.shift();
    },
    render() {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      const halfW = width / 2;
      const baseY = height * 0.5;
      const handDrawY = baseY + handY;

      // Title
      ctx.fillStyle = "#1e293b";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Inertia: Resistance to Change in Motion", width / 2, 28);

      // Hand platform
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(width * 0.1, handDrawY - 5, width * 0.8, 10);
      ctx.fillStyle = "#92400e";
      ctx.font = `${Math.max(10, width * 0.014)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Oscillating Platform", width / 2, handDrawY - 12);

      // Draw hand/motor indicator
      ctx.fillStyle = "#dc2626";
      const motorX = width * 0.08;
      ctx.beginPath();
      ctx.arc(motorX, baseY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(motorX, baseY);
      ctx.lineTo(width * 0.1, handDrawY);
      ctx.stroke();

      // Block 1 (left side)
      const b1x = halfW * 0.5;
      const b1y = baseY + block1Y;
      drawSpring(b1x, handDrawY + 5, b1y - 20);
      drawBlock(b1x, b1y, mass1, "#3b82f6", `m₁ = ${mass1.toFixed(1)} kg`);

      // Block 2 (right side)
      const b2x = halfW * 1.5;
      const b2y = baseY + block2Y;
      drawSpring(b2x, handDrawY + 5, b2y - 20);
      drawBlock(b2x, b2y, mass2, "#ef4444", `m₂ = ${mass2.toFixed(1)} kg`);

      // Motion trails (right side panel)
      drawTrails();

      // Info text
      ctx.fillStyle = "#475569";
      ctx.font = `${Math.max(11, width * 0.015)}px sans-serif`;
      ctx.textAlign = "center";
      const infoY = height - 50;
      ctx.fillText("Heavier objects resist changes in motion more (greater inertia)", width / 2, infoY);
      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`Block 1 displacement: ${Math.abs(block1Y).toFixed(1)}px`, halfW * 0.5, infoY + 18);
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Block 2 displacement: ${Math.abs(block2Y).toFixed(1)}px`, halfW * 1.5, infoY + 18);
    },
    reset() {
      time = 0;
      handY = 0;
      block1Y = 0;
      block1Vy = 0;
      block2Y = 0;
      block2Vy = 0;
      trail1 = [];
      trail2 = [];
    },
    destroy() {},
    getStateDescription(): string {
      const ratio = mass2 / mass1;
      const amp1 = trail1.length > 10 ? Math.max(...trail1.map(Math.abs)) : 0;
      const amp2 = trail2.length > 10 ? Math.max(...trail2.map(Math.abs)) : 0;
      return `Inertia demonstration: Two blocks on springs driven by oscillating platform at ${oscFrequency.toFixed(1)}Hz. ` +
        `Block 1 (${mass1.toFixed(1)}kg) amplitude≈${amp1.toFixed(1)}px, Block 2 (${mass2.toFixed(1)}kg) amplitude≈${amp2.toFixed(1)}px. ` +
        `Mass ratio=${ratio.toFixed(1)}×. The heavier block moves less, demonstrating greater inertia.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawSpring(x: number, y1: number, y2: number) {
    const coils = 8;
    const segH = (y2 - y1) / (coils * 2);
    const springW = 15;

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    for (let i = 0; i < coils * 2; i++) {
      const ny = y1 + (i + 1) * segH;
      const nx = x + (i % 2 === 0 ? springW : -springW);
      ctx.lineTo(nx, ny);
    }
    ctx.lineTo(x, y2);
    ctx.stroke();
  }

  function drawBlock(x: number, y: number, mass: number, color: string, label: string) {
    const size = 30 + mass * 6;
    const half = size / 2;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(x - half + 3, y - half + 3, size, size);

    // Block
    ctx.fillStyle = color;
    ctx.fillRect(x - half, y - half, size, size);

    // Border
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - half, y - half, size, size);

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(10, size * 0.22)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    ctx.textBaseline = "alphabetic";
  }

  function drawTrails() {
    const trailX = width - 100;
    const trailW = 80;
    const trailTop = height * 0.15;
    const trailH = height * 0.3;
    const cy = trailTop + trailH / 2;

    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(trailX - 5, trailTop - 10, trailW + 10, trailH + 20);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(trailX - 5, trailTop - 10, trailW + 10, trailH + 20);

    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Motion History", trailX + trailW / 2, trailTop - 1);

    const maxDisp = Math.max(oscAmplitude * 1.5, 1);

    const drawTrailLine = (trail: number[], color: string) => {
      if (trail.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const px = trailX + (i / trailLen) * trailW;
        const py = cy - (trail[i] / maxDisp) * (trailH / 2) * 0.8;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };

    drawTrailLine(trail1, "#3b82f6");
    drawTrailLine(trail2, "#ef4444");
  }
};

export default InertiaFactory;
