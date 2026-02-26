import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NewtonRingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("newton-ring") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Parameters
  let lensRadius = 200; // Radius of curvature (cm)
  let wavelength = 550; // nm (green light default)
  let refractiveIndex = 1.0; // medium between lens and plate
  let showCrossSection = 1;

  // Computed values
  let ringRadii: number[] = [];
  const MAX_RINGS = 25;

  function wavelengthToColor(wl: number): { r: number; g: number; b: number } {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) {
      r = -(wl - 440) / (440 - 380); b = 1;
    } else if (wl >= 440 && wl < 490) {
      g = (wl - 440) / (490 - 440); b = 1;
    } else if (wl >= 490 && wl < 510) {
      g = 1; b = -(wl - 510) / (510 - 490);
    } else if (wl >= 510 && wl < 580) {
      r = (wl - 510) / (580 - 510); g = 1;
    } else if (wl >= 580 && wl < 645) {
      r = 1; g = -(wl - 645) / (645 - 580);
    } else if (wl >= 645 && wl <= 780) {
      r = 1;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  function computeRings(): void {
    ringRadii = [];
    // r_n = sqrt(n * lambda * R / mu)
    // lambda in meters, R in meters
    const lambdaM = wavelength * 1e-9;
    const rM = lensRadius * 1e-2;

    for (let n = 0; n <= MAX_RINGS; n++) {
      const rn = Math.sqrt(n * lambdaM * rM / refractiveIndex);
      ringRadii.push(rn * 1e3); // Convert to mm for display
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    computeRings();
  }

  function update(_dt: number, params: Record<string, number>): void {
    lensRadius = params.lensRadius ?? 200;
    wavelength = params.wavelength ?? 550;
    refractiveIndex = params.refractiveIndex ?? 1.0;
    showCrossSection = params.showCrossSection ?? 1;
    computeRings();
  }

  function drawRingPattern(): void {
    const cx = width * 0.35;
    const cy = height * 0.45;
    const maxVisualRadius = Math.min(width * 0.3, height * 0.38);

    if (ringRadii.length < 2) return;
    const maxRingRadius = ringRadii[ringRadii.length - 1];
    const scale = maxVisualRadius / Math.max(maxRingRadius, 0.001);

    const color = wavelengthToColor(wavelength);

    // Draw ring pattern using radial interference
    // Create the pattern by drawing concentric rings
    for (let r = maxVisualRadius; r >= 0; r -= 0.5) {
      const physicalR = r / scale; // in mm
      // Air gap thickness: t = r^2 / (2R)
      const rMeters = physicalR * 1e-3;
      const rCurvMeters = lensRadius * 1e-2;
      const airGap = (rMeters * rMeters) / (2 * rCurvMeters);
      // Path difference = 2 * mu * t (plus lambda/2 for phase change on reflection)
      const lambdaM = wavelength * 1e-9;
      const pathDiff = 2 * refractiveIndex * airGap + lambdaM / 2;
      // Intensity: cos^2(pi * pathDiff / lambda)
      const phase = (pathDiff / lambdaM) * Math.PI;
      const intensity = Math.cos(phase) * Math.cos(phase);

      ctx.strokeStyle = `rgba(${Math.round(color.r * intensity)}, ${Math.round(color.g * intensity)}, ${Math.round(color.b * intensity)}, 1)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ring labels for first few dark rings
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    for (let n = 1; n <= Math.min(5, ringRadii.length - 1); n++) {
      const visualR = ringRadii[n] * scale;
      if (visualR > maxVisualRadius) break;
      ctx.fillText(`n=${n}`, cx + visualR + 3, cy - 3);
    }

    // Center label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Dark center", cx, cy + maxVisualRadius + 18);
    ctx.fillText("(destructive interference)", cx, cy + maxVisualRadius + 30);
  }

  function drawCrossSection(): void {
    if (showCrossSection < 1) return;

    const diagX = width * 0.62;
    const diagY = height * 0.08;
    const diagW = width * 0.34;
    const diagH = height * 0.4;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(diagX, diagY, diagW, diagH, 8);
    ctx.fill();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Cross Section", diagX + diagW / 2, diagY + 16);

    const centerX = diagX + diagW / 2;
    const plateY = diagY + diagH * 0.7;
    const lensY = plateY - 10;

    // Glass plate (flat)
    ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
    ctx.fillRect(diagX + 20, plateY, diagW - 40, 15);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(diagX + 20, plateY);
    ctx.lineTo(diagX + diagW - 20, plateY);
    ctx.stroke();

    // Convex lens (curved bottom surface)
    const lensHalfW = diagW * 0.35;
    const curveHeight = 30;
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - lensHalfW, lensY - curveHeight);
    ctx.quadraticCurveTo(centerX, lensY, centerX + lensHalfW, lensY - curveHeight);
    ctx.stroke();

    // Top surface of lens (flat or slightly curved)
    ctx.beginPath();
    ctx.moveTo(centerX - lensHalfW, lensY - curveHeight);
    ctx.lineTo(centerX - lensHalfW, lensY - curveHeight - 12);
    ctx.quadraticCurveTo(centerX, lensY - curveHeight - 18, centerX + lensHalfW, lensY - curveHeight - 12);
    ctx.lineTo(centerX + lensHalfW, lensY - curveHeight);
    ctx.strokeStyle = "#60a5fa";
    ctx.stroke();

    // Air gap indication
    ctx.fillStyle = "#fbbf24";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Air gap (t)", centerX + 50, lensY - 5);

    // Arrows showing air gap
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    const arrowX = centerX + 40;
    ctx.beginPath();
    ctx.moveTo(arrowX, lensY - curveHeight * 0.3);
    ctx.lineTo(arrowX, plateY);
    ctx.stroke();

    // Incident ray
    const color = wavelengthToColor(wavelength);
    ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(centerX - 20, diagY + 30);
    ctx.lineTo(centerX, lensY - curveHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Reflected rays
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, lensY - curveHeight);
    ctx.lineTo(centerX + 20, diagY + 30);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#60a5fa";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Plano-convex lens", centerX, lensY - curveHeight - 25);
    ctx.fillText("Glass plate", centerX, plateY + 25);
    ctx.fillText(`R = ${lensRadius} cm`, centerX, diagY + diagH - 10);
  }

  function drawInfoPanel(): void {
    const panelX = width * 0.62;
    const panelY = height * 0.52;
    const panelW = width * 0.34;
    const panelH = height * 0.42;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Newton's Rings", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 40;
    const lineH = 17;

    ctx.fillText(`Wavelength: ${wavelength} nm`, panelX + 10, y); y += lineH;
    ctx.fillText(`Lens Radius (R): ${lensRadius} cm`, panelX + 10, y); y += lineH;
    ctx.fillText(`Refractive Index (μ): ${refractiveIndex.toFixed(2)}`, panelX + 10, y); y += lineH;

    y += 5;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("Dark Ring Formula:", panelX + 10, y); y += lineH;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("rₙ = √(nλR/μ)", panelX + 10, y); y += lineH + 3;

    // Ring radii table
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Ring radii (dark rings):", panelX + 10, y); y += lineH;

    for (let n = 1; n <= Math.min(8, ringRadii.length - 1); n++) {
      ctx.fillText(`n=${n}: r = ${ringRadii[n].toFixed(3)} mm`, panelX + 15, y);
      y += 14;
    }

    y += 5;
    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("• Center is dark (λ/2 phase shift)", panelX + 10, y); y += 13;
    ctx.fillText("• Bright rings: r = √((n+½)λR/μ)", panelX + 10, y); y += 13;
    ctx.fillText("• Used to measure λ or R of lens", panelX + 10, y);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1222");
    bgGrad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Newton's Rings — Thin Film Interference", width / 2, 28);

    drawRingPattern();
    drawCrossSection();
    drawInfoPanel();
  }

  function reset(): void {
    computeRings();
  }

  function destroy(): void {
    ringRadii = [];
  }

  function getStateDescription(): string {
    const r1 = ringRadii.length > 1 ? ringRadii[1].toFixed(3) : "N/A";
    const r5 = ringRadii.length > 5 ? ringRadii[5].toFixed(3) : "N/A";
    return (
      `Newton's Rings: λ=${wavelength} nm, R=${lensRadius} cm, μ=${refractiveIndex.toFixed(2)}. ` +
      `Dark ring formula: rₙ = √(nλR/μ). ` +
      `1st dark ring radius: ${r1} mm, 5th: ${r5} mm. ` +
      `Center is dark due to λ/2 phase shift at glass-air reflection. ` +
      `Pattern shows concentric interference rings from thin air film between plano-convex lens and flat glass.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NewtonRingFactory;
