import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NeuronFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("neuron") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let stimulusStrength = 50;
  let myelinThickness = 3;
  let temperature = 37;
  let showVoltageGraph = 1;

  // Action potential state
  let membranePotential = -70; // mV (resting potential)
  let actionPotentialPhase: "resting" | "depolarizing" | "repolarizing" | "hyperpolarizing" | "refractory" = "resting";
  let phaseTime = 0;
  let signalPosition = 0; // 0 to 1 along axon
  let signalActive = false;
  let stimulusCooldown = 0;

  // Voltage trace
  const voltageTrace: { t: number; v: number }[] = [];
  const MAX_TRACE = 300;

  // Neuron geometry
  const SOMA_X = 0.15;
  const SOMA_Y = 0.45;
  const SOMA_RADIUS = 35;
  const AXON_START_X = 0.22;
  const AXON_END_X = 0.85;
  const AXON_Y = 0.45;
  const TERMINAL_X = 0.88;

  // Myelin sheath nodes
  const NUM_MYELIN = 6;
  const NODE_GAP = 8;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    membranePotential = -70;
    actionPotentialPhase = "resting";
    signalPosition = 0;
    signalActive = false;
    voltageTrace.length = 0;
  }

  function triggerActionPotential(): void {
    if (stimulusStrength >= 40 && !signalActive && stimulusCooldown <= 0) {
      signalActive = true;
      signalPosition = 0;
      actionPotentialPhase = "depolarizing";
      phaseTime = 0;
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    stimulusStrength = params.stimulusStrength ?? 50;
    myelinThickness = params.myelinThickness ?? 3;
    temperature = params.temperature ?? 37;
    showVoltageGraph = params.showVoltageGraph ?? 1;

    time += dt;
    stimulusCooldown = Math.max(0, stimulusCooldown - dt);

    // Auto-trigger stimulus periodically
    if (!signalActive && stimulusCooldown <= 0) {
      triggerActionPotential();
      stimulusCooldown = 3;
    }

    // Temperature factor affects conduction velocity
    const tempFactor = 1 + (temperature - 37) * 0.04;
    // Myelination increases speed (saltatory conduction)
    const myelinFactor = 1 + myelinThickness * 0.3;
    const conductionSpeed = 0.15 * tempFactor * myelinFactor;

    if (signalActive) {
      signalPosition += dt * conductionSpeed;

      // Action potential waveform
      phaseTime += dt;
      const phaseDuration = 0.5 / tempFactor;

      switch (actionPotentialPhase) {
        case "depolarizing":
          membranePotential = -70 + (70 + 40) * Math.min(1, phaseTime / phaseDuration);
          if (phaseTime >= phaseDuration) {
            actionPotentialPhase = "repolarizing";
            phaseTime = 0;
          }
          break;
        case "repolarizing":
          membranePotential = 40 - (40 + 80) * Math.min(1, phaseTime / (phaseDuration * 1.2));
          if (phaseTime >= phaseDuration * 1.2) {
            actionPotentialPhase = "hyperpolarizing";
            phaseTime = 0;
          }
          break;
        case "hyperpolarizing":
          membranePotential = -80 + 10 * Math.min(1, phaseTime / (phaseDuration * 2));
          if (phaseTime >= phaseDuration * 2) {
            actionPotentialPhase = "resting";
            membranePotential = -70;
            phaseTime = 0;
          }
          break;
        default:
          membranePotential = -70;
      }

      if (signalPosition > 1.1) {
        signalActive = false;
        signalPosition = 0;
        actionPotentialPhase = "resting";
        membranePotential = -70;
      }
    }

    // Record voltage
    voltageTrace.push({ t: time, v: membranePotential });
    if (voltageTrace.length > MAX_TRACE) voltageTrace.shift();
  }

  function drawSoma(): void {
    const cx = width * SOMA_X;
    const cy = height * SOMA_Y;

    // Dendrites
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI + (i - 2.5) * 0.5;
      const len = 40 + Math.sin(i * 2.1) * 15;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * SOMA_RADIUS * 0.8, cy + Math.sin(angle) * SOMA_RADIUS * 0.8);

      // Branching dendrite
      const midX = cx + Math.cos(angle) * (SOMA_RADIUS + len * 0.5);
      const midY = cy + Math.sin(angle) * (SOMA_RADIUS + len * 0.5);
      const endX = cx + Math.cos(angle) * (SOMA_RADIUS + len);
      const endY = cy + Math.sin(angle) * (SOMA_RADIUS + len);
      ctx.quadraticCurveTo(midX, midY + 10, endX, endY);
      ctx.stroke();

      // Branch tips
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX + Math.cos(angle - 0.5) * 12, endY + Math.sin(angle - 0.5) * 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX + Math.cos(angle + 0.5) * 12, endY + Math.sin(angle + 0.5) * 12);
      ctx.stroke();
      ctx.lineWidth = 3;
    }

    // Cell body
    const somaGrad = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx, cy, SOMA_RADIUS);
    somaGrad.addColorStop(0, "#c4b5fd");
    somaGrad.addColorStop(0.5, "#8b5cf6");
    somaGrad.addColorStop(1, "#5b21b6");
    ctx.beginPath();
    ctx.arc(cx, cy, SOMA_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = somaGrad;
    ctx.fill();
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Nucleus
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#6d28d9";
    ctx.fill();
    ctx.strokeStyle = "#4c1d95";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Soma", cx, cy + SOMA_RADIUS + 15);
    ctx.fillText("Dendrites", cx - 50, cy - SOMA_RADIUS - 20);
  }

  function drawAxon(): void {
    const startX = width * AXON_START_X;
    const endX = width * AXON_END_X;
    const axonY = height * AXON_Y;
    const axonLength = endX - startX;

    // Axon hillock
    ctx.beginPath();
    ctx.moveTo(width * SOMA_X + SOMA_RADIUS, axonY - 8);
    ctx.lineTo(startX, axonY - 4);
    ctx.lineTo(startX, axonY + 4);
    ctx.lineTo(width * SOMA_X + SOMA_RADIUS, axonY + 8);
    ctx.fillStyle = "#7c3aed";
    ctx.fill();

    // Axon body
    ctx.fillStyle = "#475569";
    ctx.fillRect(startX, axonY - 4, axonLength, 8);

    // Myelin sheaths
    const myelinSegmentLen = axonLength / NUM_MYELIN;
    for (let i = 0; i < NUM_MYELIN; i++) {
      const mx = startX + i * myelinSegmentLen + NODE_GAP;
      const mw = myelinSegmentLen - NODE_GAP * 2;
      const mh = 8 + myelinThickness * 4;

      const myelinGrad = ctx.createLinearGradient(0, axonY - mh / 2, 0, axonY + mh / 2);
      myelinGrad.addColorStop(0, "#fbbf24");
      myelinGrad.addColorStop(0.5, "#f59e0b");
      myelinGrad.addColorStop(1, "#d97706");
      ctx.fillStyle = myelinGrad;
      ctx.beginPath();
      ctx.roundRect(mx, axonY - mh / 2, mw, mh, 4);
      ctx.fill();

      // Node of Ranvier label (only for a few)
      if (i < 3 && i > 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "8px system-ui, sans-serif";
        ctx.textAlign = "center";
        const nodeX = startX + i * myelinSegmentLen;
        ctx.fillText("Node", nodeX, axonY + mh / 2 + 12);
      }
    }

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Axon", (startX + endX) / 2, axonY + 30);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Myelin Sheath", (startX + endX) / 2, axonY - 20 - myelinThickness * 2);

    // Signal propagation
    if (signalActive && signalPosition >= 0 && signalPosition <= 1) {
      const sigX = startX + signalPosition * axonLength;
      const sigGlow = ctx.createRadialGradient(sigX, axonY, 0, sigX, axonY, 30);
      sigGlow.addColorStop(0, "rgba(34, 211, 238, 0.8)");
      sigGlow.addColorStop(0.5, "rgba(34, 211, 238, 0.3)");
      sigGlow.addColorStop(1, "transparent");
      ctx.fillStyle = sigGlow;
      ctx.beginPath();
      ctx.arc(sigX, axonY, 30, 0, Math.PI * 2);
      ctx.fill();

      // Action potential wave
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let dx = -40; dx <= 40; dx++) {
        const sx = sigX + dx;
        if (sx < startX || sx > endX) continue;
        const wave = Math.exp(-(dx * dx) / 200) * 15 * Math.sin(dx * 0.3);
        if (dx === -40) ctx.moveTo(sx, axonY + wave);
        else ctx.lineTo(sx, axonY + wave);
      }
      ctx.stroke();
    }
  }

  function drawAxonTerminal(): void {
    const tx = width * TERMINAL_X;
    const ty = height * AXON_Y;

    // Terminal branches
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const angle = -0.5 + (i / 3) * 1;
      const endX = tx + Math.cos(angle) * 40;
      const endY = ty + Math.sin(angle) * 30;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Synaptic bouton
      ctx.beginPath();
      ctx.arc(endX, endY, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#f87171";
      ctx.fill();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Neurotransmitter release when signal arrives
      if (signalActive && signalPosition > 0.95) {
        for (let j = 0; j < 3; j++) {
          const ntX = endX + Math.cos(angle) * (10 + j * 5) + Math.sin(time * 5 + j) * 3;
          const ntY = endY + Math.sin(angle) * (10 + j * 5) + Math.cos(time * 5 + j) * 3;
          ctx.beginPath();
          ctx.arc(ntX, ntY, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#fbbf24";
          ctx.fill();
        }
      }
    }

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Synaptic", tx + 25, ty + 45);
    ctx.fillText("Terminals", tx + 25, ty + 57);
  }

  function drawVoltageGraph(): void {
    if (showVoltageGraph < 1 || voltageTrace.length < 2) return;

    const gx = 40;
    const gy = height * 0.65;
    const gw = width - 80;
    const gh = height * 0.28;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Membrane Potential", gx + gw / 2, gy + 16);

    const plotLeft = gx + 50;
    const plotRight = gx + gw - 15;
    const plotTop = gy + 25;
    const plotBottom = gy + gh - 20;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // Voltage scale: -90 to +50 mV
    const vMin = -90;
    const vMax = 50;
    const vRange = vMax - vMin;

    // Reference lines
    const refs = [
      { v: -70, label: "Resting (-70 mV)", color: "#64748b" },
      { v: -55, label: "Threshold (-55 mV)", color: "#f59e0b" },
      { v: 0, label: "0 mV", color: "#475569" },
      { v: 40, label: "Peak (+40 mV)", color: "#ef4444" },
    ];

    for (const ref of refs) {
      const ry = plotBottom - ((ref.v - vMin) / vRange) * plotH;
      ctx.strokeStyle = ref.color + "40";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(plotLeft, ry);
      ctx.lineTo(plotRight, ry);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = ref.color;
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(ref.label, plotLeft - 4, ry + 3);
    }

    // Voltage trace
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const tStart = voltageTrace[0].t;
    const tEnd = voltageTrace[voltageTrace.length - 1].t;
    const tRange = Math.max(tEnd - tStart, 0.1);

    for (let i = 0; i < voltageTrace.length; i++) {
      const px = plotLeft + ((voltageTrace[i].t - tStart) / tRange) * plotW;
      const py = plotBottom - ((voltageTrace[i].v - vMin) / vRange) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Phase label
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Phase: ${actionPotentialPhase}`, plotRight, plotTop + 10);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Vm = ${membranePotential.toFixed(1)} mV`, plotRight, plotTop + 24);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Neuron — Signal Transmission & Action Potential", width / 2, 28);

    drawSoma();
    drawAxon();
    drawAxonTerminal();
    drawVoltageGraph();

    // Stimulus indicator
    const stimX = width * SOMA_X - 80;
    const stimY = height * SOMA_Y;
    ctx.fillStyle = stimulusStrength >= 40 ? "#22c55e" : "#ef4444";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      stimulusStrength >= 40 ? "Stimulus: Above threshold" : "Stimulus: Below threshold",
      stimX, stimY - 50
    );

    // Stimulus arrow
    if (stimulusStrength >= 40) {
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(stimX + 30, stimY);
      ctx.lineTo(stimX + 50, stimY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(stimX + 50, stimY);
      ctx.lineTo(stimX + 44, stimY - 4);
      ctx.lineTo(stimX + 44, stimY + 4);
      ctx.closePath();
      ctx.fillStyle = "#22c55e";
      ctx.fill();
    }
  }

  function reset(): void {
    time = 0;
    membranePotential = -70;
    actionPotentialPhase = "resting";
    signalPosition = 0;
    signalActive = false;
    stimulusCooldown = 0;
    voltageTrace.length = 0;
  }

  function destroy(): void {
    voltageTrace.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Neuron Simulation: Stimulus=${stimulusStrength}% (threshold=40%). ` +
      `Membrane potential=${membranePotential.toFixed(1)} mV, phase=${actionPotentialPhase}. ` +
      `Signal position=${(signalPosition * 100).toFixed(0)}% along axon. ` +
      `Myelin thickness=${myelinThickness}, temperature=${temperature}°C. ` +
      `Shows dendrites, soma, myelinated axon with nodes of Ranvier, ` +
      `synaptic terminals, and action potential propagation via saltatory conduction.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NeuronFactory;
