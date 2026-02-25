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
  let stellarClass = 5;
  let showEvolution = 1;
  let massFilter = 1.0;
  let animateLifecycle = 1;

  const stellarClasses = [
    { class: 'O', temp: 40000, color: '#9bb0ff', mass: 30, luminosity: 100000 },
    { class: 'B', temp: 20000, color: '#aabfff', mass: 15, luminosity: 10000 },
    { class: 'A', temp: 8500, color: '#cad7ff', mass: 2.5, luminosity: 50 },
    { class: 'F', temp: 6500, color: '#f8f7ff', mass: 1.3, luminosity: 3 },
    { class: 'G', temp: 5500, color: '#fff4ea', mass: 1.0, luminosity: 1 },
    { class: 'K', temp: 4000, color: '#ffd2a1', mass: 0.7, luminosity: 0.3 },
    { class: 'M', temp: 2800, color: '#ffad51', mass: 0.3, luminosity: 0.01 }
  ];

  function tempToX(temp: number): number {
    const logTemp = Math.log10(temp);
    const minLog = Math.log10(2000);
    const maxLog = Math.log10(50000);
    return W * 0.85 - ((logTemp - minLog) / (maxLog - minLog)) * (W * 0.7);
  }

  function luminosityToY(luminosity: number): number {
    const logLum = Math.log10(luminosity);
    const minLog = Math.log10(0.0001);
    const maxLog = Math.log10(100000);
    return H * 0.9 - ((logLum - minLog) / (maxLog - minLog)) * (H * 0.7);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      stellarClass = Math.floor(params.stellarClass ?? stellarClass);
      showEvolution = Math.round(params.showEvolution ?? showEvolution);
      massFilter = params.massFilter ?? massFilter;
      animateLifecycle = Math.round(params.animateLifecycle ?? animateLifecycle);
      
      time += dt;
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

      // Axes
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 70);
      ctx.lineTo(80, H - 80);
      ctx.lineTo(W - 50, H - 80);
      ctx.stroke();

      // Axis labels
      ctx.font = "12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Temperature (K) →", W / 2, H - 20);
      
      ctx.save();
      ctx.translate(20, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Luminosity (L☉) →", 0, 0);
      ctx.restore();

      // Plot stellar classes
      stellarClasses.forEach((star, i) => {
        const x = tempToX(star.temp);
        const y = luminosityToY(star.luminosity);
        
        if (x > 80 && x < W - 50 && y > 70 && y < H - 80) {
          const radius = Math.max(3, Math.min(15, Math.log10(star.luminosity + 1) * 2));
          
          // Highlight selected star
          if (i === stellarClass) {
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          ctx.fillStyle = star.color;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          
          // Label
          ctx.font = "10px Arial";
          ctx.fillStyle = "#e2e8f0";
          ctx.textAlign = "center";
          ctx.fillText(star.class, x, y - radius - 8);
        }
      });

      // Main sequence line
      if (showEvolution) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const sortedStars = [...stellarClasses].sort((a, b) => b.temp - a.temp);
        sortedStars.forEach((star, i) => {
          const x = tempToX(star.temp);
          const y = luminosityToY(star.luminosity);
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        ctx.font = "12px Arial";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "left";
        ctx.fillText("Main Sequence", 300, 400);
      }

      // Selected star info
      const selectedStar = stellarClasses[stellarClass];
      if (selectedStar) {
        ctx.font = "14px Arial";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "left";
        ctx.fillText(`Selected: ${selectedStar.class} class star`, 20, H - 50);
        ctx.fillText(`T: ${selectedStar.temp}K, L: ${selectedStar.luminosity}L☉, M: ${selectedStar.mass}M☉`, 20, H - 30);
      }
    },

    reset() {
      time = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const selectedStar = stellarClasses[stellarClass];
      return `H-R Diagram showing stellar classification. Selected: ${selectedStar?.class} class star with temperature ${selectedStar?.temp}K, luminosity ${selectedStar?.luminosity}L☉.`;
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default HRDiagramFactory;