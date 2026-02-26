import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LensFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lens") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let focalLength = 150; // pixels
  let objectDist = 300; // pixels from lens
  let lensType = 0; // 0 = convex, 1 = concave

  const LENS_X_FRAC = 0.5; // Lens at center of canvas
  const AXIS_Y_FRAC = 0.5; // Optical axis at vertical center

  function lensX() { return W * LENS_X_FRAC; }
  function axisY() { return H * AXIS_Y_FRAC; }

  function calcImage() {
    const f = lensType === 0 ? focalLength : -focalLength;
    const u = objectDist; // positive = left of lens
    // Thin lens equation: 1/f = 1/v - 1/u (sign convention: u negative for real object)
    // Using: 1/v = 1/f + 1/u => but with the convention:
    // 1/v = 1/f - 1/(-u) = 1/f + 1/u
    // Actually using: 1/f = 1/v - 1/(-u) = 1/v + 1/u
    // v = f*u / (u - f)
    const v = (f * u) / (u - f);
    const magnification = v / u;
    return { v, magnification };
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
  }

  function update(dt: number, params: Record<string, number>) {
    focalLength = params.focalLength ?? 150;
    objectDist = params.objectDist ?? 300;
    lensType = Math.round(params.lensType ?? 0);
    time += Math.min(dt, 0.05);
  }

  function render() {
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c1222");
    bg.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const lx = lensX();
    const ay = axisY();
    const f = lensType === 0 ? focalLength : -focalLength;

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(lensType === 0 ? "Convex Lens" : "Concave Lens", W / 2, 28);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("1/f = 1/v + 1/u  (Thin Lens Equation)", W / 2, 46);

    // Optical axis
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, ay);
    ctx.lineTo(W, ay);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw lens
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    const lensH = 200;

    if (lensType === 0) {
      // Convex lens (double convex shape)
      ctx.beginPath();
      ctx.ellipse(lx - 5, ay, 15, lensH / 2, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(lx + 5, ay, 15, lensH / 2, 0, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();

      // Arrowheads on lens
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(lx, ay - lensH / 2 - 8);
      ctx.lineTo(lx - 6, ay - lensH / 2 + 4);
      ctx.lineTo(lx + 6, ay - lensH / 2 + 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(lx, ay + lensH / 2 + 8);
      ctx.lineTo(lx - 6, ay + lensH / 2 - 4);
      ctx.lineTo(lx + 6, ay + lensH / 2 - 4);
      ctx.closePath();
      ctx.fill();
    } else {
      // Concave lens
      ctx.beginPath();
      ctx.ellipse(lx - 15, ay, 15, lensH / 2, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(lx + 15, ay, 15, lensH / 2, 0, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();
    }

    // Focal points
    const fColor = "#fbbf24";
    ctx.fillStyle = fColor;

    // F on left
    ctx.beginPath();
    ctx.arc(lx - Math.abs(focalLength), ay, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F", lx - Math.abs(focalLength), ay + 18);

    // F on right
    ctx.beginPath();
    ctx.arc(lx + Math.abs(focalLength), ay, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("F'", lx + Math.abs(focalLength), ay + 18);

    // 2F marks
    ctx.fillStyle = "rgba(251, 191, 36, 0.5)";
    ctx.beginPath();
    ctx.arc(lx - 2 * Math.abs(focalLength), ay, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("2F", lx - 2 * Math.abs(focalLength), ay + 16);

    ctx.beginPath();
    ctx.arc(lx + 2 * Math.abs(focalLength), ay, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("2F'", lx + 2 * Math.abs(focalLength), ay + 16);

    // Object (candle/arrow on left)
    const objX = lx - objectDist;
    const objH = 60;
    const objTop = ay - objH;

    // Object arrow
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(objX, ay);
    ctx.lineTo(objX, objTop);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(objX, objTop - 5);
    ctx.lineTo(objX - 6, objTop + 6);
    ctx.lineTo(objX + 6, objTop + 6);
    ctx.closePath();
    ctx.fill();

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.textAlign = "center";
    ctx.fillText("Object", objX, ay + 15);

    // Calculate image
    const { v, magnification } = calcImage();
    const imgX = lx + v;
    const imgH = objH * magnification;
    const imgTop = ay - imgH;

    const isRealImage = v > 0;

    // Draw 3 principal rays
    // Ray 1: Parallel to axis, then through focal point
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(objX, objTop);
    ctx.lineTo(lx, objTop);
    if (lensType === 0) {
      ctx.lineTo(lx + 500, ay + (objTop - ay) * (500 / focalLength) + (ay - objTop));
    } else {
      // Concave: diverge as if from virtual focal point
      ctx.lineTo(lx + 500, objTop + ((objTop - ay) / focalLength) * 500);
    }
    ctx.stroke();

    // Ray 2: Through center of lens (straight through)
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(objX, objTop);
    ctx.lineTo(lx + 500, objTop + ((ay - objTop) / objectDist) * (500 + objectDist));
    ctx.stroke();

    // Ray 3: Through focal point to parallel
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    if (lensType === 0 && objectDist > focalLength) {
      // Through F then parallel after lens
      const fX = lx - focalLength;
      const slope = (objTop - ay) / (objX - fX);
      const yAtLens = ay + slope * (lx - fX);
      ctx.beginPath();
      ctx.moveTo(objX, objTop);
      ctx.lineTo(lx, yAtLens);
      ctx.lineTo(lx + 500, yAtLens);
      ctx.stroke();
    }

    // Image (inverted or upright depending on magnification)
    if (isRealImage) {
      // Real image - solid line
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(imgX, ay);
      ctx.lineTo(imgX, imgTop);
      ctx.stroke();

      ctx.fillStyle = "#a78bfa";
      ctx.beginPath();
      const tipY = imgH > 0 ? imgTop - 5 : imgTop + 5;
      ctx.moveTo(imgX, tipY);
      ctx.lineTo(imgX - 6, tipY + (imgH > 0 ? 8 : -8));
      ctx.lineTo(imgX + 6, tipY + (imgH > 0 ? 8 : -8));
      ctx.closePath();
      ctx.fill();

      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Real Image", imgX, ay + 15);
    } else {
      // Virtual image - dashed
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(imgX, ay);
      ctx.lineTo(imgX, imgTop);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(167, 139, 250, 0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Virtual Image", imgX, ay + 15);
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(15, H - 130, 250, 115, 8);
    ctx.fill();

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Lens Properties", 25, H - 112);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Focal length (f): ${focalLength} px`, 25, H - 92);
    ctx.fillText(`Object distance (u): ${objectDist} px`, 25, H - 76);
    ctx.fillText(`Image distance (v): ${v.toFixed(1)} px`, 25, H - 60);
    ctx.fillText(`Magnification: ${magnification.toFixed(2)}x`, 25, H - 44);
    ctx.fillText(`Image: ${isRealImage ? "Real" : "Virtual"}, ${Math.abs(magnification) > 1 ? "Enlarged" : "Diminished"}`, 25, H - 28);

    // Ray legend
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("— Parallel ray", W - 150, H - 40);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("— Central ray", W - 150, H - 26);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("— Focal ray", W - 150, H - 12);
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    const { v, magnification } = calcImage();
    const isReal = v > 0;
    return (
      `Lens simulation: ${lensType === 0 ? "Convex" : "Concave"} lens. ` +
      `Focal length: ${focalLength}px, Object distance: ${objectDist}px. ` +
      `Image distance: ${v.toFixed(1)}px, Magnification: ${magnification.toFixed(2)}x. ` +
      `Image is ${isReal ? "real and inverted" : "virtual and upright"}, ` +
      `${Math.abs(magnification) > 1 ? "enlarged" : "diminished"}. ` +
      `Thin lens equation: 1/f = 1/v + 1/u.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LensFactory;
