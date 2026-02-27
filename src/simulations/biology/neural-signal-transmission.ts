import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const NeuralSignalTransmissionFactory: SimulationFactory = () => {
  const config = getSimConfig("neural-signal-transmission")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let stimulusStrength = 50; // mV
  let myelinThickness = 1.0;  // affects conduction velocity
  let temperature = 37;       // °C
  let nodeSpacing = 100;      // distance between nodes of Ranvier

  // Action potential simulation
  let neuronLength = 600;
  let actionPotentials: Array<{
    position: number;
    amplitude: number;
    age: number;
    velocity: number;
  }> = [];

  // Voltage-gated channels
  let voltageProfile: Float32Array;
  let channelStates: Array<{
    x: number;
    naOpen: number;    // 0-1
    kOpen: number;     // 0-1
    caOpen: number;    // 0-1
  }> = [];

  // Synaptic transmission
  let synapsePosition = 450;
  let neurotransmitters: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: 'dopamine' | 'serotonin' | 'gaba' | 'glutamate';
    age: number;
  }> = [];

  let voltageHistory: Array<{ time: number; voltage: number }> = [];

  function initializeNeuron() {
    voltageProfile = new Float32Array(neuronLength);
    channelStates = [];
    actionPotentials = [];
    neurotransmitters = [];
    voltageHistory = [];

    // Initialize resting potential
    voltageProfile.fill(-70); // -70 mV resting potential

    // Create nodes of Ranvier for myelinated axon
    for (let x = 0; x < neuronLength; x += nodeSpacing) {
      channelStates.push({
        x,
        naOpen: 0,
        kOpen: 0,
        caOpen: 0
      });
    }
  }

  function triggerActionPotential() {
    // Create action potential at stimulus site
    actionPotentials.push({
      position: 50,
      amplitude: 110, // Peak amplitude
      age: 0,
      velocity: calculateConductionVelocity()
    });
  }

  function calculateConductionVelocity(): number {
    // Conduction velocity based on myelination and temperature
    // Unmyelinated: ~0.5-2 m/s, Myelinated: ~5-120 m/s
    const baseVelocity = myelinThickness > 0.5 ? 80 : 2; // pixels per ms (scaled)
    const tempFactor = Math.pow(2, (temperature - 37) / 10); // Q10 effect
    return baseVelocity * myelinThickness * tempFactor;
  }

  function updateActionPotentials(dt: number) {
    // Update existing action potentials
    for (let i = actionPotentials.length - 1; i >= 0; i--) {
      const ap = actionPotentials[i];
      ap.age += dt;
      ap.position += ap.velocity * dt;

      // Remove old action potentials
      if (ap.position > neuronLength || ap.age > 5) {
        actionPotentials.splice(i, 1);
        continue;
      }

      // Update voltage profile along axon
      const width = myelinThickness > 0.5 ? 30 : 80; // Saltatory vs continuous conduction
      
      for (let x = 0; x < neuronLength; x++) {
        const distance = Math.abs(x - ap.position);
        if (distance < width) {
          // Hodgkin-Huxley like dynamics simplified
          const phaseOffset = (distance / width) * Math.PI;
          const timePhase = ap.age * 8; // Faster for demonstration
          
          let voltage = -70; // Resting potential
          
          if (ap.age < 1) { // Depolarization phase
            voltage = -70 + ap.amplitude * Math.exp(-distance / 20) * 
                     Math.sin(Math.max(0, timePhase - phaseOffset));
          } else if (ap.age < 2) { // Repolarization phase
            voltage = -70 - 20 * Math.exp(-distance / 15) * 
                     Math.sin(Math.max(0, timePhase - phaseOffset - Math.PI));
          }
          
          voltageProfile[x] = Math.max(voltageProfile[x], voltage);
        }
      }

      // Trigger synaptic release at synapse
      if (ap.position >= synapsePosition && ap.position < synapsePosition + 20) {
        if (Math.random() < 0.3 * dt * 60) { // Probabilistic release
          releaseNeurotransmitters();
        }
      }
    }

    // Voltage decay back to resting potential
    for (let x = 0; x < voltageProfile.length; x++) {
      voltageProfile[x] = voltageProfile[x] * 0.95 + (-70) * 0.05;
    }

    // Update channel states based on voltage
    for (const channel of channelStates) {
      const voltage = voltageProfile[channel.x];
      
      // Simplified Hodgkin-Huxley channel kinetics
      const vNorm = (voltage + 70) / 140; // Normalize to 0-1
      
      // Sodium channels: open quickly on depolarization
      const naNormalizedActivation = 1 / (1 + Math.exp(-(voltage + 40) / 10));
      channel.naOpen = channel.naOpen * 0.9 + naNormalizedActivation * 0.1;
      
      // Potassium channels: open slower, stay open longer
      const kTarget = voltage > -50 ? 1 : 0;
      channel.kOpen = channel.kOpen * 0.95 + kTarget * 0.05;
      
      // Calcium channels: voltage-dependent
      const caTarget = voltage > -30 ? (voltage + 30) / 80 : 0;
      channel.caOpen = channel.caOpen * 0.9 + caTarget * 0.1;
    }

    // Record voltage history at measurement point
    if (voltageHistory.length === 0 || time - voltageHistory[voltageHistory.length - 1].time > 0.01) {
      voltageHistory.push({
        time: time,
        voltage: voltageProfile[200] // Measure at position 200
      });
      
      if (voltageHistory.length > 500) {
        voltageHistory.shift();
      }
    }
  }

  function releaseNeurotransmitters() {
    const types = ['dopamine', 'serotonin', 'gaba', 'glutamate'] as const;
    
    for (let i = 0; i < 5; i++) {
      neurotransmitters.push({
        x: synapsePosition + 10 + Math.random() * 20,
        y: H * 0.4 + (Math.random() - 0.5) * 40,
        vx: 20 + Math.random() * 30,
        vy: (Math.random() - 0.5) * 20,
        type: types[Math.floor(Math.random() * types.length)],
        age: 0
      });
    }
  }

  function updateNeurotransmitters(dt: number) {
    for (let i = neurotransmitters.length - 1; i >= 0; i--) {
      const nt = neurotransmitters[i];
      nt.age += dt;
      
      // Diffusion movement
      nt.x += nt.vx * dt;
      nt.y += nt.vy * dt;
      
      // Random walk
      nt.vx += (Math.random() - 0.5) * 10 * dt;
      nt.vy += (Math.random() - 0.5) * 10 * dt;
      
      // Damping
      nt.vx *= 0.98;
      nt.vy *= 0.98;
      
      // Remove old neurotransmitters
      if (nt.age > 3 || nt.x > W) {
        neurotransmitters.splice(i, 1);
      }
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeNeuron();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newStimulus = params.stimulusStrength ?? stimulusStrength;
      myelinThickness = params.myelinThickness ?? myelinThickness;
      temperature = params.temperature ?? temperature;
      nodeSpacing = Math.round(params.nodeSpacing ?? nodeSpacing);

      // Trigger action potential when stimulus changes significantly
      if (Math.abs(newStimulus - stimulusStrength) > 5) {
        stimulusStrength = newStimulus;
        if (stimulusStrength > 20) {
          triggerActionPotential();
        }
      } else {
        stimulusStrength = newStimulus;
      }

      time += dt;
      updateActionPotentials(dt);
      updateNeurotransmitters(dt);
    },

    render() {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0a0a1f");
      gradient.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Neural Signal Transmission", W / 2, 25);

      const neuronY = H * 0.4;
      const axonStartX = 50;
      const axonEndX = axonStartX + neuronLength;

      // Draw axon
      const axonThickness = 8 + myelinThickness * 6;
      
      // Myelin sheaths
      if (myelinThickness > 0.5) {
        ctx.fillStyle = "#f8fafc";
        for (let x = axonStartX; x < axonEndX; x += nodeSpacing) {
          const segmentStart = x + 10;
          const segmentEnd = Math.min(x + nodeSpacing - 10, axonEndX);
          if (segmentStart < segmentEnd) {
            ctx.fillRect(segmentStart, neuronY - axonThickness / 2, 
                        segmentEnd - segmentStart, axonThickness);
          }
        }
      }

      // Axon membrane
      ctx.fillStyle = "#64748b";
      ctx.fillRect(axonStartX, neuronY - axonThickness / 2 + 2, 
                   neuronLength, axonThickness - 4);

      // Nodes of Ranvier
      for (const channel of channelStates) {
        const x = axonStartX + channel.x;
        
        // Node gap
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x - 5, neuronY - axonThickness / 2, 10, axonThickness);
        
        // Ion channels visualization
        const channelRadius = 3;
        
        // Sodium channels (blue)
        ctx.fillStyle = `rgba(59, 130, 246, ${channel.naOpen})`;
        ctx.beginPath();
        ctx.arc(x - 2, neuronY - channelRadius, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Potassium channels (red)  
        ctx.fillStyle = `rgba(239, 68, 68, ${channel.kOpen})`;
        ctx.beginPath();
        ctx.arc(x + 2, neuronY - channelRadius, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Calcium channels (green)
        ctx.fillStyle = `rgba(16, 185, 129, ${channel.caOpen})`;
        ctx.beginPath();
        ctx.arc(x, neuronY + channelRadius, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw voltage profile as color overlay
      for (let x = 0; x < neuronLength - 1; x++) {
        const voltage = voltageProfile[x];
        const normalizedVoltage = Math.max(0, Math.min(1, (voltage + 70) / 140));
        
        let r, g, b;
        if (normalizedVoltage < 0.5) {
          // Negative voltages: blue to black
          const t = normalizedVoltage * 2;
          r = Math.floor(t * 50);
          g = Math.floor(t * 100);
          b = Math.floor(100 + t * 155);
        } else {
          // Positive voltages: yellow to red
          const t = (normalizedVoltage - 0.5) * 2;
          r = Math.floor(255);
          g = Math.floor(255 * (1 - t));
          b = Math.floor(50 * (1 - t));
        }
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
        ctx.fillRect(axonStartX + x, neuronY - axonThickness / 2, 2, axonThickness);
      }

      // Draw action potentials as traveling waves
      for (const ap of actionPotentials) {
        const x = axonStartX + ap.position;
        const intensity = Math.max(0, 1 - ap.age / 3);
        
        // Wave representation
        const waveGradient = ctx.createRadialGradient(x, neuronY, 0, x, neuronY, 30);
        waveGradient.addColorStop(0, `rgba(255, 255, 100, ${intensity * 0.8})`);
        waveGradient.addColorStop(1, `rgba(255, 255, 100, 0)`);
        
        ctx.fillStyle = waveGradient;
        ctx.beginPath();
        ctx.arc(x, neuronY, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      // Synapse
      const synapseX = axonStartX + synapsePosition;
      
      // Presynaptic terminal
      ctx.fillStyle = "#7c3aed";
      ctx.beginPath();
      ctx.arc(synapseX, neuronY, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Synaptic cleft
      ctx.fillStyle = "#374151";
      ctx.fillRect(synapseX + 15, neuronY - 20, 20, 40);
      
      // Postsynaptic terminal
      ctx.fillStyle = "#059669";
      ctx.beginPath();
      ctx.arc(synapseX + 35, neuronY, 15, 0, Math.PI * 2);
      ctx.fill();

      // Draw neurotransmitters
      for (const nt of neurotransmitters) {
        const alpha = Math.max(0, 1 - nt.age / 3);
        let color: string;
        
        switch (nt.type) {
          case 'dopamine': color = `rgba(168, 85, 247, ${alpha})`; break;
          case 'serotonin': color = `rgba(59, 130, 246, ${alpha})`; break;
          case 'gaba': color = `rgba(239, 68, 68, ${alpha})`; break;
          case 'glutamate': color = `rgba(16, 185, 129, ${alpha})`; break;
        }
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(nt.x, nt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Voltage trace graph
      const traceX = 50;
      const traceY = 80;
      const traceW = 300;
      const traceH = 120;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(traceX, traceY, traceW, traceH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(traceX, traceY, traceW, traceH);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Membrane Potential (mV)", traceX + traceW / 2, traceY - 8);

      // Voltage grid lines
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 0.5;
      for (let v = -80; v <= 40; v += 20) {
        const y = traceY + traceH - ((v + 80) / 120) * traceH;
        ctx.beginPath();
        ctx.moveTo(traceX, y);
        ctx.lineTo(traceX + traceW, y);
        ctx.stroke();
        
        ctx.font = "10px Arial";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "right";
        ctx.fillText(v.toString(), traceX - 5, y + 3);
      }

      // Plot voltage history
      if (voltageHistory.length > 1) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < voltageHistory.length; i++) {
          const point = voltageHistory[i];
          const x = traceX + (i / (voltageHistory.length - 1)) * traceW;
          const y = traceY + traceH - ((point.voltage + 80) / 120) * traceH;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Parameters panel
      const paramX = W - 200;
      const paramY = 80;
      const paramW = 180;
      const paramH = 160;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(paramX, paramY, paramW, paramH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(paramX, paramY, paramW, paramH);

      let infoY = paramY + 20;
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Neural Parameters", paramX + 10, infoY);
      infoY += 20;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Stimulus: ${stimulusStrength.toFixed(0)} mV`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Myelin: ${myelinThickness.toFixed(1)}`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Temperature: ${temperature.toFixed(0)}°C`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Node spacing: ${nodeSpacing}px`, paramX + 10, infoY);
      infoY += 20;

      const velocity = calculateConductionVelocity();
      ctx.fillStyle = "#10b981";
      ctx.fillText(`Conduction velocity:`, paramX + 10, infoY);
      infoY += 14;
      ctx.fillText(`${velocity.toFixed(1)} px/ms`, paramX + 10, infoY);

      // Instructions
      const instrY = H - 60;
      ctx.font = "11px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText("Adjust stimulus strength to trigger action potentials", 50, instrY);
      ctx.fillText("Myelin thickness affects conduction velocity", 50, instrY + 15);

      // Legend
      const legendY = 260;
      const legendItems = [
        { color: "#3b82f6", label: "Na+ channels" },
        { color: "#ef4444", label: "K+ channels" },
        { color: "#10b981", label: "Ca2+ channels" },
        { color: "#fbbf24", label: "Action potential" }
      ];

      ctx.font = "10px Arial";
      legendItems.forEach((item, i) => {
        const x = 60 + (i % 2) * 120;
        const y = legendY + Math.floor(i / 2) * 16;
        
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "left";
        ctx.fillText(item.label, x + 10, y + 3);
      });

      // Time indicator
      ctx.font = "11px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 10, H - 10);
    },

    reset() {
      time = 0;
      initializeNeuron();
    },

    destroy() {
      actionPotentials = [];
      neurotransmitters = [];
      voltageHistory = [];
      channelStates = [];
    },

    getStateDescription(): string {
      const numAPs = actionPotentials.length;
      const avgVoltage = voltageProfile.reduce((sum, v) => sum + v, 0) / voltageProfile.length;
      const velocity = calculateConductionVelocity();

      return (
        `Neural Signal Transmission simulation with ${numAPs} active action potentials. ` +
        `Average membrane potential: ${avgVoltage.toFixed(1)}mV. ` +
        `Stimulus strength: ${stimulusStrength}mV, Temperature: ${temperature}°C, ` +
        `Myelin thickness: ${myelinThickness.toFixed(1)}, Node spacing: ${nodeSpacing}px. ` +
        `Calculated conduction velocity: ${velocity.toFixed(1)} pixels/ms. ` +
        `Voltage-gated Na+, K+, and Ca2+ channels regulate action potential propagation. ` +
        `Synaptic transmission releases neurotransmitters (dopamine, serotonin, GABA, glutamate).`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default NeuralSignalTransmissionFactory;