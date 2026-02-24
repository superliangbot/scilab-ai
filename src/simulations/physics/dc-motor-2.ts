import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DCMotor2Factory = (): SimulationEngine => {
  const config = getSimConfig("dc-motor-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;

  let time = 0;
  let angle = 0;
  let angularVelocity = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    const voltage = params.voltage ?? 12;
    const resistance = params.resistance ?? 5;
    const fieldStrength = params.fieldStrength ?? 0.5;
    const numLoops = params.numLoops ?? 1;

    const current = voltage / resistance;
    // Torque: τ = nBIA * sin(θ) with commutator correction
    const area = 0.04; // coil area in m²
    const torqueMax = numLoops * fieldStrength * current * area;

    // Commutator ensures torque always pushes in one direction
    const effectiveAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const sinComponent = Math.abs(Math.sin(effectiveAngle));
    const torque = torqueMax * sinComponent;

    const friction = 0.15;
    const backEMF = 0.01 * angularVelocity;
    angularVelocity += (torque - friction * angularVelocity - backEMF) * dt * 20;
    angle += angularVelocity * dt;
    time += dt;
  }

  function drawCrossSection(cx: number, cy: number, radius: number): void {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Draw stator (outer ring)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
    ctx.stroke();

    // Magnet poles
    const poleW = radius * 0.2;
    const poleH = radius * 0.7;

    // North pole (left)
    ctx.fillStyle = "#ef4444";
    const nlx = cx - radius * 1.15;
    ctx.beginPath();
    ctx.moveTo(nlx, cy - poleH / 2);
    ctx.lineTo(nlx + poleW, cy - poleH / 2);
    ctx.arc(nlx + poleW, cy, poleH / 2, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(nlx, cy + poleH / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(14, radius * 0.18)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("N", nlx + poleW * 0.3, cy + 5);

    // South pole (right)
    ctx.fillStyle = "#3b82f6";
    const nrx = cx + radius * 1.15;
    ctx.beginPath();
    ctx.moveTo(nrx, cy - poleH / 2);
    ctx.lineTo(nrx - poleW, cy - poleH / 2);
    ctx.arc(nrx - poleW, cy, poleH / 2, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(nrx, cy + poleH / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.fillText("S", nrx - poleW * 0.3, cy + 5);

    // Rotor (inner circle)
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Coil cross-section: two circles showing current in/out
    const coilDist = radius * 0.6;
    const coilR = radius * 0.12;

    // Position 1 (current going into page ⊗)
    const x1 = cx + coilDist * cosA;
    const y1 = cy + coilDist * sinA;

    // Position 2 (current coming out ⊙)
    const x2 = cx - coilDist * cosA;
    const y2 = cy - coilDist * sinA;

    // Conductor 1 (into page)
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(x1, y1, coilR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Cross symbol (into page)
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 - coilR * 0.6, y1 - coilR * 0.6);
    ctx.lineTo(x1 + coilR * 0.6, y1 + coilR * 0.6);
    ctx.moveTo(x1 + coilR * 0.6, y1 - coilR * 0.6);
    ctx.lineTo(x1 - coilR * 0.6, y1 + coilR * 0.6);
    ctx.stroke();

    // Conductor 2 (out of page)
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(x2, y2, coilR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Dot symbol (out of page)
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x2, y2, coilR * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Coil connecting lines
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Force vectors
    const forceMag = radius * 0.35 * Math.abs(Math.sin(angle));
    if (forceMag > 3) {
      // Force on conductor 1: F = IL × B (perpendicular to B and I)
      const fx1 = -sinA * forceMag;
      const fy1 = cosA * forceMag;

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + fx1, y1 + fy1);
      ctx.stroke();
      drawArrowhead(x1 + fx1, y1 + fy1, Math.atan2(fy1, fx1), "#ef4444");

      // Force on conductor 2 (opposite)
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - fx1, y2 - fy1);
      ctx.stroke();
      drawArrowhead(x2 - fx1, y2 - fy1, Math.atan2(-fy1, -fx1), "#ef4444");
    }

    // Axis dot
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawArrowhead(x: number, y: number, a: number, color: string): void {
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -5);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.45;
    const radius = Math.min(width, height) * 0.2;

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("DC Motor — Cross Section View", cx, 30);

    drawCrossSection(cx, cy, radius);

    // Magnetic field direction arrow
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - radius * 1.5, cy);
    ctx.lineTo(cx + radius * 1.5, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowhead(cx + radius * 1.5, cy, 0, "#22c55e");
    ctx.fillStyle = "#22c55e";
    ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("B", cx, cy - radius * 1.25);

    // Torque graph (bottom area)
    const graphX = width * 0.1;
    const graphW = width * 0.8;
    const graphY = height * 0.72;
    const graphH = height * 0.2;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    // Graph axes
    ctx.strokeStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH / 2);
    ctx.lineTo(graphX + graphW, graphY + graphH / 2);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Torque vs Angle", graphX + 5, graphY + 15);

    // Draw torque curve
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= graphW; i++) {
      const theta = (i / graphW) * 4 * Math.PI;
      const t = Math.abs(Math.sin(theta));
      const y = graphY + graphH / 2 - t * (graphH / 2 - 5);
      if (i === 0) ctx.moveTo(graphX + i, y);
      else ctx.lineTo(graphX + i, y);
    }
    ctx.stroke();

    // Current position marker on graph
    const normalizedAngle = ((angle % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);
    const markerX = graphX + (normalizedAngle / (4 * Math.PI)) * graphW;
    const markerTorque = Math.abs(Math.sin(angle));
    const markerY = graphY + graphH / 2 - markerTorque * (graphH / 2 - 5);

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Info panel
    const rpm = Math.abs(angularVelocity) * 60 / (2 * Math.PI);
    const panelX = 15;
    const panelY = 50;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, 200, 80);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(panelX, panelY, 200, 80);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(12, width * 0.015)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`RPM: ${rpm.toFixed(1)}`, panelX + 10, panelY + 22);
    ctx.fillText(`ω: ${angularVelocity.toFixed(2)} rad/s`, panelX + 10, panelY + 44);
    ctx.fillText(`|τ|: ${markerTorque.toFixed(3)} (norm)`, panelX + 10, panelY + 66);
  }

  function reset(): void {
    time = 0;
    angle = 0;
    angularVelocity = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const rpm = Math.abs(angularVelocity) * 60 / (2 * Math.PI);
    return `DC Motor cross-section view: Rotor at ${((angle * 180 / Math.PI) % 360).toFixed(0)}° rotating at ${rpm.toFixed(1)} RPM. This view shows the coil conductors in cross-section within the magnetic field. Current directions are marked (⊗ into page, ⊙ out of page). The Lorentz force (F = IL×B) on each conductor creates torque. The commutator ensures torque is always in the same rotational direction by reversing current each half-turn. The torque graph shows |sin(θ)| shape due to the commutator.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DCMotor2Factory;
