import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface SceneObject {
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
  distance: number;
}

const ParallaxOfEyesFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("parallax-of-eyes") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let objectDistance = 150;
  let eyeSeparation = 65;
  let activeEye = 0; // 0=both, 1=left, 2=right
  let backgroundDistance = 400;

  // Scene objects
  let targetObj: SceneObject;
  let bgObjects: SceneObject[] = [];

  // Eyes position (bottom center)
  let leftEyeX = 0;
  let leftEyeY = 0;
  let rightEyeX = 0;
  let rightEyeY = 0;
  let eyesCenterX = 0;
  let eyesCenterY = 0;

  // Parallax computed
  let parallaxAngleDeg = 0;

  // Blink animation
  let blinkPhase = 0;

  function setupScene(): void {
    eyesCenterX = width / 2;
    eyesCenterY = height - 80;
    const sep = eyeSeparation * 0.8; // scale for visual
    leftEyeX = eyesCenterX - sep / 2;
    rightEyeX = eyesCenterX + sep / 2;
    leftEyeY = eyesCenterY;
    rightEyeY = eyesCenterY;

    // Target object
    targetObj = {
      x: eyesCenterX,
      y: eyesCenterY - objectDistance,
      size: 18,
      color: "#fbbf24",
      label: "Target",
      distance: objectDistance,
    };

    // Background reference objects (fixed positions at backgroundDistance)
    bgObjects = [];
    const bgY = eyesCenterY - backgroundDistance;
    const spacing = 80;
    for (let i = -3; i <= 3; i++) {
      bgObjects.push({
        x: eyesCenterX + i * spacing,
        y: bgY,
        size: 8,
        color: "#475569",
        label: i === 0 ? "Ref" : "",
        distance: backgroundDistance,
      });
    }

    // Compute parallax angle: angle subtended at target by the two eyes
    // parallax angle = 2 * arctan(d / (2 * D))
    const halfSep = (eyeSeparation / 1000) * 0.5; // convert mm to m (approx scaling)
    const distM = objectDistance / 100; // approx scale
    parallaxAngleDeg = 2 * Math.atan(halfSep / Math.max(distM, 0.01)) * (180 / Math.PI);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    setupScene();
  }

  function update(dt: number, params: Record<string, number>): void {
    objectDistance = params.objectDistance ?? 150;
    eyeSeparation = params.eyeSeparation ?? 65;
    activeEye = Math.round(params.activeEye ?? 0);
    backgroundDistance = params.backgroundDistance ?? 400;

    time += Math.min(dt, 0.033);
    blinkPhase = time;

    setupScene();
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1222");
    bgGrad.addColorStop(1, "#151d2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle depth lines
    ctx.strokeStyle = "rgba(100, 120, 180, 0.06)";
    ctx.lineWidth = 1;
    for (let y = 50; y < height - 100; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawBackgroundObjects(): void {
    for (const obj of bgObjects) {
      // Stars / reference markers
      ctx.fillStyle = obj.color;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
      ctx.fill();

      // Small cross
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(obj.x - obj.size - 3, obj.y);
      ctx.lineTo(obj.x + obj.size + 3, obj.y);
      ctx.moveTo(obj.x, obj.y - obj.size - 3);
      ctx.lineTo(obj.x, obj.y + obj.size + 3);
      ctx.stroke();

      if (obj.label) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(obj.label, obj.x, obj.y - obj.size - 6);
      }
    }

    // Background label
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Background (${backgroundDistance}px away)`, width - 15, bgObjects[0].y - 15);
  }

  function drawTargetObject(): void {
    const obj = targetObj;

    // Glow
    const glow = ctx.createRadialGradient(obj.x, obj.y, 0, obj.x, obj.y, obj.size * 3);
    glow.addColorStop(0, "rgba(251, 191, 36, 0.3)");
    glow.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.size * 3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Object body
    const grad = ctx.createRadialGradient(obj.x - 4, obj.y - 4, 0, obj.x, obj.y, obj.size);
    grad.addColorStop(0, "#fef3c7");
    grad.addColorStop(0.6, "#fbbf24");
    grad.addColorStop(1, "#b45309");
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Target Object", obj.x, obj.y - obj.size - 8);

    // Distance label line
    ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(obj.x + obj.size + 10, obj.y);
    ctx.lineTo(obj.x + obj.size + 10, eyesCenterY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`d = ${objectDistance}px`, obj.x + obj.size + 14, (obj.y + eyesCenterY) / 2);
  }

  function drawSightLines(): void {
    const obj = targetObj;

    // Left eye sight line
    if (activeEye === 0 || activeEye === 1) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(leftEyeX, leftEyeY);
      ctx.lineTo(obj.x, obj.y);
      // Extend line to background
      const dx = obj.x - leftEyeX;
      const dy = obj.y - leftEyeY;
      const scale = backgroundDistance / objectDistance;
      const bgHitX = leftEyeX + dx * scale;
      const bgHitY = leftEyeY + dy * scale;
      ctx.lineTo(bgHitX, bgHitY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Apparent position marker on background
      ctx.beginPath();
      ctx.arc(bgHitX, bgHitY, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
      ctx.fill();

      ctx.fillStyle = "#3b82f6";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("L", bgHitX, bgHitY - 10);
    }

    // Right eye sight line
    if (activeEye === 0 || activeEye === 2) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(rightEyeX, rightEyeY);
      ctx.lineTo(obj.x, obj.y);
      // Extend to background
      const dx = obj.x - rightEyeX;
      const dy = obj.y - rightEyeY;
      const scale = backgroundDistance / objectDistance;
      const bgHitX = rightEyeX + dx * scale;
      const bgHitY = rightEyeY + dy * scale;
      ctx.lineTo(bgHitX, bgHitY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Apparent position marker on background
      ctx.beginPath();
      ctx.arc(bgHitX, bgHitY, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
      ctx.fill();

      ctx.fillStyle = "#ef4444";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("R", bgHitX, bgHitY - 10);
    }
  }

  function drawParallaxAngle(): void {
    if (activeEye !== 0) return;
    const obj = targetObj;

    // Draw the parallax angle arc at the target
    const angleToLeft = Math.atan2(leftEyeY - obj.y, leftEyeX - obj.x);
    const angleToRight = Math.atan2(rightEyeY - obj.y, rightEyeX - obj.x);

    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const arcRadius = 30;
    ctx.arc(obj.x, obj.y, arcRadius, Math.min(angleToLeft, angleToRight), Math.max(angleToLeft, angleToRight));
    ctx.stroke();

    // Angle label
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`\u03B8 = ${parallaxAngleDeg.toFixed(2)}\u00B0`, obj.x + arcRadius + 5, obj.y + 5);
  }

  function drawEye(x: number, y: number, color: string, label: string, isActive: boolean): void {
    const eyeW = 28;
    const eyeH = 16;

    // Eye white
    ctx.beginPath();
    ctx.ellipse(x, y, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? "#f0f0f0" : "#666";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Iris
    const irisR = 8;
    ctx.beginPath();
    ctx.arc(x, y, irisR, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? color : "#444";
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? "#111" : "#333";
    ctx.fill();

    // Highlight
    if (isActive) {
      ctx.beginPath();
      ctx.arc(x + 2, y - 2, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fill();
    }

    // Label
    ctx.fillStyle = color;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y + eyeH + 15);
  }

  function drawEyes(): void {
    const leftActive = activeEye === 0 || activeEye === 1;
    const rightActive = activeEye === 0 || activeEye === 2;

    drawEye(leftEyeX, leftEyeY, "#3b82f6", "Left Eye", leftActive);
    drawEye(rightEyeX, rightEyeY, "#ef4444", "Right Eye", rightActive);

    // Eye separation label
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftEyeX, leftEyeY + 28);
    ctx.lineTo(rightEyeX, rightEyeY + 28);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${eyeSeparation} mm`, eyesCenterX, eyesCenterY + 40);
  }

  function drawInfoPanel(): void {
    const panelW = 220;
    const panelH = 105;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Parallax of Eyes", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    let y = panelY + 38;
    const lh = 16;

    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`Parallax Angle: ${parallaxAngleDeg.toFixed(2)}\u00B0`, panelX + 10, y); y += lh;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Object Distance: ${objectDistance} px`, panelX + 10, y); y += lh;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Eye Separation: ${eyeSeparation} mm`, panelX + 10, y); y += lh;

    const eyeLabel = activeEye === 0 ? "Both Eyes" : activeEye === 1 ? "Left Eye Only" : "Right Eye Only";
    ctx.fillStyle = activeEye === 1 ? "#3b82f6" : activeEye === 2 ? "#ef4444" : "#a855f7";
    ctx.fillText(`Active: ${eyeLabel}`, panelX + 10, y);
  }

  function drawExplanation(): void {
    const panelW = 250;
    const panelH = 50;
    const panelX = width - panelW - 10;
    const panelY = height - panelH - 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("\u03B8 = 2\u00B7arctan(d / 2D)", panelX + 10, panelY + 20);
    ctx.fillText("Closer objects \u2192 larger parallax shift", panelX + 10, panelY + 38);
  }

  function render(): void {
    drawBackground();
    drawBackgroundObjects();
    drawSightLines();
    drawParallaxAngle();
    drawTargetObject();
    drawEyes();
    drawInfoPanel();
    drawExplanation();
  }

  function reset(): void {
    time = 0;
    blinkPhase = 0;
    setupScene();
  }

  function destroy(): void {
    bgObjects = [];
  }

  function getStateDescription(): string {
    const eyeLabel = activeEye === 0 ? "both" : activeEye === 1 ? "left" : "right";
    return (
      `Parallax of Eyes: object at ${objectDistance}px, eye separation=${eyeSeparation}mm. ` +
      `Background at ${backgroundDistance}px. Active eye: ${eyeLabel}. ` +
      `Parallax angle: ${parallaxAngleDeg.toFixed(2)}\u00B0. ` +
      `Demonstrates how apparent position shifts against background when viewed from different eye positions.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    setupScene();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ParallaxOfEyesFactory;
