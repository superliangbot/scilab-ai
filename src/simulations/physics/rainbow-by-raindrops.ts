import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RainbowByRaindropsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rainbow-by-raindrops") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let dropletSize = 50;
  let sunAngle = 42;
  let showRays = 1;
  let numRays = 8;

  const spectralRays = [
    { color: "#ff0000", name: "Red", angle: 42.4, n: 1.331 },
    { color: "#ff7700", name: "Orange", angle: 41.7, n: 1.333 },
    { color: "#ffdd00", name: "Yellow", angle: 41.2, n: 1.334 },
    { color: "#00cc00", name: "Green", angle: 40.7, n: 1.336 },
    { color: "#0044ff", name: "Blue", angle: 40.0, n: 1.338 },
    { color: "#4400aa", name: "Indigo", angle: 39.5, n: 1.340 },
    { color: "#8800cc", name: "Violet", angle: 39.2, n: 1.342 },
  ];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    dropletSize = params.dropletSize ?? 50;
    sunAngle = params.sunAngle ?? 42;
    showRays = params.showRays ?? 1;
    numRays = Math.round(params.numRays ?? 8);
    time += dt;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#1a2a4a");
    bgGrad.addColorStop(1, "#0a1a2a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Large droplet in center
    const dropX = width * 0.4;
    const dropY = height * 0.45;
    const dropR = dropletSize * 1.2;

    // Draw droplet
    const dropGrad = ctx.createRadialGradient(dropX - dropR * 0.2, dropY - dropR * 0.2, 0, dropX, dropY, dropR);
    dropGrad.addColorStop(0, "rgba(180, 220, 255, 0.25)");
    dropGrad.addColorStop(0.7, "rgba(100, 160, 220, 0.15)");
    dropGrad.addColorStop(1, "rgba(60, 120, 200, 0.08)");
    ctx.beginPath();
    ctx.arc(dropX, dropY, dropR, 0, Math.PI * 2);
    ctx.fillStyle = dropGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 200, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Highlight
    ctx.beginPath();
    ctx.arc(dropX - dropR * 0.25, dropY - dropR * 0.25, dropR * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fill();

    // Draw light rays through droplet
    if (showRays) {
      for (const ray of spectralRays) {
        drawRayThroughDrop(dropX, dropY, dropR, ray);
      }
    }

    // Draw incoming sunlight (white)
    ctx.strokeStyle = "rgba(255, 255, 200, 0.6)";
    ctx.lineWidth = 2;
    const sunDirX = Math.cos((sunAngle * Math.PI) / 180);
    const sunDirY = -Math.sin((sunAngle * Math.PI) / 180);
    for (let i = -3; i <= 3; i++) {
      const offsetY = i * 12;
      ctx.beginPath();
      ctx.moveTo(dropX - sunDirX * 200, dropY + offsetY - sunDirY * 200);
      ctx.lineTo(dropX - sunDirX * 30, dropY + offsetY);
      ctx.stroke();
    }

    // Sun icon
    const sunX = 50;
    const sunY = height * 0.2;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcc00";
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(angle) * 24, sunY + Math.sin(angle) * 24);
      ctx.lineTo(sunX + Math.cos(angle) * 32, sunY + Math.sin(angle) * 32);
      ctx.strokeStyle = "#ffcc00";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 255, 200, 0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sunlight", sunX, sunY + 38);

    // Observer eye icon
    const eyeX = width * 0.75;
    const eyeY = height * 0.5;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 15, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#4488ff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Observer", eyeX, eyeY + 22);

    // Rainbow arc (showing how multiple drops create the rainbow)
    const arcCenterX = width * 0.75;
    const arcCenterY = height * 1.2;
    for (let i = spectralRays.length - 1; i >= 0; i--) {
      const ray = spectralRays[i];
      const arcR = height * 0.6 + i * 12;
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, arcR, -Math.PI * 0.6, -Math.PI * 0.25);
      ctx.strokeStyle = ray.color;
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Angle indicator
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(dropX, dropY);
    ctx.lineTo(dropX + 100, dropY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dropX, dropY);
    const devAngle = -(42 * Math.PI) / 180;
    ctx.lineTo(dropX + 100 * Math.cos(devAngle), dropY + 100 * Math.sin(devAngle));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(dropX, dropY, 40, 0, devAngle, true);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("42°", dropX + 45, dropY - 10);

    // Info panel
    const panelX = width * 0.02;
    const panelY = height * 0.7;
    const panelW = width * 0.55;
    const panelH = height * 0.27;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();

    let py = panelY + 20;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Rainbow by Raindrops", panelX + 12, py);
    py += 22;

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(180, 220, 255, 0.8)";
    ctx.fillText("Light enters raindrop → refracts → reflects internally → refracts out", panelX + 12, py);
    py += 18;
    ctx.fillText("Different wavelengths refract at different angles (dispersion)", panelX + 12, py);
    py += 18;
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.fillText(`Red: ~42.4°  |  Violet: ~39.2°  |  Sun elevation: ${sunAngle}°`, panelX + 12, py);
    py += 18;

    // Color legend
    for (let i = 0; i < spectralRays.length; i++) {
      const r = spectralRays[i];
      const lx = panelX + 12 + i * 70;
      ctx.fillStyle = r.color;
      ctx.fillRect(lx, py, 8, 8);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(`${r.name}`, lx + 12, py + 8);
    }

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("How Raindrops Create Rainbows", width / 2, 25);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function drawRayThroughDrop(dx: number, dy: number, dr: number, ray: { color: string; angle: number; n: number }): void {
    // Simplified ray trace: entry, internal reflection, exit
    const entryAngle = 0.3; // impact parameter position
    const entryX = dx - dr;
    const entryY = dy - dr * entryAngle;

    // Entry point on circle
    const eAngle = Math.PI + entryAngle * 0.5;
    const ex = dx + dr * Math.cos(eAngle);
    const ey = dy + dr * Math.sin(eAngle);

    // Internal reflection point (back of drop)
    const rAngle = eAngle + Math.PI * 0.6;
    const rx = dx + dr * Math.cos(rAngle);
    const ry = dy + dr * Math.sin(rAngle);

    // Exit point
    const exitAngle = rAngle + Math.PI * 0.55 + (42.4 - ray.angle) * 0.02;
    const oxx = dx + dr * Math.cos(exitAngle);
    const oxy = dy + dr * Math.sin(exitAngle);

    ctx.beginPath();
    // Incoming
    ctx.moveTo(ex - 60, ey - 10);
    ctx.lineTo(ex, ey);
    // Inside drop to reflection
    ctx.lineTo(rx, ry);
    // Reflection to exit
    ctx.lineTo(oxx, oxy);
    // Outgoing
    const outDx = oxx - rx;
    const outDy = oxy - ry;
    const outLen = Math.sqrt(outDx * outDx + outDy * outDy);
    ctx.lineTo(oxx + (outDx / outLen) * 200, oxy + (outDy / outLen) * 200);

    ctx.strokeStyle = ray.color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `Rainbow by raindrops: Showing how sunlight disperses through a spherical raindrop. ` +
      `Droplet size: ${dropletSize}px, sun angle: ${sunAngle}°. ` +
      `Light refracts entering the drop, reflects off the back, and refracts again on exit. ` +
      `Red light exits at ~42.4° and violet at ~39.2° from the anti-solar point, ` +
      `creating the primary rainbow arc. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RainbowByRaindropsFactory;
