import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Physics constants ───────────────────────────────────────────────
const G = 9.81;            // gravitational acceleration (m/s^2)
const P_ATM_STD = 101325;  // standard atmospheric pressure (Pa)

const StrawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("straw") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let atmosphericPressure = 1;   // atm
  let liquidDensity = 1;         // g/cm^3 = 1000 kg/m^3
  let strawLength = 15;          // cm
  let suctionForce = 0.5;        // 0–1 normalized

  // State
  let liquidLevel = 0;           // current liquid height in straw (cm)
  let targetLevel = 0;           // equilibrium level (cm)
  let bubbles: { x: number; y: number; r: number; speed: number }[] = [];

  function calcEquilibriumHeight(): number {
    // h = deltaP / (rho * g)
    // deltaP = suction fraction of atmospheric pressure
    const pAtm = atmosphericPressure * P_ATM_STD;  // Pa
    const deltaP = suctionForce * pAtm * 0.1;      // suction creates partial vacuum (up to 10% of atm)
    const rho = liquidDensity * 1000;               // kg/m^3
    const hMeters = deltaP / (rho * G);             // meters
    const hCm = hMeters * 100;                      // cm
    return Math.min(hCm, strawLength);              // can't exceed straw length
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    liquidLevel = 0;
    bubbles = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    atmosphericPressure = params.atmosphericPressure ?? atmosphericPressure;
    liquidDensity = params.liquidDensity ?? liquidDensity;
    strawLength = params.strawLength ?? strawLength;
    suctionForce = params.suctionForce ?? suctionForce;

    time += step;

    targetLevel = calcEquilibriumHeight();

    // Smooth approach to equilibrium
    const diff = targetLevel - liquidLevel;
    liquidLevel += diff * 3 * step;
    liquidLevel = Math.max(0, Math.min(strawLength, liquidLevel));

    // Spawn bubbles when suction is active and liquid is rising
    if (suctionForce > 0.1 && Math.random() < suctionForce * 0.3) {
      bubbles.push({
        x: 0.4 + Math.random() * 0.2,
        y: liquidLevel / strawLength,
        r: 1 + Math.random() * 2,
        speed: 0.3 + Math.random() * 0.4,
      });
    }
    // Update bubbles
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].y += bubbles[i].speed * step * 0.1;
      if (bubbles[i].y > 1.1) bubbles.splice(i, 1);
    }
    if (bubbles.length > 30) bubbles.splice(0, bubbles.length - 30);
  }

  function render(): void {
    if (!ctx) return;

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0d1b2a");
    bgGrad.addColorStop(1, "#1b263b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Drinking Through a Straw", width / 2, 28);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillText("Atmospheric pressure pushes liquid up the straw", width / 2, 48);

    // Layout
    const glassLeft = width * 0.3;
    const glassRight = width * 0.6;
    const glassTop = height * 0.35;
    const glassBottom = height * 0.82;
    const glassW = glassRight - glassLeft;
    const glassH = glassBottom - glassTop;
    const liquidSurface = glassTop + glassH * 0.2;

    // Draw glass (trapezoid shape)
    const glassNarrowL = glassLeft + glassW * 0.05;
    const glassNarrowR = glassRight - glassW * 0.05;
    ctx.strokeStyle = "rgba(150, 200, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(glassNarrowL, glassTop);
    ctx.lineTo(glassLeft, glassBottom);
    ctx.lineTo(glassRight, glassBottom);
    ctx.lineTo(glassNarrowR, glassTop);
    ctx.stroke();

    // Liquid in glass
    const liquidColor = liquidDensity > 1.2 ? "rgba(180, 100, 50, 0.6)" :
                        liquidDensity < 0.9 ? "rgba(200, 200, 100, 0.5)" :
                        "rgba(60, 140, 220, 0.5)";
    const liquidGrad = ctx.createLinearGradient(0, liquidSurface, 0, glassBottom);
    liquidGrad.addColorStop(0, liquidColor);
    liquidGrad.addColorStop(1, liquidColor.replace("0.5", "0.7").replace("0.6", "0.8"));
    ctx.fillStyle = liquidGrad;

    // Compute glass width at liquid surface level
    const fracTop = (liquidSurface - glassTop) / glassH;
    const fracBot = 1;
    const liqSurfL = glassNarrowL + (glassLeft - glassNarrowL) * fracTop;
    const liqSurfR = glassNarrowR + (glassRight - glassNarrowR) * fracTop;
    ctx.beginPath();
    ctx.moveTo(liqSurfL, liquidSurface);
    ctx.lineTo(glassLeft, glassBottom);
    ctx.lineTo(glassRight, glassBottom);
    ctx.lineTo(liqSurfR, liquidSurface);
    ctx.closePath();
    ctx.fill();

    // Liquid surface shine
    ctx.strokeStyle = "rgba(120, 180, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(liqSurfL + 5, liquidSurface);
    ctx.lineTo(liqSurfR - 5, liquidSurface);
    ctx.stroke();

    // Draw straw
    const strawCenterX = glassLeft + glassW * 0.55;
    const strawW = 10;
    const strawPixelLen = glassH * 1.3;
    const strawTopY = glassTop - strawPixelLen * 0.35;
    const strawBottomY = glassBottom - 15;
    const strawPixelsPerCm = (strawBottomY - strawTopY) / strawLength;

    // Straw body
    ctx.fillStyle = "rgba(200, 200, 200, 0.15)";
    ctx.fillRect(strawCenterX - strawW / 2, strawTopY, strawW, strawBottomY - strawTopY);
    ctx.strokeStyle = "rgba(200, 200, 200, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(strawCenterX - strawW / 2, strawTopY, strawW, strawBottomY - strawTopY);

    // Liquid inside straw
    if (liquidLevel > 0) {
      const liqTopInStraw = strawBottomY - liquidLevel * strawPixelsPerCm;
      const liqGrad = ctx.createLinearGradient(0, liqTopInStraw, 0, strawBottomY);
      liqGrad.addColorStop(0, "rgba(60, 160, 255, 0.7)");
      liqGrad.addColorStop(1, "rgba(40, 120, 200, 0.8)");
      ctx.fillStyle = liqGrad;
      ctx.fillRect(strawCenterX - strawW / 2 + 1, liqTopInStraw, strawW - 2, strawBottomY - liqTopInStraw);
    }

    // Bubbles inside straw
    for (const b of bubbles) {
      const bx = strawCenterX - strawW / 2 + b.x * strawW;
      const by = strawBottomY - b.y * (strawBottomY - strawTopY);
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(200, 230, 255, 0.4)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Pressure arrows
    // Atmospheric pressure pushing down on liquid surface
    const arrowColor = "#38bdf8";
    ctx.strokeStyle = arrowColor;
    ctx.fillStyle = arrowColor;
    ctx.lineWidth = 2;

    // Down arrows (atmospheric pressure on glass surface)
    for (let i = 0; i < 3; i++) {
      const ax = liqSurfL + (liqSurfR - liqSurfL) * (0.15 + i * 0.3);
      if (Math.abs(ax - strawCenterX) > strawW) {
        drawArrow(ax, liquidSurface - 30, ax, liquidSurface - 5, arrowColor);
        if (i === 1) {
          ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
          ctx.font = "10px 'Inter', system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("P_atm", ax, liquidSurface - 35);
        }
      }
    }

    // Up arrow inside straw (reduced pressure / suction)
    if (suctionForce > 0.05) {
      const suctionArrowY = strawTopY + 15;
      drawArrow(strawCenterX, strawTopY + 40, strawCenterX, suctionArrowY, "#f472b6");
      ctx.fillStyle = "rgba(244, 114, 182, 0.8)";
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Low P", strawCenterX + strawW, suctionArrowY + 5);
      ctx.fillText("(suction)", strawCenterX + strawW, suctionArrowY + 18);
    }

    // Pressure values and equation panel
    const panelX = 12;
    const panelY = height * 0.12;
    ctx.textAlign = "left";

    const pAtm = atmosphericPressure * P_ATM_STD;
    const deltaP = suctionForce * pAtm * 0.1;
    const rho = liquidDensity * 1000;

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillText("Pressure Physics", panelX, panelY);

    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`P_atm = ${(pAtm / 1000).toFixed(1)} kPa`, panelX, panelY + 20);
    ctx.fillText(`\u0394P = ${(deltaP / 1000).toFixed(2)} kPa`, panelX, panelY + 38);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`\u03C1 = ${(rho).toFixed(0)} kg/m\u00B3`, panelX, panelY + 56);
    ctx.fillStyle = "#34d399";
    ctx.fillText(`h = ${liquidLevel.toFixed(1)} cm`, panelX, panelY + 74);
    ctx.fillText(`h_eq = ${targetLevel.toFixed(1)} cm`, panelX, panelY + 92);

    // Equation
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
    ctx.fillText("h = \u0394P / (\u03C1g)", panelX, panelY + 120);

    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillText("Atmospheric pressure pushes liquid", panelX, panelY + 140);
    ctx.fillText("up when pressure inside straw drops.", panelX, panelY + 154);

    // Straw length indicator
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    const indX = strawCenterX + strawW + 15;
    ctx.beginPath();
    ctx.moveTo(indX, strawTopY);
    ctx.lineTo(indX, strawBottomY);
    ctx.stroke();
    // Ticks
    ctx.beginPath();
    ctx.moveTo(indX - 3, strawTopY);
    ctx.lineTo(indX + 3, strawTopY);
    ctx.moveTo(indX - 3, strawBottomY);
    ctx.lineTo(indX + 3, strawBottomY);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${strawLength.toFixed(0)} cm`, indX, strawTopY - 5);

    // Time display
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const headLen = 8;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  function reset(): void {
    time = 0;
    liquidLevel = 0;
    bubbles = [];
  }

  function destroy(): void {
    bubbles = [];
  }

  function getStateDescription(): string {
    const pAtm = atmosphericPressure * P_ATM_STD;
    const deltaP = suctionForce * pAtm * 0.1;
    const rho = liquidDensity * 1000;
    return (
      `Straw physics: P_atm=${(pAtm / 1000).toFixed(1)} kPa, suction=${(suctionForce * 100).toFixed(0)}%, ` +
      `\u0394P=${(deltaP / 1000).toFixed(2)} kPa, \u03C1=${rho.toFixed(0)} kg/m\u00B3, ` +
      `liquid height=${liquidLevel.toFixed(1)} cm / ${strawLength} cm straw. ` +
      `h = \u0394P/(\u03C1g). Atmospheric pressure pushes liquid up when suction ` +
      `reduces pressure inside the straw. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StrawFactory;
