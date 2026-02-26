import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RefractingTelescopeFactory = (): SimulationEngine => {
  const config = getSimConfig("refracting-telescope") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    time += dt;
  }

  function drawLens(cx: number, cy: number, lensH: number, color: string, label: string): void {
    const halfH = lensH / 2;

    // Lens body: vertical line with convex arrows at top and bottom
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfH);
    ctx.lineTo(cx, cy + halfH);
    ctx.stroke();

    // Top arrow (outward pointing)
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - halfH + 10);
    ctx.lineTo(cx, cy - halfH);
    ctx.lineTo(cx + 8, cy - halfH + 10);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bottom arrow (outward pointing)
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + halfH - 10);
    ctx.lineTo(cx, cy + halfH);
    ctx.lineTo(cx + 8, cy + halfH - 10);
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(11, width * 0.014)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy - halfH - 10);
  }

  function drawFocalPoint(x: number, y: number, label: string): void {
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f87171";
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, x, y + 16);
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const objFL = currentParams.objectiveFL ?? 200;    // mm
    const eyeFL = currentParams.eyepieceFL ?? 25;      // mm
    const objDist = currentParams.objectDistance ?? 5000; // mm
    const spacing = currentParams.lensSpacing ?? 250;    // mm

    // Scaling: map mm to screen pixels
    // The total optical system spans: some space for object + spacing + some space for eye
    const totalOpticalLen = spacing + 200; // padding
    const scaleX = (width * 0.7) / totalOpticalLen;
    const opticalAxis = height * 0.48;
    const leftMargin = width * 0.12;

    // Positions on screen
    const objLensX = leftMargin;
    const eyeLensX = leftMargin + spacing * scaleX;
    const lensH = height * 0.45;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Keplerian Refracting Telescope", width / 2, 26);

    // Optical axis
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, opticalAxis);
    ctx.lineTo(width, opticalAxis);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#475569";
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Optical Axis", 5, opticalAxis - 6);

    // Draw objective lens
    drawLens(objLensX, opticalAxis, lensH, "#3b82f6", `Objective (f=${objFL} mm)`);

    // Draw eyepiece lens
    drawLens(eyeLensX, opticalAxis, lensH * 0.6, "#10b981", `Eyepiece (f=${eyeFL} mm)`);

    // Focal points
    const objFocalRight = objLensX + objFL * scaleX;
    const eyeFocalLeft = eyeLensX - eyeFL * scaleX;

    // Clamp focal points to visible area for display
    if (objFocalRight > 0 && objFocalRight < width) {
      drawFocalPoint(objFocalRight, opticalAxis, "F_obj");
    }
    if (eyeFocalLeft > 0 && eyeFocalLeft < width) {
      drawFocalPoint(eyeFocalLeft, opticalAxis, "F_eye");
    }

    // Ray tracing: parallel rays from distant object entering objective
    // For a distant object, rays come in roughly parallel
    const numRays = 5;
    const raySpread = lensH * 0.35;
    const rayColors = ["#f87171", "#fb923c", "#facc15", "#a3e635", "#60a5fa"];

    for (let i = 0; i < numRays; i++) {
      const yOffset = ((i - (numRays - 1) / 2) / ((numRays - 1) / 2)) * raySpread;
      const entryY = opticalAxis + yOffset;

      ctx.strokeStyle = rayColors[i];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.8;

      // Segment 1: incoming parallel ray to objective lens
      ctx.beginPath();
      ctx.moveTo(0, entryY);
      ctx.lineTo(objLensX, entryY);
      ctx.stroke();

      // After objective: ray converges to focal point
      // Using thin lens equation: 1/v = 1/f - 1/u
      // For distant object (u -> infinity), image forms at f_obj
      const imageDistObj = objFL; // Image distance from objective in mm
      const focalImageX = objLensX + imageDistObj * scaleX;

      // The ray from height yOffset converges to focal point on axis
      // (for parallel incoming rays, they all converge to the focal point)
      const focalY = opticalAxis;

      // Segment 2: from objective to focal/intermediate image
      ctx.beginPath();
      ctx.moveTo(objLensX, entryY);
      if (focalImageX <= eyeLensX) {
        ctx.lineTo(focalImageX, focalY);
        ctx.stroke();

        // Segment 3: from focal point to eyepiece
        // Ray diverges from focal point to eyepiece
        const dx = eyeLensX - focalImageX;
        const eyeEntryY = focalY + (focalY - entryY) * (dx / (focalImageX - objLensX + 0.001));

        ctx.beginPath();
        ctx.moveTo(focalImageX, focalY);
        ctx.lineTo(eyeLensX, eyeEntryY);
        ctx.stroke();

        // Segment 4: from eyepiece outward (parallel if image at focal of eyepiece)
        // After eyepiece, rays become parallel if intermediate image is at eyepiece focal point
        // Using thin lens for eyepiece:
        const imgToEye = spacing - imageDistObj; // object distance for eyepiece in mm
        let exitAngle: number;
        if (Math.abs(imgToEye - eyeFL) < 1) {
          // Afocal system: exit rays are parallel
          exitAngle = (eyeEntryY - opticalAxis) / (eyeFL * scaleX);
        } else {
          exitAngle = (eyeEntryY - opticalAxis) / (eyeFL * scaleX) * 0.8;
        }

        const exitLen = width - eyeLensX;
        const exitEndY = eyeEntryY - exitAngle * exitLen * 0.5;

        ctx.beginPath();
        ctx.moveTo(eyeLensX, eyeEntryY);
        ctx.lineTo(width, exitEndY);
        ctx.stroke();
      } else {
        // Focal point is beyond eyepiece
        ctx.lineTo(eyeLensX, entryY + (focalY - entryY) * ((eyeLensX - objLensX) / (focalImageX - objLensX)));
        ctx.stroke();
      }

      ctx.globalAlpha = 1.0;
    }

    // Magnification info
    const magnification = objFL / eyeFL;
    const infoY = height * 0.82;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(width * 0.15, infoY - 5, width * 0.7, height * 0.16);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(width * 0.15, infoY - 5, width * 0.7, height * 0.16);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(13, width * 0.018)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`Angular Magnification: M = f_obj / f_eye = ${objFL} / ${eyeFL} = ${magnification.toFixed(1)}x`, width / 2, infoY + 16);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.fillText(
      `Objective FL: ${objFL} mm | Eyepiece FL: ${eyeFL} mm | Lens Spacing: ${spacing} mm`,
      width / 2, infoY + 36
    );

    // Ideal spacing note
    const idealSpacing = objFL + eyeFL;
    const spacingDiff = spacing - idealSpacing;
    let focusNote: string;
    if (Math.abs(spacingDiff) < 5) {
      focusNote = "In focus (spacing = f_obj + f_eye)";
      ctx.fillStyle = "#22c55e";
    } else if (spacingDiff > 0) {
      focusNote = `Spacing ${spacingDiff.toFixed(0)} mm too wide (ideal: ${idealSpacing.toFixed(0)} mm)`;
      ctx.fillStyle = "#f59e0b";
    } else {
      focusNote = `Spacing ${Math.abs(spacingDiff).toFixed(0)} mm too narrow (ideal: ${idealSpacing.toFixed(0)} mm)`;
      ctx.fillStyle = "#f59e0b";
    }
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.fillText(focusNote, width / 2, infoY + 54);

    // Distant object indicator (left edge)
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Distant Object", 5, opticalAxis - lensH * 0.35 - 5);
    ctx.fillText(`(${(objDist / 1000).toFixed(1)} m away)`, 5, opticalAxis - lensH * 0.35 + 10);

    // Eye indicator (right edge)
    const eyeX = width - 30;
    const eyeY = opticalAxis;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 12, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Eye", eyeX, eyeY - 15);

    // Legend
    ctx.fillStyle = "#3b82f6";
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
    ctx.textAlign = "left";
    const legY = 50;
    ctx.fillText("Objective Lens", 10, legY);
    ctx.fillStyle = "#10b981";
    ctx.fillText("Eyepiece Lens", 10, legY + 15);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("Focal Points", 10, legY + 30);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const objFL = currentParams.objectiveFL ?? 200;
    const eyeFL = currentParams.eyepieceFL ?? 25;
    const objDist = currentParams.objectDistance ?? 5000;
    const spacing = currentParams.lensSpacing ?? 250;
    const magnification = objFL / eyeFL;
    const idealSpacing = objFL + eyeFL;

    return (
      `Keplerian refracting telescope simulation. The telescope uses two convex lenses: ` +
      `an objective lens (focal length ${objFL} mm) that gathers light from a distant object ` +
      `(${(objDist / 1000).toFixed(1)} m away) and forms a real intermediate image at its focal point, ` +
      `and an eyepiece lens (focal length ${eyeFL} mm) that magnifies this intermediate image for the observer. ` +
      `Angular magnification M = f_objective / f_eyepiece = ${magnification.toFixed(1)}x. ` +
      `Current lens spacing: ${spacing} mm (ideal for focus: ${idealSpacing} mm). ` +
      `${Math.abs(spacing - idealSpacing) < 5
        ? "The telescope is in focus -- the intermediate image falls at the focal point of the eyepiece, producing parallel exit rays for comfortable viewing."
        : "The telescope is out of focus -- adjust lens spacing to f_obj + f_eye for sharp viewing."} ` +
      `The Keplerian design produces an inverted image but offers a wider field of view than the Galilean design.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RefractingTelescopeFactory;
