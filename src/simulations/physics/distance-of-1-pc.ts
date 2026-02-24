import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DistanceOf1PcFactory = (): SimulationEngine => {
  const config = getSimConfig("distance-of-1-pc") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);

    // Space background
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Background stars
    const starSeed = 42;
    for (let i = 0; i < 100; i++) {
      const sx = ((starSeed * i * 7919 + 104729) % width);
      const sy = ((starSeed * i * 6271 + 15485863) % height);
      const brightness = 0.2 + (i % 5) * 0.15;
      ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    const parallaxAngle = currentParams.parallaxAngle ?? 1;
    const showAngles = currentParams.showAngles ?? 1;
    const animateOrbit = currentParams.animateOrbit ?? 1;

    const cx = width * 0.5;
    const cy = height * 0.55;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Stellar Parallax & the Parsec", width / 2, 28);

    // Sun
    const sunR = 18;
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Sun", cx, cy + sunR + 15);

    // Earth orbit
    const orbitR = Math.min(width, height) * 0.15;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth position (animate or static)
    const orbitAngle = animateOrbit >= 0.5 ? time * 0.3 : 0;
    const earthX = cx + orbitR * Math.cos(orbitAngle);
    const earthY = cy + orbitR * Math.sin(orbitAngle);

    // Earth
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(earthX, earthY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(earthX, earthY, 8, 0.3, 1.2);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
    ctx.fillText("Earth", earthX, earthY + 18);

    // Opposite Earth position (6 months later)
    const earthX2 = cx - orbitR * Math.cos(orbitAngle);
    const earthY2 = cy - orbitR * Math.sin(orbitAngle);
    ctx.fillStyle = "#3b82f644";
    ctx.beginPath();
    ctx.arc(earthX2, earthY2, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(8, width * 0.011)}px sans-serif`;
    ctx.fillText("(6 mo.)", earthX2, earthY2 + 15);

    // 1 AU label
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(earthX, earthY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#f59e0b";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("1 AU", (cx + earthX) / 2 + 10, (cy + earthY) / 2 - 8);

    // Star at distance based on parallax angle
    // d(pc) = 1/p(arcsec), displayed star
    const distance_pc = 1 / Math.max(0.01, parallaxAngle);

    // Scale: map parsec distance to screen
    const maxScreenDist = width * 0.35;
    const starScreenDist = Math.min(maxScreenDist, maxScreenDist * Math.min(1, 0.5 / parallaxAngle));
    const starX = cx;
    const starY = cy - orbitR - starScreenDist;

    // Target star
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(starX, Math.max(45, starY), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Star rays
    const starDrawY = Math.max(45, starY);
    ctx.strokeStyle = "#ffffff44";
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(starX + 7 * Math.cos(a), starDrawY + 7 * Math.sin(a));
      ctx.lineTo(starX + 14 * Math.cos(a), starDrawY + 14 * Math.sin(a));
      ctx.stroke();
    }

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Target Star", starX, starDrawY - 20);

    // Parallax angle lines
    if (showAngles >= 0.5) {
      // Line from Earth to star
      ctx.strokeStyle = "#ef444488";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(earthX, earthY);
      ctx.lineTo(starX, starDrawY);
      ctx.stroke();

      // Line from opposite Earth to star
      ctx.beginPath();
      ctx.moveTo(earthX2, earthY2);
      ctx.lineTo(starX, starDrawY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Parallax angle arc
      const arcR = 30;
      const angle1 = Math.atan2(earthY - starDrawY, earthX - starX);
      const angle2 = Math.atan2(earthY2 - starDrawY, earthX2 - starX);

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(starX, starDrawY, arcR, Math.min(angle1, angle2), Math.max(angle1, angle2));
      ctx.stroke();

      // Angle label
      ctx.fillStyle = "#ef4444";
      ctx.font = `bold ${Math.max(11, width * 0.015)}px sans-serif`;
      ctx.textAlign = "left";
      const labelAngle = (angle1 + angle2) / 2;
      ctx.fillText(
        `p = ${parallaxAngle.toFixed(2)}″`,
        starX + (arcR + 8) * Math.cos(labelAngle),
        starDrawY + (arcR + 8) * Math.sin(labelAngle)
      );
    }

    // Info panel
    const panelX = 15;
    const panelY = height - 160;
    const panelW = 290;
    const panelH = 145;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(12, width * 0.016)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText("d = 1/p", panelX + 10, panelY + 22);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(11, width * 0.014)}px monospace`;
    ctx.fillText(`Parallax (p): ${parallaxAngle.toFixed(2)} arcseconds`, panelX + 10, panelY + 44);
    ctx.fillText(`Distance: ${distance_pc.toFixed(2)} parsecs`, panelX + 10, panelY + 64);
    ctx.fillText(`         = ${(distance_pc * 3.2616).toFixed(2)} light-years`, panelX + 10, panelY + 84);
    ctx.fillText(`         = ${(distance_pc * 3.0857e13).toExponential(2)} km`, panelX + 10, panelY + 104);

    ctx.fillStyle = "#fbbf24";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.fillText("1 AU = 1.496 × 10⁸ km", panelX + 10, panelY + 126);
    ctx.fillText("1 pc ≈ 3.26 light-years", panelX + 10, panelY + 142);

    // Angular scale reference
    const refX = width - 170;
    const refY = height - 100;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(refX, refY, 155, 85);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(refX, refY, 155, 85);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Angular Scale:", refX + 10, refY + 18);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
    ctx.fillText("1° = 60 arcminutes", refX + 10, refY + 36);
    ctx.fillText("1′ = 60 arcseconds", refX + 10, refY + 52);
    ctx.fillText("1 pc → p = 1″", refX + 10, refY + 68);
    ctx.fillText("Proxima Cen: p ≈ 0.77″", refX + 10, refY + 82);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const parallaxAngle = currentParams.parallaxAngle ?? 1;
    const distance_pc = 1 / Math.max(0.01, parallaxAngle);

    return `Stellar parallax simulation: Parallax angle p=${parallaxAngle.toFixed(2)} arcseconds, corresponding distance d=1/p=${distance_pc.toFixed(2)} parsecs (${(distance_pc * 3.2616).toFixed(2)} light-years). Parallax is the apparent shift in a star's position as Earth orbits the Sun. Over 6 months, Earth moves 2 AU, creating a baseline for triangulation. One parsec is defined as the distance where a star shows exactly 1 arcsecond of parallax. The nearest star, Proxima Centauri, has parallax ≈0.77″ (distance ≈1.30 pc ≈4.24 ly).`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DistanceOf1PcFactory;
