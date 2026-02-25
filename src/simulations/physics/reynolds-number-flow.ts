import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Reynolds Number Flow Visualization
 * Shows the transition from laminar to turbulent flow in a pipe
 * Re = ρvD/μ where ρ=density, v=velocity, D=diameter, μ=viscosity
 * Re < 2300: laminar flow, Re > 4000: turbulent flow
 */

const ReynoldsNumberFlowFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("reynolds-number-flow") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Flow parameters
  let velocity = 1.5; // m/s
  let viscosity = 0.001; // Pa·s (water at 20°C)
  let diameter = 0.1; // m
  let density = 1000; // kg/m³ (water)

  // Flow visualization particles
  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    age: number;
  }> = [];

  const PIPE_HEIGHT = 120;
  const PIPE_Y_CENTER = 200;

  function calculateReynolds(): number {
    return (density * velocity * diameter) / viscosity;
  }

  function isLaminar(): boolean {
    return calculateReynolds() < 2300;
  }

  function isTurbulent(): boolean {
    return calculateReynolds() > 4000;
  }

  function addParticle() {
    const re = calculateReynolds();
    const isLam = isLaminar();
    
    particles.push({
      x: 50,
      y: PIPE_Y_CENTER + (Math.random() - 0.5) * (PIPE_HEIGHT - 20),
      vx: velocity * 80, // Scale for visualization
      vy: isLam ? 0 : (Math.random() - 0.5) * 20 * Math.min(1, re / 4000),
      color: isLam ? "#4ade80" : "#ef4444",
      age: 0
    });
  }

  function updateParticles(dt: number) {
    const re = calculateReynolds();
    const isLam = isLaminar();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;

      // Update position
      p.x += p.vx * dt;
      
      if (!isLam && re > 2300) {
        // Add turbulent motion
        const turbulenceIntensity = Math.min(1, (re - 2300) / 2000);
        p.vy += (Math.random() - 0.5) * 100 * turbulenceIntensity * dt;
        p.vy *= 0.98; // Damping
        
        // Add vorticity for turbulent flow
        if (Math.random() < 0.02) {
          p.vy += (Math.random() - 0.5) * 50 * turbulenceIntensity;
        }
      }
      
      p.y += p.vy * dt;

      // Keep particles within pipe
      const pipeTop = PIPE_Y_CENTER - PIPE_HEIGHT / 2 + 10;
      const pipeBottom = PIPE_Y_CENTER + PIPE_HEIGHT / 2 - 10;
      
      if (p.y < pipeTop) {
        p.y = pipeTop;
        p.vy = Math.abs(p.vy) * 0.3;
      }
      if (p.y > pipeBottom) {
        p.y = pipeBottom;
        p.vy = -Math.abs(p.vy) * 0.3;
      }

      // Remove old particles
      if (p.x > width || p.age > 8) {
        particles.splice(i, 1);
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    particles.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    velocity = params.velocity ?? 1.5;
    viscosity = params.viscosity ?? 0.001;
    diameter = params.diameter ?? 0.1;
    density = params.density ?? 1000;

    time += dt;

    // Add new particles
    if (Math.random() < 0.6) {
      addParticle();
    }

    updateParticles(dt);
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const re = calculateReynolds();
    const flowType = re < 2300 ? "LAMINAR" : re > 4000 ? "TURBULENT" : "TRANSITIONAL";
    const flowColor = re < 2300 ? "#4ade80" : re > 4000 ? "#ef4444" : "#fbbf24";

    // Draw pipe
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Top wall
    ctx.moveTo(30, PIPE_Y_CENTER - PIPE_HEIGHT / 2);
    ctx.lineTo(width - 30, PIPE_Y_CENTER - PIPE_HEIGHT / 2);
    // Bottom wall
    ctx.moveTo(30, PIPE_Y_CENTER + PIPE_HEIGHT / 2);
    ctx.lineTo(width - 30, PIPE_Y_CENTER + PIPE_HEIGHT / 2);
    ctx.stroke();

    // Pipe shading
    const pipeGrad = ctx.createLinearGradient(0, PIPE_Y_CENTER - PIPE_HEIGHT / 2, 0, PIPE_Y_CENTER + PIPE_HEIGHT / 2);
    pipeGrad.addColorStop(0, "rgba(100, 116, 139, 0.1)");
    pipeGrad.addColorStop(0.5, "rgba(100, 116, 139, 0.05)");
    pipeGrad.addColorStop(1, "rgba(100, 116, 139, 0.1)");
    ctx.fillStyle = pipeGrad;
    ctx.fillRect(30, PIPE_Y_CENTER - PIPE_HEIGHT / 2, width - 60, PIPE_HEIGHT);

    // Draw velocity profile
    ctx.strokeStyle = flowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = PIPE_Y_CENTER - PIPE_HEIGHT / 2 + 10; y < PIPE_Y_CENTER + PIPE_HEIGHT / 2 - 10; y += 2) {
      const relativeY = (y - PIPE_Y_CENTER) / (PIPE_HEIGHT / 2);
      let vProfile: number;
      
      if (isLaminar()) {
        // Parabolic profile for laminar flow
        vProfile = velocity * (1 - relativeY * relativeY);
      } else {
        // Flatter profile for turbulent flow
        vProfile = velocity * Math.pow(1 - Math.abs(relativeY), 0.2);
      }
      
      const x = width - 100;
      const profileX = x + vProfile * 30;
      
      if (y === PIPE_Y_CENTER - PIPE_HEIGHT / 2 + 10) {
        ctx.moveTo(x, y);
      }
      ctx.lineTo(profileX, y);
    }
    ctx.stroke();

    // Draw particles
    particles.forEach(p => {
      const alpha = Math.max(0.2, 1 - p.age / 8);
      ctx.globalAlpha = alpha;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      
      // Particle trail
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(10, 10, 300, 140);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Reynolds Number Flow", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = flowColor;
    ctx.fillText(`Flow Type: ${flowType}`, 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Re = ρvD/μ = ${re.toFixed(0)}`, 20, 75);
    ctx.fillText(`Velocity: ${velocity.toFixed(1)} m/s`, 20, 95);
    ctx.fillText(`Diameter: ${(diameter * 100).toFixed(1)} cm`, 20, 115);
    ctx.fillText(`Viscosity: ${viscosity.toFixed(4)} Pa·s`, 20, 135);

    // Flow regime indicators
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 150, 10, 140, 100);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Flow Regimes:", width - 140, 30);
    
    ctx.fillStyle = "#4ade80";
    ctx.fillText("Re < 2300: Laminar", width - 140, 50);
    
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("2300 < Re < 4000:", width - 140, 70);
    ctx.fillText("Transitional", width - 140, 85);
    
    ctx.fillStyle = "#ef4444";
    ctx.fillText("Re > 4000: Turbulent", width - 140, 105);
  }

  function reset(): void {
    time = 0;
    particles.length = 0;
  }

  function destroy(): void {
    particles.length = 0;
  }

  function getStateDescription(): string {
    const re = calculateReynolds();
    const flowType = re < 2300 ? "laminar" : re > 4000 ? "turbulent" : "transitional";
    return (
      `Reynolds Number Flow: Re = ${re.toFixed(0)}, flow is ${flowType}. ` +
      `Parameters: velocity=${velocity} m/s, diameter=${diameter} m, ` +
      `viscosity=${viscosity} Pa·s, density=${density} kg/m³. ` +
      `Laminar flow (Re<2300) shows smooth streamlines, turbulent flow (Re>4000) shows chaotic mixing.`
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

export default ReynoldsNumberFlowFactory;