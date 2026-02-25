import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const GravitationalLensingFactory: SimulationFactory = () => {
  const config = getSimConfig("gravitational-lensing")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let lensMass = 1.0;        // In units where 1.0 gives visible lensing
  let sourceDistance = 2.0;  // Distance units
  let lensDistance = 1.0;    // Distance from observer
  let alignment = 0.5;       // 0 = perfect alignment, 1 = no lensing

  // Lensing geometry
  let lensX = W * 0.4;
  let lensY = H * 0.5;
  let sourceX = W * 0.8;
  let sourceY = H * 0.5;
  let observerX = W * 0.1;
  let observerY = H * 0.5;

  // Light rays and images
  let lightRays: Array<{
    x1: number; y1: number;
    x2: number; y2: number;
    x3: number; y3: number;
    deflection: number;
    intensity: number;
  }> = [];

  let einsteinRing = { visible: false, radius: 0 };
  let lensedImages: Array<{
    x: number; y: number;
    brightness: number;
    magnification: number;
  }> = [];

  // Animation state
  let animatedAlignment = alignment;

  function calculateEinsteinRadius(): number {
    // Einstein radius in angular units (simplified)
    const G = 1; // Gravitational constant (scaled)
    const c = 1; // Speed of light (scaled)
    const M = lensMass;
    const dL = lensDistance;
    const dS = sourceDistance;
    const dLS = sourceDistance - lensDistance;
    
    if (dLS <= 0) return 0;
    
    // Angular Einstein radius
    const thetaE = Math.sqrt(4 * G * M * dLS / (c * c * dL * dS));
    
    // Convert to pixel radius for display
    return thetaE * 100; // Scale factor for visibility
  }

  function calculateLensing() {
    lightRays = [];
    lensedImages = [];
    
    const einsteinRadius = calculateEinsteinRadius();
    einsteinRing.radius = einsteinRadius;
    einsteinRing.visible = einsteinRadius > 5 && alignment < 0.1;

    // Source position relative to lens
    const sourceOffsetY = (sourceY - lensY) + alignment * 100;
    const beta = sourceOffsetY / 100; // Angular source position
    
    // Lens equation: θ = β + α(θ), where α is deflection angle
    // For point mass: α = 4GM/(c²θ) in angular units
    
    // Solve lens equation for image positions
    const numRays = 24;
    
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * 2 * Math.PI;
      const rayRadius = 150; // Ray starting radius
      
      const rayStartX = lensX + rayRadius * Math.cos(angle);
      const rayStartY = lensY + rayRadius * Math.sin(angle);
      
      // Calculate deflection based on impact parameter
      const impactParam = Math.sqrt((rayStartX - lensX) ** 2 + (rayStartY - lensY) ** 2);
      
      // Deflection angle (simplified point mass formula)
      const deflectionAngle = impactParam > 1 ? (4 * lensMass * einsteinRadius) / impactParam : 0;
      
      // Ray path: source → lens (deflected) → observer
      const dirToLensX = (lensX - rayStartX) / impactParam;
      const dirToLensY = (lensY - rayStartY) / impactParam;
      
      // Apply deflection
      const deflectedDirX = dirToLensX + deflectionAngle * Math.cos(angle) * 0.01;
      const deflectedDirY = dirToLensY + deflectionAngle * Math.sin(angle) * 0.01;
      
      // Ray to observer
      const rayEndX = lensX - deflectedDirX * (lensX - observerX);
      const rayEndY = lensY - deflectedDirY * (lensY - observerY);
      
      // Calculate intensity based on lensing magnification
      const theta = Math.sqrt((rayEndX - observerX) ** 2 + (rayEndY - observerY) ** 2) / 100;
      const u = Math.abs(beta) / (einsteinRadius / 100);
      
      // Magnification for point mass lens
      let magnification = 1;
      if (einsteinRadius > 0 && u < 2) {
        magnification = (u * u + 2) / (u * Math.sqrt(u * u + 4));
      }
      
      const intensity = Math.min(1, magnification * 0.5);
      
      lightRays.push({
        x1: sourceX + (sourceOffsetY / 5), // Source position
        y1: sourceY,
        x2: rayStartX, // Deflection point
        y2: rayStartY,
        x3: rayEndX,   // Observer
        y3: rayEndY,
        deflection: deflectionAngle,
        intensity: intensity
      });
    }

    // Calculate lensed image positions and magnifications
    if (einsteinRadius > 0) {
      const u = Math.abs(beta) / (einsteinRadius / 100);
      
      if (u < 0.1) {
        // Nearly perfect alignment - Einstein ring
        lensedImages.push({
          x: lensX,
          y: lensY,
          brightness: 1.0,
          magnification: 1 / u + u // Ring magnification
        });
      } else {
        // Two images for u > 0
        const theta1 = 0.5 * (Math.sqrt(u * u + 4) + u);
        const theta2 = 0.5 * (Math.sqrt(u * u + 4) - u);
        
        const mag1 = 0.5 * (1 + (u * u + 2) / (u * Math.sqrt(u * u + 4)));
        const mag2 = 0.5 * (1 - (u * u + 2) / (u * Math.sqrt(u * u + 4)));
        
        // Primary image (brighter)
        lensedImages.push({
          x: lensX + theta1 * einsteinRadius * Math.sign(beta),
          y: lensY,
          brightness: Math.abs(mag1),
          magnification: Math.abs(mag1)
        });
        
        // Secondary image (fainter)
        if (Math.abs(mag2) > 0.1) {
          lensedImages.push({
            x: lensX - theta2 * einsteinRadius * Math.sign(beta),
            y: lensY,
            brightness: Math.abs(mag2),
            magnification: Math.abs(mag2)
          });
        }
      }
    }
  }

  function updateAlignment(dt: number) {
    // Animate alignment for demonstration
    animatedAlignment = alignment + Math.sin(time * 0.5) * 0.3;
    animatedAlignment = Math.max(0, Math.min(1, animatedAlignment));
    
    // Update source position
    sourceY = lensY + animatedAlignment * 100;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      calculateLensing();
    },

    update(dt: number, params: Record<string, number>) {
      lensMass = params.lensMass ?? lensMass;
      sourceDistance = params.sourceDistance ?? sourceDistance;
      lensDistance = params.lensDistance ?? lensDistance;
      alignment = params.alignment ?? alignment;

      time += dt;
      updateAlignment(dt);
      calculateLensing();
    },

    render() {
      // Background (space)
      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, "#0a0a1f");
      gradient.addColorStop(0.5, "#1a1a3a");
      gradient.addColorStop(1, "#0a0a1f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Stars background
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      for (let i = 0; i < 100; i++) {
        const x = (i * 37) % W;
        const y = (i * 41) % H;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Title
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Gravitational Lensing", W / 2, 30);

      // Subtitle
      ctx.font = "12px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Einstein's General Relativity: Mass Bends Spacetime and Light", W / 2, 50);

      // Draw spacetime grid (curved by gravity)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
      ctx.lineWidth = 1;
      
      // Grid lines showing spacetime curvature
      const gridSpacing = 40;
      for (let x = 0; x < W; x += gridSpacing) {
        ctx.beginPath();
        for (let y = 0; y < H; y += 2) {
          const distToLens = Math.sqrt((x - lensX) ** 2 + (y - lensY) ** 2);
          const curvature = lensMass * 20 / Math.max(distToLens, 20);
          const curvedX = x + curvature * (lensX - x) / distToLens;
          
          if (y === 0) ctx.moveTo(curvedX, y);
          else ctx.lineTo(curvedX, y);
        }
        ctx.stroke();
      }
      
      for (let y = 0; y < H; y += gridSpacing) {
        ctx.beginPath();
        for (let x = 0; x < W; x += 2) {
          const distToLens = Math.sqrt((x - lensX) ** 2 + (y - lensY) ** 2);
          const curvature = lensMass * 15 / Math.max(distToLens, 20);
          const curvedY = y + curvature * (lensY - y) / distToLens;
          
          if (x === 0) ctx.moveTo(x, curvedY);
          else ctx.lineTo(x, curvedY);
        }
        ctx.stroke();
      }

      // Einstein ring (perfect alignment case)
      if (einsteinRing.visible) {
        ctx.strokeStyle = "rgba(255, 215, 0, 0.8)";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(lensX, lensY, einsteinRing.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText("Einstein Ring", lensX, lensY - einsteinRing.radius - 15);
      }

      // Draw light rays
      for (const ray of lightRays) {
        const alpha = Math.min(1, ray.intensity * 2);
        ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.lineWidth = 1 + ray.intensity * 2;
        
        // Source to lens
        ctx.beginPath();
        ctx.moveTo(ray.x1, ray.y1);
        ctx.lineTo(ray.x2, ray.y2);
        ctx.stroke();
        
        // Lens to observer (deflected)
        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(ray.x2, ray.y2);
        ctx.lineTo(ray.x3, ray.y3);
        ctx.stroke();
      }

      // Observer
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(observerX, observerY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#065f46";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.font = "12px Arial";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "center";
      ctx.fillText("Observer", observerX, observerY - 20);
      ctx.fillText("(Earth)", observerX, observerY - 8);

      // Lens (massive object)
      const lensRadius = 15 + lensMass * 10;
      const lensGradient = ctx.createRadialGradient(lensX, lensY, 0, lensX, lensY, lensRadius);
      lensGradient.addColorStop(0, "#8b5cf6");
      lensGradient.addColorStop(0.7, "#5b21b6");
      lensGradient.addColorStop(1, "#312e81");
      ctx.fillStyle = lensGradient;
      ctx.beginPath();
      ctx.arc(lensX, lensY, lensRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Gravitational field visualization
      ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
      ctx.lineWidth = 1;
      for (let r = lensRadius + 10; r < 100; r += 20) {
        ctx.beginPath();
        ctx.arc(lensX, lensY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.font = "12px Arial";
      ctx.fillStyle = "#8b5cf6";
      ctx.textAlign = "center";
      ctx.fillText("Massive Lens", lensX, lensY - lensRadius - 15);
      ctx.fillText(`(${lensMass.toFixed(1)}M☉)`, lensX, lensY - lensRadius - 3);

      // Source object
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(sourceX, sourceY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.font = "12px Arial";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("Background", sourceX, sourceY - 15);
      ctx.fillText("Source", sourceX, sourceY - 3);

      // Lensed images
      for (let i = 0; i < lensedImages.length; i++) {
        const image = lensedImages[i];
        const imageRadius = 4 + image.brightness * 8;
        const imageAlpha = Math.min(1, image.brightness);
        
        // Image glow
        const imageGradient = ctx.createRadialGradient(image.x, image.y, 0, 
                                                       image.x, image.y, imageRadius * 2);
        imageGradient.addColorStop(0, `rgba(255, 215, 0, ${imageAlpha})`);
        imageGradient.addColorStop(1, "rgba(255, 215, 0, 0)");
        ctx.fillStyle = imageGradient;
        ctx.beginPath();
        ctx.arc(image.x, image.y, imageRadius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Image body
        ctx.fillStyle = `rgba(255, 215, 0, ${imageAlpha})`;
        ctx.beginPath();
        ctx.arc(image.x, image.y, imageRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Image label
        ctx.font = "10px Arial";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText(`Image ${i + 1}`, image.x, image.y + imageRadius + 12);
        ctx.fillText(`×${image.magnification.toFixed(1)}`, image.x, image.y + imageRadius + 24);
      }

      // Distance indicators
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      
      // Observer to lens distance
      ctx.beginPath();
      ctx.moveTo(observerX, observerY - 40);
      ctx.lineTo(lensX, lensY - 40);
      ctx.stroke();
      
      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(`dL = ${lensDistance.toFixed(1)}`, (observerX + lensX) / 2, lensY - 45);
      
      // Lens to source distance  
      ctx.beginPath();
      ctx.moveTo(lensX, lensY - 30);
      ctx.lineTo(sourceX, sourceY - 30);
      ctx.stroke();
      
      ctx.fillText(`dS = ${sourceDistance.toFixed(1)}`, (lensX + sourceX) / 2, lensY - 35);
      ctx.setLineDash([]);

      // Parameters panel
      const paramX = 20;
      const paramY = H - 180;
      const paramW = 250;
      const paramH = 160;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(paramX, paramY, paramW, paramH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(paramX, paramY, paramW, paramH);

      let infoY = paramY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Lensing Parameters", paramX + 10, infoY);
      infoY += 25;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Lens Mass: ${lensMass.toFixed(1)} M☉`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Source Distance: ${sourceDistance.toFixed(1)}`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Lens Distance: ${lensDistance.toFixed(1)}`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Alignment: ${(animatedAlignment * 100).toFixed(0)}%`, paramX + 10, infoY);
      infoY += 20;

      const einsteinRadius = calculateEinsteinRadius();
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Einstein Radius:`, paramX + 10, infoY);
      infoY += 14;
      ctx.fillText(`${(einsteinRadius / 10).toFixed(2)}" (angular)`, paramX + 20, infoY);
      infoY += 18;

      ctx.fillStyle = lensedImages.length > 0 ? "#10b981" : "#ef4444";
      ctx.fillText(`Images: ${lensedImages.length}`, paramX + 10, infoY);

      // Physics info panel
      const physicsX = W - 280;
      const physicsY = H - 180;
      const physicsW = 260;
      const physicsH = 160;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(physicsX, physicsY, physicsW, physicsH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(physicsX, physicsY, physicsW, physicsH);

      let physY = physicsY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("General Relativity", physicsX + 10, physY);
      physY += 25;

      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      const concepts = [
        "• Mass curves spacetime geometry",
        "• Light follows geodesics (curved paths)",
        "• Deflection angle ∝ 4GM/c²b",
        "• Einstein ring: perfect alignment",
        "• Multiple images possible",
        "• Magnification preserves surface brightness"
      ];
      
      concepts.forEach(concept => {
        ctx.fillText(concept, physicsX + 10, physY);
        physY += 14;
      });

      physY += 10;
      ctx.font = "11px Arial";
      ctx.fillStyle = "#10b981";
      const totalMag = lensedImages.reduce((sum, img) => sum + img.magnification, 0);
      ctx.fillText(`Total Magnification: ${totalMag.toFixed(1)}×`, physicsX + 10, physY);

      // Key concepts
      ctx.font = "10px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("Gravitational lensing confirms Einstein's prediction that massive objects bend spacetime", W / 2, H - 10);
    },

    reset() {
      time = 0;
      calculateLensing();
    },

    destroy() {
      lightRays = [];
      lensedImages = [];
    },

    getStateDescription(): string {
      const einsteinRadius = calculateEinsteinRadius();
      const totalMagnification = lensedImages.reduce((sum, img) => sum + img.magnification, 0);
      
      return (
        `Gravitational lensing simulation with lens mass ${lensMass.toFixed(1)}M☉ at distance ${lensDistance.toFixed(1)}, ` +
        `source at distance ${sourceDistance.toFixed(1)}, alignment ${(animatedAlignment * 100).toFixed(0)}%. ` +
        `Einstein radius: ${(einsteinRadius / 10).toFixed(2)} arcseconds. ` +
        `${lensedImages.length} lensed images detected with total magnification ${totalMagnification.toFixed(1)}×. ` +
        `${einsteinRing.visible ? 'Einstein ring visible due to near-perfect alignment' : 'Multiple image configuration'}. ` +
        `Demonstrates General Relativity: massive objects curve spacetime, bending light paths and creating ` +
        `gravitational lenses that can magnify and distort background sources.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
      // Recalculate positions based on new dimensions
      lensX = W * 0.4;
      lensY = H * 0.5;
      sourceX = W * 0.8;
      sourceY = H * 0.5;
      observerX = W * 0.1;
      observerY = H * 0.5;
    }
  };

  return engine;
};

export default GravitationalLensingFactory;