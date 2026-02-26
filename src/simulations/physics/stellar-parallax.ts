import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StellarParallaxFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stellar-parallax") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let starDistance = 5;
  let earthOrbitRadius = 50;
  let showAngles = 1;
  let animSpeed = 1;

  interface BgStar {
    x: number;
    y: number;
    brightness: number;
    size: number;
  }

  let bgStars: BgStar[] = [];

  function generateBgStars(): void {
    bgStars = [];
    for (let i = 0; i < 120; i++) {
      bgStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        brightness: 0.3 + Math.random() * 0.7,
        size: 0.5 + Math.random() * 1.5,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    generateBgStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    starDistance = params.starDistance ?? 5;
    earthOrbitRadius = params.earthOrbitRadius ?? 50;
    showAngles = params.showAngles ?? 1;
    animSpeed = params.animSpeed ?? 1;
    time += step * animSpeed;
  }

  function render(): void {
    // Dark space background
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, "#0d1117");
    bgGrad.addColorStop(1, "#000005");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw background stars (fixed)
    for (const s of bgStars) {
      ctx.fillStyle = `rgba(200,210,255,${s.brightness * 0.6})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    const cx = width * 0.4;
    const cy = height * 0.55;

    // Sun at center
    const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
    sunGrad.addColorStop(0, "#fff8e1");
    sunGrad.addColorStop(0.5, "#ffd54f");
    sunGrad.addColorStop(1, "#ff8f00");
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Sun glow
    ctx.shadowColor = "#ffd54f";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sun", cx, cy + 28);

    // Earth orbit
    ctx.strokeStyle = "rgba(100,150,255,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, earthOrbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth position
    const earthAngle = time * 0.8;
    const ex = cx + earthOrbitRadius * Math.cos(earthAngle);
    const ey = cy + earthOrbitRadius * Math.sin(earthAngle);

    // Earth
    const earthGrad = ctx.createRadialGradient(ex - 2, ey - 2, 0, ex, ey, 8);
    earthGrad.addColorStop(0, "#64b5f6");
    earthGrad.addColorStop(0.6, "#1565c0");
    earthGrad.addColorStop(1, "#0d47a1");
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(ex, ey, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#90caf9";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth", ex, ey + 18);

    // Nearby target star position (shifted by parallax)
    const parallaxAngle = 1 / starDistance; // arcseconds
    const visualShift = (earthOrbitRadius / starDistance) * 0.8;
    const nearStarBaseX = width * 0.78;
    const nearStarBaseY = height * 0.35;
    const nearStarX = nearStarBaseX + visualShift * Math.cos(earthAngle + Math.PI);
    const nearStarY = nearStarBaseY + visualShift * Math.sin(earthAngle + Math.PI) * 0.5;

    // Draw line from Earth to nearby star
    ctx.strokeStyle = "rgba(255,200,100,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(nearStarX, nearStarY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Parallax ellipse trace
    ctx.strokeStyle = "rgba(255,180,50,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const px = nearStarBaseX + visualShift * Math.cos(a + Math.PI);
      const py = nearStarBaseY + visualShift * Math.sin(a + Math.PI) * 0.5;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Nearby star
    const starGrad = ctx.createRadialGradient(nearStarX, nearStarY, 0, nearStarX, nearStarY, 6);
    starGrad.addColorStop(0, "#ffffff");
    starGrad.addColorStop(0.4, "#ffcc80");
    starGrad.addColorStop(1, "#ff8a00");
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(nearStarX, nearStarY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Star glow
    ctx.shadowColor = "#ffcc80";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(nearStarX, nearStarY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffcc80";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Nearby Star", nearStarX, nearStarY + 16);

    // Show parallax angle annotation
    if (showAngles > 0.5) {
      // Draw angle arc at the nearby star
      const dx1 = cx - nearStarBaseX;
      const dy1 = cy - nearStarBaseY;
      const baseAngleToSun = Math.atan2(dy1, dx1);

      // Angle lines from star to two extreme Earth positions
      const e1x = cx + earthOrbitRadius;
      const e2x = cx - earthOrbitRadius;

      ctx.strokeStyle = "rgba(100,255,150,0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(nearStarBaseX, nearStarBaseY);
      ctx.lineTo(e1x, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(nearStarBaseX, nearStarBaseY);
      ctx.lineTo(e2x, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Parallax angle arc
      const a1 = Math.atan2(cy - nearStarBaseY, e1x - nearStarBaseX);
      const a2 = Math.atan2(cy - nearStarBaseY, e2x - nearStarBaseX);
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(nearStarBaseX, nearStarBaseY, 30, Math.min(a1, a2), Math.max(a1, a2));
      ctx.stroke();

      ctx.fillStyle = "#4caf50";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`p = ${parallaxAngle.toFixed(3)}"`, nearStarBaseX + 35, nearStarBaseY - 5);
    }

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.roundRect(10, 10, width * 0.55, 105, 8);
    ctx.fill();

    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText("Stellar Parallax", 20, 30);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#aaddff";
    ctx.fillText(`Star distance: d = ${starDistance.toFixed(1)} parsecs`, 20, 50);
    ctx.fillText(`Parallax angle: p = 1/d = ${parallaxAngle.toFixed(4)} arcseconds`, 20, 68);
    ctx.fillStyle = "#ffddaa";
    ctx.fillText(`Distance (ly): ${(starDistance * 3.262).toFixed(1)} light-years`, 20, 86);
    ctx.fillStyle = "#ccc";
    ctx.fillText(`Formula: d = 1/p (parsecs) where p in arcseconds`, 20, 104);

    // Orbit phase indicator
    const phase = ((earthAngle % (Math.PI * 2)) / (Math.PI * 2) * 360).toFixed(0);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(width - 130, height - 35, 120, 25, 6);
    ctx.fill();
    ctx.fillStyle = "#90caf9";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Orbit phase: ${phase}\u00B0`, width - 70, height - 18);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const parallaxAngle = 1 / starDistance;
    return (
      `Stellar Parallax simulation: nearby star at d=${starDistance.toFixed(1)} parsecs. ` +
      `Parallax angle p = 1/d = ${parallaxAngle.toFixed(4)} arcseconds. ` +
      `Distance = ${(starDistance * 3.262).toFixed(1)} light-years. ` +
      `Earth orbit radius (visual) = ${earthOrbitRadius} px. ` +
      `As Earth orbits the Sun, the nearby star appears to shift against the background stars.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    generateBgStars();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StellarParallaxFactory;
