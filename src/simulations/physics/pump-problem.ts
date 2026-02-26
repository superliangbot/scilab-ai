import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PumpProblemFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pump-problem") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let pumpHeight = 5;
  let pipeDiameter = 5;
  let flowRate = 10;
  let fluidDensity = 1000;

  const particles: { x: number; y: number; speed: number }[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    particles.length = 0;
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 0.5 + Math.random() * 1.5,
      });
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    pumpHeight = params.pumpHeight ?? 5;
    pipeDiameter = params.pipeDiameter ?? 5;
    flowRate = params.flowRate ?? 10;
    fluidDensity = params.fluidDensity ?? 1000;
    time += dt;

    // Update particles along the pipe path
    for (const p of particles) {
      p.y -= p.speed * flowRate * 0.1 * dt * 60;
      if (p.y < 0) {
        p.y = height;
        p.x = width * 0.35 + Math.random() * width * 0.1;
      }
    }
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a1a2a");
    bgGrad.addColorStop(1, "#0a2a1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const g = 9.81;
    const pipeArea = Math.PI * Math.pow(pipeDiameter / 200, 2); // m²
    const Q = flowRate / 1000; // m³/s
    const velocity = Q / pipeArea;
    const pressureHead = fluidDensity * g * pumpHeight;
    const velocityHead = 0.5 * fluidDensity * velocity * velocity;
    const totalPower = (pressureHead + velocityHead) * Q;
    const frictionLoss = 0.02 * (pumpHeight / (pipeDiameter / 100)) * fluidDensity * velocity * velocity / 2;

    // Ground/water level
    const groundY = height * 0.75;
    const waterY = height * 0.78;
    const topY = height * 0.15;
    const pipeScale = Math.min(pumpHeight / 15, 1);
    const pipeTopY = groundY - (groundY - topY) * pipeScale;

    // Underground water
    ctx.fillStyle = "rgba(30, 80, 150, 0.3)";
    ctx.fillRect(0, waterY, width * 0.6, height - waterY);

    // Ground
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.strokeStyle = "rgba(100, 80, 60, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Ground texture
    for (let i = 0; i < 30; i++) {
      const gx = (i * 37 + 10) % width;
      const gy = groundY + 5 + ((i * 23) % (height - groundY - 10));
      ctx.fillStyle = `rgba(80, 60, 40, ${0.3 + Math.random() * 0.2})`;
      ctx.fillRect(gx, gy, 3 + Math.random() * 6, 2);
    }

    // Pipe
    const pipeW = pipeDiameter * 1.5;
    const pipeX = width * 0.35;

    // Vertical pipe
    ctx.fillStyle = "rgba(120, 120, 140, 0.8)";
    ctx.fillRect(pipeX - pipeW / 2, pipeTopY, pipeW, groundY - pipeTopY + 30);
    ctx.strokeStyle = "rgba(180, 180, 200, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pipeX - pipeW / 2, pipeTopY, pipeW, groundY - pipeTopY + 30);

    // Pipe highlight
    ctx.fillStyle = "rgba(200, 200, 220, 0.15)";
    ctx.fillRect(pipeX - pipeW / 2 + 2, pipeTopY, pipeW * 0.3, groundY - pipeTopY + 30);

    // Water inside pipe
    ctx.fillStyle = "rgba(40, 120, 200, 0.5)";
    ctx.fillRect(pipeX - pipeW / 2 + 3, pipeTopY + 5, pipeW - 6, groundY - pipeTopY + 20);

    // Flow particles
    for (const p of particles) {
      const inPipeX = p.x > pipeX - pipeW / 2 && p.x < pipeX + pipeW / 2;
      if (inPipeX && p.y > pipeTopY && p.y < groundY + 30) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 180, 255, 0.6)";
        ctx.fill();
      }
    }

    // Pump body at bottom
    const pumpY = groundY - 15;
    const pumpW = 50;
    const pumpH = 30;
    ctx.fillStyle = "#cc6633";
    ctx.beginPath();
    ctx.roundRect(pipeX - pumpW / 2, pumpY, pumpW, pumpH, 5);
    ctx.fill();
    ctx.strokeStyle = "#aa4411";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pump motor indicator
    const motorAngle = time * 5 * flowRate * 0.2;
    ctx.save();
    ctx.translate(pipeX, pumpY + pumpH / 2);
    ctx.rotate(motorAngle);
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(8 * Math.cos((i * Math.PI) / 2), 8 * Math.sin((i * Math.PI) / 2));
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PUMP", pipeX, pumpY + pumpH / 2 + 4);

    // Output pipe (horizontal at top)
    ctx.fillStyle = "rgba(120, 120, 140, 0.8)";
    ctx.fillRect(pipeX + pipeW / 2 - 2, pipeTopY, width * 0.25, pipeW);
    ctx.strokeStyle = "rgba(180, 180, 200, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pipeX + pipeW / 2 - 2, pipeTopY, width * 0.25, pipeW);

    // Water output
    const outEndX = pipeX + pipeW / 2 + width * 0.25;
    ctx.fillStyle = "rgba(40, 120, 200, 0.6)";
    for (let i = 0; i < 5; i++) {
      const dropX = outEndX + 5 + ((time * 40 * flowRate * 0.1 + i * 15) % 60);
      const dropY = pipeTopY + pipeW / 2 + ((time * 20 + i * 5) % 40);
      ctx.beginPath();
      ctx.arc(dropX, dropY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Height dimension
    ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pipeX + 50, groundY);
    ctx.lineTo(pipeX + 50, pipeTopY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow heads
    ctx.beginPath();
    ctx.moveTo(pipeX + 50, pipeTopY);
    ctx.lineTo(pipeX + 46, pipeTopY + 7);
    ctx.moveTo(pipeX + 50, pipeTopY);
    ctx.lineTo(pipeX + 54, pipeTopY + 7);
    ctx.moveTo(pipeX + 50, groundY);
    ctx.lineTo(pipeX + 46, groundY - 7);
    ctx.moveTo(pipeX + 50, groundY);
    ctx.lineTo(pipeX + 54, groundY - 7);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.7)";
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`h = ${pumpHeight.toFixed(1)} m`, pipeX + 58, (groundY + pipeTopY) / 2 + 4);

    // Info panel
    const panelX = width * 0.6;
    const panelY = height * 0.05;
    const panelW = width * 0.37;
    const panelH = height * 0.6;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let py = panelY + 25;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pump Calculations", panelX + panelW / 2, py);
    py += 30;

    const data = [
      ["Pump Height (h)", `${pumpHeight.toFixed(1)} m`],
      ["Pipe Diameter", `${pipeDiameter.toFixed(0)} cm`],
      ["Flow Rate (Q)", `${flowRate.toFixed(1)} L/s`],
      ["Fluid Density (ρ)", `${fluidDensity.toFixed(0)} kg/m³`],
      ["", ""],
      ["Pipe Area (A)", `${(pipeArea * 10000).toFixed(2)} cm²`],
      ["Flow Velocity (v)", `${velocity.toFixed(2)} m/s`],
      ["Pressure Head", `${(pressureHead / 1000).toFixed(1)} kPa`],
      ["Velocity Head", `${(velocityHead / 1000).toFixed(2)} kPa`],
      ["Friction Loss", `${(frictionLoss / 1000).toFixed(2)} kPa`],
      ["Pump Power", `${totalPower.toFixed(1)} W`],
    ];

    ctx.font = "11px system-ui, sans-serif";
    for (const [label, value] of data) {
      if (label === "") {
        py += 5;
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(panelX + 10, py);
        ctx.lineTo(panelX + panelW - 10, py);
        ctx.stroke();
        py += 10;
        continue;
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.textAlign = "left";
      ctx.fillText(label, panelX + 10, py);
      ctx.fillStyle = "rgba(180, 220, 255, 0.9)";
      ctx.textAlign = "right";
      ctx.fillText(value, panelX + panelW - 10, py);
      py += 20;
    }

    // Formula
    py += 10;
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.font = "bold 11px 'SF Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("P = ρgh·Q + ½ρv²·Q", panelX + 10, py);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pump Problem — Fluid Power Calculation", width / 2, height - 15);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    particles.length = 0;
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: width * 0.35 + Math.random() * 20 - 10,
        y: Math.random() * height,
        speed: 0.5 + Math.random() * 1.5,
      });
    }
  }

  function destroy(): void { particles.length = 0; }

  function getStateDescription(): string {
    const g = 9.81;
    const pipeArea = Math.PI * Math.pow(pipeDiameter / 200, 2);
    const Q = flowRate / 1000;
    const velocity = Q / pipeArea;
    const totalPower = (fluidDensity * g * pumpHeight + 0.5 * fluidDensity * velocity * velocity) * Q;
    return (
      `Pump problem: height = ${pumpHeight} m, pipe diameter = ${pipeDiameter} cm, ` +
      `flow rate = ${flowRate} L/s, fluid density = ${fluidDensity} kg/m³. ` +
      `Flow velocity = ${velocity.toFixed(2)} m/s. Pump power ≈ ${totalPower.toFixed(1)} W. ` +
      `Uses Bernoulli's equation P = ρghQ + ½ρv²Q. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PumpProblemFactory;
