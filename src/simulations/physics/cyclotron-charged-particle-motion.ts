import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Cyclotron Motion of Charged Particles
 * F = qvB (Lorentz force), circular motion with r = mv/(qB)
 * Cyclotron frequency: f = qB/(2πm)
 * Shows charged particles spiraling in magnetic field
 */

const CyclotronChargedParticleMotionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cyclotron-charged-particle-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // System parameters
  let magneticField = 0.1; // Tesla
  let particleCharge = 1.6e-19; // Coulombs (electron charge magnitude)
  let particleMass = 9.11e-31; // kg (electron mass)
  let initialVelocity = 1e6; // m/s
  let chargeSign = -1; // -1 for electron, +1 for proton
  let numParticles = 3;

  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    charge: number;
    mass: number;
    color: string;
    trail: Array<{ x: number; y: number; age: number }>;
    cyclotronRadius: number;
    cyclotronFrequency: number;
  }> = [];

  const FIELD_REGION_X = 100;
  const FIELD_REGION_Y = 100;
  const FIELD_REGION_WIDTH = 500;
  const FIELD_REGION_HEIGHT = 300;

  function initializeParticles() {
    particles.length = 0;
    
    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
    
    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * Math.PI * 2;
      const entryX = FIELD_REGION_X + FIELD_REGION_WIDTH * 0.1;
      const entryY = FIELD_REGION_Y + FIELD_REGION_HEIGHT * (0.3 + i * 0.2);
      
      // Slight velocity variations
      const velocityMag = initialVelocity * (0.8 + i * 0.1);
      const velocityAngle = Math.PI * 0.1 * (i - numParticles / 2);
      
      // Calculate cyclotron properties
      const q = Math.abs(particleCharge) * chargeSign;
      const cyclotronRadius = (particleMass * velocityMag) / (Math.abs(q) * magneticField);
      const cyclotronFrequency = Math.abs(q) * magneticField / (2 * Math.PI * particleMass);
      
      particles.push({
        x: entryX,
        y: entryY,
        vx: velocityMag * Math.cos(velocityAngle) / 1e4, // Scale for visualization
        vy: velocityMag * Math.sin(velocityAngle) / 1e4,
        charge: q,
        mass: particleMass,
        color: colors[i % colors.length],
        trail: [],
        cyclotronRadius: cyclotronRadius / 1000, // Scale for visualization
        cyclotronFrequency: cyclotronFrequency
      });
    }
  }

  function isInMagneticField(x: number, y: number): boolean {
    return x >= FIELD_REGION_X && x <= FIELD_REGION_X + FIELD_REGION_WIDTH &&
           y >= FIELD_REGION_Y && y <= FIELD_REGION_Y + FIELD_REGION_HEIGHT;
  }

  function updateParticles(dt: number) {
    particles.forEach(particle => {
      // Add current position to trail
      particle.trail.push({ x: particle.x, y: particle.y, age: 0 });
      
      // Age trail points and remove old ones
      for (let i = particle.trail.length - 1; i >= 0; i--) {
        particle.trail[i].age += dt;
        if (particle.trail[i].age > 5 || particle.trail.length > 200) {
          particle.trail.splice(i, 1);
        }
      }
      
      if (isInMagneticField(particle.x, particle.y)) {
        // Apply Lorentz force: F = q(v × B)
        const vMag = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        const B = magneticField;
        
        // Magnetic force perpendicular to velocity
        const forceMagnitude = Math.abs(particle.charge) * vMag * B;
        
        // Force direction (right-hand rule for positive charge)
        let forceAngle = Math.atan2(particle.vy, particle.vx) + Math.PI / 2;
        if (particle.charge < 0) {
          forceAngle += Math.PI; // Reverse for negative charge
        }
        
        const fx = Math.cos(forceAngle) * forceMagnitude;
        const fy = Math.sin(forceAngle) * forceMagnitude;
        
        // Update velocity (F = ma, so a = F/m)
        const accelerationScale = 1e12; // Scale factor for visualization
        particle.vx += (fx / particle.mass) * dt * accelerationScale;
        particle.vy += (fy / particle.mass) * dt * accelerationScale;
        
        // Limit velocity to prevent runaway
        const maxV = 200;
        const currentV = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (currentV > maxV) {
          particle.vx = (particle.vx / currentV) * maxV;
          particle.vy = (particle.vy / currentV) * maxV;
        }
      }
      
      // Update position
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      
      // Boundary conditions - reflect off walls
      if (particle.x < 0) {
        particle.x = 0;
        particle.vx = Math.abs(particle.vx);
      }
      if (particle.x > width) {
        particle.x = width;
        particle.vx = -Math.abs(particle.vx);
      }
      if (particle.y < 0) {
        particle.y = 0;
        particle.vy = Math.abs(particle.vy);
      }
      if (particle.y > height) {
        particle.y = height;
        particle.vy = -Math.abs(particle.vy);
      }
    });
  }

  function drawMagneticField() {
    // Field region background
    ctx.fillStyle = "rgba(138, 92, 246, 0.1)";
    ctx.fillRect(FIELD_REGION_X, FIELD_REGION_Y, FIELD_REGION_WIDTH, FIELD_REGION_HEIGHT);
    
    // Field boundary
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(FIELD_REGION_X, FIELD_REGION_Y, FIELD_REGION_WIDTH, FIELD_REGION_HEIGHT);
    ctx.setLineDash([]);
    
    // Magnetic field symbols
    const symbolSize = 12;
    const spacing = 40;
    
    ctx.fillStyle = "#8b5cf6";
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    
    for (let x = FIELD_REGION_X + spacing; x < FIELD_REGION_X + FIELD_REGION_WIDTH; x += spacing) {
      for (let y = FIELD_REGION_Y + spacing; y < FIELD_REGION_Y + FIELD_REGION_HEIGHT; y += spacing) {
        if (magneticField > 0) {
          // Field into page (⊗)
          ctx.beginPath();
          ctx.arc(x, y, symbolSize / 2, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(x - symbolSize / 3, y - symbolSize / 3);
          ctx.lineTo(x + symbolSize / 3, y + symbolSize / 3);
          ctx.moveTo(x - symbolSize / 3, y + symbolSize / 3);
          ctx.lineTo(x + symbolSize / 3, y - symbolSize / 3);
          ctx.stroke();
        } else {
          // Field out of page (⊙)
          ctx.beginPath();
          ctx.arc(x, y, symbolSize / 2, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    // Field strength label
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    const fieldDirection = magneticField > 0 ? "into page" : "out of page";
    ctx.fillText(`B = ${Math.abs(magneticField)} T (${fieldDirection})`, 
                 FIELD_REGION_X + FIELD_REGION_WIDTH / 2, FIELD_REGION_Y - 10);
  }

  function drawParticles() {
    particles.forEach((particle, index) => {
      // Draw trail
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 2;
      
      if (particle.trail.length > 1) {
        ctx.beginPath();
        particle.trail.forEach((point, i) => {
          const alpha = Math.max(0.1, 1 - point.age / 5);
          ctx.globalAlpha = alpha;
          
          if (i === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      
      // Draw particle
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = particle.color;
      ctx.fill();
      
      // Charge indicator
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      const chargeSymbol = particle.charge > 0 ? "+" : "−";
      ctx.fillText(chargeSymbol, particle.x, particle.y + 3);
      
      // Velocity vector
      const vScale = 5;
      const vx = particle.vx * vScale;
      const vy = particle.vy * vScale;
      const vMag = Math.sqrt(vx * vx + vy * vy);
      
      if (vMag > 2) {
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x + vx, particle.y + vy);
        ctx.stroke();
        
        // Arrow head
        const arrowAngle = Math.atan2(vy, vx);
        ctx.beginPath();
        ctx.moveTo(particle.x + vx, particle.y + vy);
        ctx.lineTo(particle.x + vx - 8 * Math.cos(arrowAngle - 0.5), 
                   particle.y + vy - 8 * Math.sin(arrowAngle - 0.5));
        ctx.lineTo(particle.x + vx - 8 * Math.cos(arrowAngle + 0.5), 
                   particle.y + vy - 8 * Math.sin(arrowAngle + 0.5));
        ctx.closePath();
        ctx.fillStyle = particle.color;
        ctx.fill();
      }
    });
  }

  function drawCyclotronInfo() {
    if (particles.length === 0) return;
    
    // Info for first particle
    const particle = particles[0];
    
    const infoX = width - 250;
    const infoY = height - 200;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(infoX - 10, infoY - 30, 240, 180);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText("Cyclotron Motion", infoX, infoY);
    
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Radius: r = mv/(qB)`, infoX, infoY + 25);
    ctx.fillText(`r = ${particle.cyclotronRadius.toFixed(2)} mm`, infoX, infoY + 45);
    
    ctx.fillText(`Frequency: f = qB/(2πm)`, infoX, infoY + 70);
    ctx.fillText(`f = ${(particle.cyclotronFrequency / 1e6).toFixed(2)} MHz`, infoX, infoY + 90);
    
    const period = 1 / particle.cyclotronFrequency;
    ctx.fillText(`Period: T = ${(period * 1e9).toFixed(2)} ns`, infoX, infoY + 115);
    
    // Particle properties
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    const particleType = chargeSign > 0 ? "Proton" : "Electron";
    ctx.fillText(`Particle: ${particleType}`, infoX, infoY + 140);
    ctx.fillText(`Mass: ${(particleMass * 1e31).toFixed(2)} × 10⁻³¹ kg`, infoX, infoY + 155);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initializeParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    magneticField = params.magneticField ?? 0.1;
    particleCharge = (params.particleCharge ?? 1.6) * 1e-19;
    const massParam = params.particleMass ?? 9.11;
    particleMass = massParam * 1e-31;
    initialVelocity = (params.initialVelocity ?? 1) * 1e6;
    chargeSign = Math.sign(params.chargeSign ?? -1) || -1;
    const newNumParticles = Math.round(params.numParticles ?? 3);

    if (newNumParticles !== numParticles) {
      numParticles = newNumParticles;
      initializeParticles();
    }

    time += dt;
    updateParticles(dt);
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawMagneticField();
    drawParticles();
    drawCyclotronInfo();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 300, 160);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Cyclotron Motion", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText("F = qvB (Lorentz Force)", 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Magnetic Field: B = ${Math.abs(magneticField)} T`, 20, 80);
    ctx.fillText(`Particle Charge: ${chargeSign > 0 ? '+' : '−'}${Math.abs(particleCharge * 1e19).toFixed(1)} × 10⁻¹⁹ C`, 20, 100);
    ctx.fillText(`Initial Velocity: v₀ = ${(initialVelocity / 1e6).toFixed(1)} × 10⁶ m/s`, 20, 120);
    
    const particleType = chargeSign > 0 ? "Positive" : "Negative";
    ctx.fillStyle = chargeSign > 0 ? "#ef4444" : "#3b82f6";
    ctx.fillText(`${particleType} particles`, 20, 140);

    // Physics principles
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 280, 10, 270, 120);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Cyclotron Principles:", width - 270, 30);
    ctx.fillText("• Charged particles curve in B-field", width - 270, 50);
    ctx.fillText("• Radius ∝ momentum, ∝ 1/charge", width - 270, 70);
    ctx.fillText("• Frequency independent of velocity", width - 270, 90);
    ctx.fillText("• Used in particle accelerators", width - 270, 110);

    // Formula summary
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Lorentz force causes circular motion in uniform magnetic field", width / 2, height - 20);
    ctx.fillText("Applications: Mass spectrometry, particle physics, medical cyclotrons", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    initializeParticles();
  }

  function destroy(): void {
    particles.length = 0;
  }

  function getStateDescription(): string {
    const particleType = chargeSign > 0 ? "positive" : "negative";
    const avgRadius = particles.length > 0 ? particles[0].cyclotronRadius.toFixed(2) : 0;
    const avgFreq = particles.length > 0 ? (particles[0].cyclotronFrequency / 1e6).toFixed(2) : 0;
    
    return (
      `Cyclotron Motion: ${numParticles} ${particleType} charged particles in B=${Math.abs(magneticField)}T magnetic field. ` +
      `Lorentz force F=qvB causes circular motion with radius r=${avgRadius}mm, frequency f=${avgFreq}MHz. ` +
      `Initial velocity v₀=${(initialVelocity / 1e6).toFixed(1)}×10⁶m/s. ` +
      `Demonstrates cyclotron resonance principle used in particle accelerators and mass spectrometers.`
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

export default CyclotronChargedParticleMotionFactory;