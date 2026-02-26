import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PsychrometerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("psychrometer") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let dryBulbTemp = 25;
  let wetBulbTemp = 20;
  let airSpeed = 1;

  function saturationVaporPressure(T: number): number {
    return 6.1078 * Math.pow(10, (7.5 * T) / (237.3 + T));
  }

  function calcRelativeHumidity(Td: number, Tw: number): number {
    const esTw = saturationVaporPressure(Tw);
    const esTd = saturationVaporPressure(Td);
    const A = 0.000662; // psychrometric constant for standard pressure
    const e = esTw - A * 1013.25 * (Td - Tw);
    const rh = (e / esTd) * 100;
    return Math.max(0, Math.min(100, rh));
  }

  function calcDewPoint(T: number, rh: number): number {
    const a = 17.27;
    const b = 237.7;
    const gamma = (a * T) / (b + T) + Math.log(rh / 100);
    return (b * gamma) / (a - gamma);
  }

  function drawThermometer(x: number, yTop: number, yBot: number, temp: number, minT: number, maxT: number, color: string, label: string): void {
    const bulbRadius = 14;
    const tubeWidth = 8;
    const tubeTop = yTop;
    const tubeBot = yBot - bulbRadius;
    const tubeHeight = tubeBot - tubeTop;

    // Tube background
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.roundRect(x - tubeWidth / 2, tubeTop, tubeWidth, tubeHeight, tubeWidth / 2);
    ctx.fill();

    // Temperature fill
    const frac = Math.max(0, Math.min(1, (temp - minT) / (maxT - minT)));
    const fillHeight = tubeHeight * frac;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - tubeWidth / 2 + 1, tubeBot - fillHeight, tubeWidth - 2, fillHeight, 3);
    ctx.fill();

    // Bulb
    ctx.beginPath();
    ctx.arc(x, yBot, bulbRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bulb highlight
    ctx.beginPath();
    ctx.arc(x - 4, yBot - 4, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fill();

    // Scale marks
    const numMarks = 10;
    for (let i = 0; i <= numMarks; i++) {
      const markY = tubeBot - (tubeHeight * i) / numMarks;
      const markT = minT + ((maxT - minT) * i) / numMarks;
      const isMain = i % 2 === 0;
      ctx.beginPath();
      ctx.moveTo(x + tubeWidth / 2 + 2, markY);
      ctx.lineTo(x + tubeWidth / 2 + (isMain ? 10 : 6), markY);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = isMain ? 1.5 : 0.8;
      ctx.stroke();

      if (isMain) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${markT.toFixed(0)}°`, x + tubeWidth / 2 + 13, markY + 3);
      }
    }

    // Label
    ctx.fillStyle = color;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, yTop - 12);

    // Temperature value
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 14px 'SF Mono', monospace";
    ctx.fillText(`${temp.toFixed(1)}°C`, x, yBot + bulbRadius + 20);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    dryBulbTemp = params.dryBulbTemp ?? 25;
    wetBulbTemp = Math.min(params.wetBulbTemp ?? 20, dryBulbTemp);
    airSpeed = params.airSpeed ?? 1;
    time += dt;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const rh = calcRelativeHumidity(dryBulbTemp, wetBulbTemp);
    const dewPoint = calcDewPoint(dryBulbTemp, rh);
    const depression = dryBulbTemp - wetBulbTemp;

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Psychrometer — Wet & Dry Bulb Hygrometer", width / 2, 28);

    // Draw the two thermometers
    const thermY1 = height * 0.15;
    const thermY2 = height * 0.68;
    const dryX = width * 0.28;
    const wetX = width * 0.52;

    drawThermometer(dryX, thermY1, thermY2, dryBulbTemp, -10, 50, "#ff6644", "Dry Bulb");
    drawThermometer(wetX, thermY1, thermY2, wetBulbTemp, -10, 50, "#4488ff", "Wet Bulb");

    // Wet cloth around wet bulb
    ctx.strokeStyle = "rgba(100, 180, 255, 0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(wetX, thermY2, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Evaporation particles around wet bulb
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + time * 2;
      const dist = 22 + Math.sin(time * 3 + i) * 6;
      const px = wetX + Math.cos(angle) * dist;
      const py = thermY2 + Math.sin(angle) * dist - time * 5 * airSpeed;
      const alpha = Math.max(0, 0.5 - ((time * airSpeed + i * 0.3) % 2) / 2);
      if (alpha > 0) {
        ctx.beginPath();
        ctx.arc(px, py % height, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
        ctx.fill();
      }
    }

    // Results panel
    const panelX = width * 0.65;
    const panelY = height * 0.15;
    const panelW = width * 0.32;
    const panelH = height * 0.55;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Measurements", panelX + panelW / 2, panelY + 25);

    const metrics = [
      { label: "Dry Bulb Temperature", value: `${dryBulbTemp.toFixed(1)} °C`, color: "#ff6644" },
      { label: "Wet Bulb Temperature", value: `${wetBulbTemp.toFixed(1)} °C`, color: "#4488ff" },
      { label: "Wet Bulb Depression", value: `${depression.toFixed(1)} °C`, color: "#aaddff" },
      { label: "Relative Humidity", value: `${rh.toFixed(1)} %`, color: "#44ff88" },
      { label: "Dew Point", value: `${dewPoint.toFixed(1)} °C`, color: "#88ddff" },
    ];

    let my = panelY + 50;
    for (const m of metrics) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(m.label, panelX + 12, my);
      ctx.fillStyle = m.color;
      ctx.font = "bold 16px 'SF Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(m.value, panelX + panelW - 12, my);
      my += 36;
    }

    // Humidity bar
    const barY = my + 10;
    const barW = panelW - 24;
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.roundRect(panelX + 12, barY, barW, 16, 8);
    ctx.fill();

    const humGrad = ctx.createLinearGradient(panelX + 12, 0, panelX + 12 + barW, 0);
    humGrad.addColorStop(0, "#ff4444");
    humGrad.addColorStop(0.5, "#ffdd00");
    humGrad.addColorStop(1, "#44ff88");
    ctx.fillStyle = humGrad;
    ctx.beginPath();
    ctx.roundRect(panelX + 12, barY, barW * (rh / 100), 16, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("0%", panelX + 12, barY + 30);
    ctx.textAlign = "right";
    ctx.fillText("100%", panelX + 12 + barW, barY + 30);

    // Explanation
    ctx.fillStyle = "rgba(180, 220, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Evaporation from the wet bulb lowers its", width / 2, height - 40);
    ctx.fillText("temperature. Greater depression = lower humidity.", width / 2, height - 25);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const rh = calcRelativeHumidity(dryBulbTemp, wetBulbTemp);
    const dewPoint = calcDewPoint(dryBulbTemp, rh);
    return (
      `Psychrometer: dry bulb = ${dryBulbTemp.toFixed(1)}°C, wet bulb = ${wetBulbTemp.toFixed(1)}°C, ` +
      `depression = ${(dryBulbTemp - wetBulbTemp).toFixed(1)}°C. ` +
      `Relative humidity = ${rh.toFixed(1)}%, dew point = ${dewPoint.toFixed(1)}°C. ` +
      `The wet bulb is cooled by evaporation; drier air causes more evaporation and a larger temperature depression. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PsychrometerFactory;
