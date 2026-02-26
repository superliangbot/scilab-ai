import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StairbulbFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stairbulb") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let switch1 = 0;
  let switch2 = 0;
  let voltage = 5;
  let resistance = 100;
  let bulbGlow = 0;

  function isBulbOn(): boolean {
    // Bulb is on when both switches are in the same position
    return Math.round(switch1) === Math.round(switch2);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    bulbGlow = isBulbOn() ? 1 : 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    switch1 = Math.round(params.switch1 ?? 0);
    switch2 = Math.round(params.switch2 ?? 0);
    voltage = params.voltage ?? 5;
    resistance = params.resistance ?? 100;
    time += step;

    // Smooth glow transition
    const target = isBulbOn() ? 1 : 0;
    bulbGlow += (target - bulbGlow) * Math.min(step * 8, 1);
  }

  function drawWire(points: [number, number][], color: string, lineW: number): void {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();
  }

  function drawSwitch3Way(x: number, y: number, state: number, label: string): void {
    const sw = Math.round(state);
    // Three terminals: common (left), top-right, bottom-right
    const termSpacing = 40;

    // Common terminal
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top terminal
    ctx.beginPath();
    ctx.arc(x + 60, y - termSpacing, 5, 0, Math.PI * 2);
    ctx.fillStyle = sw === 0 ? "#22c55e" : "#64748b";
    ctx.fill();
    ctx.stroke();

    // Bottom terminal
    ctx.beginPath();
    ctx.arc(x + 60, y + termSpacing, 5, 0, Math.PI * 2);
    ctx.fillStyle = sw === 1 ? "#22c55e" : "#64748b";
    ctx.fill();
    ctx.stroke();

    // Switch arm (moving contact)
    const targetY = sw === 0 ? y - termSpacing : y + termSpacing;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + 55, targetY);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + 30, y + termSpacing + 30);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(sw === 0 ? "Position A" : "Position B", x + 30, y + termSpacing + 44);
  }

  function drawBulb(x: number, y: number, glowAmount: number): void {
    // Outer glow when on
    if (glowAmount > 0.01) {
      const outerGlow = ctx.createRadialGradient(x, y, 5, x, y, 60 + glowAmount * 40);
      outerGlow.addColorStop(0, `rgba(255, 240, 150, ${0.4 * glowAmount})`);
      outerGlow.addColorStop(0.5, `rgba(255, 200, 50, ${0.15 * glowAmount})`);
      outerGlow.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.beginPath();
      ctx.arc(x, y, 60 + glowAmount * 40, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();
    }

    // Bulb glass
    const bulbGrad = ctx.createRadialGradient(x - 5, y - 8, 0, x, y, 24);
    if (glowAmount > 0.1) {
      bulbGrad.addColorStop(0, `rgba(255, 255, 220, ${0.9 * glowAmount})`);
      bulbGrad.addColorStop(0.5, `rgba(255, 230, 100, ${0.7 * glowAmount})`);
      bulbGrad.addColorStop(1, `rgba(200, 160, 50, ${0.4 * glowAmount})`);
    } else {
      bulbGrad.addColorStop(0, "rgba(180, 190, 200, 0.4)");
      bulbGrad.addColorStop(1, "rgba(100, 110, 120, 0.3)");
    }
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fillStyle = bulbGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Filament
    ctx.strokeStyle = glowAmount > 0.1
      ? `rgba(255, 200, 50, ${0.5 + 0.5 * glowAmount})`
      : "rgba(120,120,120,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 24);
    ctx.lineTo(x - 5, y - 5);
    ctx.lineTo(x - 2, y + 5);
    ctx.lineTo(x + 2, y - 8);
    ctx.lineTo(x + 5, y + 3);
    ctx.lineTo(x + 8, y + 24);
    ctx.stroke();

    // Base (screw part)
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(x - 10, y + 22, 20, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 25 + i * 4);
      ctx.lineTo(x + 10, y + 25 + i * 4);
      ctx.stroke();
    }

    // Contact at bottom
    ctx.beginPath();
    ctx.arc(x, y + 38, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();
  }

  function drawBattery(x: number, y: number): void {
    // Battery body
    ctx.fillStyle = "#334155";
    ctx.fillRect(x - 15, y - 30, 30, 60);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 15, y - 30, 30, 60);

    // Positive terminal (longer line)
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 30);
    ctx.lineTo(x + 10, y - 30);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", x, y - 35);

    // Negative terminal (shorter line)
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 30);
    ctx.lineTo(x + 6, y + 30);
    ctx.stroke();
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("\u2013", x, y + 46);

    // Voltage label
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`${voltage.toFixed(0)}V`, x, y + 4);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ambient glow from bulb if on
    if (bulbGlow > 0.01) {
      const ambGrad = ctx.createRadialGradient(width / 2, 80, 0, width / 2, 80, height * 0.6);
      ambGrad.addColorStop(0, `rgba(255, 230, 150, ${0.04 * bulbGlow})`);
      ambGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ambGrad;
      ctx.fillRect(0, 0, width, height);
    }

    const bulbOn = isBulbOn();
    const current = bulbOn ? voltage / resistance : 0;
    const power = bulbOn ? voltage * current : 0;

    // Layout
    const cx = width / 2;
    const bulbY = 85;
    const switchY = height / 2 + 20;
    const batteryX = cx;
    const batteryY = height - 80;
    const sw1X = cx - 130;
    const sw2X = cx + 70;

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Staircase Light Circuit (3-Way Switches)", cx, 24);

    // Draw bulb
    drawBulb(cx, bulbY, bulbGlow);

    // Draw switches
    drawSwitch3Way(sw1X, switchY, switch1, "Switch 1");
    drawSwitch3Way(sw2X, switchY, switch2, "Switch 2");

    // Draw battery
    drawBattery(batteryX, batteryY);

    // Wire color based on circuit state
    const activeColor = bulbOn ? "rgba(255,200,50,0.8)" : "rgba(100,120,150,0.5)";
    const inactiveColor = "rgba(100,120,150,0.5)";

    // Top wire path: from bulb left terminal to switch1 common
    drawWire([[cx - 8, bulbY + 38], [cx - 8, switchY - 60], [sw1X, switchY - 60], [sw1X, switchY]], activeColor, 2.5);

    // Top wire path: from bulb right terminal to switch2 common
    drawWire([[cx + 8, bulbY + 38], [cx + 8, switchY - 60], [sw2X + 60, switchY - 60], [sw2X + 60, switchY - 40 * (1 - Math.round(switch2)) + 40 * Math.round(switch2)]], activeColor, 2.5);

    // Traveller wires between switches (the two paths)
    const travActive1 = (Math.round(switch1) === 0 && Math.round(switch2) === 0);
    const travActive2 = (Math.round(switch1) === 1 && Math.round(switch2) === 1);

    // Top traveller
    drawWire([
      [sw1X + 60, switchY - 40],
      [sw1X + 65, switchY - 55],
      [sw2X + 55, switchY - 55],
      [sw2X + 60, switchY - 40]
    ], travActive1 ? activeColor : inactiveColor, 2);

    // Bottom traveller
    drawWire([
      [sw1X + 60, switchY + 40],
      [sw1X + 65, switchY + 55],
      [sw2X + 55, switchY + 55],
      [sw2X + 60, switchY + 40]
    ], travActive2 ? activeColor : inactiveColor, 2);

    // Battery wires
    drawWire([[batteryX, batteryY - 30], [batteryX, switchY - 60], [sw1X - 30, switchY - 60], [sw1X - 30, switchY], [sw1X, switchY]], activeColor, 2.5);
    drawWire([[batteryX, batteryY + 30], [batteryX, batteryY + 50], [sw2X + 90, batteryY + 50], [sw2X + 90, switchY - 60], [cx + 8, switchY - 60]], activeColor, 2.5);

    // Animated electrons when circuit is on
    if (bulbOn && bulbGlow > 0.3) {
      const numElectrons = 8;
      ctx.fillStyle = "rgba(100,200,255,0.8)";
      for (let i = 0; i < numElectrons; i++) {
        const t = ((time * 1.5 + i / numElectrons) % 1);
        // Simple path along the top wire
        const ex = cx - 8 + (sw1X - (cx - 8)) * t;
        const ey = switchY - 60 + Math.sin(t * Math.PI * 4) * 3;
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Status indicator
    ctx.save();
    const statusW = 200;
    const statusH = 28;
    const statusX = cx - statusW / 2;
    const statusY = bulbY + 60;
    ctx.fillStyle = bulbOn ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)";
    ctx.beginPath();
    ctx.roundRect(statusX, statusY, statusW, statusH, 14);
    ctx.fill();
    ctx.fillStyle = bulbOn ? "#22c55e" : "#ef4444";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(bulbOn ? "BULB ON" : "BULB OFF", cx, statusY + 18);
    ctx.restore();

    // Info panel
    ctx.save();
    const panelW = 260;
    const panelH = 90;
    const panelX = 10;
    const panelY = height - panelH - 10;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Switch 1: ${switch1 === 0 ? "A" : "B"}  |  Switch 2: ${switch2 === 0 ? "A" : "B"}`, panelX + 10, panelY + 18);
    ctx.fillText(`Voltage: ${voltage.toFixed(1)} V  |  R: ${resistance.toFixed(0)} \u03A9`, panelX + 10, panelY + 36);
    ctx.fillText(`Current: ${(current * 1000).toFixed(1)} mA`, panelX + 10, panelY + 54);
    ctx.fillText(`Power: ${(power * 1000).toFixed(1)} mW`, panelX + 10, panelY + 72);
    ctx.fillStyle = "rgba(200,200,255,0.5)";
    ctx.fillText("Bulb ON when both switches match", panelX + 10, panelY + 86);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    bulbGlow = isBulbOn() ? 1 : 0;
  }

  function destroy(): void {
    // cleanup
  }

  function getStateDescription(): string {
    const bulbOn = isBulbOn();
    const current = bulbOn ? voltage / resistance : 0;
    return (
      `Staircase Light: Switch1=${switch1 === 0 ? "A" : "B"}, Switch2=${switch2 === 0 ? "A" : "B"}. ` +
      `Bulb is ${bulbOn ? "ON" : "OFF"}. V=${voltage}V, R=${resistance}\u03A9. ` +
      `Current=${(current * 1000).toFixed(1)}mA. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StairbulbFactory;
