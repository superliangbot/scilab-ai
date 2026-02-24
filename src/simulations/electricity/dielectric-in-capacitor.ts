import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DielectricCapacitorFactory = (): SimulationEngine => {
  const config = getSimConfig("dielectric-in-capacitor") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, _params: Record<string, number>): void {
    time += dt;
  }

  function drawCharge(x: number, y: number, positive: boolean, size: number): void {
    ctx.fillStyle = positive ? "#ef4444" : "#3b82f6";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${size * 1.4}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(positive ? "+" : "−", x, y);
    ctx.textBaseline = "alphabetic";
  }

  function render(): void {
    const params = config.parameters;
    // Read from actual running params via closure - we'll use defaults for render
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.45;
    const plateH = height * 0.45;
    const plateW = 12;

    // Read actual params from the last update cycle
    // Since we need params in render, we store them
    const voltage = currentParams.voltage ?? 12;
    const distance = currentParams.distance ?? 50;
    const dielectricK = currentParams.dielectricK ?? 1;
    const showField = currentParams.showField ?? 1;

    // Calculate plate separation
    const plateSep = distance * 2.5 + 40;
    const leftPlateX = cx - plateSep / 2;
    const rightPlateX = cx + plateSep / 2;
    const plateTop = cy - plateH / 2;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Dielectric in Capacitor", cx, 28);

    // Draw plates
    // Left plate (positive)
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(leftPlateX - plateW, plateTop, plateW, plateH);

    // Right plate (negative)
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(rightPlateX, plateTop, plateW, plateH);

    // Charges on plates
    const numCharges = Math.floor(plateH / 25);
    for (let i = 0; i < numCharges; i++) {
      const y = plateTop + 15 + i * (plateH - 30) / (numCharges - 1);
      drawCharge(leftPlateX - plateW / 2, y, true, 7);
      drawCharge(rightPlateX + plateW / 2, y, false, 7);
    }

    // Dielectric slab (if K > 1)
    if (dielectricK > 1) {
      const dielW = (plateSep - plateW) * 0.7;
      const dielX = cx - dielW / 2;
      ctx.fillStyle = `rgba(180, 130, 60, ${0.3 + (dielectricK - 1) / 10})`;
      ctx.fillRect(dielX, plateTop + 5, dielW, plateH - 10);
      ctx.strokeStyle = "#b4823c";
      ctx.lineWidth = 2;
      ctx.strokeRect(dielX, plateTop + 5, dielW, plateH - 10);

      // Polarized charges inside dielectric
      const polarRows = Math.floor((plateH - 20) / 35);
      const polarCols = Math.max(2, Math.floor(dielW / 40));
      for (let r = 0; r < polarRows; r++) {
        for (let c = 0; c < polarCols; c++) {
          const px = dielX + 15 + c * ((dielW - 30) / Math.max(1, polarCols - 1));
          const py = plateTop + 20 + r * ((plateH - 40) / Math.max(1, polarRows - 1));

          // Displaced positive (slightly right) and negative (slightly left)
          const displacement = 4 + (dielectricK - 1) * 1.5;
          ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
          ctx.beginPath();
          ctx.arc(px + displacement, py, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
          ctx.beginPath();
          ctx.arc(px - displacement, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Dielectric label
      ctx.fillStyle = "#d4a24a";
      ctx.font = `${Math.max(11, width * 0.015)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`κ = ${dielectricK.toFixed(1)}`, cx, plateTop + plateH + 20);
    }

    // Electric field lines
    if (showField >= 0.5) {
      const numLines = 8;
      ctx.strokeStyle = dielectricK > 1 ? "#22c55e88" : "#22c55e";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);

      for (let i = 0; i < numLines; i++) {
        const y = plateTop + 20 + i * (plateH - 40) / (numLines - 1);
        ctx.beginPath();
        ctx.moveTo(leftPlateX + 2, y);
        ctx.lineTo(rightPlateX - 2, y);
        ctx.stroke();

        // Arrow in middle
        const arrowX = cx + 5;
        ctx.fillStyle = dielectricK > 1 ? "#22c55e88" : "#22c55e";
        ctx.beginPath();
        ctx.moveTo(arrowX, y);
        ctx.lineTo(arrowX - 6, y - 3);
        ctx.lineTo(arrowX - 6, y + 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.setLineDash([]);
    }

    // Wires and battery
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    // Left wire
    ctx.beginPath();
    ctx.moveTo(leftPlateX - plateW, cy);
    ctx.lineTo(leftPlateX - plateW - 40, cy);
    ctx.lineTo(leftPlateX - plateW - 40, cy + plateH / 2 + 30);
    ctx.lineTo(cx - 15, cy + plateH / 2 + 30);
    ctx.stroke();
    // Right wire
    ctx.beginPath();
    ctx.moveTo(rightPlateX + plateW, cy);
    ctx.lineTo(rightPlateX + plateW + 40, cy);
    ctx.lineTo(rightPlateX + plateW + 40, cy + plateH / 2 + 30);
    ctx.lineTo(cx + 15, cy + plateH / 2 + 30);
    ctx.stroke();

    // Battery symbol
    const batY = cy + plateH / 2 + 30;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 8, batY - 10);
    ctx.lineTo(cx - 8, batY + 10);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + 8, batY - 6);
    ctx.lineTo(cx + 8, batY + 6);
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("+", cx - 8, batY - 15);
    ctx.fillText("−", cx + 8, batY - 15);
    ctx.fillText(`${voltage.toFixed(0)}V`, cx, batY + 25);

    // Capacitance calculation
    const epsilon0 = 8.854e-12;
    const A = 0.01; // plate area in m²
    const d = distance * 1e-3; // distance in m
    const C0 = epsilon0 * A / d;
    const C = C0 * dielectricK;
    const Q = C * voltage;
    const E = voltage / (distance * 1e-3) / dielectricK;

    // Info panel
    const panelX = 15;
    const panelY = 50;
    const panelW = 240;
    const panelH = 120;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(11, width * 0.015)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`C = κε₀A/d`, panelX + 10, panelY + 20);
    ctx.fillText(`C = ${(C * 1e12).toFixed(2)} pF`, panelX + 10, panelY + 42);
    ctx.fillText(`Q = CV = ${(Q * 1e12).toFixed(2)} pC`, panelX + 10, panelY + 64);
    ctx.fillText(`E = V/(κd) = ${E.toFixed(0)} V/m`, panelX + 10, panelY + 86);
    ctx.fillText(`U = ½CV² = ${(0.5 * C * voltage * voltage * 1e12).toFixed(2)} pJ`, panelX + 10, panelY + 108);

    // Plate labels
    ctx.fillStyle = "#ef4444";
    ctx.font = `bold ${Math.max(13, width * 0.018)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("+Q", leftPlateX - plateW / 2, plateTop - 10);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("−Q", rightPlateX + plateW / 2, plateTop - 10);
  }

  let currentParams: Record<string, number> = {};

  // Override update to store params
  const origUpdate = update;
  function wrappedUpdate(dt: number, params: Record<string, number>): void {
    currentParams = params;
    origUpdate(dt, params);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const voltage = currentParams.voltage ?? 12;
    const distance = currentParams.distance ?? 50;
    const dielectricK = currentParams.dielectricK ?? 1;
    const epsilon0 = 8.854e-12;
    const A = 0.01;
    const d = distance * 1e-3;
    const C = dielectricK * epsilon0 * A / d;

    return `Dielectric in capacitor: Voltage=${voltage}V, plate separation=${distance}mm, dielectric constant κ=${dielectricK.toFixed(1)}. Capacitance C = κε₀A/d = ${(C * 1e12).toFixed(2)} pF. Inserting a dielectric increases capacitance by factor κ because the dielectric polarizes, creating an internal field that partially cancels the external field, allowing more charge to accumulate on the plates for the same voltage.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update: wrappedUpdate,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default DielectricCapacitorFactory;
