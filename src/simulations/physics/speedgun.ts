import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SpeedgunFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("speedgun") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physics
  const c = 3e8; // speed of light (m/s)

  // Parameters
  let carSpeed = 80; // km/h
  let radarFrequency = 5; // GHz
  let direction = 0; // 0=approaching, 1=receding
  let showWaves = 1;

  // Animation state
  let carX = 0;
  let waveFronts: { x: number; radius: number; emitted: boolean }[] = [];
  let waveTimer = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    resetCar();
  }

  function resetCar(): void {
    if (direction === 0) {
      carX = width * 0.85;
    } else {
      carX = width * 0.25;
    }
    waveFronts = [];
    waveTimer = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const prevDir = direction;
    carSpeed = params.carSpeed ?? 80;
    radarFrequency = params.radarFrequency ?? 5;
    direction = Math.round(params.direction ?? 0);
    showWaves = Math.round(params.showWaves ?? 1);

    if (prevDir !== direction) resetCar();

    // Move car across screen
    const pixelSpeed = (carSpeed / 200) * width * 0.3; // scale speed to canvas
    if (direction === 0) {
      carX -= pixelSpeed * dt;
      if (carX < width * 0.2) carX = width * 0.85;
    } else {
      carX += pixelSpeed * dt;
      if (carX > width * 0.85) carX = width * 0.25;
    }

    // Emit wave fronts from radar gun
    waveTimer += dt;
    const waveInterval = 0.15;
    if (waveTimer >= waveInterval && showWaves) {
      waveTimer -= waveInterval;
      const gunX = width * 0.1;
      const gunY = height * 0.48;
      waveFronts.push({ x: gunX, radius: 0, emitted: true });
    }

    // Update wave fronts
    const waveSpeed = width * 0.8; // visual wave propagation speed
    for (const wf of waveFronts) {
      wf.radius += waveSpeed * dt;
    }

    // Create reflected waves when a front reaches the car
    const newReflections: typeof waveFronts = [];
    for (const wf of waveFronts) {
      if (wf.emitted && wf.radius >= Math.abs(carX - width * 0.1) - 20) {
        if (wf.radius < Math.abs(carX - width * 0.1) + 20) {
          newReflections.push({ x: carX, radius: 0, emitted: false });
        }
      }
    }
    waveFronts.push(...newReflections);

    // Remove old wave fronts
    waveFronts = waveFronts.filter((wf) => wf.radius < width * 1.5);

    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0a0f1e");
    grad.addColorStop(0.4, "#111827");
    grad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawRoad(): void {
    const roadY = height * 0.55;
    const roadH = height * 0.18;

    // Road surface
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, roadY, width, roadH);

    // Road edges
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, roadY);
    ctx.lineTo(width, roadY);
    ctx.moveTo(0, roadY + roadH);
    ctx.lineTo(width, roadY + roadH);
    ctx.stroke();

    // Dashed center line
    ctx.setLineDash([20, 15]);
    ctx.strokeStyle = "#f0c040";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, roadY + roadH / 2);
    ctx.lineTo(width, roadY + roadH / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ground below road
    ctx.fillStyle = "#1a3a1a";
    ctx.fillRect(0, roadY + roadH, width, height - roadY - roadH);
  }

  function drawRadarGun(): void {
    const gunX = width * 0.1;
    const gunY = height * 0.48;

    // Tripod legs
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gunX, gunY + 10);
    ctx.lineTo(gunX - 15, height * 0.55);
    ctx.moveTo(gunX, gunY + 10);
    ctx.lineTo(gunX + 15, height * 0.55);
    ctx.moveTo(gunX, gunY + 10);
    ctx.lineTo(gunX, height * 0.55);
    ctx.stroke();

    // Gun body
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.roundRect(gunX - 12, gunY - 10, 30, 20, 4);
    ctx.fill();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Emitter cone
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.moveTo(gunX + 18, gunY - 8);
    ctx.lineTo(gunX + 30, gunY - 14);
    ctx.lineTo(gunX + 30, gunY + 14);
    ctx.lineTo(gunX + 18, gunY + 8);
    ctx.closePath();
    ctx.fill();

    // Pulsing glow
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    ctx.beginPath();
    ctx.arc(gunX + 30, gunY, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(37, 99, 235, ${0.3 + 0.4 * pulse})`;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RADAR", gunX + 8, gunY - 18);
  }

  function drawCar(): void {
    const roadY = height * 0.55;
    const carW = 60;
    const carH = 25;
    const carTop = roadY + 5;

    // Car body
    const bodyGrad = ctx.createLinearGradient(carX - carW / 2, carTop, carX - carW / 2, carTop + carH);
    bodyGrad.addColorStop(0, "#e63946");
    bodyGrad.addColorStop(1, "#9b1d25");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(carX - carW / 2, carTop, carW, carH, 4);
    ctx.fill();

    // Roof / cabin
    ctx.fillStyle = "#4a90d9";
    ctx.beginPath();
    ctx.roundRect(carX - carW * 0.25, carTop - 12, carW * 0.45, 14, [4, 4, 0, 0]);
    ctx.fill();

    // Wheels and rims
    for (const wx of [carX - carW * 0.3, carX + carW * 0.3]) {
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(wx, carTop + carH, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#888"; ctx.beginPath(); ctx.arc(wx, carTop + carH, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Direction arrow
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(direction === 0 ? "\u2190" : "\u2192", carX, carTop - 18);

    // Speed label on car
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${carSpeed} km/h`, carX, carTop + carH / 2 + 4);
  }

  function drawWaveFronts(): void {
    if (!showWaves) return;

    const gunY = height * 0.48;

    for (const wf of waveFronts) {
      const alpha = Math.max(0, 1 - wf.radius / (width * 0.8));
      if (alpha <= 0) continue;

      if (wf.emitted) {
        // Outgoing wave (blue)
        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wf.x, gunY, wf.radius, -0.4, 0.4);
        ctx.stroke();
      } else {
        // Reflected wave (orange/red) - show compression/expansion
        ctx.strokeStyle = `rgba(249, 115, 22, ${alpha * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wf.x, gunY, wf.radius, Math.PI - 0.4, Math.PI + 0.4);
        ctx.stroke();
      }
    }
  }

  function drawInfoPanel(): void {
    const panelW = Math.min(320, width * 0.42);
    const panelH = 140;
    const panelX = width - panelW - 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    // Doppler calculations
    const vMs = carSpeed / 3.6; // m/s
    const fRadar = radarFrequency * 1e9; // Hz
    const deltaF = (2 * vMs * fRadar) / c; // Hz
    const measuredSpeed = (deltaF * c) / (2 * fRadar) * 3.6; // back to km/h

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Radar Speed Gun \u2014 Doppler Effect", panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(200,220,255,0.8)";
    ctx.fillText("\u0394f = 2vf\u2080/c", panelX + 10, panelY + 36);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Radar freq: ${radarFrequency.toFixed(1)} GHz`, panelX + 10, panelY + 54);
    ctx.fillText(`Car speed: ${carSpeed.toFixed(0)} km/h (${vMs.toFixed(1)} m/s)`, panelX + 10, panelY + 70);
    ctx.fillText(`Direction: ${direction === 0 ? "Approaching" : "Receding"}`, panelX + 10, panelY + 86);

    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`\u0394f = ${deltaF.toFixed(0)} Hz (${(deltaF / 1000).toFixed(2)} kHz)`, panelX + 10, panelY + 104);

    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(`Measured speed: ${measuredSpeed.toFixed(1)} km/h`, panelX + 10, panelY + 124);
  }

  function drawFrequencyComparison(): void {
    const boxX = width * 0.06;
    const boxY = height * 0.82;
    const boxW = width * 0.88;
    const boxH = height * 0.14;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();

    const vMs = carSpeed / 3.6;
    const dopplerRatio = direction === 0
      ? (1 + vMs / c) // approaching: higher freq
      : (1 - vMs / c); // receding: lower freq

    // Draw emitted wave pattern
    const midY = boxY + boxH / 2;
    const sectionW = boxW / 2 - 20;

    // Emitted wave
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < sectionW; i++) {
      const x = boxX + 10 + i;
      const y = midY + 12 * Math.sin(i * 0.12 + time * 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "#3b82f6";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Emitted wave (f\u2080)", boxX + 10 + sectionW / 2, boxY + 12);

    // Reflected wave (shifted frequency)
    const freqScale = 0.12 * dopplerRatio;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < sectionW; i++) {
      const x = boxX + boxW / 2 + 10 + i;
      const y = midY + 12 * Math.sin(i * freqScale + time * 4 * dopplerRatio);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "#f97316";
    ctx.fillText(
      `Reflected wave (f\u2080 ${direction === 0 ? "+ \u0394f" : "\u2212 \u0394f"})`,
      boxX + boxW / 2 + 10 + sectionW / 2,
      boxY + 12
    );
  }

  function render(): void {
    drawBackground();
    drawRoad();
    drawWaveFronts();
    drawRadarGun();
    drawCar();
    drawInfoPanel();
    drawFrequencyComparison();
  }

  function reset(): void {
    time = 0;
    resetCar();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const vMs = carSpeed / 3.6;
    const fRadar = radarFrequency * 1e9;
    const deltaF = (2 * vMs * fRadar) / c;
    return (
      `Radar Speed Gun: Car ${direction === 0 ? "approaching" : "receding"} at ${carSpeed} km/h. ` +
      `Radar frequency: ${radarFrequency} GHz. Doppler shift \u0394f = 2vf/c = ${deltaF.toFixed(0)} Hz. ` +
      `Formula: \u0394f = 2vf\u2080/c. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    resetCar();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpeedgunFactory;
