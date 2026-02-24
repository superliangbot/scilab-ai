import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElevatorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("elevator") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let mass = 70; // kg
  let acceleration = 2; // m/s^2
  let direction = 0; // -1=down, 0=stop, 1=up
  const g = 9.81;

  // Elevator state
  let elevatorY = 0.5; // fraction 0=top, 1=bottom
  let elevatorVel = 0;
  let elevatorAccel = 0;
  let phase: "idle" | "accelerating" | "constant" | "decelerating" = "idle";
  let phaseTimer = 0;
  let apparentWeight = 0;

  // Building geometry
  const NUM_FLOORS = 6;
  const BUILDING_LEFT = 100;
  const BUILDING_RIGHT = 350;
  const BUILDING_TOP = 40;
  const BUILDING_BOTTOM = 560;
  const FLOOR_HEIGHT = (BUILDING_BOTTOM - BUILDING_TOP) / NUM_FLOORS;

  // Graph data
  let weightHistory: number[] = [];
  const MAX_HISTORY = 200;

  function getElevatorScreenY(): number {
    return BUILDING_TOP + elevatorY * (BUILDING_BOTTOM - BUILDING_TOP - FLOOR_HEIGHT);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    elevatorY = 0.5;
    elevatorVel = 0;
    elevatorAccel = 0;
    phase = "idle";
    apparentWeight = mass * g;
    weightHistory = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    mass = params.mass ?? 70;
    acceleration = params.acceleration ?? 2;
    direction = params.direction ?? 0;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // State machine for elevator motion
    if (direction !== 0 && phase === "idle") {
      phase = "accelerating";
      phaseTimer = 0;
    }

    if (direction === 0 && phase !== "idle") {
      phase = "decelerating";
      phaseTimer = 0;
    }

    const accelDuration = 1.5;
    const constDuration = 2.0;
    const decelDuration = 1.5;

    switch (phase) {
      case "idle":
        elevatorAccel = 0;
        elevatorVel *= 0.9;
        if (Math.abs(elevatorVel) < 0.001) elevatorVel = 0;
        break;
      case "accelerating":
        phaseTimer += dtClamped;
        elevatorAccel = -direction * acceleration;
        elevatorVel += elevatorAccel * dtClamped * 0.01;
        if (phaseTimer > accelDuration) {
          phase = "constant";
          phaseTimer = 0;
        }
        break;
      case "constant":
        phaseTimer += dtClamped;
        elevatorAccel = 0;
        if (phaseTimer > constDuration) {
          phase = "decelerating";
          phaseTimer = 0;
        }
        break;
      case "decelerating":
        phaseTimer += dtClamped;
        elevatorAccel = direction * acceleration;
        elevatorVel += elevatorAccel * dtClamped * 0.01;
        if (phaseTimer > decelDuration) {
          phase = "idle";
          elevatorVel = 0;
          elevatorAccel = 0;
        }
        break;
    }

    elevatorY += elevatorVel * dtClamped;
    elevatorY = Math.max(0.05, Math.min(0.85, elevatorY));

    // Apparent weight: N = m(g + a_effective)
    // When going up and accelerating: a_effective positive → N > mg
    // When going up at constant speed: a_effective = 0 → N = mg
    // When going up and decelerating: a_effective negative → N < mg
    let aEffective = 0;
    if (phase === "accelerating" && direction !== 0) {
      aEffective = direction * acceleration;
    } else if (phase === "decelerating" && direction !== 0) {
      aEffective = -direction * acceleration;
    }
    apparentWeight = mass * (g + aEffective);

    weightHistory.push(apparentWeight);
    if (weightHistory.length > MAX_HISTORY) weightHistory.shift();
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBuilding(): void {
    // Building frame
    ctx.fillStyle = "rgba(40, 50, 70, 0.6)";
    ctx.fillRect(BUILDING_LEFT, BUILDING_TOP, BUILDING_RIGHT - BUILDING_LEFT, BUILDING_BOTTOM - BUILDING_TOP);
    ctx.strokeStyle = "rgba(100, 130, 170, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(BUILDING_LEFT, BUILDING_TOP, BUILDING_RIGHT - BUILDING_LEFT, BUILDING_BOTTOM - BUILDING_TOP);

    // Floor lines and numbers
    ctx.strokeStyle = "rgba(100, 130, 170, 0.2)";
    ctx.lineWidth = 1;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(200, 220, 255, 0.5)";

    for (let i = 0; i <= NUM_FLOORS; i++) {
      const y = BUILDING_TOP + i * FLOOR_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(BUILDING_LEFT, y);
      ctx.lineTo(BUILDING_RIGHT, y);
      ctx.stroke();
      if (i < NUM_FLOORS) {
        ctx.fillText(`F${NUM_FLOORS - i}`, BUILDING_LEFT - 8, y + FLOOR_HEIGHT / 2 + 4);
      }
    }
  }

  function drawElevator(): void {
    const elY = getElevatorScreenY();
    const elW = BUILDING_RIGHT - BUILDING_LEFT - 40;
    const elX = BUILDING_LEFT + 20;
    const elH = FLOOR_HEIGHT - 10;

    // Elevator cab
    ctx.fillStyle = "rgba(60, 80, 120, 0.7)";
    ctx.beginPath();
    ctx.roundRect(elX, elY + 5, elW, elH, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(140, 170, 210, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cables
    ctx.strokeStyle = "rgba(180, 180, 180, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(elX + elW / 3, elY + 5);
    ctx.lineTo(elX + elW / 3, BUILDING_TOP);
    ctx.moveTo(elX + 2 * elW / 3, elY + 5);
    ctx.lineTo(elX + 2 * elW / 3, BUILDING_TOP);
    ctx.stroke();

    // Person stick figure
    const px = elX + elW / 2;
    const py = elY + elH - 15;

    // Scale under person
    ctx.fillStyle = "rgba(200, 200, 200, 0.4)";
    ctx.fillRect(px - 20, py + 5, 40, 8);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 20, py + 5, 40, 8);

    // Body
    ctx.strokeStyle = "rgba(200, 220, 255, 0.8)";
    ctx.lineWidth = 2;
    // Head
    ctx.beginPath();
    ctx.arc(px, py - 35, 8, 0, Math.PI * 2);
    ctx.stroke();
    // Torso
    ctx.beginPath();
    ctx.moveTo(px, py - 27);
    ctx.lineTo(px, py - 8);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px - 10, py + 5);
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px + 10, py + 5);
    ctx.stroke();
    // Arms
    ctx.beginPath();
    ctx.moveTo(px, py - 22);
    ctx.lineTo(px - 12, py - 14);
    ctx.moveTo(px, py - 22);
    ctx.lineTo(px + 12, py - 14);
    ctx.stroke();

    // Scale reading
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${apparentWeight.toFixed(1)} N`, px, py + 25);
  }

  function drawForceArrows(): void {
    const elY = getElevatorScreenY();
    const elH = FLOOR_HEIGHT - 10;
    const px = BUILDING_LEFT - 50;
    const personY = elY + elH / 2;

    const maxForce = mass * (g + 5);
    const scale = 60 / maxForce;

    // Weight (down)
    const wLen = mass * g * scale;
    drawArrow(px, personY, px, personY + wLen, "#ef4444", `mg = ${(mass * g).toFixed(0)} N`);

    // Normal force (up)
    const nLen = apparentWeight * scale;
    drawArrow(px + 30, personY, px + 30, personY - nLen, "#22c55e", `N = ${apparentWeight.toFixed(0)} N`);
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, label: string): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(dy, dx);
    const headLen = 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, (x1 + x2) / 2 - 25, (y1 + y2) / 2);
    ctx.restore();
  }

  function drawWeightGraph(): void {
    const gx = 420;
    const gy = 80;
    const gw = 340;
    const gh = 200;

    ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText("Apparent Weight Over Time", gx + gw / 2, gy - 6);

    // Horizontal reference line at mg
    const mg = mass * g;
    const maxW = mass * (g + 6);
    const minW = mass * (g - 6);
    const range = maxW - minW;
    const mgY = gy + gh - ((mg - minW) / range) * gh;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(gx, mgY);
    ctx.lineTo(gx + gw, mgY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`mg = ${mg.toFixed(0)} N`, gx + 4, mgY - 4);

    // Plot weight history
    if (weightHistory.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      for (let i = 0; i < weightHistory.length; i++) {
        const x = gx + (i / MAX_HISTORY) * gw;
        const y = gy + gh - ((weightHistory[i] - minW) / range) * gh;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Y axis labels
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    for (let v = minW; v <= maxW; v += (range / 4)) {
      const y = gy + gh - ((v - minW) / range) * gh;
      ctx.fillText(`${v.toFixed(0)}`, gx - 4, y + 3);
    }
  }

  function drawStatusPanel(): void {
    const px = 420;
    const py = 320;
    const pw = 340;
    const ph = 230;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Elevator Physics", px + 12, py + 22);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";

    const dirLabel = direction > 0 ? "UP" : direction < 0 ? "DOWN" : "STOPPED";
    const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);

    ctx.fillText(`Direction: ${dirLabel}`, px + 12, py + 46);
    ctx.fillText(`Phase: ${phaseLabel}`, px + 12, py + 66);
    ctx.fillText(`Mass: ${mass.toFixed(0)} kg`, px + 12, py + 86);
    ctx.fillText(`Acceleration setting: ${acceleration.toFixed(1)} m/s²`, px + 12, py + 106);

    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`True weight: mg = ${(mass * g).toFixed(1)} N`, px + 12, py + 134);
    ctx.fillStyle = apparentWeight > mass * g ? "#22c55e" : apparentWeight < mass * g ? "#ef4444" : "#fbbf24";
    ctx.fillText(`Apparent weight: N = ${apparentWeight.toFixed(1)} N`, px + 12, py + 154);

    ctx.fillStyle = "#64748b";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("N = m(g + a)", px + 12, py + 180);
    ctx.fillText("Accel up → heavier | Accel down → lighter", px + 12, py + 196);
    ctx.fillText("Constant velocity → normal weight", px + 12, py + 212);
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawBuilding();
    drawElevator();
    drawForceArrows();
    drawWeightGraph();
    drawStatusPanel();
  }

  function reset(): void {
    time = 0;
    elevatorY = 0.5;
    elevatorVel = 0;
    elevatorAccel = 0;
    phase = "idle";
    apparentWeight = mass * g;
    weightHistory = [];
  }

  function destroy(): void {
    weightHistory = [];
  }

  function getStateDescription(): string {
    const dirLabel = direction > 0 ? "moving up" : direction < 0 ? "moving down" : "stopped";
    return (
      `Elevator simulation: A ${mass}kg person in an elevator ${dirLabel} (phase: ${phase}). ` +
      `True weight = ${(mass * g).toFixed(1)} N. Apparent weight = ${apparentWeight.toFixed(1)} N. ` +
      `N = m(g + a). When accelerating upward, apparent weight increases. ` +
      `At constant velocity, apparent weight equals true weight. ` +
      `When decelerating (or accelerating downward), apparent weight decreases.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElevatorFactory;
