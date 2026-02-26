import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const neuralSignalTransmissionFactory: SimulationFactory = () => {
  const config = getSimConfig("neural-signal-transmission")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let stimulusStrength = 50;
  let myelinThickness = 1;
  let temperature = 37;
  let nodeSpacing = 100;

  // Action potential state
  let actionPotentialPos = -1; // position along axon (0-1), -1 = not firing
  let membranePotential = -70; // mV (resting)
  let firing = false;
  let lastFireTime = 0;

  // Voltage history for plot
  const voltageHistory: number[] = [];
  const maxVoltagePoints = 400;

  // Hodgkin-Huxley simplified: threshold ~-55mV, peak ~+40mV, repolarization
  function actionPotentialVoltage(phase: number): number {
    if (phase < 0 || phase > 1) return -70;
    // Depolarization
    if (phase < 0.1) return -70 + (110) * (phase / 0.1);
    // Peak
    if (phase < 0.15) return 40;
    // Repolarization
    if (phase < 0.4) return 40 - (120) * ((phase - 0.15) / 0.25);
    // Hyperpolarization
    if (phase < 0.6) return -80 + (10) * ((phase - 0.4) / 0.2);
    // Recovery
    return -70;
  }

  // Conduction velocity: affected by myelin and temperature
  function conductionVelocity(): number {
    // Myelinated: ~120 m/s, unmyelinated: ~2 m/s
    const baseVelocity = 2 + myelinThickness * 58; // m/s
    // Q10 rule: velocity increases ~1.5× per 10°C
    const tempFactor = Math.pow(1.5, (temperature - 37) / 10);
    return baseVelocity * tempFactor;
  }

  function drawNeuron() {
    const neuronY = H * 0.32;
    const startX = W * 0.05;
    const endX = W * 0.75;
    const axonLen = endX - startX;

    // Cell body (soma)
    const somaX = startX + 20;
    const somaR = 25;
    const grad = ctx.createRadialGradient(somaX - 5, neuronY - 5, 0, somaX, neuronY, somaR);
    grad.addColorStop(0, "#c084fc");
    grad.addColorStop(0.7, "#7c3aed");
    grad.addColorStop(1, "#4c1d95");
    ctx.beginPath();
    ctx.arc(somaX, neuronY, somaR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Nucleus
    ctx.beginPath();
    ctx.arc(somaX, neuronY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#a78bfa";
    ctx.fill();

    ctx.font = "10px Arial";
    ctx.fillStyle = "#c4b5fd";
    ctx.textAlign = "center";
    ctx.fillText("Soma", somaX, neuronY + somaR + 14);

    // Dendrites
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI + (i - 2) * 0.4;
      ctx.beginPath();
      ctx.moveTo(somaX + Math.cos(angle) * somaR, neuronY + Math.sin(angle) * somaR);
      const len = 20 + Math.random() * 15;
      ctx.lineTo(somaX + Math.cos(angle) * (somaR + len), neuronY + Math.sin(angle) * (somaR + len));
      ctx.stroke();
    }

    // Axon
    const axonStartX = somaX + somaR;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(axonStartX, neuronY);
    ctx.lineTo(endX, neuronY);
    ctx.stroke();

    // Myelin sheath segments (Nodes of Ranvier between)
    if (myelinThickness > 0.1) {
      const numNodes = Math.max(2, Math.round((axonLen - 60) / nodeSpacing));
      const segLen = (endX - axonStartX) / (numNodes + 1);

      for (let i = 0; i <= numNodes; i++) {
        const sx = axonStartX + i * segLen + 5;
        const sw = segLen - 10;
        if (sw <= 0) continue;

        // Myelin
        const myelinH = 6 + myelinThickness * 6;
        ctx.fillStyle = "rgba(250, 204, 21, 0.4)";
        ctx.beginPath();
        ctx.roundRect(sx, neuronY - myelinH, sw, myelinH * 2, 4);
        ctx.fill();

        // Node of Ranvier label (gap)
        if (i < numNodes) {
          const nodeX = sx + sw;
          ctx.fillStyle = "#f59e0b";
          ctx.beginPath();
          ctx.arc(nodeX + 5, neuronY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.font = "9px Arial";
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "center";
      ctx.fillText("Myelin Sheath", (axonStartX + endX) / 2, neuronY - 20 - myelinThickness * 6);
      ctx.fillText("Nodes of Ranvier (gaps)", (axonStartX + endX) / 2, neuronY + 22 + myelinThickness * 6);
    }

    // Axon terminal
    ctx.fillStyle = "#22c55e";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(endX + 15, neuronY + i * 12, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "10px Arial";
    ctx.fillStyle = "#22c55e";
    ctx.fillText("Axon Terminal", endX + 15, neuronY + 35);

    // Action potential pulse along axon
    if (firing && actionPotentialPos >= 0 && actionPotentialPos <= 1) {
      const pulseX = axonStartX + actionPotentialPos * (endX - axonStartX);
      const pulseGrad = ctx.createRadialGradient(pulseX, neuronY, 0, pulseX, neuronY, 25);
      pulseGrad.addColorStop(0, "rgba(250, 204, 21, 0.8)");
      pulseGrad.addColorStop(0.5, "rgba(239, 68, 68, 0.4)");
      pulseGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.beginPath();
      ctx.arc(pulseX, neuronY, 25, 0, Math.PI * 2);
      ctx.fillStyle = pulseGrad;
      ctx.fill();

      // Voltage label at pulse
      const phase = (time - lastFireTime) * 5;
      const v = actionPotentialVoltage(Math.min(1, phase));
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#facc15";
      ctx.textAlign = "center";
      ctx.fillText(`${v.toFixed(0)} mV`, pulseX, neuronY - 30);
    }

    // Synaptic cleft
    const synapseX = endX + 30;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(synapseX, neuronY - 30);
    ctx.lineTo(synapseX, neuronY + 30);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "9px Arial";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Synapse", synapseX, neuronY + 45);

    // Neurotransmitter vesicles (when AP reaches terminal)
    if (firing && actionPotentialPos > 0.9) {
      for (let i = 0; i < 6; i++) {
        const vx = endX + 18 + Math.random() * 15;
        const vy = neuronY + (Math.random() - 0.5) * 25;
        ctx.fillStyle = "rgba(34, 197, 94, 0.7)";
        ctx.beginPath();
        ctx.arc(vx, vy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawVoltagePlot() {
    const gx = W * 0.03, gy = H * 0.55, gw = W * 0.6, gh = H * 0.4;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Membrane Potential (mV) vs Time", gx + gw / 2, gy + 16);

    // Y-axis labels
    ctx.font = "9px monospace";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    const vMin = -90, vMax = 50;
    for (const v of [-80, -55, 0, 40]) {
      const py = gy + 25 + ((vMax - v) / (vMax - vMin)) * (gh - 35);
      ctx.fillText(`${v}`, gx + 30, py + 3);
      ctx.strokeStyle = v === -55 ? "rgba(239, 68, 68, 0.3)" : "rgba(71, 85, 105, 0.2)";
      ctx.lineWidth = v === -55 ? 1.5 : 0.5;
      if (v === -55) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(gx + 35, py);
      ctx.lineTo(gx + gw - 5, py);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Threshold label
    const threshY = gy + 25 + ((vMax - (-55)) / (vMax - vMin)) * (gh - 35);
    ctx.fillStyle = "#ef4444";
    ctx.font = "9px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Threshold (−55 mV)", gx + gw - 100, threshY - 5);

    // Plot voltage
    if (voltageHistory.length > 1) {
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < voltageHistory.length; i++) {
        const px = gx + 35 + (i / maxVoltagePoints) * (gw - 45);
        const py = gy + 25 + ((vMax - voltageHistory[i]) / (vMax - vMin)) * (gh - 35);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // AP phase labels
    ctx.font = "9px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Resting → Depolarization → Peak → Repolarization → Hyperpolarization → Recovery", gx + gw / 2, gy + gh - 5);
  }

  function drawInfoPanel() {
    const px = W * 0.65, py = H * 0.55, pw = W * 0.33, ph = H * 0.4;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Signal Properties", px + 10, py + 20);

    ctx.font = "12px Arial";
    ctx.fillStyle = "#94a3b8";
    const y0 = py + 40;
    const vel = conductionVelocity();
    ctx.fillText(`Velocity: ${vel.toFixed(1)} m/s`, px + 10, y0);
    ctx.fillText(`Membrane: ${membranePotential.toFixed(0)} mV`, px + 10, y0 + 18);
    ctx.fillText(`Myelin: ${myelinThickness > 0.1 ? "Present" : "Absent"}`, px + 10, y0 + 36);
    ctx.fillText(`Temperature: ${temperature}°C`, px + 10, y0 + 54);
    ctx.fillText(`Stimulus: ${stimulusStrength} mV`, px + 10, y0 + 72);

    ctx.font = "11px Arial";
    ctx.fillStyle = "#64748b";
    const iy = y0 + 100;
    ctx.fillText("Ion channels:", px + 10, iy);
    ctx.fillText("  Na⁺: voltage-gated (depol.)", px + 10, iy + 16);
    ctx.fillText("  K⁺: voltage-gated (repol.)", px + 10, iy + 32);
    ctx.fillText("  Na⁺/K⁺ pump: restores", px + 10, iy + 48);

    ctx.font = "10px monospace";
    ctx.fillStyle = "#475569";
    ctx.fillText("Hodgkin-Huxley model", px + 10, py + ph - 25);
    ctx.fillText(`All-or-nothing > ${stimulusStrength > 35 ? "FIRES" : "subthreshold"}`, px + 10, py + ph - 10);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height;
      time = 0; firing = false; actionPotentialPos = -1; membranePotential = -70;
      voltageHistory.length = 0;
    },
    update(dt, params) {
      stimulusStrength = params.stimulusStrength ?? stimulusStrength;
      myelinThickness = params.myelinThickness ?? myelinThickness;
      temperature = params.temperature ?? temperature;
      nodeSpacing = params.nodeSpacing ?? nodeSpacing;
      time += dt;

      // Auto-fire periodically if stimulus above threshold
      const threshold = 35; // mV needed to reach -55 from resting -70
      if (!firing && stimulusStrength >= threshold && time - lastFireTime > 1.5) {
        firing = true;
        actionPotentialPos = 0;
        lastFireTime = time;
      }

      if (firing) {
        const vel = conductionVelocity();
        actionPotentialPos += (vel / 500) * dt; // normalized to axon length
        const apPhase = (time - lastFireTime) * 5;
        membranePotential = actionPotentialVoltage(Math.min(1, apPhase));

        if (actionPotentialPos > 1.2) {
          firing = false;
          actionPotentialPos = -1;
        }
      } else {
        membranePotential = -70; // resting
      }

      voltageHistory.push(membranePotential);
      if (voltageHistory.length > maxVoltagePoints) voltageHistory.shift();
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Neural Signal Transmission", W / 2, 28);

      drawNeuron();
      drawVoltagePlot();
      drawInfoPanel();
    },
    reset() {
      time = 0; firing = false; actionPotentialPos = -1; membranePotential = -70;
      voltageHistory.length = 0;
    },
    destroy() {},
    getStateDescription() {
      const vel = conductionVelocity();
      return `Neural signal: ${firing ? `action potential propagating at ${vel.toFixed(1)} m/s, membrane potential ${membranePotential.toFixed(0)} mV` : `resting state (−70 mV), stimulus ${stimulusStrength} mV ${stimulusStrength >= 35 ? "(above threshold)" : "(subthreshold)"}`}. Myelin thickness: ${myelinThickness.toFixed(1)}×, temperature: ${temperature}°C.`;
    },
    resize(w, h) { W = w; H = h; },
  };
  return engine;
};

export default neuralSignalTransmissionFactory;
