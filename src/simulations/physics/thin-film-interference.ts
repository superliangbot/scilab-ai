import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ThinFilmInterferenceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("thin-film-interference") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800, height = 600, time = 0;
  let thickness = 400, refractiveIndex = 1.5, incidenceAngle = 0;
  const lambdaMin = 380, lambdaMax = 780;

  function wavelengthToRGB(wl: number): { r: number; g: number; b: number } {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl <= 780) { r = 1; }
    let f = 1;
    if (wl < 420) f = 0.3 + 0.7 * (wl - 380) / 40;
    else if (wl > 700) f = 0.3 + 0.7 * (780 - wl) / 80;
    return { r: Math.round(r * f * 255), g: Math.round(g * f * 255), b: Math.round(b * f * 255) };
  }

  function getReflectance(lambda: number): number {
    const thetaI = incidenceAngle * Math.PI / 180;
    const sinThetaT = Math.sin(thetaI) / refractiveIndex;
    const cosThetaT = Math.sqrt(1 - sinThetaT * sinThetaT);
    const pathDiff = 2 * refractiveIndex * thickness * cosThetaT;
    const delta = 2 * Math.PI * pathDiff / lambda + Math.PI;
    return Math.pow(Math.cos(delta / 2), 2);
  }

  function getReflectedColor(): { r: number; g: number; b: number } {
    let tR = 0, tG = 0, tB = 0, tW = 0;
    for (let i = 0; i <= 80; i++) {
      const lam = lambdaMin + (i / 80) * (lambdaMax - lambdaMin);
      const refl = getReflectance(lam), rgb = wavelengthToRGB(lam);
      tR += rgb.r * refl; tG += rgb.g * refl; tB += rgb.b * refl; tW += refl;
    }
    return tW > 0 ? { r: Math.min(255, Math.round(tR / tW * 1.5)), g: Math.min(255, Math.round(tG / tW * 1.5)), b: Math.min(255, Math.round(tB / tW * 1.5)) } : { r: 128, g: 128, b: 128 };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!; width = canvas.width; height = canvas.height; time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    thickness = params.thickness ?? 400; refractiveIndex = params.refractiveIndex ?? 1.5;
    incidenceAngle = params.incidenceAngle ?? 0; time += dt;
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 8 * Math.cos(a - 0.35), y2 - 8 * Math.sin(a - 0.35));
    ctx.lineTo(x2 - 8 * Math.cos(a + 0.35), y2 - 8 * Math.sin(a + 0.35));
    ctx.closePath(); ctx.fill();
  }

  function drawFilmDiagram(): void {
    const fX = width * 0.08, fW = width * 0.42, fTopY = height * 0.3, fH = height * 0.2, fBotY = fTopY + fH;
    ctx.fillStyle = "rgba(30,58,138,0.15)"; ctx.fillRect(fX, height * 0.08, fW, fTopY - height * 0.08);
    ctx.fillStyle = "#94a3b8"; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Air (n = 1.00)", fX + fW / 2, height * 0.15);

    const fc = getReflectedColor();
    const filmGrad = ctx.createLinearGradient(0, fTopY, 0, fBotY);
    filmGrad.addColorStop(0, `rgba(${fc.r},${fc.g},${fc.b},0.5)`);
    filmGrad.addColorStop(0.5, `rgba(${fc.r},${fc.g},${fc.b},0.3)`);
    filmGrad.addColorStop(1, `rgba(${fc.r},${fc.g},${fc.b},0.5)`);
    ctx.fillStyle = filmGrad; ctx.fillRect(fX, fTopY, fW, fH);

    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fX, fTopY); ctx.lineTo(fX + fW, fTopY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fX, fBotY); ctx.lineTo(fX + fW, fBotY); ctx.stroke();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Thin Film (n = ${refractiveIndex.toFixed(2)})`, fX + fW / 2, fTopY + fH / 2 + 4);
    ctx.fillStyle = "#94a3b8"; ctx.font = "9px system-ui, sans-serif";
    ctx.fillText(`t = ${thickness} nm`, fX + fW / 2, fTopY + fH / 2 + 18);

    ctx.fillStyle = "rgba(30,58,138,0.15)"; ctx.fillRect(fX, fBotY, fW, height * 0.65 - fBotY);
    ctx.fillStyle = "#94a3b8"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Air/Substrate (n = 1.00)", fX + fW / 2, fBotY + 30);

    const tI = incidenceAngle * Math.PI / 180, hitX = fX + fW * 0.45, rLen = height * 0.18;
    const incSX = hitX - Math.sin(tI) * rLen, incSY = fTopY - Math.cos(tI) * rLen;
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(incSX, incSY); ctx.lineTo(hitX, fTopY); ctx.stroke();
    drawArrow(incSX, incSY, hitX, fTopY, "#fbbf24");
    ctx.fillStyle = "#fbbf24"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText("Incident", incSX - 10, incSY - 5);

    const refEX = hitX + Math.sin(tI) * rLen, refEY = fTopY - Math.cos(tI) * rLen;
    const refCol = `rgb(${fc.r},${fc.g},${fc.b})`;
    ctx.strokeStyle = refCol; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hitX, fTopY); ctx.lineTo(refEX, refEY); ctx.stroke();
    drawArrow(hitX, fTopY, refEX, refEY, refCol);
    ctx.fillStyle = refCol; ctx.font = "bold 10px system-ui, sans-serif"; ctx.fillText("Reflected (1)", refEX + 5, refEY - 5);
    ctx.fillStyle = "#ef4444"; ctx.font = "bold 9px system-ui, sans-serif"; ctx.fillText("phase shift pi", hitX + 10, fTopY - 5);

    const sinTT = Math.sin(tI) / refractiveIndex, tT = Math.asin(Math.max(-1, Math.min(1, sinTT)));
    const hitX2 = hitX + Math.sin(tT) * fH;
    ctx.strokeStyle = "#fbbf2480"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hitX, fTopY); ctx.lineTo(hitX2, fBotY); ctx.stroke();

    const ref2EX = hitX2 - Math.sin(tT) * fH;
    ctx.strokeStyle = `rgba(${fc.r},${fc.g},${fc.b},0.6)`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(hitX2, fBotY); ctx.lineTo(ref2EX, fTopY); ctx.stroke();

    const exitEX = ref2EX + Math.sin(tI) * rLen * 0.6, exitEY = fTopY - Math.cos(tI) * rLen * 0.6;
    ctx.strokeStyle = `rgba(${fc.r},${fc.g},${fc.b},0.5)`;
    ctx.beginPath(); ctx.moveTo(ref2EX, fTopY); ctx.lineTo(exitEX, exitEY); ctx.stroke();
    ctx.fillStyle = `rgba(${fc.r},${fc.g},${fc.b},0.7)`; ctx.font = "10px system-ui, sans-serif"; ctx.fillText("Reflected (2)", exitEX + 3, exitEY);

    if (incidenceAngle > 2) { ctx.fillStyle = "#fbbf24"; ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(`theta_i = ${incidenceAngle} deg`, hitX - 30, fTopY - 35); }
  }

  function drawSpectrumBar(): void {
    const bx = width * 0.55, by = height * 0.08, bw = width * 0.4, bh = 25;
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Reflected Spectrum vs Thickness", bx + bw / 2, by - 5);

    const saved = thickness;
    for (let i = 0; i < Math.floor(bw); i++) {
      thickness = 100 + (i / bw) * 900;
      const c = getReflectedColor();
      ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`; ctx.fillRect(bx + i, by, 2, bh);
    }
    thickness = saved;
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
    const mx = bx + ((thickness - 100) / 900) * bw;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, by - 3); ctx.lineTo(mx, by + bh + 3); ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "left"; ctx.fillText("100 nm", bx, by + bh + 12);
    ctx.textAlign = "right"; ctx.fillText("1000 nm", bx + bw, by + bh + 12);
    ctx.textAlign = "center"; ctx.fillText(`Current: ${thickness} nm`, mx, by + bh + 22);
  }

  function drawReflectanceGraph(): void {
    const gx = width * 0.55, gy = height * 0.22, gw = width * 0.4, gh = height * 0.34;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(gx - 5, gy, gw + 10, gh + 10, 6); ctx.fill();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Reflectance vs Wavelength", gx + gw / 2, gy + 15);

    const pX = gx + 35, pY = gy + 25, pW = gw - 50, pH = gh - 45;
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(pX, pY + pH); ctx.lineTo(pX + pW, pY + pH); ctx.moveTo(pX, pY + pH); ctx.lineTo(pX, pY); ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "8px system-ui, sans-serif";
    ctx.fillText("Wavelength (nm)", pX + pW / 2, pY + pH + 20);
    ctx.fillText("380", pX, pY + pH + 10); ctx.fillText("780", pX + pW, pY + pH + 10);

    const steps = 100;
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const lam = lambdaMin + (s / steps) * (lambdaMax - lambdaMin);
      const px = pX + (s / steps) * pW, py = pY + pH - getReflectance(lam) * pH;
      s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 2; ctx.stroke();

    for (let s = 0; s < steps; s++) {
      const lam = lambdaMin + (s / steps) * (lambdaMax - lambdaMin);
      const refl = getReflectance(lam), rgb = wavelengthToRGB(lam);
      const px = pX + (s / steps) * pW, py = pY + pH - refl * pH;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
      ctx.fillRect(px, py, pW / steps + 1, pY + pH - py);
    }
  }

  function drawInfoPanel(): void {
    const px = 10, py = height * 0.72, pw = width - 20, ph = height * 0.26;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.textAlign = "left"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Thin Film Interference", px + 12, py + 18);

    const tI = incidenceAngle * Math.PI / 180;
    const cosT = Math.sqrt(1 - Math.pow(Math.sin(tI) / refractiveIndex, 2));
    const pd = 2 * refractiveIndex * thickness * cosT;

    ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#fbbf24";
    ctx.fillText("Path difference = 2nt cos(theta_t)", px + 12, py + 38);
    const col2 = px + pw * 0.52; let y = py + 56;
    ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Thickness (t): ${thickness} nm`, px + 12, y); ctx.fillText(`Refractive Index (n): ${refractiveIndex.toFixed(2)}`, col2, y); y += 15;
    ctx.fillText(`Incidence Angle: ${incidenceAngle} deg`, px + 12, y); ctx.fillText(`Optical Path Diff: ${pd.toFixed(1)} nm`, col2, y); y += 15;
    ctx.fillText("Constructive: 2nt cos(theta_t) = (m + 1/2) * lambda  (phase change)", px + 12, y); y += 15;
    ctx.fillText("Destructive: 2nt cos(theta_t) = m * lambda", px + 12, y); y += 15;
    const c = getReflectedColor();
    ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`; ctx.beginPath(); ctx.roundRect(px + 12, y - 8, 60, 14, 4); ctx.fill();
    ctx.fillStyle = "#94a3b8"; ctx.fillText("Perceived reflected color", px + 80, y + 3);
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#1e293b"); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
    ctx.fillText("Thin Film Interference", width / 2, 28);
    drawFilmDiagram(); drawSpectrumBar(); drawReflectanceGraph(); drawInfoPanel();
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const cosT = Math.sqrt(1 - Math.pow(Math.sin(incidenceAngle * Math.PI / 180) / refractiveIndex, 2));
    const pd = 2 * refractiveIndex * thickness * cosT;
    return `Thin Film Interference: t=${thickness} nm, n=${refractiveIndex.toFixed(2)}, angle=${incidenceAngle} deg. ` +
      `Path diff = ${pd.toFixed(1)} nm. Constructive: 2nt=(m+1/2)*lambda (with phase change). ` +
      `Creates rainbow colors in soap bubbles and oil slicks.`;
  }

  function resize(w: number, h: number): void { width = w; height = h; }
  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ThinFilmInterferenceFactory;
