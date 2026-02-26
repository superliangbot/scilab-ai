import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LawOfReflectionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("law-of-reflection") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let incidentAngle = 45;
  let mirrorY = 0.5;
  let showNormal = 1;

  const MARGIN = 60;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
  }

  function update(dt: number, params: Record<string, number>) {
    incidentAngle = params.incidentAngle ?? 45;
    mirrorY = params.mirrorY ?? 0.5;
    showNormal = params.showNormal ?? 1;
    time += Math.min(dt, 0.05);
  }

  function render() {
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c1222");
    bg.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Law of Reflection", W / 2, 28);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("θᵢ = θᵣ  (angle of incidence = angle of reflection)", W / 2, 48);

    // Mirror position
    const myPos = MARGIN + mirrorY * (H - 2 * MARGIN);
    const mirrorLeft = MARGIN + 40;
    const mirrorRight = W - MARGIN - 40;
    const mirrorCenterX = (mirrorLeft + mirrorRight) / 2;

    // Draw mirror surface
    const mirGrad = ctx.createLinearGradient(mirrorLeft, myPos - 4, mirrorRight, myPos + 4);
    mirGrad.addColorStop(0, "#475569");
    mirGrad.addColorStop(0.5, "#94a3b8");
    mirGrad.addColorStop(1, "#475569");
    ctx.fillStyle = mirGrad;
    ctx.fillRect(mirrorLeft, myPos - 3, mirrorRight - mirrorLeft, 6);

    // Mirror backing (hatching below)
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    for (let x = mirrorLeft; x < mirrorRight; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, myPos + 3);
      ctx.lineTo(x + 8, myPos + 15);
      ctx.stroke();
    }

    // Normal line (dashed vertical at hit point)
    const hitX = mirrorCenterX;
    const hitY = myPos;

    if (showNormal >= 0.5) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hitX, myPos - 180);
      ctx.lineTo(hitX, myPos + 180);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("Normal", hitX + 25, myPos - 170);
    }

    // Calculate incident and reflected rays
    const angleRad = (incidentAngle * Math.PI) / 180;
    const rayLen = 250;

    // Incident ray comes from upper left
    const incStartX = hitX - rayLen * Math.sin(angleRad);
    const incStartY = hitY - rayLen * Math.cos(angleRad);

    // Reflected ray goes to upper right
    const refEndX = hitX + rayLen * Math.sin(angleRad);
    const refEndY = hitY - rayLen * Math.cos(angleRad);

    // Draw incident ray (yellow)
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(incStartX, incStartY);
    ctx.lineTo(hitX, hitY);
    ctx.stroke();

    // Arrowhead on incident ray
    const incAngleDir = Math.atan2(hitY - incStartY, hitX - incStartX);
    drawArrowhead(hitX - 20 * Math.cos(incAngleDir), hitY - 20 * Math.sin(incAngleDir), incAngleDir, "#fbbf24");

    // Draw reflected ray (cyan)
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(hitX, hitY);
    ctx.lineTo(refEndX, refEndY);
    ctx.stroke();

    // Arrowhead on reflected ray
    const refAngleDir = Math.atan2(refEndY - hitY, refEndX - hitX);
    drawArrowhead(refEndX - 15 * Math.cos(refAngleDir), refEndY - 15 * Math.sin(refAngleDir), refAngleDir, "#22d3ee");

    // Draw angle arcs
    const arcRadius = 50;

    // Incident angle arc (from normal to incident)
    ctx.beginPath();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    const normalAngle = -Math.PI / 2;
    const incRayAngle = Math.atan2(incStartY - hitY, incStartX - hitX);
    ctx.arc(hitX, hitY, arcRadius, normalAngle, incRayAngle, true);
    ctx.stroke();

    // Reflected angle arc
    ctx.beginPath();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    const refRayAngle = Math.atan2(refEndY - hitY, refEndX - hitX);
    ctx.arc(hitX, hitY, arcRadius, refRayAngle, normalAngle, true);
    ctx.stroke();

    // Angle labels
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "right";
    ctx.fillText(`θᵢ = ${incidentAngle.toFixed(1)}°`, hitX - arcRadius - 10, hitY - arcRadius + 5);

    ctx.fillStyle = "#22d3ee";
    ctx.textAlign = "left";
    ctx.fillText(`θᵣ = ${incidentAngle.toFixed(1)}°`, hitX + arcRadius + 10, hitY - arcRadius + 5);

    // Hit point glow
    const glow = ctx.createRadialGradient(hitX, hitY, 0, hitX, hitY, 20);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(hitX, hitY, 20, 0, Math.PI * 2);
    ctx.fill();

    // Virtual image ray (dashed, behind mirror)
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(34, 211, 238, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hitX, hitY);
    const virtX = hitX - rayLen * Math.sin(angleRad);
    const virtY = hitY + rayLen * Math.cos(angleRad);
    ctx.lineTo(virtX, virtY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Virtual image label
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(34, 211, 238, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText("Virtual image ray", (hitX + virtX) / 2 - 20, (hitY + virtY) / 2);

    // Light source icon
    ctx.beginPath();
    ctx.arc(incStartX, incStartY, 12, 0, Math.PI * 2);
    const srcGlow = ctx.createRadialGradient(incStartX, incStartY, 0, incStartX, incStartY, 12);
    srcGlow.addColorStop(0, "#fbbf24");
    srcGlow.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.fillStyle = srcGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(incStartX, incStartY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    // Eye icon at reflected end
    drawEye(refEndX, refEndY);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    const panelW = 200;
    const panelH = 70;
    ctx.beginPath();
    ctx.roundRect(W - panelW - 15, H - panelH - 15, panelW, panelH, 8);
    ctx.fill();

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText(`Incident angle: ${incidentAngle.toFixed(1)}°`, W - panelW - 5, H - panelH + 5);
    ctx.fillText(`Reflected angle: ${incidentAngle.toFixed(1)}°`, W - panelW - 5, H - panelH + 22);
    ctx.fillStyle = "#10b981";
    ctx.fillText(`θᵢ = θᵣ ✓`, W - panelW - 5, H - panelH + 42);

    // Legend
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    let ly = H - 80;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("— Incident ray", 15, ly);
    ly += 15;
    ctx.fillStyle = "#22d3ee";
    ctx.fillText("— Reflected ray", 15, ly);
    ly += 15;
    ctx.fillStyle = "rgba(34, 211, 238, 0.5)";
    ctx.fillText("--- Virtual image ray", 15, ly);
  }

  function drawArrowhead(x: number, y: number, angle: number, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEye(x: number, y: number) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#1e3a5f";
    ctx.fill();
    ctx.restore();
  }

  function reset() {
    time = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    return (
      `Law of Reflection: incident angle = ${incidentAngle.toFixed(1)}°, ` +
      `reflected angle = ${incidentAngle.toFixed(1)}°. ` +
      `The angle of incidence equals the angle of reflection, measured from the normal to the mirror surface. ` +
      `Mirror position: ${(mirrorY * 100).toFixed(0)}% from top.`
    );
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LawOfReflectionFactory;
