import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LightInterferenceOnCdSurfaceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("light-interference-on-cd-surface") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let wavelength = 550; // nm
  let incidentAngle = 30; // degrees
  let gratingSpacing = 1600; // nm (CD track spacing)

  const CD_TRACK_SPACING = 1600; // nm typical

  function wavelengthToColor(nm: number): string {
    if (nm < 380) return "#7c3aed";
    if (nm < 440) return "#6366f1";
    if (nm < 490) return "#3b82f6";
    if (nm < 510) return "#06b6d4";
    if (nm < 540) return "#10b981";
    if (nm < 580) return "#eab308";
    if (nm < 620) return "#f97316";
    if (nm < 700) return "#ef4444";
    return "#991b1b";
  }

  function wavelengthToRGB(nm: number): [number, number, number] {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) {
      r = -(nm - 440) / (440 - 380);
      b = 1;
    } else if (nm >= 440 && nm < 490) {
      g = (nm - 440) / (490 - 440);
      b = 1;
    } else if (nm >= 490 && nm < 510) {
      g = 1;
      b = -(nm - 510) / (510 - 490);
    } else if (nm >= 510 && nm < 580) {
      r = (nm - 510) / (580 - 510);
      g = 1;
    } else if (nm >= 580 && nm < 645) {
      r = 1;
      g = -(nm - 645) / (645 - 580);
    } else if (nm >= 645 && nm <= 780) {
      r = 1;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // Diffraction grating equation: d * sin(θm) = m * λ
  function diffractionAngle(order: number): number | null {
    const sinTheta = (order * wavelength) / gratingSpacing;
    if (Math.abs(sinTheta) > 1) return null;
    return Math.asin(sinTheta) * 180 / Math.PI;
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
  }

  function update(dt: number, params: Record<string, number>) {
    wavelength = params.wavelength ?? 550;
    incidentAngle = params.incidentAngle ?? 30;
    gratingSpacing = params.gratingSpacing ?? 1600;
    time += Math.min(dt, 0.05);
  }

  function render() {
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Light Interference on CD Surface", W / 2, 28);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`d·sin(θ) = mλ  |  Track spacing: ${gratingSpacing} nm  |  λ = ${wavelength} nm`, W / 2, 48);

    // CD representation
    const cdCx = W / 2;
    const cdCy = H / 2 + 20;
    const cdR = 150;

    // CD disc
    ctx.beginPath();
    ctx.arc(cdCx, cdCy, cdR, 0, Math.PI * 2);
    const cdGrad = ctx.createRadialGradient(cdCx - 30, cdCy - 30, 0, cdCx, cdCy, cdR);
    cdGrad.addColorStop(0, "#475569");
    cdGrad.addColorStop(0.3, "#334155");
    cdGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = cdGrad;
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center hole
    ctx.beginPath();
    ctx.arc(cdCx, cdCy, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#0a0a1a";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Track grooves (concentric circles)
    ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
    ctx.lineWidth = 0.5;
    for (let r = 25; r < cdR; r += 4) {
      ctx.beginPath();
      ctx.arc(cdCx, cdCy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rainbow reflection on CD surface based on angle
    for (let order = -2; order <= 2; order++) {
      if (order === 0) continue;

      // For each visible wavelength, calculate reflection direction
      for (let wl = 380; wl <= 700; wl += 5) {
        const sinTheta = (order * wl) / gratingSpacing;
        if (Math.abs(sinTheta) > 1) continue;
        const theta = Math.asin(sinTheta);

        const [r, g, b] = wavelengthToRGB(wl);
        const angle = incidentAngle * Math.PI / 180 + theta;
        const dist = 30 + Math.abs(order) * 35;

        // Draw color strip on CD
        const stripAngle = angle + time * 0.2;
        for (let a = -0.3; a <= 0.3; a += 0.05) {
          const ax = cdCx + Math.cos(stripAngle + a) * dist;
          const ay = cdCy + Math.sin(stripAngle + a) * dist;
          if (Math.sqrt((ax - cdCx) ** 2 + (ay - cdCy) ** 2) < cdR - 5) {
            ctx.beginPath();
            ctx.arc(ax, ay, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
            ctx.fill();
          }
        }
      }
    }

    // Incident light beam
    const lightSourceX = cdCx - 200;
    const lightSourceY = cdCy - 200;
    const hitX = cdCx;
    const hitY = cdCy - 50;

    // Source glow
    const srcGlow = ctx.createRadialGradient(lightSourceX, lightSourceY, 0, lightSourceX, lightSourceY, 20);
    srcGlow.addColorStop(0, wavelengthToColor(wavelength));
    srcGlow.addColorStop(1, "transparent");
    ctx.fillStyle = srcGlow;
    ctx.beginPath();
    ctx.arc(lightSourceX, lightSourceY, 20, 0, Math.PI * 2);
    ctx.fill();

    // Incident ray
    ctx.strokeStyle = wavelengthToColor(wavelength);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lightSourceX, lightSourceY);
    ctx.lineTo(hitX, hitY);
    ctx.stroke();

    // Wave pattern on incident ray
    const rayLen = Math.sqrt((hitX - lightSourceX) ** 2 + (hitY - lightSourceY) ** 2);
    const rayAngle = Math.atan2(hitY - lightSourceY, hitX - lightSourceX);
    ctx.save();
    ctx.translate(lightSourceX, lightSourceY);
    ctx.rotate(rayAngle);
    ctx.beginPath();
    ctx.strokeStyle = wavelengthToColor(wavelength) + "80";
    ctx.lineWidth = 1;
    const waveScale = wavelength / 50;
    for (let i = 0; i < rayLen; i += 2) {
      const y = Math.sin((i / waveScale + time * 10) * 0.5) * 5;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();
    ctx.restore();

    // Reflected/diffracted beams
    for (let order = -2; order <= 2; order++) {
      const diffAngle = diffractionAngle(order);
      if (diffAngle === null) continue;

      const totalAngle = -Math.PI / 2 + (diffAngle * Math.PI) / 180;
      const beamEndX = hitX + Math.cos(totalAngle) * 200;
      const beamEndY = hitY + Math.sin(totalAngle) * 200;

      const beamColor = order === 0 ? "rgba(255, 255, 255, 0.6)" : wavelengthToColor(wavelength);
      const beamAlpha = order === 0 ? 0.6 : 0.4 / Math.abs(order);

      ctx.strokeStyle = beamColor;
      ctx.lineWidth = order === 0 ? 2 : 1.5;
      ctx.globalAlpha = order === 0 ? 1 : beamAlpha * 2;
      ctx.beginPath();
      ctx.moveTo(hitX, hitY);
      ctx.lineTo(beamEndX, beamEndY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = beamColor;
      ctx.textAlign = "center";
      ctx.fillText(
        order === 0 ? "m=0" : `m=${order} (${diffAngle.toFixed(1)}°)`,
        beamEndX, beamEndY - 10
      );
    }

    // Hit point glow
    const hitGlow = ctx.createRadialGradient(hitX, hitY, 0, hitX, hitY, 15);
    hitGlow.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    hitGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = hitGlow;
    ctx.beginPath();
    ctx.arc(hitX, hitY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Groove detail diagram (bottom)
    const diagY = H - 140;
    const diagH = 90;
    const diagW = W - 40;
    const diagL = 20;

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(diagL, diagY, diagW, diagH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(diagL, diagY, diagW, diagH);

    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Groove Structure (Cross-section)", diagL + 10, diagY + 15);

    // Draw grooves
    const grooveCenterY = diagY + diagH / 2 + 5;
    const grooveSpacing = 50; // visual spacing
    const numGrooves = Math.floor(diagW / grooveSpacing);

    for (let i = 0; i < numGrooves; i++) {
      const gx = diagL + 40 + i * grooveSpacing;
      // Groove (V shape)
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx - 10, grooveCenterY);
      ctx.lineTo(gx, grooveCenterY + 10);
      ctx.lineTo(gx + 10, grooveCenterY);
      ctx.stroke();

      // Incoming wave crests
      const waveOffset = time * 50;
      for (let w = 0; w < 3; w++) {
        const wy = grooveCenterY - 20 - w * 10 - (waveOffset % 10);
        ctx.strokeStyle = wavelengthToColor(wavelength) + "40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx - 15, wy);
        ctx.lineTo(gx + 15, wy);
        ctx.stroke();
      }
    }

    // Spacing label
    if (numGrooves > 1) {
      const g1x = diagL + 40;
      const g2x = diagL + 40 + grooveSpacing;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g1x, grooveCenterY + 18);
      ctx.lineTo(g2x, grooveCenterY + 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g1x, grooveCenterY + 14);
      ctx.lineTo(g1x, grooveCenterY + 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g2x, grooveCenterY + 14);
      ctx.lineTo(g2x, grooveCenterY + 22);
      ctx.stroke();

      ctx.font = "9px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText(`d = ${gratingSpacing} nm`, (g1x + g2x) / 2, grooveCenterY + 30);
    }

    // Condition explanation
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    ctx.fillText("Constructive interference when path difference = mλ", diagL + diagW - 10, diagY + 15);

    // Spectrum bar (bottom)
    const specY = H - 40;
    const specH = 15;
    for (let x = 0; x < W - 40; x++) {
      const wl = 380 + (x / (W - 40)) * 320;
      const [r, g, b] = wavelengthToRGB(wl);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(20 + x, specY, 2, specH);
    }

    // Current wavelength marker
    const markerX = 20 + ((wavelength - 380) / 320) * (W - 40);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(markerX, specY - 3);
    ctx.lineTo(markerX, specY + specH + 3);
    ctx.stroke();
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(`${wavelength} nm`, markerX, specY - 6);

    // Axis labels for spectrum
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText("380nm", 20, specY + specH + 12);
    ctx.textAlign = "right";
    ctx.fillText("700nm", W - 20, specY + specH + 12);
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    const orders: string[] = [];
    for (let m = -2; m <= 2; m++) {
      const angle = diffractionAngle(m);
      if (angle !== null) orders.push(`m=${m}: ${angle.toFixed(1)}°`);
    }
    return (
      `CD Surface Interference: λ=${wavelength}nm, track spacing=${gratingSpacing}nm. ` +
      `Incident angle: ${incidentAngle}°. Diffraction orders: ${orders.join(", ")}. ` +
      `Equation: d·sin(θ) = mλ. CDs act as diffraction gratings — microscopic grooves ` +
      `reflect light at different angles depending on wavelength, producing rainbow colors.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LightInterferenceOnCdSurfaceFactory;
