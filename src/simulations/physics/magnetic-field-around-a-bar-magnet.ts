import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagneticFieldAroundABarMagnetFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnetic-field-around-a-bar-magnet") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let magnetStrength = 5;
  let numFilings = 800;
  let showFieldVectors = 0;
  let magnetLength = 100;

  // Iron filings data
  interface Filing {
    x: number;
    y: number;
    angle: number;
    length: number;
    strength: number;
  }
  let filings: Filing[] = [];
  let prevNumFilings = 0;
  let prevMagnetLength = 0;

  // Magnet half-dimensions
  const MAGNET_HALF_W = 18;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    generateFilings();
  }

  // Magnetic dipole field using the exact formula:
  // B = (mu0/4pi) * (3(m . rhat)rhat - m) / r^3
  // where m is the magnetic moment vector along +x axis
  function dipoleField(px: number, py: number): { bx: number; by: number; mag: number } {
    const cx = width / 2;
    const cy = height / 2;
    const halfLen = magnetLength / 2;

    // Use two-pole model for more realistic near-field behavior
    // Place +q at N pole and -q at S pole, compute B as superposition
    const nPoleX = cx + halfLen;
    const nPoleY = cy;
    const sPoleX = cx - halfLen;
    const sPoleY = cy;

    const strength = magnetStrength * 200;

    // Field from N pole (positive charge analog, field points away)
    let dnx = px - nPoleX;
    let dny = py - nPoleY;
    let rn2 = dnx * dnx + dny * dny;
    let rn = Math.sqrt(rn2);
    if (rn < 8) rn = 8;
    rn2 = rn * rn;
    const rn3 = rn2 * rn;

    const bnx = strength * dnx / rn3;
    const bny = strength * dny / rn3;

    // Field from S pole (negative charge analog, field points toward)
    let dsx = px - sPoleX;
    let dsy = py - sPoleY;
    let rs2 = dsx * dsx + dsy * dsy;
    let rs = Math.sqrt(rs2);
    if (rs < 8) rs = 8;
    rs2 = rs * rs;
    const rs3 = rs2 * rs;

    const bsx = -strength * dsx / rs3;
    const bsy = -strength * dsy / rs3;

    const bx = bnx + bsx;
    const by = bny + bsy;
    const mag = Math.sqrt(bx * bx + by * by);

    return { bx, by, mag };
  }

  function generateFilings(): void {
    filings = [];
    const cx = width / 2;
    const cy = height / 2;
    const halfLen = magnetLength / 2;

    // Use a seeded-like approach with deterministic placement
    // Scatter filings with bias toward areas where field is interesting
    for (let i = 0; i < numFilings; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        // Use a distribution that favors areas near the magnet
        const r = 30 + Math.random() * Math.min(width, height) * 0.45;
        const theta = Math.random() * Math.PI * 2;
        x = cx + r * Math.cos(theta);
        y = cy + r * Math.sin(theta);
        attempts++;
      } while (
        attempts < 10 &&
        (x < 10 || x > width - 10 || y < 10 || y > height - 10 ||
          (Math.abs(x - cx) < halfLen + 5 && Math.abs(y - cy) < MAGNET_HALF_W + 5))
      );

      if (x < 10 || x > width - 10 || y < 10 || y > height - 10) continue;
      // Skip if inside magnet
      if (Math.abs(x - cx) < halfLen + 3 && Math.abs(y - cy) < MAGNET_HALF_W + 3) continue;

      const field = dipoleField(x, y);
      filings.push({
        x,
        y,
        angle: Math.atan2(field.by, field.bx),
        length: 4 + Math.random() * 4,
        strength: field.mag,
      });
    }

    prevNumFilings = numFilings;
    prevMagnetLength = magnetLength;
  }

  function updateFilings(): void {
    // Recalculate alignment and strength based on current parameters
    for (const f of filings) {
      const field = dipoleField(f.x, f.y);
      f.angle = Math.atan2(field.by, field.bx);
      f.strength = field.mag;
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    magnetStrength = params.magnetStrength ?? 5;
    const newNumFilings = Math.round(params.numFilings ?? 800);
    showFieldVectors = params.showFieldVectors ?? 0;
    const newMagnetLength = params.magnetLength ?? 100;

    time += dt;

    // Regenerate filings if count or magnet length changed significantly
    if (newNumFilings !== prevNumFilings || Math.abs(newMagnetLength - prevMagnetLength) > 5) {
      numFilings = newNumFilings;
      magnetLength = newMagnetLength;
      generateFilings();
    } else {
      numFilings = newNumFilings;
      magnetLength = newMagnetLength;
      updateFilings();
    }
  }

  function drawMagnet(): void {
    const cx = width / 2;
    const cy = height / 2;
    const halfLen = magnetLength / 2;

    // South pole (left) - blue
    ctx.fillStyle = "#3498db";
    ctx.beginPath();
    ctx.roundRect(cx - halfLen, cy - MAGNET_HALF_W, halfLen, MAGNET_HALF_W * 2, [4, 0, 0, 4]);
    ctx.fill();
    ctx.strokeStyle = "#2980b9";
    ctx.lineWidth = 2;
    ctx.stroke();

    // North pole (right) - red
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.roundRect(cx, cy - MAGNET_HALF_W, halfLen, MAGNET_HALF_W * 2, [0, 4, 4, 0]);
    ctx.fill();
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", cx - halfLen / 2, cy);
    ctx.fillText("N", cx + halfLen / 2, cy);

    // Divider
    ctx.beginPath();
    ctx.moveTo(cx, cy - MAGNET_HALF_W);
    ctx.lineTo(cx, cy + MAGNET_HALF_W);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawFilings(): void {
    if (filings.length === 0) return;

    // Find max strength for normalization
    let maxStrength = 0;
    for (const f of filings) {
      if (f.strength > maxStrength) maxStrength = f.strength;
    }
    if (maxStrength === 0) maxStrength = 1;

    for (const f of filings) {
      const normalizedStrength = f.strength / maxStrength;
      // Brightness increases with field strength
      const brightness = 0.15 + 0.85 * Math.pow(normalizedStrength, 0.4);
      const alpha = 0.3 + 0.7 * brightness;

      // Color: map strength to a warm metallic color (dark gray to bright silver/white)
      const r = Math.floor(100 + 155 * brightness);
      const g = Math.floor(90 + 140 * brightness);
      const b = Math.floor(70 + 100 * brightness);

      const halfLen = f.length / 2;
      const cosA = Math.cos(f.angle);
      const sinA = Math.sin(f.angle);

      ctx.beginPath();
      ctx.moveTo(f.x - cosA * halfLen, f.y - sinA * halfLen);
      ctx.lineTo(f.x + cosA * halfLen, f.y + sinA * halfLen);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 1.2 + 0.8 * brightness;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  function drawFieldVectors(): void {
    if (showFieldVectors < 0.5) return;

    const spacing = 40;
    const cx = width / 2;
    const cy = height / 2;
    const halfLen = magnetLength / 2;

    // Find max for normalization
    let maxMag = 0;
    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        if (Math.abs(x - cx) < halfLen + 5 && Math.abs(y - cy) < MAGNET_HALF_W + 5) continue;
        const field = dipoleField(x, y);
        if (field.mag > maxMag) maxMag = field.mag;
      }
    }
    if (maxMag === 0) maxMag = 1;

    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        if (Math.abs(x - cx) < halfLen + 5 && Math.abs(y - cy) < MAGNET_HALF_W + 5) continue;

        const field = dipoleField(x, y);
        const norm = field.mag / maxMag;
        if (norm < 0.01) continue;

        const arrowLen = 8 + 12 * Math.pow(norm, 0.3);
        const angle = Math.atan2(field.by, field.bx);

        // Color: blue for weak, cyan for medium, white for strong
        const r = Math.floor(50 + 205 * norm);
        const g = Math.floor(150 + 105 * Math.min(norm * 2, 1));
        const b = 255;
        const alpha = 0.3 + 0.5 * norm;

        const endX = x + Math.cos(angle) * arrowLen;
        const endY = y + Math.sin(angle) * arrowLen;

        const clr = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = clr;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Arrow head
        const hs = 3;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - hs * Math.cos(angle - 0.5), endY - hs * Math.sin(angle - 0.5));
        ctx.lineTo(endX - hs * Math.cos(angle + 0.5), endY - hs * Math.sin(angle + 0.5));
        ctx.closePath();
        ctx.fillStyle = clr;
        ctx.fill();
      }
    }
  }

  function drawFieldStrengthLegend(): void {
    const legendX = width - 30, legendY = 40, legendHeight = 120, legendWidth = 12;
    const grad = ctx.createLinearGradient(0, legendY + legendHeight, 0, legendY);
    grad.addColorStop(0, "rgba(100, 90, 70, 0.5)");
    grad.addColorStop(0.5, "rgba(200, 180, 140, 0.7)");
    grad.addColorStop(1, "rgba(255, 245, 220, 1.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(legendX - legendWidth / 2, legendY, legendWidth, legendHeight);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - legendWidth / 2, legendY, legendWidth, legendHeight);

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Strong", legendX - legendWidth / 2 - 4, legendY + 6);
    ctx.fillText("Weak", legendX - legendWidth / 2 - 4, legendY + legendHeight - 2);

    ctx.textAlign = "center";
    ctx.fillText("|B|", legendX, legendY - 8);
  }

  function render(): void {
    // Dark background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw iron filings
    drawFilings();

    // Draw optional field vectors
    drawFieldVectors();

    // Draw the bar magnet on top
    drawMagnet();

    // Draw legend
    drawFieldStrengthLegend();

    // Info text
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `Filings: ${filings.length}  |  Strength: ${magnetStrength.toFixed(1)} T  |  Length: ${magnetLength.toFixed(0)} px`,
      12,
      height - 12
    );

    // Formula display
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("B = (mu0/4pi)(3(m*r)r - m) / r^3", width - 12, height - 12);
  }

  function reset(): void {
    time = 0;
    generateFilings();
  }

  function destroy(): void {
    filings = [];
  }

  function getStateDescription(): string {
    let avgStrength = 0;
    for (const f of filings) avgStrength += f.strength;
    avgStrength = filings.length > 0 ? avgStrength / filings.length : 0;

    return (
      `Magnetic Field Around a Bar Magnet: ${filings.length} iron filings visualizing the field. ` +
      `Magnet strength=${magnetStrength} T, length=${magnetLength} px. ` +
      `Average filing field strength: ${avgStrength.toFixed(4)} (arb. units). ` +
      `Field vectors ${showFieldVectors >= 0.5 ? "shown" : "hidden"}. ` +
      `Uses dipole field equation B = (mu0/4pi)(3(m.r_hat)r_hat - m)/r^3 ` +
      `with two-pole superposition for near-field accuracy. ` +
      `Brighter filings indicate stronger field regions (near the poles).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    generateFilings();
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

export default MagneticFieldAroundABarMagnetFactory;
