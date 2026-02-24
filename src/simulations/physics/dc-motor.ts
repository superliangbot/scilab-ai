import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DCMotorFactory = (): SimulationEngine => {
  const config = getSimConfig("dc-motor") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;

  let time = 0;
  let angle = 0; // coil rotation angle in radians
  let angularVelocity = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    const voltage = params.voltage ?? 12;
    const fieldStrength = params.fieldStrength ?? 0.5;
    const coilTurns = params.coilTurns ?? 10;
    const showVectors = params.showVectors ?? 1;

    // Torque on coil: τ = nBIA sin(angle)
    // Simplified: torque depends on sin(angle), commutator reverses at π
    const current = voltage / 5; // simplified resistance
    const torqueMax = coilTurns * fieldStrength * current * 0.01;

    // Commutator reverses current every half rotation
    const effectiveAngle = angle % (2 * Math.PI);
    const commutatorFactor = effectiveAngle < Math.PI ? 1 : -1;
    const torque = torqueMax * Math.sin(angle) * commutatorFactor;

    // With friction
    const friction = 0.02;
    angularVelocity += (torque - friction * angularVelocity) * dt * 60;
    angle += angularVelocity * dt;
    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.5;
    const motorRadius = Math.min(width, height) * 0.25;

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("DC Motor", cx, 30);

    // Draw magnets
    const magnetW = motorRadius * 0.3;
    const magnetH = motorRadius * 1.6;

    // North magnet (left)
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(cx - motorRadius - magnetW - 10, cy - magnetH / 2, magnetW, magnetH);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("N", cx - motorRadius - magnetW / 2 - 10, cy + 6);

    // South magnet (right)
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(cx + motorRadius + 10, cy - magnetH / 2, magnetW, magnetH);
    ctx.fillStyle = "#fff";
    ctx.fillText("S", cx + motorRadius + magnetW / 2 + 10, cy + 6);

    // Draw magnetic field lines (horizontal dashed)
    ctx.strokeStyle = "#22c55e44";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    for (let i = -3; i <= 3; i++) {
      const y = cy + i * (magnetH / 8);
      ctx.beginPath();
      ctx.moveTo(cx - motorRadius - 10, y);
      ctx.lineTo(cx + motorRadius + 10, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw commutator ring
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy + motorRadius + 20, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Draw split commutator segments
    const commAngle = angle % (2 * Math.PI);
    ctx.save();
    ctx.translate(cx, cy + motorRadius + 20);
    ctx.rotate(angle);
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.arc(0, 0, 10, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Brushes
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(cx - 25, cy + motorRadius + 35, 10, 15);
    ctx.fillRect(cx + 15, cy + motorRadius + 35, 10, 15);

    // Battery connection wires
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + motorRadius + 50);
    ctx.lineTo(cx - 50, cy + motorRadius + 70);
    ctx.lineTo(cx - 50, cy + motorRadius + 90);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 20, cy + motorRadius + 50);
    ctx.lineTo(cx + 50, cy + motorRadius + 70);
    ctx.lineTo(cx + 50, cy + motorRadius + 90);
    ctx.stroke();

    // Battery
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    // Positive terminal
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + motorRadius + 90);
    ctx.lineTo(cx - 20, cy + motorRadius + 100);
    ctx.stroke();
    ctx.lineWidth = 1;
    // Negative terminal
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy + motorRadius + 90);
    ctx.lineTo(cx + 10, cy + motorRadius + 100);
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(10, width * 0.015)}px sans-serif`;
    ctx.fillText("+", cx - 20, cy + motorRadius + 115);
    ctx.fillText("−", cx + 10, cy + motorRadius + 115);

    // Draw rotating coil
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Coil rectangle
    const coilW = motorRadius * 0.6;
    const coilH = motorRadius * 1.4;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 4;
    ctx.strokeRect(-coilW / 2, -coilH / 2, coilW, coilH);

    // Current direction arrows on coil sides
    const arrowSize = 8;
    // Left side - current going up or down based on commutator
    const dir = commAngle < Math.PI ? 1 : -1;

    ctx.fillStyle = "#38bdf8";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;

    // Left side arrow
    const leftX = -coilW / 2;
    ctx.beginPath();
    ctx.moveTo(leftX, dir > 0 ? coilH * 0.2 : -coilH * 0.2);
    ctx.lineTo(leftX, dir > 0 ? -coilH * 0.2 : coilH * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(leftX, dir > 0 ? -coilH * 0.2 : coilH * 0.2);
    ctx.lineTo(leftX - arrowSize * 0.5, dir > 0 ? -coilH * 0.2 + arrowSize * dir : coilH * 0.2 - arrowSize * dir);
    ctx.lineTo(leftX + arrowSize * 0.5, dir > 0 ? -coilH * 0.2 + arrowSize * dir : coilH * 0.2 - arrowSize * dir);
    ctx.closePath();
    ctx.fill();

    // Right side arrow (opposite direction)
    const rightX = coilW / 2;
    ctx.beginPath();
    ctx.moveTo(rightX, dir > 0 ? -coilH * 0.2 : coilH * 0.2);
    ctx.lineTo(rightX, dir > 0 ? coilH * 0.2 : -coilH * 0.2);
    ctx.stroke();

    // Force vectors (red arrows)
    if (config.parameters.find(p => p.key === "showVectors")?.defaultValue !== 0) {
      const forceMag = Math.sin(angle) * 40;
      // Force on left side (perpendicular to current and B field)
      ctx.strokeStyle = "#ef4444";
      ctx.fillStyle = "#ef4444";
      ctx.lineWidth = 3;

      // Left force (horizontal)
      if (Math.abs(forceMag) > 2) {
        ctx.beginPath();
        ctx.moveTo(leftX, 0);
        ctx.lineTo(leftX - forceMag * dir, 0);
        ctx.stroke();

        // Right force (opposite)
        ctx.beginPath();
        ctx.moveTo(rightX, 0);
        ctx.lineTo(rightX + forceMag * dir, 0);
        ctx.stroke();
      }
    }

    // Rotation axis dot
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Torque indicator arc
    const torqueDisplay = Math.sin(angle) * (commAngle < Math.PI ? 1 : -1);
    if (Math.abs(torqueDisplay) > 0.05) {
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const arcR = motorRadius * 0.5;
      const startA = -Math.PI / 4;
      const endA = startA + torqueDisplay * Math.PI / 2;
      ctx.arc(cx, cy, arcR, Math.min(startA, endA), Math.max(startA, endA));
      ctx.stroke();
      // Arrow at end
      const tipAngle = endA;
      const tipX = cx + arcR * Math.cos(tipAngle);
      const tipY = cy + arcR * Math.sin(tipAngle);
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Info panel
    const rpm = Math.abs(angularVelocity) * 60 / (2 * Math.PI);
    const panelX = 15;
    const panelY = 50;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, 180, 100);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 180, 100);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(12, width * 0.016)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`RPM: ${rpm.toFixed(1)}`, panelX + 10, panelY + 22);
    ctx.fillText(`Angle: ${((angle * 180 / Math.PI) % 360).toFixed(0)}°`, panelX + 10, panelY + 44);
    ctx.fillText(`ω: ${angularVelocity.toFixed(2)} rad/s`, panelX + 10, panelY + 66);
    ctx.fillText(`Torque: ${torqueDisplay.toFixed(3)} N·m`, panelX + 10, panelY + 88);

    // Legend
    const legX = width - 170;
    const legY = 50;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(legX, legY, 155, 85);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(legX, legY, 155, 85);

    ctx.font = `${Math.max(11, width * 0.014)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#f97316";
    ctx.fillText("— Coil", legX + 10, legY + 20);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("— Current (I)", legX + 10, legY + 40);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("— Force (F)", legX + 10, legY + 60);
    ctx.fillStyle = "#a855f7";
    ctx.fillText("— Torque (τ)", legX + 10, legY + 80);
  }

  function reset(): void {
    time = 0;
    angle = 0;
    angularVelocity = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const rpm = Math.abs(angularVelocity) * 60 / (2 * Math.PI);
    const degrees = ((angle * 180 / Math.PI) % 360).toFixed(0);
    return `DC Motor simulation: The coil is at ${degrees}° rotating at ${rpm.toFixed(1)} RPM with angular velocity ${angularVelocity.toFixed(2)} rad/s. A DC motor works by passing current through a coil in a magnetic field, creating a Lorentz force (F = IL×B) that produces torque. The commutator reverses current direction every half-turn to maintain continuous rotation.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DCMotorFactory;
