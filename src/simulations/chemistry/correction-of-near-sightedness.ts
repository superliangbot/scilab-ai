import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const CorrectionOfNearSightednessFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("correction-of-near-sightedness") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters (cached from params)
  let objectDistance = 20; // metres
  let eyePower = 65; // diopters (too strong for this eye)
  let lensCorrection = -3; // diopters (diverging lens)

  // Eye geometry constants (in canvas-relative units, set on init/resize)
  const EYE_ASPECT = 1.25; // width/height ratio for the eyeball oval

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    objectDistance = params.objectDistance ?? 20;
    eyePower = params.eyePower ?? 65;
    lensCorrection = params.lensCorrection ?? -3;
    time += dt;
  }

  // ---- Drawing helpers ----
  // Optics: Normal eye ~60 D focuses distant light on retina.
  // Myopic eye (eyePower > 60 D) has too-short focal length: f = 1/P.
  // A diverging lens (negative D) reduces total power so the combined
  // system focuses exactly on the retina.

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0b0e1a");
    grad.addColorStop(0.5, "#0f1528");
    grad.addColorStop(1, "#111830");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  /** Draw a cross-section of the human eye. Returns key geometry for ray tracing. */
  function drawEye(): {
    eyeCx: number; eyeCy: number;
    eyeRx: number; eyeRy: number;
    lensCx: number; lensCy: number;
    retinaX: number;
    pupilHalf: number;
  } {
    const eyeRy = height * 0.22;
    const eyeRx = eyeRy * EYE_ASPECT;
    const eyeCx = width * 0.6;
    const eyeCy = height * 0.48;

    // Sclera (white outer shell)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(eyeCx, eyeCy, eyeRx, eyeRy, 0, 0, Math.PI * 2);
    const scleraGrad = ctx.createRadialGradient(eyeCx, eyeCy, eyeRx * 0.3, eyeCx, eyeCy, eyeRx);
    scleraGrad.addColorStop(0, "rgba(240, 235, 225, 0.15)");
    scleraGrad.addColorStop(0.7, "rgba(220, 210, 195, 0.10)");
    scleraGrad.addColorStop(1, "rgba(180, 170, 155, 0.08)");
    ctx.fillStyle = scleraGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 195, 180, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Crystalline lens (biconvex) inside the eye
    const lensCx = eyeCx - eyeRx * 0.55;
    const lensCy = eyeCy;
    const lensHalf = eyeRy * 0.55;
    const lensBulge = eyeRx * 0.08;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lensCx, lensCy - lensHalf);
    ctx.quadraticCurveTo(lensCx - lensBulge, lensCy, lensCx, lensCy + lensHalf);
    ctx.quadraticCurveTo(lensCx + lensBulge, lensCy, lensCx, lensCy - lensHalf);
    ctx.closePath();
    const lensGrad = ctx.createLinearGradient(lensCx - lensBulge, lensCy, lensCx + lensBulge, lensCy);
    lensGrad.addColorStop(0, "rgba(130, 200, 255, 0.12)");
    lensGrad.addColorStop(0.5, "rgba(170, 220, 255, 0.22)");
    lensGrad.addColorStop(1, "rgba(130, 200, 255, 0.12)");
    ctx.fillStyle = lensGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 210, 255, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Pupil opening (drawn as a gap in the iris)
    const pupilHalf = eyeRy * 0.28;
    const irisX = lensCx - eyeRx * 0.06;

    // Iris above and below the pupil
    ctx.save();
    ctx.strokeStyle = "rgba(80, 140, 90, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(irisX, eyeCy - eyeRy * 0.75);
    ctx.lineTo(irisX, eyeCy - pupilHalf);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(irisX, eyeCy + pupilHalf);
    ctx.lineTo(irisX, eyeCy + eyeRy * 0.75);
    ctx.stroke();
    ctx.restore();

    // Retina (back inner wall) - highlighted arc
    const retinaX = eyeCx + eyeRx * 0.82;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 180, 120, 0.7)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(eyeCx + eyeRx * 0.15, eyeCy, eyeRy * 0.88, -0.55, 0.55);
    ctx.stroke();
    ctx.restore();

    // Label retina
    ctx.save();
    ctx.fillStyle = "rgba(255, 180, 120, 0.85)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Retina", retinaX + 4, eyeCy - eyeRy * 0.15);
    ctx.restore();

    // Label lens
    ctx.save();
    ctx.fillStyle = "rgba(150, 210, 255, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Lens", lensCx, eyeCy + lensHalf + 14);
    ctx.restore();

    return { eyeCx, eyeCy, eyeRx, eyeRy, lensCx, lensCy, retinaX, pupilHalf };
  }

  /** Draw the corrective diverging lens in front of the eye. */
  function drawCorrectiveLens(eyeGeom: {
    lensCx: number; lensCy: number; eyeRy: number; eyeRx: number;
  }): { clX: number } {
    const clX = eyeGeom.lensCx - eyeGeom.eyeRx * 0.35;
    const clHalf = eyeGeom.eyeRy * 0.7;
    const bulge = eyeGeom.eyeRx * 0.06;

    ctx.save();
    // Concave (diverging) lens: thinner in middle, wider at edges
    ctx.beginPath();
    ctx.moveTo(clX - bulge, eyeGeom.lensCy - clHalf);
    ctx.quadraticCurveTo(clX + bulge * 0.5, eyeGeom.lensCy, clX - bulge, eyeGeom.lensCy + clHalf);
    ctx.lineTo(clX + bulge, eyeGeom.lensCy + clHalf);
    ctx.quadraticCurveTo(clX - bulge * 0.5, eyeGeom.lensCy, clX + bulge, eyeGeom.lensCy - clHalf);
    ctx.closePath();

    const clGrad = ctx.createLinearGradient(clX - bulge, eyeGeom.lensCy, clX + bulge, eyeGeom.lensCy);
    clGrad.addColorStop(0, "rgba(100, 160, 255, 0.18)");
    clGrad.addColorStop(0.5, "rgba(140, 200, 255, 0.28)");
    clGrad.addColorStop(1, "rgba(100, 160, 255, 0.18)");
    ctx.fillStyle = clGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 180, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(120, 180, 255, 0.85)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Corrective", clX, eyeGeom.lensCy + clHalf + 14);
    ctx.fillText(`(${lensCorrection} D)`, clX, eyeGeom.lensCy + clHalf + 26);
    ctx.restore();

    return { clX };
  }

  /** Draw parallel light rays coming from a distant object. */
  function drawRays(eyeGeom: {
    eyeCx: number; eyeCy: number;
    eyeRx: number; eyeRy: number;
    lensCx: number; lensCy: number;
    retinaX: number; pupilHalf: number;
  }, clX: number): void {
    const { eyeCx, eyeCy, eyeRx, eyeRy, lensCx, lensCy, retinaX, pupilHalf } = eyeGeom;

    // For a distant object, incoming rays are approximately parallel.
    // Normal eye focal length ~ 1/60 D ~ 0.0167 m ~ 16.7 mm
    // Myopic eye has shorter focal length -> focus in front of retina.

    const normalPower = 60; // diopters, ideal
    const eyeDepth = eyeRx * 1.6; // approximate axial length in px (represents ~24 mm)

    // Where the uncorrected eye focuses (fraction of eye depth from lens)
    // focalPx = eyeDepth * (normalPower / eyePower)
    const uncorrectedFocalFrac = normalPower / eyePower;
    const uncorrectedFocalPx = eyeDepth * uncorrectedFocalFrac;

    // Retina is at full eye depth from the crystalline lens
    const retinaDist = retinaX - lensCx;

    // Combined power with corrective lens
    const combinedPower = eyePower + lensCorrection;
    const correctedFocalFrac = normalPower / combinedPower;
    const correctedFocalPx = eyeDepth * correctedFocalFrac;

    const numRays = 5;
    const raySpacing = pupilHalf * 0.85;

    ctx.save();
    ctx.lineWidth = 1.8;

    for (let i = -Math.floor(numRays / 2); i <= Math.floor(numRays / 2); i++) {
      const yOffset = i * (raySpacing / Math.floor(numRays / 2 + 0.01));
      const rayY = eyeCy + yOffset;

      // --- Uncorrected rays (red) ---
      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
      ctx.setLineDash([]);

      // Incoming ray from left to the eye lens
      ctx.beginPath();
      ctx.moveTo(20, rayY);
      ctx.lineTo(lensCx, rayY);
      ctx.stroke();

      // After refraction: converge to focal point IN FRONT of retina
      const uncorrFocusX = lensCx + uncorrectedFocalPx;
      ctx.beginPath();
      ctx.moveTo(lensCx, rayY);
      ctx.lineTo(uncorrFocusX, eyeCy);
      ctx.stroke();

      // Past the focal point the rays diverge -- show them hitting the retina
      // as a blurred spot (the rays spread out after the focus)
      if (uncorrFocusX < retinaX) {
        const remainDist = retinaX - uncorrFocusX;
        const divergeSlope = (eyeCy - rayY) / (uncorrFocusX - lensCx);
        const finalY = eyeCy - divergeSlope * remainDist;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
        ctx.beginPath();
        ctx.moveTo(uncorrFocusX, eyeCy);
        ctx.lineTo(retinaX, finalY);
        ctx.stroke();
      }

      // --- Corrected rays (green) ---
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(34, 197, 94, 0.75)";

      // Incoming ray from left to the corrective lens
      ctx.beginPath();
      ctx.moveTo(20, rayY + 1);
      ctx.lineTo(clX, rayY + 1);
      ctx.stroke();

      // After diverging lens: rays are slightly diverged before entering the eye lens
      // The diverging lens bends each ray outward proportionally
      const divergeAngle = -yOffset * (-lensCorrection) * 0.0004;
      const yAtEyeLens = rayY + 1 + divergeAngle * (lensCx - clX);

      ctx.beginPath();
      ctx.moveTo(clX, rayY + 1);
      ctx.lineTo(lensCx, yAtEyeLens);
      ctx.stroke();

      // After the eye lens: converge to the retina (corrected focus)
      const corrFocusX = lensCx + correctedFocalPx;
      // Clamp the focus near the retina for visual clarity
      const targetX = Math.min(corrFocusX, retinaX);
      ctx.beginPath();
      ctx.moveTo(lensCx, yAtEyeLens);
      ctx.lineTo(targetX, eyeCy);
      ctx.stroke();
    }

    // Draw focal point indicators
    // Uncorrected focal point (red dot)
    const uncorrFX = lensCx + uncorrectedFocalPx;
    if (uncorrFX < retinaX + 20) {
      ctx.beginPath();
      ctx.arc(uncorrFX, eyeCy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.fill();
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Focus (uncorrected)", uncorrFX, eyeCy - 10);
    }

    // Corrected focal point (green dot)
    const corrFX = lensCx + correctedFocalPx;
    const corrTargetX = Math.min(corrFX, retinaX);
    ctx.beginPath();
    ctx.arc(corrTargetX, eyeCy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
    ctx.fill();

    ctx.restore();
  }

  /** Distant object indicator on the far left. */
  function drawDistantObject(): void {
    ctx.save();
    const objX = 30;
    const objY = height * 0.48;
    const arrowH = height * 0.12;

    // Arrow representing the distant object
    ctx.strokeStyle = "rgba(255, 220, 100, 0.8)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(objX, objY + arrowH / 2);
    ctx.lineTo(objX, objY - arrowH / 2);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = "rgba(255, 220, 100, 0.8)";
    ctx.beginPath();
    ctx.moveTo(objX, objY - arrowH / 2);
    ctx.lineTo(objX - 6, objY - arrowH / 2 + 12);
    ctx.lineTo(objX + 6, objY - arrowH / 2 + 12);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255, 220, 100, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Distant", objX, objY + arrowH / 2 + 16);
    ctx.fillText(`Object`, objX, objY + arrowH / 2 + 28);
    ctx.fillText(`(${objectDistance} m)`, objX, objY + arrowH / 2 + 40);
    ctx.restore();
  }

  /** Info panel with physics data. */
  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 260;
    const panelH = 150;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Correction of Near-Sightedness", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

    const normalF = (1000 / 60).toFixed(1);
    const myopicF = (1000 / eyePower).toFixed(1);
    const combinedP = eyePower + lensCorrection;
    const correctedF = (1000 / combinedP).toFixed(1);

    ctx.fillText(`Normal eye power: 60 D (f = ${normalF} mm)`, panelX + 10, panelY + 40);

    ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
    ctx.fillText(`Myopic eye: ${eyePower} D (f = ${myopicF} mm)`, panelX + 10, panelY + 58);

    ctx.fillStyle = "rgba(120, 180, 255, 0.9)";
    ctx.fillText(`Corrective lens: ${lensCorrection} D`, panelX + 10, panelY + 76);

    ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
    ctx.fillText(`Combined: ${combinedP.toFixed(1)} D (f = ${correctedF} mm)`, panelX + 10, panelY + 94);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`Object distance: ${objectDistance} m`, panelX + 10, panelY + 114);

    const perfect = Math.abs(combinedP - 60) < 0.5;
    ctx.fillStyle = perfect ? "rgba(34, 197, 94, 0.9)" : "rgba(251, 191, 36, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(
      perfect ? "Focus on retina - clear vision" : "Adjust lens to reach ~60 D combined",
      panelX + 10, panelY + 138
    );

    ctx.restore();
  }

  /** Legend for ray colours. */
  function drawLegend(): void {
    ctx.save();
    const lx = width - 200;
    const ly = height - 60;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, 190, 50, 6);
    ctx.fill();

    // Red = uncorrected
    ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx + 10, ly + 17);
    ctx.lineTo(lx + 35, ly + 17);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Uncorrected (blurred)", lx + 40, ly + 21);

    // Green = corrected
    ctx.strokeStyle = "rgba(34, 197, 94, 0.9)";
    ctx.beginPath();
    ctx.moveTo(lx + 10, ly + 37);
    ctx.lineTo(lx + 35, ly + 37);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText("Corrected (sharp)", lx + 40, ly + 41);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawDistantObject();
    const eyeGeom = drawEye();
    const { clX } = drawCorrectiveLens(eyeGeom);
    drawRays(eyeGeom, clX);
    drawInfoPanel();
    drawLegend();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // No persistent resources
  }

  function getStateDescription(): string {
    const combinedP = eyePower + lensCorrection;
    const myopicF = (1000 / eyePower).toFixed(1);
    const correctedF = (1000 / combinedP).toFixed(1);
    const perfect = Math.abs(combinedP - 60) < 0.5;
    return (
      `Correction of Near-Sightedness: Myopic eye power=${eyePower} D ` +
      `(f=${myopicF} mm, too short). Corrective diverging lens=${lensCorrection} D. ` +
      `Combined power=${combinedP.toFixed(1)} D (f=${correctedF} mm). ` +
      `Object at ${objectDistance} m. ` +
      `${perfect ? "Focus is on the retina - vision is corrected." : "Focus is not on the retina - vision still blurred."} ` +
      `A normal eye has ~60 D total power. Time: ${time.toFixed(1)}s.`
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

export default CorrectionOfNearSightednessFactory;
