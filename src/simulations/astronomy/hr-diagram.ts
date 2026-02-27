import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const HRDiagramFactory: SimulationFactory = () => {
  const config = getSimConfig("hr-diagram")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let stellarClass = 5;      // 0=O, 1=B, 2=A, 3=F, 4=G, 5=K, 6=M
  let showEvolution = 1;     // Show evolutionary track
  let massFilter = 1.0;      // Solar masses filter
  let animateLifecycle = 1;  // Animate stellar lifecycle

  // Stellar data
  const stellarClasses = [
    { class: 'O', temp: 40000, color: '#9bb0ff', mass: 30, luminosity: 100000, lifetime: 5 },
    { class: 'B', temp: 20000, color: '#aabfff', mass: 15, luminosity: 10000, lifetime: 50 },
    { class: 'A', temp: 8500, color: '#cad7ff', mass: 2.5, luminosity: 50, lifetime: 500 },
    { class: 'F', temp: 6500, color: '#f8f7ff', mass: 1.3, luminosity: 3, lifetime: 3000 },
    { class: 'G', temp: 5500, color: '#fff4ea', mass: 1.0, luminosity: 1, lifetime: 10000 },
    { class: 'K', temp: 4000, color: '#ffd2a1', mass: 0.7, luminosity: 0.3, lifetime: 50000 },
    { class: 'M', temp: 2800, color: '#ffad51', mass: 0.3, luminosity: 0.01, lifetime: 1000000 }
  ];

  const mainSequenceStars = [
    ...stellarClasses,
    // Additional main sequence points
    { class: 'O9', temp: 33000, color: '#9bb0ff', mass: 20, luminosity: 30000, lifetime: 8 },
    { class: 'B5', temp: 15000, color: '#aabfff', mass: 6, luminosity: 800, lifetime: 100 },
    { class: 'A5', temp: 8000, color: '#cad7ff', mass: 2, luminosity: 20, lifetime: 800 },
    { class: 'F5', temp: 6000, color: '#f8f7ff', mass: 1.2, luminosity: 2, lifetime: 5000 },
    { class: 'G5', temp: 5200, color: '#fff4ea', mass: 0.9, luminosity: 0.7, lifetime: 15000 },
    { class: 'K5', temp: 3500, color: '#ffd2a1', mass: 0.6, luminosity: 0.1, lifetime: 100000 },
    { class: 'M5', temp: 2500, color: '#ffad51', mass: 0.2, luminosity: 0.001, lifetime: 10000000 }
  ];

  // Giant and other stellar types
  const redGiants = [
    { class: 'K III', temp: 4000, color: '#ff6b35', mass: 2, luminosity: 100, lifetime: 100 },
    { class: 'M III', temp: 3200, color: '#ff4500', mass: 1.5, luminosity: 1000, lifetime: 10 }
  ];

  const whiteDwarfs = [
    { class: 'DA', temp: 25000, color: '#ffffff', mass: 0.6, luminosity: 0.001, lifetime: 1000000 },
    { class: 'DB', temp: 15000, color: '#f0f8ff', mass: 0.6, luminosity: 0.0001, lifetime: 1000000 }
  ];

  const supergiants = [
    { class: 'B I', temp: 12000, color: '#87ceeb', mass: 25, luminosity: 100000, lifetime: 5 },
    { class: 'M I', temp: 3500, color: '#dc143c', mass: 20, luminosity: 100000, lifetime: 1 }
  ];

  let selectedStar: any = null;
  let evolutionTrack: Array<{ temp: number; luminosity: number; age: number }> = [];
  let currentEvolutionPhase = 0;

  function tempToX(temp: number): number {
    // Log scale, inverted (hotter stars on left)
    const logTemp = Math.log10(temp);
    const minLog = Math.log10(2000);  // Cool M dwarfs
    const maxLog = Math.log10(50000); // Hot O stars
    return W * 0.85 - ((logTemp - minLog) / (maxLog - minLog)) * (W * 0.7);
  }

  function luminosityToY(luminosity: number): number {
    // Log scale (brighter stars higher)
    const logLum = Math.log10(luminosity);
    const minLog = Math.log10(0.0001); // Dim white dwarfs
    const maxLog = Math.log10(1000000); // Bright supergiants
    return H * 0.9 - ((logLum - minLog) / (maxLog - minLog)) * (H * 0.7);
  }

  function createEvolutionTrack(mass: number) {
    evolutionTrack = [];
    
    if (mass < 0.8) {
      // Low mass stars - long main sequence, no giant phase
      evolutionTrack.push(
        { temp: 3500 - mass * 500, luminosity: mass * mass, age: 0 },
        { temp: 3500 - mass * 500, luminosity: mass * mass, age: mass * 100000 }
      );
    } else if (mass < 8) {
      // Solar mass stars - main sequence -> red giant -> white dwarf
      const msTemp = 5778 * Math.pow(mass, 0.5);
      const msLum = Math.pow(mass, 3.5);
      const msLifetime = 10000 / Math.pow(mass, 2.5);
      
      evolutionTrack.push(
        { temp: msTemp, luminosity: msLum, age: 0 },
        { temp: msTemp, luminosity: msLum, age: msLifetime * 0.9 },
        { temp: msTemp * 0.7, luminosity: msLum * 10, age: msLifetime * 0.95 },
        { temp: 3500, luminosity: msLum * 100, age: msLifetime },
        { temp: 25000, luminosity: 0.01, age: msLifetime * 1.1 },
        { temp: 8000, luminosity: 0.001, age: msLifetime * 10 }
      );
    } else {
      // Massive stars - main sequence -> supergiant -> neutron star/black hole
      const msTemp = 5778 * Math.pow(mass, 0.7);
      const msLum = Math.pow(mass, 3.5);
      const msLifetime = 10000 / Math.pow(mass, 2.5);
      
      evolutionTrack.push(
        { temp: msTemp, luminosity: msLum, age: 0 },
        { temp: msTemp, luminosity: msLum, age: msLifetime * 0.8 },
        { temp: 4000, luminosity: msLum * 1000, age: msLifetime * 0.9 },
        { temp: 3500, luminosity: msLum * 10000, age: msLifetime }
      );
    }
  }

  function getCurrentStar(): any {
    return stellarClasses[Math.floor(stellarClass) % stellarClasses.length];
  }

  function updateEvolution(dt: number) {
    if (animateLifecycle && evolutionTrack.length > 1) {
      currentEvolutionPhase += dt * 0.1; // Slow animation
      if (currentEvolutionPhase > evolutionTrack.length - 1) {
        currentEvolutionPhase = 0; // Loop
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
      
      selectedStar = getCurrentStar();
      createEvolutionTrack(selectedStar.mass);
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newStellarClass = Math.floor(params.stellarClass ?? stellarClass);
      showEvolution = Math.round(params.showEvolution ?? showEvolution);
      massFilter = params.massFilter ?? massFilter;
      animateLifecycle = Math.round(params.animateLifecycle ?? animateLifecycle);

      if (newStellarClass !== stellarClass) {
        stellarClass = newStellarClass;
        selectedStar = getCurrentStar();
        createEvolutionTrack(selectedStar.mass);
        currentEvolutionPhase = 0;
      }

      time += dt;
      updateEvolution(dt);
    },

    render() {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0a0a1f");
      gradient.addColorStop(1, "#1a1a3a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Hertzsprung-Russell Diagram", W / 2, 30);

      // Subtitle
      ctx.font = "12px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Stellar Classification by Temperature and Luminosity", W / 2, 50);

      // Axes
      const marginLeft = 80;
      const marginBottom = 80;
      const plotWidth = W * 0.7;
      const plotHeight = H * 0.7;

      // Y-axis (Luminosity)
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginLeft, 70);
      ctx.lineTo(marginLeft, H - marginBottom);
      ctx.stroke();

      // X-axis (Temperature)
      ctx.beginPath();
      ctx.moveTo(marginLeft, H - marginBottom);
      ctx.lineTo(W - 50, H - marginBottom);
      ctx.stroke();

      // Y-axis labels (Luminosity)
      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "right";
      
      const luminosityTicks = [0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000];
      for (const lum of luminosityTicks) {
        const y = luminosityToY(lum);
        if (y > 70 && y < H - marginBottom) {
          ctx.fillText(lum.toString(), marginLeft - 5, y + 3);
          
          // Grid lines
          ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(marginLeft, y);
          ctx.lineTo(W - 50, y);
          ctx.stroke();
        }
      }

      // X-axis labels (Temperature)
      ctx.textAlign = "center";
      const tempTicks = [50000, 30000, 20000, 10000, 8000, 6000, 5000, 4000, 3000, 2500];
      for (const temp of tempTicks) {
        const x = tempToX(temp);
        if (x > marginLeft && x < W - 50) {
          ctx.fillText(temp.toString(), x, H - marginBottom + 15);
          
          // Grid lines
          ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 70);
          ctx.lineTo(x, H - marginBottom);
          ctx.stroke();
        }
      }

      // Axis titles
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Temperature (K)", W / 2, H - 20);
      
      ctx.save();
      ctx.translate(20, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Luminosity (L☉)", 0, 0);
      ctx.restore();

      // Draw main sequence
      if (showEvolution) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const sortedMS = [...mainSequenceStars].sort((a, b) => b.temp - a.temp);
        for (let i = 0; i < sortedMS.length; i++) {
          const star = sortedMS[i];
          const x = tempToX(star.temp);
          const y = luminosityToY(star.luminosity);
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Main sequence label
        ctx.font = "bold 11px Arial";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "left";
        ctx.save();
        ctx.translate(300, 400);
        ctx.rotate(-0.5);
        ctx.fillText("Main Sequence", 0, 0);
        ctx.restore();
      }

      // Draw all stellar populations
      const allStars = [
        ...mainSequenceStars.filter(s => s.mass >= massFilter * 0.5 && s.mass <= massFilter * 1.5),
        ...redGiants,
        ...whiteDwarfs,
        ...supergiants
      ];

      for (const star of allStars) {
        const x = tempToX(star.temp);
        const y = luminosityToY(star.luminosity);
        
        if (x > marginLeft && x < W - 50 && y > 70 && y < H - marginBottom) {
          // Star size based on luminosity
          const radius = Math.max(2, Math.min(12, Math.log10(star.luminosity + 1) * 2));
          
          // Glow effect
          const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
          glowGradient.addColorStop(0, star.color + "AA");
          glowGradient.addColorStop(1, star.color + "00");
          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Star body
          ctx.fillStyle = star.color;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          
          // Highlight if selected
          if (star.class === selectedStar.class) {
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Draw evolution track for selected star
      if (showEvolution && evolutionTrack.length > 1) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        
        for (let i = 0; i < evolutionTrack.length; i++) {
          const point = evolutionTrack[i];
          const x = tempToX(point.temp);
          const y = luminosityToY(point.luminosity);
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Current evolution position
        if (animateLifecycle && currentEvolutionPhase < evolutionTrack.length - 1) {
          const currentIndex = Math.floor(currentEvolutionPhase);
          const nextIndex = Math.min(currentIndex + 1, evolutionTrack.length - 1);
          const t = currentEvolutionPhase - currentIndex;
          
          const current = evolutionTrack[currentIndex];
          const next = evolutionTrack[nextIndex];
          
          const interpTemp = current.temp + (next.temp - current.temp) * t;
          const interpLum = current.luminosity + (next.luminosity - current.luminosity) * t;
          
          const x = tempToX(interpTemp);
          const y = luminosityToY(interpLum);
          
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Stellar regions labels
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      
      // Red Giants region
      ctx.fillStyle = "rgba(220, 20, 60, 0.7)";
      ctx.fillText("Red Giants", 200, 150);
      
      // Supergiants region
      ctx.fillStyle = "rgba(255, 69, 0, 0.7)";
      ctx.fillText("Supergiants", 350, 100);
      
      // White Dwarfs region
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.fillText("White Dwarfs", 500, 450);

      // Selected star info panel
      const infoX = W - 200;
      const infoY = 70;
      const infoW = 180;
      const infoH = 200;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(infoX, infoY, infoW, infoH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(infoX, infoY, infoW, infoH);

      let textY = infoY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Selected Star", infoX + 10, textY);
      textY += 25;

      ctx.font = "12px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Class: ${selectedStar.class}`, infoX + 10, textY);
      textY += 18;
      ctx.fillText(`Temperature: ${selectedStar.temp.toLocaleString()}K`, infoX + 10, textY);
      textY += 18;
      ctx.fillText(`Luminosity: ${selectedStar.luminosity}L☉`, infoX + 10, textY);
      textY += 18;
      ctx.fillText(`Mass: ${selectedStar.mass}M☉`, infoX + 10, textY);
      textY += 18;
      ctx.fillText(`Lifetime: ${selectedStar.lifetime.toLocaleString()} Myr`, infoX + 10, textY);
      textY += 25;

      // Color sample
      ctx.fillStyle = selectedStar.color;
      ctx.fillRect(infoX + 10, textY, 30, 20);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.strokeRect(infoX + 10, textY, 30, 20);
      
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Color", infoX + 50, textY + 14);

      // Spectral class legend
      const legendX = 20;
      const legendY = H - 50;
      
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Spectral Classes:", legendX, legendY - 20);
      
      ctx.font = "11px Arial";
      stellarClasses.slice(0, 7).forEach((starClass, i) => {
        const x = legendX + i * 85;
        
        ctx.fillStyle = starClass.color;
        ctx.beginPath();
        ctx.arc(x + 10, legendY, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(`${starClass.class} (${starClass.temp}K)`, x + 20, legendY + 4);
      });

      // Evolution phase indicator
      if (animateLifecycle && showEvolution && evolutionTrack.length > 1) {
        const phaseNames = ["Main Sequence", "Subgiant", "Red Giant", "Asymptotic Giant", "White Dwarf", "Cool White Dwarf"];
        const currentPhaseIndex = Math.floor(currentEvolutionPhase);
        const phaseName = phaseNames[currentPhaseIndex] || "End State";
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "left";
        ctx.fillText(`Evolution Phase: ${phaseName}`, 20, 520);
        
        const totalAge = evolutionTrack[evolutionTrack.length - 1].age;
        const currentAge = evolutionTrack[Math.min(currentPhaseIndex, evolutionTrack.length - 1)].age;
        ctx.fillText(`Age: ${currentAge.toLocaleString()} / ${totalAge.toLocaleString()} Myr`, 20, 540);
      }
    },

    reset() {
      time = 0;
      currentEvolutionPhase = 0;
      selectedStar = getCurrentStar();
      createEvolutionTrack(selectedStar.mass);
    },

    destroy() {
      evolutionTrack = [];
    },

    getStateDescription(): string {
      const evolutionStatus = showEvolution ? 
        `showing evolutionary track with ${evolutionTrack.length} phases` : 
        "static stellar positions";
      
      const currentPhase = animateLifecycle && evolutionTrack.length > 1 ? 
        Math.floor(currentEvolutionPhase) + 1 : 1;

      return (
        `Hertzsprung-Russell diagram displaying stellar classification by temperature and luminosity. ` +
        `Selected star: ${selectedStar.class} class with temperature ${selectedStar.temp}K, ` +
        `luminosity ${selectedStar.luminosity}L☉, mass ${selectedStar.mass}M☉, ` +
        `and main sequence lifetime ${selectedStar.lifetime} million years. ` +
        `Mass filter: ${massFilter.toFixed(1)}M☉. ${evolutionStatus}. ` +
        `Current evolution phase: ${currentPhase}/${evolutionTrack.length}. ` +
        `The HR diagram reveals the relationship between stellar mass, temperature, and luminosity, ` +
        `with the main sequence representing hydrogen-burning stars.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default HRDiagramFactory;