import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Gyroscope Precession
 * τ = dL/dt, precession rate Ω = τ/(L·sin(θ)) = mgr/(Iω·sin(θ))
 * Shows spinning gyroscope precessing due to gravitational torque
 * Demonstrates conservation of angular momentum
 */

const GyroscopePrecessionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gyroscope-precession") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Gyroscope parameters
  let spinRate = 200; // rad/s (rotor spin)
  let gyroMass = 2; // kg
  let rotorRadius = 0.1; // m
  let pivotDistance = 0.3; // m (center of mass to pivot)
  let initialTilt = 15; // degrees from horizontal

  let precessionAngle = 0; // Current precession angle
  let tiltAngle = 15; // Current tilt angle
  let precessionRate = 0; // rad/s
  
  // For visualization
  let gyroX = 400;
  let gyroY = 250;
  const SCALE = 400; // pixels per meter

  // Animation trails
  const trailPoints: Array<{ x: number; y: number; age: number }> = [];

  function calculateMomentOfInertia(): number {
    // Disk: I = (1/2)mr²
    return 0.5 * gyroMass * rotorRadius * rotorRadius;
  }

  function calculatePrecessionRate(): number {
    const I = calculateMomentOfInertia();
    const L = I * spinRate; // Angular momentum
    const g = 9.81; // gravity
    const tau = gyroMass * g * pivotDistance; // Torque magnitude
    const tiltRad = (tiltAngle * Math.PI) / 180;
    
    if (Math.sin(tiltRad) < 0.01) return 0; // Avoid division by zero
    
    return tau / (L * Math.sin(tiltRad));
  }

  function drawGyroscopeFrame() {
    const centerX = gyroX;
    const centerY = gyroY;
    
    // Support stand
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    
    // Base
    ctx.beginPath();
    ctx.moveTo(centerX - 100, centerY + 150);
    ctx.lineTo(centerX + 100, centerY + 150);
    ctx.stroke();
    
    // Vertical support
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 150);
    ctx.lineTo(centerX, centerY);
    ctx.stroke();
    
    // Pivot bearing
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#94a3b8";
    ctx.fill();
    ctx.stroke();
  }

  function drawGyroscope() {
    const centerX = gyroX;
    const centerY = gyroY;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(precessionAngle);
    
    // Tilt the gyroscope
    const tiltRad = (tiltAngle * Math.PI) / 180;
    const armLength = pivotDistance * SCALE;
    
    // Gyroscope arm
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-armLength, 0);
    ctx.lineTo(armLength, 0);
    ctx.stroke();
    
    // Draw rotor at the end
    ctx.save();
    ctx.translate(armLength, 0);
    ctx.rotate(tiltRad);
    
    // Rotor disk
    const rotorRadiusPx = rotorRadius * SCALE * 5; // Scaled up for visibility
    
    // Rotor motion blur effect
    const blurSteps = 8;
    for (let i = 0; i < blurSteps; i++) {
      const alpha = 0.1 + (i / blurSteps) * 0.4;
      ctx.globalAlpha = alpha;
      
      ctx.save();
      ctx.rotate((time * spinRate + i * Math.PI / blurSteps) * 0.1); // Scaled down rotation for visualization
      
      // Rotor
      ctx.beginPath();
      ctx.arc(0, 0, rotorRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Rotor spokes
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      for (let j = 0; j < 6; j++) {
        const spokeAngle = (j / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spokeAngle) * rotorRadiusPx * 0.8, Math.sin(spokeAngle) * rotorRadiusPx * 0.8);
        ctx.stroke();
      }
      
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    
    // Rotor center
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    
    ctx.restore();
    
    // Weight visualization (mass center)
    ctx.save();
    ctx.translate(armLength * Math.cos(tiltRad), armLength * Math.sin(tiltRad));
    
    // Weight
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#10b981";
    ctx.fill();
    
    // Gravity force vector
    ctx.strokeStyle = "#10b981";
    ctx.fillStyle = "#10b981";
    ctx.lineWidth = 3;
    
    const forceLength = 40;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, forceLength);
    ctx.stroke();
    
    // Arrow
    ctx.beginPath();
    ctx.moveTo(0, forceLength);
    ctx.lineTo(-8, forceLength - 12);
    ctx.lineTo(8, forceLength - 12);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    
    ctx.restore();
  }

  function drawAngularMomentumVector() {
    const centerX = gyroX;
    const centerY = gyroY;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(precessionAngle);
    
    const armLength = pivotDistance * SCALE;
    const tiltRad = (tiltAngle * Math.PI) / 180;
    
    ctx.translate(armLength, 0);
    
    // Angular momentum vector (along spin axis)
    const LLength = 60;
    const Lx = LLength * Math.sin(tiltRad);
    const Ly = -LLength * Math.cos(tiltRad);
    
    ctx.strokeStyle = "#8b5cf6";
    ctx.fillStyle = "#8b5cf6";
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Lx, Ly);
    ctx.stroke();
    
    // Arrow
    const arrowAngle = Math.atan2(Ly, Lx);
    ctx.beginPath();
    ctx.moveTo(Lx, Ly);
    ctx.lineTo(Lx - 10 * Math.cos(arrowAngle - 0.5), Ly - 10 * Math.sin(arrowAngle - 0.5));
    ctx.lineTo(Lx - 10 * Math.cos(arrowAngle + 0.5), Ly - 10 * Math.sin(arrowAngle + 0.5));
    ctx.closePath();
    ctx.fill();
    
    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("L", Lx + 10, Ly - 10);
    
    ctx.restore();
  }

  function drawPrecessionPath() {
    const centerX = gyroX;
    const centerY = gyroY;
    
    // Precession circle
    ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const precessionRadius = pivotDistance * SCALE;
    ctx.beginPath();
    ctx.arc(centerX, centerY, precessionRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Trail points
    ctx.fillStyle = "#f59e0b";
    trailPoints.forEach((point, i) => {
      const alpha = Math.max(0.1, 1 - point.age / 5);
      ctx.globalAlpha = alpha;
      
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawVectors() {
    // Torque vector (into or out of page at pivot)
    const centerX = gyroX;
    const centerY = gyroY;
    
    ctx.fillStyle = "#ef4444";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    
    // Torque symbol at pivot
    const torqueSymbol = precessionRate > 0 ? "⊙" : "⊗";
    ctx.fillText(`τ ${torqueSymbol}`, centerX, centerY - 20);
    
    // Precession direction arrow
    const arrowRadius = pivotDistance * SCALE + 30;
    const arrowAngle = precessionAngle + (precessionRate > 0 ? Math.PI / 2 : -Math.PI / 2);
    
    ctx.strokeStyle = "#f59e0b";
    ctx.fillStyle = "#f59e0b";
    ctx.lineWidth = 2;
    
    const arrowX = centerX + arrowRadius * Math.cos(arrowAngle);
    const arrowY = centerY + arrowRadius * Math.sin(arrowAngle);
    
    // Curved arrow for precession
    ctx.beginPath();
    ctx.arc(centerX, centerY, arrowRadius, arrowAngle - 0.3, arrowAngle + 0.3);
    ctx.stroke();
    
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    const headAngle = arrowAngle + Math.PI / 2;
    ctx.lineTo(arrowX - 8 * Math.cos(headAngle - 0.5), arrowY - 8 * Math.sin(headAngle - 0.5));
    ctx.lineTo(arrowX - 8 * Math.cos(headAngle + 0.5), arrowY - 8 * Math.sin(headAngle + 0.5));
    ctx.closePath();
    ctx.fill();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    precessionAngle = 0;
    tiltAngle = initialTilt;
    trailPoints.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    spinRate = params.spinRate ?? 200;
    gyroMass = params.gyroMass ?? 2;
    rotorRadius = params.rotorRadius ?? 0.1;
    pivotDistance = params.pivotDistance ?? 0.3;
    tiltAngle = params.tiltAngle ?? 15;

    time += dt;

    // Calculate precession rate
    precessionRate = calculatePrecessionRate();
    
    // Update precession angle
    precessionAngle += precessionRate * dt;
    
    // Add trail points
    const trailX = gyroX + Math.cos(precessionAngle) * pivotDistance * SCALE;
    const trailY = gyroY + Math.sin(precessionAngle) * pivotDistance * SCALE;
    
    if (trailPoints.length === 0 || 
        Math.sqrt((trailX - trailPoints[trailPoints.length - 1].x) ** 2 + 
                 (trailY - trailPoints[trailPoints.length - 1].y) ** 2) > 5) {
      trailPoints.push({ x: trailX, y: trailY, age: 0 });
    }
    
    // Age trail points
    for (let i = trailPoints.length - 1; i >= 0; i--) {
      trailPoints[i].age += dt;
      if (trailPoints[i].age > 5 || trailPoints.length > 100) {
        trailPoints.splice(i, 1);
      }
    }
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawPrecessionPath();
    drawGyroscopeFrame();
    drawGyroscope();
    drawAngularMomentumVector();
    drawVectors();

    const I = calculateMomentOfInertia();
    const L = I * spinRate;
    const tau = gyroMass * 9.81 * pivotDistance;

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 350, 220);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Gyroscope Precession", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText("τ = dL/dt", 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Spin Rate: ω = ${spinRate} rad/s`, 20, 80);
    ctx.fillText(`Angular Momentum: L = ${L.toFixed(2)} kg⋅m²/s`, 20, 100);
    ctx.fillText(`Gravitational Torque: τ = ${tau.toFixed(3)} N⋅m`, 20, 120);
    ctx.fillText(`Precession Rate: Ω = ${precessionRate.toFixed(3)} rad/s`, 20, 140);
    ctx.fillText(`Tilt Angle: θ = ${tiltAngle}°`, 20, 160);
    
    const period = precessionRate > 0 ? (2 * Math.PI) / precessionRate : Infinity;
    ctx.fillText(`Precession Period: T = ${isFinite(period) ? period.toFixed(1) : '∞'} s`, 20, 180);
    
    // Moment of inertia
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Moment of Inertia: I = ${(I * 1000).toFixed(2)} × 10⁻³ kg⋅m²`, 20, 200);
    ctx.fillText(`Mass: m = ${gyroMass} kg, Radius: r = ${rotorRadius} m`, 20, 215);

    // Theory panel
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 280, 10, 270, 160);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Gyroscopic Precession:", width - 270, 30);
    ctx.fillText("• Spinning rotor resists tilting", width - 270, 50);
    ctx.fillText("• Gravity creates torque τ = mgr", width - 270, 70);
    ctx.fillText("• Torque changes angular momentum", width - 270, 90);
    ctx.fillText("• Result: Precession motion", width - 270, 110);
    ctx.fillText("• Ω = mgr/(Iω sin θ)", width - 270, 130);
    ctx.fillText("• Higher spin = slower precession", width - 270, 150);

    // Applications
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Applications: Gyrocompasses, inertial navigation, bicycle wheels", width / 2, height - 20);
    ctx.fillText("Conservation of angular momentum prevents tipping", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    precessionAngle = 0;
    tiltAngle = initialTilt;
    trailPoints.length = 0;
  }

  function destroy(): void {
    trailPoints.length = 0;
  }

  function getStateDescription(): string {
    const I = calculateMomentOfInertia();
    const L = I * spinRate;
    const period = precessionRate > 0 ? (2 * Math.PI) / precessionRate : Infinity;
    
    return (
      `Gyroscope Precession: ${gyroMass}kg rotor spinning at ω=${spinRate}rad/s with angular momentum L=${L.toFixed(2)}kg⋅m²/s. ` +
      `Gravitational torque τ=${(gyroMass * 9.81 * pivotDistance).toFixed(3)}N⋅m causes precession at Ω=${precessionRate.toFixed(3)}rad/s. ` +
      `Tilt angle θ=${tiltAngle}°, precession period T=${isFinite(period) ? period.toFixed(1) : '∞'}s. ` +
      `Demonstrates conservation of angular momentum and gyroscopic effect.`
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

export default GyroscopePrecessionFactory;