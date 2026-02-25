import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Fiber Optic Light Path
 * Demonstrates total internal reflection in optical fibers
 * Critical angle: θc = arcsin(n₂/n₁) where n₁ > n₂
 * Shows light bouncing through a curved fiber core via total internal reflection
 */

const FiberOpticLightPathFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("fiber-optic-light-path") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Fiber parameters
  let coreIndex = 1.47; // Refractive index of fiber core (glass)
  let claddingIndex = 1.46; // Refractive index of cladding (slightly lower)
  let inputAngle = 15; // Input light angle in degrees
  let fiberCurvature = 0.8; // How curved the fiber is (0 = straight, 1 = very curved)

  // Light rays
  const rays: Array<{
    x: number;
    y: number;
    angle: number;
    intensity: number;
    path: Array<{ x: number; y: number }>;
    isActive: boolean;
  }> = [];

  const FIBER_CORE_RADIUS = 25;
  const FIBER_CLADDING_RADIUS = 35;

  function getCriticalAngle(): number {
    return Math.asin(claddingIndex / coreIndex) * (180 / Math.PI);
  }

  function getFiberPath(t: number): { x: number; y: number; tangent: number } {
    // Parametric curve for fiber - S-curve
    const baseY = height / 2;
    const amplitude = fiberCurvature * 80;
    
    const x = 50 + t * (width - 100);
    const y = baseY + amplitude * Math.sin(t * Math.PI * 2);
    
    // Tangent angle
    const dx = width - 100;
    const dy = amplitude * Math.cos(t * Math.PI * 2) * Math.PI * 2;
    const tangent = Math.atan2(dy, dx);
    
    return { x, y, tangent };
  }

  function drawFiber() {
    const steps = 200;
    
    // Draw cladding
    ctx.strokeStyle = "rgba(100, 150, 255, 0.2)";
    ctx.lineWidth = FIBER_CLADDING_RADIUS * 2;
    ctx.lineCap = "round";
    
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pos = getFiberPath(t);
      
      if (i === 0) {
        ctx.moveTo(pos.x, pos.y);
      } else {
        ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();
    
    // Draw core
    ctx.strokeStyle = "rgba(150, 200, 255, 0.4)";
    ctx.lineWidth = FIBER_CORE_RADIUS * 2;
    
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pos = getFiberPath(t);
      
      if (i === 0) {
        ctx.moveTo(pos.x, pos.y);
      } else {
        ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();
    
    // Draw fiber boundaries more clearly
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    for (const offset of [-FIBER_CORE_RADIUS, FIBER_CORE_RADIUS]) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pos = getFiberPath(t);
        const normal = pos.tangent + Math.PI / 2;
        
        const x = pos.x + Math.cos(normal) * offset;
        const y = pos.y + Math.sin(normal) * offset;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
  }

  function createRay() {
    const startPos = getFiberPath(0);
    const inputAngleRad = (inputAngle * Math.PI) / 180;
    
    rays.push({
      x: startPos.x,
      y: startPos.y + Math.tan(inputAngleRad) * FIBER_CORE_RADIUS * 0.8,
      angle: inputAngleRad,
      intensity: 1.0,
      path: [],
      isActive: true
    });
  }

  function updateRays(dt: number) {
    const stepSize = 2;
    
    for (let i = rays.length - 1; i >= 0; i--) {
      const ray = rays[i];
      
      if (!ray.isActive) continue;
      
      // Move ray forward
      const newX = ray.x + Math.cos(ray.angle) * stepSize;
      const newY = ray.y + Math.sin(ray.angle) * stepSize;
      
      // Find closest point on fiber centerline
      let minDist = Infinity;
      let closestT = 0;
      
      for (let t = 0; t <= 1; t += 0.01) {
        const pos = getFiberPath(t);
        const dist = Math.sqrt((pos.x - newX) ** 2 + (pos.y - newY) ** 2);
        
        if (dist < minDist) {
          minDist = dist;
          closestT = t;
        }
      }
      
      const centerPos = getFiberPath(closestT);
      const distFromCenter = Math.sqrt((newX - centerPos.x) ** 2 + (newY - centerPos.y) ** 2);
      
      // Check if ray hits core boundary
      if (distFromCenter >= FIBER_CORE_RADIUS - 2) {
        // Calculate normal at boundary
        const normal = Math.atan2(newY - centerPos.y, newX - centerPos.x);
        
        // Calculate angle of incidence
        const incidenceAngle = Math.abs(ray.angle - normal);
        const incidenceAngleDeg = incidenceAngle * (180 / Math.PI);
        
        const criticalAngleDeg = getCriticalAngle();
        
        if (incidenceAngleDeg > (90 - criticalAngleDeg)) {
          // Total internal reflection
          ray.angle = 2 * normal - ray.angle;
          ray.intensity *= 0.98; // Slight loss on reflection
          
          // Keep ray just inside the core
          const directionToCenter = Math.atan2(centerPos.y - newY, centerPos.x - newX);
          ray.x = centerPos.x + Math.cos(directionToCenter) * (FIBER_CORE_RADIUS - 3);
          ray.y = centerPos.y + Math.sin(directionToCenter) * (FIBER_CORE_RADIUS - 3);
        } else {
          // Ray escapes (refraction into cladding)
          ray.isActive = false;
        }
      } else {
        // Ray continues straight
        ray.x = newX;
        ray.y = newY;
      }
      
      // Add to path
      ray.path.push({ x: ray.x, y: ray.y });
      
      // Remove old path points
      if (ray.path.length > 100) {
        ray.path.shift();
      }
      
      // Remove weak or distant rays
      if (ray.intensity < 0.1 || ray.x > width + 50 || ray.path.length > 500) {
        rays.splice(i, 1);
      }
    }
  }

  function drawRays() {
    rays.forEach((ray, index) => {
      if (ray.path.length < 2) return;
      
      const hue = 60 - index * 10; // Color variation
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${ray.intensity})`;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      
      ctx.beginPath();
      ray.path.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
      
      // Draw ray front with glow
      if (ray.isActive) {
        const front = ray.path[ray.path.length - 1];
        
        ctx.beginPath();
        ctx.arc(front.x, front.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${ray.intensity})`;
        ctx.fill();
        
        // Glow effect
        ctx.beginPath();
        ctx.arc(front.x, front.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${ray.intensity * 0.3})`;
        ctx.fill();
      }
    });
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    rays.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    coreIndex = params.coreIndex ?? 1.47;
    claddingIndex = params.claddingIndex ?? 1.46;
    inputAngle = params.inputAngle ?? 15;
    fiberCurvature = params.fiberCurvature ?? 0.8;

    time += dt;

    // Periodically add new rays
    if (Math.random() < 0.1 && rays.length < 8) {
      createRay();
    }

    updateRays(dt);
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    drawFiber();
    drawRays();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 280, 160);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Fiber Optic Light Path", 20, 30);
    
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Total Internal Reflection", 20, 50);
    
    const criticalAngle = getCriticalAngle();
    ctx.fillText(`Core Index (n₁): ${coreIndex.toFixed(3)}`, 20, 75);
    ctx.fillText(`Cladding Index (n₂): ${claddingIndex.toFixed(3)}`, 20, 95);
    ctx.fillText(`Critical Angle: ${criticalAngle.toFixed(1)}°`, 20, 115);
    ctx.fillText(`Input Angle: ${inputAngle.toFixed(1)}°`, 20, 135);
    ctx.fillText(`Active Rays: ${rays.filter(r => r.isActive).length}`, 20, 155);

    // Conditions for total internal reflection
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 300, 10, 290, 120);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Total Internal Reflection occurs when:", width - 290, 30);
    ctx.fillText("1. Light travels from denser to rarer medium", width - 290, 50);
    ctx.fillText("2. Incident angle > Critical angle", width - 290, 70);
    ctx.fillText("3. θc = arcsin(n₂/n₁) where n₁ > n₂", width - 290, 90);
    
    if (coreIndex > claddingIndex) {
      ctx.fillStyle = "#4ade80";
      ctx.fillText("✓ Condition satisfied for fiber optics", width - 290, 110);
    } else {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("✗ Need n₁ > n₂ for total internal reflection", width - 290, 110);
    }

    // Numerical aperture info
    const numericalAperture = Math.sqrt(coreIndex * coreIndex - claddingIndex * claddingIndex);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Numerical Aperture (NA) = √(n₁² - n₂²) = ${numericalAperture.toFixed(3)}`, width / 2, height - 20);
    ctx.fillText("Higher NA allows more light coupling but increases dispersion", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    rays.length = 0;
  }

  function destroy(): void {
    rays.length = 0;
  }

  function getStateDescription(): string {
    const criticalAngle = getCriticalAngle();
    const activeRays = rays.filter(r => r.isActive).length;
    const na = Math.sqrt(coreIndex * coreIndex - claddingIndex * claddingIndex);
    
    return (
      `Fiber Optic: Core index n₁=${coreIndex}, cladding n₂=${claddingIndex}. ` +
      `Critical angle θc=${criticalAngle.toFixed(1)}°, input angle=${inputAngle}°. ` +
      `${activeRays} active light rays propagating via total internal reflection. ` +
      `Numerical aperture NA=${na.toFixed(3)} determines light-gathering ability. ` +
      `Curved fiber demonstrates light guidance through core-cladding interface.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default FiberOpticLightPathFactory;