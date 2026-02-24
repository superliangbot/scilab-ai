import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface WireCharge {
  t: number;
  speed: number;
}

const CapacitorCharacteristicFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("capacitor-characteristic") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let voltage = 12; // V
  let resistance = 10; // kOhm
  let capacitance = 100; // uF
  let mode = 0; // 0 = Charge, 1 = Discharge

  // Physics state
  let capVoltage = 0;
  let currentAmps = 0;
  let tau = 0; // time constant in seconds
  let chargeStored = 0;
  let energyStored = 0;

  // Animated wire charges
  let wireCharges: WireCharge[] = [];

  // Graph data
  let voltageHistory: Array<{ t: number; v: number }> = [];
  const MAX_HISTORY = 300;

  let prevMode = -1;

  function initWireCharges(): void {
    wireCharges = [];
    for (let i = 0; i < 20; i++) {
      wireCharges.push({ t: i / 20, speed: 0 });
    }
  }

  function computePhysics(): void {
    const R = resistance * 1000; // kOhm to Ohm
    const C = capacitance * 1e-6; // uF to F
    tau = R * C; // seconds

    if (mode === 0) {
      // Charging: V_c(t) = V0 * (1 - e^(-t/RC))
      capVoltage = voltage * (1 - Math.exp(-time / tau));
      currentAmps = (voltage / R) * Math.exp(-time / tau);
    } else {
      // Discharging: V_c(t) = V0 * e^(-t/RC)
      capVoltage = voltage * Math.exp(-time / tau);
      currentAmps = -(voltage / R) * Math.exp(-time / tau);
    }

    chargeStored = C * capVoltage;
    energyStored = 0.5 * C * capVoltage * capVoltage;
  }

  function getWirePoint(t: number): { x: number; y: number } {
    // Circuit diagram layout (left side of screen)
    const circuitLeft = width * 0.04;
    const circuitRight = width * 0.42;
    const circuitTop = height * 0.12;
    const circuitBottom = height * 0.52;
    const battX = circuitLeft + 30;
    const resX = (circuitLeft + circuitRight) / 2;
    const capX = circuitRight - 30;

    if (t < 0.15) {
      // Battery top to resistor
      const f = t / 0.15;
      return { x: battX + f * (resX - battX), y: circuitTop };
    }
    if (t < 0.3) {
      // Resistor to capacitor top
      const f = (t - 0.15) / 0.15;
      return { x: resX + f * (capX - resX), y: circuitTop };
    }
    if (t < 0.45) {
      // Down right side to switch
      const f = (t - 0.3) / 0.15;
      return { x: capX, y: circuitTop + f * (circuitBottom - circuitTop) * 0.5 };
    }
    if (t < 0.55) {
      // Capacitor section (charges accumulate here)
      const f = (t - 0.45) / 0.1;
      return { x: capX, y: circuitTop + (circuitBottom - circuitTop) * 0.5 + f * (circuitBottom - circuitTop) * 0.5 };
    }
    if (t < 0.75) {
      // Bottom wire right to left
      const f = (t - 0.55) / 0.2;
      return { x: capX - f * (capX - battX), y: circuitBottom };
    }
    if (t < 0.9) {
      // Up left side (battery)
      const f = (t - 0.75) / 0.15;
      return { x: battX, y: circuitBottom - f * (circuitBottom - circuitTop) * 0.5 };
    }
    // Battery section
    const f = (t - 0.9) / 0.1;
    return { x: battX, y: circuitTop + (circuitBottom - circuitTop) * 0.5 * (1 - f) };
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawCircuitDiagram(): void {
    const circuitLeft = width * 0.04;
    const circuitRight = width * 0.42;
    const circuitTop = height * 0.12;
    const circuitBottom = height * 0.52;
    const battX = circuitLeft + 30;
    const resX = (circuitLeft + circuitRight) / 2;
    const capX = circuitRight - 30;

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("RC Circuit", circuitLeft, 6);

    // Wires
    ctx.strokeStyle = "rgba(100, 116, 139, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    // Top wire: battery -> resistor -> capacitor
    ctx.beginPath();
    ctx.moveTo(battX, circuitTop);
    ctx.lineTo(capX, circuitTop);
    ctx.stroke();

    // Right side: down
    ctx.beginPath();
    ctx.moveTo(capX, circuitTop);
    ctx.lineTo(capX, circuitBottom);
    ctx.stroke();

    // Bottom wire: back to battery
    ctx.beginPath();
    ctx.moveTo(capX, circuitBottom);
    ctx.lineTo(battX, circuitBottom);
    ctx.stroke();

    // Left side: up
    ctx.beginPath();
    ctx.moveTo(battX, circuitBottom);
    ctx.lineTo(battX, circuitTop);
    ctx.stroke();

    // ── Battery symbol ──
    const battCY = (circuitTop + circuitBottom) / 2;
    // Long line (positive)
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(battX - 10, battCY - 8);
    ctx.lineTo(battX + 10, battCY - 8);
    ctx.stroke();
    // Short line (negative)
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(battX - 6, battCY + 2);
    ctx.lineTo(battX + 6, battCY + 2);
    ctx.stroke();
    // Second pair
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(battX - 10, battCY + 10);
    ctx.lineTo(battX + 10, battCY + 10);
    ctx.stroke();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(battX - 6, battCY + 20);
    ctx.lineTo(battX + 6, battCY + 20);
    ctx.stroke();

    // Battery labels
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("+", battX - 14, battCY - 8);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("\u2212", battX - 14, battCY + 20);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage}V`, battX, battCY + 36);

    // ── Resistor symbol (zigzag) ──
    const resY = circuitTop;
    ctx.strokeStyle = "rgba(200, 200, 200, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(resX - 20, resY);
    const zigCount = 5;
    const zigW = 40 / zigCount;
    const zigH = 10;
    for (let i = 0; i < zigCount; i++) {
      const zx = resX - 20 + (i + 0.25) * zigW;
      ctx.lineTo(zx, resY - zigH * (i % 2 === 0 ? 1 : -1));
      const zx2 = resX - 20 + (i + 0.75) * zigW;
      ctx.lineTo(zx2, resY + zigH * (i % 2 === 0 ? 1 : -1));
    }
    ctx.lineTo(resX + 20, resY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`R = ${resistance}k\u03A9`, resX, resY + 14);

    // ── Capacitor symbol ──
    const capCY = (circuitTop + circuitBottom) / 2;
    // Two parallel lines
    ctx.strokeStyle = "rgba(200, 200, 200, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(capX - 10, capCY - 6);
    ctx.lineTo(capX + 10, capCY - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(capX - 10, capCY + 6);
    ctx.lineTo(capX + 10, capCY + 6);
    ctx.stroke();

    // Charge glow on plates
    const chargeFraction = capVoltage / (voltage || 1);
    if (chargeFraction > 0.02) {
      ctx.fillStyle = `rgba(239, 68, 68, ${chargeFraction * 0.4})`;
      ctx.fillRect(capX - 10, capCY - 9, 20, 3);
      ctx.fillStyle = `rgba(59, 130, 246, ${chargeFraction * 0.4})`;
      ctx.fillRect(capX - 10, capCY + 6, 20, 3);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`C = ${capacitance}\u00B5F`, capX, capCY + 14);

    // ── Switch symbol ──
    const switchX = (resX + capX) / 2 + 10;
    const switchY = circuitTop;

    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.beginPath();
    ctx.arc(switchX - 8, switchY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(switchX + 8, switchY, 3, 0, Math.PI * 2);
    ctx.fill();

    if (mode === 0) {
      // Closed switch (charging)
      ctx.strokeStyle = "rgba(52, 211, 153, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(switchX - 8, switchY);
      ctx.lineTo(switchX + 8, switchY);
      ctx.stroke();
    } else {
      // Open switch (discharging)
      ctx.strokeStyle = "rgba(251, 146, 60, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(switchX - 8, switchY);
      ctx.lineTo(switchX + 5, switchY - 12);
      ctx.stroke();
    }

    ctx.fillStyle = mode === 0 ? "rgba(52, 211, 153, 0.6)" : "rgba(251, 146, 60, 0.6)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(mode === 0 ? "CHARGE" : "DISCHARGE", switchX, switchY + 8);

    // ── Animated wire charges ──
    const R = resistance * 1000;
    const normalizedCurrent = Math.abs(currentAmps) / (voltage / R);
    for (const wc of wireCharges) {
      if (wc.speed < 0.01) continue;
      const pt = getWirePoint(wc.t);
      ctx.fillStyle = `rgba(34, 211, 238, ${wc.speed * 0.7})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(34, 211, 238, ${wc.speed * 0.15})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current direction arrow
    if (normalizedCurrent > 0.02) {
      ctx.fillStyle = `rgba(52, 211, 153, ${normalizedCurrent * 0.8})`;
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const dir = mode === 0 ? "\u2192" : "\u2190";
      ctx.fillText("I " + dir, resX, circuitTop - 18);
    }
  }

  function drawVoltageGraph(): void {
    // Record history
    voltageHistory.push({ t: time, v: capVoltage });
    if (voltageHistory.length > MAX_HISTORY) voltageHistory.shift();

    // Graph area (right side of screen)
    const gx = width * 0.5;
    const gy = height * 0.06;
    const gw = width * 0.47;
    const gh = height * 0.5;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Voltage vs Time", gx + 10, gy + 8);

    // Subtitle with equation
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "10px system-ui, sans-serif";
    if (mode === 0) {
      ctx.fillText("V(t) = V\u2080(1 - e^(-t/RC))", gx + 10, gy + 24);
    } else {
      ctx.fillText("V(t) = V\u2080 \u00B7 e^(-t/RC)", gx + 10, gy + 24);
    }

    // Plot area
    const padL = 50;
    const padR = 20;
    const padT = 45;
    const padB = 35;
    const plotX = gx + padL;
    const plotY = gy + padT;
    const plotW = gw - padL - padR;
    const plotH = gh - padT - padB;

    // Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${voltage}V`, plotX - 6, plotY);
    ctx.fillText("0", plotX - 6, plotY + plotH);

    // Intermediate values
    const v63 = voltage * 0.6321;
    const v95 = voltage * 0.9933;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    const y63 = plotY + plotH - (v63 / voltage) * plotH;
    ctx.fillText(`${v63.toFixed(1)}V`, plotX - 6, y63);

    // Draw 63.21% line (at tau)
    ctx.strokeStyle = "rgba(52, 211, 153, 0.2)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plotX, y63);
    ctx.lineTo(plotX + plotW, y63);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis: show time in units of tau
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Show up to 5*tau on x-axis
    const maxTime = tau * 5.5;
    for (let i = 1; i <= 5; i++) {
      const xPos = plotX + (i * tau / maxTime) * plotW;
      if (xPos > plotX + plotW) break;

      // Tau grid line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xPos, plotY);
      ctx.lineTo(xPos, plotY + plotH);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillText(`${i}\u03C4`, xPos, plotY + plotH + 4);
    }

    // Highlight tau = RC marker
    const tauX = plotX + (tau / maxTime) * plotW;
    if (tauX < plotX + plotW) {
      ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(tauX, plotY);
      ctx.lineTo(tauX, plotY + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Annotation for tau point
      ctx.fillStyle = "rgba(52, 211, 153, 0.7)";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      if (mode === 0) {
        ctx.fillText("63.21%", tauX, y63 - 4);
      } else {
        const yDischarge = plotY + plotH - (voltage * 0.3679 / voltage) * plotH;
        ctx.fillText("36.79%", tauX, yDischarge - 4);
      }
    }

    // 5*tau marker
    const tau5X = plotX + (5 * tau / maxTime) * plotW;
    if (tau5X < plotX + plotW) {
      ctx.fillStyle = "rgba(100, 200, 255, 0.5)";
      ctx.font = "8px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(mode === 0 ? "99.33%" : "0.67%", tau5X, plotY - 2);
    }

    // Draw theoretical curve (thin line)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const tVal = (i / 100) * maxTime;
      let vVal: number;
      if (mode === 0) {
        vVal = voltage * (1 - Math.exp(-tVal / tau));
      } else {
        vVal = voltage * Math.exp(-tVal / tau);
      }
      const px = plotX + (tVal / maxTime) * plotW;
      const py = plotY + plotH - (vVal / voltage) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Draw real-time data line (bright)
    if (voltageHistory.length > 1) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < voltageHistory.length; i++) {
        const entry = voltageHistory[i];
        const px = plotX + (entry.t / maxTime) * plotW;
        const py = plotY + plotH - (entry.v / voltage) * plotH;

        // Clamp to plot area
        if (px > plotX + plotW) continue;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current position dot
      const last = voltageHistory[voltageHistory.length - 1];
      const dotX = plotX + (last.t / maxTime) * plotW;
      const dotY = plotY + plotH - (last.v / voltage) * plotH;
      if (dotX <= plotX + plotW) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Value label at dot
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "9px 'SF Mono', 'Fira Code', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${capVoltage.toFixed(2)}V`, dotX + 8, dotY - 2);
      }
    }

    // X-axis label
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Time (t)", plotX + plotW / 2, plotY + plotH + 18);

    // Y-axis label
    ctx.save();
    ctx.translate(gx + 12, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("V_c (V)", 0, 0);
    ctx.restore();
  }

  function drawInfoPanel(): void {
    const panelH = 80;
    const panelY = height - panelH - 8;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, width - 16, panelH, 6);
    ctx.fill();

    const fontSize = Math.max(9, Math.min(11, width / 65));
    ctx.font = `${fontSize}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const y1 = panelY + 14;
    const y2 = panelY + 32;
    const y3 = panelY + 50;
    const y4 = panelY + 68;

    const R = resistance * 1000;

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`R = ${resistance}k\u03A9`, 16, y1);
    ctx.fillText(`C = ${capacitance}\u00B5F`, 16 + width * 0.18, y1);
    ctx.fillText(`\u03C4 = RC = ${(tau * 1000).toFixed(0)}ms = ${tau.toFixed(3)}s`, 16 + width * 0.38, y1);

    ctx.fillText(`V\u2080 = ${voltage}V`, 16, y2);
    ctx.fillText(`V_c = ${capVoltage.toFixed(3)}V`, 16 + width * 0.18, y2);
    ctx.fillText(`I = ${(Math.abs(currentAmps) * 1000).toFixed(3)}mA`, 16 + width * 0.42, y2);

    ctx.fillText(`Q = ${(chargeStored * 1e6).toFixed(2)}\u00B5C`, 16, y3);
    ctx.fillText(`E = ${(energyStored * 1000).toFixed(4)}mJ`, 16 + width * 0.2, y3);
    ctx.fillText(`t = ${time.toFixed(3)}s (${(time / tau).toFixed(2)}\u03C4)`, 16 + width * 0.42, y3);

    // Key milestones
    ctx.fillStyle = "rgba(100, 200, 255, 0.6)";
    ctx.font = `${fontSize - 1}px system-ui, sans-serif`;
    ctx.fillText("At 1\u03C4: 63.21% | 2\u03C4: 86.47% | 3\u03C4: 95.02% | 5\u03C4: 99.33%", 16, y4);

    // Mode label
    ctx.fillStyle = mode === 0 ? "rgba(52, 211, 153, 0.8)" : "rgba(251, 146, 60, 0.8)";
    ctx.font = `bold ${fontSize + 1}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(mode === 0 ? "CHARGING" : "DISCHARGING", width - 16, y1);

    // Equation
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    if (mode === 0) {
      ctx.fillText("V(t) = V\u2080(1 - e^(-t/RC))", width - 16, y2);
    } else {
      ctx.fillText("V(t) = V\u2080 \u00B7 e^(-t/RC)", width - 16, y2);
    }

    // Current percentage charged
    const pct = mode === 0 ? (capVoltage / voltage) * 100 : (capVoltage / voltage) * 100;
    ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillText(`${pct.toFixed(1)}% ${mode === 0 ? "charged" : "remaining"}`, width - 16, y3);
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
    initWireCharges();
  }

  function update(dt: number, params: Record<string, number>): void {
    voltage = params.voltage ?? 12;
    resistance = params.resistance ?? 10;
    capacitance = params.capacitance ?? 100;
    const newMode = Math.round(params.mode ?? 0);

    // Reset on mode change
    if (newMode !== prevMode) {
      time = 0;
      voltageHistory = [];
      if (newMode === 1) {
        capVoltage = voltage;
      } else {
        capVoltage = 0;
      }
      prevMode = newMode;
    }
    mode = newMode;

    time += dt;
    computePhysics();

    // Update wire charges
    const R = resistance * 1000;
    const normalizedCurrent = Math.abs(currentAmps) / (voltage / R);
    for (const wc of wireCharges) {
      wc.speed = normalizedCurrent;
      const direction = mode === 0 ? 1 : -1;
      wc.t += direction * normalizedCurrent * dt * 0.3;
      if (wc.t > 1) wc.t -= 1;
      if (wc.t < 0) wc.t += 1;
    }
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();
    drawCircuitDiagram();
    drawVoltageGraph();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    capVoltage = mode === 1 ? voltage : 0;
    currentAmps = 0;
    voltageHistory = [];
    initWireCharges();
  }

  function destroy(): void {
    wireCharges = [];
    voltageHistory = [];
  }

  function getStateDescription(): string {
    const modeStr = mode === 0 ? "charging" : "discharging";
    return (
      `RC Characteristic Curve (${modeStr}): R = ${resistance}k\u03A9, C = ${capacitance}\u00B5F, V\u2080 = ${voltage}V. ` +
      `Time constant \u03C4 = RC = ${(tau * 1000).toFixed(0)}ms. ` +
      `Current time: ${time.toFixed(3)}s (${(time / tau).toFixed(2)}\u03C4). ` +
      `Capacitor voltage: ${capVoltage.toFixed(3)}V (${((capVoltage / voltage) * 100).toFixed(1)}%). ` +
      `Current: ${(Math.abs(currentAmps) * 1000).toFixed(3)}mA. ` +
      `${mode === 0
        ? "Charging: V(t) = V\u2080(1 - e^(-t/RC)). At \u03C4: 63.21% charged, at 5\u03C4: 99.33% charged."
        : "Discharging: V(t) = V\u2080\u00B7e^(-t/RC). At \u03C4: 36.79% remaining, at 5\u03C4: 0.67% remaining."
      } ` +
      `Charge stored: ${(chargeStored * 1e6).toFixed(2)}\u00B5C. Energy: ${(energyStored * 1000).toFixed(4)}mJ.`
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

export default CapacitorCharacteristicFactory;
