import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HomopolarMotorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("homopolar-motor") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 3; // V
  let rpm = 100;
  let showVectors = 1;

  let wireAngle = 0; // rotation angle in radians
  let isRunning = true;

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },

    update(dt: number, params: Record<string, number>) {
      voltage = params.voltage ?? 3;
      rpm = params.rpm ?? 100;
      showVectors = params.showVectors ?? 1;

      if (isRunning) {
        const angularSpeed = (rpm / 60) * 2 * Math.PI; // rad/s
        wireAngle += angularSpeed * dt;
        wireAngle %= Math.PI * 2;
      }

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height * 0.5;

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Homopolar Motor", cx, 28);

      ctx.fillStyle = "#889";
      ctx.font = "12px monospace";
      ctx.fillText(`Voltage: ${voltage}V  |  Speed: ${rpm} RPM`, cx, 48);

      // Battery (vertical cylinder)
      const battW = 40;
      const battH = 100;
      const battX = cx - battW / 2;
      const battY = cy - battH / 2 - 30;

      // Battery body
      const battGrad = ctx.createLinearGradient(battX, battY, battX + battW, battY);
      battGrad.addColorStop(0, "#555");
      battGrad.addColorStop(0.3, "#888");
      battGrad.addColorStop(0.7, "#888");
      battGrad.addColorStop(1, "#555");
      ctx.fillStyle = battGrad;
      ctx.beginPath();
      ctx.roundRect(battX, battY, battW, battH, 4);
      ctx.fill();

      // Battery + terminal
      ctx.fillStyle = "#ccc";
      ctx.fillRect(cx - 8, battY - 8, 16, 10);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("+", cx, battY - 12);
      ctx.fillText("−", cx, battY + battH + 14);

      // Battery label
      ctx.fillStyle = "#aaa";
      ctx.font = "11px sans-serif";
      ctx.fillText(`${voltage}V`, cx, battY + battH / 2 + 4);

      // Neodymium magnet (disk at bottom)
      const magnetY = battY + battH + 5;
      const magnetR = 35;

      const magnetGrad = ctx.createRadialGradient(cx, magnetY, 0, cx, magnetY, magnetR);
      magnetGrad.addColorStop(0, "#aabbcc");
      magnetGrad.addColorStop(0.7, "#778899");
      magnetGrad.addColorStop(1, "#556677");
      ctx.fillStyle = magnetGrad;
      ctx.beginPath();
      ctx.ellipse(cx, magnetY, magnetR, magnetR * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#99aabb";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Magnet label
      ctx.fillStyle = "#334455";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("N", cx - 12, magnetY + 3);
      ctx.fillText("S", cx + 12, magnetY + 3);

      // Rotating wire
      const wireR = magnetR + 15;
      const wireStartY = battY - 5;

      ctx.save();
      ctx.translate(cx, magnetY);

      // Draw multiple wire arms
      for (let i = 0; i < 2; i++) {
        const angle = wireAngle + i * Math.PI;
        const wx = Math.cos(angle) * wireR;
        const wy = Math.sin(angle) * wireR * 0.35;

        // Wire from top of battery to magnet edge
        ctx.strokeStyle = "#dd8833";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, wireStartY - magnetY);
        ctx.quadraticCurveTo(wx * 0.5, (wireStartY - magnetY) * 0.3 + wy, wx, wy);
        ctx.stroke();

        // Wire contact point glow
        ctx.fillStyle = "rgba(255,200,100,0.6)";
        ctx.beginPath();
        ctx.arc(wx, wy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Current direction arrows on wire
        if (showVectors >= 1) {
          const midX = wx * 0.5;
          const midY = (wireStartY - magnetY) * 0.3 + wy * 0.5;
          ctx.fillStyle = "#ffcc00";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("→", midX + 5, midY);
        }
      }

      ctx.restore();

      // Vector labels
      if (showVectors >= 1) {
        const vecY = cy + 80;
        const vecSpacing = width / 4;

        // Current (I) vector
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 2;
        drawArrow(cx - vecSpacing, vecY, cx - vecSpacing + 40, vecY);
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("I (Current)", cx - vecSpacing + 20, vecY + 20);

        // Magnetic field (B) vector
        ctx.strokeStyle = "#44cc44";
        ctx.lineWidth = 2;
        drawArrow(cx, vecY, cx, vecY - 40);
        ctx.fillStyle = "#44cc44";
        ctx.fillText("B (Field)", cx, vecY + 20);

        // Force (F) vector
        ctx.strokeStyle = "#ff4444";
        ctx.lineWidth = 2;
        const fAngle = wireAngle + Math.PI / 2;
        drawArrow(cx + vecSpacing, vecY, cx + vecSpacing + Math.cos(fAngle) * 30, vecY + Math.sin(fAngle) * 30);
        ctx.fillStyle = "#ff4444";
        ctx.fillText("F (Force)", cx + vecSpacing, vecY + 20);

        // Lorentz force equation
        ctx.fillStyle = "#aabbcc";
        ctx.font = "13px monospace";
        ctx.fillText("F = I(L × B)", cx, vecY + 50);
      }

      // Magnetic field lines
      ctx.strokeStyle = "rgba(100,200,100,0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r1 = magnetR * 0.3;
        const r2 = magnetR * 1.8;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, magnetY + Math.sin(a) * r1 * 0.35);
        ctx.quadraticCurveTo(
          cx + Math.cos(a) * r2,
          magnetY + Math.sin(a) * r2 * 0.35 - 30,
          cx + Math.cos(a) * r1,
          magnetY - 60
        );
        ctx.stroke();
      }

      // Rotation indicator
      ctx.strokeStyle = "rgba(255,200,100,0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, magnetY, wireR + 5, (wireR + 5) * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotation arrow
      const arrowAngle = wireAngle + 0.3;
      const arrowX = cx + Math.cos(arrowAngle) * (wireR + 5);
      const arrowY = magnetY + Math.sin(arrowAngle) * (wireR + 5) * 0.35;
      ctx.fillStyle = "rgba(255,200,100,0.6)";
      ctx.beginPath();
      ctx.arc(arrowX, arrowY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Bottom info
      ctx.fillStyle = "#556";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("The Lorentz force on current-carrying wire in a magnetic field causes rotation", cx, height - 12);
    },

    reset() {
      time = 0;
      wireAngle = 0;
    },

    destroy() {},

    getStateDescription() {
      const angularSpeed = (rpm / 60) * 2 * Math.PI;
      return `Homopolar motor: ${voltage}V battery, ${rpm} RPM (ω=${angularSpeed.toFixed(1)} rad/s). Wire angle=${(wireAngle * 180 / Math.PI).toFixed(0)}°. F=I(L×B): Current in magnetic field creates Lorentz force causing rotation.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawArrow(x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const nx = dx / len;
    const ny = dy / len;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    const headLen = 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * nx + headLen * 0.4 * ny, y2 - headLen * ny - headLen * 0.4 * nx);
    ctx.lineTo(x2 - headLen * nx - headLen * 0.4 * ny, y2 - headLen * ny + headLen * 0.4 * nx);
    ctx.closePath();
    ctx.fill();
  }

  return engine;
};

export default HomopolarMotorFactory;
