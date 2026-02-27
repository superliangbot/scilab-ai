import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Thin Lens Equation Simulation
 * 1/f = 1/do + 1/di where f=focal length, do=object distance, di=image distance
 * Magnification m = -di/do = hi/ho
 * Shows ray tracing and image formation for converging and diverging lenses
 */

const ThinLensEquationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("thin-lens-equation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Lens parameters
  let focalLength = 150; // mm (positive for converging, negative for diverging)
  let objectDistance = 300; // mm
  let objectHeight = 80; // mm
  let lensType = 1; // 1 = converging, 0 = diverging

  const LENS_X = 400; // Fixed lens position
  let imageDistance = 0;
  let imageHeight = 0;
  let magnification = 0;

  function calculateImageProperties() {
    const f = lensType ? focalLength : -focalLength;
    
    // Thin lens equation: 1/f = 1/do + 1/di
    // di = (f * do) / (do - f)
    if (Math.abs(objectDistance - f) < 0.1) {
      imageDistance = Infinity;
      imageHeight = Infinity;
      magnification = Infinity;
    } else {
      imageDistance = (f * objectDistance) / (objectDistance - f);
      magnification = -imageDistance / objectDistance;
      imageHeight = objectHeight * Math.abs(magnification);
    }
  }

  function drawLens() {
    const lensY = height / 2;
    const lensHeight = 200;

    if (lensType) {
      // Converging lens (biconvex)
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 4;
      
      ctx.beginPath();
      // Left curve
      ctx.arc(LENS_X - 15, lensY, lensHeight / 2, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      
      ctx.beginPath();
      // Right curve
      ctx.arc(LENS_X + 15, lensY, lensHeight / 2, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();
      
      // Vertical line at lens center
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(LENS_X, lensY - lensHeight / 2 - 10);
      ctx.lineTo(LENS_X, lensY + lensHeight / 2 + 10);
      ctx.stroke();
      
    } else {
      // Diverging lens (biconcave)
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 4;
      
      ctx.beginPath();
      // Left curve (concave)
      ctx.arc(LENS_X + 30, lensY, lensHeight / 2, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();
      
      ctx.beginPath();
      // Right curve (concave)
      ctx.arc(LENS_X - 30, lensY, lensHeight / 2, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      
      // Vertical line at lens center
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(LENS_X, lensY - lensHeight / 2 - 10);
      ctx.lineTo(LENS_X, lensY + lensHeight / 2 + 10);
      ctx.stroke();
    }
  }

  function drawFocalPoints() {
    const lensY = height / 2;
    const f = lensType ? focalLength : -focalLength;
    
    // Draw focal points
    ctx.fillStyle = lensType ? "#3b82f6" : "#ef4444";
    
    // Left focal point
    ctx.beginPath();
    ctx.arc(LENS_X - Math.abs(f), lensY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Right focal point
    ctx.beginPath();
    ctx.arc(LENS_X + Math.abs(f), lensY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Focal point labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F", LENS_X - Math.abs(f), lensY - 15);
    ctx.fillText("F'", LENS_X + Math.abs(f), lensY - 15);
  }

  function drawObject() {
    const lensY = height / 2;
    const objectX = LENS_X - objectDistance;
    
    // Object arrow
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(objectX, lensY);
    ctx.lineTo(objectX, lensY - objectHeight);
    ctx.stroke();
    
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(objectX, lensY - objectHeight);
    ctx.lineTo(objectX - 8, lensY - objectHeight + 15);
    ctx.lineTo(objectX + 8, lensY - objectHeight + 15);
    ctx.closePath();
    ctx.fillStyle = "#10b981";
    ctx.fill();
    
    // Object label
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Object", objectX, lensY + 25);
    ctx.fillText(`h₀ = ${objectHeight}mm`, objectX, lensY + 40);
  }

  function drawImage() {
    const lensY = height / 2;
    
    if (!isFinite(imageDistance)) return;
    
    const imageX = LENS_X + imageDistance;
    const isReal = imageDistance > 0;
    const isUpright = magnification > 0;
    
    // Image arrow
    ctx.strokeStyle = isReal ? "#f59e0b" : "#a855f7";
    ctx.lineWidth = isReal ? 3 : 2;
    
    if (!isReal) {
      ctx.setLineDash([5, 5]);
    }
    
    ctx.beginPath();
    ctx.moveTo(imageX, lensY);
    ctx.lineTo(imageX, lensY - (isUpright ? imageHeight : -imageHeight));
    ctx.stroke();
    
    // Arrowhead
    ctx.beginPath();
    const arrowY = lensY - (isUpright ? imageHeight : -imageHeight);
    const arrowDir = isUpright ? 1 : -1;
    ctx.moveTo(imageX, arrowY);
    ctx.lineTo(imageX - 8, arrowY + arrowDir * 15);
    ctx.lineTo(imageX + 8, arrowY + arrowDir * 15);
    ctx.closePath();
    ctx.fillStyle = isReal ? "#f59e0b" : "#a855f7";
    ctx.fill();
    
    ctx.setLineDash([]);
    
    // Image label
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    const imageType = isReal ? "Real" : "Virtual";
    const orientation = isUpright ? "Upright" : "Inverted";
    ctx.fillText(`${imageType} Image`, imageX, lensY + 25);
    ctx.fillText(`${orientation}`, imageX, lensY + 40);
    ctx.fillText(`h₁ = ${imageHeight.toFixed(1)}mm`, imageX, lensY + 55);
  }

  function drawRayTracing() {
    const lensY = height / 2;
    const objectX = LENS_X - objectDistance;
    const objectY = lensY - objectHeight;
    const f = lensType ? focalLength : -focalLength;
    
    if (!isFinite(imageDistance)) return;
    
    const imageX = LENS_X + imageDistance;
    const imageY = lensY - (magnification > 0 ? imageHeight : -imageHeight);
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;
    
    // Ray 1: Parallel to axis → through focal point
    ctx.beginPath();
    ctx.moveTo(objectX, objectY);
    ctx.lineTo(LENS_X, objectY);
    ctx.stroke();
    
    if (lensType) {
      ctx.beginPath();
      ctx.moveTo(LENS_X, objectY);
      ctx.lineTo(LENS_X + Math.abs(f) + 100, lensY - (objectY - lensY) * Math.abs(f) / (Math.abs(f) + 100));
      ctx.stroke();
    } else {
      // For diverging lens, ray appears to come from focal point
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(LENS_X - Math.abs(f), lensY + (objectY - lensY) * Math.abs(f) / objectDistance);
      ctx.lineTo(LENS_X, objectY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.moveTo(LENS_X, objectY);
      ctx.lineTo(width, objectY + (objectY - lensY) * (width - LENS_X) / Math.abs(f));
      ctx.stroke();
    }
    
    // Ray 2: Through center → straight through
    ctx.beginPath();
    ctx.moveTo(objectX, objectY);
    ctx.lineTo(imageX + 50, imageY + (imageY - objectY) * 50 / (imageX - objectX));
    ctx.stroke();
    
    // Ray 3: Through focal point → parallel to axis
    if (lensType && objectDistance > focalLength) {
      ctx.beginPath();
      ctx.moveTo(objectX, objectY);
      ctx.lineTo(LENS_X - f, lensY);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(LENS_X, objectY);
      ctx.lineTo(imageX + 50, objectY);
      ctx.stroke();
    }
  }

  function drawOpticalAxis() {
    const lensY = height / 2;
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, lensY);
    ctx.lineTo(width, lensY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Optical axis label
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Optical Axis", width - 80, lensY - 10);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    calculateImageProperties();
  }

  function update(dt: number, params: Record<string, number>): void {
    focalLength = params.focalLength ?? 150;
    objectDistance = params.objectDistance ?? 300;
    objectHeight = params.objectHeight ?? 80;
    lensType = Math.round(params.lensType ?? 1);

    calculateImageProperties();
    time += dt;
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawOpticalAxis();
    drawFocalPoints();
    drawLens();
    drawObject();
    drawImage();
    drawRayTracing();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 300, 180);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Thin Lens Equation", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    const lensTypeText = lensType ? "Converging" : "Diverging";
    ctx.fillStyle = lensType ? "#60a5fa" : "#f87171";
    ctx.fillText(`${lensTypeText} Lens`, 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`1/f = 1/do + 1/di`, 20, 75);
    ctx.fillText(`f = ${lensType ? focalLength : -focalLength}mm`, 20, 95);
    ctx.fillText(`do = ${objectDistance}mm`, 20, 115);
    
    if (isFinite(imageDistance)) {
      ctx.fillText(`di = ${imageDistance.toFixed(1)}mm`, 20, 135);
      ctx.fillText(`Magnification = ${magnification.toFixed(2)}×`, 20, 155);
      
      const imageType = imageDistance > 0 ? "Real" : "Virtual";
      const orientation = magnification > 0 ? "Upright" : "Inverted";
      const size = Math.abs(magnification) > 1 ? "Enlarged" : "Diminished";
      
      ctx.fillStyle = imageDistance > 0 ? "#f59e0b" : "#a855f7";
      ctx.fillText(`${imageType}, ${orientation}, ${size}`, 20, 175);
    } else {
      ctx.fillText("di = ∞ (No image formed)", 20, 135);
      ctx.fillText("Object at focal point", 20, 155);
    }

    // Equation reminder
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ray 1: Parallel → Focal | Ray 2: Center → Straight | Ray 3: Focal → Parallel", width / 2, height - 20);
  }

  function reset(): void {
    time = 0;
    calculateImageProperties();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const lensTypeText = lensType ? "converging" : "diverging";
    const imageType = imageDistance > 0 ? "real" : "virtual";
    const orientation = magnification > 0 ? "upright" : "inverted";
    
    return (
      `Thin Lens: ${lensTypeText} lens with f=${lensType ? focalLength : -focalLength}mm. ` +
      `Object at do=${objectDistance}mm creates ${imageType} image at di=${imageDistance.toFixed(1)}mm. ` +
      `Magnification=${magnification.toFixed(2)}, image is ${orientation}. ` +
      `Thin lens equation: 1/f = 1/do + 1/di demonstrates image formation principles.`
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

export default ThinLensEquationFactory;