import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ResistiveTouchScreenFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("resistive-touch-screen") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let touchX = 50; // 0-100 %
  let touchY = 50; // 0-100 %
  let supplyVoltage = 5; // 3-5 V
  let layerGap = 3; // 1-5 mm

  let crossTop = 0, crossBottom = 0, crossLeft = 0, crossRight = 0;
  let layerThickness = 0, gapSize = 0;
  let pulsePhase = 0, contactGlow = 0;
  interface SpacerDot { xRatio: number; yRatio: number; }
  const spacerDots: SpacerDot[] = [];

  function initSpacerDots(): void {
    spacerDots.length = 0;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 8; c++)
        spacerDots.push({ xRatio: (c + 0.5) / 8, yRatio: (r + 0.5) / 3 });
  }

  function computeGeometry(): void {
    crossLeft = 90; crossRight = width - 90;
    crossTop = height * 0.18; crossBottom = height * 0.58;
    layerThickness = (crossBottom - crossTop) * 0.15;
    gapSize = (crossBottom - crossTop) * 0.15 * (layerGap / 3);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    contactGlow = 0;
    initSpacerDots();
    computeGeometry();
  }

  function update(dt: number, params: Record<string, number>): void {
    touchX = params.touchX ?? 50;
    touchY = params.touchY ?? 50;
    supplyVoltage = params.voltage ?? 5;
    layerGap = params.layerGap ?? 3;

    time += dt;
    pulsePhase = (pulsePhase + dt * 3) % (Math.PI * 2);
    contactGlow = 0.5 + 0.5 * Math.sin(pulsePhase);

    computeGeometry();
  }

  function drawCrossSectionBackground(): void {
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
    ctx.fillText("Resistive Touch Screen \u2014 Cross-Section View", width / 2, 30);
    ctx.font = "12px system-ui, sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText("Two ITO-coated conductive layers separated by spacer dots", width / 2, 50);
  }

  function drawLayers(): void {
    const topLayerY = crossTop;
    const bottomLayerY = crossTop + layerThickness + gapSize;
    const touchPosX = crossLeft + (crossRight - crossLeft) * (touchX / 100);
    const deformWidth = 40 + layerGap * 8;
    const deformDepth = gapSize * 0.9;

    // Top flexible layer (PET + ITO)
    ctx.fillStyle = "rgba(59, 130, 246, 0.35)";
    ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(crossLeft, topLayerY);
    ctx.lineTo(crossRight, topLayerY);
    ctx.lineTo(crossRight, topLayerY + layerThickness);
    for (let x = crossRight; x >= crossLeft; x -= 2) {
      const d = Math.abs(x - touchPosX);
      const yOff = d < deformWidth ? deformDepth * Math.pow(1 - d / deformWidth, 2) : 0;
      ctx.lineTo(x, topLayerY + layerThickness + yOff);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#60a5fa"; ctx.textAlign = "left";
    ctx.fillText("Top Layer (Flexible PET + ITO)", crossLeft, topLayerY - 8);

    // Bottom rigid layer (Glass + ITO)
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)"; ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(crossLeft, bottomLayerY, crossRight - crossLeft, layerThickness);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f87171"; ctx.textAlign = "left";
    ctx.fillText("Bottom Layer (Glass + ITO)", crossLeft, bottomLayerY + layerThickness + 16);

    // Spacer dots
    const spacerY = topLayerY + layerThickness + gapSize * 0.4;
    for (const dot of spacerDots) {
      const dx = crossLeft + (crossRight - crossLeft) * dot.xRatio;
      if (Math.abs(dx - touchPosX) < deformWidth * 0.5) continue;
      ctx.fillStyle = "rgba(148, 163, 184, 0.5)"; ctx.beginPath();
      ctx.arc(dx, spacerY, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = "#64748b"; ctx.textAlign = "right";
    ctx.fillText("Spacer dots", crossLeft - 5, spacerY + 3);

    // Touch contact point with glow
    const contactY = topLayerY + layerThickness + deformDepth;
    const glowR = 12 + contactGlow * 6;
    const glow = ctx.createRadialGradient(touchPosX, contactY, 0, touchPosX, contactY, glowR);
    glow.addColorStop(0, `rgba(250, 204, 21, ${0.6 + contactGlow * 0.3})`);
    glow.addColorStop(0.5, "rgba(250, 204, 21, 0.2)"); glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.beginPath();
    ctx.arc(touchPosX, contactY, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fbbf24"; ctx.beginPath();
    ctx.arc(touchPosX, contactY, 4, 0, Math.PI * 2); ctx.fill();

    // Touch arrow
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(touchPosX, topLayerY - 30); ctx.lineTo(touchPosX, topLayerY - 5);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#fbbf24"; ctx.beginPath();
    ctx.moveTo(touchPosX - 5, topLayerY - 10); ctx.lineTo(touchPosX + 5, topLayerY - 10);
    ctx.lineTo(touchPosX, topLayerY - 2); ctx.closePath(); ctx.fill();
    ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("TOUCH", touchPosX, topLayerY - 35);

    // Gap dimension
    const dimX = crossRight + 15, gapTop = topLayerY + layerThickness;
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dimX, gapTop); ctx.lineTo(dimX, bottomLayerY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dimX - 4, gapTop); ctx.lineTo(dimX + 4, gapTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dimX - 4, bottomLayerY); ctx.lineTo(dimX + 4, bottomLayerY); ctx.stroke();
    ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "left";
    ctx.fillText(`${layerGap} mm`, dimX + 6, (gapTop + bottomLayerY) / 2 + 3);
  }

  function drawVoltageReadings(): void {
    const pY = height * 0.62, pH = height * 0.15, pW = width - 40, pX = 20;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; ctx.beginPath();
    ctx.roundRect(pX, pY, pW, pH, 8); ctx.fill();
    ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "left";
    ctx.fillText("Voltage Divider Readings", pX + 12, pY + 20);
    const vx = (touchX / 100) * supplyVoltage, vy = (touchY / 100) * supplyVoltage;
    ctx.font = "11px system-ui, sans-serif"; const col2 = pX + pW / 2;
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`V_x = ${vx.toFixed(2)} V  (across X-axis ITO layer)`, pX + 12, pY + 40);
    ctx.fillStyle = "#f87171";
    ctx.fillText(`V_y = ${vy.toFixed(2)} V  (across Y-axis ITO layer)`, col2, pY + 40);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Supply: ${supplyVoltage.toFixed(1)} V`, pX + 12, pY + 58);
    ctx.fillText(`Touch Position: (${touchX.toFixed(0)}%, ${touchY.toFixed(0)}%)`, col2, pY + 58);
  }

  function drawCoordinateCalculation(): void {
    const pY = height * 0.79, pH = height * 0.19, pW = width - 40, pX = 20;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)"; ctx.beginPath();
    ctx.roundRect(pX, pY, pW, pH, 8); ctx.fill();
    ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "left";
    ctx.fillText("Coordinate Calculation", pX + 12, pY + 20);
    const vx = (touchX / 100) * supplyVoltage, vy = (touchY / 100) * supplyVoltage;
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`X = (V_x / V_total) \u00D7 Width = (${vx.toFixed(2)} / ${supplyVoltage.toFixed(1)}) \u00D7 W = ${touchX.toFixed(1)}%`, pX + 12, pY + 42);
    ctx.fillStyle = "#f87171";
    ctx.fillText(`Y = (V_y / V_total) \u00D7 Height = (${vy.toFixed(2)} / ${supplyVoltage.toFixed(1)}) \u00D7 H = ${touchY.toFixed(1)}%`, pX + 12, pY + 62);
    ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#64748b";
    ctx.fillText("Resistive layer acts as voltage divider. Touch creates contact; voltage at contact reveals position.", pX + 12, pY + 82);
  }

  function drawScreenTopView(): void {
    const sz = Math.min(width * 0.18, 120), ix = width - sz - 20, iy = 60;
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)"; ctx.strokeStyle = "#475569"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(ix - 5, iy - 5, sz + 10, sz + 30, 6); ctx.fill(); ctx.stroke();
    ctx.font = "bold 9px system-ui, sans-serif"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center";
    ctx.fillText("Top View", ix + sz / 2, iy - 5);
    ctx.fillStyle = "rgba(51, 65, 85, 0.6)"; ctx.strokeStyle = "#64748b";
    ctx.fillRect(ix, iy, sz, sz); ctx.strokeRect(ix, iy, sz, sz);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)"; ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(ix + (sz / 4) * i, iy); ctx.lineTo(ix + (sz / 4) * i, iy + sz); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ix, iy + (sz / 4) * i); ctx.lineTo(ix + sz, iy + (sz / 4) * i); ctx.stroke();
    }
    const tpx = ix + (touchX / 100) * sz, tpy = iy + (touchY / 100) * sz;
    ctx.strokeStyle = "rgba(250, 204, 21, 0.5)"; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(tpx, iy); ctx.lineTo(tpx, iy + sz); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix, tpy); ctx.lineTo(ix + sz, tpy); ctx.stroke();
    ctx.setLineDash([]);
    const dg = ctx.createRadialGradient(tpx, tpy, 0, tpx, tpy, 10);
    dg.addColorStop(0, `rgba(250, 204, 21, ${0.7 + contactGlow * 0.3})`); dg.addColorStop(1, "transparent");
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(tpx, tpy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(tpx, tpy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`(${touchX.toFixed(0)}%, ${touchY.toFixed(0)}%)`, ix + sz / 2, iy + sz + 14);
    ctx.fillStyle = "#60a5fa"; ctx.fillText("X", ix + sz / 2, iy + sz + 26);
    ctx.save(); ctx.translate(ix - 10, iy + sz / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#f87171"; ctx.fillText("Y", 0, 0); ctx.restore();
  }

  function drawElectrodeLabels(): void {
    const tY = crossTop, tMid = tY + layerThickness / 2;
    ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "center";
    // X electrodes on top layer
    for (const [ex, label] of [[crossLeft - 5, "X0"], [crossRight + 5, "X1"]] as [number, string][]) {
      ctx.fillStyle = "rgba(59, 130, 246, 0.5)"; ctx.beginPath();
      ctx.arc(ex, tMid, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#60a5fa"; ctx.fillText(label, ex, tMid + 18);
    }
    // Y electrodes on bottom layer
    const bY = crossTop + layerThickness + gapSize + layerThickness / 2;
    for (const [ex, label, tx] of [[crossLeft - 5, "Y0", crossLeft - 20], [crossRight + 5, "Y1", crossRight + 20]] as [number, string, number][]) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.5)"; ctx.beginPath();
      ctx.arc(ex, bY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f87171"; ctx.fillText(label, tx, bY + 4);
    }
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawCrossSectionBackground();
    drawLayers();
    drawElectrodeLabels();
    drawScreenTopView();
    drawVoltageReadings();
    drawCoordinateCalculation();
  }

  function reset(): void {
    time = 0;
    pulsePhase = 0;
    contactGlow = 0;
  }

  function destroy(): void {
    spacerDots.length = 0;
  }

  function getStateDescription(): string {
    const vx = (touchX / 100) * supplyVoltage;
    const vy = (touchY / 100) * supplyVoltage;
    return (
      `Resistive Touch Screen: Touch at (${touchX.toFixed(0)}%, ${touchY.toFixed(0)}%). ` +
      `Supply voltage: ${supplyVoltage}V, layer gap: ${layerGap}mm. ` +
      `V_x = ${vx.toFixed(2)}V, V_y = ${vy.toFixed(2)}V. ` +
      `X = V_x/V_total * Width = ${touchX.toFixed(1)}%, Y = V_y/V_total * Height = ${touchY.toFixed(1)}%. ` +
      `Two ITO-coated conductive layers are separated by spacer dots. ` +
      `When pressed, the flexible top layer contacts the rigid bottom layer. ` +
      `The resistive coating acts as a voltage divider; the voltage at the contact point ` +
      `reveals the touch position along each axis.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeGeometry();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ResistiveTouchScreenFactory;
