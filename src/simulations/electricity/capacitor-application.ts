import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface DotCharge {
  x: number;
  y: number;
  alpha: number;
  side: number; // 0 = positive plate, 1 = negative plate
}

interface WireDot {
  t: number; // 0-1 position along wire path
  speed: number;
}

const CapacitorApplicationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("capacitor-application") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let circuit = 0; // 0=Basic, 1=Switch, 2=Delay
  let voltage = 3;
  let capacitance = 1000; // uF
  let speed = 1;

  // Physics state
  let chargeLevel = 0; // 0 to 1
  let currentFlow = 0; // normalized 0 to 1
  let switchState = 0; // for circuit 1: 0=charge, 1=discharge
  let delayPhase = 0; // for circuit 2: 0=connected, 1=disconnected/delay

  // Animated elements
  let plateCharges: DotCharge[] = [];
  let wireDots: WireDot[] = [];

  let prevCircuit = -1;
  let prevSwitch = -1;

  const TAU_BASE = 2.0; // base time constant for animation

  function initWireDots(): void {
    wireDots = [];
    for (let i = 0; i < 18; i++) {
      wireDots.push({ t: i / 18, speed: 0 });
    }
  }

  function computeRC(): number {
    // Animation time constant scaled by capacitance
    return TAU_BASE * (capacitance / 1000);
  }

  function updatePlateCharges(dt: number): void {
    const targetCount = Math.floor(chargeLevel * 20);
    const capCenterX = width * 0.5;
    const capY = height * 0.4;
    const plateH = height * 0.2;
    const gap = 20;

    while (plateCharges.length < targetCount * 2) {
      const side = plateCharges.length % 2;
      const baseX = side === 0 ? capCenterX - gap - 4 : capCenterX + gap + 4;
      plateCharges.push({
        x: baseX + (Math.random() - 0.5) * 6,
        y: capY + Math.random() * plateH,
        alpha: 0,
        side,
      });
    }
    while (plateCharges.length > targetCount * 2 && plateCharges.length > 0) {
      plateCharges.pop();
    }

    for (const ch of plateCharges) {
      ch.alpha = Math.min(1, ch.alpha + dt * 3);
      ch.x += (Math.random() - 0.5) * 0.3;
      ch.y += (Math.random() - 0.5) * 0.3;
    }
  }

  // ── Circuit 0: Basic Charging ──

  function updateBasicCircuit(dt: number): void {
    const tau = computeRC();
    chargeLevel = 1 - Math.exp(-time / tau);
    currentFlow = Math.exp(-time / tau);
  }

  function drawBasicCircuit(): void {
    const centerX = width * 0.5;
    const battX = width * 0.15;
    const ledX = width * 0.85;
    const topY = height * 0.2;
    const bottomY = height * 0.75;
    const capY = height * 0.35;
    const capH = height * 0.22;

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Basic Charging Circuit", width / 2, 6);

    // Wires
    ctx.strokeStyle = "rgba(100, 116, 139, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Battery top -> capacitor left plate -> LED -> bottom -> battery
    ctx.beginPath();
    ctx.moveTo(battX, height * 0.42);
    ctx.lineTo(battX, topY);
    ctx.lineTo(centerX, topY);
    ctx.lineTo(centerX, capY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, capY + capH);
    ctx.lineTo(centerX, bottomY);
    ctx.lineTo(ledX, bottomY);
    ctx.lineTo(ledX, height * 0.42 + 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ledX, height * 0.42 - 20);
    ctx.lineTo(ledX, topY);
    ctx.lineTo(battX + 20, topY);
    ctx.stroke();

    // Battery
    drawBatteryAt(battX, height * 0.42);

    // Capacitor
    drawCapacitorAt(centerX, capY, capH);

    // LED (brightness dims as capacitor charges - less current)
    drawLEDAt(ledX, height * 0.42, currentFlow);

    // Wire dots
    drawWireDots(1);

    // Annotations
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("LED dims as capacitor charges", width / 2, bottomY + 12);
    ctx.fillText(`(less current flows as V_cap \u2192 ${voltage}V)`, width / 2, bottomY + 26);
  }

  // ── Circuit 1: Switch Circuit ──

  function updateSwitchCircuit(dt: number): void {
    const tau = computeRC();
    // Switch state determines charge or discharge
    // We toggle switchState based on chargeLevel
    if (switchState === 0) {
      chargeLevel = 1 - Math.exp(-time / tau);
      currentFlow = Math.exp(-time / tau);
    } else {
      chargeLevel = Math.exp(-time / tau);
      currentFlow = Math.exp(-time / tau);
    }
  }

  function drawSwitchCircuit(): void {
    const centerX = width * 0.5;
    const battX = width * 0.15;
    const topY = height * 0.2;
    const bottomY = height * 0.75;
    const capY = height * 0.35;
    const capH = height * 0.22;
    const switchX = width * 0.35;

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Charging/Discharging with Switch", width / 2, 6);

    // Wires
    ctx.strokeStyle = "rgba(100, 116, 139, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Battery to switch
    ctx.beginPath();
    ctx.moveTo(battX, height * 0.42);
    ctx.lineTo(battX, topY);
    ctx.lineTo(switchX - 12, topY);
    ctx.stroke();

    // Switch to capacitor
    ctx.beginPath();
    ctx.moveTo(switchX + 12, topY);
    ctx.lineTo(centerX, topY);
    ctx.lineTo(centerX, capY);
    ctx.stroke();

    // Capacitor bottom -> resistor -> bottom wire -> battery
    const resX = width * 0.7;
    ctx.beginPath();
    ctx.moveTo(centerX, capY + capH);
    ctx.lineTo(centerX, bottomY);
    ctx.lineTo(battX, bottomY);
    ctx.lineTo(battX, height * 0.42 + 28);
    ctx.stroke();

    // Discharge path wire (right side)
    ctx.beginPath();
    ctx.moveTo(centerX + 20, topY);
    ctx.lineTo(resX, topY);
    ctx.lineTo(resX, bottomY);
    ctx.lineTo(centerX + 20, bottomY);
    ctx.stroke();

    // Battery
    drawBatteryAt(battX, height * 0.42);

    // Capacitor
    drawCapacitorAt(centerX, capY, capH);

    // Switch
    drawSwitchAt(switchX, topY, switchState === 0);

    // Resistor for discharge path
    drawResistorAt(resX, height * 0.45, "R");

    // Wire dots
    drawWireDots(switchState === 0 ? 1 : -1);

    // Annotations
    ctx.fillStyle = switchState === 0 ? "rgba(52, 211, 153, 0.7)" : "rgba(251, 146, 60, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      switchState === 0 ? "Switch ON: Charging from battery" : "Switch OFF: Discharging through R",
      width / 2, bottomY + 12
    );
  }

  // ── Circuit 2: Delay Circuit ──

  function updateDelayCircuit(dt: number): void {
    const tau = computeRC();
    if (delayPhase === 0) {
      // Connected: capacitor charges
      chargeLevel = 1 - Math.exp(-time / tau);
      currentFlow = Math.exp(-time / tau);
      // Auto-disconnect after ~3 tau (95% charged)
      if (time > tau * 3) {
        delayPhase = 1;
        time = 0;
      }
    } else {
      // Disconnected: capacitor powers LED, gradually discharging
      chargeLevel = Math.exp(-time / tau);
      currentFlow = Math.exp(-time / tau);
      // Auto-reconnect when nearly discharged
      if (chargeLevel < 0.02) {
        delayPhase = 0;
        time = 0;
      }
    }
  }

  function drawDelayCircuit(): void {
    const centerX = width * 0.5;
    const battX = width * 0.15;
    const ledX = width * 0.78;
    const topY = height * 0.2;
    const bottomY = height * 0.75;
    const capY = height * 0.35;
    const capH = height * 0.22;

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Delay Circuit (Capacitor Powers LED After Disconnect)", width / 2, 6);

    // Wires
    ctx.strokeStyle = "rgba(100, 116, 139, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    const switchX = width * 0.32;

    // Battery -> switch -> capacitor
    ctx.beginPath();
    ctx.moveTo(battX, height * 0.42);
    ctx.lineTo(battX, topY);
    ctx.lineTo(switchX - 12, topY);
    ctx.stroke();

    if (delayPhase === 0) {
      ctx.beginPath();
      ctx.moveTo(switchX + 12, topY);
      ctx.lineTo(centerX, topY);
      ctx.lineTo(centerX, capY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(switchX + 12, topY + 3);
      ctx.lineTo(centerX, topY);
      ctx.lineTo(centerX, capY);
      ctx.stroke();
    }

    // Capacitor -> LED -> bottom wire -> capacitor
    ctx.beginPath();
    ctx.moveTo(centerX, capY + capH);
    ctx.lineTo(centerX, bottomY);
    ctx.lineTo(battX, bottomY);
    ctx.lineTo(battX, height * 0.42 + 28);
    ctx.stroke();

    // LED path from capacitor
    ctx.beginPath();
    ctx.moveTo(centerX + 20, topY);
    ctx.lineTo(ledX, topY);
    ctx.lineTo(ledX, height * 0.38);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ledX, height * 0.48);
    ctx.lineTo(ledX, bottomY);
    ctx.lineTo(centerX + 20, bottomY);
    ctx.stroke();

    // Battery
    drawBatteryAt(battX, height * 0.42);

    // Capacitor
    drawCapacitorAt(centerX, capY, capH);

    // Switch
    drawSwitchAt(switchX, topY, delayPhase === 0);

    // LED - powered by capacitor discharge in delay phase
    const ledBrightness = delayPhase === 1 ? currentFlow : currentFlow * 0.5;
    drawLEDAt(ledX, height * 0.43, ledBrightness);

    // Wire dots
    drawWireDots(delayPhase === 0 ? 1 : -1);

    // Phase annotation
    if (delayPhase === 0) {
      ctx.fillStyle = "rgba(52, 211, 153, 0.7)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Phase 1: Battery charges capacitor", width / 2, bottomY + 12);
    } else {
      ctx.fillStyle = "rgba(251, 146, 60, 0.7)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Phase 2: Capacitor powers LED (gradually dimming)", width / 2, bottomY + 12);
    }
  }

  // ── Shared drawing helpers ──

  function drawBatteryAt(x: number, y: number): void {
    const bw = 30;
    const bh = 50;

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Positive terminal
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x - 12, y - bh / 2 - 5, 24, 5);
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("+", x, y - bh / 2 - 7);

    // Negative terminal
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(x - 8, y + bh / 2, 16, 5);
    ctx.textBaseline = "top";
    ctx.fillText("\u2212", x, y + bh / 2 + 5);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`${voltage}V`, x, y);
  }

  function drawCapacitorAt(cx: number, topY: number, plateH: number): void {
    const gap = 20;
    const plateW = 6;

    // Left plate (positive)
    const leftAlpha = 0.4 + chargeLevel * 0.5;
    ctx.fillStyle = `rgba(239, 68, 68, ${leftAlpha})`;
    ctx.fillRect(cx - gap - plateW / 2, topY, plateW, plateH);

    // Right plate (negative)
    const rightAlpha = 0.4 + chargeLevel * 0.5;
    ctx.fillStyle = `rgba(59, 130, 246, ${rightAlpha})`;
    ctx.fillRect(cx + gap - plateW / 2, topY, plateW, plateH);

    // Plate charges
    for (const ch of plateCharges) {
      const symbol = ch.side === 0 ? "+" : "\u2212";
      const color = ch.side === 0
        ? `rgba(255, 120, 120, ${ch.alpha})`
        : `rgba(120, 160, 255, ${ch.alpha})`;
      ctx.fillStyle = color;
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbol, ch.x, ch.y);
    }

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${capacitance}\u00B5F`, cx, topY + plateH + 6);
    ctx.fillText(`${(chargeLevel * voltage).toFixed(1)}V`, cx, topY + plateH + 20);
  }

  function drawLEDAt(x: number, y: number, brightness: number): void {
    const r = 14;

    // LED glow
    if (brightness > 0.02) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
      glow.addColorStop(0, `rgba(255, 80, 80, ${brightness * 0.5})`);
      glow.addColorStop(0.5, `rgba(255, 40, 40, ${brightness * 0.15})`);
      glow.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // LED body (triangle shape pointing down)
    ctx.fillStyle = `rgba(255, 60, 60, ${0.3 + brightness * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.lineTo(x - r * 0.8, y - r * 0.6);
    ctx.lineTo(x + r * 0.8, y - r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Flat edge
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, y - r * 0.6);
    ctx.lineTo(x + r * 0.8, y - r * 0.6);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("LED", x, y + r + 4);
  }

  function drawSwitchAt(x: number, y: number, closed: boolean): void {
    // Switch contacts
    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.beginPath();
    ctx.arc(x - 10, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 10, y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Switch arm
    if (closed) {
      ctx.strokeStyle = "rgba(52, 211, 153, 0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(251, 146, 60, 0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 6, y - 14);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = closed ? "rgba(52, 211, 153, 0.7)" : "rgba(251, 146, 60, 0.7)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(closed ? "CLOSED" : "OPEN", x, y + 8);
  }

  function drawResistorAt(x: number, y: number, label: string): void {
    const w = 12;
    const h = 40;

    ctx.strokeStyle = "rgba(200, 200, 200, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 2);
    ctx.stroke();

    // Zigzag inside
    ctx.strokeStyle = "rgba(200, 200, 200, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const zy = y - h / 2 + 6 + i * 8;
      ctx.moveTo(x - 4, zy);
      ctx.lineTo(x + 4, zy + 4);
      ctx.lineTo(x - 4, zy + 8);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x, y + h / 2 + 4);
  }

  function drawWireDots(direction: number): void {
    for (const wd of wireDots) {
      if (wd.speed < 0.01) continue;

      // Simple circular path around the circuit area
      const angle = wd.t * Math.PI * 2;
      const cx = width * 0.5;
      const cy = height * 0.48;
      const rx = width * 0.3;
      const ry = height * 0.25;

      const px = cx + Math.cos(angle) * rx;
      const py = cy + Math.sin(angle) * ry;

      ctx.fillStyle = `rgba(34, 211, 238, ${wd.speed * 0.6})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(34, 211, 238, ${wd.speed * 0.15})`;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawInfoPanel(): void {
    const panelH = 50;
    const panelY = height - panelH - 8;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, width - 16, panelH, 6);
    ctx.fill();

    const fontSize = Math.max(10, Math.min(12, width / 55));
    ctx.font = `${fontSize}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const y1 = panelY + 14;
    const y2 = panelY + 34;

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`V = ${voltage}V`, 16, y1);
    ctx.fillText(`C = ${capacitance}\u00B5F`, 16 + width * 0.18, y1);
    ctx.fillText(`V_cap = ${(chargeLevel * voltage).toFixed(2)}V`, 16 + width * 0.38, y1);

    ctx.fillText(`Charge: ${(chargeLevel * 100).toFixed(0)}%`, 16, y2);
    ctx.fillText(`Current: ${(currentFlow * 100).toFixed(0)}%`, 16 + width * 0.22, y2);

    const circuitNames = ["Basic Charging", "Switch Circuit", "Delay Circuit"];
    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(circuitNames[circuit] || circuitNames[0], width - 16, y1);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `${fontSize - 1}px system-ui, sans-serif`;
    ctx.fillText("Q = CV, E = \u00BDCV\u00B2", width - 16, y2);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    prevCircuit = -1;
    chargeLevel = 0;
    currentFlow = 0;
    switchState = 0;
    delayPhase = 0;
    plateCharges = [];
    initWireDots();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newCircuit = Math.round(params.circuit ?? 0);
    voltage = params.voltage ?? 3;
    capacitance = params.capacitance ?? 1000;
    speed = params.speed ?? 1;

    // Reset on circuit change
    if (newCircuit !== prevCircuit) {
      time = 0;
      chargeLevel = 0;
      currentFlow = 0;
      switchState = 0;
      delayPhase = 0;
      plateCharges = [];
      prevCircuit = newCircuit;
    }
    circuit = newCircuit;

    const adjustedDt = dt * speed;
    time += adjustedDt;

    // Circuit-specific behavior for switch toggling
    if (circuit === 1) {
      // Auto-toggle switch based on charge level
      if (switchState === 0 && chargeLevel > 0.95) {
        switchState = 1;
        time = 0;
      } else if (switchState === 1 && chargeLevel < 0.05) {
        switchState = 0;
        time = 0;
      }
    }

    // Update physics
    switch (circuit) {
      case 0:
        updateBasicCircuit(adjustedDt);
        break;
      case 1:
        updateSwitchCircuit(adjustedDt);
        break;
      case 2:
        updateDelayCircuit(adjustedDt);
        break;
      default:
        updateBasicCircuit(adjustedDt);
    }

    // Wire dot movement
    for (const wd of wireDots) {
      wd.speed = currentFlow;
      wd.t += currentFlow * adjustedDt * 0.15;
      if (wd.t > 1) wd.t -= 1;
      if (wd.t < 0) wd.t += 1;
    }

    updatePlateCharges(adjustedDt);
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();

    switch (circuit) {
      case 0:
        drawBasicCircuit();
        break;
      case 1:
        drawSwitchCircuit();
        break;
      case 2:
        drawDelayCircuit();
        break;
      default:
        drawBasicCircuit();
    }

    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    chargeLevel = 0;
    currentFlow = 0;
    switchState = 0;
    delayPhase = 0;
    plateCharges = [];
    initWireDots();
  }

  function destroy(): void {
    plateCharges = [];
    wireDots = [];
  }

  function getStateDescription(): string {
    const circuitNames = ["Basic Charging", "Switch (Charge/Discharge)", "Delay Circuit"];
    const name = circuitNames[circuit] || circuitNames[0];
    return (
      `Capacitor Application - ${name}: V = ${voltage}V, C = ${capacitance}\u00B5F. ` +
      `Capacitor voltage: ${(chargeLevel * voltage).toFixed(2)}V (${(chargeLevel * 100).toFixed(0)}% charged). ` +
      `Current flow: ${(currentFlow * 100).toFixed(0)}% of maximum. ` +
      `${circuit === 0 ? "Basic charging: LED brightness decreases as capacitor charges (current drops exponentially)." : ""}` +
      `${circuit === 1 ? `Switch circuit: ${switchState === 0 ? "charging from battery" : "discharging through resistor"}.` : ""}` +
      `${circuit === 2 ? `Delay circuit: ${delayPhase === 0 ? "battery charging capacitor" : "capacitor powering LED after disconnect, gradually dimming"}.` : ""}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default CapacitorApplicationFactory;
