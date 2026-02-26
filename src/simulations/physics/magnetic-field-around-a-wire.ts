import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagneticFieldWireFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnetic-field-around-a-wire") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  const MU_0 = 4 * Math.PI * 1e-7;

  // Parameters
  let current = 5;
  let showStrengthColors = 1;
  let numFieldLines = 8;
  let wireDirection = 1; // 0 = into page, 1 = out of page

  // Compass needle positions (precomputed ring layout)
  interface Compass {
    x: number;
    y: number;
    r: number; // distance from wire
    angle: number; // angular position around wire
  }
  let compassNeedles: Compass[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    buildCompasses();
  }

  function buildCompasses(): void {
    compassNeedles = [];
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * 0.42;

    // Place compasses in concentric rings
    const rings = [0.15, 0.28, 0.42, 0.58, 0.75, 0.92];
    const countsPerRing = [6, 8, 10, 12, 14, 16];

    for (let ring = 0; ring < rings.length; ring++) {
      const r = maxR * rings[ring];
      const count = countsPerRing[ring];
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        compassNeedles.push({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          r,
          angle,
        });
      }
    }
  }

  // B = mu0 * I / (2 * pi * r)
  function bAtDistance(I: number, r: number): number {
    if (r < 0.001) return 0;
    return (MU_0 * Math.abs(I)) / (2 * Math.PI * r);
  }

  function fieldStrengthColor(bMag: number, maxB: number): string {
    const t = Math.min(1, bMag / maxB);
    // Red (strong) -> yellow (medium) -> cyan (weak) -> blue (very weak)
    if (t > 0.5) {
      const s = (t - 0.5) * 2;
      const r = 255;
      const g = Math.floor(200 * (1 - s));
      const b = Math.floor(50 * (1 - s));
      return `rgb(${r},${g},${b})`;
    } else {
      const s = t * 2;
      const r = Math.floor(100 * s);
      const g = Math.floor(150 * s + 100 * (1 - s));
      const b = Math.floor(255 * (1 - s) + 200 * s);
      return `rgb(${r},${g},${b})`;
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    current = params.current ?? 5;
    showStrengthColors = params.showStrengthColors ?? 1;
    numFieldLines = Math.round(params.numFieldLines ?? 8);
    wireDirection = params.wireDirection ?? 1;

    // Rebuild compasses if canvas size changed
    if (compassNeedles.length === 0) {
      buildCompasses();
    }
  }

  function render(): void {
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * 0.42;

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Reference distance for B calculations (convert pixel distance to "meters")
    const pixToMeter = 0.01; // 1 pixel = 1 cm
    const minDist = 0.02; // 2cm minimum
    const maxB = bAtDistance(current, minDist);

    // Draw field strength background
    if (showStrengthColors >= 0.5) {
      const gridSize = 6;
      for (let px = 0; px < width; px += gridSize) {
        for (let py = 0; py < height; py += gridSize) {
          const dx = px - cx;
          const dy = py - cy;
          const pixDist = Math.sqrt(dx * dx + dy * dy);
          if (pixDist < 10) continue;
          const r = pixDist * pixToMeter;
          const b = bAtDistance(current, r);
          const intensity = Math.min(1, b / (maxB * 0.15));
          if (intensity > 0.01) {
            const alpha = intensity * 0.3;
            const red = Math.floor(255 * intensity);
            const blue = Math.floor(200 * (1 - intensity));
            ctx.fillStyle = `rgba(${red},30,${blue},${alpha})`;
            ctx.fillRect(px, py, gridSize, gridSize);
          }
        }
      }
    }

    // Draw concentric circular field lines
    const direction = wireDirection >= 0.5 ? 1 : -1; // 1 = out (CCW), -1 = into (CW)
    const lineSpacing = maxR / (numFieldLines + 1);

    for (let i = 1; i <= numFieldLines; i++) {
      const r = lineSpacing * i;
      const rMeters = r * pixToMeter;
      const b = bAtDistance(current, rMeters);

      // Color by field strength
      let strokeColor: string;
      if (showStrengthColors >= 0.5) {
        strokeColor = fieldStrengthColor(b, maxB * 0.2);
      } else {
        strokeColor = "rgba(100,180,255,0.6)";
      }

      // Draw circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Draw directional arrows on each circle
      const numArrows = Math.max(3, Math.floor(r / 40));
      for (let a = 0; a < numArrows; a++) {
        const theta = (2 * Math.PI * a) / numArrows + time * 0.3 * direction;
        const ax = cx + r * Math.cos(theta);
        const ay = cy + r * Math.sin(theta);

        // Tangent direction (CCW if out of page by right-hand rule)
        const tangentAngle = theta + (direction * Math.PI / 2);
        drawArrow(ax, ay, tangentAngle, 6, strokeColor);
      }
    }

    // Draw compass needles
    const needleLen = 12;
    for (const compass of compassNeedles) {
      const dx = compass.x - cx;
      const dy = compass.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 15) continue;

      // Field direction at this point: tangent to circle (right-hand rule)
      const fieldAngle = Math.atan2(dy, dx) + (direction * Math.PI / 2);

      // Compass body
      ctx.beginPath();
      ctx.arc(compass.x, compass.y, needleLen + 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30,41,59,0.8)";
      ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // North end (red)
      ctx.beginPath();
      ctx.moveTo(compass.x, compass.y);
      ctx.lineTo(
        compass.x + Math.cos(fieldAngle) * needleLen,
        compass.y + Math.sin(fieldAngle) * needleLen
      );
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Pointed tip
      const tipX = compass.x + Math.cos(fieldAngle) * needleLen;
      const tipY = compass.y + Math.sin(fieldAngle) * needleLen;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      // South end (white/blue)
      ctx.beginPath();
      ctx.moveTo(compass.x, compass.y);
      ctx.lineTo(
        compass.x - Math.cos(fieldAngle) * needleLen,
        compass.y - Math.sin(fieldAngle) * needleLen
      );
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center pivot
      ctx.beginPath();
      ctx.arc(compass.x, compass.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#94a3b8";
      ctx.fill();
    }

    // Draw the wire (center point)
    const wireR = 18;
    // Glow effect
    const gradient = ctx.createRadialGradient(cx, cy, wireR * 0.5, cx, cy, wireR * 3);
    gradient.addColorStop(0, "rgba(251,191,36,0.3)");
    gradient.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - wireR * 3, cy - wireR * 3, wireR * 6, wireR * 6);

    // Wire circle
    ctx.beginPath();
    ctx.arc(cx, cy, wireR, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Current direction symbol
    if (wireDirection >= 0.5) {
      // Out of page: dot
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
    } else {
      // Into page: cross
      const cs = wireR * 0.55;
      ctx.beginPath();
      ctx.moveTo(cx - cs, cy - cs);
      ctx.lineTo(cx + cs, cy + cs);
      ctx.moveTo(cx + cs, cy - cs);
      ctx.lineTo(cx - cs, cy + cs);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    // Pulse animation on wire
    const pulse = (Math.sin(time * 4) + 1) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, wireR + 4 + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251,191,36,${0.4 * (1 - pulse)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw B vs r graph in bottom-right corner
    const gW = 150, gH = 90, gX = width - gW - 20, gY = height - gH - 20;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fillRect(gX - 5, gY - 18, gW + 10, gH + 28);
    ctx.strokeStyle = "rgba(148,163,184,0.3)"; ctx.lineWidth = 1;
    ctx.strokeRect(gX - 5, gY - 18, gW + 10, gH + 28);
    ctx.font = "11px monospace"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center";
    ctx.fillText("B vs distance", gX + gW / 2, gY - 4);
    // Axes
    ctx.beginPath();
    ctx.moveTo(gX, gY + gH); ctx.lineTo(gX + gW, gY + gH);
    ctx.moveTo(gX, gY + gH); ctx.lineTo(gX, gY);
    ctx.strokeStyle = "#64748b"; ctx.stroke();
    ctx.font = "9px monospace"; ctx.fillStyle = "#64748b";
    ctx.textAlign = "center"; ctx.fillText("r", gX + gW / 2, gY + gH + 12);
    ctx.textAlign = "right"; ctx.fillText("B", gX - 4, gY + 4);
    // Plot 1/r curve
    ctx.beginPath();
    const maxGraphR = maxR * pixToMeter;
    for (let px = 0; px < gW; px++) {
      const r = minDist + (maxGraphR - minDist) * (px / gW);
      const yNorm = Math.min(1, bAtDistance(current, r) / maxB);
      const gy = gY + gH - yNorm * gH;
      if (px === 0) ctx.moveTo(gX + px, gy); else ctx.lineTo(gX + px, gy);
    }
    ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2; ctx.stroke();

    // Title
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Magnetic Field Around a Straight Wire", width / 2, 28);

    // Direction label
    ctx.font = "13px monospace";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    const dirLabel = wireDirection >= 0.5 ? "Current: OUT of page" : "Current: INTO page";
    ctx.fillText(dirLabel, cx, cy + wireR + 22);

    const ruleLabel = wireDirection >= 0.5 ? "Field: counter-clockwise (right-hand rule)" : "Field: clockwise (right-hand rule)";
    ctx.fillStyle = "#67e8f9";
    ctx.font = "12px monospace";
    ctx.fillText(ruleLabel, cx, cy + wireR + 38);

    // Info panel
    ctx.font = "13px monospace";
    ctx.fillStyle = "#67e8f9";
    ctx.textAlign = "left";
    ctx.fillText(`I = ${current.toFixed(1)} A`, 14, height - 50);
    const bAt1cm = bAtDistance(current, 0.01);
    const bAt5cm = bAtDistance(current, 0.05);
    const fmt = (v: number) => v >= 1e-3 ? (v * 1e3).toFixed(2) + " mT" : (v * 1e6).toFixed(1) + " uT";
    ctx.fillText(`B(1cm) = ${fmt(bAt1cm)}, B(5cm) = ${fmt(bAt5cm)}`, 14, height - 32);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("B = \u03BC\u2080I / (2\u03C0r)", 14, height - 14);

    // Color legend if showing strength
    if (showStrengthColors >= 0.5) {
      ctx.font = "11px monospace"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "left";
      ctx.fillText("Field strength:", 14, 50);
      for (let px = 0; px < 100; px++) {
        const t = 1 - px / 100;
        ctx.fillStyle = `rgb(${Math.floor(255 * t)},30,${Math.floor(200 * (1 - t))})`;
        ctx.fillRect(14 + px, 54, 1, 10);
      }
      ctx.fillStyle = "#ef4444"; ctx.textAlign = "left"; ctx.fillText("Strong", 14, 76);
      ctx.fillStyle = "#60a5fa"; ctx.textAlign = "right"; ctx.fillText("Weak", 114, 76);
    }
  }

  function drawArrow(x: number, y: number, angle: number, size: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.5, -size * 0.5);
    ctx.lineTo(-size * 0.5, size * 0.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    buildCompasses();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const dirStr = wireDirection >= 0.5 ? "out of the page" : "into the page";
    const bAt1cm = bAtDistance(current, 0.01);
    const fmt = (v: number) => v >= 1e-3 ? (v * 1e3).toFixed(3) + " mT" : (v * 1e6).toFixed(1) + " uT";
    return `Straight current-carrying wire viewed end-on with I = ${current.toFixed(1)} A flowing ${dirStr}. ` +
      `Magnetic field forms concentric circles around the wire following the right-hand rule. ` +
      `B = mu0*I/(2*pi*r), so B at 1 cm = ${fmt(bAt1cm)}. ` +
      `Field strength decreases inversely with distance (1/r). ` +
      `Compass needles align tangent to the field circles.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    buildCompasses();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MagneticFieldWireFactory;
