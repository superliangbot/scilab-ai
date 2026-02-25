import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const TotalInternalReflection: SimulationFactory = () => {
  const config = getSimConfig("total-internal-reflection")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics parameters
  let incidentAngle = 45; // degrees
  let refractiveIndexCore = 1.5; // fiber core
  let refractiveIndexCladding = 1.46; // fiber cladding
  let time = 0;
  let animationSpeed = 1.0;

  // Calculated values
  let criticalAngle = 0;
  let totalInternalReflection = false;
  let refractedAngle = 0;
  let reflectance = 0;

  // Optical fiber geometry
  const fiberCenterY = height * 0.5;
  const coreRadius = 30;
  const claddingRadius = 45;
  const fiberStartX = 100;
  const fiberEndX = width - 100;

  // Animation
  let rayProgress = 0;
  let rayBounces: { x: number; y: number; angle: number }[] = [];

  // Colors
  const BG = "#0f172a";
  const CORE_COLOR = "#1e40af";
  const CLADDING_COLOR = "#3b82f6";
  const RAY_COLOR = "#10b981";
  const REFLECTED_RAY = "#f59e0b";
  const ESCAPED_RAY = "#ef4444";
  const CRITICAL_RAY = "#a855f7";
  const INTERFACE_COLOR = "#64748b";
  const GRID_COLOR = "rgba(148, 163, 184, 0.2)";
  const TEXT_COLOR = "#e2e8f0";
  const EVANESCENT_COLOR = "#ec4899";

  function computePhysics(dt: number, params: Record<string, number>) {
    incidentAngle = Math.max(0, Math.min(90, params.incidentAngle ?? incidentAngle));
    refractiveIndexCore = params.refractiveIndexCore ?? refractiveIndexCore;
    refractiveIndexCladding = params.refractiveIndexCladding ?? refractiveIndexCladding;
    animationSpeed = params.animationSpeed ?? animationSpeed;

    time += dt * animationSpeed;

    // Calculate critical angle
    if (refractiveIndexCore > refractiveIndexCladding) {
      criticalAngle = Math.asin(refractiveIndexCladding / refractiveIndexCore) * 180 / Math.PI;
      totalInternalReflection = incidentAngle > criticalAngle;
    } else {
      criticalAngle = 90;
      totalInternalReflection = false;
    }

    // Calculate refracted angle and reflectance
    if (!totalInternalReflection) {
      const thetaI = (incidentAngle * Math.PI) / 180;
      const sinThetaR = (refractiveIndexCore / refractiveIndexCladding) * Math.sin(thetaI);
      refractedAngle = Math.asin(sinThetaR) * 180 / Math.PI;
      
      // Fresnel equations for reflectance
      const thetaR = (refractedAngle * Math.PI) / 180;
      const rs = Math.pow((refractiveIndexCore * Math.cos(thetaI) - refractiveIndexCladding * Math.cos(thetaR)) / 
                         (refractiveIndexCore * Math.cos(thetaI) + refractiveIndexCladding * Math.cos(thetaR)), 2);
      const rp = Math.pow((refractiveIndexCore * Math.cos(thetaR) - refractiveIndexCladding * Math.cos(thetaI)) / 
                         (refractiveIndexCore * Math.cos(thetaR) + refractiveIndexCladding * Math.cos(thetaI)), 2);
      reflectance = (rs + rp) / 2;
    } else {
      reflectance = 1.0;
    }

    // Animate ray propagation
    rayProgress += 50 * dt * animationSpeed;
    if (rayProgress > fiberEndX - fiberStartX + 200) {
      rayProgress = 0;
      rayBounces = [];
    }

    // Calculate ray bounces
    calculateRayPath();
  }

  function calculateRayPath() {
    rayBounces = [];
    
    const startX = fiberStartX;
    const startY = fiberCenterY;
    let currentX = startX;
    let currentY = startY;
    let currentAngle = incidentAngle;
    
    const maxBounces = 20;
    const segmentLength = 25;

    for (let bounce = 0; bounce < maxBounces && currentX < fiberEndX; bounce++) {
      // Calculate next intersection with core boundary
      const angleRad = (currentAngle * Math.PI) / 180;
      const dx = segmentLength * Math.cos(angleRad);
      const dy = segmentLength * Math.sin(angleRad);
      
      const nextX = currentX + dx;
      const nextY = currentY + dy;
      
      // Check if ray hits core boundary
      const distFromCenter = Math.abs(nextY - fiberCenterY);
      
      if (distFromCenter >= coreRadius) {
        // Find intersection with core boundary
        const a = dy * dy;
        const b = 2 * dy * (currentY - fiberCenterY);
        const c = Math.pow(currentY - fiberCenterY, 2) - coreRadius * coreRadius;
        
        if (a !== 0) {
          const discriminant = b * b - 4 * a * c;
          if (discriminant >= 0) {
            const t = (-b + (dy > 0 ? -1 : 1) * Math.sqrt(discriminant)) / (2 * a);
            const intersectX = currentX + dx * t;
            const intersectY = currentY + dy * t;
            
            rayBounces.push({ x: intersectX, y: intersectY, angle: currentAngle });
            
            // Reflect the ray if total internal reflection
            if (totalInternalReflection) {
              const normalAngle = Math.atan2(intersectY - fiberCenterY, 0) * 180 / Math.PI;
              currentAngle = 2 * normalAngle - currentAngle;
              currentX = intersectX;
              currentY = intersectY;
            } else {
              // Ray escapes
              break;
            }
          } else {
            break;
          }
        } else {
          break;
        }
      } else {
        currentX = nextX;
        currentY = nextY;
      }
    }
  }

  function drawFiberCable() {
    // Cladding
    ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
    ctx.fillRect(fiberStartX, fiberCenterY - claddingRadius, fiberEndX - fiberStartX, claddingRadius * 2);
    
    ctx.strokeStyle = CLADDING_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(fiberStartX, fiberCenterY - claddingRadius, fiberEndX - fiberStartX, claddingRadius * 2);

    // Core
    ctx.fillStyle = "rgba(30, 64, 175, 0.3)";
    ctx.fillRect(fiberStartX, fiberCenterY - coreRadius, fiberEndX - fiberStartX, coreRadius * 2);
    
    ctx.strokeStyle = CORE_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(fiberStartX, fiberCenterY - coreRadius, fiberEndX - fiberStartX, coreRadius * 2);

    // Core-cladding interfaces
    ctx.strokeStyle = INTERFACE_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(fiberStartX, fiberCenterY - coreRadius);
    ctx.lineTo(fiberEndX, fiberCenterY - coreRadius);
    ctx.moveTo(fiberStartX, fiberCenterY + coreRadius);
    ctx.lineTo(fiberEndX, fiberCenterY + coreRadius);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = CORE_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Core (n = ${refractiveIndexCore.toFixed(3)})`, fiberStartX + 80, fiberCenterY);
    
    ctx.fillStyle = CLADDING_COLOR;
    ctx.fillText(`Cladding (n = ${refractiveIndexCladding.toFixed(3)})`, fiberStartX + 80, fiberCenterY - coreRadius - 10);
    ctx.fillText(`Cladding (n = ${refractiveIndexCladding.toFixed(3)})`, fiberStartX + 80, fiberCenterY + coreRadius + 15);
  }

  function drawRayPath() {
    if (rayBounces.length === 0) return;

    // Draw ray segments
    ctx.strokeStyle = totalInternalReflection ? RAY_COLOR : ESCAPED_RAY;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    // Start at fiber entrance
    ctx.moveTo(fiberStartX, fiberCenterY);

    // Draw path up to current progress
    const visibleBounces = rayBounces.filter(bounce => bounce.x <= fiberStartX + rayProgress);
    
    for (let i = 0; i < visibleBounces.length; i++) {
      ctx.lineTo(visibleBounces[i].x, visibleBounces[i].y);
    }

    // If ray is in progress and hasn't reached next bounce
    if (visibleBounces.length < rayBounces.length) {
      const currentProgress = Math.min(rayProgress, fiberEndX - fiberStartX);
      const lastBounce = visibleBounces[visibleBounces.length - 1] || { x: fiberStartX, y: fiberCenterY };
      const nextBounce = rayBounces[visibleBounces.length];
      
      if (nextBounce && lastBounce.x + 25 <= fiberStartX + currentProgress) {
        // Interpolate to current position
        const segmentProgress = (fiberStartX + currentProgress - lastBounce.x) / (nextBounce.x - lastBounce.x);
        const interpX = lastBounce.x + (nextBounce.x - lastBounce.x) * segmentProgress;
        const interpY = lastBounce.y + (nextBounce.y - lastBounce.y) * segmentProgress;
        ctx.lineTo(interpX, interpY);
      } else {
        // Extend from last position
        const angle = visibleBounces.length > 0 ? visibleBounces[visibleBounces.length - 1].angle : incidentAngle;
        const angleRad = (angle * Math.PI) / 180;
        const endX = Math.min(lastBounce.x + (currentProgress - (lastBounce.x - fiberStartX)), fiberEndX);
        const endY = lastBounce.y + (endX - lastBounce.x) * Math.tan(angleRad);
        ctx.lineTo(endX, endY);
      }
    }

    ctx.stroke();

    // Draw bounce points
    ctx.fillStyle = REFLECTED_RAY;
    for (const bounce of visibleBounces) {
      ctx.beginPath();
      ctx.arc(bounce.x, bounce.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw incident ray outside fiber
    const incidentLength = 50;
    const incidentAngleRad = (incidentAngle * Math.PI) / 180;
    const incidentStartX = fiberStartX - incidentLength;
    const incidentStartY = fiberCenterY - incidentLength * Math.tan(incidentAngleRad);

    ctx.strokeStyle = RAY_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(incidentStartX, incidentStartY);
    ctx.lineTo(fiberStartX, fiberCenterY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow
    drawArrow(fiberStartX, fiberCenterY, incidentStartX, incidentStartY, RAY_COLOR);
  }

  function drawArrow(fromX: number, fromY: number, toX: number, toY: number, color: string) {
    const arrowSize = 6;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(fromX - arrowSize * Math.cos(angle - Math.PI / 6), fromY - arrowSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(fromX - arrowSize * Math.cos(angle + Math.PI / 6), fromY - arrowSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function drawEvanescentWave() {
    if (!totalInternalReflection) return;

    // Evanescent wave penetrates slightly into cladding
    const penetrationDepth = 5; // pixels
    const numWaves = 3;
    
    ctx.strokeStyle = EVANESCENT_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;

    for (let i = 0; i < numWaves; i++) {
      const waveY1 = fiberCenterY - coreRadius - (i + 1) * (penetrationDepth / numWaves);
      const waveY2 = fiberCenterY + coreRadius + (i + 1) * (penetrationDepth / numWaves);
      
      ctx.beginPath();
      for (let x = fiberStartX; x <= fiberEndX; x += 5) {
        const wavePhase = (x - fiberStartX) * 0.1 - time * 2;
        const amplitude = Math.exp(-(i + 1) * 0.8) * 3;
        const y1 = waveY1 + amplitude * Math.sin(wavePhase);
        const y2 = waveY2 + amplitude * Math.sin(wavePhase);
        
        if (x === fiberStartX) {
          ctx.moveTo(x, y1);
        } else {
          ctx.lineTo(x, y1);
        }
      }
      ctx.stroke();
      
      ctx.beginPath();
      for (let x = fiberStartX; x <= fiberEndX; x += 5) {
        const wavePhase = (x - fiberStartX) * 0.1 - time * 2;
        const amplitude = Math.exp(-(i + 1) * 0.8) * 3;
        const y2 = waveY2 + amplitude * Math.sin(wavePhase);
        
        if (x === fiberStartX) {
          ctx.moveTo(x, y2);
        } else {
          ctx.lineTo(x, y2);
        }
      }
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1.0;
  }

  function drawAngleDisplay() {
    const displayX = width * 0.02;
    const displayY = height * 0.02;
    const displayW = width * 0.35;
    const displayH = height * 0.25;

    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(displayX, displayY, displayW, displayH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(displayX, displayY, displayW, displayH);

    const centerX = displayX + displayW / 2;
    const centerY = displayY + displayH / 2;
    const interfaceY = centerY;

    // Draw mini interface
    ctx.strokeStyle = INTERFACE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(displayX + 20, interfaceY);
    ctx.lineTo(displayX + displayW - 20, interfaceY);
    ctx.stroke();

    // Draw normal
    ctx.strokeStyle = GRID_COLOR;
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, displayY + 20);
    ctx.lineTo(centerX, displayY + displayH - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw incident ray
    const rayLength = 40;
    const incidentRad = (incidentAngle * Math.PI) / 180;
    const incidentEndX = centerX - rayLength * Math.sin(incidentRad);
    const incidentEndY = interfaceY - rayLength * Math.cos(incidentRad);

    ctx.strokeStyle = RAY_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(incidentEndX, incidentEndY);
    ctx.lineTo(centerX, interfaceY);
    ctx.stroke();

    // Draw critical angle ray
    const criticalRad = (criticalAngle * Math.PI) / 180;
    const criticalEndX = centerX - rayLength * Math.sin(criticalRad);
    const criticalEndY = interfaceY - rayLength * Math.cos(criticalRad);

    ctx.strokeStyle = CRITICAL_RAY;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(criticalEndX, criticalEndY);
    ctx.lineTo(centerX, interfaceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = RAY_COLOR;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`θ = ${incidentAngle.toFixed(1)}°`, incidentEndX, incidentEndY - 8);

    ctx.fillStyle = CRITICAL_RAY;
    ctx.fillText(`θc = ${criticalAngle.toFixed(1)}°`, criticalEndX, criticalEndY - 8);

    // Status
    ctx.fillStyle = totalInternalReflection ? "#10b981" : "#ef4444";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      totalInternalReflection ? "Total Internal Reflection" : "Partial Transmission",
      displayX + 10,
      displayY + displayH - 10
    );
  }

  function drawInfoPanel() {
    const panelX = width * 0.55;
    const panelY = height * 0.02;
    const panelW = width * 0.42;
    const panelH = height * 0.25;

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
    ctx.fillText("Total Internal Reflection", textX, textY);
    textY += lineHeight + 5;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.fillText(`θc = arcsin(n₂/n₁) = ${criticalAngle.toFixed(2)}°`, textX, textY);
    textY += lineHeight;

    ctx.fillText(`Numerical Aperture: NA = √(n₁² - n₂²)`, textX, textY);
    const NA = Math.sqrt(refractiveIndexCore * refractiveIndexCore - refractiveIndexCladding * refractiveIndexCladding);
    textY += lineHeight;
    ctx.fillText(`NA = ${NA.toFixed(4)}`, textX + 20, textY);
    textY += lineHeight + 3;

    ctx.fillText(`Reflectance: R = ${(reflectance * 100).toFixed(1)}%`, textX, textY);
    textY += lineHeight;
    ctx.fillText(`Transmittance: T = ${((1 - reflectance) * 100).toFixed(1)}%`, textX, textY);
    textY += lineHeight + 5;

    if (totalInternalReflection) {
      ctx.fillStyle = EVANESCENT_COLOR;
      ctx.fillText("Evanescent wave in cladding", textX, textY);
      textY += lineHeight;
      ctx.fillText("(exponentially decaying)", textX, textY);
    } else {
      ctx.fillStyle = ESCAPED_RAY;
      ctx.fillText("Light escapes into cladding", textX, textY);
      textY += lineHeight;
      ctx.fillText("(no waveguiding)", textX, textY);
    }
  }

  function drawApplications() {
    const panelX = width * 0.02;
    const panelY = height * 0.3;
    const panelW = width * 0.96;
    const panelH = height * 0.15;

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 15;
    let textY = panelY + 18;

    ctx.fillStyle = "#f59e0b";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Applications of Total Internal Reflection:", textX, textY);
    textY += 20;

    const applications = [
      "• Optical Fibers: Light trapped in core by TIR at core-cladding boundary",
      "• Prisms: 45-45-90° prisms use TIR for 100% reflection (no silvering needed)",
      "• Diamond Brilliance: High refractive index causes TIR, creating sparkle",
      "• Endoscopes: Flexible fiber bundles guide light through curved paths",
      "• Fiber Optic Communications: Data transmission at speed of light with minimal loss"
    ];

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    applications.forEach(app => {
      ctx.fillText(app, textX, textY);
      textY += 14;
    });
  }

  function drawEquations() {
    const eqX = 20;
    const eqY = height - 80;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    const equations = [
      `Critical angle: θc = arcsin(n₂/n₁) = ${criticalAngle.toFixed(2)}° (when n₁ > n₂)`,
      `For TIR to occur: θ > θc and n₁ > n₂`,
      `Acceptance angle in air: θmax = arcsin(NA) = ${(Math.asin(NA) * 180 / Math.PI).toFixed(1)}°`,
      `Penetration depth: dp ≈ λ₀/(2π√(n₁²sin²θ - n₂²)) (evanescent wave)`
    ];

    const NA = Math.sqrt(refractiveIndexCore * refractiveIndexCore - refractiveIndexCladding * refractiveIndexCladding);
    
    equations.forEach((eq, i) => {
      ctx.fillText(eq, eqX, eqY + i * 14);
    });
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      rayProgress = 0;
      rayBounces = [];
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawFiberCable();
      drawEvanescentWave();
      drawRayPath();
      drawAngleDisplay();
      drawInfoPanel();
      drawApplications();
      drawEquations();
    },

    reset() {
      time = 0;
      rayProgress = 0;
      rayBounces = [];
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const NA = Math.sqrt(refractiveIndexCore * refractiveIndexCore - refractiveIndexCladding * refractiveIndexCladding);
      
      return (
        `Total internal reflection in optical fiber: Core index n₁ = ${refractiveIndexCore.toFixed(3)}, cladding index n₂ = ${refractiveIndexCladding.toFixed(3)}. ` +
        `Critical angle θc = ${criticalAngle.toFixed(2)}°, incident angle θ = ${incidentAngle.toFixed(1)}°. ` +
        `${totalInternalReflection ? 
          "Total internal reflection occurs - light is trapped and guided through the fiber. Evanescent wave penetrates slightly into cladding but decays exponentially." : 
          "Light escapes into cladding - no waveguiding occurs."} ` +
        `Numerical aperture NA = ${NA.toFixed(4)} determines light-gathering ability. ` +
        `Essential for fiber optic communications, endoscopes, and optical sensing applications.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default TotalInternalReflection;