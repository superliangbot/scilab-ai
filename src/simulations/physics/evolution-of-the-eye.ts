import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EvolutionOfTheEyeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("evolution-of-the-eye") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let lightAngle = 30; // degrees
  let stage = 0; // 0=all stages, 1-4 = individual stages
  let showRays = 1;

  interface EyeStage {
    name: string;
    organism: string;
    description: string;
    drawFn: (x: number, y: number, w: number, h: number) => void;
  }

  function drawLightRays(ox: number, oy: number, w: number, h: number, convergence: number): void {
    if (showRays < 0.5) return;
    const angleRad = (lightAngle * Math.PI) / 180;
    const numRays = 5;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 220, 50, 0.4)";
    ctx.lineWidth = 1.5;

    for (let i = 0; i < numRays; i++) {
      const spread = ((i - (numRays - 1) / 2) / numRays) * 0.5;
      const startX = ox - 80;
      const startY = oy - h * 0.3 + i * (h * 0.6 / numRays);
      const endX = ox + w * 0.3;
      const endY = oy + Math.tan(angleRad + spread) * w * 0.3 * convergence;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrow heads
      const dx = endX - startX;
      const dy = endY - startY;
      const angle = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 6 * Math.cos(angle - 0.3), endY - 6 * Math.sin(angle - 0.3));
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 6 * Math.cos(angle + 0.3), endY - 6 * Math.sin(angle + 0.3));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Stage 1: Simple photoreceptor (Euglena)
  function drawPhotoreceptor(x: number, y: number, w: number, h: number): void {
    // Cell body
    ctx.fillStyle = "rgba(100, 180, 100, 0.5)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 160, 80, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyespot (photoreceptor)
    const spotX = x + w * 0.35;
    const spotY = y + h * 0.4;
    ctx.beginPath();
    ctx.arc(spotX, spotY, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#e74c3c";
    ctx.fill();

    // Stigma (light-sensitive area)
    const glow = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 15);
    glow.addColorStop(0, "rgba(255, 100, 50, 0.5)");
    glow.addColorStop(1, "rgba(255, 100, 50, 0)");
    ctx.beginPath();
    ctx.arc(spotX, spotY, 15, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    drawLightRays(x, y + h / 2, w, h, 0.2);

    // Flagellum
    ctx.strokeStyle = "rgba(80, 160, 80, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.15);
    for (let t = 0; t < 30; t++) {
      ctx.lineTo(x + w * 0.5 + Math.sin(t * 0.5 + time * 3) * 5, y + h * 0.15 - t * 1.5);
    }
    ctx.stroke();
  }

  // Stage 2: Eye cup (Planarian/Flatworm)
  function drawEyeCup(x: number, y: number, w: number, h: number): void {
    const cx = x + w / 2;
    const cy = y + h / 2;

    // Cup shape
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy - 30);
    ctx.quadraticCurveTo(cx - 35, cy, cx - 25, cy + 30);
    ctx.lineTo(cx + 5, cy + 20);
    ctx.quadraticCurveTo(cx - 10, cy, cx + 5, cy - 20);
    ctx.closePath();

    ctx.fillStyle = "rgba(180, 80, 80, 0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 100, 100, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Photoreceptor cells lining the cup
    for (let i = -3; i <= 3; i++) {
      const angle = (i / 3) * 0.8;
      const px = cx - 20 + Math.cos(angle + Math.PI) * 15;
      const py = cy + Math.sin(angle) * 25;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#e74c3c";
      ctx.fill();
    }

    // Pigment cup (dark backing)
    ctx.beginPath();
    ctx.arc(cx - 22, cy, 18, -1, 1);
    ctx.strokeStyle = "rgba(40, 20, 20, 0.6)";
    ctx.lineWidth = 4;
    ctx.stroke();

    drawLightRays(x, cy, w, h, 0.5);
  }

  // Stage 3: Pinhole eye (Nautilus)
  function drawPinholeEye(x: number, y: number, w: number, h: number): void {
    const cx = x + w / 2;
    const cy = y + h / 2;

    // Chamber
    ctx.beginPath();
    ctx.ellipse(cx, cy, 35, 35, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(30, 30, 60, 0.6)";
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 130, 100, 0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pinhole aperture
    ctx.beginPath();
    ctx.arc(cx - 35, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();

    // Retina (photoreceptor layer on back wall)
    ctx.beginPath();
    ctx.arc(cx + 10, cy, 28, -1.2, 1.2);
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Light rays through pinhole
    if (showRays > 0.5) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 220, 50, 0.3)";
      ctx.lineWidth = 1;
      const pinholeX = cx - 35;
      const angleRad = (lightAngle * Math.PI) / 180;

      for (let i = -2; i <= 2; i++) {
        const startX = pinholeX - 60;
        const startY = cy + i * 12;
        // Through pinhole
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(pinholeX, cy);
        ctx.stroke();

        // Diverging inside (inverted image)
        ctx.beginPath();
        ctx.moveTo(pinholeX, cy);
        ctx.lineTo(cx + 20, cy - i * 8 + Math.tan(angleRad) * 10);
        ctx.stroke();

        // Focal dot
        ctx.beginPath();
        ctx.arc(cx + 20, cy - i * 8 + Math.tan(angleRad) * 10, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 180, 50, 0.7)";
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Stage 4: Camera eye (Vertebrate)
  function drawCameraEye(x: number, y: number, w: number, h: number): void {
    const cx = x + w / 2;
    const cy = y + h / 2;

    // Eyeball
    ctx.beginPath();
    ctx.ellipse(cx, cy, 40, 38, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(240, 230, 220, 0.3)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 180, 160, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Retina
    ctx.beginPath();
    ctx.arc(cx + 5, cy, 35, -1.5, 1.5);
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Iris
    ctx.beginPath();
    ctx.ellipse(cx - 30, cy, 8, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(60, 120, 180, 0.6)";
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.ellipse(cx - 30, cy, 4, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();

    // Lens
    ctx.beginPath();
    ctx.ellipse(cx - 20, cy, 8, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200, 220, 240, 0.3)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 200, 220, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cornea
    ctx.beginPath();
    ctx.arc(cx - 35, cy, 22, -0.8, 0.8);
    ctx.strokeStyle = "rgba(200, 220, 240, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Optic nerve
    ctx.strokeStyle = "rgba(200, 180, 100, 0.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + 40, cy);
    ctx.lineTo(cx + 60, cy + 5);
    ctx.stroke();

    // Light rays focusing through lens
    if (showRays > 0.5) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 220, 50, 0.3)";
      ctx.lineWidth = 1;
      const lensX = cx - 20;
      const angleRad = (lightAngle * Math.PI) / 180;

      for (let i = -2; i <= 2; i++) {
        const startX = cx - 80;
        const startY = cy + i * 10;
        // To lens
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(lensX, cy + i * 6);
        ctx.stroke();

        // From lens to focal point on retina (converging)
        const focalY = cy - i * 4 + Math.tan(angleRad) * 8;
        ctx.beginPath();
        ctx.moveTo(lensX, cy + i * 6);
        ctx.lineTo(cx + 25, focalY);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + 25, focalY, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 180, 50, 0.7)";
        ctx.fill();
      }
      ctx.restore();
    }

    // Muscle labels
    ctx.fillStyle = "rgba(180, 160, 140, 0.4)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ciliary muscle", cx - 10, cy - 30);
  }

  const stages: EyeStage[] = [
    {
      name: "Stage 1: Photoreceptor",
      organism: "Euglena",
      description: "Simple light-sensitive spot. Detects light vs dark.",
      drawFn: drawPhotoreceptor,
    },
    {
      name: "Stage 2: Eye Cup",
      organism: "Planarian (Flatworm)",
      description: "Concave pit provides crude directional sensing.",
      drawFn: drawEyeCup,
    },
    {
      name: "Stage 3: Pinhole Eye",
      organism: "Nautilus",
      description: "Deep chamber with tiny aperture. Dim but real image.",
      drawFn: drawPinholeEye,
    },
    {
      name: "Stage 4: Camera Eye",
      organism: "Vertebrate / Octopus",
      description: "Lens focuses light onto retina. Sharp, bright image.",
      drawFn: drawCameraEye,
    },
  ];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    lightAngle = params.lightAngle ?? 30;
    stage = Math.round(params.stage ?? 0);
    showRays = params.showRays ?? 1;
    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitle(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Evolution of the Eye", W / 2, 30);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("From simple photoreceptor to complex camera eye — each step provided survival advantage", W / 2, 50);
  }

  function drawAllStages(): void {
    const cols = 2;
    const rows = 2;
    const cellW = (W - 60) / cols;
    const cellH = (H - 120) / rows;

    for (let i = 0; i < 4; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 30 + col * cellW;
      const y = 70 + row * cellH;

      // Cell background
      ctx.fillStyle = "rgba(20, 30, 50, 0.4)";
      ctx.beginPath();
      ctx.roundRect(x, y, cellW - 10, cellH - 10, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 140, 200, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Stage name
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(stages[i].name, x + 10, y + 20);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(stages[i].organism, x + 10, y + 35);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(stages[i].description, x + 10, y + 50);

      // Draw the eye
      stages[i].drawFn(x + cellW * 0.15, y + 50, cellW * 0.7, cellH - 80);
    }
  }

  function drawSingleStage(idx: number): void {
    const x = 100;
    const y = 80;
    const w = W - 200;
    const h = H - 160;
    const s = stages[idx - 1];

    ctx.fillStyle = "rgba(20, 30, 50, 0.4)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.name, W / 2, y + 30);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(s.organism, W / 2, y + 52);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(s.description, W / 2, y + 72);

    s.drawFn(x + w * 0.15, y + 80, w * 0.7, h - 120);
  }

  function drawAngleIndicator(): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(W - 150, H - 45, 135, 30, 6);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Light angle: ${lightAngle.toFixed(0)}°`, W - 82, H - 24);
    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawTitle();

    if (stage === 0) {
      drawAllStages();
    } else {
      drawSingleStage(Math.min(stage, 4));
    }

    drawAngleIndicator();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const stageLabel = stage === 0 ? "all 4 stages" : stages[Math.min(stage, 4) - 1].name;
    return (
      `Evolution of the Eye: Showing ${stageLabel}. Light angle: ${lightAngle.toFixed(0)}°. ` +
      `Stage 1: Simple photoreceptor (Euglena) — detects light/dark. ` +
      `Stage 2: Eye cup (Planarian) — crude directional sensing. ` +
      `Stage 3: Pinhole eye (Nautilus) — real but dim image without lens. ` +
      `Stage 4: Camera eye (Vertebrate) — lens focuses light onto retina for sharp images.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EvolutionOfTheEyeFactory;
