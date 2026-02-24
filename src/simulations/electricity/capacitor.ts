import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface ChargeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  side: number; // 0 = left plate, 1 = right plate
  alpha: number;
}

const CapacitorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("capacitor") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let capacitance = 100; // uF
  let voltage = 12; // V
  let resistance = 100; // Ohms
  let mode = 0; // 0 = charging, 1 = discharging

  // Physics state
  let capVoltage = 0; // current capacitor voltage
  let currentAmps = 0; // current in circuit
  let tau = 0; // time constant
  let energyStored = 0;
  let chargeStored = 0;

  // Animated charges
  let charges: ChargeParticle[] = [];
  let wireCharges: Array<{ t: number; speed: number }> = [];

  // Graph data
  let voltageHistory: Array<{ t: number; v: number }> = [];
  let currentHistory: Array<{ t: number; i: number }> = [];
  const MAX_HISTORY = 200;

  // Layout
  let prevMode = -1;

  function initWireCharges(): void {
    wireCharges = [];
    for (let i = 0; i < 20; i++) {
      wireCharges.push({ t: i / 20, speed: 0 });
    }
  }

  function initPlateCharges(): void {
    charges = [];
  }

  function computePhysics(): void {
    const C = capacitance * 1e-6; // convert uF to F
    tau = resistance * C;

    if (mode === 0) {
      // Charging: V_c(t) = V0 * (1 - e^(-t/RC))
      capVoltage = voltage * (1 - Math.exp(-time / tau));
      currentAmps = (voltage / resistance) * Math.exp(-time / tau);
    } else {
      // Discharging: V_c(t) = V0 * e^(-t/RC)
      capVoltage = voltage * Math.exp(-time / tau);
      currentAmps = -(voltage / resistance) * Math.exp(-time / tau);
    }

    energyStored = 0.5 * C * capVoltage * capVoltage;
    chargeStored = C * capVoltage;
  }

  function updateCharges(dt: number): void {
    const chargeFraction = capVoltage / voltage; // 0 to 1
    const targetCount = Math.floor(chargeFraction * 30);

    // Add/remove plate charges to match target
    while (charges.length < targetCount) {
      const plateWidth = width * 0.04;
      const plateHeight = height * 0.25;
      const plateY = height * 0.35;
      const leftPlateX = width * 0.4;
      const rightPlateX = width * 0.6;

      const side = charges.length % 2;
      const baseX = side === 0 ? leftPlateX + plateWidth * 0.3 : rightPlateX - plateWidth * 0.3;

      charges.push({
        x: baseX + (Math.random() - 0.5) * plateWidth * 0.5,
        y: plateY + Math.random() * plateHeight,
        vx: 0,
        vy: 0,
        side,
        alpha: 0,
      });
    }
    while (charges.length > targetCount && charges.length > 0) {
      charges.pop();
    }

    // Animate charge alpha
    for (const ch of charges) {
      ch.alpha = Math.min(1, ch.alpha + dt * 3);
      // Slight jitter
      ch.x += (Math.random() - 0.5) * 0.3;
      ch.y += (Math.random() - 0.5) * 0.3;
    }

    // Move wire charges
    const speed = Math.abs(currentAmps) / (voltage / resistance); // normalized 0-1
    for (const wc of wireCharges) {
      wc.speed = speed;
      const direction = mode === 0 ? 1 : -1;
      wc.t += direction * speed * dt * 0.3;
      if (wc.t > 1) wc.t -= 1;
      if (wc.t < 0) wc.t += 1;
    }
  }

  function getWirePoint(t: number): { x: number; y: number } {
    // Circuit path: battery (left) -> top wire -> left plate -> gap -> right plate -> bottom wire -> battery
    const battX = width * 0.15;
    const battY = height * 0.47;
    const topY = height * 0.25;
    const bottomY = height * 0.7;
    const leftPlateX = width * 0.4;
    const rightPlateX = width * 0.6;
    const bulbX = width * 0.85;

    // Segments: 0-0.15: battery up, 0.15-0.35: top wire right to left plate,
    // 0.35-0.5: skip (gap between plates), 0.5-0.7: right plate to top wire right,
    // 0.7-0.85: top wire to bulb, 0.85-1.0: bulb down and bottom wire back

    if (t < 0.1) {
      // Battery to top
      const f = t / 0.1;
      return { x: battX, y: battY - f * (battY - topY) };
    }
    if (t < 0.3) {
      // Top wire to left plate
      const f = (t - 0.1) / 0.2;
      return { x: battX + f * (leftPlateX - battX), y: topY };
    }
    if (t < 0.4) {
      // Down left plate
      const f = (t - 0.3) / 0.1;
      return { x: leftPlateX, y: topY + f * (height * 0.35 - topY) };
    }
    // Skip the gap (charges don't cross it)
    if (t < 0.5) {
      // Up right plate
      const f = (t - 0.4) / 0.1;
      return { x: rightPlateX, y: height * 0.35 + (1 - f) * (height * 0.6 - height * 0.35) };
    }
    if (t < 0.7) {
      // Right plate to bulb via top
      const f = (t - 0.5) / 0.2;
      return { x: rightPlateX + f * (bulbX - rightPlateX), y: topY };
    }
    if (t < 0.85) {
      // Bulb down
      const f = (t - 0.7) / 0.15;
      return { x: bulbX, y: topY + f * (bottomY - topY) };
    }
    // Bottom wire back to battery
    const f = (t - 0.85) / 0.15;
    return { x: bulbX - f * (bulbX - battX), y: bottomY };
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawBattery(): void {
    const x = width * 0.15;
    const y = height * 0.47;
    const bw = 30;
    const bh = 50;

    // Battery body
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Positive terminal
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x - 12, y - bh / 2 - 6, 24, 6);
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("+", x, y - bh / 2 - 8);

    // Negative terminal
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(x - 8, y + bh / 2, 16, 6);
    ctx.fillStyle = "#3b82f6";
    ctx.textBaseline = "top";
    ctx.fillText("-", x, y + bh / 2 + 6);

    // Voltage label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`${voltage}V`, x, y);

    // Mode indicator label for charging
    if (mode === 0) {
      ctx.fillStyle = "rgba(52, 211, 153, 0.7)";
    } else {
      ctx.fillStyle = "rgba(156, 163, 175, 0.5)";
    }
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(mode === 0 ? "SOURCE" : "OFF", x, y + bh / 2 + 22);
  }

  function drawCapacitor(): void {
    const leftX = width * 0.4;
    const rightX = width * 0.6;
    const topY = height * 0.3;
    const plateH = height * 0.35;
    const plateW = 6;

    // Electric field lines between plates (proportional to charge)
    const fieldStrength = capVoltage / voltage;
    if (fieldStrength > 0.05) {
      const numFieldLines = 8;
      for (let i = 0; i < numFieldLines; i++) {
        const fy = topY + (i + 0.5) * plateH / numFieldLines;
        ctx.strokeStyle = `rgba(100, 200, 255, ${fieldStrength * 0.15})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(leftX + plateW + 4, fy);
        ctx.lineTo(rightX - plateW - 4, fy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        const arrowX = (leftX + rightX) / 2;
        ctx.fillStyle = `rgba(100, 200, 255, ${fieldStrength * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(arrowX + 5, fy);
        ctx.lineTo(arrowX - 3, fy - 3);
        ctx.lineTo(arrowX - 3, fy + 3);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Left plate (positive when charging)
    const leftColor = mode === 0 ? `rgba(239, 68, 68, ${0.4 + fieldStrength * 0.6})` : `rgba(239, 68, 68, ${0.3 + fieldStrength * 0.5})`;
    ctx.fillStyle = leftColor;
    ctx.fillRect(leftX - plateW / 2, topY, plateW, plateH);

    // Glow on left plate
    const leftGlow = ctx.createRadialGradient(leftX, topY + plateH / 2, 0, leftX, topY + plateH / 2, plateH * 0.4);
    leftGlow.addColorStop(0, `rgba(239, 68, 68, ${fieldStrength * 0.15})`);
    leftGlow.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = leftGlow;
    ctx.fillRect(leftX - plateH * 0.4, topY - plateH * 0.1, plateH * 0.8, plateH * 1.2);

    // Right plate (negative when charging)
    const rightColor = mode === 0 ? `rgba(59, 130, 246, ${0.4 + fieldStrength * 0.6})` : `rgba(59, 130, 246, ${0.3 + fieldStrength * 0.5})`;
    ctx.fillStyle = rightColor;
    ctx.fillRect(rightX - plateW / 2, topY, plateW, plateH);

    // Glow on right plate
    const rightGlow = ctx.createRadialGradient(rightX, topY + plateH / 2, 0, rightX, topY + plateH / 2, plateH * 0.4);
    rightGlow.addColorStop(0, `rgba(59, 130, 246, ${fieldStrength * 0.15})`);
    rightGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = rightGlow;
    ctx.fillRect(rightX - plateH * 0.4, topY - plateH * 0.1, plateH * 0.8, plateH * 1.2);

    // Plate charges (+ and -)
    for (const ch of charges) {
      const symbol = ch.side === 0 ? "+" : "-";
      const color = ch.side === 0 ? `rgba(255, 120, 120, ${ch.alpha})` : `rgba(120, 160, 255, ${ch.alpha})`;

      ctx.fillStyle = color;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbol, ch.x, ch.y);
    }

    // Capacitor label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`C = ${capacitance}\u00B5F`, (leftX + rightX) / 2, topY + plateH + 20);
    ctx.fillText(`V_c = ${capVoltage.toFixed(2)}V`, (leftX + rightX) / 2, topY + plateH + 36);
  }

  function drawLightBulb(): void {
    const x = width * 0.85;
    const y = height * 0.47;
    const r = 18;

    // Bulb brightness proportional to current (squared for power)
    const brightness = Math.min(1, Math.pow(Math.abs(currentAmps) / (voltage / resistance), 2));

    // Glow
    if (brightness > 0.01) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, `rgba(255, 240, 150, ${brightness * 0.4})`);
      glow.addColorStop(0.5, `rgba(255, 200, 50, ${brightness * 0.15})`);
      glow.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bulb body
    const bulbGrad = ctx.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
    bulbGrad.addColorStop(0, `rgba(255, 255, ${Math.floor(200 + brightness * 55)}, ${0.3 + brightness * 0.7})`);
    bulbGrad.addColorStop(0.7, `rgba(200, 180, 100, ${0.2 + brightness * 0.3})`);
    bulbGrad.addColorStop(1, "rgba(100, 100, 80, 0.2)");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bulbGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Filament
    ctx.strokeStyle = `rgba(255, 200, 100, ${0.3 + brightness * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 5);
    ctx.lineTo(x - 3, y - 5);
    ctx.lineTo(x + 3, y + 5);
    ctx.lineTo(x + 6, y - 5);
    ctx.stroke();

    // Bulb base
    ctx.fillStyle = "rgba(180, 180, 180, 0.4)";
    ctx.fillRect(x - 8, y + r, 16, 10);

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("R = " + resistance + "\u03A9", x, y + r + 16);
  }

  function drawWires(): void {
    const battX = width * 0.15;
    const topY = height * 0.25;
    const bottomY = height * 0.7;
    const leftPlateX = width * 0.4;
    const rightPlateX = width * 0.6;
    const bulbX = width * 0.85;
    const battTopY = height * 0.47 - 25;
    const battBotY = height * 0.47 + 25;

    ctx.strokeStyle = "rgba(100, 116, 139, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Top wire: battery to left plate
    ctx.beginPath();
    ctx.moveTo(battX, battTopY);
    ctx.lineTo(battX, topY);
    ctx.lineTo(leftPlateX, topY);
    ctx.lineTo(leftPlateX, height * 0.3);
    ctx.stroke();

    // Right plate up to top wire, to bulb
    ctx.beginPath();
    ctx.moveTo(rightPlateX, height * 0.3);
    ctx.lineTo(rightPlateX, topY);
    ctx.lineTo(bulbX, topY);
    ctx.lineTo(bulbX, height * 0.47 - 18);
    ctx.stroke();

    // Bulb to bottom wire back to battery
    ctx.beginPath();
    ctx.moveTo(bulbX, height * 0.47 + 28);
    ctx.lineTo(bulbX, bottomY);
    ctx.lineTo(battX, bottomY);
    ctx.lineTo(battX, battBotY);
    ctx.stroke();

    // Switch indicator
    const switchX = (battX + leftPlateX) / 2;
    ctx.fillStyle = mode === 0 ? "rgba(52, 211, 153, 0.8)" : "rgba(239, 68, 68, 0.8)";
    ctx.beginPath();
    ctx.arc(switchX, topY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(mode === 0 ? "CHARGE" : "DISCHARGE", switchX, topY + 10);

    // Animated wire charges
    for (const wc of wireCharges) {
      if (wc.speed < 0.01) continue;
      const pt = getWirePoint(wc.t);
      ctx.fillStyle = `rgba(34, 211, 238, ${wc.speed * 0.7})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.fillStyle = `rgba(34, 211, 238, ${wc.speed * 0.2})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current direction arrow
    const arrowSpeed = Math.abs(currentAmps) / (voltage / resistance);
    if (arrowSpeed > 0.02) {
      ctx.fillStyle = `rgba(52, 211, 153, ${arrowSpeed * 0.8})`;
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const dir = mode === 0 ? "\u2192" : "\u2190";
      ctx.fillText("I " + dir, (leftPlateX + battX) / 2, topY - 14);
    }
  }

  function drawGraphs(): void {
    // Record history
    voltageHistory.push({ t: time, v: capVoltage });
    currentHistory.push({ t: time, i: Math.abs(currentAmps) * 1000 }); // mA
    if (voltageHistory.length > MAX_HISTORY) voltageHistory.shift();
    if (currentHistory.length > MAX_HISTORY) currentHistory.shift();

    const graphW = width * 0.35;
    const graphH = height * 0.15;
    const graphX = width * 0.05;
    const graphY1 = height * 0.78;
    const graphY2 = height * 0.78;
    const graphX2 = width * 0.55;

    // Voltage graph
    drawGraph(graphX, graphY1, graphW, graphH, voltageHistory.map(h => h.v), voltage, "V_c (V)", "#ef4444", "Capacitor Voltage");

    // Current graph
    const maxCurrent = (voltage / resistance) * 1000; // mA
    drawGraph(graphX2, graphY2, graphW, graphH, currentHistory.map(h => h.i), maxCurrent, "I (mA)", "#22d3ee", "Current");
  }

  function drawGraph(
    gx: number, gy: number, gw: number, gh: number,
    data: number[], maxVal: number, yLabel: string, color: string, title: string
  ): void {
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, gx + 6, gy + 4);

    // Y-axis label
    ctx.fillStyle = color;
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(maxVal.toFixed(1), gx + gw - 4, gy + 4);
    ctx.fillText("0", gx + gw - 4, gy + gh - 12);

    // Grid line at tau
    if (tau > 0 && data.length > 1) {
      const tauFraction = tau / (time || 1);
      if (tauFraction < 1 && tauFraction > 0) {
        const tauX = gx + gw * (1 - tauFraction);
        if (tauX > gx && tauX < gx + gw) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(tauX, gy);
          ctx.lineTo(tauX, gy + gh);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Data line
    if (data.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const padding = 4;
    const plotW = gw - padding * 2;
    const plotH = gh - padding * 2 - 10;

    for (let i = 0; i < data.length; i++) {
      const x = gx + padding + (i / (data.length - 1)) * plotW;
      const y = gy + gh - padding - (data[i] / (maxVal || 1)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Current value dot
    if (data.length > 0) {
      const lastX = gx + padding + plotW;
      const lastY = gy + gh - padding - (data[data.length - 1] / (maxVal || 1)) * plotH;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInfoPanel(): void {
    const panelH = 48;
    const panelY = height - panelH - 6;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, width - 16, panelH, 6);
    ctx.fill();

    const fontSize = Math.max(10, Math.min(12, width / 60));
    ctx.font = `${fontSize}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const y1 = panelY + 14;
    const y2 = panelY + 34;

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`\u03C4 = RC = ${(tau * 1000).toFixed(1)}ms`, 16, y1);
    ctx.fillText(`V_c = ${capVoltage.toFixed(2)}V`, 16 + width * 0.22, y1);
    ctx.fillText(`I = ${(Math.abs(currentAmps) * 1000).toFixed(2)}mA`, 16 + width * 0.44, y1);

    ctx.fillText(`Q = ${(chargeStored * 1e6).toFixed(1)}\u00B5C`, 16, y2);
    ctx.fillText(`E = ${(energyStored * 1000).toFixed(3)}mJ`, 16 + width * 0.22, y2);
    ctx.fillText(`t = ${time.toFixed(2)}s  (${(time / tau).toFixed(1)}\u03C4)`, 16 + width * 0.44, y2);

    // Mode
    ctx.fillStyle = mode === 0 ? "rgba(52, 211, 153, 0.8)" : "rgba(251, 146, 60, 0.8)";
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(mode === 0 ? "CHARGING" : "DISCHARGING", width - 16, y1);

    // Equations
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `${fontSize - 1}px system-ui, sans-serif`;
    if (mode === 0) {
      ctx.fillText("V = V\u2080(1 - e^(-t/RC))", width - 16, y2);
    } else {
      ctx.fillText("V = V\u2080 \u00B7 e^(-t/RC)", width - 16, y2);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    prevMode = -1;
    capVoltage = 0;
    currentAmps = 0;
    voltageHistory = [];
    currentHistory = [];
    initWireCharges();
    initPlateCharges();
  }

  function update(dt: number, params: Record<string, number>): void {
    capacitance = params.capacitance ?? 100;
    voltage = params.voltage ?? 12;
    resistance = params.resistance ?? 100;
    const newMode = Math.round(params.mode ?? 0);

    // Reset time when mode changes
    if (newMode !== prevMode) {
      time = 0;
      voltageHistory = [];
      currentHistory = [];
      if (newMode === 1) {
        // Start discharge from full charge
        capVoltage = voltage;
      } else {
        capVoltage = 0;
      }
      prevMode = newMode;
    }
    mode = newMode;

    time += dt;
    computePhysics();
    updateCharges(dt);
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();
    drawWires();
    drawBattery();
    drawCapacitor();
    drawLightBulb();
    drawGraphs();
    drawInfoPanel();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("RC Circuit - Capacitor", 12, 8);
  }

  function reset(): void {
    time = 0;
    capVoltage = mode === 1 ? voltage : 0;
    currentAmps = 0;
    voltageHistory = [];
    currentHistory = [];
    charges = [];
    initWireCharges();
  }

  function destroy(): void {
    charges = [];
    wireCharges = [];
    voltageHistory = [];
    currentHistory = [];
  }

  function getStateDescription(): string {
    const modeStr = mode === 0 ? "charging" : "discharging";
    return (
      `Capacitor Circuit (${modeStr}): C = ${capacitance}\u00B5F, V\u2080 = ${voltage}V, R = ${resistance}\u03A9. ` +
      `Time constant \u03C4 = RC = ${(tau * 1000).toFixed(1)}ms. ` +
      `Current time: ${time.toFixed(2)}s (${(time / tau).toFixed(1)}\u03C4). ` +
      `Capacitor voltage: ${capVoltage.toFixed(2)}V. ` +
      `Current: ${(Math.abs(currentAmps) * 1000).toFixed(2)}mA. ` +
      `Charge stored: ${(chargeStored * 1e6).toFixed(1)}\u00B5C. ` +
      `Energy stored: ${(energyStored * 1000).toFixed(3)}mJ. ` +
      `${mode === 0 ? "Charging equation: V_c(t) = V\u2080(1 - e^(-t/RC))" : "Discharging equation: V_c(t) = V\u2080 \u00B7 e^(-t/RC)"}.`
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

export default CapacitorFactory;
