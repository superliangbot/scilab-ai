import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Nuclear data ─────────────────────────────────────────────────────
interface Nuclide {
  symbol: string;
  name: string;
  halfLife: number; // seconds
  decayConstant: number; // λ = ln(2)/t_half
  decayMode: "alpha" | "beta-" | "beta+" | "gamma";
  daughter: string;
  color: string;
  description: string;
}

const NUCLIDES: Nuclide[] = [
  {
    symbol: "¹⁴C",
    name: "Carbon-14",
    halfLife: 5730 * 365.25 * 24 * 3600, // 5730 years in seconds
    decayConstant: 0,
    decayMode: "beta-",
    daughter: "¹⁴N",
    color: "#10b981",
    description: "Used in radiocarbon dating"
  },
  {
    symbol: "²³⁸U",
    name: "Uranium-238", 
    halfLife: 4.468e9 * 365.25 * 24 * 3600, // 4.468 billion years
    decayConstant: 0,
    decayMode: "alpha",
    daughter: "²³⁴Th",
    color: "#f59e0b",
    description: "Most common uranium isotope"
  },
  {
    symbol: "³H",
    name: "Tritium",
    halfLife: 12.32 * 365.25 * 24 * 3600, // 12.32 years
    decayConstant: 0,
    decayMode: "beta-", 
    daughter: "³He",
    color: "#3b82f6",
    description: "Radioactive hydrogen isotope"
  },
  {
    symbol: "²²⁶Ra",
    name: "Radium-226",
    halfLife: 1600 * 365.25 * 24 * 3600, // 1600 years
    decayConstant: 0,
    decayMode: "alpha",
    daughter: "²²²Rn",
    color: "#ef4444",
    description: "Historical radioactivity research"
  },
  {
    symbol: "⁹⁹ᵐTc",
    name: "Technetium-99m",
    halfLife: 6.01 * 3600, // 6.01 hours
    decayConstant: 0,
    decayMode: "gamma",
    daughter: "⁹⁹Tc",
    color: "#8b5cf6",
    description: "Medical imaging isotope"
  }
];

// Calculate decay constants
for (const nuclide of NUCLIDES) {
  nuclide.decayConstant = Math.log(2) / nuclide.halfLife;
}

// ─── Particle representing individual nucleus ────────────────────────
interface Nucleus {
  x: number;
  y: number;
  decayed: boolean;
  decayTime: number;
  energy: number; // for animation
  phase: number; // for oscillation
}

// ─── Decay event ─────────────────────────────────────────────────────
interface DecayEvent {
  time: number;
  x: number;
  y: number;
  type: "alpha" | "beta-" | "beta+" | "gamma";
  intensity: number;
}

// ─── Factory ─────────────────────────────────────────────────────────
const NuclearDecayFactory: SimulationFactory = () => {
  const config = getSimConfig("nuclear-decay-simulation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let nuclideType = 0;
  let initialNuclei = 100;
  let timeScale = 1;
  let showStatistics = 1;
  let showDecayEvents = 1;

  // Simulation state
  let nuclei: Nucleus[] = [];
  let decayEvents: DecayEvent[] = [];
  let currentNuclide: Nuclide;
  let startTime = 0;
  let totalDecayed = 0;

  // Statistics for plotting
  let dataPoints: Array<{ time: number; remaining: number; theoretical: number }> = [];
  let lastDataTime = 0;

  // ── Helper functions ─────────────────────────────────────────────────
  function initializeNuclei(): void {
    nuclei = [];
    decayEvents = [];
    totalDecayed = 0;
    dataPoints = [];
    lastDataTime = 0;
    startTime = time;

    // Create nuclei in a grid pattern
    const containerX = W * 0.05;
    const containerY = H * 0.15;
    const containerW = W * 0.55;
    const containerH = H * 0.55;

    const cols = Math.ceil(Math.sqrt(initialNuclei));
    const rows = Math.ceil(initialNuclei / cols);
    const dx = containerW / cols;
    const dy = containerH / rows;

    for (let i = 0; i < initialNuclei; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      nuclei.push({
        x: containerX + (col + 0.5) * dx + (Math.random() - 0.5) * dx * 0.3,
        y: containerY + (row + 0.5) * dy + (Math.random() - 0.5) * dy * 0.3,
        decayed: false,
        decayTime: -1,
        energy: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function updateDecay(dt: number): void {
    const elapsedTime = (time - startTime) * timeScale;
    const lambda = currentNuclide.decayConstant * timeScale;
    
    // Check each nucleus for decay based on probability
    for (const nucleus of nuclei) {
      if (nucleus.decayed) continue;
      
      // Probability of decay in time dt: P = λ * dt
      const decayProb = lambda * dt;
      
      if (Math.random() < decayProb) {
        nucleus.decayed = true;
        nucleus.decayTime = elapsedTime;
        totalDecayed++;
        
        // Create decay event for animation
        if (showDecayEvents) {
          decayEvents.push({
            time,
            x: nucleus.x,
            y: nucleus.y,
            type: currentNuclide.decayMode,
            intensity: 1.0
          });
        }
      }
    }
    
    // Update decay events (fade them out)
    for (let i = decayEvents.length - 1; i >= 0; i--) {
      const event = decayEvents[i];
      event.intensity -= dt * 2; // Fade over 0.5 seconds
      if (event.intensity <= 0) {
        decayEvents.splice(i, 1);
      }
    }
    
    // Record data points for plotting
    if (elapsedTime - lastDataTime >= 0.1 / timeScale) {
      const remaining = nuclei.filter(n => !n.decayed).length;
      const theoretical = initialNuclei * Math.exp(-lambda * elapsedTime);
      
      dataPoints.push({
        time: elapsedTime,
        remaining,
        theoretical
      });
      
      // Keep only recent data to prevent memory buildup
      if (dataPoints.length > 500) {
        dataPoints.shift();
      }
      
      lastDataTime = elapsedTime;
    }
  }

  function drawNuclei(): void {
    const radius = Math.max(2, Math.min(8, 400 / Math.sqrt(initialNuclei)));
    
    for (const nucleus of nuclei) {
      if (nucleus.decayed) {
        // Decayed nucleus - smaller, grayed out
        ctx.beginPath();
        ctx.arc(nucleus.x, nucleus.y, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 100, 100, 0.3)";
        ctx.fill();
      } else {
        // Active nucleus - pulsing animation
        const pulse = 0.9 + 0.1 * Math.sin(time * 3 + nucleus.phase);
        const glowRadius = radius * 1.5 * pulse;
        
        // Glow effect
        const glow = ctx.createRadialGradient(
          nucleus.x, nucleus.y, 0,
          nucleus.x, nucleus.y, glowRadius
        );
        glow.addColorStop(0, currentNuclide.color + "80");
        glow.addColorStop(0.7, currentNuclide.color + "30");
        glow.addColorStop(1, currentNuclide.color + "00");
        
        ctx.beginPath();
        ctx.arc(nucleus.x, nucleus.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        
        // Core nucleus
        ctx.beginPath();
        ctx.arc(nucleus.x, nucleus.y, radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = currentNuclide.color;
        ctx.fill();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  function drawDecayEvents(): void {
    if (!showDecayEvents) return;
    
    for (const event of decayEvents) {
      const alpha = event.intensity;
      const size = (1 - event.intensity) * 20;
      
      if (event.type === "alpha") {
        // Alpha particle - helium nucleus
        ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
        ctx.beginPath();
        ctx.arc(event.x + size, event.y - size, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = "10px monospace";
        ctx.fillText("α", event.x + size + 5, event.y - size + 3);
        
      } else if (event.type === "beta-") {
        // Beta minus - electron
        ctx.strokeStyle = `rgba(100, 150, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(event.x, event.y);
        ctx.lineTo(event.x + size * 1.5, event.y + size * 0.5);
        ctx.stroke();
        
        ctx.font = "10px monospace";
        ctx.fillStyle = `rgba(100, 150, 255, ${alpha})`;
        ctx.fillText("β⁻", event.x + size * 1.5 + 3, event.y + size * 0.5 + 3);
        
      } else if (event.type === "gamma") {
        // Gamma ray - electromagnetic radiation
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2 + time * 5;
          const length = size * 1.2;
          ctx.strokeStyle = `rgba(200, 50, 255, ${alpha * 0.7})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(event.x, event.y);
          ctx.lineTo(
            event.x + Math.cos(angle) * length,
            event.y + Math.sin(angle) * length
          );
          ctx.stroke();
        }
        
        ctx.font = "10px monospace";
        ctx.fillStyle = `rgba(200, 50, 255, ${alpha})`;
        ctx.fillText("γ", event.x + size + 5, event.y + 5);
      }
    }
  }

  function drawStatistics(): void {
    if (!showStatistics) return;
    
    // Statistics panel
    const panelX = W * 0.62;
    const panelY = H * 0.02;
    const panelW = W * 0.36;
    const panelH = H * 0.96;
    
    ctx.fillStyle = "rgba(15, 20, 40, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    let y = panelY + 25;
    const leftX = panelX + 10;
    
    // Title
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Nuclear Decay Statistics", leftX, y);
    y += 25;
    
    // Current status
    const remaining = nuclei.filter(n => !n.decayed).length;
    const elapsedTime = (time - startTime) * timeScale;
    const halfLives = elapsedTime / currentNuclide.halfLife;
    const theoretical = initialNuclei * Math.exp(-currentNuclide.decayConstant * elapsedTime);
    
    ctx.font = "12px monospace";
    
    ctx.fillStyle = currentNuclide.color;
    ctx.fillText(`Isotope: ${currentNuclide.symbol} (${currentNuclide.name})`, leftX, y);
    y += 18;
    
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Decay mode: ${currentNuclide.decayMode} → ${currentNuclide.daughter}`, leftX, y);
    y += 18;
    
    ctx.fillText(`Half-life: ${formatTime(currentNuclide.halfLife)}`, leftX, y);
    y += 25;
    
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`Time elapsed: ${formatTime(elapsedTime)}`, leftX, y);
    y += 18;
    
    ctx.fillText(`Half-lives: ${halfLives.toFixed(2)}`, leftX, y);
    y += 25;
    
    ctx.fillStyle = "#10b981";
    ctx.fillText(`Remaining: ${remaining}/${initialNuclei}`, leftX, y);
    y += 18;
    
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`Decayed: ${totalDecayed} (${(100 * totalDecayed / initialNuclei).toFixed(1)}%)`, leftX, y);
    y += 18;
    
    ctx.fillStyle = "#64748b";
    ctx.fillText(`Theoretical: ${theoretical.toFixed(1)}`, leftX, y);
    y += 30;
    
    // Decay equation
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Decay Law:", leftX, y);
    y += 20;
    
    ctx.font = "11px monospace";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("N(t) = N₀ × e^(-λt)", leftX, y);
    y += 16;
    ctx.fillText("t½ = ln(2)/λ", leftX, y);
    y += 16;
    ctx.fillText(`λ = ${currentNuclide.decayConstant.toExponential(3)} s⁻¹`, leftX, y);
    y += 25;
    
    // Decay plot
    if (dataPoints.length > 1) {
      drawDecayPlot(leftX, y, panelW - 20, Math.min(200, panelH - y + panelY - 10));
    }
  }

  function drawDecayPlot(x: number, y: number, width: number, height: number): void {
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    ctx.font = "10px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Decay Curve", x + width/2, y - 5);
    
    if (dataPoints.length < 2) return;
    
    const maxTime = Math.max(...dataPoints.map(d => d.time));
    const maxN = initialNuclei;
    
    // Theoretical curve
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i];
      const px = x + (point.time / maxTime) * width;
      const py = y + height - (point.theoretical / maxN) * height;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Actual data
    ctx.strokeStyle = currentNuclide.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i];
      const px = x + (point.time / maxTime) * width;
      const py = y + height - (point.remaining / maxN) * height;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    
    // Axes labels
    ctx.font = "8px monospace";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText("0", x - 5, y + height + 10);
    ctx.fillText(`${formatTime(maxTime)}`, x + width - 20, y + height + 10);
    
    ctx.save();
    ctx.translate(x - 15, y + height/2);
    ctx.rotate(-Math.PI/2);
    ctx.textAlign = "center";
    ctx.fillText("Nuclei", 0, 0);
    ctx.restore();
    
    ctx.textAlign = "center";
    ctx.fillText("Time", x + width/2, y + height + 20);
  }

  function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds/60).toFixed(1)}min`;
    if (seconds < 86400) return `${(seconds/3600).toFixed(1)}h`;
    if (seconds < 31557600) return `${(seconds/86400).toFixed(1)}d`;
    return `${(seconds/31557600).toFixed(1)}y`;
  }

  function drawTitle(): void {
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Nuclear Decay Simulation", W / 2, 25);
    
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Exponential decay law: N(t) = N₀e^(-λt) | Half-life: t½ = ln(2)/λ", W / 2, 45);
  }

  // ── Engine implementation ───────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      currentNuclide = NUCLIDES[nuclideType];
      initializeNuclei();
    },

    update(dt: number, params: Record<string, number>) {
      const newNuclideType = Math.round(Math.max(0, Math.min(NUCLIDES.length - 1, params.nuclideType ?? nuclideType)));
      const newInitialNuclei = Math.round(Math.max(10, Math.min(500, params.initialNuclei ?? initialNuclei)));
      
      if (newNuclideType !== nuclideType || newInitialNuclei !== initialNuclei) {
        nuclideType = newNuclideType;
        initialNuclei = newInitialNuclei;
        currentNuclide = NUCLIDES[nuclideType];
        initializeNuclei();
      }
      
      timeScale = Math.max(0.1, Math.min(100, params.timeScale ?? timeScale));
      showStatistics = Math.round(params.showStatistics ?? showStatistics);
      showDecayEvents = Math.round(params.showDecayEvents ?? showDecayEvents);
      
      time += dt;
      updateDecay(dt);
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      drawTitle();
      drawNuclei();
      drawDecayEvents();
      drawStatistics();
    },

    reset() {
      time = 0;
      initializeNuclei();
    },

    destroy() {
      nuclei = [];
      decayEvents = [];
      dataPoints = [];
    },

    getStateDescription(): string {
      const remaining = nuclei.filter(n => !n.decayed).length;
      const elapsedTime = (time - startTime) * timeScale;
      const halfLives = elapsedTime / currentNuclide.halfLife;
      
      return `Nuclear decay simulation of ${currentNuclide.symbol} (${currentNuclide.name}). ` +
             `Half-life: ${formatTime(currentNuclide.halfLife)}. Decay constant: λ = ${currentNuclide.decayConstant.toExponential(3)} s⁻¹. ` +
             `Time elapsed: ${formatTime(elapsedTime)} (${halfLives.toFixed(2)} half-lives). ` +
             `Remaining nuclei: ${remaining}/${initialNuclei} (${(100 * remaining / initialNuclei).toFixed(1)}%). ` +
             `Decay mode: ${currentNuclide.decayMode} → ${currentNuclide.daughter}. ` +
             `Follows exponential decay law: N(t) = N₀e^(-λt).`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default NuclearDecayFactory;