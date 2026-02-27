import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Curved Mirror Optics
 * Mirror equation: 1/f = 1/do + 1/di (f = R/2 for spherical mirrors)
 * Shows concave (converging) and convex (diverging) mirror reflections
 * Demonstrates real vs virtual images with ray tracing
 */

const CurvedMirrorOpticsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("curved-mirror-optics") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Mirror parameters
  let radiusOfCurvature = 200; // mm
  let objectDistance = 300; // mm
  let objectHeight = 60; // mm
  let mirrorType = 1; // 1 = concave, 0 = convex

  const MIRROR_X = 500; // Fixed mirror position
  let imageDistance = 0;
  let imageHeight = 0;
  let magnification = 0;
  let focalLength = 0;

  function calculateImageProperties() {
    focalLength = radiusOfCurvature / 2;
    const f = mirrorType ? focalLength : -focalLength;
    
    // Mirror equation: 1/f = 1/do + 1/di
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

  function drawMirror() {
    const mirrorY = height / 2;
    const mirrorHeight = 180;
    const curveRadius = 40;

    if (mirrorType) {
      // Concave mirror (reflecting surface curves inward)
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 6;
      
      ctx.beginPath();
      ctx.arc(MIRROR_X + curveRadius, mirrorY, mirrorHeight / 2, Math.PI * 0.75, Math.PI * 1.25);
      ctx.stroke();
      
      // Reflective surface indication
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 0.75) + i * (Math.PI * 0.5) / 4;
        const x1 = MIRROR_X + curveRadius + (mirrorHeight / 2 - 8) * Math.cos(angle);
        const y1 = mirrorY + (mirrorHeight / 2 - 8) * Math.sin(angle);
        const x2 = MIRROR_X + curveRadius + (mirrorHeight / 2 - 15) * Math.cos(angle);
        const y2 = mirrorY + (mirrorHeight / 2 - 15) * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      
    } else {
      // Convex mirror (reflecting surface curves outward)
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 6;
      
      ctx.beginPath();
      ctx.arc(MIRROR_X - curveRadius, mirrorY, mirrorHeight / 2, -Math.PI * 0.25, Math.PI * 0.25);
      ctx.stroke();
      
      // Reflective surface indication
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const angle = (-Math.PI * 0.25) + i * (Math.PI * 0.5) / 4;
        const x1 = MIRROR_X - curveRadius + (mirrorHeight / 2 - 8) * Math.cos(angle);
        const y1 = mirrorY + (mirrorHeight / 2 - 8) * Math.sin(angle);
        const x2 = MIRROR_X - curveRadius + (mirrorHeight / 2 - 15) * Math.cos(angle);
        const y2 = mirrorY + (mirrorHeight / 2 - 15) * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Vertical reference line at mirror
    ctx.strokeStyle = mirrorType ? "#f59e0b" : "#ef4444";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(MIRROR_X, mirrorY - mirrorHeight / 2 - 20);
    ctx.lineTo(MIRROR_X, mirrorY + mirrorHeight / 2 + 20);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFocalPoint() {
    const mirrorY = height / 2;
    const f = mirrorType ? focalLength : -focalLength;
    
    // Focal point
    ctx.fillStyle = mirrorType ? "#f59e0b" : "#ef4444";
    ctx.beginPath();
    ctx.arc(MIRROR_X - Math.abs(f), mirrorY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Center of curvature
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(MIRROR_X - radiusOfCurvature * (mirrorType ? 1 : -1), mirrorY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F", MIRROR_X - Math.abs(f), mirrorY - 20);
    ctx.fillText("C", MIRROR_X - radiusOfCurvature * (mirrorType ? 1 : -1), mirrorY - 20);
  }

  function drawObject() {
    const mirrorY = height / 2;
    const objectX = MIRROR_X - objectDistance;
    
    // Object arrow
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(objectX, mirrorY);
    ctx.lineTo(objectX, mirrorY - objectHeight);
    ctx.stroke();
    
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(objectX, mirrorY - objectHeight);
    ctx.lineTo(objectX - 8, mirrorY - objectHeight + 15);
    ctx.lineTo(objectX + 8, mirrorY - objectHeight + 15);
    ctx.closePath();
    ctx.fillStyle = "#10b981";
    ctx.fill();
    
    // Object label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Object", objectX, mirrorY + 25);
  }

  function drawImage() {
    const mirrorY = height / 2;
    
    if (!isFinite(imageDistance)) return;
    
    const imageX = MIRROR_X - Math.abs(imageDistance);
    const isReal = imageDistance > 0;
    const isUpright = magnification > 0;
    
    // For convex mirrors, images are always virtual and behind the mirror
    const actualImageX = mirrorType 
      ? (isReal ? MIRROR_X - imageDistance : MIRROR_X + Math.abs(imageDistance))
      : MIRROR_X + Math.abs(imageDistance);
    
    // Image arrow
    ctx.strokeStyle = isReal && mirrorType ? "#f59e0b" : "#a855f7";
    ctx.lineWidth = isReal && mirrorType ? 3 : 2;
    
    if (!isReal || !mirrorType) {
      ctx.setLineDash([5, 5]);
    }
    
    ctx.beginPath();
    ctx.moveTo(actualImageX, mirrorY);
    ctx.lineTo(actualImageX, mirrorY - (isUpright ? imageHeight : -imageHeight));
    ctx.stroke();
    
    // Arrowhead
    ctx.beginPath();
    const arrowY = mirrorY - (isUpright ? imageHeight : -imageHeight);
    const arrowDir = isUpright ? 1 : -1;
    ctx.moveTo(actualImageX, arrowY);
    ctx.lineTo(actualImageX - 8, arrowY + arrowDir * 15);
    ctx.lineTo(actualImageX + 8, arrowY + arrowDir * 15);
    ctx.closePath();
    ctx.fillStyle = isReal && mirrorType ? "#f59e0b" : "#a855f7";
    ctx.fill();
    
    ctx.setLineDash([]);
    
    // Image label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    const imageType = (isReal && mirrorType) ? "Real" : "Virtual";
    const orientation = isUpright ? "Upright" : "Inverted";
    ctx.fillText(`${imageType} Image`, actualImageX, mirrorY + 25);
    ctx.fillText(`${orientation}`, actualImageX, mirrorY + 40);
  }

  function drawRayTracing() {
    const mirrorY = height / 2;
    const objectX = MIRROR_X - objectDistance;
    const objectY = mirrorY - objectHeight;
    const f = mirrorType ? focalLength : -focalLength;
    
    if (!isFinite(imageDistance)) return;
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1.5;
    
    // Ray 1: Parallel to axis → reflects through focal point
    ctx.beginPath();
    ctx.moveTo(objectX, objectY);
    ctx.lineTo(MIRROR_X, objectY);
    ctx.stroke();
    
    if (mirrorType) {
      // Concave: reflects through focal point
      const reflectedSlope = (mirrorY - objectY) / (MIRROR_X - Math.abs(f) - MIRROR_X);
      ctx.beginPath();
      ctx.moveTo(MIRROR_X, objectY);
      ctx.lineTo(50, objectY + reflectedSlope * (50 - MIRROR_X));
      ctx.stroke();
    } else {
      // Convex: appears to diverge from focal point behind mirror
      const virtualFocalX = MIRROR_X + Math.abs(f);
      const reflectedSlope = (objectY - mirrorY) / (MIRROR_X - virtualFocalX);
      
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(virtualFocalX, mirrorY);
      ctx.lineTo(MIRROR_X, objectY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.moveTo(MIRROR_X, objectY);
      ctx.lineTo(50, objectY + reflectedSlope * (50 - MIRROR_X));
      ctx.stroke();
    }
    
    // Ray 2: Through center of curvature → reflects back on itself
    const centerX = MIRROR_X - radiusOfCurvature * (mirrorType ? 1 : -1);
    ctx.beginPath();
    ctx.moveTo(objectX, objectY);
    ctx.lineTo(centerX, mirrorY + (objectY - mirrorY) * (centerX - objectX) / (MIRROR_X - objectX));
    ctx.stroke();
    
    // Reflection back
    ctx.beginPath();
    const intersectionY = mirrorY + (objectY - mirrorY) * (centerX - objectX) / (MIRROR_X - objectX);
    ctx.moveTo(MIRROR_X, intersectionY);
    ctx.lineTo(50, intersectionY);
    ctx.stroke();
    
    // Ray 3: Through focal point → reflects parallel to axis
    if (mirrorType && objectDistance > focalLength) {
      ctx.beginPath();
      ctx.moveTo(objectX, objectY);
      ctx.lineTo(MIRROR_X - f, mirrorY);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(MIRROR_X, objectY);
      ctx.lineTo(50, objectY);
      ctx.stroke();
    }
  }

  function drawOpticalAxis() {
    const mirrorY = height / 2;
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, mirrorY);
    ctx.lineTo(width, mirrorY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Principal axis label
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Principal Axis", width - 90, mirrorY - 10);
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
    radiusOfCurvature = params.radiusOfCurvature ?? 200;
    objectDistance = params.objectDistance ?? 300;
    objectHeight = params.objectHeight ?? 60;
    mirrorType = Math.round(params.mirrorType ?? 1);

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
    drawFocalPoint();
    drawMirror();
    drawObject();
    drawImage();
    drawRayTracing();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 300, 200);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Curved Mirror Optics", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    const mirrorTypeText = mirrorType ? "Concave (Converging)" : "Convex (Diverging)";
    ctx.fillStyle = mirrorType ? "#fbbf24" : "#f87171";
    ctx.fillText(mirrorTypeText, 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`1/f = 1/do + 1/di`, 20, 75);
    ctx.fillText(`f = R/2 = ${(mirrorType ? focalLength : -focalLength).toFixed(1)}mm`, 20, 95);
    ctx.fillText(`R = ${radiusOfCurvature}mm`, 20, 115);
    ctx.fillText(`do = ${objectDistance}mm`, 20, 135);
    
    if (isFinite(imageDistance)) {
      ctx.fillText(`di = ${imageDistance.toFixed(1)}mm`, 20, 155);
      ctx.fillText(`Magnification = ${magnification.toFixed(2)}×`, 20, 175);
      
      const isReal = imageDistance > 0 && mirrorType;
      const imageType = isReal ? "Real" : "Virtual";
      const orientation = magnification > 0 ? "Upright" : "Inverted";
      const size = Math.abs(magnification) > 1 ? "Enlarged" : "Diminished";
      
      ctx.fillStyle = isReal ? "#f59e0b" : "#a855f7";
      ctx.fillText(`${imageType}, ${orientation}, ${size}`, 20, 195);
    } else {
      ctx.fillText("di = ∞ (No image)", 20, 155);
      ctx.fillText("Object at focal point", 20, 175);
    }

    // Mirror types info
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 200, 10, 190, 100);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Mirror Types:", width - 190, 30);
    
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Concave: Can form real", width - 190, 50);
    ctx.fillText("or virtual images", width - 190, 65);
    
    ctx.fillStyle = "#f87171";
    ctx.fillText("Convex: Always forms", width - 190, 85);
    ctx.fillText("virtual, upright images", width - 190, 100);
  }

  function reset(): void {
    time = 0;
    calculateImageProperties();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const mirrorTypeText = mirrorType ? "concave" : "convex";
    const isReal = imageDistance > 0 && mirrorType;
    const imageType = isReal ? "real" : "virtual";
    const orientation = magnification > 0 ? "upright" : "inverted";
    
    return (
      `Curved Mirror: ${mirrorTypeText} mirror with R=${radiusOfCurvature}mm, f=${(mirrorType ? focalLength : -focalLength).toFixed(1)}mm. ` +
      `Object at do=${objectDistance}mm creates ${imageType} image at di=${imageDistance.toFixed(1)}mm. ` +
      `Magnification=${magnification.toFixed(2)}, image is ${orientation}. ` +
      `Mirror equation 1/f = 1/do + 1/di demonstrates spherical mirror image formation.`
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

export default CurvedMirrorOpticsFactory;