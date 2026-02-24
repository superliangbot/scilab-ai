import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const GravityTrainFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gravity-train") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  const EARTH_RADIUS = 6.371e6; // meters
  const G = 6.674e-11;
  const EARTH_MASS = 5.972e24;
  const PERIOD = 2 * Math.PI * Math.sqrt(EARTH_RADIUS * EARTH_RADIUS * EARTH_RADIUS / (G * EARTH_MASS)); // ~5060s

  let tunnelAngle = 0; // radians from vertical
  let trainPosition = 0; // -1 to 1 (fraction along tunnel, 0=center)
  let trainVelocity = 0;
  let chordFraction = 1.0; // 1 = full diameter, 0.5 = half chord

  function resetTrain() {
    trainPosition = -1; // start at entry
    trainVelocity = 0;
    time = 0;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      resetTrain();
    },

    update(dt: number, params: Record<string, number>) {
      const newAngle = ((params.tunnelAngle ?? 0) * Math.PI) / 180;
      const newChord = params.chordFraction ?? 1.0;
      if (Math.abs(newAngle - tunnelAngle) > 0.001 || Math.abs(newChord - chordFraction) > 0.01) {
        tunnelAngle = newAngle;
        chordFraction = newChord;
        resetTrain();
      }

      // Simple harmonic motion along tunnel
      // The half-length of the chord
      const halfChord = EARTH_RADIUS * chordFraction;
      // Angular frequency is the same regardless of chord: omega = sqrt(g/R)
      const omega = (2 * Math.PI) / PERIOD;
      // acceleration = -omega^2 * x (where x is position along tunnel from center)
      const x = trainPosition * halfChord;
      const accel = -omega * omega * x;

      trainVelocity += accel * dt;
      trainPosition += (trainVelocity * dt) / halfChord;

      // Clamp at ends
      if (trainPosition < -1) {
        trainPosition = -1;
        trainVelocity = Math.abs(trainVelocity) * 0.999;
      }
      if (trainPosition > 1) {
        trainPosition = 1;
        trainVelocity = -Math.abs(trainVelocity) * 0.999;
      }

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const earthR = Math.min(width, height) * 0.35;

      // Stars
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137.5 + 42) % width);
        const sy = ((i * 97.3 + 13) % height);
        const dist = Math.hypot(sx - cx, sy - cy);
        if (dist > earthR + 10) {
          ctx.globalAlpha = 0.3 + 0.7 * ((i * 31) % 100) / 100;
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }
      ctx.globalAlpha = 1;

      // Earth
      const earthGrad = ctx.createRadialGradient(cx - earthR * 0.2, cy - earthR * 0.2, earthR * 0.05, cx, cy, earthR);
      earthGrad.addColorStop(0, "#2a6dd4");
      earthGrad.addColorStop(0.4, "#1a5aad");
      earthGrad.addColorStop(0.7, "#0d3d7a");
      earthGrad.addColorStop(1, "#0a1f3a");
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
      ctx.fill();

      // Earth's atmosphere glow
      ctx.strokeStyle = "rgba(100,180,255,0.3)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, earthR + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Draw some continents (simplified)
      ctx.fillStyle = "rgba(40,120,60,0.5)";
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.2, cy - earthR * 0.15, earthR * 0.25, earthR * 0.35, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + earthR * 0.3, cy + earthR * 0.1, earthR * 0.15, earthR * 0.2, 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, earthR * 0.2);
      coreGrad.addColorStop(0, "rgba(255,150,50,0.6)");
      coreGrad.addColorStop(1, "rgba(255,100,30,0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, earthR * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Tunnel
      const angle = tunnelAngle;
      const tunnelHalf = earthR * chordFraction;
      const x1 = cx + Math.sin(angle) * tunnelHalf;
      const y1 = cy - Math.cos(angle) * tunnelHalf;
      const x2 = cx - Math.sin(angle) * tunnelHalf;
      const y2 = cy + Math.cos(angle) * tunnelHalf;

      ctx.strokeStyle = "rgba(255,255,100,0.6)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Tunnel walls
      ctx.strokeStyle = "rgba(180,180,80,0.3)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Train position along tunnel
      const frac = (trainPosition + 1) / 2; // 0 to 1
      const trainX = x1 + (x2 - x1) * frac;
      const trainY = y1 + (y2 - y1) * frac;

      // Train
      ctx.fillStyle = "#ff4444";
      ctx.shadowColor = "#ff4444";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(trainX, trainY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Train trail
      ctx.strokeStyle = "rgba(255,100,100,0.3)";
      ctx.lineWidth = 3;
      const trailFrac = Math.max(0, frac - 0.05);
      ctx.beginPath();
      ctx.moveTo(x1 + (x2 - x1) * trailFrac, y1 + (y2 - y1) * trailFrac);
      ctx.lineTo(trainX, trainY);
      ctx.stroke();

      // Entry/Exit labels
      ctx.fillStyle = "#ffdd44";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      const labelOffset = 18;
      ctx.fillText("A", x1 + Math.sin(angle) * labelOffset, y1 - Math.cos(angle) * labelOffset);
      ctx.fillText("B", x2 - Math.sin(angle) * labelOffset, y2 + Math.cos(angle) * labelOffset);

      // Info panel
      const panelX = 15;
      const panelY = 15;
      ctx.fillStyle = "rgba(10,15,30,0.85)";
      ctx.strokeStyle = "rgba(100,150,255,0.3)";
      ctx.lineWidth = 1;
      const pw = 210;
      const ph = 120;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, pw, ph, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Gravity Train", panelX + 12, panelY + 22);

      ctx.fillStyle = "#aabbcc";
      ctx.font = "12px monospace";
      const periodMin = (PERIOD / 60).toFixed(1);
      ctx.fillText(`Period: ${periodMin} min`, panelX + 12, panelY + 44);
      ctx.fillText(`Time: ${time.toFixed(0)}s`, panelX + 12, panelY + 62);
      const speed = Math.abs(trainVelocity).toFixed(0);
      ctx.fillText(`Speed: ${speed} m/s`, panelX + 12, panelY + 80);
      const depth = ((1 - Math.abs(trainPosition)) * EARTH_RADIUS * chordFraction / 1000).toFixed(0);
      ctx.fillText(`Depth: ${depth} km`, panelX + 12, panelY + 98);

      // Title
      ctx.fillStyle = "#667";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Same travel time (~42 min) regardless of tunnel angle!", cx, height - 15);
    },

    reset() {
      resetTrain();
    },

    destroy() {},

    getStateDescription() {
      const speed = Math.abs(trainVelocity).toFixed(0);
      const depth = ((1 - Math.abs(trainPosition)) * EARTH_RADIUS * chordFraction / 1000).toFixed(0);
      return `Gravity train at position ${(trainPosition * 100).toFixed(0)}% along tunnel. Speed=${speed} m/s, depth=${depth} km, time=${time.toFixed(1)}s. Period≈${(PERIOD / 60).toFixed(1)} min regardless of tunnel angle.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default GravityTrainFactory;
