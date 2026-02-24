import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const CameraFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("camera") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let objectDistance = 40; // cm
  let focalLength = 15; // cm
  let showUpperRays = 1;
  let showLowerRays = 1;

  // Computed optics
  let imageDistance = 0;
  let magnification = 0;

  // Candle properties
  const candleHeight = 12; // cm
  const flameFlicker: { dx: number; dy: number; phase: number }[] = [
    { dx: 0, dy: 0, phase: 0 },
    { dx: 0, dy: 0, phase: 1.3 },
    { dx: 0, dy: 0, phase: 2.7 },
  ];

  function getScale(): number {
    return Math.min(width, height) / 120;
  }

  function getLensX(): number {
    return width * 0.45;
  }

  function getLensY(): number {
    return height * 0.55;
  }

  function cmToCanvasX(cm: number): number {
    return getLensX() + cm * getScale();
  }

  function cmToCanvasY(cm: number): number {
    return getLensY() - cm * getScale();
  }

  function computeOptics(): void {
    // Thin lens equation: 1/f = 1/do + 1/di
    if (Math.abs(objectDistance - focalLength) < 0.01) {
      imageDistance = Infinity;
    } else {
      imageDistance = (focalLength * objectDistance) / (objectDistance - focalLength);
    }
    magnification = -imageDistance / objectDistance;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    computeOptics();
  }

  function update(dt: number, params: Record<string, number>): void {
    objectDistance = params.objectDistance ?? 40;
    focalLength = params.focalLength ?? 15;
    showUpperRays = Math.round(params.showUpperRays ?? 1);
    showLowerRays = Math.round(params.showLowerRays ?? 1);

    computeOptics();
    time += dt;

    // Update flame flicker
    for (const f of flameFlicker) {
      f.dx = Math.sin(time * 5 + f.phase) * 1.5;
      f.dy = Math.cos(time * 7 + f.phase * 1.5) * 0.8;
    }
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.5, "#0e0e22");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawOpticalAxis(): void {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, getLensY());
    ctx.lineTo(width, getLensY());
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawCandle(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const candleX = lx - objectDistance * scale;
    const candleBaseY = ly;
    const candleTopY = ly - candleHeight * scale;

    ctx.save();

    // Candle body
    const candleW = 8;
    const bodyGrad = ctx.createLinearGradient(candleX - candleW / 2, candleTopY, candleX + candleW / 2, candleTopY);
    bodyGrad.addColorStop(0, "#e8d5b0");
    bodyGrad.addColorStop(0.5, "#f5e6cc");
    bodyGrad.addColorStop(1, "#d4c4a0");
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(candleX - candleW / 2, candleTopY + 10, candleW, candleBaseY - candleTopY - 10);

    // Candle holder
    ctx.fillStyle = "#8B7355";
    ctx.fillRect(candleX - candleW, candleBaseY - 4, candleW * 2, 4);
    ctx.fillRect(candleX - candleW * 0.6, candleBaseY, candleW * 1.2, 3);

    // Wick
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(candleX, candleTopY + 10);
    ctx.lineTo(candleX, candleTopY + 3);
    ctx.stroke();

    // Flame (multiple layers with flicker)
    const flameBaseY = candleTopY + 3;

    // Outer glow
    const glowR = 25;
    const glow = ctx.createRadialGradient(
      candleX + flameFlicker[0].dx, flameBaseY - 10 + flameFlicker[0].dy,
      0,
      candleX, flameBaseY - 8,
      glowR
    );
    glow.addColorStop(0, "rgba(255, 200, 50, 0.3)");
    glow.addColorStop(0.5, "rgba(255, 150, 20, 0.1)");
    glow.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.beginPath();
    ctx.arc(candleX, flameBaseY - 8, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Outer flame (orange)
    ctx.beginPath();
    ctx.moveTo(candleX - 5, flameBaseY);
    ctx.quadraticCurveTo(
      candleX - 6 + flameFlicker[1].dx,
      flameBaseY - 12 + flameFlicker[1].dy,
      candleX + flameFlicker[0].dx * 0.5,
      flameBaseY - 18 + flameFlicker[0].dy
    );
    ctx.quadraticCurveTo(
      candleX + 6 + flameFlicker[2].dx,
      flameBaseY - 12 + flameFlicker[2].dy,
      candleX + 5,
      flameBaseY
    );
    ctx.closePath();
    const outerFlame = ctx.createLinearGradient(candleX, flameBaseY, candleX, flameBaseY - 18);
    outerFlame.addColorStop(0, "#ff6600");
    outerFlame.addColorStop(0.4, "#ff9900");
    outerFlame.addColorStop(0.8, "#ffcc00");
    outerFlame.addColorStop(1, "rgba(255, 220, 100, 0.3)");
    ctx.fillStyle = outerFlame;
    ctx.fill();

    // Inner flame (bright yellow-white)
    ctx.beginPath();
    ctx.moveTo(candleX - 2.5, flameBaseY);
    ctx.quadraticCurveTo(
      candleX - 3 + flameFlicker[0].dx * 0.3,
      flameBaseY - 7 + flameFlicker[0].dy * 0.5,
      candleX + flameFlicker[1].dx * 0.2,
      flameBaseY - 10 + flameFlicker[1].dy * 0.3
    );
    ctx.quadraticCurveTo(
      candleX + 3 + flameFlicker[2].dx * 0.3,
      flameBaseY - 7 + flameFlicker[2].dy * 0.5,
      candleX + 2.5,
      flameBaseY
    );
    ctx.closePath();
    const innerFlame = ctx.createLinearGradient(candleX, flameBaseY, candleX, flameBaseY - 10);
    innerFlame.addColorStop(0, "#ffffcc");
    innerFlame.addColorStop(0.5, "#ffffff");
    innerFlame.addColorStop(1, "rgba(255, 255, 200, 0.5)");
    ctx.fillStyle = innerFlame;
    ctx.fill();

    // Light source label (tip of flame used as point source)
    ctx.fillStyle = "rgba(255, 200, 50, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Candle", candleX, candleBaseY + 18);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 200, 50, 0.7)";
    ctx.fillText("(Light source)", candleX, candleBaseY + 30);

    ctx.restore();
  }

  function drawLens(): void {
    const lx = getLensX();
    const ly = getLensY();
    const scale = getScale();
    const lensHalfH = 20 * scale;

    ctx.save();

    // Lens body - double convex
    ctx.beginPath();
    ctx.moveTo(lx, ly - lensHalfH);
    ctx.quadraticCurveTo(lx - 14, ly, lx, ly + lensHalfH);
    ctx.quadraticCurveTo(lx + 14, ly, lx, ly - lensHalfH);
    ctx.closePath();

    const lensGrad = ctx.createLinearGradient(lx - 14, ly, lx + 14, ly);
    lensGrad.addColorStop(0, "rgba(100, 180, 255, 0.12)");
    lensGrad.addColorStop(0.3, "rgba(150, 210, 255, 0.22)");
    lensGrad.addColorStop(0.5, "rgba(180, 230, 255, 0.32)");
    lensGrad.addColorStop(0.7, "rgba(150, 210, 255, 0.22)");
    lensGrad.addColorStop(1, "rgba(100, 180, 255, 0.12)");
    ctx.fillStyle = lensGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(150, 210, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrowheads (convex lens convention)
    const arrowSize = 8;
    ctx.strokeStyle = "rgba(150, 210, 255, 0.5)";
    ctx.lineWidth = 2;

    // Top
    ctx.beginPath();
    ctx.moveTo(lx - arrowSize, ly - lensHalfH - arrowSize);
    ctx.lineTo(lx, ly - lensHalfH);
    ctx.lineTo(lx + arrowSize, ly - lensHalfH - arrowSize);
    ctx.stroke();

    // Bottom
    ctx.beginPath();
    ctx.moveTo(lx - arrowSize, ly + lensHalfH + arrowSize);
    ctx.lineTo(lx, ly + lensHalfH);
    ctx.lineTo(lx + arrowSize, ly + lensHalfH + arrowSize);
    ctx.stroke();

    // Lens label
    ctx.fillStyle = "rgba(150, 210, 255, 0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Convex Lens", lx, ly - lensHalfH - 14);

    ctx.restore();
  }

  function drawFocalPoints(): void {
    const ly = getLensY();
    const scale = getScale();
    const lx = getLensX();

    const fLeftX = lx - focalLength * scale;
    const fRightX = lx + focalLength * scale;

    ctx.save();

    for (const fx of [fLeftX, fRightX]) {
      if (fx < 5 || fx > width - 5) continue;

      // Glow
      const glow = ctx.createRadialGradient(fx, ly, 0, fx, ly, 12);
      glow.addColorStop(0, "rgba(255, 200, 50, 0.4)");
      glow.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.beginPath();
      ctx.arc(fx, ly, 12, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Point
      ctx.beginPath();
      ctx.arc(fx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    }

    // Labels
    ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (fLeftX > 5) ctx.fillText("F", fLeftX, ly + 22);
    if (fRightX < width - 5) ctx.fillText("F'", fRightX, ly + 22);

    // 2F points
    const f2LeftX = lx - 2 * focalLength * scale;
    const f2RightX = lx + 2 * focalLength * scale;

    for (const fx of [f2LeftX, f2RightX]) {
      if (fx > 10 && fx < width - 10) {
        ctx.beginPath();
        ctx.arc(fx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(251, 191, 36, 0.4)";
        ctx.fill();
      }
    }
    if (f2LeftX > 10) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("2F", f2LeftX, ly + 20);
    }
    if (f2RightX < width - 10) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("2F'", f2RightX, ly + 20);
    }

    ctx.restore();
  }

  function drawFilmPlane(): void {
    if (!isFinite(imageDistance) || imageDistance <= 0 || imageDistance > 300) return;

    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const filmX = lx + imageDistance * scale;

    if (filmX < 0 || filmX > width) return;

    ctx.save();

    // Film plane
    const filmH = height * 0.35;
    ctx.fillStyle = "rgba(80, 80, 100, 0.3)";
    ctx.fillRect(filmX - 3, ly - filmH / 2, 6, filmH);

    ctx.strokeStyle = "rgba(200, 200, 220, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(filmX, ly - filmH / 2);
    ctx.lineTo(filmX, ly + filmH / 2);
    ctx.stroke();

    // Film plane label
    ctx.fillStyle = "rgba(200, 200, 220, 0.7)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Film Plane", filmX, ly - filmH / 2 - 8);

    ctx.restore();
  }

  function drawImage(): void {
    if (!isFinite(imageDistance) || Math.abs(imageDistance) > 300) return;

    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const imageH = magnification * candleHeight;
    const imgX = lx + imageDistance * scale;
    const imgTopY = ly - imageH * scale;

    if (imgX < -100 || imgX > width + 100) return;

    ctx.save();

    const isVirtual = imageDistance < 0;

    if (isVirtual) {
      ctx.setLineDash([5, 5]);
    }

    // Inverted candle image (simplified as colored bar)
    const imgColor = isVirtual ? "rgba(255, 160, 50, 0.5)" : "rgba(255, 160, 50, 0.8)";

    // Image body
    ctx.strokeStyle = imgColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(imgX, ly);
    ctx.lineTo(imgX, imgTopY);
    ctx.stroke();

    // Flame at image tip
    ctx.setLineDash([]);
    const flameColor = isVirtual ? "rgba(255, 200, 50, 0.4)" : "rgba(255, 200, 50, 0.7)";
    const flameGlow = ctx.createRadialGradient(imgX, imgTopY, 0, imgX, imgTopY, 10);
    flameGlow.addColorStop(0, flameColor);
    flameGlow.addColorStop(1, "rgba(255, 200, 50, 0)");
    ctx.beginPath();
    ctx.arc(imgX, imgTopY, 10, 0, Math.PI * 2);
    ctx.fillStyle = flameGlow;
    ctx.fill();

    // Arrow tip
    ctx.fillStyle = imgColor;
    const arrowDir = imageH > 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(imgX, imgTopY);
    ctx.lineTo(imgX - 5, imgTopY + arrowDir * 10);
    ctx.lineTo(imgX + 5, imgTopY + arrowDir * 10);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.fillStyle = isVirtual ? "rgba(255, 160, 50, 0.7)" : "rgba(255, 160, 50, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const label = isVirtual ? "Virtual Image" : "Inverted Image";
    ctx.fillText(label, imgX, ly + 18);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`h' = ${Math.abs(imageH).toFixed(1)} cm`, imgX, ly + 32);
    ctx.fillText(magnification < 0 ? "(inverted)" : "(upright)", imgX, ly + 44);

    ctx.restore();
  }

  function drawRays(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const lensHalfH = 20 * scale;

    const candleX = lx - objectDistance * scale;
    const candleTipY = ly - candleHeight * scale;
    const candleBaseCanvasY = ly;

    const isVirtual = objectDistance <= focalLength;

    ctx.save();
    ctx.lineWidth = 1.5;

    // --- Upper rays (from candle flame tip) ---
    if (showUpperRays) {
      // Ray 1: Parallel to axis from tip, then through F' after lens
      const ray1Color = "rgba(255, 100, 100, 0.75)";
      ctx.strokeStyle = ray1Color;

      // Horizontal from tip to lens
      ctx.beginPath();
      ctx.moveTo(candleX, candleTipY);
      ctx.lineTo(lx, candleTipY);
      ctx.stroke();

      // After lens: through F'
      const fRightX = lx + focalLength * scale;
      if (!isVirtual) {
        const dx = fRightX - lx;
        const dy = ly - candleTipY;
        const extend = width - lx;
        ctx.beginPath();
        ctx.moveTo(lx, candleTipY);
        ctx.lineTo(lx + extend, candleTipY + extend * (dy / dx));
        ctx.stroke();
      } else {
        // Bends away; draw forward direction and virtual extension back
        const dx = fRightX - lx;
        const dy = ly - candleTipY;
        ctx.beginPath();
        ctx.moveTo(lx, candleTipY);
        ctx.lineTo(lx + width * 0.4, candleTipY + (width * 0.4) * (dy / dx));
        ctx.stroke();

        // Virtual extension
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = ray1Color.replace("0.75", "0.3");
        ctx.beginPath();
        ctx.moveTo(lx, candleTipY);
        ctx.lineTo(lx - width * 0.3, candleTipY - (width * 0.3) * (dy / dx));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ray 2: Through center of lens (undeviated)
      const ray2Color = "rgba(100, 255, 100, 0.75)";
      ctx.strokeStyle = ray2Color;
      ctx.beginPath();
      ctx.moveTo(candleX, candleTipY);
      const dx2 = lx - candleX;
      const dy2 = ly - candleTipY;
      const extend2 = width;
      ctx.lineTo(candleX + extend2, candleTipY + extend2 * (dy2 / dx2));
      ctx.stroke();

      if (isVirtual) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = ray2Color.replace("0.75", "0.3");
        ctx.beginPath();
        ctx.moveTo(candleX, candleTipY);
        ctx.lineTo(candleX - width * 0.3, candleTipY - (width * 0.3) * (dy2 / dx2));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ray 3: Through F on object side, exits parallel
      const ray3Color = "rgba(100, 150, 255, 0.8)";
      const fLeftX = lx - focalLength * scale;
      ctx.strokeStyle = ray3Color;

      // From tip toward F, extended to lens
      const dx3 = fLeftX - candleX;
      const dy3 = ly - candleTipY;
      const tLens = (lx - candleX) / dx3;
      const hitLensY = candleTipY + tLens * dy3;

      // Clamp to aperture
      const clampedHitY = Math.max(ly - lensHalfH, Math.min(ly + lensHalfH, hitLensY));

      ctx.beginPath();
      ctx.moveTo(candleX, candleTipY);
      ctx.lineTo(lx, clampedHitY);
      ctx.stroke();

      // After lens: parallel to axis
      ctx.beginPath();
      ctx.moveTo(lx, clampedHitY);
      ctx.lineTo(width, clampedHitY);
      ctx.stroke();

      if (isVirtual) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = ray3Color.replace("0.8", "0.3");
        ctx.beginPath();
        ctx.moveTo(lx, clampedHitY);
        ctx.lineTo(0, clampedHitY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // --- Lower rays (from candle base, on the optical axis) ---
    if (showLowerRays) {
      // Additional rays from a point partway up the candle (1/3 height)
      const srcY = ly - (candleHeight * 0.33) * scale;

      // Ray A: Parallel to axis from source
      const rayAColor = "rgba(255, 200, 100, 0.5)";
      ctx.strokeStyle = rayAColor;

      ctx.beginPath();
      ctx.moveTo(candleX, srcY);
      ctx.lineTo(lx, srcY);
      ctx.stroke();

      const fRightX = lx + focalLength * scale;
      if (!isVirtual) {
        const dx = fRightX - lx;
        const dy = ly - srcY;
        const extend = width - lx;
        ctx.beginPath();
        ctx.moveTo(lx, srcY);
        ctx.lineTo(lx + extend, srcY + extend * (dy / dx));
        ctx.stroke();
      }

      // Ray B: Through center
      const rayBColor = "rgba(200, 150, 255, 0.5)";
      ctx.strokeStyle = rayBColor;
      ctx.beginPath();
      ctx.moveTo(candleX, srcY);
      const dxB = lx - candleX;
      const dyB = ly - srcY;
      ctx.lineTo(candleX + width, srcY + width * (dyB / dxB));
      ctx.stroke();

      // Ray C: Through F on object side
      const rayCColor = "rgba(150, 255, 200, 0.5)";
      const fLeftX = lx - focalLength * scale;
      ctx.strokeStyle = rayCColor;

      const dxC = fLeftX - candleX;
      const dyC = ly - srcY;
      const tLensC = (lx - candleX) / dxC;
      const hitYC = srcY + tLensC * dyC;
      const clampedC = Math.max(ly - lensHalfH, Math.min(ly + lensHalfH, hitYC));

      ctx.beginPath();
      ctx.moveTo(candleX, srcY);
      ctx.lineTo(lx, clampedC);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(lx, clampedC);
      ctx.lineTo(width, clampedC);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawDistanceMarkers(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const candleX = lx - objectDistance * scale;
    const markerY = ly + height * 0.22;

    ctx.save();

    // Object distance
    ctx.strokeStyle = "rgba(255, 200, 50, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(candleX, markerY);
    ctx.lineTo(lx, markerY);
    ctx.stroke();

    // Arrowheads
    ctx.beginPath();
    ctx.moveTo(candleX, markerY);
    ctx.lineTo(candleX + 7, markerY - 3);
    ctx.moveTo(candleX, markerY);
    ctx.lineTo(candleX + 7, markerY + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx, markerY);
    ctx.lineTo(lx - 7, markerY - 3);
    ctx.moveTo(lx, markerY);
    ctx.lineTo(lx - 7, markerY + 3);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 200, 50, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`d_o = ${objectDistance} cm`, (candleX + lx) / 2, markerY - 8);

    // Image distance
    if (isFinite(imageDistance) && Math.abs(imageDistance) < 300) {
      const imgX = lx + imageDistance * scale;
      if (imgX > 0 && imgX < width) {
        ctx.strokeStyle = "rgba(255, 160, 50, 0.5)";
        ctx.beginPath();
        ctx.moveTo(lx, markerY + 20);
        ctx.lineTo(imgX, markerY + 20);
        ctx.stroke();

        const dir = imageDistance > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(lx, markerY + 20);
        ctx.lineTo(lx + dir * 7, markerY + 17);
        ctx.moveTo(lx, markerY + 20);
        ctx.lineTo(lx + dir * 7, markerY + 23);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(imgX, markerY + 20);
        ctx.lineTo(imgX - dir * 7, markerY + 17);
        ctx.moveTo(imgX, markerY + 20);
        ctx.lineTo(imgX - dir * 7, markerY + 23);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 160, 50, 0.8)";
        ctx.fillText(`d_i = ${imageDistance.toFixed(1)} cm`, (lx + imgX) / 2, markerY + 14);
      }
    }

    ctx.restore();
  }

  function drawFormulaPanel(): void {
    ctx.save();

    // Bottom-right formula area
    const panelW = 220;
    const panelH = 70;
    const panelX = width - panelW - 10;
    const panelY = height - panelH - 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(200, 200, 255, 0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Thin Lens Equation", panelX + 10, panelY + 18);

    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("1/f = 1/d_o + 1/d_i", panelX + 10, panelY + 40);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 200, 50, 0.7)";
    ctx.fillText(`m = -d_i / d_o = ${isFinite(magnification) ? magnification.toFixed(2) : "N/A"}`, panelX + 10, panelY + 58);

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 230;
    const panelH = 130;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Camera Optics", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Focal length: f = ${focalLength} cm`, panelX + 10, panelY + 40);
    ctx.fillText(`Object distance: d_o = ${objectDistance} cm`, panelX + 10, panelY + 56);

    if (isFinite(imageDistance)) {
      ctx.fillText(`Image distance: d_i = ${imageDistance.toFixed(1)} cm`, panelX + 10, panelY + 72);
      ctx.fillText(`Magnification: ${magnification.toFixed(2)}\u00D7`, panelX + 10, panelY + 88);

      const isReal = imageDistance > 0;
      const isInverted = magnification < 0;
      const sizeLabel = Math.abs(magnification) > 1 ? "Enlarged" : Math.abs(magnification) < 1 ? "Reduced" : "Same size";
      ctx.fillStyle = "rgba(255, 160, 50, 0.9)";
      ctx.fillText(`${isReal ? "Real" : "Virtual"}, ${isInverted ? "Inverted" : "Upright"}, ${sizeLabel}`, panelX + 10, panelY + 104);
    } else {
      ctx.fillText("Image at infinity (d_o = f)", panelX + 10, panelY + 72);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 120);

    ctx.restore();
  }

  function drawRayLegend(): void {
    if (!showUpperRays && !showLowerRays) return;

    ctx.save();
    const legendX = width - 200;
    const legendY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, 188, showUpperRays ? 58 : 28, 6);
    ctx.fill();

    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";

    if (showUpperRays) {
      // Red ray
      ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
      ctx.fillText("-- Parallel ray (through F')", legendX + 8, legendY + 14);
      // Green ray
      ctx.fillStyle = "rgba(100, 255, 100, 0.9)";
      ctx.fillText("-- Central ray (undeviated)", legendX + 8, legendY + 28);
      // Blue ray
      ctx.fillStyle = "rgba(100, 150, 255, 0.9)";
      ctx.fillText("-- Focal ray (exits parallel)", legendX + 8, legendY + 42);
    }

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawOpticalAxis();
    drawFocalPoints();
    drawLens();
    drawFilmPlane();
    drawRays();
    drawCandle();
    drawImage();
    drawDistanceMarkers();
    drawInfoPanel();
    drawFormulaPanel();
    drawRayLegend();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // No persistent resources
  }

  function getStateDescription(): string {
    const isReal = imageDistance > 0;
    const isInverted = magnification < 0;
    const imageH = Math.abs(magnification * candleHeight);

    return (
      `Camera (Simple Optics): Convex lens f=${focalLength}cm. ` +
      `Candle (light source) at d_o=${objectDistance}cm, height=${candleHeight}cm. ` +
      `Image at d_i=${isFinite(imageDistance) ? imageDistance.toFixed(1) : "infinity"}cm, ` +
      `height=${isFinite(imageH) ? imageH.toFixed(1) : "N/A"}cm. ` +
      `Magnification: ${isFinite(magnification) ? magnification.toFixed(2) : "N/A"}. ` +
      `Image is ${isReal ? "real (on film plane)" : "virtual"}, ${isInverted ? "inverted" : "upright"}. ` +
      `Thin lens equation: 1/f = 1/d_o + 1/d_i. ` +
      `Upper rays: ${showUpperRays ? "on" : "off"}, Lower rays: ${showLowerRays ? "on" : "off"}. ` +
      `Time: ${time.toFixed(1)}s.`
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

export default CameraFactory;
