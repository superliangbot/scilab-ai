import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Magnetic Force on Current-Carrying Wire
 * F = I × L × B × sin(θ) where I=current, L=length, B=magnetic field, θ=angle
 * Shows force direction using right-hand rule
 * Demonstrates motor principle and wire deflection in magnetic field
 */

const MagneticForceCurrentWireFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnetic-force-current-wire") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // System parameters
  let current = 2.5; // Amperes
  let magneticField = 0.3; // Tesla
  let wireLength = 1.5; // meters (for display scaling)
  let fieldAngle = 90; // degrees (angle between field and current)
  let currentDirection = 1; // 1 = right, -1 = left

  let wireX = 300;
  let wireY = 250;
  let wireVelocity = 0;
  let wireDisplacement = 0;

  // Current visualization particles
  const currentParticles: Array<{
    x: number;
    y: number;
    age: number;
  }> = [];

  const WIRE_LENGTH_PX = 200; // Visual length of wire
  const MAX_DISPLACEMENT = 50; // Maximum wire displacement

  function calculateMagneticForce(): number {
    const angleRad = (fieldAngle * Math.PI) / 180;
    return current * wireLength * magneticField * Math.sin(angleRad) * currentDirection;
  }

  function addCurrentParticle() {
    const startX = currentDirection > 0 ? wireX - WIRE_LENGTH_PX / 2 : wireX + WIRE_LENGTH_PX / 2;
    const endX = currentDirection > 0 ? wireX + WIRE_LENGTH_PX / 2 : wireX - WIRE_LENGTH_PX / 2;
    
    currentParticles.push({
      x: startX,
      y: wireY,
      age: 0
    });
  }

  function updateCurrentParticles(dt: number) {
    const particleSpeed = 150; // pixels/second
    
    for (let i = currentParticles.length - 1; i >= 0; i--) {
      const particle = currentParticles[i];
      
      particle.age += dt;
      particle.x += currentDirection * particleSpeed * dt;
      
      // Remove particles that have traveled past the wire
      const wireStart = wireX - WIRE_LENGTH_PX / 2;
      const wireEnd = wireX + WIRE_LENGTH_PX / 2;
      
      if (currentDirection > 0 && particle.x > wireEnd + 10) {
        currentParticles.splice(i, 1);
      } else if (currentDirection < 0 && particle.x < wireStart - 10) {
        currentParticles.splice(i, 1);
      } else if (particle.age > 3) {
        currentParticles.splice(i, 1);
      }
    }
  }

  function drawMagneticField() {
    // Field direction indicator
    const fieldSymbolSize = 15;
    const fieldSpacing = 40;
    
    ctx.fillStyle = "#3b82f6";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    
    // Draw field symbols in background
    for (let x = 50; x < width - 50; x += fieldSpacing) {
      for (let y = 50; y < height - 100; y += fieldSpacing) {
        if (Math.abs(x - wireX) > 100 || Math.abs(y - wireY) > 30) {
          // Field into page (⊗)
          ctx.beginPath();
          ctx.arc(x, y, fieldSymbolSize / 2, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(x - fieldSymbolSize / 3, y - fieldSymbolSize / 3);
          ctx.lineTo(x + fieldSymbolSize / 3, y + fieldSymbolSize / 3);
          ctx.moveTo(x - fieldSymbolSize / 3, y + fieldSymbolSize / 3);
          ctx.lineTo(x + fieldSymbolSize / 3, y - fieldSymbolSize / 3);
          ctx.stroke();
        }
      }
    }
    
    // Field strength and direction labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`B = ${magneticField} T (into page)`, 20, 30);
  }

  function drawWire() {
    const currentWireY = wireY + wireDisplacement;
    
    // Wire
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(wireX - WIRE_LENGTH_PX / 2, currentWireY);
    ctx.lineTo(wireX + WIRE_LENGTH_PX / 2, currentWireY);
    ctx.stroke();
    
    // Wire supports/connections
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.moveTo(wireX - WIRE_LENGTH_PX / 2, currentWireY);
    ctx.lineTo(wireX - WIRE_LENGTH_PX / 2 - 30, wireY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(wireX + WIRE_LENGTH_PX / 2, currentWireY);
    ctx.lineTo(wireX + WIRE_LENGTH_PX / 2 + 30, wireY);
    ctx.stroke();
    
    // Current direction arrow
    const arrowY = currentWireY - 25;
    const arrowLength = 40;
    const arrowX = wireX + currentDirection * arrowLength / 2;
    
    ctx.strokeStyle = "#10b981";
    ctx.fillStyle = "#10b981";
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.moveTo(wireX - currentDirection * arrowLength / 2, arrowY);
    ctx.lineTo(wireX + currentDirection * arrowLength / 2, arrowY);
    ctx.stroke();
    
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - currentDirection * 12, arrowY - 8);
    ctx.lineTo(arrowX - currentDirection * 12, arrowY + 8);
    ctx.closePath();
    ctx.fill();
    
    // Current label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    const currentText = `I = ${Math.abs(current)} A ${currentDirection > 0 ? '→' : '←'}`;
    ctx.fillText(currentText, wireX, arrowY - 15);
    
    // Wire length label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`L = ${wireLength} m`, wireX, currentWireY + 20);
  }

  function drawCurrentParticles() {
    currentParticles.forEach(particle => {
      const alpha = Math.max(0.2, 1 - particle.age / 3);
      
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
      ctx.fill();
      
      // Particle trail
      ctx.beginPath();
      ctx.arc(particle.x - currentDirection * 8, particle.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(16, 185, 129, ${alpha * 0.5})`;
      ctx.fill();
    });
  }

  function drawForceVector() {
    const force = calculateMagneticForce();
    const forceDirection = Math.sign(force);
    const forceScale = Math.abs(force) * 50; // Scale for visualization
    
    if (Math.abs(force) < 0.001) return;
    
    const currentWireY = wireY + wireDisplacement;
    const forceY = currentWireY + forceDirection * 60;
    
    // Force vector
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "#ef4444";
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.moveTo(wireX, currentWireY);
    ctx.lineTo(wireX, forceY);
    ctx.stroke();
    
    // Force arrow
    ctx.beginPath();
    ctx.moveTo(wireX, forceY);
    ctx.lineTo(wireX - 10, forceY - forceDirection * 15);
    ctx.lineTo(wireX + 10, forceY - forceDirection * 15);
    ctx.closePath();
    ctx.fill();
    
    // Force magnitude label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`F = ${Math.abs(force).toFixed(3)} N`, wireX + 50, forceY);
    
    // Direction label
    const directionText = forceDirection > 0 ? "Downward" : "Upward";
    ctx.fillStyle = "#ef4444";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(directionText, wireX + 50, forceY + 15);
  }

  function drawRightHandRule() {
    // Right-hand rule diagram in corner
    const rhrX = width - 150;
    const rhrY = 50;
    const size = 80;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(rhrX - size / 2, rhrY - size / 2, size, size + 30);
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(rhrX - size / 2, rhrY - size / 2, size, size + 30);
    
    // Current (I) - thumb
    ctx.strokeStyle = "#10b981";
    ctx.fillStyle = "#10b981";
    ctx.lineWidth = 2;
    
    const thumbLength = 25;
    ctx.beginPath();
    ctx.moveTo(rhrX - thumbLength / 2, rhrY);
    ctx.lineTo(rhrX + thumbLength / 2, rhrY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(rhrX + thumbLength / 2, rhrY);
    ctx.lineTo(rhrX + thumbLength / 2 - 8, rhrY - 5);
    ctx.lineTo(rhrX + thumbLength / 2 - 8, rhrY + 5);
    ctx.closePath();
    ctx.fill();
    
    // Magnetic field (B) - fingers
    ctx.strokeStyle = "#3b82f6";
    ctx.fillStyle = "#3b82f6";
    
    for (let i = 0; i < 3; i++) {
      const x = rhrX - 10 + i * 10;
      const y = rhrY + 15;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 2);
      ctx.lineTo(x + 2, y + 2);
      ctx.moveTo(x - 2, y + 2);
      ctx.lineTo(x + 2, y - 2);
      ctx.stroke();
    }
    
    // Force (F) - palm
    const force = calculateMagneticForce();
    const forceDirection = Math.sign(force);
    
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "#ef4444";
    
    ctx.beginPath();
    ctx.moveTo(rhrX, rhrY - 15);
    ctx.lineTo(rhrX, rhrY - 15 + forceDirection * 20);
    ctx.stroke();
    
    ctx.beginPath();
    const arrowY = rhrY - 15 + forceDirection * 20;
    ctx.moveTo(rhrX, arrowY);
    ctx.lineTo(rhrX - 5, arrowY - forceDirection * 8);
    ctx.lineTo(rhrX + 5, arrowY - forceDirection * 8);
    ctx.closePath();
    ctx.fill();
    
    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    
    ctx.fillText("Right Hand Rule", rhrX, rhrY - size / 2 - 5);
    ctx.fillStyle = "#10b981";
    ctx.fillText("I (thumb)", rhrX, rhrY + 35);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("B (fingers)", rhrX, rhrY + 45);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("F (palm)", rhrX, rhrY + 55);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    wireDisplacement = 0;
    wireVelocity = 0;
    currentParticles.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    current = params.current ?? 2.5;
    magneticField = params.magneticField ?? 0.3;
    wireLength = params.wireLength ?? 1.5;
    fieldAngle = params.fieldAngle ?? 90;
    currentDirection = Math.sign(params.currentDirection ?? 1) || 1;

    time += dt;

    // Calculate force and resulting motion
    const force = calculateMagneticForce();
    const wireMass = 0.1; // kg (assumed)
    const damping = 0.95;
    
    // F = ma
    const acceleration = force / wireMass * 100; // Scale for visualization
    wireVelocity += acceleration * dt;
    wireVelocity *= damping; // Damping
    
    wireDisplacement += wireVelocity * dt;
    wireDisplacement = Math.max(-MAX_DISPLACEMENT, Math.min(MAX_DISPLACEMENT, wireDisplacement));

    // Add current particles periodically
    if (Math.random() < 0.3) {
      addCurrentParticle();
    }

    updateCurrentParticles(dt);
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawMagneticField();
    drawWire();
    drawCurrentParticles();
    drawForceVector();
    drawRightHandRule();

    const force = calculateMagneticForce();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, height - 180, 350, 160);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Magnetic Force on Current Wire", 20, height - 155);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`F = I × L × B × sin(θ)`, 20, height - 130);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Current: I = ${Math.abs(current)} A`, 20, height - 105);
    ctx.fillText(`Wire Length: L = ${wireLength} m`, 20, height - 85);
    ctx.fillText(`Magnetic Field: B = ${magneticField} T`, 20, height - 65);
    ctx.fillText(`Angle: θ = ${fieldAngle}°`, 20, height - 45);
    
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Force: F = ${Math.abs(force).toFixed(3)} N`, 20, height - 25);

    // Motor principle info
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 250, height - 140, 240, 120);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Motor Principle:", width - 240, height - 115);
    ctx.fillText("• Current-carrying wire in", width - 240, height - 95);
    ctx.fillText("  magnetic field experiences force", width - 240, height - 80);
    ctx.fillText("• Force direction: Right-hand rule", width - 240, height - 65);
    ctx.fillText("• Reversing current reverses force", width - 240, height - 50);
    ctx.fillText("• Used in electric motors", width - 240, height - 35);

    // Formula explanation
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Force perpendicular to both current and magnetic field", width / 2, 20);
    ctx.fillText("Maximum force when current ⊥ magnetic field (θ = 90°)", width / 2, 35);
  }

  function reset(): void {
    time = 0;
    wireDisplacement = 0;
    wireVelocity = 0;
    currentParticles.length = 0;
  }

  function destroy(): void {
    currentParticles.length = 0;
  }

  function getStateDescription(): string {
    const force = calculateMagneticForce();
    const forceDirection = force > 0 ? "downward" : "upward";
    const currentDir = currentDirection > 0 ? "rightward" : "leftward";
    
    return (
      `Magnetic Force on Current Wire: I=${Math.abs(current)}A current flowing ${currentDir} in B=${magneticField}T magnetic field. ` +
      `Wire length L=${wireLength}m, field angle θ=${fieldAngle}°. ` +
      `Magnetic force F=${Math.abs(force).toFixed(3)}N acts ${forceDirection} on wire. ` +
      `Right-hand rule determines force direction: thumb=current, fingers=field, palm=force. ` +
      `Demonstrates motor principle - current in magnetic field produces mechanical force.`
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

export default MagneticForceCurrentWireFactory;