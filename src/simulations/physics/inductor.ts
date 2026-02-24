import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const InductorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("inductor") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 3; // V
  let inductance = 330; // μH
  let resistance = 100; // Ω

  let switchOn = false;
  let switchTime = 0;
  let current = 0;
  let ledBrightness = 0;
  let prevSwitchState = false;

  // Track current history for graph
  const currentHistory: { t: number; i: number }[] = [];
  const MAX_HISTORY = 200;

  function getTimeConstant(): number {
    // tau = L/R in seconds
    return (inductance * 1e-6) / resistance;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },

    update(dt: number, params: Record<string, number>) {
      voltage = params.voltage ?? 3;
      inductance = params.inductance ?? 330;
      resistance = params.resistance ?? 100;

      const newSwitch = (params.switchOn ?? 0) >= 1;
      if (newSwitch !== prevSwitchState) {
        switchTime = time;
        prevSwitchState = newSwitch;
      }
      switchOn = newSwitch;

      // RL circuit transient behavior
      const tau = getTimeConstant();
      const elapsed = time - switchTime;
      const iSteady = voltage / resistance;

      if (switchOn) {
        // Switch just turned on: I(t) = (V/R)(1 - e^(-t/tau))
        current = iSteady * (1 - Math.exp(-elapsed / tau));
      } else {
        // Switch turned off: I(t) = I_0 * e^(-t/tau)
        // I_0 is whatever current was when switch turned off
        const i0 = iSteady * (1 - Math.exp(-(switchTime > 0 ? switchTime : 0.01) / tau));
        current = i0 * Math.exp(-elapsed / tau);
      }

      // LED brightness proportional to current
      ledBrightness = Math.min(1, current / iSteady);

      // Record history
      currentHistory.push({ t: time, i: current });
      while (currentHistory.length > MAX_HISTORY) currentHistory.shift();

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Inductor in RL Circuit", width / 2, 28);

      ctx.fillStyle = "#889";
      ctx.font = "12px monospace";
      ctx.fillText(`V_L = L · dI/dt  |  τ = L/R = ${(getTimeConstant() * 1000).toFixed(3)} ms`, width / 2, 48);

      // Draw circuit
      drawCircuit();

      // Draw current graph
      drawGraph();

      // Draw info panel
      drawInfo();
    },

    reset() {
      time = 0;
      switchTime = 0;
      current = 0;
      ledBrightness = 0;
      currentHistory.length = 0;
    },

    destroy() {
      currentHistory.length = 0;
    },

    getStateDescription() {
      const tau = getTimeConstant();
      const iSteady = voltage / resistance;
      return `RL circuit: V=${voltage}V, L=${inductance}μH, R=${resistance}Ω. Switch ${switchOn ? "ON" : "OFF"}. Current=${(current * 1000).toFixed(2)}mA (steady-state: ${(iSteady * 1000).toFixed(2)}mA). τ=${(tau * 1000).toFixed(3)}ms. V_L=L·dI/dt opposes current changes (Lenz's law).`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawCircuit() {
    const cx = width * 0.3;
    const cy = height * 0.4;
    const circW = width * 0.35;
    const circH = height * 0.35;

    // Battery
    const battX = cx - circW / 2;
    const battY = cy;

    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;

    // Top wire from battery to switch
    ctx.beginPath();
    ctx.moveTo(battX, battY - circH / 2);
    ctx.lineTo(battX + circW * 0.3, battY - circH / 2);
    ctx.stroke();

    // Switch
    const swX = battX + circW * 0.3;
    const swY = battY - circH / 2;
    const swLen = circW * 0.15;

    if (switchOn) {
      ctx.strokeStyle = "#44ff88";
      ctx.beginPath();
      ctx.moveTo(swX, swY);
      ctx.lineTo(swX + swLen, swY);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#ff6644";
      ctx.beginPath();
      ctx.moveTo(swX, swY);
      ctx.lineTo(swX + swLen * 0.8, swY - 12);
      ctx.stroke();
    }

    // Contact points
    ctx.fillStyle = switchOn ? "#44ff88" : "#ff6644";
    ctx.beginPath();
    ctx.arc(swX, swY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(swX + swLen, swY, 3, 0, Math.PI * 2);
    ctx.fill();

    // From switch to inductor
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(swX + swLen, battY - circH / 2);
    ctx.lineTo(battX + circW * 0.65, battY - circH / 2);
    ctx.stroke();

    // Inductor symbol
    const indX = battX + circW * 0.65;
    const indEndX = battX + circW;
    const indY = battY - circH / 2;

    ctx.strokeStyle = "#cc88ff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const coilCount = 5;
    const coilW = (indEndX - indX) / coilCount;
    for (let i = 0; i < coilCount; i++) {
      const x = indX + i * coilW;
      ctx.moveTo(x, indY);
      ctx.arc(x + coilW / 2, indY, coilW / 2, Math.PI, 0, false);
    }
    ctx.stroke();

    // From inductor corner down
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(indEndX, indY);
    ctx.lineTo(battX + circW, indY);
    ctx.lineTo(battX + circW, battY + circH / 2);
    ctx.stroke();

    // Resistor symbol
    const resX = battX + circW;
    const resY = battY + circH / 2;
    const resEndX = battX + circW * 0.5;

    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(resX, resY);
    ctx.lineTo(resEndX, resY);
    ctx.stroke();

    // Zigzag resistor
    const zigCount = 6;
    const zigW = (resX - resEndX) / zigCount;
    const zigH = 8;
    ctx.strokeStyle = "#ffaa44";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(resEndX, resY);
    for (let i = 0; i < zigCount; i++) {
      const x1 = resEndX + (i + 0.25) * zigW;
      const x2 = resEndX + (i + 0.75) * zigW;
      ctx.lineTo(x1, resY - zigH);
      ctx.lineTo(x2, resY + zigH);
    }
    ctx.lineTo(resX, resY);
    ctx.stroke();

    // LED
    const ledX = battX + circW * 0.3;
    const ledY = battY + circH / 2;

    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(resEndX, resY);
    ctx.lineTo(ledX, ledY);
    ctx.stroke();

    // LED triangle
    const ledR = 12;
    ctx.fillStyle = `rgba(255,50,50,${0.3 + ledBrightness * 0.7})`;
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ledX - ledR, ledY - ledR / 2);
    ctx.lineTo(ledX - ledR, ledY + ledR / 2);
    ctx.lineTo(ledX + ledR / 2, ledY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // LED glow
    if (ledBrightness > 0.1) {
      const glow = ctx.createRadialGradient(ledX, ledY, 0, ledX, ledY, 25 * ledBrightness);
      glow.addColorStop(0, `rgba(255,50,50,${ledBrightness * 0.5})`);
      glow.addColorStop(1, "rgba(255,50,50,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ledX, ledY, 25 * ledBrightness, 0, Math.PI * 2);
      ctx.fill();
    }

    // LED line to battery
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ledX, ledY);
    ctx.lineTo(battX, ledY);
    ctx.lineTo(battX, battY - circH / 2);
    ctx.stroke();

    // Battery symbol
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(battX - 1, battY - 10);
    ctx.lineTo(battX - 1, battY + 10);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(battX + 5, battY - 6);
    ctx.lineTo(battX + 5, battY + 6);
    ctx.stroke();

    ctx.fillStyle = "#ccc";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage}V`, battX, battY + 22);

    // Component labels
    ctx.fillStyle = "#cc88ff";
    ctx.font = "10px sans-serif";
    ctx.fillText(`L=${inductance}μH`, (indX + indEndX) / 2, indY - 12);

    ctx.fillStyle = "#ffaa44";
    ctx.fillText(`R=${resistance}Ω`, (resEndX + resX) / 2, resY - 16);

    ctx.fillStyle = switchOn ? "#44ff88" : "#ff6644";
    ctx.fillText(switchOn ? "CLOSED" : "OPEN", swX + swLen / 2, swY - 16);

    // Current flow dots
    if (current > 0.001) {
      ctx.fillStyle = "#ffff44";
      const dotSpeed = current * 200;
      const dotPhase = (time * dotSpeed) % 1;

      // Dots flowing around circuit
      for (let d = 0; d < 6; d++) {
        const phase = (dotPhase + d / 6) % 1;
        let dx: number, dy: number;

        if (phase < 0.25) {
          // Top wire
          const p = phase / 0.25;
          dx = battX + p * circW;
          dy = battY - circH / 2;
        } else if (phase < 0.5) {
          // Right side down
          const p = (phase - 0.25) / 0.25;
          dx = battX + circW;
          dy = battY - circH / 2 + p * circH;
        } else if (phase < 0.75) {
          // Bottom wire
          const p = (phase - 0.5) / 0.25;
          dx = battX + circW - p * circW;
          dy = battY + circH / 2;
        } else {
          // Left side up
          const p = (phase - 0.75) / 0.25;
          dx = battX;
          dy = battY + circH / 2 - p * circH;
        }

        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(dx, dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawGraph() {
    const graphX = width * 0.6;
    const graphY = 70;
    const graphW = width * 0.36;
    const graphH = height * 0.35;

    ctx.fillStyle = "rgba(15,20,35,0.8)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(graphX, graphY, graphW, graphH, 8);
    ctx.fill();
    ctx.stroke();

    const plotX = graphX + 50;
    const plotY = graphY + 20;
    const plotW = graphW - 65;
    const plotH = graphH - 40;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Current vs Time", graphX + graphW / 2, graphY + 14);

    // Axes
    ctx.strokeStyle = "#445";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#778";
    ctx.font = "9px sans-serif";
    ctx.save();
    ctx.translate(graphX + 12, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("I (mA)", 0, 0);
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillText("Time", plotX + plotW / 2, plotY + plotH + 13);

    // Steady state line
    const iSteady = voltage / resistance;
    ctx.strokeStyle = "rgba(255,200,100,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const steadyY = plotY + plotH - (1 * plotH);
    ctx.moveTo(plotX, steadyY);
    ctx.lineTo(plotX + plotW, steadyY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ffcc88";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${(iSteady * 1000).toFixed(1)}mA`, plotX - 3, steadyY + 3);

    // Current history
    if (currentHistory.length > 1) {
      const maxI = iSteady * 1.2;
      ctx.strokeStyle = "#44aaff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < currentHistory.length; i++) {
        const x = plotX + (i / MAX_HISTORY) * plotW;
        const y = plotY + plotH - (currentHistory[i].i / maxI) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawInfo() {
    const panelX = width * 0.6;
    const panelY = height * 0.52;
    const panelW = width * 0.36;
    const panelH = height * 0.42;

    ctx.fillStyle = "rgba(10,15,30,0.85)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("RL Circuit Analysis", panelX + 12, panelY + 20);

    const tau = getTimeConstant();
    const iSteady = voltage / resistance;
    const vL = inductance * 1e-6 * (current / (tau + 0.0001)); // Approximate dI/dt

    ctx.fillStyle = "#aabbcc";
    ctx.font = "11px monospace";
    const lines = [
      `τ = L/R = ${(tau * 1e6).toFixed(1)} μs`,
      `I_steady = V/R = ${(iSteady * 1000).toFixed(2)} mA`,
      `I_now = ${(current * 1000).toFixed(3)} mA`,
      `V_L = L·dI/dt`,
      ``,
      `Switch ON:`,
      `  I(t) = (V/R)(1-e^(-t/τ))`,
      `Switch OFF:`,
      `  I(t) = I₀·e^(-t/τ)`,
      ``,
      `Lenz's Law: Induced EMF`,
      `opposes change in current`,
    ];

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], panelX + 12, panelY + 38 + i * 16);
    }
  }

  return engine;
};

export default InductorFactory;
