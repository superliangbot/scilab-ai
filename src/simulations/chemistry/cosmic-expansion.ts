import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Galaxy {
  /** Initial distance from observer (Mpc) */
  d0: number;
  /** Angle from observer (radians) */
  angle: number;
  /** Base color hue (degrees) */
  hue: number;
  /** Size factor */
  size: number;
  /** Spiral arm rotation offset */
  spiralOffset: number;
}

const CosmicExpansionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cosmic-expansion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let hubbleConstant = 70; // km/s/Mpc
  let numGalaxies = 25;
  let timeScale = 1;

  // Galaxy state
  let galaxies: Galaxy[] = [];
  let prevNumGalaxies = 0;

  // Background grid expansion factor
  let scaleFactor = 1;

  // Maximum initial distance for placement (Mpc)
  const MAX_DIST = 100;

  /** Pseudo-random seeded generator for reproducible galaxy placement. */
  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  function generateGalaxies(): void {
    galaxies = [];
    const rng = seededRandom(42);
    for (let i = 0; i < numGalaxies; i++) {
      const d0 = 8 + rng() * (MAX_DIST - 8);
      const angle = rng() * Math.PI * 2;
      const hue = 200 + rng() * 40; // blue-ish base
      const size = 2 + rng() * 3;
      const spiralOffset = rng() * Math.PI * 2;
      galaxies.push({ d0, angle, hue, size, spiralOffset });
    }
    prevNumGalaxies = numGalaxies;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    scaleFactor = 1;
    generateGalaxies();
  }

  function update(dt: number, params: Record<string, number>): void {
    hubbleConstant = params.hubbleConstant ?? 70;
    numGalaxies = Math.round(params.numGalaxies ?? 25);
    timeScale = params.timeScale ?? 1;

    if (numGalaxies !== prevNumGalaxies) {
      generateGalaxies();
    }

    // Hubble's law: v = H0 * d.  In our sim we track a dimensionless scale
    // factor a(t). da/dt = H0 * a  =>  a = exp(H0 * t).
    // We use a very compressed time unit so the expansion is visible.
    // H0 in our display units:  we treat 1 time-unit ~ 10 Gyr
    // H0 ~ 70 km/s/Mpc ~ 7.15e-11 /yr ~ 0.715 /10Gyr
    const H0scaled = (hubbleConstant / 70) * 0.06; // tuned for visual speed
    time += dt * timeScale;
    scaleFactor = Math.exp(H0scaled * time);
    // Cap to prevent overflow
    if (scaleFactor > 8) scaleFactor = 8;
  }

  /** Convert distance (Mpc) + angle to canvas coordinates, centred on observer. */
  function toCanvas(dist: number, angle: number): { x: number; y: number } {
    const viewScale = Math.min(width, height) * 0.42 / MAX_DIST;
    const cx = width / 2;
    const cy = height / 2;
    const px = cx + dist * Math.cos(angle) * viewScale;
    const py = cy + dist * Math.sin(angle) * viewScale;
    return { x: px, y: py };
  }

  function drawBackground(): void {
    ctx.fillStyle = "#05060f";
    ctx.fillRect(0, 0, width, height);

    // Subtle star field
    const rng = seededRandom(99);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < 120; i++) {
      const sx = rng() * width;
      const sy = rng() * height;
      const sr = 0.3 + rng() * 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Draw an expanding coordinate grid to visualise space stretching. */
  function drawGrid(): void {
    ctx.save();
    const cx = width / 2;
    const cy = height / 2;
    const viewScale = Math.min(width, height) * 0.42 / MAX_DIST;

    // Grid spacing in Mpc (comoving)
    const gridSpacing = 20; // Mpc
    const maxGrid = MAX_DIST * 1.5;

    ctx.strokeStyle = "rgba(60, 80, 140, 0.15)";
    ctx.lineWidth = 1;

    // Concentric circles at fixed comoving distances, scaled by a(t)
    for (let r = gridSpacing; r <= maxGrid; r += gridSpacing) {
      const physR = r * scaleFactor;
      const px = physR * viewScale;
      if (px > Math.max(width, height)) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, px, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Radial lines
    const numRadial = 12;
    for (let i = 0; i < numRadial; i++) {
      const a = (i / numRadial) * Math.PI * 2;
      const endR = maxGrid * scaleFactor * viewScale;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + endR * Math.cos(a), cy + endR * Math.sin(a));
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Draw the central observer point. */
  function drawObserver(): void {
    const cx = width / 2;
    const cy = height / 2;

    ctx.save();
    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Observer", cx, cy + 24);
    ctx.restore();
  }

  /** Compute redshift-based colour: nearby = blue, far = red. */
  function galaxyColor(currentDist: number, alpha: number): string {
    // Redshift z = v/c where v = H0 * d.  Simplified colour mapping.
    const v = hubbleConstant * currentDist; // km/s
    const c = 300000; // km/s
    const z = v / c;

    // Map z from 0..0.1 => hue from 220 (blue) to 0 (red)
    const hue = Math.max(0, 220 - z * 2200);
    const saturation = 80 + z * 200;
    const lightness = 55 + Math.min(z * 100, 20);
    return `hsla(${hue.toFixed(0)}, ${Math.min(saturation, 100).toFixed(0)}%, ${Math.min(lightness, 80).toFixed(0)}%, ${alpha})`;
  }

  /** Draw a small spiral galaxy shape. */
  function drawSpiralGalaxy(x: number, y: number, size: number, rotation: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Core glow
    const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
    coreGlow.addColorStop(0, color);
    coreGlow.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = coreGlow;
    ctx.fill();

    // Spiral arms
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.35);
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      const armOffset = arm * Math.PI;
      for (let t = 0; t < 2.5; t += 0.05) {
        const r = size * 0.5 * t;
        const a = t * 1.8 + armOffset;
        const px = r * Math.cos(a);
        const py = r * Math.sin(a);
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Bright core
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }

  /** Draw velocity vectors on galaxies. */
  function drawVelocityVector(x: number, y: number, vx: number, vy: number, color: string): void {
    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag < 0.5) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + vx, y + vy);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(vy, vx);
    const aLen = 6;
    ctx.beginPath();
    ctx.moveTo(x + vx, y + vy);
    ctx.lineTo(x + vx - aLen * Math.cos(angle - 0.4), y + vy - aLen * Math.sin(angle - 0.4));
    ctx.moveTo(x + vx, y + vy);
    ctx.lineTo(x + vx - aLen * Math.cos(angle + 0.4), y + vy - aLen * Math.sin(angle + 0.4));
    ctx.stroke();
    ctx.restore();
  }

  function drawGalaxies(): void {
    const viewScale = Math.min(width, height) * 0.42 / MAX_DIST;

    for (const g of galaxies) {
      const currentDist = g.d0 * scaleFactor;
      const { x, y } = toCanvas(currentDist, g.angle);

      // Skip if off-screen
      if (x < -50 || x > width + 50 || y < -50 || y > height + 50) continue;

      const color = galaxyColor(currentDist, 0.85);
      const rotation = g.spiralOffset + time * 0.05;

      drawSpiralGalaxy(x, y, g.size * (1 + scaleFactor * 0.05), rotation, color);

      // Velocity vector: v = H0 * d, directed radially outward
      const v = hubbleConstant * currentDist; // km/s
      const vArrowScale = viewScale * 0.0003; // scale for display
      const vx = v * Math.cos(g.angle) * vArrowScale;
      const vy = v * Math.sin(g.angle) * vArrowScale;
      drawVelocityVector(x, y, vx, vy, galaxyColor(currentDist, 0.5));
    }
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 255;
    const panelH = 140;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Cosmic Expansion (Hubble's Law)", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`v = H\u2080 \u00D7 d`, panelX + 10, panelY + 40);
    ctx.fillText(`H\u2080 = ${hubbleConstant} km/s/Mpc`, panelX + 10, panelY + 58);
    ctx.fillText(`Scale factor a(t) = ${scaleFactor.toFixed(3)}`, panelX + 10, panelY + 76);
    ctx.fillText(`Galaxies: ${numGalaxies}`, panelX + 10, panelY + 94);
    ctx.fillText(`Time: ${time.toFixed(1)} (${timeScale}\u00D7 speed)`, panelX + 10, panelY + 112);

    // Colour legend
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Blue = nearby   Red = high redshift", panelX + 10, panelY + 130);

    ctx.restore();
  }

  /** Draw Hubble diagram inset (v vs d scatter). */
  function drawHubbleDiagram(): void {
    ctx.save();
    const dw = 160;
    const dh = 120;
    const dx = width - dw - 12;
    const dy = height - dh - 12;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, 8);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    const axisMargin = 25;
    const plotX = dx + axisMargin;
    const plotY = dy + 15;
    const plotW = dw - axisMargin - 10;
    const plotH = dh - 35;

    // x-axis
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();
    // y-axis
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("d (Mpc)", plotX + plotW / 2, plotY + plotH + 13);
    ctx.save();
    ctx.translate(plotX - 14, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("v (km/s)", 0, 0);
    ctx.restore();

    // Hubble line (theoretical)
    const maxD = MAX_DIST * scaleFactor;
    const maxV = hubbleConstant * maxD;
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot each galaxy
    for (const g of galaxies) {
      const d = g.d0 * scaleFactor;
      const v = hubbleConstant * d;
      const px = plotX + (d / maxD) * plotW;
      const py = plotY + plotH - (v / maxV) * plotH;
      if (px > plotX && px < plotX + plotW && py > plotY && py < plotY + plotH) {
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = galaxyColor(d, 0.9);
        ctx.fill();
      }
    }

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Hubble Diagram", dx + dw / 2, dy + 12);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawGrid();
    drawGalaxies();
    drawObserver();
    drawInfoPanel();
    drawHubbleDiagram();
  }

  function reset(): void {
    time = 0;
    scaleFactor = 1;
  }

  function destroy(): void {
    galaxies = [];
  }

  function getStateDescription(): string {
    const maxV = hubbleConstant * MAX_DIST * scaleFactor;
    return (
      `Cosmic Expansion: Hubble constant H0=${hubbleConstant} km/s/Mpc. ` +
      `v = H0 * d (Hubble's Law). ${numGalaxies} galaxies shown. ` +
      `Scale factor a(t)=${scaleFactor.toFixed(3)}. ` +
      `Farthest galaxy recession velocity ~${maxV.toFixed(0)} km/s. ` +
      `Galaxies colour-shift from blue (nearby) to red (distant) showing redshift. ` +
      `Time: ${time.toFixed(1)}s at ${timeScale}x speed.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default CosmicExpansionFactory;
