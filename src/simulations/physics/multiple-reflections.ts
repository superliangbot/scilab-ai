import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MultipleReflectionsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("multiple-reflections") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Parameters
  let mirrorAngle = 90; // angle between two plane mirrors (degrees)
  let objectDistance = 120; // distance of object from mirror intersection
  let objectAngle = 45; // angle of object relative to mirror 1 (degrees)
  let showRays = 1;

  // Computed reflections
  interface Reflection {
    x: number;
    y: number;
    label: string;
    isReal: boolean;
  }
  let reflections: Reflection[] = [];

  // Mirror geometry
  const MIRROR_LENGTH = 300;
  const CENTER_X_RATIO = 0.4;
  const CENTER_Y_RATIO = 0.55;

  function computeReflections(): void {
    reflections = [];
    if (mirrorAngle <= 0 || mirrorAngle > 180) return;

    const numImages = Math.floor(360 / mirrorAngle) - 1;
    const objRad = (objectAngle * Math.PI) / 180;

    // Object position
    const objX = objectDistance * Math.cos(objRad);
    const objY = -objectDistance * Math.sin(objRad);

    // Generate image positions by successive reflections
    for (let i = 1; i <= numImages; i++) {
      const angleOfImage = i * mirrorAngle;
      const sign = i % 2 === 0 ? 1 : -1;
      const imageAngleRad = (angleOfImage * Math.PI) / 180;

      let imgAngle: number;
      if (i % 2 === 1) {
        // Reflected in mirror 1 (horizontal)
        imgAngle = imageAngleRad - objRad;
      } else {
        // Reflected in mirror 2
        imgAngle = imageAngleRad + objRad;
      }

      const imgX = objectDistance * Math.cos(imgAngle);
      const imgY = -objectDistance * Math.sin(imgAngle);

      reflections.push({
        x: imgX,
        y: imgY,
        label: `I${i}`,
        isReal: false,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    computeReflections();
  }

  function update(_dt: number, params: Record<string, number>): void {
    mirrorAngle = params.mirrorAngle ?? 90;
    objectDistance = params.objectDistance ?? 120;
    objectAngle = params.objectAngle ?? 45;
    showRays = params.showRays ?? 1;
    computeReflections();
  }

  function worldToCanvas(wx: number, wy: number): { cx: number; cy: number } {
    const centerX = width * CENTER_X_RATIO;
    const centerY = height * CENTER_Y_RATIO;
    return { cx: centerX + wx, cy: centerY + wy };
  }

  function drawMirrors(): void {
    const { cx: ox, cy: oy } = worldToCanvas(0, 0);

    // Mirror 1 (horizontal, along +x axis)
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + MIRROR_LENGTH, oy);
    ctx.stroke();

    // Mirror hatching (indicating reflective side)
    ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
    ctx.lineWidth = 1;
    for (let i = 0; i < MIRROR_LENGTH; i += 10) {
      ctx.beginPath();
      ctx.moveTo(ox + i, oy);
      ctx.lineTo(ox + i + 6, oy + 8);
      ctx.stroke();
    }

    // Mirror 2 (at mirrorAngle from mirror 1)
    const rad = (mirrorAngle * Math.PI) / 180;
    const m2x = MIRROR_LENGTH * Math.cos(rad);
    const m2y = -MIRROR_LENGTH * Math.sin(rad);

    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + m2x, oy + m2y);
    ctx.stroke();

    // Mirror 2 hatching
    ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
    ctx.lineWidth = 1;
    const steps = Math.floor(MIRROR_LENGTH / 10);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const bx = ox + t * m2x;
      const by = oy + t * m2y;
      const perpX = Math.sin(rad) * 8;
      const perpY = Math.cos(rad) * 8;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + perpX, by + perpY);
      ctx.stroke();
    }

    // Angle arc
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, 40, -rad, 0);
    ctx.stroke();

    // Angle label
    const labelAngle = -rad / 2;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `${mirrorAngle}°`,
      ox + 55 * Math.cos(labelAngle),
      oy + 55 * Math.sin(labelAngle) + 4
    );
  }

  function drawObject(): void {
    const objRad = (objectAngle * Math.PI) / 180;
    const objX = objectDistance * Math.cos(objRad);
    const objY = -objectDistance * Math.sin(objRad);
    const { cx, cy } = worldToCanvas(objX, objY);

    // Object (candle-like)
    // Candle body
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(cx - 4, cy - 20, 8, 20);

    // Flame
    ctx.beginPath();
    ctx.ellipse(cx, cy - 26, 5, 8, 0, 0, Math.PI * 2);
    const flameGrad = ctx.createRadialGradient(cx, cy - 26, 0, cx, cy - 26, 8);
    flameGrad.addColorStop(0, "#fff");
    flameGrad.addColorStop(0.4, "#fbbf24");
    flameGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = flameGrad;
    ctx.fill();

    // Label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Object", cx, cy + 16);
  }

  function drawReflections(): void {
    for (const ref of reflections) {
      const { cx, cy } = worldToCanvas(ref.x, ref.y);

      // Virtual image (dashed outline candle)
      ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(cx - 4, cy - 20, 8, 20);

      // Virtual flame
      ctx.beginPath();
      ctx.ellipse(cx, cy - 26, 5, 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.stroke();
      ctx.setLineDash([]);

      // Glow
      const glow = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 25);
      glow.addColorStop(0, "rgba(251, 191, 36, 0.15)");
      glow.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy - 20, 25, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ref.label, cx, cy + 14);
    }
  }

  function drawRays(): void {
    if (showRays < 1) return;

    const objRad = (objectAngle * Math.PI) / 180;
    const objX = objectDistance * Math.cos(objRad);
    const objY = -objectDistance * Math.sin(objRad);
    const { cx: objCx, cy: objCy } = worldToCanvas(objX, objY);
    const { cx: centerCx, cy: centerCy } = worldToCanvas(0, 0);

    // Draw incident rays from object to each mirror, and reflected rays
    // Ray to mirror 1 (horizontal)
    const m1HitX = objX;
    const m1HitY = 0;
    const { cx: m1cx, cy: m1cy } = worldToCanvas(m1HitX, m1HitY);

    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(objCx, objCy);
    ctx.lineTo(m1cx, m1cy);
    ctx.stroke();

    // Reflected ray from mirror 1
    ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(m1cx, m1cy);
    ctx.lineTo(m1cx, m1cy + objectDistance * Math.sin(objRad));
    ctx.stroke();
    ctx.setLineDash([]);

    // Ray to mirror 2
    const m2Rad = (mirrorAngle * Math.PI) / 180;
    const projDist = objectDistance * Math.cos(m2Rad - objRad);
    const m2HitX = projDist * Math.cos(m2Rad);
    const m2HitY = -projDist * Math.sin(m2Rad);
    const { cx: m2cx, cy: m2cy } = worldToCanvas(m2HitX, m2HitY);

    ctx.strokeStyle = "rgba(52, 211, 153, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(objCx, objCy);
    ctx.lineTo(m2cx, m2cy);
    ctx.stroke();
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1222");
    bgGrad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawMirrors();
    drawRays();
    drawObject();
    drawReflections();

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Multiple Reflections Between Two Plane Mirrors", width / 2, 28);

    // Formula panel
    const numImages = mirrorAngle > 0 ? Math.floor(360 / mirrorAngle) - 1 : 0;
    const panelW = 260;
    const panelX = width - panelW - 12;
    const panelY = 45;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, 120, 6);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Multiple Reflections", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Mirror Angle (θ): ${mirrorAngle}°`, panelX + 10, panelY + 40);
    ctx.fillText(`n = 360°/θ - 1 = ${numImages}`, panelX + 10, panelY + 56);
    ctx.fillText(`Number of Images: ${numImages}`, panelX + 10, panelY + 72);
    ctx.fillText(`Object Distance: ${objectDistance} px`, panelX + 10, panelY + 88);
    ctx.fillText(`Object Angle: ${objectAngle}°`, panelX + 10, panelY + 104);

    // Legend
    const legY = height - 50;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(20, legY, 20, 3);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Mirror 1", 48, legY + 5);

    ctx.fillStyle = "#34d399";
    ctx.fillRect(120, legY, 20, 3);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Mirror 2", 148, legY + 5);

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(230, legY + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Object / Images", 240, legY + 5);
  }

  function reset(): void {
    computeReflections();
  }

  function destroy(): void {
    reflections = [];
  }

  function getStateDescription(): string {
    const numImages = mirrorAngle > 0 ? Math.floor(360 / mirrorAngle) - 1 : 0;
    return (
      `Multiple Reflections: Two plane mirrors at ${mirrorAngle}° angle. ` +
      `Object at distance ${objectDistance} pixels, angle ${objectAngle}°. ` +
      `Number of images = 360/${mirrorAngle} - 1 = ${numImages}. ` +
      `When mirrors face each other at angle θ, the formula n = (360/θ) - 1 gives the number of images formed.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MultipleReflectionsFactory;
