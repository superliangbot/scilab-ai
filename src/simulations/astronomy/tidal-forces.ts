import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const TidalForcesFactory: SimulationFactory = () => {
  const config = getSimConfig("tidal-forces")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let primaryMass = 1.0;     // Mass of primary body (e.g., Earth)
  let secondaryMass = 0.1;   // Mass of secondary body (e.g., Moon)
  let separationDistance = 3.0; // Distance between centers
  let objectRadius = 0.3;    // Radius of deformable object

  // Simulation state
  let primaryX = W * 0.3;
  let primaryY = H * 0.5;
  let secondaryX = W * 0.7;
  let secondaryY = H * 0.5;
  
  // Test particles to show tidal effects
  let testParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    restX: number; // Rest position relative to center
    restY: number;
    mass: number;
  }> = [];

  // Ocean tide representation
  let tideBulges: Array<{
    angle: number;
    height: number;
    maxHeight: number;
  }> = [];

  // Roche limit calculation
  let rocheLimit = 0;
  let showRocheLimit = true;

  function calculateRocheLimit(): number {
    // Roche limit for fluid body: d = 2.44 * R_primary * (ρ_primary/ρ_secondary)^(1/3)
    // Simplified version assuming similar densities
    const fluidRocheLimit = 2.44 * objectRadius;
    return fluidRocheLimit;
  }

  function calculateTidalForce(x: number, y: number, centerX: number, centerY: number, mass: number): { fx: number; fy: number } {
    const dx = x - centerX;
    const dy = y - centerY;
    const r = Math.sqrt(dx * dx + dy * dy);
    
    if (r < 1) return { fx: 0, fy: 0 }; // Avoid singularity
    
    // Gravitational force
    const F = mass / (r * r);
    const fx = -F * dx / r;
    const fy = -F * dy / r;
    
    return { fx, fy };
  }

  function calculateTidalAcceleration(particleX: number, particleY: number): { ax: number; ay: number } {
    // Tidal force = differential gravitational force
    // F_tidal = F(particle) - F(center of mass)
    
    // Force on particle from primary
    const force1 = calculateTidalForce(particleX, particleY, primaryX, primaryY, primaryMass);
    const centerForce1 = calculateTidalForce(primaryX + objectRadius, primaryY, primaryX, primaryY, primaryMass);
    
    // Force on particle from secondary
    const force2 = calculateTidalForce(particleX, particleY, secondaryX, secondaryY, secondaryMass);
    const centerForce2 = calculateTidalForce(primaryX + objectRadius, primaryY, secondaryX, secondaryY, secondaryMass);
    
    // Tidal acceleration = differential force
    const tidalAx = (force1.fx - centerForce1.fx) + (force2.fx - centerForce2.fx);
    const tidalAy = (force1.fy - centerForce1.fy) + (force2.fy - centerForce2.fy);
    
    return { ax: tidalAx * 100, ay: tidalAy * 100 }; // Scale for visibility
  }

  function initializeParticles() {
    testParticles = [];
    
    // Create ring of test particles around primary
    const numParticles = 16;
    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * 2 * Math.PI;
      const radius = objectRadius * 60; // Scale for display
      
      const restX = radius * Math.cos(angle);
      const restY = radius * Math.sin(angle);
      
      testParticles.push({
        x: primaryX + restX,
        y: primaryY + restY,
        vx: 0,
        vy: 0,
        restX: restX,
        restY: restY,
        mass: 0.001
      });
    }
    
    // Initialize tide bulges
    tideBulges = [];
    const numBulges = 36;
    for (let i = 0; i < numBulges; i++) {
      const angle = (i / numBulges) * 2 * Math.PI;
      tideBulges.push({
        angle: angle,
        height: 0,
        maxHeight: 20
      });
    }
  }

  function updateTidalEffects(dt: number) {
    // Update separation based on parameter
    const distance = separationDistance * 100; // Scale to pixels
    secondaryX = primaryX + distance;
    
    // Calculate Roche limit
    rocheLimit = calculateRocheLimit() * 100; // Scale to pixels
    
    // Update test particles with tidal forces
    for (const particle of testParticles) {
      const tidal = calculateTidalAcceleration(particle.x, particle.y);
      
      // Apply tidal acceleration
      particle.vx += tidal.ax * dt;
      particle.vy += tidal.ay * dt;
      
      // Apply some damping to prevent runaway motion
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      
      // Update position
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      
      // Apply restoring force toward rest position (simulates material strength)
      const restX = primaryX + particle.restX;
      const restY = primaryY + particle.restY;
      const restoreStrength = 0.02;
      
      particle.vx += (restX - particle.x) * restoreStrength;
      particle.vy += (restY - particle.y) * restoreStrength;
    }
    
    // Update ocean tides
    for (const bulge of tideBulges) {
      // Calculate tidal potential at this angular position
      const bulgeX = primaryX + objectRadius * 60 * Math.cos(bulge.angle);
      const bulgeY = primaryY + objectRadius * 60 * Math.sin(bulge.angle);
      
      // Distance to secondary body (Moon)
      const dx = bulgeX - secondaryX;
      const dy = bulgeY - secondaryY;
      const distToSecondary = Math.sqrt(dx * dx + dy * dy);
      
      // Tidal potential creates two bulges: one facing the moon, one opposite
      const moonDirection = Math.atan2(secondaryY - primaryY, secondaryX - primaryX);
      const angleDiff = bulge.angle - moonDirection;
      
      // Two tide peaks: one at moon direction, one opposite (180° away)
      const tidePotential = Math.cos(2 * angleDiff); // Creates two bulges
      
      // Calculate tidal height
      const baseHeight = (secondaryMass / (separationDistance * separationDistance * separationDistance)) * 20;
      bulge.height = baseHeight * tidePotential;
      bulge.maxHeight = Math.max(Math.abs(bulge.height), bulge.maxHeight * 0.99);
    }
  }

  function drawTidalField() {
    // Draw tidal force field as arrows
    const gridSize = 60;
    ctx.strokeStyle = "rgba(100, 200, 255, 0.3)";
    ctx.lineWidth = 1;
    
    for (let x = primaryX - 150; x < primaryX + 250; x += gridSize) {
      for (let y = primaryY - 100; y < primaryY + 100; y += gridSize) {
        if (Math.sqrt((x - primaryX) ** 2 + (y - primaryY) ** 2) < 40) continue; // Skip inside primary
        if (Math.sqrt((x - secondaryX) ** 2 + (y - secondaryY) ** 2) < 30) continue; // Skip inside secondary
        
        const tidal = calculateTidalAcceleration(x, y);
        const magnitude = Math.sqrt(tidal.ax ** 2 + tidal.ay ** 2);
        
        if (magnitude > 0.01) {
          const arrowLength = Math.min(20, magnitude * 5);
          const endX = x + (tidal.ax / magnitude) * arrowLength;
          const endY = y + (tidal.ay / magnitude) * arrowLength;
          
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Arrowhead
          const angle = Math.atan2(tidal.ay, tidal.ax);
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - 5 * Math.cos(angle - 0.3), endY - 5 * Math.sin(angle - 0.3));
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - 5 * Math.cos(angle + 0.3), endY - 5 * Math.sin(angle + 0.3));
          ctx.stroke();
        }
      }
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeParticles();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      primaryMass = params.primaryMass ?? primaryMass;
      secondaryMass = params.secondaryMass ?? secondaryMass;
      separationDistance = params.separationDistance ?? separationDistance;
      objectRadius = params.objectRadius ?? objectRadius;

      time += dt;
      updateTidalEffects(dt);
    },

    render() {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0a0a1f");
      gradient.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Tidal Forces", W / 2, 30);

      // Subtitle
      ctx.font = "12px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Differential Gravity Creates Tidal Deformation", W / 2, 50);

      // Draw tidal force field
      drawTidalField();

      // Roche limit
      if (showRocheLimit && rocheLimit > 0) {
        ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(primaryX, primaryY, rocheLimit, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "center";
        ctx.fillText("Roche Limit", primaryX, primaryY - rocheLimit - 15);
        ctx.font = "10px Arial";
        ctx.fillText("(Tidal disruption)", primaryX, primaryY - rocheLimit - 3);
      }

      // Primary body (Earth)
      const primaryRadius = 40 + primaryMass * 10;
      const primaryGradient = ctx.createRadialGradient(primaryX - 10, primaryY - 10, 0, 
                                                       primaryX, primaryY, primaryRadius);
      primaryGradient.addColorStop(0, "#4ade80");
      primaryGradient.addColorStop(0.6, "#22c55e");
      primaryGradient.addColorStop(1, "#15803d");
      ctx.fillStyle = primaryGradient;
      ctx.beginPath();
      ctx.arc(primaryX, primaryY, primaryRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Ocean tide bulges
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < tideBulges.length; i++) {
        const bulge = tideBulges[i];
        const radius = primaryRadius + Math.max(0, bulge.height);
        const x = primaryX + radius * Math.cos(bulge.angle);
        const y = primaryY + radius * Math.sin(bulge.angle);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      
      // Fill tidal bulges
      ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
      ctx.fill();
      
      ctx.font = "12px Arial";
      ctx.fillStyle = "#22c55e";
      ctx.textAlign = "center";
      ctx.fillText("Primary", primaryX, primaryY + primaryRadius + 20);
      ctx.font = "10px Arial";
      ctx.fillText(`${primaryMass.toFixed(1)}M`, primaryX, primaryY + primaryRadius + 32);

      // Secondary body (Moon)
      const secondaryRadius = 20 + secondaryMass * 20;
      const secondaryGradient = ctx.createRadialGradient(secondaryX - 5, secondaryY - 5, 0,
                                                         secondaryX, secondaryY, secondaryRadius);
      secondaryGradient.addColorStop(0, "#d1d5db");
      secondaryGradient.addColorStop(0.6, "#9ca3af");
      secondaryGradient.addColorStop(1, "#6b7280");
      ctx.fillStyle = secondaryGradient;
      ctx.beginPath();
      ctx.arc(secondaryX, secondaryY, secondaryRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.font = "12px Arial";
      ctx.fillStyle = "#9ca3af";
      ctx.textAlign = "center";
      ctx.fillText("Secondary", secondaryX, secondaryY + secondaryRadius + 20);
      ctx.font = "10px Arial";
      ctx.fillText(`${secondaryMass.toFixed(1)}M`, secondaryX, secondaryY + secondaryRadius + 32);

      // Test particles showing tidal deformation
      for (const particle of testParticles) {
        const distortion = Math.sqrt((particle.x - (primaryX + particle.restX)) ** 2 + 
                                   (particle.y - (primaryY + particle.restY)) ** 2);
        const alpha = Math.min(1, 0.5 + distortion / 20);
        
        ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Connection to rest position (shows deformation)
        ctx.strokeStyle = `rgba(251, 191, 36, 0.3)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(primaryX + particle.restX, primaryY + particle.restY);
        ctx.stroke();
      }

      // Distance line between bodies
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(primaryX, primaryY - 60);
      ctx.lineTo(secondaryX, secondaryY - 60);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(`Distance: ${separationDistance.toFixed(1)} units`, 
                   (primaryX + secondaryX) / 2, primaryY - 70);

      // Tidal parameters panel
      const paramX = 20;
      const paramY = H - 200;
      const paramW = 250;
      const paramH = 180;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(paramX, paramY, paramW, paramH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(paramX, paramY, paramW, paramH);

      let infoY = paramY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Tidal Parameters", paramX + 10, infoY);
      infoY += 25;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Primary Mass: ${primaryMass.toFixed(1)}M`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Secondary Mass: ${secondaryMass.toFixed(1)}M`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Separation: ${separationDistance.toFixed(1)} units`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Object Radius: ${objectRadius.toFixed(1)} units`, paramX + 10, infoY);
      infoY += 20;

      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Roche Limit: ${(rocheLimit / 100).toFixed(2)} units`, paramX + 10, infoY);
      infoY += 16;
      
      const isWithinRoche = separationDistance < (rocheLimit / 100);
      ctx.fillStyle = isWithinRoche ? "#ef4444" : "#10b981";
      ctx.fillText(`Status: ${isWithinRoche ? "UNSTABLE" : "STABLE"}`, paramX + 10, infoY);
      infoY += 20;

      // Tidal acceleration magnitude
      const centerTidal = calculateTidalAcceleration(primaryX + objectRadius * 60, primaryY);
      const tidalMagnitude = Math.sqrt(centerTidal.ax ** 2 + centerTidal.ay ** 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Tidal Acceleration:`, paramX + 10, infoY);
      infoY += 14;
      ctx.fillText(`${tidalMagnitude.toFixed(3)} units/s²`, paramX + 20, infoY);

      // Physics explanation panel
      const physicsX = W - 300;
      const physicsY = H - 200;
      const physicsW = 280;
      const physicsH = 180;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(physicsX, physicsY, physicsW, physicsH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(physicsX, physicsY, physicsW, physicsH);

      let physY = physicsY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Tidal Force Physics", physicsX + 10, physY);
      physY += 25;

      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      const concepts = [
        "• Tidal force = differential gravity",
        "• F_tidal ∝ M/r³ (inverse cube law)",
        "• Stretches objects along line to mass",
        "• Creates two bulges (near & far side)",
        "• Roche limit: tidal force > self-gravity",
        "• Moon causes Earth's ocean tides",
        "• Can disrupt moons, asteroids, comets",
        "• Tidal heating in moons (Io, Europa)"
      ];
      
      concepts.forEach(concept => {
        ctx.fillText(concept, physicsX + 10, physY);
        physY += 15;
      });

      // Tide heights visualization
      const maxBulgeHeight = Math.max(...tideBulges.map(b => Math.abs(b.height)));
      ctx.font = "11px Arial";
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "left";
      ctx.fillText(`Max Tide Height: ${maxBulgeHeight.toFixed(1)} units`, 20, H - 10);

      // Examples panel
      ctx.font = "10px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      const examples = "Examples: Earth-Moon tides, Jupiter's disruption of comets, tidal heating of Io";
      ctx.fillText(examples, W / 2, H - 5);
    },

    reset() {
      time = 0;
      initializeParticles();
    },

    destroy() {
      testParticles = [];
      tideBulges = [];
    },

    getStateDescription(): string {
      const isWithinRoche = separationDistance < (rocheLimit / 100);
      const maxTideHeight = Math.max(...tideBulges.map(b => Math.abs(b.height)));
      const centerTidal = calculateTidalAcceleration(primaryX + objectRadius * 60, primaryY);
      const tidalMagnitude = Math.sqrt(centerTidal.ax ** 2 + centerTidal.ay ** 2);
      
      return (
        `Tidal Forces simulation: Primary body (${primaryMass.toFixed(1)}M) and ` +
        `secondary body (${secondaryMass.toFixed(1)}M) separated by ${separationDistance.toFixed(1)} units. ` +
        `Object radius: ${objectRadius.toFixed(1)} units. ` +
        `Roche limit: ${(rocheLimit / 100).toFixed(2)} units - system is ${isWithinRoche ? 'UNSTABLE (tidal disruption)' : 'STABLE'}. ` +
        `Current tidal acceleration: ${tidalMagnitude.toFixed(3)} units/s². ` +
        `Maximum tide height: ${maxTideHeight.toFixed(1)} units. ` +
        `Tidal forces follow inverse cube law (∝ M/r³), creating differential gravity that ` +
        `stretches objects and generates two tidal bulges. Below Roche limit, tidal forces exceed self-gravity.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
      primaryX = W * 0.3;
      primaryY = H * 0.5;
      // secondaryX will be recalculated in updateTidalEffects
      secondaryY = H * 0.5;
    }
  };

  return engine;
};

export default TidalForcesFactory;