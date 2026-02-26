import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RefractionFishFactory = (): SimulationEngine => {
  const config = getSimConfig("refraction-a-fish-under-water") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  // Water surface wave offsets for visual effect
  let wavePhase = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    time += dt;
    wavePhase = time * 1.5;
  }

  /** Convert depth in meters to screen Y coordinate below water surface */
  function depthToY(depthM: number, surfaceY: number, scale: number): number {
    return surfaceY + depthM * scale;
  }

  /** Convert height above water in meters to screen Y coordinate */
  function heightToY(heightM: number, surfaceY: number, scale: number): number {
    return surfaceY - heightM * scale;
  }

  function drawFish(cx: number, cy: number, size: number, color: string): void {
    ctx.fillStyle = color;
    // Body (ellipse)
    ctx.beginPath();
    ctx.ellipse(cx, cy, size, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.8, cy);
    ctx.lineTo(cx - size * 1.4, cy - size * 0.5);
    ctx.lineTo(cx - size * 1.4, cy + size * 0.5);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx + size * 0.5, cy - size * 0.12, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx + size * 0.55, cy - size * 0.12, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Fin
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.3);
    ctx.lineTo(cx - size * 0.3, cy - size * 0.8);
    ctx.lineTo(cx + size * 0.3, cy - size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  function drawEye(cx: number, cy: number, size: number): void {
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - size, cy);
    ctx.quadraticCurveTo(cx, cy - size * 0.7, cx + size, cy);
    ctx.quadraticCurveTo(cx, cy + size * 0.7, cx - size, cy); ctx.stroke();
    ctx.fillStyle = "#60a5fa"; ctx.beginPath(); ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx + size * 0.1, cy - size * 0.1, size * 0.08, 0, Math.PI * 2); ctx.fill();
  }

  function drawWaterSurface(surfaceY: number): void {
    // Wavy water surface
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const waveY = surfaceY + Math.sin(x * 0.03 + wavePhase) * 3 + Math.sin(x * 0.07 + wavePhase * 0.6) * 1.5;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);

    const fishDepth = currentParams.fishDepth ?? 4;        // meters
    const viewerAngle = currentParams.viewerAngle ?? 45;    // degrees from vertical
    const n = currentParams.refractiveIndex ?? 1.33;        // water refractive index
    const showRays = Math.round(currentParams.showRays ?? 1);

    // Layout
    const surfaceY = height * 0.38;
    const maxDepthM = 12; // max depth in meters for scaling
    const scale = (height - surfaceY - 30) / maxDepthM;

    // Sky (air region)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, surfaceY);
    skyGrad.addColorStop(0, "#1e3a5f"); skyGrad.addColorStop(1, "#87ceeb");
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, width, surfaceY);

    // Water region
    const waterGrad = ctx.createLinearGradient(0, surfaceY, 0, height);
    waterGrad.addColorStop(0, "rgba(14, 116, 144, 0.6)");
    waterGrad.addColorStop(0.5, "rgba(8, 75, 99, 0.8)");
    waterGrad.addColorStop(1, "rgba(3, 40, 55, 0.95)");
    ctx.fillStyle = waterGrad; ctx.fillRect(0, surfaceY, width, height - surfaceY);

    // Water surface
    drawWaterSurface(surfaceY);

    // Surface labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(11, width * 0.014)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Air (n = 1.0)", 10, surfaceY - 15);
    ctx.fillText(`Water (n = ${n.toFixed(2)})`, 10, surfaceY + 22);

    // Actual fish position
    const fishX = width * 0.45;
    const fishY = depthToY(fishDepth, surfaceY, scale);
    const fishSize = Math.max(18, width * 0.035);

    drawFish(fishX, fishY, fishSize, "#f97316");

    // Label actual fish
    ctx.fillStyle = "#f97316";
    ctx.font = `bold ${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`Actual fish (depth: ${fishDepth.toFixed(1)} m)`, fishX, fishY + fishSize * 0.8 + 16);

    // Snell's law: n_air * sin(theta_air) = n_water * sin(theta_water)
    // Viewer looks at angle viewerAngle from vertical (in air)
    const thetaAirRad = (viewerAngle * Math.PI) / 180;

    // Refracted angle in water: sin(theta_water) = (n_air / n_water) * sin(theta_air)
    const sinThetaWater = (1.0 / n) * Math.sin(thetaAirRad);
    const thetaWaterRad = Math.asin(Math.min(sinThetaWater, 0.999));

    // Observer position (above water)
    const observerHeight = 3; // meters above water
    const observerY = heightToY(observerHeight, surfaceY, scale);
    const observerX = width * 0.7;

    drawEye(observerX, observerY, Math.max(14, width * 0.022));
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Observer", observerX, observerY - 22);

    if (showRays) {
      // Point where the refracted ray hits the surface
      // From the fish, a ray travels at angle thetaWater from vertical
      // to reach the surface
      const horizontalInWater = fishDepth * Math.tan(thetaWaterRad);
      const surfaceHitX = fishX + horizontalInWater * (width * 0.03);

      // Clamp to visible area
      const clampedHitX = Math.min(Math.max(surfaceHitX, 20), width - 20);

      // Ray from actual fish to surface (in water)
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fishX, fishY);
      ctx.lineTo(clampedHitX, surfaceY);
      ctx.stroke();

      // Ray from surface to observer (in air, refracted)
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(clampedHitX, surfaceY);
      ctx.lineTo(observerX, observerY);
      ctx.stroke();

      // Normal at surface (vertical dashed line)
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(clampedHitX, surfaceY - 60);
      ctx.lineTo(clampedHitX, surfaceY + 60);
      ctx.stroke();
      ctx.setLineDash([]);

      // Angle arcs
      const arcR = 35;

      // Angle in air (from normal)
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const airAngleStart = -Math.PI / 2;
      const airDir = observerX > clampedHitX ? 1 : -1;
      const airAngleEnd = airAngleStart + airDir * thetaAirRad;
      ctx.arc(clampedHitX, surfaceY, arcR, Math.min(airAngleStart, airAngleEnd), Math.max(airAngleStart, airAngleEnd));
      ctx.stroke();

      ctx.fillStyle = "#60a5fa";
      ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(`theta_1 = ${viewerAngle.toFixed(1)} deg`, clampedHitX + arcR + 5, surfaceY - 20);

      // Angle in water (from normal)
      const thetaWaterDeg = (thetaWaterRad * 180) / Math.PI;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const waterAngleStart = Math.PI / 2;
      const waterAngleEnd = waterAngleStart - thetaWaterRad;
      ctx.arc(clampedHitX, surfaceY, arcR * 0.8, Math.min(waterAngleStart, waterAngleEnd), Math.max(waterAngleStart, waterAngleEnd));
      ctx.stroke();

      ctx.fillStyle = "#22c55e";
      ctx.fillText(`theta_2 = ${thetaWaterDeg.toFixed(1)} deg`, clampedHitX + arcR + 5, surfaceY + 22);

      // Apparent fish position: extend the air ray backward below the surface
      // Observer sees the fish along the line from observer through surface hit point
      // The apparent depth = actual depth * cos(theta_air) / cos(theta_water) ... simplified:
      // apparent depth ~= actual depth / n (for small angles, or more precisely using geometry)
      const apparentDepth = fishDepth * (Math.cos(thetaAirRad) / (n * Math.cos(thetaWaterRad)));
      const apparentFishY = depthToY(apparentDepth, surfaceY, scale);

      // The apparent horizontal position: extrapolate the air ray below the surface
      const airDx = observerX - clampedHitX;
      const airDy = observerY - surfaceY; // negative (above surface)
      const tToApparent = (apparentFishY - surfaceY) / (surfaceY - observerY);
      const apparentFishX = clampedHitX - airDx * tToApparent;

      // Dashed line showing where observer thinks the fish is
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(clampedHitX, surfaceY);
      ctx.lineTo(apparentFishX, apparentFishY);
      ctx.stroke();

      // Another dashed line from observer through surface to apparent
      ctx.beginPath();
      ctx.moveTo(observerX, observerY);
      ctx.lineTo(apparentFishX, apparentFishY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw apparent fish (ghosted)
      ctx.globalAlpha = 0.4;
      drawFish(apparentFishX, apparentFishY, fishSize * 0.9, "#a78bfa");
      ctx.globalAlpha = 1.0;

      // Label apparent fish
      ctx.fillStyle = "#a78bfa";
      ctx.font = `bold ${Math.max(10, width * 0.013)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        `Apparent fish (depth: ${apparentDepth.toFixed(1)} m)`,
        apparentFishX, apparentFishY - fishSize - 8
      );

      // Depth comparison markers
      ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`; ctx.textAlign = "right";
      ctx.strokeStyle = "#f97316"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(width * 0.1, fishY); ctx.lineTo(width * 0.2, fishY); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = "#f97316";
      ctx.fillText(`${fishDepth.toFixed(1)} m`, width * 0.09, fishY + 4);
      if (apparentDepth > 0.1) {
        ctx.strokeStyle = "#a78bfa"; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(width * 0.1, apparentFishY); ctx.lineTo(width * 0.2, apparentFishY); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "#a78bfa";
        ctx.fillText(`${apparentDepth.toFixed(1)} m`, width * 0.09, apparentFishY + 4);
      }
    }

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Refraction: A Fish Under Water", width / 2, 26);

    // Snell's Law formula
    const infoBoxX = width * 0.02;
    const infoBoxY = height * 0.82;
    const infoBoxW = width * 0.96;
    const infoBoxH = height * 0.16;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      `Snell's Law: n1 * sin(theta_1) = n2 * sin(theta_2)`,
      width / 2, infoBoxY + 18
    );

    const thetaWaterDeg = (Math.asin(Math.min((1.0 / n) * Math.sin(thetaAirRad), 0.999)) * 180) / Math.PI;
    const apparentDepthApprox = fishDepth * (Math.cos(thetaAirRad) / (n * Math.cos(thetaWaterDeg * Math.PI / 180)));

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.fillText(
      `1.0 * sin(${viewerAngle.toFixed(1)} deg) = ${n.toFixed(2)} * sin(${thetaWaterDeg.toFixed(1)} deg)  |  ` +
      `Apparent depth: ${apparentDepthApprox.toFixed(2)} m  (Actual: ${fishDepth.toFixed(1)} m)`,
      width / 2, infoBoxY + 38
    );

    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
    ctx.fillText(
      "Light bends away from normal when entering a less dense medium (water to air), making objects appear shallower.",
      width / 2, infoBoxY + 56
    );

    // Legend
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
    ctx.textAlign = "left";
    const legX = infoBoxX + 10;
    const legY2 = infoBoxY + infoBoxH - 10;
    ctx.fillStyle = "#facc15";
    ctx.fillText("Light ray", legX, legY2);
    ctx.fillStyle = "#a78bfa";
    ctx.fillText("Apparent position (dashed)", legX + 80, legY2);
    ctx.fillStyle = "#f97316";
    ctx.fillText("Actual fish", legX + 250, legY2);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
    wavePhase = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const fishDepth = currentParams.fishDepth ?? 4;
    const viewerAngle = currentParams.viewerAngle ?? 45;
    const n = currentParams.refractiveIndex ?? 1.33;

    const thetaAirRad = (viewerAngle * Math.PI) / 180;
    const sinThetaWater = (1.0 / n) * Math.sin(thetaAirRad);
    const thetaWaterRad = Math.asin(Math.min(sinThetaWater, 0.999));
    const thetaWaterDeg = (thetaWaterRad * 180) / Math.PI;
    const apparentDepth = fishDepth * (Math.cos(thetaAirRad) / (n * Math.cos(thetaWaterRad)));

    return (
      `Refraction simulation showing a fish at ${fishDepth.toFixed(1)} m depth underwater. ` +
      `An observer views at ${viewerAngle.toFixed(1)} degrees from vertical. ` +
      `By Snell's Law (n1*sin(theta_1) = n2*sin(theta_2)), light from the fish refracts at the water-air boundary. ` +
      `In water (n=${n.toFixed(2)}), the ray angle is ${thetaWaterDeg.toFixed(1)} degrees; ` +
      `in air (n=1.0), it bends to ${viewerAngle.toFixed(1)} degrees. ` +
      `Light bends away from the normal when passing from water (denser) to air (less dense), ` +
      `making the fish appear at approximately ${apparentDepth.toFixed(2)} m depth -- ` +
      `shallower and closer to the surface than its actual position. ` +
      `This is why spearfishers must aim below where they see a fish.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RefractionFishFactory;
