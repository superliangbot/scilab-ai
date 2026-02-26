import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PressureVolumeDiagramFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pressure-volume-diagram") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let processType = 0; // 0=isothermal, 1=isochoric, 2=isobaric, 3=adiabatic
  let initialVolume = 2; // liters
  let finalVolume = 5; // liters
  let initialPressure = 3; // atm

  // Constants
  const GAMMA = 1.4; // for diatomic ideal gas
  const nR = 1; // n*R simplified constant

  function getProcessName(): string {
    const names = ["Isothermal (T=const)", "Isochoric (V=const)", "Isobaric (P=const)", "Adiabatic (Q=0)"];
    return names[Math.round(processType)];
  }

  function getPressureAt(v: number): number {
    const proc = Math.round(processType);
    const p0 = initialPressure;
    const v0 = initialVolume;

    switch (proc) {
      case 0: // Isothermal: PV = const -> P = P0*V0/V
        return (p0 * v0) / v;
      case 1: // Isochoric: V = const, but we still plot (returns same P for all V on the line)
        return p0; // effectively vertical line
      case 2: // Isobaric: P = const
        return p0;
      case 3: // Adiabatic: PV^gamma = const -> P = P0*(V0/V)^gamma
        return p0 * Math.pow(v0 / v, GAMMA);
      default:
        return p0;
    }
  }

  function getWork(): number {
    const proc = Math.round(processType);
    const p0 = initialPressure;
    const v0 = initialVolume;
    const v1 = finalVolume;

    switch (proc) {
      case 0: // W = nRT * ln(V1/V0) = P0*V0*ln(V1/V0)
        return p0 * v0 * Math.log(v1 / v0);
      case 1: // W = 0 (constant volume)
        return 0;
      case 2: // W = P * (V1 - V0)
        return p0 * (v1 - v0);
      case 3: // W = (P0*V0 - P1*V1)/(gamma-1)
        { const p1 = getPressureAt(v1);
        return (p0 * v0 - p1 * v1) / (GAMMA - 1); }
      default:
        return 0;
    }
  }

  function getHeat(): number {
    const proc = Math.round(processType);
    const p0 = initialPressure;
    const v0 = initialVolume;
    const v1 = finalVolume;

    switch (proc) {
      case 0: // Q = W (isothermal, deltaU = 0)
        return getWork();
      case 1: // Q = deltaU = nCv*deltaT
        { const p1 = getPressureAt(v1);
        return (p1 - p0) * v0 / (GAMMA - 1); }
      case 2: // Q = nCp*deltaT = gamma/(gamma-1) * P * deltaV
        return (GAMMA / (GAMMA - 1)) * p0 * (v1 - v0);
      case 3: // Q = 0 (adiabatic)
        return 0;
      default:
        return 0;
    }
  }

  function getDeltaU(): number {
    return getHeat() - getWork();
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    processType = params.processType ?? 0;
    initialVolume = params.initialVolume ?? 2;
    finalVolume = params.finalVolume ?? 5;
    initialPressure = params.initialPressure ?? 3;
    time += dt;
  }

  function render() {
    ctx.fillStyle = "#0e0e1e";
    ctx.fillRect(0, 0, width, height);

    const proc = Math.round(processType);

    // PV Diagram
    const plotX = width * 0.12;
    const plotY = height * 0.08;
    const plotW = width * 0.52;
    const plotH = height * 0.6;
    const plotRight = plotX + plotW;
    const plotBottom = plotY + plotH;

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(11, height * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Volume (L)", plotX + plotW / 2, plotBottom + 25);
    ctx.save();
    ctx.translate(plotX - 25, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Pressure (atm)", 0, 0);
    ctx.restore();

    // Scale
    const maxV = 8;
    const maxP = 6;

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    ctx.font = `${Math.max(9, height * 0.013)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.textAlign = "right";
    for (let p = 1; p <= maxP; p++) {
      const py = plotBottom - (p / maxP) * plotH;
      ctx.beginPath();
      ctx.moveTo(plotX, py);
      ctx.lineTo(plotRight, py);
      ctx.stroke();
      ctx.fillText(`${p}`, plotX - 5, py + 4);
    }
    ctx.textAlign = "center";
    for (let v = 1; v <= maxV; v++) {
      const vx = plotX + (v / maxV) * plotW;
      ctx.beginPath();
      ctx.moveTo(vx, plotY);
      ctx.lineTo(vx, plotBottom);
      ctx.stroke();
      ctx.fillText(`${v}`, vx, plotBottom + 12);
    }

    // Process curve
    const colors = ["#4488ff", "#ff8844", "#44dd88", "#dd44aa"];
    const color = colors[proc];

    if (proc === 1) {
      // Isochoric: vertical line at V0
      const vx = plotX + (initialVolume / maxV) * plotW;
      const py1 = plotBottom - (initialPressure / maxP) * plotH;
      // Final pressure (from temperature change mapped to finalVolume as a proxy)
      const pFinal = initialPressure * (finalVolume / initialVolume);
      const py2 = plotBottom - (Math.min(pFinal, maxP) / maxP) * plotH;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(vx, py1);
      ctx.lineTo(vx, py2);
      ctx.stroke();

      // Animated dot
      const t = (Math.sin(time * 1.5) + 1) / 2;
      const dotY = py1 + t * (py2 - py1);
      ctx.beginPath();
      ctx.arc(vx, dotY, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Points
      ctx.beginPath();
      ctx.arc(vx, py1, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(vx, py2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Curves with area fill
      const v0 = initialVolume;
      const v1 = finalVolume;
      const steps = 100;

      // Fill area under curve
      ctx.beginPath();
      ctx.moveTo(plotX + (v0 / maxV) * plotW, plotBottom);
      for (let i = 0; i <= steps; i++) {
        const v = v0 + (i / steps) * (v1 - v0);
        const p = Math.max(0.01, Math.min(maxP, getPressureAt(v)));
        const px = plotX + (v / maxV) * plotW;
        const py = plotBottom - (p / maxP) * plotH;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(plotX + (v1 / maxV) * plotW, plotBottom);
      ctx.closePath();
      ctx.fillStyle = color.replace(")", ",0.15)").replace("rgb", "rgba");
      ctx.fill();

      // Curve line
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const v = v0 + (i / steps) * (v1 - v0);
        const p = Math.max(0.01, Math.min(maxP, getPressureAt(v)));
        const px = plotX + (v / maxV) * plotW;
        const py = plotBottom - (p / maxP) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Animated point
      const t = (Math.sin(time * 1.5) + 1) / 2;
      const animV = v0 + t * (v1 - v0);
      const animP = Math.max(0.01, Math.min(maxP, getPressureAt(animV)));
      const animX = plotX + (animV / maxV) * plotW;
      const animY = plotBottom - (animP / maxP) * plotH;
      ctx.beginPath();
      ctx.arc(animX, animY, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Start/end points
      const startP = getPressureAt(v0);
      const endP = getPressureAt(v1);
      for (const [v, p] of [[v0, startP], [v1, endP]]) {
        const px = plotX + (v / maxV) * plotW;
        const py = plotBottom - (Math.min(p, maxP) / maxP) * plotH;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    }

    // Process label
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(13, height * 0.024)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(getProcessName(), plotX + 10, plotY + 20);

    // Energy bar diagram (right side)
    const barX = width * 0.7;
    const barY = height * 0.08;
    const barW = width * 0.25;
    const barH = height * 0.6;

    ctx.fillStyle = "rgba(10,10,30,0.8)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.max(11, height * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Energy", barX + barW / 2, barY + 20);

    const Q = getHeat();
    const W = getWork();
    const dU = getDeltaU();
    const maxE = Math.max(Math.abs(Q), Math.abs(W), Math.abs(dU), 1);

    const barEntries = [
      { label: "Q (Heat)", value: Q, color: "#ff6644" },
      { label: "W (Work)", value: W, color: "#44aaff" },
      { label: "ΔU (Internal)", value: dU, color: "#44dd88" },
    ];

    const entryH = (barH - 60) / 3;
    for (let i = 0; i < barEntries.length; i++) {
      const e = barEntries[i];
      const ey = barY + 35 + i * entryH;
      const barMaxW = barW - 30;
      const eBarW = (Math.abs(e.value) / maxE) * barMaxW * 0.8;
      const centerX = barX + barW / 2;

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(e.label, centerX, ey + 15);

      // Bar
      const barLeft = e.value >= 0 ? centerX : centerX - eBarW;
      ctx.fillStyle = e.color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(barLeft, ey + 22, eBarW, entryH * 0.35);
      ctx.globalAlpha = 1;

      // Value
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
      ctx.fillText(`${e.value.toFixed(2)}`, centerX, ey + 22 + entryH * 0.35 + 14);
    }

    // First law equation
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Q = W + ΔU", barX + barW / 2, barY + barH - 8);

    // Bottom info
    const infoY = height * 0.75;
    ctx.fillStyle = "rgba(10,10,30,0.8)";
    ctx.beginPath();
    ctx.roundRect(width * 0.03, infoY, width * 0.94, height * 0.22, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    const infoX = width * 0.06;

    const descriptions = [
      "Isothermal: Temperature constant. ΔU=0, all heat converts to work. PV=const.",
      "Isochoric: Volume constant. No work done (W=0). All heat changes internal energy.",
      "Isobaric: Pressure constant. Heat produces both work and internal energy change.",
      "Adiabatic: No heat exchange (Q=0). Temperature changes through compression/expansion.",
    ];

    ctx.fillText(descriptions[proc], infoX, infoY + 20);
    ctx.fillText(`V₁=${initialVolume.toFixed(1)}L → V₂=${finalVolume.toFixed(1)}L | P₁=${initialPressure.toFixed(1)}atm`, infoX, infoY + 42);
    ctx.fillText(`Q=${Q.toFixed(2)} | W=${W.toFixed(2)} | ΔU=${dU.toFixed(2)}`, infoX, infoY + 62);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Pressure-Volume Diagram", width / 2, height - 10);
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    return `PV Diagram | Process: ${getProcessName()} | V: ${initialVolume.toFixed(1)}→${finalVolume.toFixed(1)}L | P: ${initialPressure.toFixed(1)}atm | Q=${getHeat().toFixed(2)} W=${getWork().toFixed(2)} ΔU=${getDeltaU().toFixed(2)}`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PressureVolumeDiagramFactory;
