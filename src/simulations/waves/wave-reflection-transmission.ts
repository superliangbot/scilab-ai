import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const WaveReflectionTransmission: SimulationFactory = () => {
  const config = getSimConfig("wave-reflection-transmission")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics parameters
  let frequency = 2.0;
  let amplitude = 1.0;
  let medium1Impedance = 1.0; // Z₁ = ρ₁c₁
  let medium2Impedance = 3.0; // Z₂ = ρ₂c₂
  let time = 0;

  // Simulation state
  const gridSize = 400;
  let waveField: Float32Array = new Float32Array(gridSize);
  let incidentWave: Float32Array = new Float32Array(gridSize);
  let reflectedWave: Float32Array = new Float32Array(gridSize);
  let transmittedWave: Float32Array = new Float32Array(gridSize);
  
  const boundaryPosition = gridSize * 0.6; // Interface position
  let pulseCenter = gridSize * 0.15; // Start position of wave pulse
  let pulseSpeed = 100; // pixels per second

  // Coefficients
  let reflectionCoeff = 0;
  let transmissionCoeff = 0;

  // Colors
  const BG = "#0f172a";
  const MEDIUM1_COLOR = "#1e40af";
  const MEDIUM2_COLOR = "#dc2626";
  const INCIDENT_COLOR = "#10b981";
  const REFLECTED_COLOR = "#f59e0b";
  const TRANSMITTED_COLOR = "#a855f7";
  const TOTAL_COLOR = "#e2e8f0";
  const BOUNDARY_COLOR = "#ef4444";
  const GRID_COLOR = "rgba(148, 163, 184, 0.2)";
  const TEXT_COLOR = "#e2e8f0";

  function computePhysics(dt: number, params: Record<string, number>) {
    frequency = params.frequency ?? frequency;
    amplitude = params.amplitude ?? amplitude;
    medium1Impedance = params.medium1Impedance ?? medium1Impedance;
    medium2Impedance = params.medium2Impedance ?? medium2Impedance;

    time += dt;

    // Calculate reflection and transmission coefficients
    // r = (Z₂ - Z₁) / (Z₂ + Z₁), t = 2Z₂ / (Z₂ + Z₁)
    reflectionCoeff = (medium2Impedance - medium1Impedance) / (medium2Impedance + medium1Impedance);
    transmissionCoeff = (2 * medium2Impedance) / (medium2Impedance + medium1Impedance);

    // Move pulse
    pulseCenter += pulseSpeed * dt;

    // Reset arrays
    incidentWave.fill(0);
    reflectedWave.fill(0);
    transmittedWave.fill(0);
    waveField.fill(0);

    const omega = 2 * Math.PI * frequency;
    const pulseWidth = 40;

    for (let i = 0; i < gridSize; i++) {
      const x = i;

      // Incident wave (Gaussian pulse)
      if (pulseCenter < boundaryPosition + 50) { // Before it hits and reflects
        const distance = x - pulseCenter;
        if (Math.abs(distance) < pulseWidth * 2) {
          incidentWave[i] = amplitude * Math.exp(-distance * distance / (pulseWidth * pulseWidth)) * 
                           Math.cos(omega * time - 0.1 * distance);
        }
      }

      // Reflected wave (appears after incident hits boundary)
      if (pulseCenter > boundaryPosition - 20) {
        const reflectedCenter = 2 * boundaryPosition - pulseCenter;
        const distance = x - reflectedCenter;
        if (Math.abs(distance) < pulseWidth * 2 && reflectedCenter > 0) {
          reflectedWave[i] = reflectionCoeff * amplitude * 
                           Math.exp(-distance * distance / (pulseWidth * pulseWidth)) * 
                           Math.cos(omega * time - 0.1 * distance + Math.PI); // Phase shift
        }
      }

      // Transmitted wave (appears in medium 2 after pulse hits boundary)
      if (pulseCenter > boundaryPosition - 20 && x > boundaryPosition) {
        const transmittedCenter = pulseCenter - boundaryPosition + x - boundaryPosition;
        const distance = x - (boundaryPosition + transmittedCenter);
        if (Math.abs(distance) < pulseWidth * 2 && transmittedCenter > 0) {
          transmittedWave[i] = transmissionCoeff * amplitude * 
                              Math.exp(-distance * distance / (pulseWidth * pulseWidth)) * 
                              Math.cos(omega * time - 0.1 * distance);
        }
      }

      // Total field is superposition
      if (x < boundaryPosition) {
        waveField[i] = incidentWave[i] + reflectedWave[i];
      } else {
        waveField[i] = transmittedWave[i];
      }
    }

    // Reset pulse when it goes off screen
    if (pulseCenter > gridSize + 50) {
      pulseCenter = -50;
    }
  }

  function drawMedia() {
    const displayHeight = height * 0.4;
    const displayY = height * 0.3;
    const boundaryX = (boundaryPosition / gridSize) * width;

    // Medium 1 background
    ctx.fillStyle = "rgba(30, 64, 175, 0.1)";
    ctx.fillRect(0, displayY, boundaryX, displayHeight);
    
    // Medium 2 background
    ctx.fillStyle = "rgba(220, 38, 38, 0.1)";
    ctx.fillRect(boundaryX, displayY, width - boundaryX, displayHeight);

    // Boundary line
    ctx.strokeStyle = BOUNDARY_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(boundaryX, displayY);
    ctx.lineTo(boundaryX, displayY + displayHeight);
    ctx.stroke();

    // Medium labels
    ctx.fillStyle = MEDIUM1_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Medium 1", boundaryX / 2, displayY - 10);
    ctx.fillText(`Z₁ = ${medium1Impedance.toFixed(1)}`, boundaryX / 2, displayY - 30);

    ctx.fillStyle = MEDIUM2_COLOR;
    ctx.fillText("Medium 2", (boundaryX + width) / 2, displayY - 10);
    ctx.fillText(`Z₂ = ${medium2Impedance.toFixed(1)}`, (boundaryX + width) / 2, displayY - 30);

    // Interface label
    ctx.fillStyle = BOUNDARY_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Interface", boundaryX, displayY + displayHeight + 20);
  }

  function drawWaves() {
    const displayHeight = height * 0.4;
    const displayY = height * 0.3;
    const centerY = displayY + displayHeight / 2;
    const scale = 40;

    // Draw grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * width;
      ctx.beginPath();
      ctx.moveTo(x, displayY);
      ctx.lineTo(x, displayY + displayHeight);
      ctx.stroke();
    }

    // Center line
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw total wave field
    ctx.strokeStyle = TOTAL_COLOR;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < gridSize; i++) {
      const x = (i / gridSize) * width;
      const y = centerY - waveField[i] * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw component waves (faded)
    const alpha = 0.6;
    
    // Incident wave
    ctx.strokeStyle = `${INCIDENT_COLOR}${Math.floor(255 * alpha).toString(16)}`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let i = 0; i < boundaryPosition; i++) {
      const x = (i / gridSize) * width;
      const y = centerY - incidentWave[i] * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Reflected wave
    ctx.strokeStyle = `${REFLECTED_COLOR}${Math.floor(255 * alpha).toString(16)}`;
    ctx.beginPath();
    for (let i = 0; i < boundaryPosition; i++) {
      const x = (i / gridSize) * width;
      const y = centerY - reflectedWave[i] * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Transmitted wave
    ctx.strokeStyle = `${TRANSMITTED_COLOR}${Math.floor(255 * alpha).toString(16)}`;
    ctx.beginPath();
    for (let i = Math.floor(boundaryPosition); i < gridSize; i++) {
      const x = (i / gridSize) * width;
      const y = centerY - transmittedWave[i] * scale;
      if (i === Math.floor(boundaryPosition)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCoefficientsPanel() {
    const panelX = width * 0.05;
    const panelY = height * 0.75;
    const panelW = width * 0.4;
    const panelH = height * 0.2;

    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 15;
    let textY = panelY + 20;
    const lineHeight = 16;

    ctx.fillStyle = "#a855f7";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Reflection & Transmission Coefficients", textX, textY);
    textY += lineHeight + 5;

    ctx.fillStyle = REFLECTED_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText(`Reflection: r = ${reflectionCoeff.toFixed(3)}`, textX, textY);
    textY += lineHeight;

    ctx.fillStyle = TRANSMITTED_COLOR;
    ctx.fillText(`Transmission: t = ${transmissionCoeff.toFixed(3)}`, textX, textY);
    textY += lineHeight;

    // Energy conservation
    const reflectedPower = reflectionCoeff * reflectionCoeff;
    const transmittedPower = (medium1Impedance / medium2Impedance) * transmissionCoeff * transmissionCoeff;
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.fillText(`R = r² = ${reflectedPower.toFixed(3)}`, textX + 20, textY);
    textY += lineHeight - 2;
    ctx.fillText(`T = (Z₁/Z₂)t² = ${transmittedPower.toFixed(3)}`, textX + 20, textY);
    textY += lineHeight - 2;
    
    const total = reflectedPower + transmittedPower;
    ctx.fillStyle = total > 0.99 && total < 1.01 ? "#10b981" : "#ef4444";
    ctx.fillText(`R + T = ${total.toFixed(3)}`, textX + 20, textY);
  }

  function drawEquations() {
    const eqX = width * 0.55;
    const eqY = height * 0.75;

    ctx.fillStyle = "#a855f7";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Equations:", eqX, eqY);

    const equations = [
      "r = (Z₂ - Z₁) / (Z₂ + Z₁)",
      "t = 2Z₂ / (Z₂ + Z₁)",
      "R = |r|² (reflected power)",
      "T = (Z₁/Z₂)|t|² (transmitted power)",
      "R + T = 1 (energy conservation)"
    ];

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    let y = eqY + 20;
    
    equations.forEach(eq => {
      ctx.fillText(eq, eqX, y);
      y += 14;
    });

    // Impedance note
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("where Z = ρc (acoustic impedance)", eqX, y + 10);
  }

  function drawLegend() {
    const legendX = width * 0.05;
    const legendY = height * 0.05;
    const lineY = legendY + 20;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Wave Components:", legendX, legendY);

    const components = [
      { color: TOTAL_COLOR, label: "Total Wave", dash: false },
      { color: INCIDENT_COLOR, label: "Incident", dash: true },
      { color: REFLECTED_COLOR, label: "Reflected", dash: true },
      { color: TRANSMITTED_COLOR, label: "Transmitted", dash: true },
    ];

    let x = legendX;
    components.forEach((comp, i) => {
      ctx.strokeStyle = comp.color;
      ctx.lineWidth = comp.dash ? 1.5 : 2.5;
      if (comp.dash) ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(x, lineY);
      ctx.lineTo(x + 25, lineY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = comp.color;
      ctx.font = "10px monospace";
      ctx.fillText(comp.label, x + 30, lineY + 4);
      
      x += 100;
    });
  }

  function drawInfoPanel() {
    const panelX = 10;
    const panelY = height - 60;
    const panelW = width - 20;
    const panelH = 50;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 15;
    let textY = panelY + 18;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    const impedanceRatio = medium2Impedance / medium1Impedance;
    const matchText = Math.abs(impedanceRatio - 1) < 0.1 ? "IMPEDANCE MATCHED" : 
                     impedanceRatio > 1 ? "HARDER MEDIUM" : "SOFTER MEDIUM";
    
    ctx.fillText(`Impedance ratio: Z₂/Z₁ = ${impedanceRatio.toFixed(2)} (${matchText})`, textX, textY);
    textY += 16;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText(`When Z₂ > Z₁: partial reflection with phase reversal | When Z₂ = Z₁: no reflection | When Z₂ < Z₁: partial reflection, no phase change`, textX, textY);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      pulseCenter = gridSize * 0.15;
      waveField.fill(0);
      incidentWave.fill(0);
      reflectedWave.fill(0);
      transmittedWave.fill(0);
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawMedia();
      drawWaves();
      drawCoefficientsPanel();
      drawEquations();
      drawLegend();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      pulseCenter = gridSize * 0.15;
      waveField.fill(0);
      incidentWave.fill(0);
      reflectedWave.fill(0);
      transmittedWave.fill(0);
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const impedanceRatio = medium2Impedance / medium1Impedance;
      const reflectedPower = reflectionCoeff * reflectionCoeff;
      const transmittedPower = (medium1Impedance / medium2Impedance) * transmissionCoeff * transmissionCoeff;
      
      return (
        `Wave reflection and transmission at boundary between media with impedances Z₁ = ${medium1Impedance.toFixed(1)} and Z₂ = ${medium2Impedance.toFixed(1)}. ` +
        `Impedance ratio Z₂/Z₁ = ${impedanceRatio.toFixed(2)}. ` +
        `Reflection coefficient r = ${reflectionCoeff.toFixed(3)}, transmission coefficient t = ${transmissionCoeff.toFixed(3)}. ` +
        `Power reflection R = ${reflectedPower.toFixed(3)}, power transmission T = ${transmittedPower.toFixed(3)}. ` +
        `${Math.abs(impedanceRatio - 1) < 0.1 ? "Impedances matched - minimal reflection." : impedanceRatio > 1 ? "Wave enters denser medium - partial reflection with possible phase reversal." : "Wave enters less dense medium - partial reflection without phase change."}`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default WaveReflectionTransmission;