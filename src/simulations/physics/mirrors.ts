import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Mirrors: Demonstrates image formation by plane, concave, and convex mirrors.
 * Shows ray diagrams, focal points, and real/virtual image formation.
 * Mirror equation: 1/f = 1/v + 1/u
 */
const MirrorsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("mirrors") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  let mirrorType = 0; // 0=plane, 1=concave, 2=convex
  let focalLength = 100; // px
  let objectDistance = 200; // px from mirror
  let objectHeight = 60; // px

  function mirrorImage(): { imageDist: number; imageHeight: number; isVirtual: boolean } {
    if (mirrorType === 0) {
      // Plane mirror: image same distance behind
      return { imageDist: -objectDistance, imageHeight: objectHeight, isVirtual: true };
    }

    // 1/f = 1/v + 1/u, where u = -objectDistance (real object), f = +f (concave) or -f (convex)
    const f = mirrorType === 1 ? focalLength : -focalLength;
    const u = -objectDistance;
    // 1/v = 1/f - 1/u
    const vInv = 1 / f - 1 / u;
    if (Math.abs(vInv) < 1e-10) {
      return { imageDist: Infinity, imageHeight: Infinity, isVirtual: false };
    }
    const v = 1 / vInv;
    const mag = -v / u;
    const imgH = objectHeight * mag;

    return {
      imageDist: v,
      imageHeight: imgH,
      isVirtual: v < 0,
    };
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
      mirrorType = Math.round(params.mirrorType ?? 0);
      focalLength = Math.max(1, params.focalLength ?? 100);
      objectDistance = Math.max(1, params.objectDistance ?? 200);
      objectHeight = params.objectHeight ?? 60;
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      const mirrorNames = ["Plane Mirror", "Concave Mirror", "Convex Mirror"];
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(`Mirrors — ${mirrorNames[mirrorType]}`, W / 2, 28);

      const axisY = H * 0.45;
      const mirrorX = W * 0.55; // mirror position

      // Draw principal axis
      ctx.beginPath();
      ctx.moveTo(20, axisY);
      ctx.lineTo(W - 20, axisY);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw mirror
      if (mirrorType === 0) {
        // Plane mirror - vertical line
        ctx.beginPath();
        ctx.moveTo(mirrorX, axisY - 120);
        ctx.lineTo(mirrorX, axisY + 120);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Hatching behind mirror
        for (let y = axisY - 115; y < axisY + 115; y += 10) {
          ctx.beginPath();
          ctx.moveTo(mirrorX + 2, y);
          ctx.lineTo(mirrorX + 12, y + 10);
          ctx.strokeStyle = "rgba(148,163,184,0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        // Curved mirror
        const R = focalLength * 2;
        const curveSign = mirrorType === 1 ? 1 : -1;
        const centerOfCurvatureX = mirrorX + curveSign * R;

        ctx.beginPath();
        const mirrorH = 140;
        for (let dy = -mirrorH; dy <= mirrorH; dy += 2) {
          const dx = curveSign * (R - Math.sqrt(Math.max(0, R * R - dy * dy)));
          const mx = mirrorX + dx;
          if (dy === -mirrorH) ctx.moveTo(mx, axisY + dy);
          else ctx.lineTo(mx, axisY + dy);
        }
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Center of curvature
        ctx.beginPath();
        ctx.arc(centerOfCurvatureX, axisY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#f59e0b";
        ctx.textAlign = "center";
        ctx.fillText("C", centerOfCurvatureX, axisY + 16);

        // Focal point
        const focalX = mirrorX + curveSign * focalLength;
        ctx.beginPath();
        ctx.arc(focalX, axisY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#22c55e";
        ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.fillText("F", focalX, axisY + 16);
      }

      // Object (arrow in front of mirror)
      const objX = mirrorX - objectDistance;
      drawArrow(objX, axisY, objX, axisY - objectHeight, "#3b82f6", 3);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "center";
      ctx.fillText("Object", objX, axisY + 18);

      // Compute image
      const img = mirrorImage();

      if (isFinite(img.imageDist) && isFinite(img.imageHeight)) {
        const imgX = mirrorX + img.imageDist;
        const imgH = img.imageHeight;

        // Draw image
        if (img.isVirtual) {
          // Virtual image - dashed
          ctx.setLineDash([4, 4]);
          drawArrow(imgX, axisY, imgX, axisY - imgH, "#ef4444", 2);
          ctx.setLineDash([]);
        } else {
          // Real image - solid
          drawArrow(imgX, axisY, imgX, axisY - imgH, "#ef4444", 3);
        }

        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "center";
        ctx.fillText(img.isVirtual ? "Virtual Image" : "Real Image", imgX, Math.max(axisY - Math.abs(imgH), 10) - 8);

        // Draw rays (for curved mirrors)
        if (mirrorType !== 0) {
          const objTopY = axisY - objectHeight;
          const imgTopY = axisY - imgH;
          const f = mirrorType === 1 ? focalLength : -focalLength;
          const focalX = mirrorX + (mirrorType === 1 ? 1 : -1) * focalLength;

          // Ray 1: Parallel to axis → through focal point
          ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(objX, objTopY);
          ctx.lineTo(mirrorX, objTopY);
          ctx.stroke();

          if (mirrorType === 1) {
            // Reflects through focal point
            ctx.beginPath();
            ctx.moveTo(mirrorX, objTopY);
            ctx.lineTo(imgX, imgTopY);
            ctx.stroke();
          } else {
            // Convex: reflects as if from focal point
            ctx.beginPath();
            ctx.moveTo(mirrorX, objTopY);
            const dx = mirrorX - focalX;
            const dy = objTopY - axisY;
            const extX = mirrorX - dx * 3;
            const extY = objTopY - dy * 3;
            ctx.lineTo(extX, extY);
            ctx.stroke();

            // Virtual ray extension (dashed)
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(mirrorX, objTopY);
            ctx.lineTo(focalX, axisY);
            ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Ray 2: Through center → reflects back on same path
          ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(objX, objTopY);
          ctx.lineTo(mirrorX, axisY - objectHeight * (mirrorX - objX) / objectDistance);
          ctx.stroke();

          if (!img.isVirtual) {
            ctx.beginPath();
            ctx.moveTo(mirrorX, axisY - objectHeight * (mirrorX - objX) / objectDistance);
            ctx.lineTo(imgX, imgTopY);
            ctx.stroke();
          }
        }

        // Info panel
        const panelY = H - 90;
        ctx.font = "13px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "left";

        const mag = img.imageHeight / objectHeight;
        ctx.fillStyle = "#3b82f6";
        ctx.fillText(`Object distance (u): ${objectDistance.toFixed(0)} px`, 16, panelY);
        ctx.fillStyle = "#ef4444";
        ctx.fillText(`Image distance (v): ${img.imageDist.toFixed(1)} px`, 16, panelY + 20);
        ctx.fillStyle = "#22c55e";
        ctx.fillText(`Magnification: ${mag.toFixed(2)}×`, 16, panelY + 40);

        ctx.textAlign = "right";
        ctx.fillStyle = "#f59e0b";
        ctx.fillText(`Focal length (f): ${mirrorType === 0 ? "∞" : `${focalLength} px`}`, W - 16, panelY);
        ctx.fillStyle = "#c084fc";
        ctx.fillText(`Image: ${img.isVirtual ? "Virtual, Upright" : "Real, Inverted"}`, W - 16, panelY + 20);
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Image height: ${Math.abs(img.imageHeight).toFixed(1)} px`, W - 16, panelY + 40);
      }

      // Formula
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("Mirror equation: 1/f = 1/v + 1/u  |  Magnification m = -v/u = h'/h", W / 2, H - 10);
    },

    reset() {},

    destroy() {},

    getStateDescription(): string {
      const mirrorNames = ["Plane", "Concave", "Convex"];
      const img = mirrorImage();
      const mag = isFinite(img.imageHeight) ? img.imageHeight / objectHeight : 0;
      return (
        `Mirrors: ${mirrorNames[mirrorType]} mirror, f=${mirrorType === 0 ? "∞" : focalLength}px, ` +
        `object distance u=${objectDistance}px, object height=${objectHeight}px. ` +
        `Image: ${img.isVirtual ? "virtual" : "real"}, v=${isFinite(img.imageDist) ? img.imageDist.toFixed(1) : "∞"}px, ` +
        `magnification=${isFinite(mag) ? mag.toFixed(2) : "∞"}×. ` +
        `Mirror equation: 1/f = 1/v + 1/u.`
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

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 10;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  return engine;
};

export default MirrorsFactory;
