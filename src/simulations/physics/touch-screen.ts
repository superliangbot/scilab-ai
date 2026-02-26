import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TouchScreenFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("touch-screen") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let touchX = 50;
  let touchY = 50;
  let gridResolution = 10;
  let sensitivity = 1.0;
  let scanRow = 0;
  let scanCol = 0;
  let scanPhase = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    scanRow = 0;
    scanCol = 0;
    scanPhase = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    touchX = params.touchX ?? 50;
    touchY = params.touchY ?? 50;
    gridResolution = Math.round(params.gridResolution ?? 10);
    sensitivity = params.sensitivity ?? 1.0;
    time += dt;
    if (scanPhase === 0) {
      scanRow += dt * 15;
      if (scanRow >= gridResolution) { scanRow = 0; scanPhase = 1; }
    } else {
      scanCol += dt * 15;
      if (scanCol >= gridResolution) { scanCol = 0; scanPhase = 0; }
    }
  }

  function getCapChange(gx: number, gy: number): number {
    const fx = (touchX / 100) * gridResolution;
    const fy = (touchY / 100) * gridResolution;
    const d = Math.sqrt((gx - fx) ** 2 + (gy - fy) ** 2);
    return Math.exp(-(d * d) / (2 * (1.5 * sensitivity) ** 2));
  }

  function renderCrossSection(): void {
    const csX = width * 0.02, csY = height * 0.02;
    const csW = width * 0.42, csH = height * 0.42;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.strokeStyle = "rgba(80, 150, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(csX, csY, csW, csH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#88bbff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Cross-Section View", csX + 12, csY + 20);
    const lX = csX + 30, lW = csW - 60, lSY = csY + 40, lH = 24, gap = 2;
    const layers = [
      { name: "Protective Glass", color: "rgba(180, 220, 255, 0.3)", border: "rgba(180, 220, 255, 0.6)" },
      { name: "ITO Layer (X-axis)", color: "rgba(255, 200, 80, 0.3)", border: "rgba(255, 200, 80, 0.6)" },
      { name: "Insulator", color: "rgba(100, 100, 100, 0.3)", border: "rgba(150, 150, 150, 0.5)" },
      { name: "ITO Layer (Y-axis)", color: "rgba(80, 255, 180, 0.3)", border: "rgba(80, 255, 180, 0.6)" },
      { name: "Glass Substrate", color: "rgba(140, 160, 200, 0.3)", border: "rgba(140, 160, 200, 0.5)" },
      { name: "LCD Display", color: "rgba(60, 60, 120, 0.4)", border: "rgba(100, 100, 180, 0.5)" },
    ];
    for (let i = 0; i < layers.length; i++) {
      const ly = lSY + i * (lH + gap);
      ctx.fillStyle = layers[i].color;
      ctx.strokeStyle = layers[i].border;
      ctx.lineWidth = 1;
      ctx.fillRect(lX, ly, lW, lH);
      ctx.strokeRect(lX, ly, lW, lH);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(layers[i].name, lX + lW / 2, ly + lH / 2 + 4);
    }
    // Finger
    const fingerFX = lX + (touchX / 100) * lW;
    ctx.beginPath();
    ctx.ellipse(fingerFX, lSY - 30, 18, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220, 180, 150, 0.7)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 160, 130, 0.8)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // E-field lines
    const fi = 0.5 + 0.3 * Math.sin(time * 3);
    for (let i = -3; i <= 3; i++) {
      const fx = fingerFX + i * 8;
      ctx.beginPath();
      ctx.moveTo(fx, lSY - 5);
      ctx.quadraticCurveTo(fx + i * 2, (lSY - 5 + lSY) / 2, fx + i * 0.5, lSY);
      ctx.strokeStyle = `rgba(100, 200, 255, ${fi * (1 - Math.abs(i) / 4)})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`C = \u03B5A/d`, csX + 12, csY + csH - 30);
    const peak = getCapChange(Math.round((touchX / 100) * gridResolution), Math.round((touchY / 100) * gridResolution));
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`\u0394C at touch: ${(peak * 2.5 * sensitivity).toFixed(2)} pF`, csX + 12, csY + csH - 12);
  }

  function renderCapacitiveGrid(): void {
    const gx = width * 0.46, gy = height * 0.02;
    const gw = width * 0.52, gh = height * 0.55;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.strokeStyle = "rgba(80, 150, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#88bbff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Capacitive Sensor Grid", gx + 12, gy + 20);
    const pX = gx + 30, pY = gy + 35, pW = gw - 60, pH = gh - 55;
    const cW = pW / gridResolution, cH = pH / gridResolution;
    for (let gy2 = 0; gy2 < gridResolution; gy2++) {
      for (let gx2 = 0; gx2 < gridResolution; gx2++) {
        const cx = pX + gx2 * cW, cy = pY + gy2 * cH;
        const cap = getCapChange(gx2 + 0.5, gy2 + 0.5);
        ctx.fillStyle = `rgba(${Math.floor(cap * 255)}, ${Math.floor(cap * 150)}, ${Math.floor(50 + cap * 200)}, ${0.1 + cap * 0.7})`;
        ctx.fillRect(cx, cy, cW - 1, cH - 1);
        ctx.strokeStyle = "rgba(80, 120, 200, 0.2)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cx, cy, cW - 1, cH - 1);
      }
    }
    // ITO conductor lines
    for (let i = 0; i <= gridResolution; i++) {
      ctx.beginPath();
      ctx.moveTo(pX, pY + i * cH);
      ctx.lineTo(pX + pW, pY + i * cH);
      ctx.strokeStyle = "rgba(255, 200, 80, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pX + i * cW, pY);
      ctx.lineTo(pX + i * cW, pY + pH);
      ctx.strokeStyle = "rgba(80, 255, 180, 0.3)";
      ctx.stroke();
    }
    // Scan highlight
    const sr = Math.floor(scanRow) % gridResolution;
    const sc = Math.floor(scanCol) % gridResolution;
    if (scanPhase === 0) {
      ctx.fillStyle = `rgba(255, 255, 100, ${0.1 + 0.1 * Math.sin(time * 10)})`;
      ctx.fillRect(pX, pY + sr * cH, pW, cH);
    } else {
      ctx.fillStyle = `rgba(100, 255, 255, ${0.1 + 0.1 * Math.sin(time * 10)})`;
      ctx.fillRect(pX + sc * cW, pY, cW, pH);
    }
    // Touch indicator
    const tpx = pX + (touchX / 100) * pW;
    const tpy = pY + (touchY / 100) * pH;
    ctx.beginPath();
    ctx.arc(tpx, tpy, 12, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    const gl = ctx.createRadialGradient(tpx, tpy, 0, tpx, tpy, 25);
    gl.addColorStop(0, `rgba(255, 200, 100, ${0.3 + 0.15 * Math.sin(time * 4)})`);
    gl.addColorStop(1, "rgba(255, 200, 100, 0)");
    ctx.beginPath();
    ctx.arc(tpx, tpy, 25, 0, Math.PI * 2);
    ctx.fillStyle = gl;
    ctx.fill();
  }

  function renderCapGraph(): void {
    const gx = width * 0.02, gy = height * 0.48, gw = width * 0.42, gh = height * 0.5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.strokeStyle = "rgba(80, 150, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#88bbff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Capacitance Profile (Row)", gx + 12, gy + 20);
    const plX = gx + 40, plY = gy + 35, plW = gw - 60, plH = gh - 60;
    ctx.beginPath();
    ctx.moveTo(plX, plY);
    ctx.lineTo(plX, plY + plH);
    ctx.lineTo(plX + plW, plY + plH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Grid Position", plX + plW / 2, plY + plH + 18);
    ctx.save();
    ctx.translate(plX - 22, plY + plH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("\u0394C (pF)", 0, 0);
    ctx.restore();
    const tgY = Math.round((touchY / 100) * gridResolution);
    ctx.beginPath();
    for (let i = 0; i <= gridResolution; i++) {
      const cap = getCapChange(i, tgY);
      const px = plX + (i / gridResolution) * plW;
      const py = plY + plH - cap * plH * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#ffaa44";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(plX + plW, plY + plH);
    ctx.lineTo(plX, plY + plH);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 170, 68, 0.15)";
    ctx.fill();
    // Threshold
    const thY = plY + plH - 0.3 * plH * 0.9;
    ctx.beginPath();
    ctx.moveTo(plX, thY);
    ctx.lineTo(plX + plW, thY);
    ctx.strokeStyle = "rgba(255, 100, 100, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 100, 100, 0.6)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Threshold", plX + plW + 4, thY + 3);
  }

  function renderInfoPanel(): void {
    const px = width * 0.46, py = height * 0.6, pw = width * 0.52, ph = height * 0.38;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.strokeStyle = "rgba(80, 150, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#88bbff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Capacitive Touch Technology", px + 12, py + 20);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "11px system-ui, sans-serif";
    let y = py + 42;
    const lh = 18;
    ctx.fillText("C = \u03B5\u2080\u03B5r \u00B7 A / d", px + 12, y); y += lh;
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("\u03B5 = permittivity, A = overlap area, d = gap", px + 12, y); y += lh + 4;
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Touch: (${touchX.toFixed(0)}%, ${touchY.toFixed(0)}%)`, px + 12, y); y += lh;
    ctx.fillText(`Grid: ${gridResolution}\u00D7${gridResolution} = ${gridResolution * gridResolution} nodes`, px + 12, y); y += lh;
    ctx.fillText(`Sensitivity: ${sensitivity.toFixed(1)}\u00D7`, px + 12, y); y += lh;
    const peak = getCapChange(Math.round((touchX / 100) * gridResolution), Math.round((touchY / 100) * gridResolution));
    ctx.fillText(`Peak \u0394C: ${(peak * 2.5 * sensitivity).toFixed(2)} pF`, px + 12, y); y += lh;
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Scan: ${scanPhase === 0 ? "Row" : "Column"} ${scanPhase === 0 ? Math.floor(scanRow) : Math.floor(scanCol)}`, px + 12, y);
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#08081a");
    bgGrad.addColorStop(1, "#0c1020");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    renderCrossSection();
    renderCapacitiveGrid();
    renderCapGraph();
    renderInfoPanel();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; scanRow = 0; scanCol = 0; scanPhase = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const peak = getCapChange(Math.round((touchX / 100) * gridResolution), Math.round((touchY / 100) * gridResolution));
    return (
      `Touch Screen: touch at (${touchX}%, ${touchY}%), grid ${gridResolution}\u00D7${gridResolution}, ` +
      `sensitivity=${sensitivity}\u00D7. Peak \u0394C: ${(peak * 2.5 * sensitivity).toFixed(2)} pF.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TouchScreenFactory;
