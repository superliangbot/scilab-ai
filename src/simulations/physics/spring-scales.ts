import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SpringScalesFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("spring-scales") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let mass = 2; // kg
  let gravity = 9.81; // m/s^2
  let springConstant = 50; // N/m
  let showForces = 1;

  // Animation state for smooth spring extension
  let currentExtension = 0;
  let extensionVelocity = 0;

  function targetExtension(): number {
    // F = mg = kx => x = mg/k
    return (mass * gravity) / springConstant;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    currentExtension = targetExtension();
    extensionVelocity = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    mass = params.mass ?? 2;
    gravity = params.gravity ?? 9.81;
    springConstant = params.springConstant ?? 50;
    showForces = Math.round(params.showForces ?? 1);

    // Animate toward target extension with spring-damper
    const target = targetExtension();
    const springK = 15;
    const dampK = 8;
    const force = -springK * (currentExtension - target) - dampK * extensionVelocity;
    extensionVelocity += force * dt;
    currentExtension += extensionVelocity * dt;

    if (currentExtension < 0) {
      currentExtension = 0;
      extensionVelocity = 0;
    }

    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#080820");
    grad.addColorStop(0.5, "#0c0c2a");
    grad.addColorStop(1, "#101035");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawScaleBody(): void {
    const cx = width * 0.38;
    const topY = height * 0.06;
    const scaleW = 50;
    const scaleH = height * 0.55;

    // Hanging hook at top
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, topY, 10, Math.PI, 2 * Math.PI);
    ctx.stroke();

    // Scale housing (outer body)
    const bodyTop = topY + 10;
    const bodyH = scaleH;

    // Outer casing
    const casingGrad = ctx.createLinearGradient(cx - scaleW / 2, bodyTop, cx + scaleW / 2, bodyTop);
    casingGrad.addColorStop(0, "#555");
    casingGrad.addColorStop(0.3, "#888");
    casingGrad.addColorStop(0.7, "#888");
    casingGrad.addColorStop(1, "#555");
    ctx.fillStyle = casingGrad;
    ctx.beginPath();
    ctx.roundRect(cx - scaleW / 2, bodyTop, scaleW, bodyH, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Scale face (white area with markings)
    const faceX = cx - scaleW / 2 + 6;
    const faceW = scaleW - 12;
    const faceTop = bodyTop + 15;
    const faceH = bodyH - 30;

    ctx.fillStyle = "#f0f0e8";
    ctx.beginPath();
    ctx.roundRect(faceX, faceTop, faceW, faceH, 3);
    ctx.fill();

    // Determine max reading for the scale
    const maxForce = 10 * gravity; // max mass * gravity
    const maxReading = Math.ceil(maxForce / 10) * 10; // round up to nearest 10N

    // Draw scale markings (major + minor ticks)
    const numMajorTicks = 10;
    for (let i = 0; i <= numMajorTicks; i++) {
      const frac = i / numMajorTicks;
      const ty = faceTop + frac * faceH;
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(faceX, ty);
      ctx.lineTo(faceX + faceW * 0.4, ty);
      ctx.stroke();
      ctx.fillStyle = "#333";
      ctx.font = "bold 8px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${(frac * maxReading).toFixed(0)}`, faceX + faceW - 2, ty + 3);
      if (i < numMajorTicks) {
        for (let j = 1; j < 5; j++) {
          const my = faceTop + ((i + j / 5) / numMajorTicks) * faceH;
          ctx.strokeStyle = "#999"; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(faceX, my); ctx.lineTo(faceX + faceW * 0.2, my); ctx.stroke();
        }
      }
    }
    ctx.fillStyle = "#666"; ctx.font = "bold 7px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.fillText("(N)", faceX + faceW / 2, faceTop - 3);

    // Pointer / indicator arrow
    const currentForce = mass * gravity;
    const pointerFrac = currentForce / maxReading;
    const pointerY = faceTop + Math.min(1, pointerFrac) * faceH;

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(faceX + faceW * 0.4, pointerY);
    ctx.lineTo(faceX + faceW * 0.55, pointerY - 4);
    ctx.lineTo(faceX + faceW * 0.55, pointerY + 4);
    ctx.closePath();
    ctx.fill();

    // Pointer line
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(faceX, pointerY);
    ctx.lineTo(faceX + faceW * 0.4, pointerY);
    ctx.stroke();

  }

  function drawSpring(): void {
    const cx = width * 0.38;
    const bodyBottom = height * 0.06 + 10 + height * 0.55;
    const springTop = bodyBottom + 5;
    const scale = height * 0.15; // pixels per meter of extension
    const springLength = 30 + currentExtension * scale;
    const springBottom = springTop + springLength;

    // Draw coiled spring
    const coils = 10;
    const coilAmp = 12;

    // Tension coloring
    const maxExt = 10 * gravity / springConstant;
    const tensionRatio = Math.min(1, currentExtension / maxExt);
    const rr = Math.round(148 + tensionRatio * 107);
    const gg = Math.round(163 - tensionRatio * 80);
    const bb = Math.round(184 - tensionRatio * 130);

    ctx.strokeStyle = `rgb(${rr},${gg},${bb})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, springTop);

    const segments = coils * 8;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const py = springTop + t * springLength;
      const px = cx + Math.sin(t * coils * Math.PI * 2) * coilAmp;
      ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Connection rod to hook
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, springBottom);
    ctx.lineTo(cx, springBottom + 10);
    ctx.stroke();

    // Hook at bottom
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, springBottom + 18, 8, 0, Math.PI);
    ctx.stroke();

  }

  function drawMassObject(): void {
    const cx = width * 0.38;
    const bodyBottom = height * 0.06 + 10 + height * 0.55;
    const springTop = bodyBottom + 5;
    const scale = height * 0.15;
    const springLength = 30 + currentExtension * scale;
    const hookY = springTop + springLength + 26;

    // Mass object (weighted block)
    const blockW = 35 + mass * 3;
    const blockH = 30 + mass * 4;

    const blockGrad = ctx.createLinearGradient(
      cx - blockW / 2, hookY,
      cx + blockW / 2, hookY + blockH
    );
    blockGrad.addColorStop(0, "#6366f1");
    blockGrad.addColorStop(0.5, "#4f46e5");
    blockGrad.addColorStop(1, "#3730a3");
    ctx.fillStyle = blockGrad;
    ctx.beginPath();
    ctx.roundRect(cx - blockW / 2, hookY, blockW, blockH, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mass label
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${mass.toFixed(1)} kg`, cx, hookY + blockH / 2 + 4);

    // Force arrows
    if (showForces) {
      const weight = mass * gravity;
      const springForce = springConstant * currentExtension;
      const drawForceArrow = (ax: number, sy: number, len: number, dir: number, color: string, label: string) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(ax, sy); ctx.lineTo(ax, sy + dir * len); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax, sy + dir * len); ctx.lineTo(ax - 4, sy + dir * len - dir * 7);
        ctx.moveTo(ax, sy + dir * len); ctx.lineTo(ax + 4, sy + dir * len - dir * 7);
        ctx.stroke();
        ctx.fillStyle = color; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(label, ax + 6, sy + dir * len / 2 + 3);
      };
      drawForceArrow(cx - 10, hookY + blockH + 5, Math.min(60, weight * 0.6), 1, "#ef4444", `W = ${weight.toFixed(1)} N`);
      drawForceArrow(cx + 10, hookY - 5, Math.min(60, springForce * 0.6), -1, "#22c55e", `F_s = ${springForce.toFixed(1)} N`);
    }
  }

  function drawInfoPanel(): void {
    const panelW = Math.min(300, width * 0.42);
    const panelH = 155;
    const panelX = width - panelW - 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    const weight = mass * gravity;
    const target = targetExtension();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Spring Scale", panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(200,220,255,0.8)";
    ctx.fillText("At equilibrium: F = mg = kx", panelX + 10, panelY + 36);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Mass: ${mass.toFixed(1)} kg`, panelX + 10, panelY + 54);
    ctx.fillText(`Gravity: ${gravity.toFixed(2)} m/s\u00B2`, panelX + 10, panelY + 70);
    ctx.fillText(`Spring constant: ${springConstant.toFixed(0)} N/m`, panelX + 10, panelY + 86);

    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`Weight: W = mg = ${weight.toFixed(2)} N`, panelX + 10, panelY + 104);
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`Extension: x = mg/k = ${(target * 100).toFixed(2)} cm`, panelX + 10, panelY + 120);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`Spring force: F_s = kx = ${(springConstant * target).toFixed(2)} N`, panelX + 10, panelY + 138);
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 152);
  }

  function drawExtensionDiagram(): void {
    // Small F vs x graph
    const gx = width * 0.62;
    const gy = height * 0.65;
    const gw = width * 0.32;
    const gh = height * 0.28;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Force vs Extension (Hooke's Law)", gx + gw / 2, gy + 14);

    // Axes
    const axisLeft = gx + 35;
    const axisRight = gx + gw - 10;
    const axisTop = gy + 24;
    const axisBottom = gy + gh - 20;

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axisLeft, axisTop);
    ctx.lineTo(axisLeft, axisBottom);
    ctx.lineTo(axisRight, axisBottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Extension x (m)", (axisLeft + axisRight) / 2, axisBottom + 14);
    ctx.save(); ctx.translate(gx + 10, (axisTop + axisBottom) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("Force F (N)", 0, 0); ctx.restore();

    // Linear line F = kx and operating point
    const maxX = (10 * 20) / springConstant;
    const maxF = 10 * 20;
    const plotW = axisRight - axisLeft;
    const plotH = axisBottom - axisTop;
    ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(axisLeft, axisBottom); ctx.lineTo(axisRight, axisTop); ctx.stroke();

    const target = targetExtension();
    const dotX = axisLeft + (target / maxX) * plotW;
    const dotY = axisBottom - ((mass * gravity) / maxF) * plotH;
    ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(255,200,50,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dotX, dotY); ctx.lineTo(dotX, axisBottom);
    ctx.moveTo(dotX, dotY); ctx.lineTo(axisLeft, dotY); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(dotX, dotY, 5, 0, Math.PI * 2); ctx.fillStyle = "#f59e0b"; ctx.fill();
    ctx.fillStyle = "rgba(100,200,255,0.7)"; ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`slope = k = ${springConstant.toFixed(0)} N/m`, axisLeft + plotW * 0.4, axisTop + plotH * 0.3);
  }

  function render(): void {
    drawBackground();
    drawScaleBody();
    drawSpring();
    drawMassObject();
    drawInfoPanel();
    drawExtensionDiagram();
  }

  function reset(): void {
    time = 0;
    currentExtension = targetExtension();
    extensionVelocity = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const weight = mass * gravity;
    const ext = targetExtension();
    return (
      `Spring Scale: mass=${mass} kg, g=${gravity} m/s\u00B2, k=${springConstant} N/m. ` +
      `Weight W = mg = ${weight.toFixed(2)} N. Extension x = mg/k = ${(ext * 100).toFixed(2)} cm. ` +
      `Hooke's law: F = kx. The scale reads ${weight.toFixed(2)} N. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpringScalesFactory;
