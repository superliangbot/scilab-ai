import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Acid-Base data ──────────────────────────────────────────────────
interface AcidBase {
  name: string;
  formula: string;
  Ka: number; // Acid dissociation constant (0 for strong acids/bases)
  pKa: number;
  concentration: number; // M
  color: string;
  isAcid: boolean;
}

const ACIDS: AcidBase[] = [
  { name: "Hydrochloric Acid", formula: "HCl", Ka: Infinity, pKa: -7, concentration: 0.1, color: "#ef4444", isAcid: true },
  { name: "Acetic Acid", formula: "CH₃COOH", Ka: 1.8e-5, pKa: 4.74, concentration: 0.1, color: "#f59e0b", isAcid: true },
  { name: "Formic Acid", formula: "HCOOH", Ka: 1.8e-4, pKa: 3.74, concentration: 0.1, color: "#10b981", isAcid: true },
  { name: "Carbonic Acid", formula: "H₂CO₃", Ka: 4.3e-7, pKa: 6.37, concentration: 0.1, color: "#8b5cf6", isAcid: true }
];

const BASES: AcidBase[] = [
  { name: "Sodium Hydroxide", formula: "NaOH", Ka: 0, pKa: 15, concentration: 0.1, color: "#3b82f6", isAcid: false },
  { name: "Ammonia", formula: "NH₃", Ka: 5.6e-10, pKa: 9.25, concentration: 0.1, color: "#06b6d4", isAcid: false },
  { name: "Potassium Hydroxide", formula: "KOH", Ka: 0, pKa: 15, concentration: 0.1, color: "#0ea5e9", isAcid: false }
];

interface Indicator {
  name: string;
  pKa: number;
  acidColor: string;
  baseColor: string;
  range: [number, number]; // pH range where color change occurs
}

const INDICATORS: Indicator[] = [
  { name: "Methyl Orange", pKa: 3.7, acidColor: "#ff0000", baseColor: "#ffff00", range: [3.1, 4.4] },
  { name: "Bromothymol Blue", pKa: 7.0, acidColor: "#ffff00", baseColor: "#0080ff", range: [6.0, 7.6] },
  { name: "Phenolphthalein", pKa: 9.3, acidColor: "#ffffff", baseColor: "#ff00ff", range: [8.3, 10.0] },
  { name: "Universal", pKa: 7.0, acidColor: "#ff0000", baseColor: "#0080ff", range: [0, 14] }
];

interface TitrationPoint {
  volume: number; // mL of titrant added
  pH: number;
  dpH_dV: number; // derivative for finding equivalence point
}

// ─── Factory ─────────────────────────────────────────────────────────
const TitrationCurvesFactory: SimulationFactory = () => {
  const config = getSimConfig("titration-curves") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let acidType = 0;
  let baseType = 0;
  let acidConcentration = 0.1;
  let baseConcentration = 0.1;
  let indicatorType = 0;
  let showDerivative = 0;
  let currentVolume = 0; // mL of base added

  // State
  let currentAcid: AcidBase;
  let currentBase: AcidBase;
  let currentIndicator: Indicator;
  let titrationData: TitrationPoint[] = [];
  let equivalencePoint: TitrationPoint | null = null;
  let bufferRegions: Array<{ start: number; end: number; pH: number }> = [];

  // Animation
  let animating = false;
  let targetVolume = 0;
  let buretteVolume = 50; // mL capacity

  function initializeSystem(): void {
    currentAcid = { ...ACIDS[acidType] };
    currentBase = { ...BASES[baseType] };
    currentIndicator = INDICATORS[indicatorType];
    
    currentAcid.concentration = acidConcentration;
    currentBase.concentration = baseConcentration;
    
    calculateTitrationCurve();
    currentVolume = 0;
  }

  function calculateTitrationCurve(): void {
    titrationData = [];
    bufferRegions = [];
    
    const maxVolume = 50; // mL
    const steps = 1000;
    
    for (let i = 0; i <= steps; i++) {
      const volume = (i / steps) * maxVolume;
      const pH = calculatePH(volume);
      
      titrationData.push({
        volume,
        pH,
        dpH_dV: 0 // Will calculate derivative after
      });
    }
    
    // Calculate derivatives to find equivalence point
    for (let i = 1; i < titrationData.length - 1; i++) {
      const prev = titrationData[i - 1];
      const next = titrationData[i + 1];
      titrationData[i].dpH_dV = (next.pH - prev.pH) / (next.volume - prev.volume);
    }
    
    // Find equivalence point (maximum derivative)
    let maxDerivative = 0;
    equivalencePoint = null;
    
    for (const point of titrationData) {
      if (Math.abs(point.dpH_dV) > maxDerivative) {
        maxDerivative = Math.abs(point.dpH_dV);
        equivalencePoint = point;
      }
    }
    
    // Identify buffer regions (where pH changes slowly)
    identifyBufferRegions();
  }

  function calculatePH(volumeAdded: number): number {
    const Va = 25; // mL of acid initially
    const Ca = currentAcid.concentration;
    const Cb = currentBase.concentration;
    const Vb = volumeAdded;
    
    const totalVolume = Va + Vb; // mL
    
    if (totalVolume === 0) return currentAcid.isAcid ? 1 : 13;
    
    // Moles of acid and base
    const molesAcid = (Ca * Va) / 1000; // Convert to L
    const molesBase = (Cb * Vb) / 1000;
    
    // Strong acid + Strong base
    if (currentAcid.Ka === Infinity && currentBase.Ka === 0) {
      return strongAcidStrongBasePH(molesAcid, molesBase, totalVolume);
    }
    
    // Weak acid + Strong base
    if (currentAcid.Ka !== Infinity && currentBase.Ka === 0) {
      return weakAcidStrongBasePH(molesAcid, molesBase, totalVolume, currentAcid.Ka, currentAcid.pKa);
    }
    
    // Strong acid + Weak base
    if (currentAcid.Ka === Infinity && currentBase.Ka !== 0) {
      return strongAcidWeakBasePH(molesAcid, molesBase, totalVolume, currentBase.Ka);
    }
    
    // Weak acid + Weak base (simplified)
    return weakAcidWeakBasePH(molesAcid, molesBase, totalVolume, currentAcid.Ka, currentBase.Ka);
  }

  function strongAcidStrongBasePH(molesAcid: number, molesBase: number, totalVolume: number): number {
    const excessMoles = molesBase - molesAcid;
    const concentration = Math.abs(excessMoles) / (totalVolume / 1000);
    
    if (Math.abs(excessMoles) < 1e-10) {
      return 7.0; // Equivalence point
    } else if (excessMoles < 0) {
      // Excess acid
      return -Math.log10(concentration);
    } else {
      // Excess base
      const pOH = -Math.log10(concentration);
      return 14 - pOH;
    }
  }

  function weakAcidStrongBasePH(molesAcid: number, molesBase: number, totalVolume: number, Ka: number, pKa: number): number {
    const totalVolumeL = totalVolume / 1000;
    
    if (molesBase === 0) {
      // Initial weak acid solution
      const Ca = molesAcid / totalVolumeL;
      return 0.5 * (pKa - Math.log10(Ca));
    }
    
    if (molesBase >= molesAcid) {
      // Past equivalence point
      const excessBase = molesBase - molesAcid;
      const concentration = excessBase / totalVolumeL;
      return 14 + Math.log10(concentration);
    }
    
    // Before equivalence point - Henderson-Hasselbalch
    const molesAcidRemaining = molesAcid - molesBase;
    const molesConjugateBase = molesBase;
    
    const ratio = molesConjugateBase / molesAcidRemaining;
    return pKa + Math.log10(ratio);
  }

  function strongAcidWeakBasePH(molesAcid: number, molesBase: number, totalVolume: number, Kb: number): number {
    const totalVolumeL = totalVolume / 1000;
    const pKb = -Math.log10(Kb);
    const pKw = 14;
    
    if (molesAcid >= molesBase) {
      // Excess acid
      const excessAcid = molesAcid - molesBase;
      const concentration = excessAcid / totalVolumeL;
      return -Math.log10(concentration);
    }
    
    // Past equivalence point - excess base
    const excessBase = molesBase - molesAcid;
    const concentration = excessBase / totalVolumeL;
    return pKw - pKb + 0.5 * Math.log10(concentration);
  }

  function weakAcidWeakBasePH(molesAcid: number, molesBase: number, totalVolume: number, Ka: number, Kb: number): number {
    // Simplified calculation for weak acid + weak base
    const totalVolumeL = totalVolume / 1000;
    const excessMoles = molesBase - molesAcid;
    
    if (Math.abs(excessMoles) < 1e-10) {
      // Equivalence point
      const pKa = -Math.log10(Ka);
      const pKb = -Math.log10(Kb);
      return 7 + 0.5 * (pKa - pKb);
    }
    
    // Use dominant species
    if (excessMoles < 0) {
      const concentration = Math.abs(excessMoles) / totalVolumeL;
      return 0.5 * (-Math.log10(Ka) - Math.log10(concentration));
    } else {
      const concentration = excessMoles / totalVolumeL;
      return 14 - 0.5 * (-Math.log10(Kb) - Math.log10(concentration));
    }
  }

  function identifyBufferRegions(): void {
    bufferRegions = [];
    
    if (currentAcid.Ka === Infinity) return; // No buffering with strong acid
    
    // Buffer region is roughly pKa ± 1
    const bufferStart = Math.max(0, currentAcid.pKa - 1);
    const bufferEnd = Math.min(14, currentAcid.pKa + 1);
    
    // Find volumes corresponding to buffer pH range
    let startVolume = 0;
    let endVolume = 0;
    
    for (const point of titrationData) {
      if (point.pH >= bufferStart && startVolume === 0) startVolume = point.volume;
      if (point.pH <= bufferEnd) endVolume = point.volume;
    }
    
    if (startVolume < endVolume) {
      bufferRegions.push({
        start: startVolume,
        end: endVolume,
        pH: currentAcid.pKa
      });
    }
  }

  function getIndicatorColor(pH: number): string {
    const indicator = currentIndicator;
    
    if (indicator.name === "Universal") {
      // Universal indicator shows full color spectrum
      if (pH <= 1) return "#8b0000";      // Dark red
      if (pH <= 2) return "#ff0000";      // Red  
      if (pH <= 3) return "#ff4500";      // Orange red
      if (pH <= 4) return "#ffa500";      // Orange
      if (pH <= 5) return "#ffff00";      // Yellow
      if (pH <= 6) return "#9acd32";      // Yellow green
      if (pH <= 7) return "#00ff00";      // Green
      if (pH <= 8) return "#00ffff";      // Cyan
      if (pH <= 9) return "#0000ff";      // Blue
      if (pH <= 10) return "#4169e1";     // Royal blue
      if (pH <= 11) return "#8a2be2";     // Blue violet
      if (pH <= 12) return "#9932cc";     // Dark orchid
      return "#4b0082";                   // Indigo
    }
    
    // Single indicator transition
    const [acidColor, baseColor] = [indicator.acidColor, indicator.baseColor];
    const [pHLow, pHHigh] = indicator.range;
    
    if (pH <= pHLow) return acidColor;
    if (pH >= pHHigh) return baseColor;
    
    // Interpolate between colors
    const fraction = (pH - pHLow) / (pHHigh - pHLow);
    return interpolateColor(acidColor, baseColor, fraction);
  }

  function interpolateColor(color1: string, color2: string, fraction: number): string {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);
    
    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);
    
    const r = Math.round(r1 + fraction * (r2 - r1));
    const g = Math.round(g1 + fraction * (g2 - g1));
    const b = Math.round(b1 + fraction * (b2 - b1));
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawTitrationCurve(): void {
    const plotX = W * 0.55;
    const plotY = H * 0.05;
    const plotW = W * 0.42;
    const plotH = H * 0.5;
    
    // Background
    ctx.fillStyle = "rgba(15, 20, 40, 0.9)";
    ctx.fillRect(plotX, plotY, plotW, plotH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);
    
    // Title
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Titration Curve", plotX + plotW/2, plotY + 15);
    
    // Axes
    const axisX = plotX + 40;
    const axisY = plotY + plotH - 30;
    const chartW = plotW - 60;
    const chartH = plotH - 60;
    
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(axisX, plotY + 30);
    ctx.lineTo(axisX, axisY);
    ctx.lineTo(axisX + chartW, axisY);
    ctx.stroke();
    
    // Buffer region highlighting
    for (const buffer of bufferRegions) {
      const startX = axisX + (buffer.start / 50) * chartW;
      const endX = axisX + (buffer.end / 50) * chartW;
      
      ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
      ctx.fillRect(startX, plotY + 30, endX - startX, chartH);
      
      ctx.font = "8px monospace";
      ctx.fillStyle = "#22c55e";
      ctx.textAlign = "center";
      ctx.fillText("Buffer", (startX + endX) / 2, plotY + 45);
    }
    
    // Plot curve
    if (titrationData.length > 1) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < titrationData.length; i++) {
        const point = titrationData[i];
        const x = axisX + (point.volume / 50) * chartW;
        const y = axisY - (point.pH / 14) * chartH;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Derivative curve (if enabled)
      if (showDerivative) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        
        const maxDeriv = Math.max(...titrationData.map(p => Math.abs(p.dpH_dV)));
        
        for (let i = 0; i < titrationData.length; i++) {
          const point = titrationData[i];
          const x = axisX + (point.volume / 50) * chartW;
          const y = axisY - (Math.abs(point.dpH_dV) / maxDeriv) * chartH * 0.5;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // Current point
    const currentX = axisX + (currentVolume / 50) * chartW;
    const currentPH = calculatePH(currentVolume);
    const currentY = axisY - (currentPH / 14) * chartH;
    
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Equivalence point
    if (equivalencePoint) {
      const eqX = axisX + (equivalencePoint.volume / 50) * chartW;
      const eqY = axisY - (equivalencePoint.pH / 14) * chartH;
      
      ctx.strokeStyle = "#10b981";
      ctx.fillStyle = "rgba(16, 185, 129, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(eqX, eqY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.font = "9px monospace";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "center";
      ctx.fillText("Equiv.", eqX, eqY - 10);
    }
    
    // Axis labels
    ctx.font = "10px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    
    // X-axis ticks
    for (let v = 0; v <= 50; v += 10) {
      const x = axisX + (v / 50) * chartW;
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, axisY + 5);
      ctx.stroke();
      ctx.fillText(v.toString(), x, axisY + 15);
    }
    
    // Y-axis ticks  
    ctx.textAlign = "right";
    for (let ph = 0; ph <= 14; ph += 2) {
      const y = axisY - (ph / 14) * chartH;
      ctx.beginPath();
      ctx.moveTo(axisX - 5, y);
      ctx.lineTo(axisX, y);
      ctx.stroke();
      ctx.fillText(ph.toString(), axisX - 8, y + 3);
    }
    
    // Axis titles
    ctx.font = "11px monospace";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText(`Volume of ${currentBase.formula} (mL)`, axisX + chartW/2, axisY + 25);
    
    ctx.save();
    ctx.translate(axisX - 25, plotY + 30 + chartH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("pH", 0, 0);
    ctx.restore();
  }

  function drawLaboratorySetup(): void {
    // Erlenmeyer flask
    const flaskX = W * 0.15;
    const flaskY = H * 0.4;
    const flaskW = 80;
    const flaskH = 100;
    
    // Flask body (trapezoid)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(flaskX, flaskY + flaskH);
    ctx.lineTo(flaskX - 20, flaskY + 40);
    ctx.lineTo(flaskX + flaskW + 20, flaskY + 40);
    ctx.lineTo(flaskX + flaskW, flaskY + flaskH);
    ctx.closePath();
    ctx.stroke();
    
    // Flask neck
    ctx.strokeRect(flaskX + flaskW/2 - 8, flaskY, 16, 40);
    
    // Solution in flask
    const currentPH = calculatePH(currentVolume);
    const solutionColor = getIndicatorColor(currentPH);
    const fillLevel = flaskH * 0.7;
    
    ctx.fillStyle = solutionColor + "80";
    ctx.beginPath();
    ctx.moveTo(flaskX + 5, flaskY + flaskH - 5);
    ctx.lineTo(flaskX - 15, flaskY + 45);
    ctx.lineTo(flaskX + flaskW + 15, flaskY + 45);
    ctx.lineTo(flaskX + flaskW - 5, flaskY + flaskH - 5);
    ctx.closePath();
    ctx.fill();
    
    // Burette
    const buretteX = flaskX + flaskW/2 + 60;
    const buretteY = H * 0.05;
    const buretteW = 12;
    const buretteH = H * 0.6;
    
    // Burette tube
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(buretteX, buretteY, buretteW, buretteH);
    
    // Graduations
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.font = "8px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    
    for (let v = 0; v <= buretteVolume; v += 5) {
      const y = buretteY + (v / buretteVolume) * buretteH;
      ctx.beginPath();
      ctx.moveTo(buretteX, y);
      ctx.lineTo(buretteX + buretteW/2, y);
      ctx.stroke();
      ctx.fillText((buretteVolume - v).toString(), buretteX - 3, y + 3);
    }
    
    // Titrant in burette
    const usedFraction = currentVolume / buretteVolume;
    const titrantHeight = buretteH * (1 - usedFraction);
    
    ctx.fillStyle = currentBase.color + "60";
    ctx.fillRect(buretteX + 1, buretteY + buretteH - titrantHeight, buretteW - 2, titrantHeight);
    
    // Burette tip and droplet
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(buretteX + buretteW/2 - 2, buretteY + buretteH);
    ctx.lineTo(buretteX + buretteW/2 - 1, buretteY + buretteH + 8);
    ctx.lineTo(buretteX + buretteW/2 + 1, buretteY + buretteH + 8);
    ctx.lineTo(buretteX + buretteW/2 + 2, buretteY + buretteH);
    ctx.stroke();
    
    if (animating) {
      // Animated droplet
      ctx.fillStyle = currentBase.color;
      ctx.beginPath();
      ctx.arc(buretteX + buretteW/2, buretteY + buretteH + 15, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // pH meter
    const meterX = W * 0.05;
    const meterY = H * 0.7;
    const meterW = 120;
    const meterH = 80;
    
    ctx.fillStyle = "rgba(30, 30, 30, 0.9)";
    ctx.fillRect(meterX, meterY, meterW, meterH);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, meterY, meterW, meterH);
    
    // pH display
    ctx.fillStyle = "#0ff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`pH: ${currentPH.toFixed(2)}`, meterX + meterW/2, meterY + 30);
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("Digital pH Meter", meterX + meterW/2, meterY + 50);
    ctx.fillText(`Vol: ${currentVolume.toFixed(1)} mL`, meterX + meterW/2, meterY + 65);
  }

  function drawInformation(): void {
    const infoX = W * 0.55;
    const infoY = H * 0.58;
    const infoW = W * 0.42;
    const infoH = H * 0.4;
    
    ctx.fillStyle = "rgba(15, 20, 40, 0.9)";
    ctx.fillRect(infoX, infoY, infoW, infoH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(infoX, infoY, infoW, infoH);
    
    let y = infoY + 20;
    const leftX = infoX + 10;
    
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Titration Information", leftX, y);
    y += 25;
    
    ctx.font = "10px monospace";
    
    // Reaction equation
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Reaction:", leftX, y);
    y += 15;
    ctx.fillStyle = "#cbd5e1";
    const equation = `${currentAcid.formula} + ${currentBase.formula} → Salt + H₂O`;
    ctx.fillText(equation, leftX, y);
    y += 20;
    
    // Concentrations
    ctx.fillStyle = currentAcid.color;
    ctx.fillText(`Analyte: ${currentAcid.name} (${currentAcid.concentration} M)`, leftX, y);
    y += 15;
    ctx.fillStyle = currentBase.color;
    ctx.fillText(`Titrant: ${currentBase.name} (${currentBase.concentration} M)`, leftX, y);
    y += 15;
    ctx.fillStyle = currentIndicator.acidColor;
    ctx.fillText(`Indicator: ${currentIndicator.name}`, leftX, y);
    y += 20;
    
    // Key points
    if (equivalencePoint) {
      ctx.fillStyle = "#10b981";
      ctx.fillText(`Equivalence Point:`, leftX, y);
      y += 15;
      ctx.fillText(`  Volume: ${equivalencePoint.volume.toFixed(1)} mL`, leftX, y);
      y += 15;
      ctx.fillText(`  pH: ${equivalencePoint.pH.toFixed(2)}`, leftX, y);
      y += 20;
    }
    
    // Henderson-Hasselbalch info
    if (currentAcid.Ka !== Infinity) {
      ctx.fillStyle = "#8b5cf6";
      ctx.fillText(`pKa: ${currentAcid.pKa.toFixed(2)}`, leftX, y);
      y += 15;
      ctx.fillText(`Henderson-Hasselbalch:`, leftX, y);
      y += 15;
      ctx.fillText(`pH = pKa + log([A⁻]/[HA])`, leftX, y);
      y += 20;
    }
    
    // Buffer information
    if (bufferRegions.length > 0) {
      ctx.fillStyle = "#22c55e";
      ctx.fillText(`Buffer capacity maximum at pH = pKa`, leftX, y);
      y += 15;
      ctx.fillText(`Effective range: pKa ± 1`, leftX, y);
    }
  }

  function drawTitle(): void {
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Acid-Base Titration Curves", W / 2, 25);
    
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Henderson-Hasselbalch equation | Buffer regions | Equivalence points", W / 2, 45);
  }

  // ── Engine implementation ───────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      initializeSystem();
    },

    update(dt: number, params: Record<string, number>) {
      const newAcidType = Math.round(Math.max(0, Math.min(ACIDS.length - 1, params.acidType ?? acidType)));
      const newBaseType = Math.round(Math.max(0, Math.min(BASES.length - 1, params.baseType ?? baseType)));
      const newAcidConc = Math.max(0.01, Math.min(1.0, params.acidConcentration ?? acidConcentration));
      const newBaseConc = Math.max(0.01, Math.min(1.0, params.baseConcentration ?? baseConcentration));
      const newIndicator = Math.round(Math.max(0, Math.min(INDICATORS.length - 1, params.indicatorType ?? indicatorType)));
      
      let recalculate = false;
      
      if (newAcidType !== acidType || newBaseType !== baseType || 
          Math.abs(newAcidConc - acidConcentration) > 0.001 ||
          Math.abs(newBaseConc - baseConcentration) > 0.001) {
        acidType = newAcidType;
        baseType = newBaseType;
        acidConcentration = newAcidConc;
        baseConcentration = newBaseConc;
        recalculate = true;
      }
      
      if (newIndicator !== indicatorType) {
        indicatorType = newIndicator;
        currentIndicator = INDICATORS[indicatorType];
      }
      
      showDerivative = Math.round(params.showDerivative ?? showDerivative);
      
      const newVolume = Math.max(0, Math.min(50, params.currentVolume ?? currentVolume));
      targetVolume = newVolume;
      
      if (recalculate) {
        initializeSystem();
      }
      
      time += dt;
      
      // Animate volume change
      if (Math.abs(currentVolume - targetVolume) > 0.1) {
        animating = true;
        const direction = targetVolume > currentVolume ? 1 : -1;
        currentVolume += direction * Math.min(10 * dt, Math.abs(targetVolume - currentVolume));
      } else {
        animating = false;
        currentVolume = targetVolume;
      }
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      drawTitle();
      drawLaboratorySetup();
      drawTitrationCurve();
      drawInformation();
    },

    reset() {
      time = 0;
      currentVolume = 0;
      targetVolume = 0;
      animating = false;
      initializeSystem();
    },

    destroy() {
      titrationData = [];
      bufferRegions = [];
    },

    getStateDescription(): string {
      const currentPH = calculatePH(currentVolume);
      const percentNeutralized = equivalencePoint ? 
        (currentVolume / equivalencePoint.volume * 100).toFixed(1) : "0";
      
      return `Titration of ${currentAcid.name} (${currentAcid.concentration}M) with ${currentBase.name} (${baseConcentration}M). ` +
             `Current: ${currentVolume.toFixed(1)}mL added, pH = ${currentPH.toFixed(2)}. ` +
             `${equivalencePoint ? `Equivalence point: ${equivalencePoint.volume.toFixed(1)}mL, pH ${equivalencePoint.pH.toFixed(2)}. ` : ""}` +
             `${percentNeutralized}% neutralized. ` +
             `Indicator: ${currentIndicator.name}. ` +
             `${currentAcid.Ka === Infinity ? "Strong acid" : `Weak acid (pKa=${currentAcid.pKa.toFixed(2)})`} titration. ` +
             `Henderson-Hasselbalch equation applies to buffer regions.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default TitrationCurvesFactory;