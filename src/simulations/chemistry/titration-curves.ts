import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface TitrationPoint {
  volumeAdded: number; // mL
  pH: number;
  pOH: number;
  concentration: number; // M
}

interface Indicator {
  name: string;
  transitionRange: [number, number]; // pH range
  acidColor: string;
  baseColor: string;
}

const TitrationCurvesFactory: SimulationFactory = () => {
  const config = getSimConfig("titration-curves") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let acidConcentration = 0.1; // M
  let baseConcentration = 0.1; // M
  let acidVolume = 25; // mL initial volume
  let titrationType = 0; // 0=strong acid/strong base, 1=weak acid/strong base, 2=strong acid/weak base
  let currentVolume = 0; // mL of titrant added
  let autoTitrate = 0;
  let indicatorType = 0;

  // Titration types
  const titrationTypes = [
    { name: "Strong Acid + Strong Base", Ka: null, Kb: null },
    { name: "Weak Acid + Strong Base", Ka: 1.8e-5, Kb: null }, // Acetic acid
    { name: "Strong Acid + Weak Base", Ka: null, Kb: 1.8e-5 }, // Ammonia
  ];

  // pH indicators
  const indicators: Indicator[] = [
    { name: "Methyl Orange", transitionRange: [3.1, 4.4], acidColor: "#ef4444", baseColor: "#f59e0b" },
    { name: "Bromothymol Blue", transitionRange: [6.0, 7.6], acidColor: "#f59e0b", baseColor: "#3b82f6" },
    { name: "Phenolphthalein", transitionRange: [8.2, 10.0], acidColor: "#ffffff", baseColor: "#ec4899" },
    { name: "Universal Indicator", transitionRange: [1.0, 14.0], acidColor: "#ef4444", baseColor: "#8b5cf6" },
  ];

  // State
  let titrationPoints: TitrationPoint[] = [];
  let equivalencePoint: { volume: number; pH: number } | null = null;
  let buretteLevel = 50; // mL, starts full
  let flaskColor = "#e2e8f0";
  let dropAnimation = { active: false, x: 0, y: 0, alpha: 1 };

  function calculatePH(volumeAdded: number): number {
    const totalVolume = acidVolume + volumeAdded;
    const type = titrationTypes[titrationType];
    
    if (titrationType === 0) {
      // Strong acid + Strong base
      const initialMolesAcid = acidConcentration * acidVolume * 1e-3; // mol
      const molesBaseAdded = baseConcentration * volumeAdded * 1e-3; // mol
      const excessMoles = initialMolesAcid - molesBaseAdded;
      
      if (Math.abs(excessMoles) < 1e-10) {
        // At equivalence point
        return 7.0;
      } else if (excessMoles > 0) {
        // Excess acid
        const concentration = excessMoles / (totalVolume * 1e-3);
        return -Math.log10(concentration);
      } else {
        // Excess base
        const concentration = -excessMoles / (totalVolume * 1e-3);
        const pOH = -Math.log10(concentration);
        return 14 - pOH;
      }
    } else if (titrationType === 1) {
      // Weak acid + Strong base (Henderson-Hasselbalch equation)
      const Ka = type.Ka!;
      const pKa = -Math.log10(Ka);
      
      const initialMolesAcid = acidConcentration * acidVolume * 1e-3;
      const molesBaseAdded = baseConcentration * volumeAdded * 1e-3;
      
      if (molesBaseAdded >= initialMolesAcid) {
        // Past equivalence point - excess base
        const excessBase = molesBaseAdded - initialMolesAcid;
        const concentration = excessBase / (totalVolume * 1e-3);
        const pOH = -Math.log10(concentration);
        return 14 - pOH;
      } else if (molesBaseAdded === 0) {
        // No base added yet - weak acid alone
        const concentration = acidConcentration * acidVolume / totalVolume;
        const H = Math.sqrt(Ka * concentration);
        return -Math.log10(H);
      } else {
        // Buffer region - Henderson-Hasselbalch
        const molesAcid = initialMolesAcid - molesBaseAdded;
        const molesConjugateBase = molesBaseAdded;
        
        if (molesAcid > 0) {
          return pKa + Math.log10(molesConjugateBase / molesAcid);
        } else {
          // At equivalence point - salt hydrolysis
          const saltConcentration = initialMolesAcid / (totalVolume * 1e-3);
          const Kb = 1e-14 / Ka;
          const OH = Math.sqrt(Kb * saltConcentration);
          const pOH = -Math.log10(OH);
          return 14 - pOH;
        }
      }
    } else {
      // Strong acid + Weak base
      const Kb = type.Kb!;
      const Kw = 1e-14;
      const Ka_conjugate = Kw / Kb;
      
      const initialMolesAcid = acidConcentration * acidVolume * 1e-3;
      const initialMolesBase = baseConcentration * volumeAdded * 1e-3;
      
      if (initialMolesAcid >= initialMolesBase) {
        // Excess acid or at equivalence point
        if (initialMolesAcid === initialMolesBase) {
          // At equivalence point - salt hydrolysis
          const saltConcentration = initialMolesBase / (totalVolume * 1e-3);
          const H = Math.sqrt(Ka_conjugate * saltConcentration);
          return -Math.log10(H);
        } else {
          // Excess acid
          const excessAcid = initialMolesAcid - initialMolesBase;
          const concentration = excessAcid / (totalVolume * 1e-3);
          return -Math.log10(concentration);
        }
      } else {
        // This shouldn't happen in a normal titration
        return 7.0;
      }
    }
  }

  function findEquivalencePoint(): { volume: number; pH: number } | null {
    // Calculate theoretical equivalence point
    const molesAcid = acidConcentration * acidVolume * 1e-3;
    const equivalenceVolume = (molesAcid / baseConcentration) * 1000; // mL
    const pH = calculatePH(equivalenceVolume);
    
    return { volume: equivalenceVolume, pH };
  }

  function updateTitrationCurve() {
    titrationPoints = [];
    
    // Generate points from 0 to 50 mL (or a bit past equivalence point)
    const maxVolume = Math.min(50, (equivalencePoint?.volume || 25) * 2);
    const stepSize = maxVolume / 200; // 200 points for smooth curve
    
    for (let v = 0; v <= maxVolume; v += stepSize) {
      const pH = calculatePH(v);
      titrationPoints.push({
        volumeAdded: v,
        pH: pH,
        pOH: 14 - pH,
        concentration: baseConcentration * v / (acidVolume + v),
      });
    }
    
    equivalencePoint = findEquivalencePoint();
  }

  function getIndicatorColor(pH: number): string {
    const indicator = indicators[indicatorType];
    
    if (indicatorType === 3) {
      // Universal indicator - rainbow colors
      if (pH <= 1) return "#8b0000";
      if (pH <= 2) return "#ff0000";
      if (pH <= 3) return "#ff4500";
      if (pH <= 4) return "#ffa500";
      if (pH <= 5) return "#ffff00";
      if (pH <= 6) return "#adff2f";
      if (pH <= 7) return "#00ff00";
      if (pH <= 8) return "#00ffff";
      if (pH <= 9) return "#0080ff";
      if (pH <= 10) return "#0000ff";
      if (pH <= 11) return "#4b0082";
      if (pH <= 12) return "#8b00ff";
      return "#ff1493";
    }
    
    const [low, high] = indicator.transitionRange;
    
    if (pH < low) {
      return indicator.acidColor;
    } else if (pH > high) {
      return indicator.baseColor;
    } else {
      // Transition region - blend colors
      const fraction = (pH - low) / (high - low);
      return blendColors(indicator.acidColor, indicator.baseColor, fraction);
    }
  }

  function blendColors(color1: string, color2: string, fraction: number): string {
    const hex1 = parseInt(color1.substring(1), 16);
    const hex2 = parseInt(color2.substring(1), 16);
    
    const r1 = (hex1 >> 16) & 255;
    const g1 = (hex1 >> 8) & 255;
    const b1 = hex1 & 255;
    
    const r2 = (hex2 >> 16) & 255;
    const g2 = (hex2 >> 8) & 255;
    const b2 = hex2 & 255;
    
    const r = Math.round(r1 + (r2 - r1) * fraction);
    const g = Math.round(g1 + (g2 - g1) * fraction);
    const b = Math.round(b1 + (b2 - b1) * fraction);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function drawTitrationSetup() {
    // Burette
    const buretteX = W * 0.15;
    const buretteY = H * 0.1;
    const buretteW = 30;
    const buretteH = H * 0.4;
    
    // Burette outline
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.strokeRect(buretteX, buretteY, buretteW, buretteH);
    
    // Burette liquid (base solution)
    const liquidHeight = (buretteLevel / 50) * buretteH;
    const liquidGrad = ctx.createLinearGradient(buretteX, buretteY, buretteX + buretteW, buretteY);
    liquidGrad.addColorStop(0, "#3b82f6");
    liquidGrad.addColorStop(1, "#1d4ed8");
    
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(buretteX + 2, buretteY + buretteH - liquidHeight, buretteW - 4, liquidHeight);
    
    // Burette markings
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.font = "8px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    
    for (let i = 0; i <= 50; i += 10) {
      const y = buretteY + buretteH - (i / 50) * buretteH;
      ctx.beginPath();
      ctx.moveTo(buretteX, y);
      ctx.lineTo(buretteX + 8, y);
      ctx.stroke();
      ctx.fillText(`${i}`, buretteX - 5, y + 3);
    }
    
    // Burette tip and stopcock
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(buretteX + buretteW/2, buretteY + buretteH);
    ctx.lineTo(buretteX + buretteW/2, buretteY + buretteH + 20);
    ctx.stroke();
    
    // Stopcock
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(buretteX + buretteW/2 - 8, buretteY + buretteH + 5, 16, 8);
    
    // Flask
    const flaskX = W * 0.08;
    const flaskY = H * 0.6;
    const flaskW = 120;
    const flaskH = 100;
    
    // Flask outline (conical)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(flaskX, flaskY + flaskH);
    ctx.lineTo(flaskX + flaskW * 0.2, flaskY + flaskH * 0.3);
    ctx.lineTo(flaskX + flaskW * 0.4, flaskY);
    ctx.lineTo(flaskX + flaskW * 0.6, flaskY);
    ctx.lineTo(flaskX + flaskW * 0.8, flaskY + flaskH * 0.3);
    ctx.lineTo(flaskX + flaskW, flaskY + flaskH);
    ctx.closePath();
    ctx.stroke();
    
    // Solution in flask
    const currentPH = calculatePH(currentVolume);
    flaskColor = getIndicatorColor(currentPH);
    
    const solutionGrad = ctx.createRadialGradient(
      flaskX + flaskW*0.3, flaskY + flaskH*0.7, 0,
      flaskX + flaskW*0.5, flaskY + flaskH*0.8, flaskW*0.4
    );
    solutionGrad.addColorStop(0, "#ffffff40");
    solutionGrad.addColorStop(0.5, flaskColor);
    solutionGrad.addColorStop(1, flaskColor + "c0");
    
    ctx.fillStyle = solutionGrad;
    ctx.beginPath();
    ctx.moveTo(flaskX + 5, flaskY + flaskH - 5);
    ctx.lineTo(flaskX + flaskW * 0.22, flaskY + flaskH * 0.35);
    ctx.lineTo(flaskX + flaskW * 0.78, flaskY + flaskH * 0.35);
    ctx.lineTo(flaskX + flaskW - 5, flaskY + flaskH - 5);
    ctx.closePath();
    ctx.fill();
    
    // Flask neck
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(flaskX + flaskW * 0.4, flaskY);
    ctx.lineTo(flaskX + flaskW * 0.4, flaskY - 30);
    ctx.lineTo(flaskX + flaskW * 0.6, flaskY - 30);
    ctx.lineTo(flaskX + flaskW * 0.6, flaskY);
    ctx.stroke();
    
    // Drop animation
    if (dropAnimation.active) {
      ctx.fillStyle = `rgba(59, 130, 246, ${dropAnimation.alpha})`;
      ctx.beginPath();
      ctx.arc(dropAnimation.x, dropAnimation.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Burette", buretteX + buretteW/2, buretteY - 10);
    ctx.fillText(`${baseConcentration.toFixed(2)} M NaOH`, buretteX + buretteW/2, buretteY - 25);
    
    ctx.fillText("Erlenmeyer Flask", flaskX + flaskW/2, flaskY + flaskH + 20);
    ctx.fillText(`${acidVolume} mL, ${acidConcentration.toFixed(2)} M Acid`, flaskX + flaskW/2, flaskY + flaskH + 35);
    
    // Current readings
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Volume added: ${currentVolume.toFixed(1)} mL`, W * 0.02, H * 0.35);
    ctx.fillText(`Current pH: ${currentPH.toFixed(2)}`, W * 0.02, H * 0.38);
    ctx.fillText(`Indicator: ${indicators[indicatorType].name}`, W * 0.02, H * 0.41);
    
    if (equivalencePoint) {
      ctx.fillStyle = "#10b981";
      ctx.fillText(`Equivalence point: ${equivalencePoint.volume.toFixed(1)} mL, pH ${equivalencePoint.pH.toFixed(2)}`, W * 0.02, H * 0.45);
    }
  }

  function drawTitrationCurve() {
    const graphX = W * 0.4;
    const graphY = H * 0.1;
    const graphW = W * 0.55;
    const graphH = H * 0.5;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Titration Curve: ${titrationTypes[titrationType].name}`, graphX + graphW/2, graphY + 20);
    
    // Axes
    const axisX = graphX + 50;
    const axisY = graphY + graphH - 40;
    const plotW = graphW - 80;
    const plotH = graphH - 70;
    
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(axisX, graphY + 30);
    ctx.lineTo(axisX, axisY);
    ctx.lineTo(axisX + plotW, axisY);
    ctx.stroke();
    
    // Grid lines
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    // pH grid lines (0-14)
    for (let pH = 0; pH <= 14; pH += 2) {
      const y = axisY - (pH / 14) * plotH;
      ctx.beginPath();
      ctx.moveTo(axisX, y);
      ctx.lineTo(axisX + plotW, y);
      ctx.stroke();
    }
    
    // Volume grid lines
    const maxVol = equivalencePoint ? Math.max(50, equivalencePoint.volume * 1.5) : 50;
    for (let vol = 0; vol <= maxVol; vol += 10) {
      const x = axisX + (vol / maxVol) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, graphY + 30);
      ctx.lineTo(x, axisY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Draw titration curve
    if (titrationPoints.length > 1) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      for (let i = 0; i < titrationPoints.length; i++) {
        const point = titrationPoints[i];
        const x = axisX + (point.volumeAdded / maxVol) * plotW;
        const y = axisY - (point.pH / 14) * plotH;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Mark current point
      const currentPH = calculatePH(currentVolume);
      const currentX = axisX + (currentVolume / maxVol) * plotW;
      const currentY = axisY - (currentPH / 14) * plotH;
      
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Mark equivalence point
    if (equivalencePoint) {
      const eqX = axisX + (equivalencePoint.volume / maxVol) * plotW;
      const eqY = axisY - (equivalencePoint.pH / 14) * plotH;
      
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(eqX, graphY + 30);
      ctx.lineTo(eqX, axisY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(eqX, eqY, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#10b981";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("EP", eqX, eqY - 10);
    }
    
    // Indicator transition ranges
    const indicator = indicators[indicatorType];
    if (indicatorType < 3) {
      const [low, high] = indicator.transitionRange;
      const lowY = axisY - (low / 14) * plotH;
      const highY = axisY - (high / 14) * plotH;
      
      ctx.fillStyle = indicator.acidColor + "40";
      ctx.fillRect(axisX, lowY, plotW, highY - lowY);
      
      ctx.strokeStyle = indicator.acidColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(axisX, lowY);
      ctx.lineTo(axisX + plotW, lowY);
      ctx.moveTo(axisX, highY);
      ctx.lineTo(axisX + plotW, highY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    
    for (let pH = 0; pH <= 14; pH += 2) {
      const y = axisY - (pH / 14) * plotH;
      ctx.fillText(pH.toString(), axisX - 15, y + 4);
    }
    
    for (let vol = 0; vol <= maxVol; vol += 10) {
      const x = axisX + (vol / maxVol) * plotW;
      ctx.fillText(vol.toString(), x, axisY + 15);
    }
    
    // Axis titles
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Volume of Base Added (mL)", axisX + plotW/2, axisY + 35);
    
    ctx.save();
    ctx.translate(axisX - 30, graphY + 30 + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("pH", 0, 0);
    ctx.restore();
  }

  function drawInfoPanel() {
    const panelX = W * 0.4;
    const panelY = H * 0.65;
    const panelW = W * 0.55;
    const panelH = H * 0.3;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    let infoY = panelY + 20;
    
    ctx.fillText("Titration Analysis", panelX + 10, infoY);
    infoY += 25;
    
    // Reaction equation
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px monospace";
    
    if (titrationType === 0) {
      ctx.fillText("HCl + NaOH → NaCl + H₂O", panelX + 10, infoY);
    } else if (titrationType === 1) {
      ctx.fillText("CH₃COOH + NaOH → CH₃COONa + H₂O", panelX + 10, infoY);
    } else {
      ctx.fillText("HCl + NH₃ → NH₄Cl", panelX + 10, infoY);
    }
    infoY += 20;
    
    // Current calculations
    const totalVolume = acidVolume + currentVolume;
    const currentPH = calculatePH(currentVolume);
    
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Initial moles acid: ${(acidConcentration * acidVolume * 1e-3).toExponential(3)} mol`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Moles base added: ${(baseConcentration * currentVolume * 1e-3).toExponential(3)} mol`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Total volume: ${totalVolume.toFixed(1)} mL`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Current pH: ${currentPH.toFixed(2)}`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Current pOH: ${(14 - currentPH).toFixed(2)}`, panelX + 10, infoY);
    infoY += 20;
    
    // Henderson-Hasselbalch equation for weak acid/base
    if (titrationType === 1 && currentVolume > 0 && currentVolume < (equivalencePoint?.volume || 0)) {
      const pKa = -Math.log10(titrationTypes[1].Ka!);
      ctx.fillStyle = "#8b5cf6";
      ctx.fillText("Henderson-Hasselbalch:", panelX + 10, infoY);
      infoY += 16;
      ctx.fillText(`pH = pKa + log([A⁻]/[HA])`, panelX + 10, infoY);
      infoY += 16;
      ctx.fillText(`pKa = ${pKa.toFixed(2)}`, panelX + 10, infoY);
    }
    
    // Indicator color bar
    const colorBarX = panelX + panelW - 120;
    const colorBarY = panelY + 20;
    const colorBarW = 100;
    const colorBarH = 20;
    
    ctx.fillStyle = flaskColor;
    ctx.fillRect(colorBarX, colorBarY, colorBarW, colorBarH);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(colorBarX, colorBarY, colorBarW, colorBarH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Solution Color", colorBarX + colorBarW/2, colorBarY + colorBarH + 15);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      updateTitrationCurve();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      acidConcentration = Math.max(0.01, Math.min(1.0, params.acidConcentration ?? acidConcentration));
      baseConcentration = Math.max(0.01, Math.min(1.0, params.baseConcentration ?? baseConcentration));
      acidVolume = Math.max(10, Math.min(100, params.acidVolume ?? acidVolume));
      
      const newTitrationType = Math.round(params.titrationType ?? titrationType);
      if (newTitrationType !== titrationType) {
        titrationType = Math.max(0, Math.min(2, newTitrationType));
        currentVolume = 0;
        updateTitrationCurve();
      }
      
      indicatorType = Math.round(Math.max(0, Math.min(3, params.indicatorType ?? indicatorType)));
      
      currentVolume = Math.max(0, Math.min(60, params.currentVolume ?? currentVolume));
      autoTitrate = Math.round(params.autoTitrate ?? autoTitrate);
      
      if (autoTitrate && equivalencePoint) {
        // Auto-titrate slowly towards equivalence point
        const targetVolume = equivalencePoint.volume * 1.1; // Go slightly past
        if (currentVolume < targetVolume) {
          currentVolume += dt * 5; // 5 mL/s
          
          // Add drop animation
          if (Math.random() < 0.5) {
            dropAnimation = {
              active: true,
              x: W * 0.15 + 15,
              y: H * 0.5 + 20,
              alpha: 1,
            };
          }
        }
      }
      
      // Update burette level
      buretteLevel = Math.max(0, 50 - currentVolume);
      
      // Update drop animation
      if (dropAnimation.active) {
        dropAnimation.y += 200 * dt;
        dropAnimation.alpha -= dt * 2;
        
        if (dropAnimation.alpha <= 0) {
          dropAnimation.active = false;
        }
      }
      
      time += dt;
      updateTitrationCurve();
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Acid-Base Titration", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("pH curves, equivalence points, and indicators", W / 2, 50);

      // Draw components
      drawTitrationSetup();
      drawTitrationCurve();
      drawInfoPanel();

      // Show completion status
      if (equivalencePoint && Math.abs(currentVolume - equivalencePoint.volume) < 0.5) {
        ctx.fillStyle = "#10b981";
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("EQUIVALENCE POINT REACHED!", W / 2, H - 30);
      }
    },

    reset() {
      time = 0;
      currentVolume = 0;
      buretteLevel = 50;
      dropAnimation.active = false;
      updateTitrationCurve();
    },

    destroy() {},

    getStateDescription(): string {
      const currentPH = calculatePH(currentVolume);
      const type = titrationTypes[titrationType].name;
      const indicator = indicators[indicatorType].name;
      
      return `Acid-base titration: ${type}. ${acidVolume}mL of ${acidConcentration.toFixed(2)}M acid + ` +
             `${currentVolume.toFixed(1)}mL of ${baseConcentration.toFixed(2)}M base. Current pH: ${currentPH.toFixed(2)}. ` +
             `Indicator: ${indicator} (solution color reflects pH). ${equivalencePoint ? 
             `Equivalence point at ${equivalencePoint.volume.toFixed(1)}mL, pH ${equivalencePoint.pH.toFixed(2)}.` : ""}`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default TitrationCurvesFactory;