import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const GraphOfSaturatedVapor2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("graph-of-saturated-vapor-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 20; // °C
  let vaporAmount = 15; // g/m³
  let showDewPoint = 1;

  // Saturation curve data (temp °C → max water vapor g/m³)
  // Based on actual saturation vapor density
  function saturationDensity(t: number): number {
    // Approximate formula: ρ_sat ≈ 5.018 + 0.32321*T + 0.0081847*T² + 0.00031243*T³
    // Simplified Magnus-based approximation
    if (t < 0) return Math.max(0, 4.85 * Math.exp(t * 0.06));
    return 4.85 * Math.exp(0.0625 * t);
  }

  function dewPoint(vapor: number): number {
    // Inverse of saturation: find T where saturationDensity(T) = vapor
    for (let t = -20; t <= 50; t += 0.5) {
      if (saturationDensity(t) >= vapor) return t;
    }
    return 50;
  }

  function relativeHumidity(): number {
    const sat = saturationDensity(temperature);
    return Math.min(200, (vaporAmount / sat) * 100);
  }

  function initState() {
    time = 0;
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0c1222");
    grad.addColorStop(1, "#1a2740");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawAirBox() {
    const bx = 30;
    const by = 80;
    const bw = width * 0.3;
    const bh = height - 180;

    // 3D box effect
    const depth = 30;
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(bx, by, bw, bh);

    // Top face
    ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + depth, by - depth);
    ctx.lineTo(bx + bw + depth, by - depth);
    ctx.lineTo(bx + bw, by);
    ctx.closePath();
    ctx.fill();

    // Right face
    ctx.fillStyle = "rgba(59, 130, 246, 0.05)";
    ctx.beginPath();
    ctx.moveTo(bx + bw, by);
    ctx.lineTo(bx + bw + depth, by - depth);
    ctx.lineTo(bx + bw + depth, by + bh - depth);
    ctx.lineTo(bx + bw, by + bh);
    ctx.closePath();
    ctx.fill();

    // Box border
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);

    // Label: 1m³
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("1 m³ of air", bx + bw / 2, by + bh + 18);
    ctx.fillText("1m", bx + bw / 2, by + bh + 35);

    // Water vapor visualization (dots inside box)
    const rh = relativeHumidity();
    const numDrops = Math.round(vaporAmount * 1.5);
    const sat = saturationDensity(temperature);

    // Seed-based random for consistent positions
    const rng = (s: number) => {
      let x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    for (let i = 0; i < numDrops; i++) {
      const dx = bx + 8 + rng(i * 3.1) * (bw - 16);
      const dy = by + 8 + rng(i * 7.3) * (bh - 16);

      if (i < sat * 1.5) {
        // Vapor (gas) — small dots
        ctx.fillStyle = "rgba(96, 165, 250, 0.5)";
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Condensed (liquid) — larger drops falling
        ctx.fillStyle = "rgba(34, 211, 238, 0.7)";
        ctx.beginPath();
        ctx.arc(dx, dy + Math.sin(time * 2 + i) * 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Status
    const status = rh > 100 ? "SUPERSATURATED" : rh === 100 ? "SATURATED" : "UNSATURATED";
    const statusColor = rh > 100 ? "#ef4444" : rh >= 100 ? "#f59e0b" : "#3b82f6";
    ctx.fillStyle = statusColor;
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(status, bx + bw / 2, by - 10);

    // Show vapor/saturation values
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.fillText(`Vapor: ${vaporAmount.toFixed(1)} g/m³`, bx + bw / 2, by + bh + 55);
    ctx.fillText(`Sat: ${sat.toFixed(1)} g/m³`, bx + bw / 2, by + bh + 72);
    ctx.fillStyle = statusColor;
    ctx.font = "bold 13px monospace";
    ctx.fillText(`RH: ${rh.toFixed(1)}%`, bx + bw / 2, by + bh + 92);
  }

  function drawSaturationGraph() {
    const gx = width * 0.4;
    const gy = 80;
    const gw = width * 0.55;
    const gh = height - 180;

    // Graph background
    ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
    ctx.beginPath();
    ctx.roundRect(gx - 10, gy - 10, gw + 20, gh + 30, 8);
    ctx.fill();

    const tempMin = -5;
    const tempMax = 45;
    const vapMax = 60;

    function tToX(t: number) { return gx + ((t - tempMin) / (tempMax - tempMin)) * gw; }
    function vToY(v: number) { return gy + gh - (v / vapMax) * gh; }

    // Grid
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 0.5;
    for (let t = 0; t <= tempMax; t += 5) {
      const x = tToX(t);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + gh);
      ctx.stroke();
    }
    for (let v = 0; v <= vapMax; v += 10) {
      const y = vToY(v);
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + gh);
    ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    for (let t = 0; t <= tempMax; t += 5) {
      ctx.fillText(`${t}`, tToX(t), gy + gh + 14);
    }
    ctx.textAlign = "right";
    for (let v = 0; v <= vapMax; v += 10) {
      ctx.fillText(`${v}`, gx - 5, vToY(v) + 4);
    }

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature (°C)", gx + gw / 2, gy + gh + 35);
    ctx.save();
    ctx.translate(gx - 35, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Water Vapor (g/m³)", 0, 0);
    ctx.restore();

    // Saturation curve
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let t = tempMin; t <= tempMax; t += 0.5) {
      const v = saturationDensity(t);
      const x = tToX(t);
      const y = vToY(v);
      if (t === tempMin) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under curve (saturated zone)
    ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
    ctx.beginPath();
    ctx.moveTo(tToX(tempMin), vToY(0));
    for (let t = tempMin; t <= tempMax; t += 0.5) {
      ctx.lineTo(tToX(t), vToY(saturationDensity(t)));
    }
    ctx.lineTo(tToX(tempMax), vToY(0));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Saturation curve", tToX(25), vToY(saturationDensity(25)) - 8);

    // Current point
    const cx = tToX(temperature);
    const cy = vToY(vaporAmount);
    const rh = relativeHumidity();
    const pointColor = rh > 100 ? "#ef4444" : "#3b82f6";

    ctx.fillStyle = pointColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`(${temperature.toFixed(0)}°C, ${vaporAmount.toFixed(1)} g/m³)`, cx + 10, cy - 5);

    // Dew point line
    if (showDewPoint > 0.5 && vaporAmount > 0) {
      const dp = dewPoint(vaporAmount);
      const dpX = tToX(dp);

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#22d3ee88";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(dpX, gy);
      ctx.lineTo(dpX, gy + gh);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#22d3ee";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Dew point: ${dp.toFixed(1)}°C`, dpX, gy - 5);

      // Horizontal line from point to curve
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "#94a3b888";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(dpX, vToY(saturationDensity(dp)));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Saturated Water Vapor & Relative Humidity", width / 2, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("RH = (actual vapor / saturated vapor) × 100%", width / 2, 50);
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
      temperature = params.temperature ?? 20;
      vaporAmount = params.vaporAmount ?? 15;
      showDewPoint = params.showDewPoint ?? 1;
      time += dt;
    },

    render() {
      drawBackground();
      drawAirBox();
      drawSaturationGraph();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {},

    getStateDescription(): string {
      const sat = saturationDensity(temperature);
      const rh = relativeHumidity();
      const dp = dewPoint(vaporAmount);
      const status = rh > 100 ? "supersaturated (condensation)" : rh >= 100 ? "saturated" : "unsaturated";
      return `Saturated Vapor Graph: T=${temperature}°C, vapor=${vaporAmount.toFixed(1)} g/m³, saturation=${sat.toFixed(1)} g/m³. RH=${rh.toFixed(1)}% (${status}). Dew point: ${dp.toFixed(1)}°C. Warm air holds more water vapor; cooling below the dew point causes condensation.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default GraphOfSaturatedVapor2Factory;
