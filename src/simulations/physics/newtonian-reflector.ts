import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NewtonianReflectorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("newtonian-reflector") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Parameters
  let mirrorDiameter = 200; // mm
  let focalLength = 1000; // mm
  let secondaryOffset = 50; // mm offset of secondary mirror
  let showRays = 1;

  // Telescope geometry
  const TUBE_LEFT = 0.08;
  const TUBE_RIGHT = 0.85;
  const TUBE_CENTER_Y = 0.45;
  const TUBE_HEIGHT_RATIO = 0.25;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(_dt: number, params: Record<string, number>): void {
    mirrorDiameter = params.mirrorDiameter ?? 200;
    focalLength = params.focalLength ?? 1000;
    secondaryOffset = params.secondaryOffset ?? 50;
    showRays = params.showRays ?? 1;
  }

  function drawTube(): void {
    const tubeLeft = width * TUBE_LEFT;
    const tubeRight = width * TUBE_RIGHT;
    const tubeCenter = height * TUBE_CENTER_Y;
    const tubeHalfH = height * TUBE_HEIGHT_RATIO / 2;

    // Tube body
    const tubeGrad = ctx.createLinearGradient(0, tubeCenter - tubeHalfH, 0, tubeCenter + tubeHalfH);
    tubeGrad.addColorStop(0, "#334155");
    tubeGrad.addColorStop(0.15, "#1e293b");
    tubeGrad.addColorStop(0.85, "#1e293b");
    tubeGrad.addColorStop(1, "#334155");
    ctx.fillStyle = tubeGrad;
    ctx.fillRect(tubeLeft, tubeCenter - tubeHalfH, tubeRight - tubeLeft, tubeHalfH * 2);

    // Tube outline
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(tubeLeft, tubeCenter - tubeHalfH, tubeRight - tubeLeft, tubeHalfH * 2);

    // Interior darkening
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(tubeLeft + 3, tubeCenter - tubeHalfH + 3, tubeRight - tubeLeft - 6, tubeHalfH * 2 - 6);
  }

  function drawPrimaryMirror(): void {
    const mirrorX = width * TUBE_LEFT + 15;
    const centerY = height * TUBE_CENTER_Y;
    const halfH = height * TUBE_HEIGHT_RATIO / 2 - 8;

    // Parabolic mirror (concave)
    const curveDepth = 20;

    ctx.beginPath();
    ctx.moveTo(mirrorX, centerY - halfH);
    ctx.quadraticCurveTo(mirrorX + curveDepth, centerY, mirrorX, centerY + halfH);
    ctx.lineTo(mirrorX - 8, centerY + halfH);
    ctx.quadraticCurveTo(mirrorX - 8 + curveDepth * 0.6, centerY, mirrorX - 8, centerY - halfH);
    ctx.closePath();

    const mirrorGrad = ctx.createLinearGradient(mirrorX - 8, 0, mirrorX + curveDepth, 0);
    mirrorGrad.addColorStop(0, "#94a3b8");
    mirrorGrad.addColorStop(0.3, "#e2e8f0");
    mirrorGrad.addColorStop(0.7, "#cbd5e1");
    mirrorGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = mirrorGrad;
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Primary Mirror", mirrorX, centerY + halfH + 25);
    ctx.fillText(`(Parabolic, D=${mirrorDiameter}mm)`, mirrorX, centerY + halfH + 38);
  }

  function drawSecondaryMirror(): void {
    // Secondary flat mirror at 45°, near the focal point
    const fRatio = focalLength / 1200;
    const secX = width * TUBE_LEFT + 15 + (width * (TUBE_RIGHT - TUBE_LEFT) - 30) * Math.min(fRatio, 0.95);
    const centerY = height * TUBE_CENTER_Y;
    const secSize = 20 + secondaryOffset * 0.2;

    // 45° flat mirror
    ctx.save();
    ctx.translate(secX, centerY);
    ctx.rotate(Math.PI / 4);

    const secGrad = ctx.createLinearGradient(-secSize / 2, 0, secSize / 2, 0);
    secGrad.addColorStop(0, "#94a3b8");
    secGrad.addColorStop(0.5, "#e2e8f0");
    secGrad.addColorStop(1, "#94a3b8");
    ctx.fillStyle = secGrad;
    ctx.fillRect(-secSize / 2, -2, secSize, 4);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(-secSize / 2, -2, secSize, 4);

    ctx.restore();

    // Support spider vanes
    const tubeHalfH = height * TUBE_HEIGHT_RATIO / 2;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(secX, centerY - tubeHalfH + 5);
    ctx.lineTo(secX, centerY + tubeHalfH - 5);
    ctx.stroke();

    // Label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Secondary Mirror", secX, centerY - tubeHalfH - 10);
    ctx.fillText("(Flat, 45°)", secX, centerY - tubeHalfH + 3);
  }

  function drawEyepiece(): void {
    const fRatio = focalLength / 1200;
    const secX = width * TUBE_LEFT + 15 + (width * (TUBE_RIGHT - TUBE_LEFT) - 30) * Math.min(fRatio, 0.95);
    const centerY = height * TUBE_CENTER_Y;
    const tubeHalfH = height * TUBE_HEIGHT_RATIO / 2;

    // Eyepiece tube (perpendicular)
    const epLen = 60;
    const epW = 20;
    const epY = centerY - tubeHalfH;

    ctx.fillStyle = "#334155";
    ctx.fillRect(secX - epW / 2, epY - epLen, epW, epLen);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(secX - epW / 2, epY - epLen, epW, epLen);

    // Eyepiece lens
    ctx.beginPath();
    ctx.ellipse(secX, epY - epLen, epW / 2 + 3, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(96, 165, 250, 0.3)";
    ctx.fill();
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eye symbol
    ctx.beginPath();
    ctx.ellipse(secX, epY - epLen - 25, 12, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(secX, epY - epLen - 25, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();

    // Label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Eyepiece", secX + epW / 2 + 5, epY - epLen + 10);
  }

  function drawRays(): void {
    if (showRays < 1) return;

    const tubeLeft = width * TUBE_LEFT + 15;
    const tubeRight = width * TUBE_RIGHT;
    const centerY = height * TUBE_CENTER_Y;
    const halfH = height * TUBE_HEIGHT_RATIO / 2 - 8;

    const fRatio = focalLength / 1200;
    const secX = tubeLeft + (width * (TUBE_RIGHT - TUBE_LEFT) - 30) * Math.min(fRatio, 0.95);
    const tubeHalfH = height * TUBE_HEIGHT_RATIO / 2;

    // Parallel incoming rays (from star)
    const rayOffsets = [-halfH * 0.6, -halfH * 0.3, 0, halfH * 0.3, halfH * 0.6];
    const colors = ["rgba(239, 68, 68, 0.6)", "rgba(251, 191, 36, 0.6)", "rgba(34, 197, 94, 0.6)", "rgba(59, 130, 246, 0.6)", "rgba(168, 85, 247, 0.6)"];

    for (let i = 0; i < rayOffsets.length; i++) {
      const yOff = rayOffsets[i];
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 1.5;

      // Incoming parallel ray (right to left)
      ctx.beginPath();
      ctx.moveTo(tubeRight + 20, centerY + yOff);
      ctx.lineTo(tubeLeft + 15, centerY + yOff);
      ctx.stroke();

      // Reflected from primary to secondary (converging)
      ctx.beginPath();
      ctx.moveTo(tubeLeft + 15, centerY + yOff);
      ctx.lineTo(secX, centerY + yOff * 0.05);
      ctx.stroke();

      // Reflected by secondary upward to eyepiece
      ctx.beginPath();
      ctx.moveTo(secX, centerY + yOff * 0.05);
      ctx.lineTo(secX, centerY - tubeHalfH - 10);
      ctx.stroke();
    }

    // Focal point label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Focal Point", secX, centerY + 15);
  }

  function drawStarField(): void {
    // Stars on the right side (incoming light)
    const starX = width * 0.92;
    for (let i = 0; i < 8; i++) {
      const sx = starX + Math.sin(i * 1.7) * 20;
      const sy = height * 0.1 + i * height * 0.1;
      const r = 1 + Math.random() * 2;

      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }

    // Arrow indicating light direction
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(width * 0.95, height * TUBE_CENTER_Y);
    ctx.lineTo(width * TUBE_RIGHT + 5, height * TUBE_CENTER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Starlight →", width * 0.92, height * TUBE_CENTER_Y - 10);
  }

  function drawInfoPanel(): void {
    const panelX = 15;
    const panelY = height * 0.72;
    const panelW = width - 30;
    const panelH = height * 0.24;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Newtonian Reflector Telescope", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 38;
    const col2 = panelX + panelW / 2;
    const lineH = 16;

    ctx.fillText(`Primary Mirror Diameter: ${mirrorDiameter} mm`, panelX + 10, y);
    ctx.fillText(`Focal Length: ${focalLength} mm`, col2, y); y += lineH;

    const fRatio = focalLength / mirrorDiameter;
    ctx.fillText(`Focal Ratio (f/D): f/${fRatio.toFixed(1)}`, panelX + 10, y);

    const resolution = 116 / mirrorDiameter;
    ctx.fillText(`Angular Resolution: ${resolution.toFixed(2)} arcsec`, col2, y); y += lineH;

    const lightGather = Math.pow(mirrorDiameter / 7, 2);
    ctx.fillText(`Light Gathering: ${lightGather.toFixed(0)}× eye`, panelX + 10, y);

    const magnification = focalLength / 25;
    ctx.fillText(`Max useful mag: ~${magnification.toFixed(0)}×`, col2, y); y += lineH + 5;

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("• Parabolic primary mirror collects and focuses light", panelX + 10, y); y += 14;
    ctx.fillText("• Flat secondary mirror redirects light 90° to the eyepiece (side of tube)", panelX + 10, y); y += 14;
    ctx.fillText("• Invented by Isaac Newton (1668) to avoid chromatic aberration of refracting telescopes", panelX + 10, y);
  }

  function render(): void {
    // Background — night sky
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#020617");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Newtonian Reflector Telescope", width / 2, 28);

    drawStarField();
    drawTube();
    drawPrimaryMirror();
    drawSecondaryMirror();
    drawEyepiece();
    drawRays();
    drawInfoPanel();
  }

  function reset(): void {}

  function destroy(): void {}

  function getStateDescription(): string {
    const fRatio = focalLength / mirrorDiameter;
    const resolution = 116 / mirrorDiameter;
    return (
      `Newtonian Reflector: Primary mirror D=${mirrorDiameter}mm, f=${focalLength}mm, f/${fRatio.toFixed(1)}. ` +
      `Angular resolution: ${resolution.toFixed(2)} arcsec. ` +
      `Light gathering: ${Math.pow(mirrorDiameter / 7, 2).toFixed(0)}× human eye. ` +
      `Parabolic primary focuses parallel starlight. Flat 45° secondary redirects to side-mounted eyepiece. ` +
      `Design by Isaac Newton (1668), avoids chromatic aberration.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NewtonianReflectorFactory;
