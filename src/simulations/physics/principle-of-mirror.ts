import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PrincipleOfMirrorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("principle-of-mirror") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let incidentAngle = 40; // degrees
  let showAngles = 1;
  let showWaves = 1;
  let mirrorPosition = 50; // percent along bottom

  // Layout
  let mirrorX = 0, mirrorY = 0, mirrorW = 0;
  let sourceX = 0, sourceY = 0;
  let observerX = 0, observerY = 0;

  function layout() {
    mirrorY = height * 0.72;
    mirrorW = width * 0.5;
    mirrorX = width * 0.25;

    sourceX = width * 0.2;
    sourceY = height * 0.2;
    observerX = width * 0.8;
    observerY = height * 0.2;
  }

  function getReflectionPoint(): { x: number; y: number } {
    // Mirror center position adjusted by mirrorPosition parameter
    const mx = mirrorX + (mirrorPosition / 100) * mirrorW;
    return { x: mx, y: mirrorY };
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    layout();
  }

  function update(dt: number, params: Record<string, number>) {
    incidentAngle = params.incidentAngle ?? 40;
    showAngles = params.showAngles ?? 1;
    showWaves = params.showWaves ?? 1;
    mirrorPosition = params.mirrorPosition ?? 50;
    time += dt;
  }

  function drawWavyRay(x1: number, y1: number, x2: number, y2: number, color: string, phase: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    // Perpendicular
    const px = -ny;
    const py = nx;

    const wavelength = 15;
    const amplitude = showWaves >= 0.5 ? 4 : 0;
    const steps = Math.floor(dist / 2);

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const d = t * dist;
      const wave = Math.sin((d / wavelength) * Math.PI * 2 - time * 8 + phase) * amplitude;
      const wx = x1 + nx * d + px * wave;
      const wy = y1 + ny * d + py * wave;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function render() {
    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    const rp = getReflectionPoint();

    // Mirror surface
    const mirrorGrad = ctx.createLinearGradient(mirrorX, mirrorY - 5, mirrorX, mirrorY + 15);
    mirrorGrad.addColorStop(0, "rgba(180,200,220,0.6)");
    mirrorGrad.addColorStop(0.5, "rgba(120,160,200,0.4)");
    mirrorGrad.addColorStop(1, "rgba(80,100,140,0.2)");
    ctx.fillStyle = mirrorGrad;
    ctx.fillRect(mirrorX, mirrorY, mirrorW, 12);

    // Mirror surface line
    ctx.strokeStyle = "rgba(200,220,240,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mirrorX, mirrorY);
    ctx.lineTo(mirrorX + mirrorW, mirrorY);
    ctx.stroke();

    // Hatching below mirror
    ctx.strokeStyle = "rgba(100,120,150,0.2)";
    ctx.lineWidth = 1;
    for (let x = mirrorX; x < mirrorX + mirrorW; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, mirrorY + 12);
      ctx.lineTo(x + 6, mirrorY + 20);
      ctx.stroke();
    }

    // Normal line (perpendicular to mirror at reflection point)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rp.x, mirrorY - 120);
    ctx.lineTo(rp.x, mirrorY + 30);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Normal", rp.x + 25, mirrorY - 110);

    // Calculate incident and reflected ray endpoints
    const incRad = (incidentAngle * Math.PI) / 180;
    const rayLen = 200;

    // Incident ray: from source toward mirror at incidentAngle from normal
    const incDirX = -Math.sin(incRad);
    const incDirY = Math.cos(incRad);
    const incStartX = rp.x - incDirX * rayLen;
    const incStartY = rp.y - incDirY * rayLen;

    // Reflected ray: angle of reflection = angle of incidence (from normal)
    const refDirX = Math.sin(incRad); // reflected horizontally
    const refDirY = -Math.cos(incRad); // goes upward
    const refEndX = rp.x + refDirX * rayLen;
    const refEndY = rp.y + refDirY * rayLen;

    // Draw rays as wavy lines
    drawWavyRay(incStartX, incStartY, rp.x, rp.y, "rgba(255,200,50,0.8)", 0);
    drawWavyRay(rp.x, rp.y, refEndX, refEndY, "rgba(100,200,255,0.8)", Math.PI);

    // Ray arrows
    const arrowSize = 8;
    // Incident arrow (toward mirror)
    const iaMid = 0.6;
    const iaX = incStartX + (rp.x - incStartX) * iaMid;
    const iaY = incStartY + (rp.y - incStartY) * iaMid;
    ctx.fillStyle = "rgba(255,200,50,0.8)";
    ctx.beginPath();
    const iAngle = Math.atan2(rp.y - incStartY, rp.x - incStartX);
    ctx.moveTo(iaX + Math.cos(iAngle) * arrowSize, iaY + Math.sin(iAngle) * arrowSize);
    ctx.lineTo(iaX + Math.cos(iAngle + 2.5) * arrowSize, iaY + Math.sin(iAngle + 2.5) * arrowSize);
    ctx.lineTo(iaX + Math.cos(iAngle - 2.5) * arrowSize, iaY + Math.sin(iAngle - 2.5) * arrowSize);
    ctx.closePath();
    ctx.fill();

    // Reflected arrow (away from mirror)
    const raMid = 0.4;
    const raX = rp.x + (refEndX - rp.x) * raMid;
    const raY = rp.y + (refEndY - rp.y) * raMid;
    ctx.fillStyle = "rgba(100,200,255,0.8)";
    ctx.beginPath();
    const rAngle = Math.atan2(refEndY - rp.y, refEndX - rp.x);
    ctx.moveTo(raX + Math.cos(rAngle) * arrowSize, raY + Math.sin(rAngle) * arrowSize);
    ctx.lineTo(raX + Math.cos(rAngle + 2.5) * arrowSize, raY + Math.sin(rAngle + 2.5) * arrowSize);
    ctx.lineTo(raX + Math.cos(rAngle - 2.5) * arrowSize, raY + Math.sin(rAngle - 2.5) * arrowSize);
    ctx.closePath();
    ctx.fill();

    // Angle arcs
    if (showAngles >= 0.5) {
      const arcR = 40;

      // Incident angle arc
      ctx.beginPath();
      const incStart = -Math.PI / 2 - incRad;
      const incEnd = -Math.PI / 2;
      ctx.arc(rp.x, rp.y, arcR, incStart, incEnd);
      ctx.strokeStyle = "rgba(255,200,50,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Reflected angle arc
      ctx.beginPath();
      const refStart = -Math.PI / 2;
      const refEnd = -Math.PI / 2 + incRad;
      ctx.arc(rp.x, rp.y, arcR, refStart, refEnd);
      ctx.strokeStyle = "rgba(100,200,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Angle labels
      ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,200,50,0.8)";
      const labelR = arcR + 18;
      const labelAngle1 = -Math.PI / 2 - incRad / 2;
      ctx.fillText(`θᵢ=${incidentAngle}°`, rp.x + labelR * Math.cos(labelAngle1), rp.y + labelR * Math.sin(labelAngle1));

      ctx.fillStyle = "rgba(100,200,255,0.8)";
      const labelAngle2 = -Math.PI / 2 + incRad / 2;
      ctx.fillText(`θᵣ=${incidentAngle}°`, rp.x + labelR * Math.cos(labelAngle2), rp.y + labelR * Math.sin(labelAngle2));
    }

    // Light source
    ctx.beginPath();
    ctx.arc(incStartX, incStartY, 12, 0, Math.PI * 2);
    const srcGrad = ctx.createRadialGradient(incStartX, incStartY, 0, incStartX, incStartY, 12);
    srcGrad.addColorStop(0, "#ffee88");
    srcGrad.addColorStop(1, "#cc9900");
    ctx.fillStyle = srcGrad;
    ctx.fill();
    ctx.fillStyle = "rgba(255,240,150,0.7)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Light Source", incStartX, incStartY - 18);

    // Observer eye
    ctx.beginPath();
    const eyeX = refEndX;
    const eyeY = refEndY;
    ctx.ellipse(eyeX, eyeY, 14, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#333";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.fillStyle = "rgba(200,200,255,0.7)";
    ctx.fillText("Observer", eyeX, eyeY - 18);

    // Reflection point marker
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Info panel
    const infoY = height * 0.85;
    ctx.fillStyle = "rgba(10,10,30,0.85)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, infoY, width * 0.9, height * 0.12, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `${Math.max(11, height * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Law of Reflection: Angle of incidence (θᵢ) = Angle of reflection (θᵣ)", width / 2, infoY + 18);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
    ctx.fillText("Waves maintain phase coherence only when θᵢ = θᵣ (constructive interference)", width / 2, infoY + 38);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Principle of Mirror — Law of Reflection", width / 2, 25);

    // Wave legend
    ctx.font = `${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,200,50,0.7)";
    ctx.fillText("— Incident ray", width * 0.7, height * 0.08);
    ctx.fillStyle = "rgba(100,200,255,0.7)";
    ctx.fillText("— Reflected ray", width * 0.7, height * 0.12);
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    return `Mirror Reflection | θ_incident = θ_reflected = ${incidentAngle}° | ${showWaves >= 0.5 ? "Wave visualization ON" : "Wave visualization OFF"} | Law of reflection: angle of incidence equals angle of reflection`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PrincipleOfMirrorFactory;
