import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Phased Array: Multiple wave sources with controlled phase differences.
 * Demonstrates beam steering via constructive/destructive interference.
 * Used in radar, 5G antennas, and radio astronomy.
 */

const PhaseArrayFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("phase-array") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let numSources = 4;
  let phaseDelta = 0; // degrees
  let frequency = 2; // Hz
  let spacing = 40; // px

  // Precomputed intensity field
  let intensityField: Float32Array | null = null;
  let fieldW = 0;
  let fieldH = 0;
  let fieldDirty = true;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    fieldDirty = true;
  }

  function computeBeamAngle(): number {
    // For a linear phased array, the beam direction is:
    // sin(theta) = (deltaPhi * lambda) / (2pi * d)
    // where deltaPhi is phase difference in radians
    const deltaRad = (phaseDelta * Math.PI) / 180;
    const wavelength = 200 / frequency; // px wavelength (speed/freq)
    const sinTheta = (deltaRad * wavelength) / (2 * Math.PI * spacing);
    const clamped = Math.max(-1, Math.min(1, sinTheta));
    return Math.asin(clamped) * (180 / Math.PI);
  }

  function computeIntensityField(): void {
    const res = 3; // pixels per cell
    fieldW = Math.ceil(width / res);
    fieldH = Math.ceil(height / res);
    intensityField = new Float32Array(fieldW * fieldH);

    const sourceY = height * 0.85;
    const centerX = width / 2;
    const firstSourceX = centerX - ((numSources - 1) * spacing) / 2;
    const omega = 2 * Math.PI * frequency;
    const speed = 200; // px/s
    const k = omega / speed; // wavenumber
    const deltaRad = (phaseDelta * Math.PI) / 180;

    let maxVal = 0;

    for (let fy = 0; fy < fieldH; fy++) {
      for (let fx = 0; fx < fieldW; fx++) {
        const px = fx * res;
        const py = fy * res;

        let sumReal = 0;
        let sumImag = 0;

        for (let s = 0; s < numSources; s++) {
          const sx = firstSourceX + s * spacing;
          const sy = sourceY;
          const dx = px - sx;
          const dy = py - sy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 2) continue;

          const phase = k * dist - omega * time + s * deltaRad;
          const amplitude = 1 / Math.sqrt(Math.max(dist, 10));
          sumReal += amplitude * Math.cos(phase);
          sumImag += amplitude * Math.sin(phase);
        }

        const intensity = sumReal * sumReal + sumImag * sumImag;
        intensityField[fy * fieldW + fx] = intensity;
        if (intensity > maxVal) maxVal = intensity;
      }
    }

    // Normalize
    if (maxVal > 0) {
      for (let i = 0; i < intensityField.length; i++) {
        intensityField[i] /= maxVal;
      }
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    const newNum = Math.round(params.numSources ?? 4);
    const newPhase = params.phaseDelta ?? 0;
    const newFreq = Math.max(0.1, params.frequency ?? 2);
    const newSpacing = params.spacing ?? 40;

    if (newNum !== numSources || newPhase !== phaseDelta ||
        newFreq !== frequency || newSpacing !== spacing) {
      numSources = newNum;
      phaseDelta = newPhase;
      frequency = newFreq;
      spacing = newSpacing;
      fieldDirty = true;
    }

    time += Math.min(dt, 0.016);
    fieldDirty = true; // field depends on time
  }

  function renderField(): void {
    if (fieldDirty || !intensityField) {
      computeIntensityField();
      fieldDirty = false;
    }
    if (!intensityField) return;

    const res = 3;
    const imgData = ctx.createImageData(fieldW, fieldH);

    for (let i = 0; i < intensityField.length; i++) {
      const val = intensityField[i];
      // Color mapping: dark blue -> cyan -> white
      let r: number, g: number, b: number;
      if (val < 0.33) {
        const t = val / 0.33;
        r = Math.floor(10 + t * 20);
        g = Math.floor(15 + t * 80);
        b = Math.floor(40 + t * 160);
      } else if (val < 0.66) {
        const t = (val - 0.33) / 0.33;
        r = Math.floor(30 + t * 30);
        g = Math.floor(95 + t * 120);
        b = Math.floor(200 + t * 55);
      } else {
        const t = (val - 0.66) / 0.34;
        r = Math.floor(60 + t * 195);
        g = Math.floor(215 + t * 40);
        b = Math.floor(255);
      }

      const idx = i * 4;
      imgData.data[idx] = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = 255;
    }

    // Draw the small image, then scale up
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = fieldW;
    tempCanvas.height = fieldH;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tempCanvas, 0, 0, width, height);
  }

  function drawSources(): void {
    const sourceY = height * 0.85;
    const centerX = width / 2;
    const firstSourceX = centerX - ((numSources - 1) * spacing) / 2;

    for (let s = 0; s < numSources; s++) {
      const sx = firstSourceX + s * spacing;

      // Source glow
      const glow = ctx.createRadialGradient(sx, sourceY, 0, sx, sourceY, 18);
      glow.addColorStop(0, "rgba(59,130,246,0.9)");
      glow.addColorStop(0.5, "rgba(59,130,246,0.3)");
      glow.addColorStop(1, "rgba(59,130,246,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 18, sourceY - 18, 36, 36);

      // Source dot
      ctx.beginPath();
      ctx.arc(sx, sourceY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#60a5fa";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Phase label
      const phaseVal = (s * phaseDelta) % 360;
      ctx.fillStyle = "rgba(226,232,240,0.7)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`\u03c6=${phaseVal.toFixed(0)}\u00b0`, sx, sourceY + 18);
    }

    // Array base line
    ctx.strokeStyle = "rgba(100,116,139,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(firstSourceX - 15, sourceY);
    ctx.lineTo(firstSourceX + (numSources - 1) * spacing + 15, sourceY);
    ctx.stroke();
  }

  function drawBeamIndicator(): void {
    const beamAngle = computeBeamAngle();
    const beamRad = (beamAngle * Math.PI) / 180;
    const sourceY = height * 0.85;
    const centerX = width / 2;
    const lineLen = height * 0.7;

    // Beam direction arrow
    const endX = centerX + lineLen * Math.sin(beamRad);
    const endY = sourceY - lineLen * Math.cos(beamRad);

    ctx.beginPath();
    ctx.moveTo(centerX, sourceY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = "rgba(239,68,68,0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow head
    const arrowLen = 12;
    const arrowAngle = Math.atan2(endY - sourceY, endX - centerX);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowLen * Math.cos(arrowAngle - 0.3), endY - arrowLen * Math.sin(arrowAngle - 0.3));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowLen * Math.cos(arrowAngle + 0.3), endY - arrowLen * Math.sin(arrowAngle + 0.3));
    ctx.strokeStyle = "rgba(239,68,68,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Angle label near arrow tip
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`\u03b8 = ${beamAngle.toFixed(1)}\u00b0`, endX + 25 * Math.sign(beamAngle || 0.01), endY - 5);
  }

  function drawIntensityPattern(): void {
    // Polar intensity pattern at the right
    const cx = width * 0.88;
    const cy = height * 0.35;
    const radius = Math.min(width * 0.10, height * 0.22);

    // Background circle
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(100,116,139,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Compute far-field pattern
    const speed = 200;
    const k = (2 * Math.PI * frequency) / speed;
    const deltaRad = (phaseDelta * Math.PI) / 180;

    ctx.beginPath();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;

    for (let deg = 0; deg <= 360; deg++) {
      const theta = (deg * Math.PI) / 180;
      const sinT = Math.sin(theta);
      let sumReal = 0;
      let sumImag = 0;
      for (let s = 0; s < numSources; s++) {
        const phase = k * spacing * s * sinT + s * deltaRad;
        sumReal += Math.cos(phase);
        sumImag += Math.sin(phase);
      }
      const intensity = (sumReal * sumReal + sumImag * sumImag) / (numSources * numSources);
      const r = intensity * radius;
      const px = cx + r * sinT;
      const py = cy - r * Math.cos(theta);
      if (deg === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "rgba(34,211,238,0.1)";
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Far-field Pattern", cx, cy + radius + 20);
  }

  function drawInfoPanel(): void {
    const px = 10;
    const py = 10;
    const pw = 210;
    const ph = 125;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Phased Array", px + 12, py + 22);

    const beamAngle = computeBeamAngle();
    const wavelength = 200 / frequency;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    const lines = [
      `Sources: ${numSources}`,
      `Phase \u0394: ${phaseDelta.toFixed(0)}\u00b0`,
      `Beam angle: ${beamAngle.toFixed(1)}\u00b0`,
      `Wavelength: ${wavelength.toFixed(0)} px`,
      `Frequency: ${frequency.toFixed(1)} Hz`,
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, px + 12, py + 42 + i * 17);
    });
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    renderField();
    drawSources();
    drawBeamIndicator();
    drawIntensityPattern();
    drawInfoPanel();

    // Title
    ctx.fillStyle = "rgba(226,232,240,0.85)";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Phased Array Beam Steering", width / 2, height * 0.96);

    // Time
    ctx.fillStyle = "rgba(148,163,184,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`t = ${time.toFixed(2)} s`, width - 10, height - 8);
  }

  function reset(): void {
    time = 0;
    fieldDirty = true;
  }

  function destroy(): void {
    intensityField = null;
  }

  function getStateDescription(): string {
    const beamAngle = computeBeamAngle();
    const wavelength = 200 / frequency;
    return (
      `Phased Array: ${numSources} sources, spacing=${spacing}px, frequency=${frequency}Hz, ` +
      `phase delta=${phaseDelta}\u00b0, wavelength=${wavelength.toFixed(0)}px. ` +
      `Beam steered to ${beamAngle.toFixed(1)}\u00b0. ` +
      `Demonstrates constructive/destructive interference from multiple coherent sources ` +
      `with controlled phase offsets. Used in radar, 5G, and radio astronomy.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    fieldDirty = true;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PhaseArrayFactory;
