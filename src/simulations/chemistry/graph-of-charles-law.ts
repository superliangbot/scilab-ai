import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const GraphOfCharlesLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("graph-of-charles-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let zoom = 1;
  let pressure = 1; // atm
  let showExtrapolation = 1;
  let gasType = 0; // 0=ideal, 1=nitrogen, 2=oxygen

  // Charles's Law: V = V₀(1 + T/273) at constant pressure
  // V/T = constant (in Kelvin)
  const V0 = 22.4; // L/mol at STP

  function initState() {
    time = 0;
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGraph() {
    const padL = 80;
    const padR = 40;
    const padT = 80;
    const padB = 70;

    const gx = padL;
    const gy = padT;
    const gw = width - padL - padR;
    const gh = height - padT - padB;

    // Ranges based on zoom
    const tempMin = -300 / zoom;
    const tempMax = 600 / zoom;
    const volMin = 0;
    const volMax = V0 * (1 + tempMax / 273) * 1.1 / pressure;

    // Grid
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 0.5;

    // Temperature grid lines
    const tempStep = zoom > 1.5 ? 50 : 100;
    for (let t = Math.ceil(tempMin / tempStep) * tempStep; t <= tempMax; t += tempStep) {
      const x = gx + ((t - tempMin) / (tempMax - tempMin)) * gw;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + gh);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${t}°C`, x, gy + gh + 16);
    }

    // Volume grid lines
    const volStep = Math.max(5, Math.round(volMax / 8 / 5) * 5);
    for (let v = 0; v <= volMax; v += volStep) {
      const y = gy + gh - (v / volMax) * gh;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${v.toFixed(0)}`, gx - 8, y + 4);
    }

    // Axes
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + gh);
    ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();

    // Axis arrows
    ctx.beginPath();
    ctx.moveTo(gx + gw, gy + gh);
    ctx.lineTo(gx + gw - 8, gy + gh - 4);
    ctx.lineTo(gx + gw - 8, gy + gh + 4);
    ctx.closePath();
    ctx.fillStyle = "#94a3b8";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - 4, gy + 8);
    ctx.lineTo(gx + 4, gy + 8);
    ctx.closePath();
    ctx.fill();

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature (°C)", gx + gw / 2, gy + gh + 45);
    ctx.save();
    ctx.translate(20, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Volume (L/mol)", 0, 0);
    ctx.restore();

    // Charles's Law line: V = V₀(1 + T/273) / P
    // This is a straight line that passes through (−273, 0) and (0, V₀/P)
    function tempToX(t: number) { return gx + ((t - tempMin) / (tempMax - tempMin)) * gw; }
    function volToY(v: number) { return gy + gh - (v / volMax) * gh; }

    // Extrapolation (dashed) below 0°C
    if (showExtrapolation > 0.5) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#ef444488";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const extStart = Math.max(tempMin, -273);
      ctx.moveTo(tempToX(extStart), volToY(V0 * (1 + extStart / 273) / pressure));
      ctx.lineTo(tempToX(0), volToY(V0 / pressure));
      ctx.stroke();
      ctx.setLineDash([]);

      // Absolute zero marker
      if (tempMin <= -273) {
        const azX = tempToX(-273);
        const azY = volToY(0);
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(azX, azY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("−273°C", azX, azY - 12);
        ctx.fillText("(Absolute Zero)", azX, azY + 18);
      }
    }

    // Main line (solid) above 0°C for gas types
    const gasColors = ["#3b82f6", "#10b981", "#f59e0b"];
    const gasLabels = ["Ideal Gas", "Nitrogen (N₂)", "Oxygen (O₂)"];
    const gasDeviations = [0, 0.02, 0.03]; // slight deviations for real gases

    for (let g = 0; g <= gasType; g++) {
      const deviation = gasDeviations[g];
      ctx.strokeStyle = gasColors[g];
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      let first = true;
      for (let t = -273; t <= tempMax; t += 2) {
        if (t < tempMin) continue;
        let v = V0 * (1 + t / 273) / pressure;
        // Real gas deviation at low temps
        if (deviation > 0 && t < 100) {
          v *= (1 - deviation * Math.exp(-t / 100));
        }
        if (v < 0) v = 0;

        const x = tempToX(t);
        const y = volToY(v);
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Key points
    // 0°C point
    const v0Point = V0 / pressure;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(tempToX(0), volToY(v0Point), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#22d3ee";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`(0°C, ${v0Point.toFixed(1)} L)`, tempToX(0) + 8, volToY(v0Point) - 6);

    // 100°C point
    const v100 = V0 * (1 + 100 / 273) / pressure;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(tempToX(100), volToY(v100), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`(100°C, ${v100.toFixed(1)} L)`, tempToX(100) + 8, volToY(v100) - 6);

    // Legend
    const lx = gx + gw - 160;
    const ly = gy + 10;
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, 155, 20 + (gasType + 1) * 18, 6);
    ctx.fill();

    for (let g = 0; g <= gasType; g++) {
      ctx.strokeStyle = gasColors[g];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx + 10, ly + 16 + g * 18);
      ctx.lineTo(lx + 30, ly + 16 + g * 18);
      ctx.stroke();
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(gasLabels[g], lx + 35, ly + 20 + g * 18);
    }
  }

  function drawInfo() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Charles's Law — V ∝ T at Constant Pressure", width / 2, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.fillText(`V = V₀(1 + T/273)  |  P = ${pressure.toFixed(1)} atm  |  V₀ = ${(V0/pressure).toFixed(1)} L/mol`, width / 2, 52);
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
      pressure = params.pressure ?? 1;
      showExtrapolation = params.showExtrapolation ?? 1;
      gasType = Math.round(params.gasType ?? 0);
      time += dt;
    },

    render() {
      drawBackground();
      drawGraph();
      drawInfo();
    },

    reset() {
      initState();
    },

    destroy() {},

    getStateDescription(): string {
      const v0 = V0 / pressure;
      return `Charles's Law Graph: V = V₀(1 + T/273) at P=${pressure} atm. At 0°C, V=${v0.toFixed(1)} L/mol. At 100°C, V=${(V0*(1+100/273)/pressure).toFixed(1)} L/mol. The line extrapolates to V=0 at −273°C (absolute zero, 0 K). This shows volume is directly proportional to absolute temperature at constant pressure.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default GraphOfCharlesLawFactory;
