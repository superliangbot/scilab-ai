import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RainbowFormationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rainbow-formation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let sunElevation = 30;
  let rainIntensity = 5;
  let showSecondary = 0;
  let observerHeight = 1;

  interface Raindrop {
    x: number; y: number;
    size: number;
    speed: number;
    alpha: number;
  }

  let drops: Raindrop[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initDrops();
  }

  function initDrops(): void {
    drops = [];
    const count = Math.round(rainIntensity * 20);
    for (let i = 0; i < count; i++) {
      drops.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.7,
        size: 1 + Math.random() * 2,
        speed: 100 + Math.random() * 100,
        alpha: 0.2 + Math.random() * 0.3,
      });
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    const prevIntensity = rainIntensity;
    sunElevation = params.sunElevation ?? 30;
    rainIntensity = params.rainIntensity ?? 5;
    showSecondary = params.showSecondary ?? 0;
    observerHeight = params.observerHeight ?? 1;
    time += dt;

    if (Math.abs(prevIntensity - rainIntensity) > 0.5) initDrops();

    for (const d of drops) {
      d.y += d.speed * dt;
      if (d.y > height * 0.75) {
        d.y = -10;
        d.x = Math.random() * width;
      }
    }
  }

  function render(): void {
    // Sky gradient based on sun elevation
    const skyBrightness = Math.min(1, sunElevation / 60);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, `rgba(${40 + 80 * skyBrightness}, ${80 + 100 * skyBrightness}, ${150 + 80 * skyBrightness}, 1)`);
    bgGrad.addColorStop(0.6, `rgba(${60 + 60 * skyBrightness}, ${100 + 60 * skyBrightness}, ${160 + 40 * skyBrightness}, 1)`);
    bgGrad.addColorStop(1, "#2a4a2a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground
    const groundY = height * 0.75;
    ctx.fillStyle = "#2a5a2a";
    ctx.fillRect(0, groundY, width, height - groundY);

    // Sun
    const sunAngleRad = (sunElevation * Math.PI) / 180;
    const sunX = width * 0.12;
    const sunY = groundY - Math.sin(sunAngleRad) * height * 0.5;

    // Sun glow
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 60);
    sunGlow.addColorStop(0, "rgba(255, 240, 180, 0.8)");
    sunGlow.addColorStop(0.5, "rgba(255, 200, 100, 0.2)");
    sunGlow.addColorStop(1, "rgba(255, 200, 100, 0)");
    ctx.beginPath();
    ctx.arc(sunX, sunY, 60, 0, Math.PI * 2);
    ctx.fillStyle = sunGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#ffdd44";
    ctx.fill();

    // Sun rays
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + time * 0.2;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(angle) * 22, sunY + Math.sin(angle) * 22);
      ctx.lineTo(sunX + Math.cos(angle) * 30, sunY + Math.sin(angle) * 30);
      ctx.strokeStyle = "rgba(255, 220, 100, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Rain
    for (const d of drops) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 0.5, d.y + d.size * 5);
      ctx.strokeStyle = `rgba(150, 180, 220, ${d.alpha})`;
      ctx.lineWidth = d.size * 0.5;
      ctx.stroke();
    }

    // Primary rainbow
    const observerX = width * 0.5;
    const observerY = groundY + 5;
    const antiSolarAngle = Math.PI - sunAngleRad; // direction opposite to sun
    const rainbowAngleMin = (40 * Math.PI) / 180;
    const rainbowAngleMax = (42.5 * Math.PI) / 180;

    // Rainbow centered on anti-solar point
    const antiSolarY = observerY + Math.sin(sunAngleRad) * height;
    const arcCenterX = observerX + (width * 0.3);
    const arcCenterY = groundY + Math.sin(sunAngleRad) * height * 0.4;

    const primaryR = height * 0.45 * observerHeight;

    // Primary rainbow bands
    const colors = [
      { color: "rgba(255, 0, 0, 0.5)", r: primaryR + 20 },
      { color: "rgba(255, 127, 0, 0.5)", r: primaryR + 14 },
      { color: "rgba(255, 255, 0, 0.5)", r: primaryR + 8 },
      { color: "rgba(0, 200, 0, 0.5)", r: primaryR + 2 },
      { color: "rgba(0, 0, 255, 0.5)", r: primaryR - 4 },
      { color: "rgba(75, 0, 130, 0.5)", r: primaryR - 10 },
      { color: "rgba(148, 0, 211, 0.5)", r: primaryR - 16 },
    ];

    for (const band of colors) {
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, band.r, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.strokeStyle = band.color;
      ctx.lineWidth = 8;
      ctx.stroke();
    }

    // Secondary rainbow (reversed colors, fainter)
    if (showSecondary) {
      const secondaryR = primaryR * 1.35;
      const secColors = [...colors].reverse();
      for (const band of secColors) {
        const idx = secColors.indexOf(band);
        ctx.beginPath();
        ctx.arc(arcCenterX, arcCenterY, secondaryR + idx * 6, -Math.PI * 0.88, -Math.PI * 0.12);
        ctx.strokeStyle = band.color.replace("0.5", "0.25");
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      // Alexander's dark band (between primary and secondary)
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, primaryR + 30, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.arc(arcCenterX, arcCenterY, secondaryR - 10, -Math.PI * 0.15, -Math.PI * 0.85, true);
      ctx.closePath();
      ctx.fillStyle = "rgba(0, 0, 30, 0.15)";
      ctx.fill();
    }

    // Observer
    ctx.fillStyle = "#553333";
    ctx.beginPath();
    ctx.arc(observerX, groundY - 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(observerX - 3, groundY - 10, 6, 12);
    // Legs
    ctx.strokeStyle = "#553333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(observerX - 3, groundY + 2);
    ctx.lineTo(observerX - 6, groundY + 10);
    ctx.moveTo(observerX + 3, groundY + 2);
    ctx.lineTo(observerX + 6, groundY + 10);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Observer", observerX, groundY + 22);

    // Sight lines (dashed)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const sightAngle1 = -Math.PI * 0.5 + rainbowAngleMin;
    const sightAngle2 = -Math.PI * 0.5 - rainbowAngleMin;
    ctx.beginPath();
    ctx.moveTo(observerX, groundY - 15);
    ctx.lineTo(observerX + Math.cos(sightAngle1) * 200, groundY - 15 + Math.sin(sightAngle1) * 200);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(observerX, groundY - 15);
    ctx.lineTo(observerX + Math.cos(sightAngle2) * 200, groundY - 15 + Math.sin(sightAngle2) * 200);
    ctx.stroke();
    ctx.setLineDash([]);

    // Angle label
    ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("~42°", observerX + 50, groundY - 60);

    // Info panel
    const panelX = width * 0.02;
    const panelY = height * 0.02;
    const panelW = width * 0.35;
    const panelH = height * 0.25;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();

    let py = panelY + 20;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Rainbow Formation", panelX + 12, py);
    py += 22;

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(180, 220, 255, 0.8)";
    const info = [
      `Sun elevation: ${sunElevation.toFixed(0)}°`,
      `Rainbow arc angle: ~42° from anti-solar point`,
      `Primary: refraction → reflection → refraction`,
      showSecondary ? `Secondary: double internal reflection` : "",
    ];
    for (const line of info) {
      if (line) { ctx.fillText(line, panelX + 12, py); py += 16; }
    }

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    initDrops();
  }

  function destroy(): void { drops = []; }

  function getStateDescription(): string {
    return (
      `Rainbow formation: Sun elevation ${sunElevation}°, rain intensity ${rainIntensity}. ` +
      `Primary rainbow forms at ~42° from the anti-solar point due to refraction and ` +
      `internal reflection in raindrops. Red is on the outside (42.4°), violet inside (39.2°). ` +
      `${showSecondary ? "Secondary rainbow visible at ~51°, with reversed color order (double reflection)." : "Secondary rainbow hidden."} ` +
      `Alexander's dark band exists between primary and secondary rainbows. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RainbowFormationFactory;
