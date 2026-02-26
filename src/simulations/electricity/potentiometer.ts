import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PotentiometerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("potentiometer") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let wiperPosition = 50; // 0-100 percent
  let sourceVoltage = 9;
  let loadResistance = 100; // speaker/load ohms

  // Current dots
  let dots: Array<{ pos: number; path: number }> = [];

  // Resistor total
  const TOTAL_RESISTANCE = 200; // ohms

  function getR1(): number {
    return (wiperPosition / 100) * TOTAL_RESISTANCE;
  }

  function getR2(): number {
    return ((100 - wiperPosition) / 100) * TOTAL_RESISTANCE;
  }

  function getOutputVoltage(): number {
    const r1 = getR1();
    const r2 = getR2();
    // Voltage divider with load: Vout = V * (R2 || Rload) / (R1 + R2 || Rload)
    const r2Parallel = (r2 * loadResistance) / (r2 + loadResistance);
    return sourceVoltage * r2Parallel / (r1 + r2Parallel);
  }

  function getCurrent(): number {
    const r1 = getR1();
    const r2 = getR2();
    const r2Parallel = (r2 * loadResistance) / (r2 + loadResistance);
    return sourceVoltage / (r1 + r2Parallel);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    dots = [];
    // Initialize current dots
    for (let i = 0; i < 20; i++) {
      dots.push({ pos: Math.random(), path: Math.floor(Math.random() * 2) });
    }
  }

  function update(dt: number, params: Record<string, number>) {
    wiperPosition = params.wiperPosition ?? 50;
    sourceVoltage = params.sourceVoltage ?? 9;
    loadResistance = params.loadResistance ?? 100;

    const current = getCurrent();
    const dotSpeed = current * 0.15;

    for (const d of dots) {
      d.pos += dotSpeed * dt;
      if (d.pos > 1) {
        d.pos -= 1;
        d.path = Math.floor(Math.random() * 2);
      }
    }

    time += dt;
  }

  function drawCircuitPath(points: Array<{ x: number; y: number }>, color: string) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function drawResistorSymbol(x: number, y: number, w: number, h: number, label: string, value: string) {
    ctx.fillStyle = "rgba(180,150,100,0.3)";
    ctx.strokeStyle = "rgba(180,150,100,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 3);
    ctx.fill();
    ctx.stroke();

    // Zigzag inside
    ctx.strokeStyle = "rgba(255,200,100,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const px = x - w / 2 + 5 + (i / steps) * (w - 10);
      const py = y + (i % 2 === 0 ? -h * 0.2 : h * 0.2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - h / 2 - 6);
    ctx.fillText(value, x, y + h / 2 + 14);
  }

  function render() {
    ctx.fillStyle = "#0e0e1e";
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.4;
    const circW = width * 0.6;
    const circH = height * 0.45;

    // Battery
    const batX = cx - circW / 2;
    const batY = cy;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Battery", batX, batY - circH / 2 - 15);
    ctx.fillText(`${sourceVoltage.toFixed(1)}V`, batX, batY - circH / 2 - 2);

    // Battery symbol
    ctx.strokeStyle = "rgba(255,200,50,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(batX - 8, batY - 15);
    ctx.lineTo(batX - 8, batY + 15);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(batX + 5, batY - 8);
    ctx.lineTo(batX + 5, batY + 8);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("+", batX - 12, batY - 18);
    ctx.fillText("−", batX + 8, batY - 18);

    // Main circuit wires
    const topY = cy - circH / 2;
    const botY = cy + circH / 2;
    const rightX = cx + circW / 2;

    // Top wire
    drawCircuitPath([
      { x: batX, y: batY - 15 },
      { x: batX, y: topY },
      { x: rightX, y: topY },
    ], "rgba(200,80,80,0.6)");

    // Bottom wire
    drawCircuitPath([
      { x: batX, y: batY + 15 },
      { x: batX, y: botY },
      { x: rightX, y: botY },
    ], "rgba(80,80,200,0.6)");

    // Potentiometer (vertical on right side)
    const potX = rightX;
    const potTop = topY;
    const potBot = botY;
    const potH = potBot - potTop;

    // Resistive strip
    ctx.fillStyle = "rgba(120,100,80,0.4)";
    ctx.strokeStyle = "rgba(180,150,100,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(potX - 12, potTop, 24, potH, 4);
    ctx.fill();
    ctx.stroke();

    // Gradient showing resistance
    const resGrad = ctx.createLinearGradient(0, potTop, 0, potBot);
    resGrad.addColorStop(0, "rgba(200,100,50,0.2)");
    resGrad.addColorStop(1, "rgba(50,100,200,0.2)");
    ctx.fillStyle = resGrad;
    ctx.fillRect(potX - 10, potTop + 2, 20, potH - 4);

    // Wiper
    const wiperY = potTop + (wiperPosition / 100) * potH;
    ctx.fillStyle = "#aaa";
    ctx.beginPath();
    ctx.moveTo(potX - 20, wiperY - 5);
    ctx.lineTo(potX - 12, wiperY);
    ctx.lineTo(potX - 20, wiperY + 5);
    ctx.closePath();
    ctx.fill();

    // Wiper connection to load
    const loadX = cx;
    const loadY = cy + 10;
    drawCircuitPath([
      { x: potX - 20, y: wiperY },
      { x: loadX + 40, y: wiperY },
      { x: loadX + 40, y: loadY },
    ], "rgba(150,150,50,0.6)");

    // Load (speaker)
    const spkR = Math.min(width, height) * 0.06;
    ctx.beginPath();
    ctx.arc(loadX, loadY, spkR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(200,200,200,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Speaker cone
    ctx.beginPath();
    ctx.arc(loadX, loadY, spkR * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(200,200,200,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(loadX, loadY, spkR * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,200,200,0.3)";
    ctx.fill();

    // Sound waves (scaled by output voltage)
    const outV = getOutputVoltage();
    const soundIntensity = outV / sourceVoltage;
    if (soundIntensity > 0.05) {
      for (let i = 1; i <= 3; i++) {
        const waveR = spkR + i * 12 + Math.sin(time * 8) * 3;
        ctx.beginPath();
        ctx.arc(loadX, loadY, waveR, -0.5, 0.5);
        ctx.strokeStyle = `rgba(100,200,255,${soundIntensity * 0.3 / i})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Speaker", loadX, loadY + spkR + 15);
    ctx.fillText(`${loadResistance}Ω`, loadX, loadY + spkR + 28);

    // Load return wire
    drawCircuitPath([
      { x: loadX - 40, y: loadY },
      { x: loadX - 40, y: botY },
    ], "rgba(80,80,200,0.6)");

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Potentiometer", potX + 30, cy);
    ctx.fillText(`R1: ${getR1().toFixed(0)}Ω`, potX + 35, wiperY - potH * 0.15);
    ctx.fillText(`R2: ${getR2().toFixed(0)}Ω`, potX + 35, wiperY + potH * 0.15);

    // Current dots
    const current = getCurrent();
    for (const d of dots) {
      const t = d.pos;
      let dx: number, dy: number;
      // Path along the circuit
      if (t < 0.25) {
        const p = t / 0.25;
        dx = batX + p * (rightX - batX);
        dy = topY;
      } else if (t < 0.5) {
        const p = (t - 0.25) / 0.25;
        dx = rightX;
        dy = topY + p * (wiperY - topY);
      } else if (t < 0.75) {
        const p = (t - 0.5) / 0.25;
        dx = rightX - p * (rightX - batX);
        dy = botY;
      } else {
        const p = (t - 0.75) / 0.25;
        dx = batX;
        dy = botY - p * (botY - topY);
      }

      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,100,100,${Math.min(1, current * 0.5)})`;
      ctx.fill();
    }

    // Readout panel
    const panelX = width * 0.02;
    const panelY = height * 0.75;
    const panelW = width * 0.96;
    const panelH = height * 0.22;

    ctx.fillStyle = "rgba(10,10,30,0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `${Math.max(11, height * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    const col1 = panelX + 15;
    const col2 = panelX + panelW * 0.35;
    const col3 = panelX + panelW * 0.65;
    const row1 = panelY + 22;
    const row2 = panelY + 42;
    const row3 = panelY + 62;

    ctx.fillText(`Source: ${sourceVoltage.toFixed(1)} V`, col1, row1);
    ctx.fillText(`Wiper: ${wiperPosition.toFixed(0)}%`, col1, row2);
    ctx.fillText(`R total: ${TOTAL_RESISTANCE} Ω`, col1, row3);

    ctx.fillText(`Output V: ${outV.toFixed(2)} V`, col2, row1);
    ctx.fillText(`Current: ${(current * 1000).toFixed(1)} mA`, col2, row2);
    ctx.fillText(`Power: ${(outV * current * 1000).toFixed(1)} mW`, col2, row3);

    ctx.fillText(`R1: ${getR1().toFixed(0)} Ω`, col3, row1);
    ctx.fillText(`R2: ${getR2().toFixed(0)} Ω`, col3, row2);
    ctx.fillText(`Load: ${loadResistance} Ω`, col3, row3);

    // Volume bar
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(panelX + panelW - 80, row1 - 10, 60, 12);
    ctx.fillStyle = `rgba(100,200,255,${0.3 + soundIntensity * 0.7})`;
    ctx.fillRect(panelX + panelW - 80, row1 - 10, 60 * soundIntensity, 12);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(9, height * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Volume", panelX + panelW - 50, row1 + 14);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Potentiometer — Variable Voltage Divider", width / 2, 25);
  }

  function reset() {
    time = 0;
    dots = [];
    for (let i = 0; i < 20; i++) {
      dots.push({ pos: Math.random(), path: Math.floor(Math.random() * 2) });
    }
  }

  function destroy() { dots = []; }

  function getStateDescription(): string {
    const outV = getOutputVoltage();
    const cur = getCurrent();
    return `Potentiometer | Wiper: ${wiperPosition.toFixed(0)}% | V_out: ${outV.toFixed(2)}V | I: ${(cur * 1000).toFixed(1)}mA | R1: ${getR1().toFixed(0)}Ω | R2: ${getR2().toFixed(0)}Ω | Load: ${loadResistance}Ω`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PotentiometerFactory;
