import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Mass {
  x: number;
  y: number;
  vy: number;
  restX: number;
  restY: number;
}

const SpringWaveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("spring-wave") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let masses: Mass[] = [];
  let numMasses = 25;
  let waveSpeed = 2;
  let amplitude = 40;
  let damping = 0.05;

  function initMasses(): void {
    masses = [];
    const spacing = (width - 120) / (numMasses + 1);
    const centerY = height / 2;
    for (let i = 0; i < numMasses; i++) {
      const rx = 60 + spacing * (i + 1);
      masses.push({ x: rx, y: centerY, vy: 0, restX: rx, restY: centerY });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initMasses();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    const newNum = Math.round(params.numMasses ?? 25);
    waveSpeed = params.waveSpeed ?? 2;
    amplitude = params.amplitude ?? 40;
    damping = params.damping ?? 0.05;

    if (newNum !== numMasses) {
      numMasses = newNum;
      initMasses();
    }

    time += step;

    // Drive the first mass with a sinusoidal wave
    if (masses.length > 0) {
      masses[0].y = masses[0].restY + amplitude * Math.sin(time * waveSpeed * 3);
      masses[0].vy = 0;
    }

    // Wave equation: each mass is coupled to neighbors via springs
    const k = waveSpeed * waveSpeed * 400; // effective spring constant
    const massVal = 1.0;

    for (let i = 1; i < masses.length; i++) {
      const m = masses[i];
      const displacementFromRest = m.y - m.restY;

      // Force from left neighbor
      let force = 0;
      const leftDy = masses[i - 1].y - m.y;
      force += k * leftDy / massVal;

      // Force from right neighbor
      if (i < masses.length - 1) {
        const rightDy = masses[i + 1].y - m.y;
        force += k * rightDy / massVal;
      }

      // Restoring force to equilibrium and damping
      force -= damping * m.vy * 100;

      m.vy += force * step;
      m.y += m.vy * step;
    }
  }

  function drawSpring(x1: number, y1: number, x2: number, y2: number, coils: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = dx / len;
    const ny = dy / len;
    const px = -ny;
    const py = nx;
    const springAmp = 6;
    const segments = coils * 4;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;
      const zigzag = (i % 2 === 0 ? 1 : -1) * springAmp;
      if (i === 1 || i === segments) {
        ctx.lineTo(cx, cy);
      } else {
        ctx.lineTo(cx + px * zigzag, cy + py * zigzag);
      }
    }
    ctx.stroke();
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0d1117");
    bgGrad.addColorStop(1, "#161b22");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Spring Wave Propagation", 14, 24);
    ctx.restore();

    // Draw equilibrium line
    ctx.strokeStyle = "rgba(100,150,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(40, height / 2);
    ctx.lineTo(width - 40, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw fixed walls
    ctx.fillStyle = "rgba(120,140,170,0.8)";
    ctx.fillRect(30, height / 2 - 60, 10, 120);
    ctx.fillRect(width - 40, height / 2 - 60, 10, 120);

    // Draw springs between masses
    for (let i = 0; i < masses.length; i++) {
      const m = masses[i];
      const prevX = i === 0 ? 40 : masses[i - 1].x;
      const prevY = i === 0 ? masses[0].restY : masses[i - 1].y;

      // Spring color based on stretch
      const stretch = Math.abs(m.y - prevY);
      const stretchRatio = Math.min(stretch / 80, 1);
      const r = Math.round(100 + 155 * stretchRatio);
      const g = Math.round(200 - 100 * stretchRatio);
      const b = Math.round(255 - 155 * stretchRatio);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`;
      ctx.lineWidth = 1.5;
      drawSpring(prevX, prevY, m.x, m.y, 4);
    }

    // Connect last mass to right wall
    if (masses.length > 0) {
      const last = masses[masses.length - 1];
      ctx.strokeStyle = "rgba(100,180,255,0.5)";
      ctx.lineWidth = 1.5;
      drawSpring(last.x, last.y, width - 40, last.restY, 4);
    }

    // Draw masses
    for (let i = 0; i < masses.length; i++) {
      const m = masses[i];
      const displacement = m.y - m.restY;
      const normDisp = Math.min(Math.abs(displacement) / amplitude, 1);

      // Color: blue for negative, red for positive displacement
      let color: string;
      if (displacement > 0) {
        color = `rgba(${Math.round(100 + 155 * normDisp)}, ${Math.round(80 * (1 - normDisp))}, ${Math.round(80 * (1 - normDisp))}, 1)`;
      } else {
        color = `rgba(${Math.round(80 * (1 - normDisp))}, ${Math.round(80 * (1 - normDisp))}, ${Math.round(100 + 155 * normDisp)}, 1)`;
      }

      // Glow
      const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 18);
      glow.addColorStop(0, displacement > 0
        ? `rgba(255,100,100,${0.3 * normDisp})`
        : `rgba(100,100,255,${0.3 * normDisp})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(m.x, m.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Mass circle
      const grad = ctx.createRadialGradient(m.x - 2, m.y - 2, 0, m.x, m.y, 8);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.beginPath();
      ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Displacement arrows for a few masses
    ctx.save();
    for (let i = 0; i < masses.length; i += Math.max(1, Math.floor(masses.length / 8))) {
      const m = masses[i];
      const displacement = m.y - m.restY;
      if (Math.abs(displacement) > 3) {
        ctx.strokeStyle = displacement > 0 ? "rgba(255,120,80,0.6)" : "rgba(80,120,255,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.x, m.restY);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
        // Arrowhead
        const dir = displacement > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - 3, m.y - 5 * dir);
        ctx.lineTo(m.x + 3, m.y - 5 * dir);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    }
    ctx.restore();

    // Wave envelope
    ctx.save();
    ctx.strokeStyle = "rgba(100,200,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < masses.length; i++) {
      const m = masses[i];
      if (i === 0) ctx.moveTo(m.x, m.y);
      else ctx.lineTo(m.x, m.y);
    }
    ctx.stroke();
    ctx.restore();

    // Info panel
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, height - 90, 260, 80, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Masses: ${numMasses}  |  Wave speed: ${waveSpeed.toFixed(1)}`, 20, height - 70);
    ctx.fillText(`Amplitude: ${amplitude.toFixed(0)} px  |  Damping: ${damping.toFixed(2)}`, 20, height - 54);
    ctx.fillText(`Time: ${time.toFixed(1)}s`, 20, height - 38);
    ctx.fillStyle = "rgba(200,200,255,0.5)";
    ctx.fillText("Wave eqn: d\u00B2y/dt\u00B2 = v\u00B2 d\u00B2y/dx\u00B2", 20, height - 22);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    initMasses();
  }

  function destroy(): void {
    masses = [];
  }

  function getStateDescription(): string {
    const maxDisp = masses.reduce((mx, m) => Math.max(mx, Math.abs(m.y - m.restY)), 0);
    return (
      `Spring Wave: ${numMasses} masses connected by springs. ` +
      `Wave speed=${waveSpeed.toFixed(1)}, amplitude=${amplitude.toFixed(0)}px, ` +
      `damping=${damping.toFixed(2)}. Max displacement=${maxDisp.toFixed(1)}px. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initMasses();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpringWaveFactory;
