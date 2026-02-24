import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const CameraOpticsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("camera-optics") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let focalLength = 15; // cm
  let objectDistance = 40; // cm
  let apertureSize = 5;
  let showRays = 5;

  // Computed values
  let imageDistance = 0;
  let magnification = 0;
  let imageHeight = 0;

  // Object height (cm) - fixed
  const objectHeight = 10;

  // Scale: cm -> pixels
  function getScale(): number {
    return Math.min(width, height) / 100;
  }

  // Lens center position
  function getLensX(): number {
    return width * 0.45;
  }

  function getLensY(): number {
    return height * 0.5;
  }

  function cmToPixelsX(cm: number): number {
    return getLensX() + cm * getScale();
  }

  function cmToPixelsY(cm: number): number {
    return getLensY() - cm * getScale();
  }

  function computeOptics(): void {
    // Thin lens equation: 1/f = 1/do + 1/di
    // di = f * do / (do - f)
    if (objectDistance <= focalLength) {
      // Virtual image (when object is at or within focal point)
      imageDistance = (focalLength * objectDistance) / (objectDistance - focalLength);
    } else {
      imageDistance = (focalLength * objectDistance) / (objectDistance - focalLength);
    }

    // Magnification: m = -di/do
    magnification = -imageDistance / objectDistance;
    imageHeight = magnification * objectHeight;
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
    focalLength = params.focalLength ?? 15;
    objectDistance = params.objectDistance ?? 40;
    apertureSize = params.apertureSize ?? 5;
    showRays = Math.round(params.showRays ?? 5);

    computeOptics();
    time += dt;
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.5, "#0d0d24");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawOpticalAxis(): void {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, getLensY());
    ctx.lineTo(width, getLensY());
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawLens(): void {
    const lx = getLensX();
    const ly = getLensY();
    const scale = getScale();
    const lensHalfHeight = apertureSize * scale;

    ctx.save();

    // Lens body - double convex shape
    ctx.beginPath();
    // Left curve
    ctx.moveTo(lx, ly - lensHalfHeight);
    ctx.quadraticCurveTo(lx - 12, ly, lx, ly + lensHalfHeight);
    // Right curve
    ctx.quadraticCurveTo(lx + 12, ly, lx, ly - lensHalfHeight);
    ctx.closePath();

    const lensGrad = ctx.createLinearGradient(lx - 12, ly, lx + 12, ly);
    lensGrad.addColorStop(0, "rgba(100, 180, 255, 0.15)");
    lensGrad.addColorStop(0.3, "rgba(150, 210, 255, 0.25)");
    lensGrad.addColorStop(0.5, "rgba(180, 230, 255, 0.35)");
    lensGrad.addColorStop(0.7, "rgba(150, 210, 255, 0.25)");
    lensGrad.addColorStop(1, "rgba(100, 180, 255, 0.15)");
    ctx.fillStyle = lensGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(150, 210, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrowheads on lens ends (convention for convex lens)
    const arrowSize = 8;
    // Top arrowhead
    ctx.beginPath();
    ctx.moveTo(lx - arrowSize, ly - lensHalfHeight - arrowSize);
    ctx.lineTo(lx, ly - lensHalfHeight);
    ctx.lineTo(lx + arrowSize, ly - lensHalfHeight - arrowSize);
    ctx.strokeStyle = "rgba(150, 210, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bottom arrowhead
    ctx.beginPath();
    ctx.moveTo(lx - arrowSize, ly + lensHalfHeight + arrowSize);
    ctx.lineTo(lx, ly + lensHalfHeight);
    ctx.lineTo(lx + arrowSize, ly + lensHalfHeight + arrowSize);
    ctx.stroke();

    ctx.restore();
  }

  function drawFocalPoints(): void {
    const ly = getLensY();
    const scale = getScale();
    const lx = getLensX();

    // Left focal point (F)
    const fLeftX = lx - focalLength * scale;
    // Right focal point (F')
    const fRightX = lx + focalLength * scale;

    ctx.save();

    for (const fx of [fLeftX, fRightX]) {
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
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F", fLeftX, ly + 22);
    ctx.fillText("F'", fRightX, ly + 22);

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

  function drawObject(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();

    const objX = lx - objectDistance * scale;
    const objTopY = ly - objectHeight * scale;

    ctx.save();

    // Arrow shaft
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(objX, ly);
    ctx.lineTo(objX, objTopY);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.moveTo(objX, objTopY);
    ctx.lineTo(objX - 7, objTopY + 14);
    ctx.lineTo(objX + 7, objTopY + 14);
    ctx.closePath();
    ctx.fill();

    // Glow at tip
    const glow = ctx.createRadialGradient(objX, objTopY, 0, objX, objTopY, 15);
    glow.addColorStop(0, "rgba(34, 197, 94, 0.3)");
    glow.addColorStop(1, "rgba(34, 197, 94, 0)");
    ctx.beginPath();
    ctx.arc(objX, objTopY, 15, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Object", objX, ly + 18);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`h = ${objectHeight} cm`, objX, ly + 32);

    ctx.restore();
  }

  function drawImage(): void {
    if (!isFinite(imageDistance) || Math.abs(imageDistance) > 500) return;

    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();

    const imgX = lx + imageDistance * scale;
    const imgTopY = ly - imageHeight * scale;

    // Check if image is on screen
    if (imgX < -200 || imgX > width + 200) return;

    ctx.save();

    const isVirtual = imageDistance < 0;

    // For virtual images, draw dashed
    if (isVirtual) {
      ctx.setLineDash([5, 5]);
    }

    // Image arrow
    ctx.strokeStyle = isVirtual ? "rgba(168, 85, 247, 0.7)" : "#a855f7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(imgX, ly);
    ctx.lineTo(imgX, imgTopY);
    ctx.stroke();

    // Arrowhead
    ctx.setLineDash([]);
    ctx.fillStyle = isVirtual ? "rgba(168, 85, 247, 0.7)" : "#a855f7";
    const arrowDir = imageHeight > 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(imgX, imgTopY);
    ctx.lineTo(imgX - 7, imgTopY + arrowDir * 14);
    ctx.lineTo(imgX + 7, imgTopY + arrowDir * 14);
    ctx.closePath();
    ctx.fill();

    // Glow
    const glow = ctx.createRadialGradient(imgX, imgTopY, 0, imgX, imgTopY, 15);
    glow.addColorStop(0, "rgba(168, 85, 247, 0.3)");
    glow.addColorStop(1, "rgba(168, 85, 247, 0)");
    ctx.beginPath();
    ctx.arc(imgX, imgTopY, 15, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(168, 85, 247, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isVirtual ? "Virtual Image" : "Real Image", imgX, ly + 18);
    ctx.font = "10px system-ui, sans-serif";
    const absImgH = Math.abs(imageHeight);
    ctx.fillText(`h' = ${absImgH.toFixed(1)} cm`, imgX, ly + 32);

    ctx.restore();
  }

  function drawFilmSensor(): void {
    if (!isFinite(imageDistance) || imageDistance <= 0 || imageDistance > 500) return;

    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const imgX = lx + imageDistance * scale;

    if (imgX < 0 || imgX > width) return;

    ctx.save();

    // Film/sensor plane
    const sensorHalfH = Math.min(Math.abs(imageHeight) * scale * 1.5, height * 0.35);
    ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(imgX, ly - sensorHalfH);
    ctx.lineTo(imgX, ly + sensorHalfH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sensor label
    ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Film/Sensor", imgX, ly + sensorHalfH + 14);

    ctx.restore();
  }

  function drawRays(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const lensHalfH = apertureSize * scale;

    const objX = lx - objectDistance * scale;
    const objTopY = ly - objectHeight * scale;

    ctx.save();
    ctx.lineWidth = 1.5;

    // Color palette for rays
    const rayColors = [
      "rgba(255, 100, 100, 0.7)",  // red
      "rgba(100, 255, 100, 0.7)",  // green
      "rgba(100, 150, 255, 0.8)",  // blue
      "rgba(255, 200, 50, 0.7)",   // yellow
      "rgba(255, 100, 200, 0.7)",  // pink
    ];

    const isVirtual = objectDistance <= focalLength;

    // Ray 1: Parallel to axis -> through F' (always draw this one)
    if (showRays >= 1) {
      const color = rayColors[0];
      ctx.strokeStyle = color;
      ctx.beginPath();
      // From object tip horizontally to lens
      ctx.moveTo(objX, objTopY);
      ctx.lineTo(lx, objTopY);
      ctx.stroke();

      // Then through focal point on other side (or appears to come from it for virtual)
      const fRightX = lx + focalLength * scale;
      if (!isVirtual) {
        // Real: bends through F'
        ctx.beginPath();
        ctx.moveTo(lx, objTopY);
        // Direction: from (lx, objTopY) toward (fRightX, ly)
        const dx = fRightX - lx;
        const dy = ly - objTopY;
        const extend = width;
        ctx.lineTo(lx + extend * (dx / Math.abs(dx || 1)), objTopY + extend * (dy / Math.abs(dx || 1)));
        ctx.stroke();
      } else {
        // Virtual: bends away, but extension goes back through F on same side
        const fLeftX = lx - focalLength * scale;
        const dx = lx - fLeftX;
        const dy = objTopY - ly;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          // Ray goes from lens outward in direction away from F
          ctx.beginPath();
          ctx.moveTo(lx, objTopY);
          ctx.lineTo(lx + width * 0.5, objTopY + (width * 0.5) * (ly - objTopY) / (fRightX - lx));
          ctx.stroke();

          // Virtual extension back
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = color.replace("0.7", "0.3").replace("0.8", "0.3");
          ctx.beginPath();
          ctx.moveTo(lx, objTopY);
          ctx.lineTo(lx - width * 0.3, objTopY - (width * 0.3) * (ly - objTopY) / (fRightX - lx));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Ray 2: Through center of lens (undeviated)
    if (showRays >= 2) {
      const color = rayColors[1];
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(objX, objTopY);
      // Straight through center
      const dx = lx - objX;
      const dy = ly - objTopY;
      const extend = width;
      ctx.lineTo(objX + extend, objTopY + extend * (dy / dx));
      ctx.stroke();
    }

    // Ray 3: Through F on object side -> parallel after lens
    if (showRays >= 3) {
      const color = rayColors[2];
      const fLeftX = lx - focalLength * scale;

      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(objX, objTopY);
      // Direction toward F on object side
      const dx = fLeftX - objX;
      const dy = ly - objTopY;
      const t = (lx - objX) / (fLeftX - objX);
      const hitY = objTopY + t * dy;

      // Clamp to lens aperture
      const clampedHitY = Math.max(ly - lensHalfH, Math.min(ly + lensHalfH, hitY));
      ctx.lineTo(lx, clampedHitY);
      ctx.stroke();

      // After lens: parallel to axis
      ctx.beginPath();
      ctx.moveTo(lx, clampedHitY);
      ctx.lineTo(width, clampedHitY);
      ctx.stroke();

      if (isVirtual) {
        // Virtual: draw extension backwards
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color.replace("0.8", "0.3").replace("0.7", "0.3");
        ctx.beginPath();
        ctx.moveTo(lx, clampedHitY);
        ctx.lineTo(0, clampedHitY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Additional marginal rays through different lens positions
    if (showRays > 3) {
      const imgX = lx + imageDistance * scale;
      const imgTopY = ly - imageHeight * scale;

      for (let i = 3; i < showRays; i++) {
        const color = rayColors[i % rayColors.length];
        // Ray hits lens at fractional height
        const frac = ((i - 2) / (showRays - 2)) * 2 - 1; // -1 to 1
        const hitY = ly + frac * lensHalfH * 0.8;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        // From object tip to lens hit point
        ctx.beginPath();
        ctx.moveTo(objX, objTopY);
        ctx.lineTo(lx, hitY);
        ctx.stroke();

        // From lens hit point toward image (if real)
        if (!isVirtual && isFinite(imageDistance) && Math.abs(imageDistance) < 300) {
          ctx.beginPath();
          ctx.moveTo(lx, hitY);
          // Converges to image point
          const dx = imgX - lx;
          const dy = imgTopY - hitY;
          const extend = Math.max(width - lx, 100);
          ctx.lineTo(lx + extend, hitY + extend * (dy / dx));
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  function drawDistanceMarkers(): void {
    const scale = getScale();
    const lx = getLensX();
    const ly = getLensY();
    const objX = lx - objectDistance * scale;
    const markerY = ly + height * 0.25;

    ctx.save();

    // Object distance
    ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(objX, markerY);
    ctx.lineTo(lx, markerY);
    ctx.stroke();

    // Arrowheads
    ctx.beginPath();
    ctx.moveTo(objX, markerY);
    ctx.lineTo(objX + 8, markerY - 4);
    ctx.moveTo(objX, markerY);
    ctx.lineTo(objX + 8, markerY + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx, markerY);
    ctx.lineTo(lx - 8, markerY - 4);
    ctx.moveTo(lx, markerY);
    ctx.lineTo(lx - 8, markerY + 4);
    ctx.stroke();

    ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`d_o = ${objectDistance} cm`, (objX + lx) / 2, markerY - 8);

    // Image distance
    if (isFinite(imageDistance) && Math.abs(imageDistance) < 300) {
      const imgX = lx + imageDistance * scale;
      if (imgX > 0 && imgX < width) {
        ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
        ctx.beginPath();
        ctx.moveTo(lx, markerY + 20);
        ctx.lineTo(imgX, markerY + 20);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(lx, markerY + 20);
        ctx.lineTo(lx + (imageDistance > 0 ? 8 : -8), markerY + 16);
        ctx.moveTo(lx, markerY + 20);
        ctx.lineTo(lx + (imageDistance > 0 ? 8 : -8), markerY + 24);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(imgX, markerY + 20);
        ctx.lineTo(imgX - (imageDistance > 0 ? 8 : -8), markerY + 16);
        ctx.moveTo(imgX, markerY + 20);
        ctx.lineTo(imgX - (imageDistance > 0 ? 8 : -8), markerY + 24);
        ctx.stroke();

        ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
        ctx.fillText(`d_i = ${imageDistance.toFixed(1)} cm`, (lx + imgX) / 2, markerY + 14);
      }
    }

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 250;
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
    ctx.fillText("Camera Optics (Thin Lens)", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 38);
    ctx.fillText(`1/f = 1/d_o + 1/d_i`, panelX + 10, panelY + 54);
    ctx.fillText(`f = ${focalLength} cm, d_o = ${objectDistance} cm`, panelX + 10, panelY + 70);

    if (isFinite(imageDistance)) {
      ctx.fillText(`d_i = ${imageDistance.toFixed(1)} cm`, panelX + 10, panelY + 86);
      ctx.fillText(`Magnification: ${magnification.toFixed(2)}\u00D7`, panelX + 10, panelY + 102);

      const isReal = imageDistance > 0;
      const isInverted = magnification < 0;
      const imageType = isReal ? "Real" : "Virtual";
      const imageOrientation = isInverted ? "Inverted" : "Upright";
      const sizeLabel = Math.abs(magnification) > 1 ? "Enlarged" : Math.abs(magnification) < 1 ? "Reduced" : "Same size";
      ctx.fillStyle = "rgba(168, 85, 247, 0.9)";
      ctx.fillText(`${imageType}, ${imageOrientation}, ${sizeLabel}`, panelX + 10, panelY + 118);
    } else {
      ctx.fillText("Image at infinity (d_o = f)", panelX + 10, panelY + 86);
    }

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawOpticalAxis();
    drawFocalPoints();
    drawLens();
    drawRays();
    drawObject();
    drawImage();
    drawFilmSensor();
    drawDistanceMarkers();
    drawInfoPanel();
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
    return (
      `Camera Optics: Thin lens with f=${focalLength}cm. ` +
      `Object at d_o=${objectDistance}cm, height=${objectHeight}cm. ` +
      `Image at d_i=${isFinite(imageDistance) ? imageDistance.toFixed(1) : "infinity"}cm, ` +
      `magnification=${isFinite(magnification) ? magnification.toFixed(2) : "N/A"}. ` +
      `Image is ${isReal ? "real" : "virtual"}, ${isInverted ? "inverted" : "upright"}. ` +
      `1/f = 1/d_o + 1/d_i. Aperture: ${apertureSize}. ` +
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

export default CameraOpticsFactory;
