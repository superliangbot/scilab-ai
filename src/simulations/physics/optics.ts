import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const OpticsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("optics") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let focalLength = 100;
  let lensType = 0; // 0=convex, 1=concave
  let objectDistance = 200;
  let showRays = 1;

  // Computed values
  let imageDistance = 0;
  let magnification = 0;

  // Scale: pixels per mm
  function getScale(): number {
    return Math.min(width, height) / 600;
  }

  function computeImageProperties(): void {
    const f = lensType === 0 ? focalLength : -focalLength;
    // Thin lens equation: 1/f = 1/do + 1/di => di = f*do / (do - f)
    const denom = objectDistance - f;
    if (Math.abs(denom) < 0.01) {
      imageDistance = Infinity;
      magnification = Infinity;
    } else {
      imageDistance = (f * objectDistance) / denom;
      magnification = -imageDistance / objectDistance;
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    computeImageProperties();
  }

  function update(dt: number, params: Record<string, number>): void {
    focalLength = params.focalLength ?? 100;
    lensType = params.lensType ?? 0;
    objectDistance = params.objectDistance ?? 200;
    showRays = params.showRays ?? 1;

    time += dt;
    computeImageProperties();
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0d1117");
    bgGrad.addColorStop(1, "#161b22");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawPrincipalAxis(): void {
    const cy = height / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(100, 140, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawLens(): void {
    const cx = width / 2;
    const cy = height / 2;
    const scale = getScale();
    const lensHeight = Math.min(height * 0.6, 200 * scale);

    ctx.save();
    ctx.strokeStyle = "rgba(150, 200, 255, 0.7)";
    ctx.lineWidth = 3;

    if (lensType === 0) {
      // Convex lens — outward curves
      ctx.beginPath();
      ctx.moveTo(cx, cy - lensHeight / 2);
      ctx.quadraticCurveTo(cx + 20 * scale, cy, cx, cy + lensHeight / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - lensHeight / 2);
      ctx.quadraticCurveTo(cx - 20 * scale, cy, cx, cy + lensHeight / 2);
      ctx.stroke();

      // Arrowheads at top and bottom
      ctx.fillStyle = "rgba(150, 200, 255, 0.7)";
      // Top
      ctx.beginPath();
      ctx.moveTo(cx, cy - lensHeight / 2 - 6);
      ctx.lineTo(cx - 5, cy - lensHeight / 2 + 4);
      ctx.lineTo(cx + 5, cy - lensHeight / 2 + 4);
      ctx.closePath();
      ctx.fill();
      // Bottom
      ctx.beginPath();
      ctx.moveTo(cx, cy + lensHeight / 2 + 6);
      ctx.lineTo(cx - 5, cy + lensHeight / 2 - 4);
      ctx.lineTo(cx + 5, cy + lensHeight / 2 - 4);
      ctx.closePath();
      ctx.fill();
    } else {
      // Concave lens — inward curves
      ctx.beginPath();
      ctx.moveTo(cx, cy - lensHeight / 2);
      ctx.quadraticCurveTo(cx - 15 * scale, cy, cx, cy + lensHeight / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - lensHeight / 2);
      ctx.quadraticCurveTo(cx + 15 * scale, cy, cx, cy + lensHeight / 2);
      ctx.stroke();

      // Arrowheads outward
      ctx.fillStyle = "rgba(150, 200, 255, 0.7)";
      // Top-left
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - lensHeight / 2 - 4);
      ctx.lineTo(cx + 5, cy - lensHeight / 2 - 4);
      ctx.lineTo(cx, cy - lensHeight / 2 + 4);
      ctx.closePath();
      ctx.fill();
      // Bottom
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy + lensHeight / 2 + 4);
      ctx.lineTo(cx + 5, cy + lensHeight / 2 + 4);
      ctx.lineTo(cx, cy + lensHeight / 2 - 4);
      ctx.closePath();
      ctx.fill();
    }

    // Optical center mark
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fill();

    ctx.restore();
  }

  function drawFocalPoints(): void {
    const cx = width / 2;
    const cy = height / 2;
    const scale = getScale();
    const f = focalLength * scale;

    ctx.save();
    ctx.fillStyle = "rgba(255, 200, 80, 0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // F on left
    ctx.beginPath();
    ctx.arc(cx - f, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("F", cx - f, cy + 8);

    // F' on right
    ctx.beginPath();
    ctx.arc(cx + f, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("F'", cx + f, cy + 8);

    // 2F markers
    ctx.fillStyle = "rgba(255, 200, 80, 0.4)";
    ctx.beginPath();
    ctx.arc(cx - 2 * f, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("2F", cx - 2 * f, cy + 8);

    ctx.beginPath();
    ctx.arc(cx + 2 * f, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("2F'", cx + 2 * f, cy + 8);

    ctx.restore();
  }

  function drawObject(): void {
    const cx = width / 2;
    const cy = height / 2;
    const scale = getScale();
    const objX = cx - objectDistance * scale;
    const objHeight = 50 * scale;

    // Object arrow (upward)
    ctx.save();
    ctx.strokeStyle = "rgba(80, 220, 120, 0.9)";
    ctx.fillStyle = "rgba(80, 220, 120, 0.9)";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(objX, cy);
    ctx.lineTo(objX, cy - objHeight);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(objX, cy - objHeight - 6);
    ctx.lineTo(objX - 5, cy - objHeight + 4);
    ctx.lineTo(objX + 5, cy - objHeight + 4);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Object", objX, cy + 8);

    ctx.restore();
  }

  function drawImage(): void {
    if (!isFinite(imageDistance)) return;

    const cx = width / 2;
    const cy = height / 2;
    const scale = getScale();
    const imgX = cx + imageDistance * scale;
    const objHeight = 50 * scale;
    const imgHeight = objHeight * magnification;

    // Clamp for display
    const displayImgH = Math.max(-height * 0.4, Math.min(height * 0.4, imgHeight));

    const isVirtual = imageDistance < 0;

    ctx.save();
    if (isVirtual) {
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = "rgba(255, 120, 80, 0.7)";
      ctx.fillStyle = "rgba(255, 120, 80, 0.7)";
    } else {
      ctx.strokeStyle = "rgba(255, 80, 180, 0.9)";
      ctx.fillStyle = "rgba(255, 80, 180, 0.9)";
    }
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(imgX, cy);
    ctx.lineTo(imgX, cy - displayImgH);
    ctx.stroke();

    // Arrowhead
    const dir = displayImgH > 0 ? -1 : 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(imgX, cy - displayImgH + dir * 6);
    ctx.lineTo(imgX - 5, cy - displayImgH - dir * 4);
    ctx.lineTo(imgX + 5, cy - displayImgH - dir * 4);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const label = isVirtual ? "Virtual Image" : "Real Image";
    ctx.fillText(label, imgX, cy + 8);

    ctx.restore();
  }

  function drawRays(): void {
    if (showRays < 0.5) return;

    const cx = width / 2;
    const cy = height / 2;
    const scale = getScale();
    const objX = cx - objectDistance * scale;
    const objHeight = 50 * scale;
    const objTop = cy - objHeight;
    const f = (lensType === 0 ? focalLength : -focalLength) * scale;

    ctx.save();
    ctx.lineWidth = 1.5;

    // Ray 1: Parallel to axis, then through focal point (convex) / away from focal (concave)
    const ray1Color = "rgba(255, 80, 80, 0.7)";
    ctx.strokeStyle = ray1Color;
    // Incoming: from object top, horizontal to lens
    ctx.beginPath();
    ctx.moveTo(objX, objTop);
    ctx.lineTo(cx, objTop);
    ctx.stroke();
    // Outgoing: refracted through F' (convex) or diverging from F (concave)
    if (lensType === 0) {
      // Converges to F' on right side
      const focalPtX = cx + f;
      const slope = (cy - objTop) / f;
      const endX = width;
      const endY = objTop + slope * (endX - cx);
      ctx.beginPath();
      ctx.moveTo(cx, objTop);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    } else {
      // Diverges as if coming from F on the left
      const focalPtX = cx + f; // f is negative, so this is left of lens
      const slope = (objTop - cy) / (cx - focalPtX);
      const endX = width;
      const endY = objTop + slope * (endX - cx);
      ctx.beginPath();
      ctx.moveTo(cx, objTop);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      // Virtual extension (dashed) back toward virtual focal point
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = "rgba(255, 80, 80, 0.3)";
      ctx.beginPath();
      ctx.moveTo(cx, objTop);
      ctx.lineTo(focalPtX, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ray 2: Through optical center (straight through)
    const ray2Color = "rgba(80, 200, 255, 0.7)";
    ctx.strokeStyle = ray2Color;
    const slope2 = (cy - objTop) / (cx - objX);
    const endX2 = width;
    const endY2 = objTop + slope2 * (endX2 - objX);
    ctx.beginPath();
    ctx.moveTo(objX, objTop);
    ctx.lineTo(endX2, endY2);
    ctx.stroke();

    // Ray 3: Through focal point on object side, then parallel (convex)
    // or aimed at F' on image side, then parallel (concave)
    const ray3Color = "rgba(80, 255, 120, 0.7)";
    ctx.strokeStyle = ray3Color;
    if (lensType === 0) {
      const focalPtX = cx - f;
      const slope3 = (objTop - cy) / (objX - focalPtX);
      const lensY = cy + slope3 * (cx - focalPtX);
      ctx.beginPath();
      ctx.moveTo(objX, objTop);
      ctx.lineTo(cx, lensY);
      ctx.stroke();
      // After lens: parallel to axis
      ctx.beginPath();
      ctx.moveTo(cx, lensY);
      ctx.lineTo(width, lensY);
      ctx.stroke();
    } else {
      // Aimed at F' (which is on the left for concave since f<0)
      const focalPtX = cx - f; // cx - (-|f|) = cx + |f|, right side
      const slope3 = (cy - objTop) / (focalPtX - objX);
      const lensY = objTop + slope3 * (cx - objX);
      ctx.beginPath();
      ctx.moveTo(objX, objTop);
      ctx.lineTo(cx, lensY);
      ctx.stroke();
      // After lens: parallel
      ctx.beginPath();
      ctx.moveTo(cx, lensY);
      ctx.lineTo(width, lensY);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();

    const panelW = 230;
    const panelH = 130;
    const panelX = 12;
    const panelY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const title = lensType === 0 ? "Convex Lens" : "Concave Lens";
    ctx.fillText(title, panelX + 12, panelY + 10);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 200, 80, 0.8)";
    ctx.fillText(`Focal length (f): ${focalLength} mm`, panelX + 12, panelY + 32);

    ctx.fillStyle = "rgba(80, 220, 120, 0.8)";
    ctx.fillText(`Object distance (do): ${objectDistance} mm`, panelX + 12, panelY + 50);

    ctx.fillStyle = "rgba(255, 80, 180, 0.8)";
    if (isFinite(imageDistance)) {
      const diSign = imageDistance > 0 ? "+" : "";
      ctx.fillText(`Image distance (di): ${diSign}${imageDistance.toFixed(1)} mm`, panelX + 12, panelY + 68);
    } else {
      ctx.fillText("Image distance (di): ∞ (at infinity)", panelX + 12, panelY + 68);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    if (isFinite(magnification)) {
      const mSign = magnification > 0 ? "+" : "";
      ctx.fillText(`Magnification (M): ${mSign}${magnification.toFixed(2)}x`, panelX + 12, panelY + 86);
      const imageType = imageDistance > 0 ? "Real" : "Virtual";
      const orientation = magnification > 0 ? "Upright" : "Inverted";
      ctx.fillText(`${imageType}, ${orientation}`, panelX + 12, panelY + 104);
    } else {
      ctx.fillText("Magnification: ∞", panelX + 12, panelY + 86);
      ctx.fillText("Object at focal point — no image", panelX + 12, panelY + 104);
    }

    ctx.restore();
  }

  function drawEquation(): void {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Thin Lens Equation: 1/f = 1/do + 1/di", width / 2, height - 12);
    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawPrincipalAxis();
    drawFocalPoints();
    drawLens();
    drawRays();
    drawObject();
    drawImage();
    drawInfoPanel();
    drawEquation();
  }

  function reset(): void {
    time = 0;
    computeImageProperties();
  }

  function destroy(): void {
    // No resources to clean up
  }

  function getStateDescription(): string {
    const type = lensType === 0 ? "convex" : "concave";
    const diStr = isFinite(imageDistance) ? `${imageDistance.toFixed(1)} mm` : "infinity";
    const mStr = isFinite(magnification) ? `${magnification.toFixed(2)}x` : "infinity";
    const imageType = imageDistance > 0 ? "real" : "virtual";
    const orientation = magnification > 0 ? "upright" : "inverted";

    return (
      `Optics simulation with a ${type} lens. Focal length = ${focalLength} mm. ` +
      `Object at ${objectDistance} mm from lens. ` +
      `Image forms at ${diStr} (${imageType}, ${orientation}). ` +
      `Magnification = ${mStr}. ` +
      `Using the thin lens equation: 1/f = 1/do + 1/di. ` +
      `Convex lenses converge parallel rays to a real focal point; ` +
      `concave lenses diverge them as if from a virtual focal point.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default OpticsFactory;
