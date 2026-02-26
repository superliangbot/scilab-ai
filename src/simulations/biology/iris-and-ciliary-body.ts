import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const IrisCiliaryBodyFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("iris-and-ciliary-body") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let pupilSize = 50; // 0=constricted, 100=dilated
  let ciliaryContraction = 50; // 0=relaxed(thin lens), 100=contracted(thick lens)
  let showLightRays = 1;
  let brightness = 50; // ambient light

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },
    update(dt: number, params: Record<string, number>) {
      pupilSize = params.pupilSize ?? 50;
      ciliaryContraction = params.ciliaryContraction ?? 50;
      showLightRays = params.showLightRays ?? 1;
      brightness = params.brightness ?? 50;
      time += dt;
    },
    render() {
      // Background
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#1e293b";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Iris & Ciliary Body — Eye Accommodation", width / 2, 25);

      const eyeCx = width * 0.5;
      const eyeCy = height * 0.48;
      const eyeRadiusX = Math.min(width * 0.35, height * 0.3);
      const eyeRadiusY = eyeRadiusX * 0.7;

      drawEyeCrossSection(eyeCx, eyeCy, eyeRadiusX, eyeRadiusY);
      drawLabels(eyeCx, eyeCy, eyeRadiusX, eyeRadiusY);
      drawInfoPanel();
    },
    reset() {
      time = 0;
    },
    destroy() {},
    getStateDescription(): string {
      const pupilDesc = pupilSize > 70 ? "dilated" : pupilSize < 30 ? "constricted" : "moderate";
      const lensDesc = ciliaryContraction > 70 ? "thick (near focus)" : ciliaryContraction < 30 ? "thin (far focus)" : "moderate";
      return `Eye anatomy: Pupil is ${pupilDesc} (${pupilSize.toFixed(0)}%). ` +
        `Ciliary body contraction: ${ciliaryContraction.toFixed(0)}%, lens is ${lensDesc}. ` +
        `When ciliary muscles contract, zonular fibers relax and the elastic lens becomes thicker for near vision. ` +
        `The iris sphincter muscle constricts the pupil in bright light; the dilator muscle enlarges it in dim light.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawEyeCrossSection(cx: number, cy: number, rx: number, ry: number) {
    // Sclera (white outer layer)
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Choroid (thin dark layer inside)
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.95, ry * 0.95, 0, 0.3, Math.PI * 2 - 0.3);
    ctx.stroke();

    // Retina (inner lining)
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.9, ry * 0.9, 0, 0.4, Math.PI * 2 - 0.4);
    ctx.stroke();

    // Vitreous humor (fill inside)
    ctx.fillStyle = "rgba(186, 230, 253, 0.15)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cornea (front bulge)
    const corneaX = cx - rx;
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(corneaX + rx * 0.08, cy, rx * 0.15, ry * 0.5, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Iris
    const irisX = cx - rx * 0.7;
    const pupilRadius = ry * (0.08 + (pupilSize / 100) * 0.25); // 8% to 33% of ry
    const irisOuterR = ry * 0.42;

    // Iris body (colored ring)
    ctx.fillStyle = "#4f7b58"; // greenish iris
    ctx.beginPath();
    ctx.arc(irisX, cy, irisOuterR, 0, Math.PI * 2);
    ctx.fill();

    // Pupil (black hole)
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(irisX, cy, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Iris sphincter muscle (ring around pupil)
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(irisX, cy, pupilRadius + 3, 0, Math.PI * 2);
    ctx.stroke();

    // Iris dilator muscle (radial lines)
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath();
      ctx.moveTo(irisX + (pupilRadius + 5) * Math.cos(a), cy + (pupilRadius + 5) * Math.sin(a));
      ctx.lineTo(irisX + (irisOuterR - 3) * Math.cos(a), cy + (irisOuterR - 3) * Math.sin(a));
      ctx.stroke();
    }

    // Lens
    const lensX = irisX + 20;
    const lensThickness = 8 + (ciliaryContraction / 100) * 18; // 8 to 26 px
    const lensHeight = ry * 0.35;

    ctx.fillStyle = "rgba(251, 191, 36, 0.3)";
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(lensX, cy, lensThickness, lensHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ciliary body (above and below lens)
    ctx.fillStyle = "#b45309";
    const cbSize = 10;
    // Top ciliary body
    ctx.beginPath();
    ctx.ellipse(lensX, cy - lensHeight - 8, cbSize * 1.5, cbSize, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bottom ciliary body
    ctx.beginPath();
    ctx.ellipse(lensX, cy + lensHeight + 8, cbSize * 1.5, cbSize, 0, 0, Math.PI * 2);
    ctx.fill();

    // Zonular fibers (suspensory ligaments)
    const zonuleTension = 1 - (ciliaryContraction / 100); // relaxed when ciliary contracts
    ctx.strokeStyle = `rgba(180, 83, 9, ${0.3 + zonuleTension * 0.5})`;
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const yOff = i * 8;
      // Top fibers
      ctx.beginPath();
      ctx.moveTo(lensX, cy - lensHeight + yOff);
      ctx.lineTo(lensX + 5, cy - lensHeight - 8 + yOff * 0.3);
      ctx.stroke();
      // Bottom fibers
      ctx.beginPath();
      ctx.moveTo(lensX, cy + lensHeight + yOff);
      ctx.lineTo(lensX + 5, cy + lensHeight + 8 + yOff * 0.3);
      ctx.stroke();
    }

    // Optic nerve (back of eye)
    const nerveX = cx + rx * 0.85;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(nerveX, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(nerveX + 4, cy);
    ctx.lineTo(cx + rx + 15, cy);
    ctx.stroke();

    // Fovea
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(cx + rx * 0.7, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Light rays
    if (showLightRays) {
      drawLightRays(irisX, cy, pupilRadius, lensX, lensThickness, lensHeight, cx, rx);
    }
  }

  function drawLightRays(irisX: number, cy: number, pupilR: number,
    lensX: number, lensT: number, lensH: number, eyeCx: number, eyeRx: number) {
    const numRays = 5;
    const sourceX = irisX - 80;
    const focalLength = 30 + (1 - ciliaryContraction / 100) * 40; // thicker lens = shorter focal
    const focalX = lensX + focalLength;

    ctx.strokeStyle = `rgba(250, 204, 21, ${0.3 + brightness / 200})`;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < numRays; i++) {
      const yOffset = ((i - (numRays - 1) / 2) / (numRays - 1)) * pupilR * 1.5;
      const entryY = cy + yOffset;

      // Only draw rays that pass through the pupil
      if (Math.abs(yOffset) > pupilR) continue;

      // Ray from source to lens
      ctx.beginPath();
      ctx.moveTo(sourceX, entryY);
      ctx.lineTo(lensX, entryY);

      // Refract through lens toward focal point
      const exitY = entryY;
      const slope = (cy - exitY) / focalLength;
      const endX = Math.min(eyeCx + eyeRx * 0.7, lensX + focalLength * 2);
      const endY = exitY + slope * (endX - lensX);

      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  function drawLabels(cx: number, cy: number, rx: number, ry: number) {
    ctx.font = `${Math.max(9, width * 0.013)}px sans-serif`;
    ctx.textAlign = "left";

    const labels = [
      { text: "Cornea", x: cx - rx * 0.85, y: cy - ry * 0.55, color: "#0ea5e9" },
      { text: "Iris", x: cx - rx * 0.75, y: cy + ry * 0.55, color: "#4f7b58" },
      { text: "Pupil", x: cx - rx * 0.72, y: cy + 4, color: "#475569" },
      { text: "Lens", x: cx - rx * 0.45, y: cy - ry * 0.45, color: "#d97706" },
      { text: "Ciliary body", x: cx - rx * 0.45, y: cy + ry * 0.55, color: "#b45309" },
      { text: "Retina", x: cx + rx * 0.4, y: cy - ry * 0.7, color: "#fbbf24" },
      { text: "Fovea", x: cx + rx * 0.6, y: cy + 16, color: "#ef4444" },
      { text: "Optic nerve", x: cx + rx * 0.7, y: cy + ry * 0.3, color: "#d97706" },
    ];

    for (const l of labels) {
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, l.x, l.y);
    }
  }

  function drawInfoPanel() {
    const px = 10;
    const py = height - 80;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(px, py, width - 20, 70);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, width - 20, 70);

    ctx.font = `${Math.max(10, width * 0.014)}px sans-serif`;
    ctx.textAlign = "left";

    const pupilDesc = pupilSize > 70 ? "Dilated (dim light)" : pupilSize < 30 ? "Constricted (bright light)" : "Normal";
    const lensDesc = ciliaryContraction > 70 ? "Thick — near focus (accommodation)" :
      ciliaryContraction < 30 ? "Thin — far focus (relaxed)" : "Moderate";

    ctx.fillStyle = "#1e293b";
    ctx.fillText(`Pupil: ${pupilDesc} (${pupilSize.toFixed(0)}%)`, px + 10, py + 18);
    ctx.fillText(`Ciliary body: ${ciliaryContraction.toFixed(0)}% contraction → Lens: ${lensDesc}`, px + 10, py + 36);
    ctx.fillStyle = "#64748b";
    ctx.fillText("Sphincter muscle constricts pupil | Dilator muscle enlarges pupil | Ciliary contraction thickens lens", px + 10, py + 56);
  }
};

export default IrisCiliaryBodyFactory;
