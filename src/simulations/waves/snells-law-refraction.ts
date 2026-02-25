import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const SnellsLawRefraction: SimulationFactory = () => {
  const config = getSimConfig("snells-law-refraction")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics parameters
  let incidentAngle = 30; // degrees
  let refractiveIndex1 = 1.0; // air/vacuum
  let refractiveIndex2 = 1.5; // glass
  let wavelength1 = 500; // nm (green light)
  let time = 0;

  // Calculated values
  let refractedAngle = 0;
  let reflectedAngle = 0;
  let criticalAngle = 0;
  let totalInternalReflection = false;

  // Wave visualization
  let wavePhase = 0;
  const waveSpeed = 50; // for animation

  // Interface position
  const interfaceY = height * 0.5;

  // Colors
  const BG = "#0f172a";
  const MEDIUM1_COLOR = "#1e40af";
  const MEDIUM2_COLOR = "#dc2626";
  const INCIDENT_RAY = "#10b981";
  const REFLECTED_RAY = "#f59e0b";
  const REFRACTED_RAY = "#a855f7";
  const NORMAL_COLOR = "#e2e8f0";
  const INTERFACE_COLOR = "#ef4444";
  const WAVEFRONT_COLOR = "#06b6d4";
  const GRID_COLOR = "rgba(148, 163, 184, 0.2)";
  const TEXT_COLOR = "#e2e8f0";

  function computePhysics(dt: number, params: Record<string, number>) {
    incidentAngle = Math.max(0, Math.min(90, params.incidentAngle ?? incidentAngle));
    refractiveIndex1 = params.refractiveIndex1 ?? refractiveIndex1;
    refractiveIndex2 = params.refractiveIndex2 ?? refractiveIndex2;
    wavelength1 = params.wavelength1 ?? wavelength1;

    time += dt;
    wavePhase += waveSpeed * dt;

    // Convert to radians
    const thetaI = (incidentAngle * Math.PI) / 180;
    
    // Calculate critical angle
    if (refractiveIndex1 > refractiveIndex2) {
      criticalAngle = Math.asin(refractiveIndex2 / refractiveIndex1) * 180 / Math.PI;
      totalInternalReflection = incidentAngle > criticalAngle;
    } else {
      criticalAngle = 90;
      totalInternalReflection = false;
    }

    // Reflected angle (always equal to incident angle)
    reflectedAngle = incidentAngle;

    // Refracted angle using Snell's law: n₁sin(θ₁) = n₂sin(θ₂)
    if (!totalInternalReflection) {
      const sinThetaR = (refractiveIndex1 / refractiveIndex2) * Math.sin(thetaI);
      if (sinThetaR <= 1) {
        refractedAngle = (Math.asin(sinThetaR) * 180) / Math.PI;
      } else {
        totalInternalReflection = true;
      }
    }
  }

  function drawMedia() {
    // Medium 1 (top)
    ctx.fillStyle = "rgba(30, 64, 175, 0.1)";
    ctx.fillRect(0, 0, width, interfaceY);
    
    // Medium 2 (bottom)
    ctx.fillStyle = "rgba(220, 38, 38, 0.1)";
    ctx.fillRect(0, interfaceY, width, height - interfaceY);

    // Interface line
    ctx.strokeStyle = INTERFACE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, interfaceY);
    ctx.lineTo(width, interfaceY);
    ctx.stroke();

    // Normal line
    const centerX = width * 0.5;
    ctx.strokeStyle = NORMAL_COLOR;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, 50);
    ctx.lineTo(centerX, height - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = MEDIUM1_COLOR;
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Medium 1: n₁ = ${refractiveIndex1.toFixed(2)}`, 20, 40);
    
    ctx.fillStyle = MEDIUM2_COLOR;
    ctx.fillText(`Medium 2: n₂ = ${refractiveIndex2.toFixed(2)}`, 20, height - 20);

    // Normal label
    ctx.fillStyle = NORMAL_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Normal", centerX + 25, 30);
  }

  function drawRays() {
    const centerX = width * 0.5;
    const rayLength = 120;

    // Incident ray
    const incidentRadians = (incidentAngle * Math.PI) / 180;
    const incidentEndX = centerX - rayLength * Math.sin(incidentRadians);
    const incidentEndY = interfaceY - rayLength * Math.cos(incidentRadians);

    ctx.strokeStyle = INCIDENT_RAY;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(incidentEndX, incidentEndY);
    ctx.lineTo(centerX, interfaceY);
    ctx.stroke();

    // Arrow for incident ray
    drawArrow(centerX, interfaceY, incidentEndX, incidentEndY, INCIDENT_RAY);

    // Reflected ray
    const reflectedRadians = (reflectedAngle * Math.PI) / 180;
    const reflectedEndX = centerX + rayLength * Math.sin(reflectedRadians);
    const reflectedEndY = interfaceY - rayLength * Math.cos(reflectedRadians);

    ctx.strokeStyle = REFLECTED_RAY;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(centerX, interfaceY);
    ctx.lineTo(reflectedEndX, reflectedEndY);
    ctx.stroke();

    // Arrow for reflected ray
    drawArrow(centerX, interfaceY, reflectedEndX, reflectedEndY, REFLECTED_RAY);

    // Refracted ray (only if not total internal reflection)
    if (!totalInternalReflection) {
      const refractedRadians = (refractedAngle * Math.PI) / 180;
      const refractedEndX = centerX + rayLength * Math.sin(refractedRadians);
      const refractedEndY = interfaceY + rayLength * Math.cos(refractedRadians);

      ctx.strokeStyle = REFRACTED_RAY;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centerX, interfaceY);
      ctx.lineTo(refractedEndX, refractedEndY);
      ctx.stroke();

      // Arrow for refracted ray
      drawArrow(centerX, interfaceY, refractedEndX, refractedEndY, REFRACTED_RAY);
    }

    // Draw angle arcs
    drawAngleArc(centerX, interfaceY, incidentAngle, true, INCIDENT_RAY, "θᵢ");
    drawAngleArc(centerX, interfaceY, reflectedAngle, false, REFLECTED_RAY, "θᵣ");
    
    if (!totalInternalReflection) {
      drawAngleArcBottom(centerX, interfaceY, refractedAngle, REFRACTED_RAY, "θₜ");
    }
  }

  function drawArrow(fromX: number, fromY: number, toX: number, toY: number, color: string) {
    const arrowSize = 8;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - arrowSize * Math.cos(angle - Math.PI / 6), toY - arrowSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - arrowSize * Math.cos(angle + Math.PI / 6), toY - arrowSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function drawAngleArc(centerX: number, centerY: number, angle: number, isLeft: boolean, color: string, label: string) {
    const radius = 30;
    const angleRad = (angle * Math.PI) / 180;
    const startAngle = -Math.PI / 2; // From normal (pointing up)
    const endAngle = startAngle + (isLeft ? -angleRad : angleRad);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
    ctx.stroke();

    // Label
    const labelAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius + 15;
    const labelX = centerX + labelRadius * Math.cos(labelAngle);
    const labelY = centerY + labelRadius * Math.sin(labelAngle);

    ctx.fillStyle = color;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX, labelY);

    // Angle value
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.fillText(`${angle.toFixed(1)}°`, labelX, labelY + 12);
  }

  function drawAngleArcBottom(centerX: number, centerY: number, angle: number, color: string, label: string) {
    const radius = 30;
    const angleRad = (angle * Math.PI) / 180;
    const startAngle = Math.PI / 2; // From normal (pointing down)
    const endAngle = startAngle + angleRad;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.stroke();

    // Label
    const labelAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius + 15;
    const labelX = centerX + labelRadius * Math.cos(labelAngle);
    const labelY = centerY + labelRadius * Math.sin(labelAngle);

    ctx.fillStyle = color;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX, labelY);

    // Angle value
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.fillText(`${angle.toFixed(1)}°`, labelX, labelY + 12);
  }

  function drawWavefronts() {
    const centerX = width * 0.5;
    const wavelengthPx = 25; // pixel spacing between wavefronts
    const numWavefronts = 8;

    // Incident wavefronts
    ctx.strokeStyle = WAVEFRONT_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);

    for (let i = 0; i < numWavefronts; i++) {
      const offset = (wavePhase + i * wavelengthPx) % (wavelengthPx * 2);
      const incidentRadians = (incidentAngle * Math.PI) / 180;
      
      // Calculate wavefront position
      const distance = 40 + offset;
      const waveX = centerX - distance * Math.sin(incidentRadians);
      const waveY = interfaceY - distance * Math.cos(incidentRadians);
      
      if (waveY > 0 && waveX > 0 && waveX < width) {
        // Draw wavefront perpendicular to ray direction
        const perpAngle = incidentRadians + Math.PI / 2;
        const halfLength = 20;
        const x1 = waveX - halfLength * Math.cos(perpAngle);
        const y1 = waveY - halfLength * Math.sin(perpAngle);
        const x2 = waveX + halfLength * Math.cos(perpAngle);
        const y2 = waveY + halfLength * Math.sin(perpAngle);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Refracted wavefronts (if not total internal reflection)
    if (!totalInternalReflection) {
      for (let i = 0; i < numWavefronts; i++) {
        const offset = (wavePhase + i * wavelengthPx) % (wavelengthPx * 2);
        const refractedRadians = (refractedAngle * Math.PI) / 180;
        
        // Adjust wavelength in second medium
        const wavelength2 = wavelength1 * (refractiveIndex1 / refractiveIndex2);
        const wavelengthPx2 = wavelengthPx * (wavelength2 / wavelength1);
        
        const distance = offset;
        const waveX = centerX + distance * Math.sin(refractedRadians);
        const waveY = interfaceY + distance * Math.cos(refractedRadians);
        
        if (waveY < height && waveX > 0 && waveX < width && distance < 150) {
          const perpAngle = refractedRadians + Math.PI / 2;
          const halfLength = 20;
          const x1 = waveX - halfLength * Math.cos(perpAngle);
          const y1 = waveY - halfLength * Math.sin(perpAngle);
          const x2 = waveX + halfLength * Math.cos(perpAngle);
          const y2 = waveY + halfLength * Math.sin(perpAngle);
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    ctx.setLineDash([]);
  }

  function drawInfoPanel() {
    const panelX = width * 0.65;
    const panelY = 50;
    const panelW = width * 0.32;
    const panelH = height * 0.4;

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
    ctx.fillText("Snell's Law", textX, textY);
    textY += lineHeight + 5;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText("n₁sin(θᵢ) = n₂sin(θₜ)", textX, textY);
    textY += lineHeight + 10;

    ctx.fillStyle = INCIDENT_RAY;
    ctx.fillText(`θᵢ = ${incidentAngle.toFixed(1)}°`, textX, textY);
    textY += lineHeight;

    ctx.fillStyle = REFLECTED_RAY;
    ctx.fillText(`θᵣ = ${reflectedAngle.toFixed(1)}°`, textX, textY);
    textY += lineHeight;

    if (!totalInternalReflection) {
      ctx.fillStyle = REFRACTED_RAY;
      ctx.fillText(`θₜ = ${refractedAngle.toFixed(1)}°`, textX, textY);
    } else {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("Total Internal Reflection!", textX, textY);
    }
    textY += lineHeight + 10;

    // Critical angle info
    if (refractiveIndex1 > refractiveIndex2) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "11px monospace";
      ctx.fillText(`Critical angle: ${criticalAngle.toFixed(1)}°`, textX, textY);
      textY += lineHeight;
    }

    // Wavelength information
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    textY += 5;
    ctx.fillText(`λ₁ = ${wavelength1.toFixed(0)} nm`, textX, textY);
    textY += lineHeight - 2;
    
    if (!totalInternalReflection) {
      const wavelength2 = wavelength1 * (refractiveIndex1 / refractiveIndex2);
      ctx.fillText(`λ₂ = ${wavelength2.toFixed(0)} nm`, textX, textY);
      textY += lineHeight - 2;
      ctx.fillText("(λ₂ = λ₁ × n₁/n₂)", textX, textY);
    }
    textY += lineHeight + 5;

    // Speed information
    const speed1 = 299792458 / refractiveIndex1; // m/s
    const speed2 = 299792458 / refractiveIndex2;
    ctx.fillText(`v₁ = ${(speed1/1e6).toFixed(0)} Mm/s`, textX, textY);
    textY += lineHeight - 2;
    ctx.fillText(`v₂ = ${(speed2/1e6).toFixed(0)} Mm/s`, textX, textY);
  }

  function drawSnellsLawVerification() {
    const panelX = 20;
    const panelY = height - 120;
    const panelW = width - 40;
    const panelH = 100;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 15;
    let textY = panelY + 18;
    const lineHeight = 16;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    // Verification calculation
    const leftSide = refractiveIndex1 * Math.sin((incidentAngle * Math.PI) / 180);
    
    if (!totalInternalReflection) {
      const rightSide = refractiveIndex2 * Math.sin((refractedAngle * Math.PI) / 180);
      ctx.fillText(`Verification: n₁sin(θᵢ) = ${leftSide.toFixed(4)}, n₂sin(θₜ) = ${rightSide.toFixed(4)}`, textX, textY);
      textY += lineHeight;
      
      const difference = Math.abs(leftSide - rightSide);
      const color = difference < 0.001 ? "#10b981" : "#ef4444";
      ctx.fillStyle = color;
      ctx.fillText(`Difference: ${difference.toFixed(6)} ${difference < 0.001 ? "✓" : "✗"}`, textX, textY);
    } else {
      ctx.fillText(`n₁sin(θᵢ) = ${leftSide.toFixed(4)} > n₂ = ${refractiveIndex2.toFixed(2)} → Total Internal Reflection`, textX, textY);
      textY += lineHeight;
      ctx.fillStyle = "#f59e0b";
      ctx.fillText(`All incident light is reflected when θᵢ > θc = ${criticalAngle.toFixed(1)}°`, textX, textY);
    }

    textY += lineHeight;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("Physical insight: Light bends toward normal when entering denser medium (n₂ > n₁), away from normal when entering less dense medium", textX, textY);
    textY += 12;
    ctx.fillText("Applications: Fiber optics (total internal reflection), lenses (refraction), prisms (dispersion)", textX, textY);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      wavePhase = 0;
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawMedia();
      drawWavefronts();
      drawRays();
      drawInfoPanel();
      drawSnellsLawVerification();
    },

    reset() {
      time = 0;
      wavePhase = 0;
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const wavelength2 = totalInternalReflection ? wavelength1 : wavelength1 * (refractiveIndex1 / refractiveIndex2);
      
      return (
        `Snell's law refraction: Light with incident angle θᵢ = ${incidentAngle.toFixed(1)}° traveling from medium n₁ = ${refractiveIndex1.toFixed(2)} to n₂ = ${refractiveIndex2.toFixed(2)}. ` +
        `${totalInternalReflection ? 
          `Total internal reflection occurs (θᵢ > θc = ${criticalAngle.toFixed(1)}°). All light is reflected.` : 
          `Refracted angle θₜ = ${refractedAngle.toFixed(1)}° according to n₁sin(θᵢ) = n₂sin(θₜ). Wavelength changes from ${wavelength1.toFixed(0)}nm to ${wavelength2.toFixed(0)}nm.`} ` +
        `Snell's law describes how light bends when crossing boundaries between materials with different refractive indices. ` +
        `Critical for optics, fiber communications, and understanding atmospheric phenomena.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default SnellsLawRefraction;