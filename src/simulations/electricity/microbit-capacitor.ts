import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Capacitor charging and discharging simulation.
 * Shows the RC circuit behavior: V(t) = V₀(1 - e^(-t/RC)) for charging,
 * V(t) = V₀ × e^(-t/RC) for discharging.
 */
const MicrobitCapacitorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("microbit-capacitor") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let voltage = 5; // V (source voltage)
  let capacitance = 100; // µF
  let resistance = 10; // kΩ
  let isCharging = 1; // 1 = charging, 0 = discharging

  let capVoltage = 0; // current capacitor voltage
  let voltageHistory: { t: number; v: number }[] = [];
  let currentHistory: { t: number; i: number }[] = [];

  function timeConstant(): number {
    // RC in seconds: R(kΩ) * C(µF) = R*1000 * C/1e6 = R*C/1000
    return (resistance * capacitance) / 1000;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      capVoltage = 0;
      voltageHistory = [];
      currentHistory = [];
    },

    update(dt: number, params: Record<string, number>) {
      const newCharging = Math.round(params.isCharging ?? 1);
      if (newCharging !== isCharging) {
        isCharging = newCharging;
        time = 0;
        voltageHistory = [];
        currentHistory = [];
        if (!isCharging) capVoltage = voltage; // start discharge from full
        else capVoltage = 0;
      }

      voltage = params.voltage ?? 5;
      capacitance = params.capacitance ?? 100;
      resistance = params.resistance ?? 10;

      time += dt;
      const tau = timeConstant();

      if (isCharging) {
        capVoltage = voltage * (1 - Math.exp(-time / tau));
      } else {
        capVoltage = voltage * Math.exp(-time / tau);
      }

      // Current: I = (V_source - V_cap) / R for charging, I = V_cap / R for discharging
      const current = isCharging
        ? ((voltage - capVoltage) / (resistance * 1000)) * 1000 // mA
        : (capVoltage / (resistance * 1000)) * 1000; // mA

      voltageHistory.push({ t: time, v: capVoltage });
      currentHistory.push({ t: time, i: current });

      // Keep limited history
      if (voltageHistory.length > 300) voltageHistory.shift();
      if (currentHistory.length > 300) currentHistory.shift();
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(`Capacitor ${isCharging ? "Charging" : "Discharging"} — RC Circuit`, W / 2, 28);

      // Draw circuit schematic (left side)
      drawCircuit();

      // Draw voltage graph (right top)
      drawGraph(
        W * 0.45, 50, W * 0.5, H * 0.35,
        voltageHistory.map((v) => ({ x: v.t, y: v.v })),
        "#38bdf8", "Voltage (V)", voltage, "V"
      );

      // Draw current graph (right bottom)
      const maxCurrent = (voltage / (resistance * 1000)) * 1000;
      drawGraph(
        W * 0.45, H * 0.48, W * 0.5, H * 0.35,
        currentHistory.map((v) => ({ x: v.t, y: v.i })),
        "#fbbf24", "Current (mA)", maxCurrent, "mA"
      );

      // Info panel
      const tau = timeConstant();
      const panelY = H - 55;
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`V_cap = ${capVoltage.toFixed(3)} V`, 16, panelY);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`τ = RC = ${tau.toFixed(3)} s`, 16, panelY + 18);

      ctx.textAlign = "right";
      ctx.fillStyle = "#22c55e";
      ctx.fillText(`t = ${time.toFixed(2)} s (${(time / tau).toFixed(1)}τ)`, W - 16, panelY);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        isCharging
          ? `V(t) = V₀(1 - e^(-t/RC))`
          : `V(t) = V₀ × e^(-t/RC)`,
        W - 16, panelY + 18
      );

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("At t = 1τ, capacitor reaches 63.2% of final voltage (charging) or 36.8% (discharging)", W / 2, H - 10);
    },

    reset() {
      time = 0;
      capVoltage = isCharging ? 0 : voltage;
      voltageHistory = [];
      currentHistory = [];
    },

    destroy() {},

    getStateDescription(): string {
      const tau = timeConstant();
      const current = isCharging
        ? ((voltage - capVoltage) / (resistance * 1000)) * 1000
        : (capVoltage / (resistance * 1000)) * 1000;
      return (
        `RC Circuit (${isCharging ? "charging" : "discharging"}): ` +
        `V₀=${voltage}V, R=${resistance}kΩ, C=${capacitance}µF, τ=RC=${tau.toFixed(3)}s. ` +
        `At t=${time.toFixed(2)}s (${(time / tau).toFixed(1)}τ): V_cap=${capVoltage.toFixed(3)}V, I=${current.toFixed(3)}mA. ` +
        `${isCharging ? "V(t) = V₀(1 - e^(-t/RC))" : "V(t) = V₀·e^(-t/RC)"}.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  function drawCircuit() {
    const cx = W * 0.2;
    const cy = H * 0.4;
    const circW = W * 0.2;
    const circH = H * 0.4;

    // Battery
    const batX = cx - circW / 2;
    const batY = cy;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;

    // Top wire
    ctx.beginPath();
    ctx.moveTo(batX, cy - circH / 2);
    ctx.lineTo(batX + circW, cy - circH / 2);
    ctx.stroke();

    // Bottom wire
    ctx.beginPath();
    ctx.moveTo(batX, cy + circH / 2);
    ctx.lineTo(batX + circW, cy + circH / 2);
    ctx.stroke();

    // Left wire (battery side)
    ctx.beginPath();
    ctx.moveTo(batX, cy - circH / 2);
    ctx.lineTo(batX, cy - 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(batX, cy + 15);
    ctx.lineTo(batX, cy + circH / 2);
    ctx.stroke();

    // Battery symbol
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(batX - 10, cy - 8);
    ctx.lineTo(batX + 10, cy - 8);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(batX - 6, cy + 8);
    ctx.lineTo(batX + 6, cy + 8);
    ctx.stroke();
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage}V`, batX, cy + 25);
    ctx.fillText("+", batX + 16, cy - 4);
    ctx.fillText("−", batX + 16, cy + 12);

    // Resistor (top)
    const resX = cx;
    const resY = cy - circH / 2;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const zigzagW = 30;
    const zigzagH = 6;
    ctx.moveTo(resX - zigzagW, resY);
    for (let i = 0; i < 6; i++) {
      const x = resX - zigzagW + (i + 0.5) * (zigzagW * 2 / 6);
      const y = resY + (i % 2 === 0 ? -zigzagH : zigzagH);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(resX + zigzagW, resY);
    ctx.stroke();
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(`R = ${resistance} kΩ`, resX, resY - 12);

    // Capacitor (right side)
    const capX = batX + circW;
    const capY = cy;
    ctx.beginPath();
    ctx.moveTo(capX, cy - circH / 2);
    ctx.lineTo(capX, cy - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(capX, cy + 10);
    ctx.lineTo(capX, cy + circH / 2);
    ctx.stroke();

    // Capacitor plates
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(capX - 10, cy - 6);
    ctx.lineTo(capX + 10, cy - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(capX - 10, cy + 6);
    ctx.lineTo(capX + 10, cy + 6);
    ctx.stroke();

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(`C = ${capacitance} µF`, capX, cy + 25);

    // Charge visualization on capacitor
    const chargeLevel = capVoltage / voltage;
    const numCharges = Math.round(chargeLevel * 6);
    ctx.font = "10px system-ui, sans-serif";
    for (let i = 0; i < numCharges; i++) {
      const offset = (i - numCharges / 2) * 4;
      ctx.fillStyle = "#ef4444";
      ctx.fillText("+", capX + offset, cy - 12);
      ctx.fillStyle = "#3b82f6";
      ctx.fillText("−", capX + offset, cy + 18);
    }

    // Current arrow
    if (time > 0) {
      const arrowY = cy - circH / 2 + 8;
      const arrowDir = isCharging ? 1 : -1;
      const arrowX = cx + arrowDir * 15;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(arrowX + arrowDir * 8, arrowY);
      ctx.lineTo(arrowX - arrowDir * 4, arrowY - 5);
      ctx.lineTo(arrowX - arrowDir * 4, arrowY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText("I", arrowX, arrowY - 8);
    }
  }

  function drawGraph(
    gx: number, gy: number, gw: number, gh: number,
    data: { x: number; y: number }[],
    color: string, label: string, maxY: number, unit: string,
  ) {
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(label, gx + 8, gy + 15);

    // Axes
    const plotX = gx + 40;
    const plotY = gy + 25;
    const plotW = gw - 55;
    const plotH = gh - 45;

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Y-axis labels
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText(`${maxY.toFixed(1)} ${unit}`, plotX - 4, plotY + 5);
    ctx.fillText("0", plotX - 4, plotY + plotH + 4);

    // Time constant markers
    const tau = timeConstant();
    const maxT = Math.max(tau * 5, 0.5);
    ctx.fillStyle = "#475569";
    ctx.textAlign = "center";
    for (let i = 1; i <= 5; i++) {
      const tx = plotX + (i * tau / maxT) * plotW;
      if (tx > plotX + plotW) break;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(tx, plotY);
      ctx.lineTo(tx, plotY + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(`${i}τ`, tx, plotY + plotH + 12);
    }

    // Plot data
    if (data.length > 1) {
      ctx.beginPath();
      let started = false;
      for (const pt of data) {
        const px = plotX + (pt.x / maxT) * plotW;
        const py = plotY + plotH - (pt.y / maxY) * plotH;
        if (px > plotX + plotW) break;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Current value dot
      const last = data[data.length - 1];
      const lx = plotX + (last.x / maxT) * plotW;
      const ly = plotY + plotH - (last.y / maxY) * plotH;
      if (lx <= plotX + plotW) {
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }

  return engine;
};

export default MicrobitCapacitorFactory;
