import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Compound Microscope: Two converging lenses (objective + eyepiece).
 * Ray diagram showing image formation with adjustable focal lengths
 * and object distance. Total magnification = M_obj × M_eye.
 */
const MicroscopeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("microscope") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  let fObjective = 20; // mm focal length of objective
  let fEyepiece = 50; // mm focal length of eyepiece
  let objectDistance = 25; // mm from objective
  let tubeLength = 160; // mm distance between lenses

  function thinLensImage(objectDist: number, focalLength: number): { imageDist: number; magnification: number } {
    // 1/v - 1/u = 1/f  (sign convention: u negative for real object)
    // 1/v = 1/f + 1/u  => 1/v = 1/f - 1/|u|
    const v = 1 / (1 / focalLength - 1 / objectDist);
    const mag = -v / objectDist;
    return { imageDist: v, magnification: mag };
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
    },

    update(_dt: number, params: Record<string, number>) {
      fObjective = params.fObjective ?? 20;
      fEyepiece = params.fEyepiece ?? 50;
      objectDistance = params.objectDistance ?? 25;
      tubeLength = params.tubeLength ?? 160;
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Compound Microscope", W / 2, 28);

      const axisY = H * 0.45;
      const scale = Math.min(W * 0.6 / (tubeLength + objectDistance + 100), 2);
      const originX = W * 0.15; // object position

      // Object
      const objX = originX;
      const objH = 40; // object height in pixels

      // Objective lens position
      const objLensX = objX + objectDistance * scale;

      // Eyepiece lens position
      const eyeLensX = objLensX + tubeLength * scale;

      // Compute objective image
      const objResult = thinLensImage(objectDistance, fObjective);
      const imgDist1 = objResult.imageDist;
      const mag1 = objResult.magnification;

      // Image from objective
      const img1X = objLensX + imgDist1 * scale;
      const img1H = objH * Math.abs(mag1);

      // Object distance for eyepiece = distance from img1 to eyepiece
      const objDist2 = (eyeLensX - img1X) / scale;
      let eyeResult = { imageDist: 0, magnification: 1 };
      let totalMag = mag1;
      let img2Exists = false;

      if (objDist2 > 0) {
        eyeResult = thinLensImage(objDist2, fEyepiece);
        totalMag = mag1 * eyeResult.magnification;
        img2Exists = true;
      }

      // Draw optical axis
      ctx.beginPath();
      ctx.moveTo(20, axisY);
      ctx.lineTo(W - 20, axisY);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw object (arrow)
      drawArrow(objX, axisY, objX, axisY - objH, "#22c55e", 3);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#22c55e";
      ctx.textAlign = "center";
      ctx.fillText("Object", objX, axisY + 18);

      // Draw objective lens
      drawLens(objLensX, axisY, H * 0.35, "#3b82f6");
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "center";
      ctx.fillText("Objective", objLensX, axisY + H * 0.2 + 15);
      ctx.fillText(`f = ${fObjective} mm`, objLensX, axisY + H * 0.2 + 28);

      // Focal points of objective
      drawFocalPoint(objLensX - fObjective * scale, axisY, "#3b82f6");
      drawFocalPoint(objLensX + fObjective * scale, axisY, "#3b82f6");

      // Draw eyepiece lens
      drawLens(eyeLensX, axisY, H * 0.3, "#f59e0b");
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "center";
      ctx.fillText("Eyepiece", eyeLensX, axisY + H * 0.17 + 15);
      ctx.fillText(`f = ${fEyepiece} mm`, eyeLensX, axisY + H * 0.17 + 28);

      // Focal points of eyepiece
      drawFocalPoint(eyeLensX - fEyepiece * scale, axisY, "#f59e0b");
      drawFocalPoint(eyeLensX + fEyepiece * scale, axisY, "#f59e0b");

      // Draw rays through objective
      if (imgDist1 > 0) {
        // Real image formed by objective
        const imgY1 = axisY + (mag1 > 0 ? -1 : 1) * Math.min(img1H, H * 0.3);

        // Ray 1: parallel to axis, refracted through focal point
        drawRay(objX, axisY - objH, objLensX, axisY - objH, "rgba(255,100,100,0.4)");
        drawRay(objLensX, axisY - objH, img1X, imgY1, "rgba(255,100,100,0.4)");

        // Ray 2: through center of lens
        drawRay(objX, axisY - objH, img1X, imgY1, "rgba(100,100,255,0.4)");

        // Intermediate image
        if (img1X > objLensX && img1X < eyeLensX) {
          drawArrow(img1X, axisY, img1X, imgY1, "#ef4444", 2);
          ctx.font = "10px system-ui, sans-serif";
          ctx.fillStyle = "#ef4444";
          ctx.textAlign = "center";
          ctx.fillText("Intermediate", img1X, Math.max(imgY1, axisY) + 18);
          ctx.fillText("Image", img1X, Math.max(imgY1, axisY) + 30);
        }

        // Rays through eyepiece
        if (img2Exists && eyeResult.imageDist !== 0) {
          const img2X = eyeLensX + eyeResult.imageDist * scale;
          const img2H = img1H * Math.abs(eyeResult.magnification);
          const imgY2 = axisY + (eyeResult.magnification > 0 ? 1 : -1) * Math.min(img2H, H * 0.35);

          // Rays from intermediate image through eyepiece
          drawRay(img1X, imgY1, eyeLensX, imgY1, "rgba(255,180,50,0.3)");
          if (eyeResult.imageDist < 0) {
            // Virtual image - extend dashed
            drawRay(eyeLensX, imgY1, W - 20, axisY - (imgY1 - axisY) * 2, "rgba(255,180,50,0.2)");
          }
        }
      }

      // Tube body
      ctx.strokeStyle = "rgba(100,116,139,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(objLensX, axisY - H * 0.18);
      ctx.lineTo(eyeLensX, axisY - H * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(objLensX, axisY + H * 0.18);
      ctx.lineTo(eyeLensX, axisY + H * 0.15);
      ctx.stroke();

      // Tube length label
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(objLensX, axisY + H * 0.22);
      ctx.lineTo(eyeLensX, axisY + H * 0.22);
      ctx.strokeStyle = "#64748b";
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(`L = ${tubeLength} mm`, (objLensX + eyeLensX) / 2, axisY + H * 0.22 - 5);

      // Info panel
      const panelY = H - 80;
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`Objective magnification: ${mag1.toFixed(1)}×`, 16, panelY);
      ctx.fillStyle = "#f59e0b";
      if (img2Exists) {
        ctx.fillText(`Eyepiece magnification: ${eyeResult.magnification.toFixed(1)}×`, 16, panelY + 20);
      }
      ctx.fillStyle = "#22c55e";
      ctx.fillText(`Total magnification: ${Math.abs(totalMag).toFixed(1)}×`, 16, panelY + 40);

      ctx.textAlign = "right";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Object distance: ${objectDistance} mm`, W - 16, panelY);
      ctx.fillText(`Image distance (obj): ${imgDist1.toFixed(1)} mm`, W - 16, panelY + 20);
      ctx.fillStyle = "#64748b";
      ctx.fillText(`1/v − 1/u = 1/f  (thin lens equation)`, W - 16, panelY + 40);

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("M_total = M_objective × M_eyepiece = (−v₁/u₁) × (−v₂/u₂)", W / 2, H - 10);
    },

    reset() {},

    destroy() {},

    getStateDescription(): string {
      const objResult = thinLensImage(objectDistance, fObjective);
      const img1X_mm = objResult.imageDist;
      const objDist2 = tubeLength - img1X_mm;
      let totalMag = objResult.magnification;
      if (objDist2 > 0) {
        const eyeResult = thinLensImage(objDist2, fEyepiece);
        totalMag *= eyeResult.magnification;
      }
      return (
        `Compound Microscope: f_obj=${fObjective}mm, f_eye=${fEyepiece}mm, ` +
        `object distance=${objectDistance}mm, tube length=${tubeLength}mm. ` +
        `Objective magnification=${objResult.magnification.toFixed(1)}×. ` +
        `Total magnification=${Math.abs(totalMag).toFixed(1)}×. ` +
        `Uses thin lens equation: 1/v - 1/u = 1/f.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.stroke();
  }

  function drawLens(x: number, y: number, height: number, color: string) {
    ctx.beginPath();
    ctx.moveTo(x, y - height / 2);
    ctx.quadraticCurveTo(x + 12, y, x, y + height / 2);
    ctx.quadraticCurveTo(x - 12, y, x, y - height / 2);
    ctx.fillStyle = color + "20";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrows at tips
    ctx.beginPath();
    ctx.moveTo(x - 6, y - height / 2 + 3);
    ctx.lineTo(x, y - height / 2);
    ctx.lineTo(x + 6, y - height / 2 + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 6, y + height / 2 - 3);
    ctx.lineTo(x, y + height / 2);
    ctx.lineTo(x + 6, y + height / 2 - 3);
    ctx.stroke();
  }

  function drawFocalPoint(x: number, y: number, color: string) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText("F", x, y + 12);
  }

  function drawRay(x1: number, y1: number, x2: number, y2: number, color: string) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  return engine;
};

export default MicroscopeFactory;
