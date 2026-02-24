import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Nucleus {
  x: number;
  y: number;
  decayed: boolean;
  decayTime: number;
  type: "parent" | "daughter";
  energy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "alpha" | "beta" | "gamma";
  energy: number;
  age: number;
}

interface IsotopeData {
  name: string;
  symbol: string;
  halfLife: number; // in seconds
  decayConstant: number; // λ = ln(2)/t_half
  decayMode: "alpha" | "beta" | "gamma";
  daughterName: string;
  color: string;
  daughterColor: string;
}

const NuclearDecaySimulationFactory: SimulationFactory = () => {
  const config = getSimConfig("nuclear-decay-simulation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let isotopeType = 0;
  let initialNuclei = 100;
  let timeScale = 1; // Speed up simulation
  let showParticles = 1;
  let showHalfLife = 1;

  // Available isotopes
  const isotopes: IsotopeData[] = [
    { name: "Carbon-14", symbol: "¹⁴C", halfLife: 5730 * 365 * 24 * 3600, decayConstant: 0, decayMode: "beta", daughterName: "Nitrogen-14", color: "#3b82f6", daughterColor: "#10b981" },
    { name: "Uranium-238", symbol: "²³⁸U", halfLife: 4.47e9 * 365 * 24 * 3600, decayConstant: 0, decayMode: "alpha", daughterName: "Thorium-234", color: "#ef4444", daughterColor: "#f59e0b" },
    { name: "Cobalt-60", symbol: "⁶⁰Co", halfLife: 5.27 * 365 * 24 * 3600, decayConstant: 0, decayMode: "gamma", daughterName: "Nickel-60", color: "#8b5cf6", daughterColor: "#64748b" },
    { name: "Iodine-131", symbol: "¹³¹I", halfLife: 8.02 * 24 * 3600, decayConstant: 0, decayMode: "beta", daughterName: "Xenon-131", color: "#06b6d4", daughterColor: "#84cc16" },
    { name: "Radon-222", symbol: "²²²Rn", halfLife: 3.82 * 24 * 3600, decayConstant: 0, decayMode: "alpha", daughterName: "Polonium-218", color: "#f97316", daughterColor: "#eab308" },
  ];

  // State
  let currentIsotope: IsotopeData;
  let nuclei: Nucleus[] = [];
  let particles: Particle[] = [];
  let decayHistory: { time: number; remaining: number; decayed: number }[] = [];
  let halfLifeMarkers: number[] = [];

  function initializeSimulation() {
    currentIsotope = { ...isotopes[isotopeType] };
    // Scale half-life for simulation (make it observable)
    currentIsotope.halfLife = Math.max(10, currentIsotope.halfLife / (1e6 * timeScale));
    currentIsotope.decayConstant = Math.log(2) / currentIsotope.halfLife;
    
    nuclei = [];
    particles = [];
    decayHistory = [];
    halfLifeMarkers = [];
    
    // Create initial nuclei in a grid
    const cols = Math.ceil(Math.sqrt(initialNuclei));
    const rows = Math.ceil(initialNuclei / cols);
    const startX = W * 0.1;
    const startY = H * 0.15;
    const spacingX = (W * 0.5) / cols;
    const spacingY = (H * 0.4) / rows;
    
    for (let i = 0; i < initialNuclei; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      nuclei.push({
        x: startX + col * spacingX + (Math.random() - 0.5) * 10,
        y: startY + row * spacingY + (Math.random() - 0.5) * 10,
        decayed: false,
        decayTime: -Math.log(Math.random()) / currentIsotope.decayConstant,
        type: "parent",
        energy: 1 + Math.random() * 0.5,
      });
    }
    
    // Calculate half-life markers
    for (let i = 1; i <= 5; i++) {
      halfLifeMarkers.push(i * currentIsotope.halfLife);
    }
  }

  function updateDecay(dt: number) {
    let newDecays = 0;
    
    for (const nucleus of nuclei) {
      if (!nucleus.decayed && time >= nucleus.decayTime) {
        nucleus.decayed = true;
        nucleus.type = "daughter";
        newDecays++;
        
        // Create decay particle
        if (showParticles) {
          createDecayParticle(nucleus);
        }
      }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.age += dt;
      
      // Remove old particles or those off-screen
      if (particle.age > 5 || particle.x < 0 || particle.x > W || particle.y < 0 || particle.y > H) {
        particles.splice(i, 1);
      }
    }
    
    // Record history
    const remaining = nuclei.filter(n => !n.decayed).length;
    const decayed = nuclei.length - remaining;
    
    if (decayHistory.length === 0 || time - decayHistory[decayHistory.length - 1].time > 0.1) {
      if (decayHistory.length > 500) decayHistory.shift();
      decayHistory.push({ time, remaining, decayed });
    }
  }

  function createDecayParticle(nucleus: Nucleus) {
    const angle = Math.random() * 2 * Math.PI;
    const speed = 50 + Math.random() * 100;
    
    const particle: Particle = {
      x: nucleus.x,
      y: nucleus.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      type: currentIsotope.decayMode,
      energy: nucleus.energy,
      age: 0,
    };
    
    particles.push(particle);
  }

  function drawNuclei() {
    for (const nucleus of nuclei) {
      const color = nucleus.decayed ? currentIsotope.daughterColor : currentIsotope.color;
      const radius = nucleus.decayed ? 4 : 6;
      const alpha = nucleus.decayed ? 0.6 : 1.0;
      
      // Nucleus glow
      ctx.fillStyle = color + Math.floor(alpha * 0.3 * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(nucleus.x, nucleus.y, radius * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Nucleus core
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(nucleus.x, nucleus.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawParticles() {
    if (!showParticles) return;
    
    for (const particle of particles) {
      const alpha = Math.max(0.2, 1 - particle.age / 3);
      let color = "#fbbf24";
      let size = 3;
      
      if (particle.type === "alpha") {
        color = "#ef4444";
        size = 4;
      } else if (particle.type === "beta") {
        color = "#3b82f6";
        size = 2;
      } else if (particle.type === "gamma") {
        color = "#10b981";
        size = 1;
      }
      
      // Particle trail
      ctx.strokeStyle = color + Math.floor(alpha * 0.5 * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(particle.x - particle.vx * 0.01, particle.y - particle.vy * 0.01);
      ctx.lineTo(particle.x, particle.y);
      ctx.stroke();
      
      // Particle
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDecayGraph() {
    const graphX = W * 0.65;
    const graphY = H * 0.1;
    const graphW = W * 0.32;
    const graphH = H * 0.45;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Exponential Decay", graphX + graphW/2, graphY + 20);
    
    if (decayHistory.length > 1) {
      const maxTime = Math.max(...decayHistory.map(h => h.time));
      const minTime = 0;
      const timeRange = maxTime || 1;
      
      const axisX = graphX + 30;
      const axisY = graphY + graphH - 30;
      const plotW = graphW - 60;
      const plotH = graphH - 60;
      
      // Axes
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisX, graphY + 30);
      ctx.lineTo(axisX, axisY);
      ctx.lineTo(axisX + plotW, axisY);
      ctx.stroke();
      
      // Theoretical exponential curve
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      
      for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * timeRange;
        const N = initialNuclei * Math.exp(-currentIsotope.decayConstant * t);
        const x = axisX + (t / timeRange) * plotW;
        const y = axisY - (N / initialNuclei) * plotH;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Actual data
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < decayHistory.length; i++) {
        const point = decayHistory[i];
        const x = axisX + (point.time / timeRange) * plotW;
        const y = axisY - (point.remaining / initialNuclei) * plotH;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Half-life markers
      if (showHalfLife) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        for (let i = 0; i < halfLifeMarkers.length && halfLifeMarkers[i] <= timeRange; i++) {
          const x = axisX + (halfLifeMarkers[i] / timeRange) * plotW;
          ctx.beginPath();
          ctx.moveTo(x, graphY + 30);
          ctx.lineTo(x, axisY);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      
      // Labels
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Time", axisX + plotW/2, axisY + 25);
      
      ctx.save();
      ctx.translate(axisX - 20, graphY + 30 + plotH/2);
      ctx.rotate(-Math.PI/2);
      ctx.fillText("Nuclei Remaining", 0, 0);
      ctx.restore();
      
      // Legend
      ctx.fillStyle = "#fbbf24";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Theory", graphX + 5, graphY + 40);
      
      ctx.fillStyle = "#22d3ee";
      ctx.fillText("Simulation", graphX + 5, graphY + 55);
    }
  }

  function drawInfoPanel() {
    const panelX = W * 0.65;
    const panelY = H * 0.6;
    const panelW = W * 0.32;
    const panelH = H * 0.35;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    let infoY = panelY + 20;
    
    ctx.fillText("Nuclear Decay", panelX + 10, infoY);
    infoY += 20;
    
    // Isotope info
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px monospace";
    ctx.fillText(`Isotope: ${currentIsotope.name}`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Symbol: ${currentIsotope.symbol}`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Decay: ${currentIsotope.decayMode}`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Daughter: ${currentIsotope.daughterName}`, panelX + 10, infoY);
    infoY += 20;
    
    // Current stats
    const remaining = nuclei.filter(n => !n.decayed).length;
    const decayed = nuclei.length - remaining;
    const percentRemaining = (remaining / nuclei.length) * 100;
    
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`Remaining: ${remaining} (${percentRemaining.toFixed(1)}%)`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Decayed: ${decayed}`, panelX + 10, infoY);
    infoY += 16;
    
    // Half-life info
    ctx.fillStyle = "#10b981";
    ctx.fillText(`Half-life: ${currentIsotope.halfLife.toFixed(1)}s`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`λ = ${currentIsotope.decayConstant.toExponential(2)} s⁻¹`, panelX + 10, infoY);
    infoY += 20;
    
    // Equations
    ctx.fillStyle = "#8b5cf6";
    ctx.font = "10px monospace";
    ctx.fillText("Equations:", panelX + 10, infoY);
    infoY += 14;
    ctx.fillText("N(t) = N₀e^(-λt)", panelX + 10, infoY);
    infoY += 12;
    ctx.fillText("t₁/₂ = ln(2)/λ", panelX + 10, infoY);
    infoY += 12;
    ctx.fillText("Activity = λN", panelX + 10, infoY);
    infoY += 16;
    
    // Current activity
    const activity = currentIsotope.decayConstant * remaining;
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Activity: ${activity.toFixed(2)} decays/s`, panelX + 10, infoY);
  }

  function drawStats() {
    // Current statistics overlay
    const remaining = nuclei.filter(n => !n.decayed).length;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(10, 10, 200, 60);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 200, 60);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, 20, 30);
    ctx.fillText(`Remaining: ${remaining}/${nuclei.length}`, 20, 45);
    ctx.fillText(`Particles: ${particles.length}`, 20, 60);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeSimulation();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newIsotopeType = Math.round(Math.max(0, Math.min(4, params.isotopeType ?? isotopeType)));
      const newInitialNuclei = Math.round(Math.max(10, Math.min(200, params.initialNuclei ?? initialNuclei)));
      
      if (newIsotopeType !== isotopeType || newInitialNuclei !== initialNuclei) {
        isotopeType = newIsotopeType;
        initialNuclei = newInitialNuclei;
        initializeSimulation();
        time = 0;
      }
      
      timeScale = Math.max(0.1, Math.min(100, params.timeScale ?? timeScale));
      showParticles = Math.round(params.showParticles ?? showParticles);
      showHalfLife = Math.round(params.showHalfLife ?? showHalfLife);
      
      time += dt * timeScale;
      updateDecay(dt * timeScale);
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Nuclear Decay Simulation", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Radioactive decay and exponential laws", W / 2, 50);

      // Draw components
      drawNuclei();
      drawParticles();
      drawDecayGraph();
      drawInfoPanel();
      drawStats();

      // Show completion
      const remaining = nuclei.filter(n => !n.decayed).length;
      if (remaining === 0) {
        ctx.fillStyle = "#10b981";
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("All nuclei have decayed!", W / 2, H - 20);
      }
    },

    reset() {
      time = 0;
      initializeSimulation();
    },

    destroy() {},

    getStateDescription(): string {
      const remaining = nuclei.filter(n => !n.decayed).length;
      const decayed = nuclei.length - remaining;
      const activity = currentIsotope.decayConstant * remaining;
      
      return `Nuclear decay simulation: ${currentIsotope.name} (${currentIsotope.symbol}) with half-life ${currentIsotope.halfLife.toFixed(1)}s. ` +
             `${remaining}/${nuclei.length} nuclei remain undecayed after ${time.toFixed(1)}s. ` +
             `Decay mode: ${currentIsotope.decayMode} to ${currentIsotope.daughterName}. ` +
             `Current activity: ${activity.toFixed(2)} decays/s. ${particles.length} decay particles in flight. ` +
             `Demonstrates exponential decay law N(t) = N₀e^(-λt) and radioactive half-life.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default NuclearDecaySimulationFactory;