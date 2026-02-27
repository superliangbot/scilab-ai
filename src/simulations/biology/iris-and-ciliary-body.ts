import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const IrisAndCiliaryBodyFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("iris-and-ciliary-body") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let irisConstriction = 50; // 0-100, sphincter muscle
  let ciliaryContraction = 50; // 0-100, ciliary body
  let showLightPath = 1;
  let showMuscleForce = 1;

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },
    update(dt: number, params: Record<string, number>) {
      irisConstriction = params.irisConstriction ?? 50;
      ciliaryContraction = params.ciliaryContraction ?? 50;
      showLightPath = params.showLightPath ?? 1;
      showMuscleForce = params.showMuscleForce ?? 1;
      time += dt;
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Iris and Ciliary Body — Eye Accommodation", width / 2, 22);

      // Eye cross-section
      const eyeCX = width * 0.5;
      const eyeCY = height * 0.45;
      const eyeRX = Math.min(width * 0.38, 200);
      const eyeRY = Math.min(height * 0.3, 150);

      // Eyeball outline (sclera)
      ctx.fillStyle = "#f5f5f5";
      ctx.beginPath();
      ctx.ellipse(eyeCX, eyeCY, eyeRX, eyeRY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#90a4ae";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Retina (inner layer)
      ctx.fillStyle = "#ffccbc";
      ctx.beginPath();
      ctx.ellipse(eyeCX, eyeCY, eyeRX - 5, eyeRY - 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Vitreous humor
      ctx.fillStyle = "rgba(220, 237, 255, 0.4)";
      ctx.beginPath();
      ctx.ellipse(eyeCX, eyeCY, eyeRX - 10, eyeRY - 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil size based on iris constriction
      const pupilMaxR = eyeRY * 0.35;
      const pupilMinR = eyeRY * 0.08;
      const pupilR = pupilMaxR - (irisConstriction / 100) * (pupilMaxR - pupilMinR);

      // Iris position
      const irisX = eyeCX - eyeRX * 0.55;

      // Lens
      const lensX = irisX + 15;
      const lensFlatness = 1 - (ciliaryContraction / 100) * 0.6; // 1 = flat, 0.4 = fat
      const lensRX = 12 + (1 - lensFlatness) * 15;
      const lensRY = pupilMaxR * 0.85;

      // Ciliary body
      const ciliaryY1 = eyeCY - eyeRY * 0.45;
      const ciliaryY2 = eyeCY + eyeRY * 0.45;

      ctx.fillStyle = "#8d6e63";
      // Top ciliary
      ctx.beginPath();
      ctx.ellipse(lensX, ciliaryY1, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bottom ciliary
      ctx.beginPath();
      ctx.ellipse(lensX, ciliaryY2, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Zonule fibers (suspensory ligaments)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      const numFibers = 4;
      for (let i = 0; i < numFibers; i++) {
        const t = (i / (numFibers - 1)) * 0.6 + 0.2;
        // Top fibers
        ctx.beginPath();
        ctx.moveTo(lensX, ciliaryY1 + 5);
        ctx.lineTo(lensX + (t - 0.5) * lensRX * 1.5, eyeCY - lensRY * 0.7);
        ctx.stroke();
        // Bottom fibers
        ctx.beginPath();
        ctx.moveTo(lensX, ciliaryY2 - 5);
        ctx.lineTo(lensX + (t - 0.5) * lensRX * 1.5, eyeCY + lensRY * 0.7);
        ctx.stroke();
      }

      // Lens
      ctx.fillStyle = "rgba(200, 230, 255, 0.6)";
      ctx.strokeStyle = "#64b5f6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(lensX, eyeCY, lensRX, lensRY * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Iris (ring around pupil)
      ctx.fillStyle = "#5d4037";
      ctx.beginPath();
      ctx.ellipse(irisX, eyeCY, 5, eyeRY * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Top iris flap
      ctx.fillStyle = "#6d4c41";
      ctx.beginPath();
      ctx.moveTo(irisX, eyeCY - pupilR);
      ctx.lineTo(irisX - 3, eyeCY - eyeRY * 0.4);
      ctx.lineTo(irisX + 3, eyeCY - eyeRY * 0.4);
      ctx.closePath();
      ctx.fill();

      // Bottom iris flap
      ctx.beginPath();
      ctx.moveTo(irisX, eyeCY + pupilR);
      ctx.lineTo(irisX - 3, eyeCY + eyeRY * 0.4);
      ctx.lineTo(irisX + 3, eyeCY + eyeRY * 0.4);
      ctx.closePath();
      ctx.fill();

      // Pupil
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(irisX, eyeCY, 4, pupilR, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cornea
      ctx.strokeStyle = "#90caf9";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(irisX - 15, eyeCY, 20, eyeRY * 0.5, 0, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();

      // Fovea (on retina, back of eye)
      ctx.fillStyle = "#ff8a65";
      ctx.beginPath();
      ctx.arc(eyeCX + eyeRX - 12, eyeCY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Fovea", eyeCX + eyeRX - 5, eyeCY - 8);

      // Optic nerve
      ctx.strokeStyle = "#ffcc80";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(eyeCX + eyeRX - 5, eyeCY + 12);
      ctx.lineTo(eyeCX + eyeRX + 20, eyeCY + 30);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "9px sans-serif";
      ctx.fillText("Optic nerve", eyeCX + eyeRX + 5, eyeCY + 45);

      // Light rays
      if (showLightPath > 0.5) {
        ctx.strokeStyle = "rgba(255, 235, 59, 0.5)";
        ctx.lineWidth = 1.5;

        const focalLength = 20 + (1 - ciliaryContraction / 100) * 40; // shorter focal for more contraction
        const focalX = lensX + focalLength;
        const focusY = eyeCY;

        // Rays entering through pupil
        const numRays = 5;
        for (let i = 0; i < numRays; i++) {
          const entryY = eyeCY - pupilR + (i / (numRays - 1)) * pupilR * 2;
          const startX = irisX - 60;

          // Ray to lens
          ctx.beginPath();
          ctx.moveTo(startX, entryY);
          ctx.lineTo(lensX, entryY);
          ctx.stroke();

          // Ray from lens to focus
          ctx.beginPath();
          ctx.moveTo(lensX, entryY);
          ctx.lineTo(Math.min(focalX, eyeCX + eyeRX - 15), focusY + (entryY - eyeCY) * (1 - focalLength / (eyeRX * 1.2)));
          ctx.stroke();
        }
      }

      // Muscle force indicators
      if (showMuscleForce > 0.5) {
        // Iris sphincter
        const sphincterForce = irisConstriction / 100;
        ctx.strokeStyle = `rgba(244, 67, 54, ${0.3 + sphincterForce * 0.7})`;
        ctx.lineWidth = 2;
        const irisArrowLen = sphincterForce * 15;
        ctx.beginPath();
        ctx.moveTo(irisX, eyeCY - pupilR - 5);
        ctx.lineTo(irisX, eyeCY - pupilR - 5 - irisArrowLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(irisX, eyeCY + pupilR + 5);
        ctx.lineTo(irisX, eyeCY + pupilR + 5 + irisArrowLen);
        ctx.stroke();

        // Ciliary
        const ciliaryForce = ciliaryContraction / 100;
        ctx.strokeStyle = `rgba(33, 150, 243, ${0.3 + ciliaryForce * 0.7})`;
        ctx.lineWidth = 2;
        const cArrowLen = ciliaryForce * 12;
        ctx.beginPath();
        ctx.moveTo(lensX, ciliaryY1 + 10);
        ctx.lineTo(lensX, ciliaryY1 + 10 + cArrowLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lensX, ciliaryY2 - 10);
        ctx.lineTo(lensX, ciliaryY2 - 10 - cArrowLen);
        ctx.stroke();
      }

      // Labels
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#90caf9";
      ctx.textAlign = "center";
      ctx.fillText("Cornea", irisX - 15, eyeCY - eyeRY * 0.55);
      ctx.fillStyle = "#a1887f";
      ctx.fillText("Iris", irisX, eyeCY + eyeRY * 0.5 + 10);
      ctx.fillStyle = "#64b5f6";
      ctx.fillText("Lens", lensX, eyeCY + lensRY + 15);
      ctx.fillStyle = "#8d6e63";
      ctx.fillText("Ciliary", lensX + 25, ciliaryY1);
      ctx.fillStyle = "#f5f5f5";
      ctx.fillText("Sclera", eyeCX + eyeRX * 0.3, eyeCY - eyeRY - 8);

      // Front view of pupil (small inset)
      const insetX = width * 0.85;
      const insetY = height * 0.2;
      const insetR = 35;

      // Sclera
      ctx.fillStyle = "#f5f5f5";
      ctx.beginPath();
      ctx.ellipse(insetX, insetY, insetR, insetR * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris
      const irisGrad = ctx.createRadialGradient(insetX, insetY, pupilR * 0.6, insetX, insetY, insetR * 0.7);
      irisGrad.addColorStop(0, "#5d4037");
      irisGrad.addColorStop(0.5, "#795548");
      irisGrad.addColorStop(1, "#4e342e");
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(insetX, insetY, insetR * 0.7, insetR * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(insetX, insetY, pupilR * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ccc";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Front view", insetX, insetY + insetR * 0.8 + 12);

      // Info panel
      const infoY = height * 0.78;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.05, infoY, width * 0.9, 65);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Iris sphincter: ${irisConstriction.toFixed(0)}% → pupil ${pupilR < pupilMaxR * 0.5 ? "constricted" : "dilated"} | Ciliary: ${ciliaryContraction.toFixed(0)}% → lens ${ciliaryContraction > 50 ? "thicker (near focus)" : "flatter (far focus)"}`, width / 2, infoY + 18);
      ctx.fillStyle = "#aaa";
      ctx.fillText("Iris controls light intake by adjusting pupil size | Ciliary body changes lens shape for focusing", width / 2, infoY + 38);
      ctx.fillText("Bright light → constricted pupil | Near objects → ciliary contracts, lens thickens", width / 2, infoY + 55);
    },
    reset() {
      time = 0;
    },
    destroy() {},
    getStateDescription(): string {
      const pupilMaxR = 50;
      const pupilMinR = 10;
      const pupilR = pupilMaxR - (irisConstriction / 100) * (pupilMaxR - pupilMinR);
      const lensFocus = ciliaryContraction > 50 ? "near objects (thick lens)" : "distant objects (flat lens)";
      return `Eye accommodation: Iris sphincter at ${irisConstriction}%, pupil radius ~${pupilR.toFixed(0)} (${irisConstriction > 50 ? "constricted" : "dilated"}). Ciliary body at ${ciliaryContraction}%, lens focused on ${lensFocus}. The iris controls light entry; the ciliary body changes lens curvature for focusing at different distances.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default IrisAndCiliaryBodyFactory;
