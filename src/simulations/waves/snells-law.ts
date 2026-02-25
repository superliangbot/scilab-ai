import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const SnellsLaw: SimulationFactory = () => {
  const config = getSimConfig("snells-law")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let n1 = 1.0;    // Air
  let n2 = 1.5;    // Glass
  let incidentAngle = 30; // degrees
  let wavelength = 550; // nm (visible light)
  
  // Calculated values
  let refractedAngle = 0;
  let criticalAngle = 0;

  // Colors and styles
  const BG_COLOR = "#0a0a0f";
  const AIR_COLOR = "rgba(135, 206, 235, 0.3)"; // Light blue
  const GLASS_COLOR = "rgba(100, 149, 237, 0.5)"; // Darker blue
  const INCIDENT_COLOR = "#ef4444";
  const REFRACTED_COLOR = "#10b981";
  const NORMAL_COLOR = "#64748b";
  const TEXT_COLOR = "#e2e8f0";

  function calculateAngles() {
    const thetaI = (incidentAngle * Math.PI) / 180;
    
    // Snell's law: n1 * sin(θ1) = n2 * sin(θ2)
    const sinThetaR = (n1 * Math.sin(thetaI)) / n2;
    
    if (sinThetaR <= 1) {
      refractedAngle = (Math.asin(sinThetaR) * 180) / Math.PI;
    } else {
      refractedAngle = 90; // Total internal reflection
    }
    
    // Critical angle
    if (n1 > n2) {
      criticalAngle = (Math.asin(n2 / n1) * 180) / Math.PI;
    } else {
      criticalAngle = 90;
    }
  }

  function drawMedia() {
    const interfaceY = height / 2;
    
    // Air (top half)
    ctx.fillStyle = AIR_COLOR;
    ctx.fillRect(0, 0, width, interfaceY);
    
    // Glass (bottom half)  
    ctx.fillStyle = GLASS_COLOR;
    ctx.fillRect(0, interfaceY, width, height - interfaceY);
    
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
    ctx.fillText(`Air (n₁ = ${n1.toFixed(2)})`, 20, 40);
    ctx.fillText(`Glass (n₂ = ${n2.toFixed(2)})`, 20, interfaceY + 40);
  }

  function drawNormalLine() {
    const centerX = width / 2;
    const interfaceY = height / 2;
    
    ctx.strokeStyle = NORMAL_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, 50);
    ctx.lineTo(centerX, height - 50);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Normal label
    ctx.fillStyle = NORMAL_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Normal", centerX + 20, 70);
  }

  function drawRays() {
    const centerX = width / 2;
    const interfaceY = height / 2;
    const rayLength = 200;
    
    // Incident ray
    const thetaI = (incidentAngle * Math.PI) / 180;
    const incidentStartX = centerX - rayLength * Math.sin(thetaI);
    const incidentStartY = interfaceY - rayLength * Math.cos(thetaI);
    
    ctx.strokeStyle = INCIDENT_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(incidentStartX, incidentStartY);
    ctx.lineTo(centerX, interfaceY);
    ctx.stroke();
    
    // Arrow for incident ray
    drawArrow(centerX - 20 * Math.sin(thetaI), interfaceY - 20 * Math.cos(thetaI), 
              centerX, interfaceY, INCIDENT_COLOR);
    
    // Refracted ray (if not total internal reflection)
    const sinThetaR = (n1 * Math.sin(thetaI)) / n2;
    if (sinThetaR <= 1) {
      const thetaR = Math.asin(sinThetaR);
      const refractedEndX = centerX + rayLength * Math.sin(thetaR);
      const refractedEndY = interfaceY + rayLength * Math.cos(thetaR);
      
      ctx.strokeStyle = REFRACTED_COLOR;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX, interfaceY);
      ctx.lineTo(refractedEndX, refractedEndY);
      ctx.stroke();
      
      // Arrow for refracted ray
      drawArrow(centerX, interfaceY,
                centerX + 20 * Math.sin(thetaR), interfaceY + 20 * Math.cos(thetaR), 
                REFRACTED_COLOR);
    } else {
      // Total internal reflection - draw reflected ray
      const reflectedEndX = centerX + rayLength * Math.sin(thetaI);
      const reflectedEndY = interfaceY - rayLength * Math.cos(thetaI);
      
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX, interfaceY);
      ctx.lineTo(reflectedEndX, reflectedEndY);
      ctx.stroke();
      
      drawArrow(centerX, interfaceY,
                centerX + 20 * Math.sin(thetaI), interfaceY - 20 * Math.cos(thetaI),
                "#fbbf24");
    }
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
    const arcRadius = 80;
    
    // Incident angle arc
    ctx.strokeStyle = INCIDENT_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, interfaceY, arcRadius, -Math.PI/2, -Math.PI/2 + (incidentAngle * Math.PI)/180, false);
    ctx.stroke();
    
    // Incident angle label
    ctx.fillStyle = INCIDENT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    const labelAngle = (-Math.PI/2 + (incidentAngle * Math.PI)/180/2);
    const labelX = centerX + (arcRadius + 20) * Math.cos(labelAngle);
    const labelY = interfaceY + (arcRadius + 20) * Math.sin(labelAngle);
    ctx.fillText(`θ₁ = ${incidentAngle.toFixed(1)}°`, labelX, labelY);
    
    // Refracted angle arc (if not TIR)
    const sinThetaR = (n1 * Math.sin((incidentAngle * Math.PI) / 180)) / n2;
    if (sinThetaR <= 1) {
      ctx.strokeStyle = REFRACTED_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, interfaceY, arcRadius, Math.PI/2, Math.PI/2 - (refractedAngle * Math.PI)/180, true);
      ctx.stroke();
      
      // Refracted angle label
      ctx.fillStyle = REFRACTED_COLOR;
      const labelAngle2 = (Math.PI/2 - (refractedAngle * Math.PI)/180/2);
      const labelX2 = centerX + (arcRadius + 20) * Math.cos(labelAngle2);
      const labelY2 = interfaceY + (arcRadius + 20) * Math.sin(labelAngle2);
      ctx.fillText(`θ₂ = ${refractedAngle.toFixed(1)}°`, labelX2, labelY2);
    }
  }

  function drawInfoPanel() {
    const panelX = width - 300;
    const panelY = 20;
    const sinThetaR = (n1 * Math.sin((incidentAngle * Math.PI) / 180)) / n2;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(panelX, panelY, 280, 200);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(panelX, panelY, 280, 200);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Snell's Law", panelX + 10, panelY + 20);
    
    ctx.font = "12px monospace";
    ctx.fillText("n₁ sin θ₁ = n₂ sin θ₂", panelX + 10, panelY + 45);
    
    ctx.fillText(`n₁ = ${n1.toFixed(2)} (Air)`, panelX + 10, panelY + 70);
    ctx.fillText(`n₂ = ${n2.toFixed(2)} (Glass)`, panelX + 10, panelY + 85);
    
    ctx.fillStyle = INCIDENT_COLOR;
    ctx.fillText(`θ₁ = ${incidentAngle.toFixed(1)}°`, panelX + 10, panelY + 110);
    
    if (sinThetaR <= 1) {
      ctx.fillStyle = REFRACTED_COLOR;
      ctx.fillText(`θ₂ = ${refractedAngle.toFixed(1)}°`, panelX + 10, panelY + 125);
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText("Refraction occurs", panelX + 10, panelY + 145);
    } else {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("Total Internal Reflection!", panelX + 10, panelY + 125);
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(`θc = ${criticalAngle.toFixed(1)}°`, panelX + 10, panelY + 145);
    }
    
    ctx.fillText(`λ = ${wavelength} nm`, panelX + 10, panelY + 165);
    
    // Wavelength changes in medium
    const lambda2 = wavelength / n2;
    ctx.fillText(`λ₂ = ${lambda2.toFixed(0)} nm`, panelX + 10, panelY + 180);
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
      wavelength = params.wavelength ?? wavelength;

      calculateAngles();
    },

    render() {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      drawMedia();
      drawNormalLine();
      drawRays();
      drawAngles();
      drawInfoPanel();
    },

    reset() {
      // Nothing to reset
    },

    destroy() {
      // Nothing to clean up
    },

    getStateDescription(): string {
      const sinThetaR = (n1 * Math.sin((incidentAngle * Math.PI) / 180)) / n2;
      if (sinThetaR <= 1) {
        return `Snell's law refraction: Light ray enters from air (n=${n1}) to glass (n=${n2}) at ${incidentAngle}° and refracts to ${refractedAngle.toFixed(1)}°`;
      } else {
        return `Total internal reflection: Incident angle ${incidentAngle}° exceeds critical angle ${criticalAngle.toFixed(1)}°`;
      }
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default SnellsLaw;