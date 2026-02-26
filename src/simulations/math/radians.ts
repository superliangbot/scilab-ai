import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RadiansFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("radians") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let angleValue = 180;
  let showArc = 1;
  let showRadius = 1;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    angleValue = params.angleValue ?? 180;
    showArc = params.showArc ?? 1;
    showRadius = params.showRadius ?? 1;
    time += dt;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const angleRad = (angleValue * Math.PI) / 180;
    const circleR = Math.min(width, height) * 0.25;
    const cx = width * 0.35;
    const cy = height * 0.48;

    // Draw unit circle
    ctx.beginPath();
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - circleR - 20, cy);
    ctx.lineTo(cx + circleR + 20, cy);
    ctx.moveTo(cx, cy - circleR - 20);
    ctx.lineTo(cx, cy + circleR + 20);
    ctx.stroke();

    // Angle arc fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, circleR, 0, -angleRad, true);
    ctx.closePath();
    ctx.fillStyle = "rgba(100, 150, 255, 0.15)";
    ctx.fill();

    // Angle arc on circle (highlighted)
    if (showArc) {
      ctx.beginPath();
      ctx.arc(cx, cy, circleR, 0, -angleRad, true);
      ctx.strokeStyle = "rgba(255, 200, 100, 0.9)";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Arc length label
      const arcLength = angleRad * circleR;
      const midAngle = -angleRad / 2;
      const labelR = circleR + 18;
      ctx.fillStyle = "rgba(255, 200, 100, 0.9)";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `arc = ${angleRad.toFixed(2)}r`,
        cx + Math.cos(midAngle) * labelR,
        cy + Math.sin(midAngle) * labelR
      );
    }

    // Radius line to angle point
    const endX = cx + circleR * Math.cos(-angleRad);
    const endY = cy + circleR * Math.sin(-angleRad);

    if (showRadius) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = "rgba(100, 200, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Starting radius (along positive x)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + circleR, cy);
      ctx.strokeStyle = "rgba(100, 255, 100, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Radius label
      ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("r", cx + circleR * Math.cos(-angleRad) / 2 - 10, cy + circleR * Math.sin(-angleRad) / 2 - 5);
    }

    // Endpoint dot
    ctx.beginPath();
    ctx.arc(endX, endY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100, 200, 255, 0.9)";
    ctx.fill();

    // Angle arc indicator (small arc near center)
    const arcR = 30;
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, 0, -angleRad, true);
    ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Angle value near arc
    const labelAngle = -angleRad / 2;
    ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `${angleValue.toFixed(0)}°`,
      cx + Math.cos(labelAngle) * (arcR + 16),
      cy + Math.sin(labelAngle) * (arcR + 16)
    );

    // Degree markers around circle
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = -(deg * Math.PI) / 180;
      const isMain = deg % 90 === 0;
      const inner = circleR - (isMain ? 8 : 4);
      const outer = circleR + 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
      ctx.lineTo(cx + Math.cos(rad) * outer, cy + Math.sin(rad) * outer);
      ctx.strokeStyle = `rgba(255, 255, 255, ${isMain ? 0.4 : 0.2})`;
      ctx.lineWidth = isMain ? 1.5 : 0.8;
      ctx.stroke();

      if (isMain) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${deg}°`, cx + Math.cos(rad) * (circleR + 15), cy + Math.sin(rad) * (circleR + 15) + 3);
      }
    }

    // Radian line: unwrap radius along arc
    // Show the concept: 1 radian = arc length = radius
    const oneRadX = cx + circleR * Math.cos(-1);
    const oneRadY = cy + circleR * Math.sin(-1);
    if (showArc) {
      ctx.beginPath();
      ctx.arc(cx, cy, circleR, 0, -1, true);
      ctx.strokeStyle = "rgba(100, 255, 200, 0.4)";
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(oneRadX, oneRadY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100, 255, 200, 0.6)";
      ctx.fill();

      ctx.fillStyle = "rgba(100, 255, 200, 0.6)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("1 rad", oneRadX + 10, oneRadY - 8);
    }

    // Info panel on right
    const panelX = width * 0.6;
    const panelY = height * 0.08;
    const panelW = width * 0.37;
    const panelH = height * 0.84;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let py = panelY + 25;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Degrees \u2194 Radians", panelX + panelW / 2, py);
    py += 35;

    // Conversion values
    const conversions = [
      { label: "Angle", value: `${angleValue.toFixed(1)}°`, color: "#ff6666" },
      { label: "Radians", value: `${angleRad.toFixed(4)} rad`, color: "#6699ff" },
      { label: "Fraction of \u03C0", value: `${(angleRad / Math.PI).toFixed(4)}\u03C0`, color: "#66ccff" },
      { label: "Turns", value: `${(angleValue / 360).toFixed(4)}`, color: "#aaccff" },
      { label: "Arc length (r=1)", value: `${angleRad.toFixed(4)}`, color: "#ffcc66" },
      { label: "sin(\u03B8)", value: `${Math.sin(angleRad).toFixed(4)}`, color: "#ff88aa" },
      { label: "cos(\u03B8)", value: `${Math.cos(angleRad).toFixed(4)}`, color: "#88ffaa" },
    ];

    ctx.font = "12px system-ui, sans-serif";
    for (const item of conversions) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.textAlign = "left";
      ctx.fillText(item.label, panelX + 12, py);
      ctx.fillStyle = item.color;
      ctx.font = "bold 13px 'SF Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(item.value, panelX + panelW - 12, py);
      ctx.font = "12px system-ui, sans-serif";
      py += 26;
    }

    py += 10;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(panelX + 10, py);
    ctx.lineTo(panelX + panelW - 10, py);
    ctx.stroke();
    py += 15;

    // Common angles reference
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Common Angles:", panelX + 12, py);
    py += 20;

    const commonAngles = [
      { deg: 30, rad: "\u03C0/6" },
      { deg: 45, rad: "\u03C0/4" },
      { deg: 60, rad: "\u03C0/3" },
      { deg: 90, rad: "\u03C0/2" },
      { deg: 180, rad: "\u03C0" },
      { deg: 270, rad: "3\u03C0/2" },
      { deg: 360, rad: "2\u03C0" },
    ];

    ctx.font = "11px 'SF Mono', monospace";
    for (const a of commonAngles) {
      const isActive = Math.abs(angleValue - a.deg) < 1;
      ctx.fillStyle = isActive ? "rgba(255, 200, 100, 0.9)" : "rgba(200, 200, 200, 0.5)";
      ctx.textAlign = "left";
      ctx.fillText(`${a.deg}°`, panelX + 12, py);
      ctx.textAlign = "center";
      ctx.fillText("=", panelX + panelW * 0.4, py);
      ctx.textAlign = "right";
      ctx.fillText(`${a.rad} rad`, panelX + panelW - 12, py);
      py += 18;
    }

    // Formula
    py += 10;
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.font = "bold 12px 'SF Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("rad = deg \u00D7 \u03C0/180", panelX + panelW / 2, py);
    py += 16;
    ctx.fillText("deg = rad \u00D7 180/\u03C0", panelX + panelW / 2, py);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const angleRad = (angleValue * Math.PI) / 180;
    return (
      `Radians visualization: ${angleValue}° = ${angleRad.toFixed(4)} rad = ${(angleRad / Math.PI).toFixed(4)}π. ` +
      `A radian is the angle where arc length equals radius. ` +
      `sin(θ) = ${Math.sin(angleRad).toFixed(4)}, cos(θ) = ${Math.cos(angleRad).toFixed(4)}. ` +
      `Full circle = 360° = 2π rad ≈ 6.2832 rad. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RadiansFactory;
