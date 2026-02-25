import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const TotalInternalReflection: SimulationFactory = () => {
  const config = getSimConfig("total-internal-reflection")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let n1 = 1.5;    // Glass (denser medium)
  let n2 = 1.0;    // Air (less dense medium)
  let incidentAngle = 45; // degrees
  let time = 0;
  
  // Calculated values
  let criticalAngle = 0;
  let refractedAngle = 0;
  let isTotalReflection = false;

  // Colors and styles
  const BG_COLOR = "#0a0a0f";
  const DENSE_COLOR = "rgba(100, 149, 237, 0.6)"; // Glass (blue)
  const RARE_COLOR = "rgba(135, 206, 235, 0.2)";  // Air (light blue)
  const INCIDENT_COLOR = "#ef4444";
  const REFLECTED_COLOR = "#fbbf24";
  const REFRACTED_COLOR = "#10b981";
  const EVANESCENT_COLOR = "#8b5cf6";
  const CRITICAL_COLOR = "#ec4899";
  const TEXT_COLOR = "#e2e8f0";

  function calculateAngles() {
    const thetaI = (incidentAngle * Math.PI) / 180;
    
    // Critical angle: sin(θc) = n2/n1 (when going from denser to rarer medium)
    criticalAngle = (Math.asin(n2 / n1) * 180) / Math.PI;
    
    // Check for total internal reflection
    const sinThetaR = (n1 * Math.sin(thetaI)) / n2;
    
    if (sinThetaR <= 1) {
      refractedAngle = (Math.asin(sinThetaR) * 180) / Math.PI;
      isTotalReflection = false;
    } else {
      isTotalReflection = true;
      refractedAngle = 90; // No real refracted ray
    }
  }

  function drawMedia() {
    const interfaceY = height / 2;
    
    // Dense medium (bottom half)
    ctx.fillStyle = DENSE_COLOR;
    ctx.fillRect(0, interfaceY, width, height - interfaceY);
    
    // Rare medium (top half)
    ctx.fillStyle = RARE_COLOR;
    ctx.fillRect(0, 0, width, interfaceY);
    
    // Interface line
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, interfaceY);
    ctx.lineTo(width, interfaceY);
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Air (n₂ = ${n2.toFixed(2)})`, 20, 40);
    ctx.fillText(`Glass (n₁ = ${n1.toFixed(2)})`, 20, interfaceY + 40);
  }

  function drawNormalAndCritical() {
    const centerX = width / 2;
    const interfaceY = height / 2;
    const rayLength = 150;
    
    // Normal line
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, 50);
    ctx.lineTo(centerX, height - 50);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Critical angle ray (dashed)
    const thetaC = (criticalAngle * Math.PI) / 180;
    const criticalEndX = centerX + rayLength * Math.sin(thetaC);
    const criticalEndY = interfaceY - rayLength * Math.cos(thetaC);
    
    ctx.strokeStyle = CRITICAL_COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, interfaceY);
    ctx.lineTo(criticalEndX, criticalEndY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Critical angle label
    ctx.fillStyle = CRITICAL_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`θc = ${criticalAngle.toFixed(1)}°`, criticalEndX + 30, criticalEndY - 10);
  }

  function drawRays() {
    const centerX = width / 2;
    const interfaceY = height / 2;
    const rayLength = 200;
    
    // Incident ray
    const thetaI = (incidentAngle * Math.PI) / 180;
    const incidentStartX = centerX - rayLength * Math.sin(thetaI);
    const incidentStartY = interfaceY + rayLength * Math.cos(thetaI);
    
    ctx.strokeStyle = INCIDENT_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(incidentStartX, incidentStartY);
    ctx.lineTo(centerX, interfaceY);
    ctx.stroke();
    
    // Incident arrow
    drawArrow(centerX - 30 * Math.sin(thetaI), interfaceY + 30 * Math.cos(thetaI),
              centerX, interfaceY, INCIDENT_COLOR);
    
    // Always draw reflected ray (law of reflection: angle of incidence = angle of reflection)
    const reflectedEndX = centerX + rayLength * Math.sin(thetaI);
    const reflectedEndY = interfaceY + rayLength * Math.cos(thetaI);
    
    ctx.strokeStyle = REFLECTED_COLOR;
    ctx.lineWidth = isTotalReflection ? 4 : 2;
    ctx.globalAlpha = isTotalReflection ? 1.0 : 0.6;
    ctx.beginPath();
    ctx.moveTo(centerX, interfaceY);
    ctx.lineTo(reflectedEndX, reflectedEndY);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    
    // Reflected arrow
    drawArrow(centerX, interfaceY,
              centerX + 30 * Math.sin(thetaI), interfaceY + 30 * Math.cos(thetaI),
              REFLECTED_COLOR);
    
    if (!isTotalReflection) {
      // Refracted ray
      const thetaR = (refractedAngle * Math.PI) / 180;
      const refractedEndX = centerX + rayLength * Math.sin(thetaR);
      const refractedEndY = interfaceY - rayLength * Math.cos(thetaR);
      
      ctx.strokeStyle = REFRACTED_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX, interfaceY);
      ctx.lineTo(refractedEndX, refractedEndY);
      ctx.stroke();
      
      // Refracted arrow
      drawArrow(centerX, interfaceY,
                centerX + 30 * Math.sin(thetaR), interfaceY - 30 * Math.cos(thetaR),
                REFRACTED_COLOR);
    } else {
      // Evanescent wave (decaying exponentially in rarer medium)
      drawEvanescentWave();
    }
  }

  function drawEvanescentWave() {
    const centerX = width / 2;
    const interfaceY = height / 2;
    const waveLength = 30;
    const decayLength = 50;
    
    ctx.strokeStyle = EVANESCENT_COLOR;
    ctx.lineWidth = 2;
    
    // Draw exponentially decaying wave in the rarer medium
    for (let x = centerX; x < centerX + 200; x += 2) {
      const distanceFromInterface = x - centerX;
      const amplitude = 20 * Math.exp(-distanceFromInterface / decayLength);
      const phase = (2 * Math.PI / waveLength) * distanceFromInterface + time * 10;
      
      const y1 = interfaceY - amplitude * Math.sin(phase);
      const y2 = interfaceY - amplitude * Math.sin(phase + 0.2);
      
      ctx.globalAlpha = Math.exp(-distanceFromInterface / (decayLength * 2));
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x + 2, y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
    
    // Label
    ctx.fillStyle = EVANESCENT_COLOR;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Evanescent Wave", centerX + 100, interfaceY - 60);
    ctx.fillText("(decays exponentially)", centerX + 100, interfaceY - 45);
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string) {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI/6), y2 - headLength * Math.sin(angle - Math.PI/6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI/6), y2 - headLength * Math.sin(angle + Math.PI/6));
    ctx.stroke();
  }

  function drawAngles() {
    const centerX = width / 2;
    const interfaceY = height / 2;
    const arcRadius = 70;
    
    // Incident angle
    ctx.strokeStyle = INCIDENT_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const startAngle = Math.PI/2;
    const endAngle = Math.PI/2 + (incidentAngle * Math.PI)/180;
    ctx.arc(centerX, interfaceY, arcRadius, startAngle, endAngle, false);
    ctx.stroke();
    
    ctx.fillStyle = INCIDENT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`θ₁ = ${incidentAngle.toFixed(1)}°`, centerX - 80, interfaceY + 20);
    
    // Critical angle arc
    ctx.strokeStyle = CRITICAL_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const criticalEndAngle = Math.PI/2 + (criticalAngle * Math.PI)/180;
    ctx.arc(centerX, interfaceY, arcRadius + 20, startAngle, criticalEndAngle, false);
    ctx.stroke();
  }

  function drawInfoPanel() {
    const panelX = width - 300;
    const panelY = 20;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(panelX, panelY, 280, 220);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(panelX, panelY, 280, 220);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Total Internal Reflection", panelX + 10, panelY + 20);
    
    ctx.font = "12px monospace";
    ctx.fillText("Light going from dense → rare", panelX + 10, panelY + 45);
    
    ctx.fillText(`n₁ = ${n1.toFixed(2)} (Glass)`, panelX + 10, panelY + 70);
    ctx.fillText(`n₂ = ${n2.toFixed(2)} (Air)`, panelX + 10, panelY + 85);
    
    ctx.fillStyle = CRITICAL_COLOR;
    ctx.fillText(`Critical angle: θc = ${criticalAngle.toFixed(1)}°`, panelX + 10, panelY + 110);
    
    ctx.fillStyle = INCIDENT_COLOR;
    ctx.fillText(`Incident: θ₁ = ${incidentAngle.toFixed(1)}°`, panelX + 10, panelY + 130);
    
    if (isTotalReflection) {
      ctx.fillStyle = REFLECTED_COLOR;
      ctx.fillText("Result: TOTAL REFLECTION", panelX + 10, panelY + 155);
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText("100% of light is reflected", panelX + 10, panelY + 170);
      ctx.fillStyle = EVANESCENT_COLOR;
      ctx.fillText("Evanescent wave in air", panelX + 10, panelY + 185);
    } else {
      ctx.fillStyle = REFRACTED_COLOR;
      ctx.fillText(`Refracted: θ₂ = ${refractedAngle.toFixed(1)}°`, panelX + 10, panelY + 155);
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText("Partial reflection only", panelX + 10, panelY + 170);
    }
    
    ctx.fillText("θc = arcsin(n₂/n₁)", panelX + 10, panelY + 205);
  }

  function drawApplications() {
    const appX = 20;
    const appY = height - 120;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.fillRect(appX, appY, 250, 100);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(appX, appY, 250, 100);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Applications:", appX + 10, appY + 20);
    ctx.font = "11px monospace";
    ctx.fillText("• Optical fibers", appX + 10, appY + 40);
    ctx.fillText("• Prisms & periscopes", appX + 10, appY + 55);
    ctx.fillText("• Diamond brilliance", appX + 10, appY + 70);
    ctx.fillText("• Mirages & refraction", appX + 10, appY + 85);
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
      n1 = params.n1 ?? n1;
      n2 = params.n2 ?? n2;
      incidentAngle = params.incidentAngle ?? incidentAngle;

      time += dt;
      calculateAngles();
    },

    render() {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      drawMedia();
      drawNormalAndCritical();
      drawRays();
      drawAngles();
      drawInfoPanel();
      drawApplications();
    },

    reset() {
      time = 0;
    },

    destroy() {
      // Nothing to clean up
    },

    getStateDescription(): string {
      if (isTotalReflection) {
        return `Total internal reflection occurring: incident angle ${incidentAngle}° > critical angle ${criticalAngle.toFixed(1)}°. All light is reflected back into the denser medium.`;
      } else {
        return `Partial reflection: incident angle ${incidentAngle}° < critical angle ${criticalAngle.toFixed(1)}°. Light refracts at ${refractedAngle.toFixed(1)}°.`;
      }
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default TotalInternalReflection;