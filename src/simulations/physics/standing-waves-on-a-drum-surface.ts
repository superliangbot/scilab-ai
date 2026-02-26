import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StandingWavesOnADrumSurfaceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("standing-waves-on-a-drum-surface") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let modeM = 0; // angular mode (number of nodal diameters)
  let modeN = 1; // radial mode (number of nodal circles)
  let amplitudeScale = 1;
  let animSpeed = 1;

  // Precomputed Bessel function zeros for J_m(x) = 0
  // besselZeros[m][n-1] = nth zero of J_m
  const besselZeros: number[][] = [
    [2.4048, 5.5201, 8.6537, 11.7915], // J_0
    [3.8317, 7.0156, 10.1735, 13.3237], // J_1
    [5.1356, 8.4172, 11.6198, 14.7960], // J_2
    [6.3802, 9.7610, 13.0152, 16.2235], // J_3
    [7.5883, 11.0647, 14.3725, 17.6160], // J_4
  ];

  // Bessel function J_m(x) approximation using series expansion
  function besselJ(m: number, x: number): number {
    if (x === 0) return m === 0 ? 1 : 0;
    let sum = 0;
    for (let k = 0; k < 20; k++) {
      const sign = k % 2 === 0 ? 1 : -1;
      const num = Math.pow(x / 2, 2 * k + m);
      let denom = 1;
      for (let j = 1; j <= k; j++) denom *= j; // k!
      let gammaFactor = 1;
      for (let j = 1; j <= k + m; j++) gammaFactor *= j; // (k+m)!
      const term = sign * num / (denom * gammaFactor);
      sum += term;
      if (Math.abs(term) < 1e-15) break;
    }
    return sum;
  }

  function getZero(m: number, n: number): number {
    const mClamped = Math.min(m, 4);
    const nClamped = Math.min(n, 4);
    if (mClamped < besselZeros.length && nClamped - 1 < besselZeros[mClamped].length) {
      return besselZeros[mClamped][nClamped - 1];
    }
    // Fallback approximation
    return Math.PI * (nClamped + mClamped / 2 - 0.25);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    modeM = Math.round(params.modeM ?? 0);
    modeN = Math.max(1, Math.round(params.modeN ?? 1));
    amplitudeScale = params.amplitude ?? 1;
    animSpeed = params.animSpeed ?? 1;
    time += step;
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a14");
    bgGrad.addColorStop(1, "#10101e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Standing Waves on a Drum Surface (Chladni Patterns)", width / 2, 22);

    const cx = width / 2;
    const cy = height * 0.42;
    const radius = Math.min(width, height) * 0.3;
    const alpha_mn = getZero(modeM, modeN);

    // Frequency for animation
    const omega = animSpeed * 3;

    // Render the drum surface using pixel-level coloring
    const resolution = 2; // pixel step
    const imgData = ctx.createImageData(Math.ceil(radius * 2 / resolution) + 1, Math.ceil(radius * 2 / resolution) + 1);

    for (let py = 0; py < imgData.height; py++) {
      for (let px = 0; px < imgData.width; px++) {
        const worldX = (px * resolution - radius);
        const worldY = (py * resolution - radius);
        const r = Math.sqrt(worldX * worldX + worldY * worldY);
        const rNorm = r / radius;

        if (rNorm > 1) continue;

        const theta = Math.atan2(worldY, worldX);

        // Displacement: u(r, theta, t) = J_m(alpha_mn * r/a) * cos(m * theta) * cos(omega * t)
        const besselVal = besselJ(modeM, alpha_mn * rNorm);
        const angularPart = Math.cos(modeM * theta);
        const timePart = Math.cos(omega * time);
        const displacement = amplitudeScale * besselVal * angularPart * timePart;

        // Normalize displacement to [-1, 1] range
        const maxVal = amplitudeScale;
        const normDisp = Math.max(-1, Math.min(1, displacement / maxVal));

        // Color mapping: red for positive, blue for negative, white for near zero
        let red: number, green: number, blue: number;
        if (normDisp > 0) {
          // Positive: black -> red -> bright red/yellow
          red = Math.round(40 + 215 * normDisp);
          green = Math.round(20 + 80 * normDisp * normDisp);
          blue = Math.round(20);
        } else {
          // Negative: black -> blue -> bright blue/cyan
          const nd = -normDisp;
          red = Math.round(20);
          green = Math.round(20 + 80 * nd * nd);
          blue = Math.round(40 + 215 * nd);
        }

        // Darken edges
        const edgeFade = 1 - Math.pow(rNorm, 4);
        red = Math.round(red * edgeFade);
        green = Math.round(green * edgeFade);
        blue = Math.round(blue * edgeFade);

        const idx = (py * imgData.width + px) * 4;
        imgData.data[idx] = red;
        imgData.data[idx + 1] = green;
        imgData.data[idx + 2] = blue;
        imgData.data[idx + 3] = 255;
      }
    }

    // Draw the image data
    ctx.save();
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imgData.width;
    tempCanvas.height = imgData.height;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.putImageData(imgData, 0, 0);

    // Scale and position
    ctx.drawImage(
      tempCanvas,
      cx - radius, cy - radius,
      radius * 2, radius * 2
    );
    ctx.restore();

    // Drum rim
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(200,200,220,0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner rim highlight
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw nodal lines on top
    ctx.save();
    ctx.globalAlpha = 0.6;

    // Nodal circles (where J_m(alpha_mn * r/a) = 0)
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    for (let nc = 1; nc < modeN; nc++) {
      const zeroVal = getZero(modeM, nc);
      const nodalR = (zeroVal / alpha_mn) * radius;
      if (nodalR < radius && nodalR > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, nodalR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Nodal diameters (where cos(m * theta) = 0)
    if (modeM > 0) {
      for (let d = 0; d < modeM; d++) {
        const angle = (Math.PI / (2 * modeM)) + (d * Math.PI) / modeM;
        ctx.beginPath();
        ctx.moveTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        ctx.lineTo(cx - radius * Math.cos(angle), cy - radius * Math.sin(angle));
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Color legend
    const legendX = width - 50;
    const legendY = cy - 60;
    const legendH = 120;
    const legendW = 16;

    const legGrad = ctx.createLinearGradient(0, legendY, 0, legendY + legendH);
    legGrad.addColorStop(0, "rgb(255, 100, 20)");
    legGrad.addColorStop(0.5, "rgb(20, 20, 20)");
    legGrad.addColorStop(1, "rgb(20, 100, 255)");
    ctx.fillStyle = legGrad;
    ctx.fillRect(legendX, legendY, legendW, legendH);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendW, legendH);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("+", legendX + legendW + 4, legendY + 8);
    ctx.fillText("0", legendX + legendW + 4, legendY + legendH / 2 + 3);
    ctx.fillText("\u2013", legendX + legendW + 4, legendY + legendH - 2);

    // Mode info panel
    ctx.save();
    const panelW = 280;
    const panelH = 115;
    const panelX = 10;
    const panelY = height - panelH - 10;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Mode (${modeM}, ${modeN})`, panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Angular mode m = ${modeM} (nodal diameters)`, panelX + 10, panelY + 38);
    ctx.fillText(`Radial mode n = ${modeN} (nodal circles: ${Math.max(0, modeN - 1)})`, panelX + 10, panelY + 54);
    ctx.fillText(`\u03B1_{${modeM},${modeN}} = ${alpha_mn.toFixed(4)}`, panelX + 10, panelY + 70);

    ctx.fillStyle = "rgba(200,200,255,0.5)";
    ctx.fillText(`u(r,\u03B8,t) = J_${modeM}(\u03B1r/a) cos(${modeM}\u03B8) cos(\u03C9t)`, panelX + 10, panelY + 90);
    ctx.fillText(`f_{${modeM},${modeN}} \u221D \u03B1_{${modeM},${modeN}} (Bessel function zeros)`, panelX + 10, panelY + 106);

    ctx.restore();

    // Nodal line legend
    ctx.save();
    const nlX = width - 180;
    const nlY = height - 50;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(nlX, nlY, 170, 40, 6);
    ctx.fill();

    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(nlX + 10, nlY + 14);
    ctx.lineTo(nlX + 35, nlY + 14);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Nodal lines (zero disp.)", nlX + 40, nlY + 18);
    ctx.fillText("Red = up, Blue = down", nlX + 10, nlY + 34);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // cleanup
  }

  function getStateDescription(): string {
    const alpha_mn = getZero(modeM, modeN);
    return (
      `Drum Surface Standing Waves: mode (m=${modeM}, n=${modeN}). ` +
      `\u03B1_{${modeM},${modeN}}=${alpha_mn.toFixed(4)}. ` +
      `${modeM} nodal diameters, ${Math.max(0, modeN - 1)} nodal circles. ` +
      `Amplitude scale=${amplitudeScale.toFixed(1)}, anim speed=${animSpeed.toFixed(1)}. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StandingWavesOnADrumSurfaceFactory;
