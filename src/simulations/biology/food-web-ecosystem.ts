import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const FoodWebEcosystemFactory: SimulationFactory = () => {
  const config = getSimConfig("food-web-ecosystem")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let primaryProductivity = 1.0;
  let carryingCapacity = 100;
  let predationEfficiency = 0.5;
  let showEnergyFlow = 1;

  // Simple trophic levels
  let producers = 100;
  let primaryConsumers = 50;
  let secondaryConsumers = 25;
  let tertiaryConsumers = 10;

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
      primaryProductivity = params.primaryProductivity ?? primaryProductivity;
      carryingCapacity = params.carryingCapacity ?? carryingCapacity;
      predationEfficiency = params.predationEfficiency ?? predationEfficiency;
      showEnergyFlow = Math.round(params.showEnergyFlow ?? showEnergyFlow);
      
      time += dt;
      
      // Simple ecosystem dynamics
      producers *= (1 + primaryProductivity * 0.01 * dt);
      primaryConsumers = Math.min(producers * 0.1, primaryConsumers * (1 + 0.005 * dt));
      secondaryConsumers = Math.min(primaryConsumers * 0.1, secondaryConsumers * (1 + 0.003 * dt));
      tertiaryConsumers = Math.min(secondaryConsumers * 0.1, tertiaryConsumers * (1 + 0.001 * dt));
      
      // Apply carrying capacity
      producers = Math.min(producers, carryingCapacity * 2);
    },

    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Food Web Ecosystem", W / 2, 30);

      // Draw trophic levels as bars
      const barWidth = 60;
      const levels = [
        { name: "Producers", count: producers, color: "#22c55e", y: H - 100 },
        { name: "Primary", count: primaryConsumers, color: "#f59e0b", y: H - 200 },
        { name: "Secondary", count: secondaryConsumers, color: "#ef4444", y: H - 300 },
        { name: "Tertiary", count: tertiaryConsumers, color: "#8b5cf6", y: H - 400 }
      ];

      levels.forEach((level, i) => {
        const x = W / 2 + (i - 1.5) * 120;
        const height = Math.min(level.count * 2, 150);
        
        ctx.fillStyle = level.color;
        ctx.fillRect(x - barWidth/2, level.y, barWidth, height);
        
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(level.name, x, level.y - 10);
        ctx.fillText(Math.round(level.count).toString(), x, level.y + height + 20);
      });

      // Show energy flow arrows if enabled
      if (showEnergyFlow) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        
        for (let i = 0; i < levels.length - 1; i++) {
          const fromX = W / 2 + (i - 1.5) * 120;
          const toX = W / 2 + (i + 1 - 1.5) * 120;
          const y = H - 250;
          
          ctx.beginPath();
          ctx.moveTo(fromX + 30, y);
          ctx.lineTo(toX - 30, y);
          ctx.stroke();
          
          // Arrowhead
          ctx.beginPath();
          ctx.moveTo(toX - 30, y);
          ctx.lineTo(toX - 40, y - 5);
          ctx.lineTo(toX - 40, y + 5);
          ctx.closePath();
          ctx.fill();
        }
      }
    },

    reset() {
      time = 0;
      producers = 100;
      primaryConsumers = 50;
      secondaryConsumers = 25;
      tertiaryConsumers = 10;
    },

    destroy() {},

    getStateDescription(): string {
      return `Food Web Ecosystem with ${Math.round(producers)} producers, ${Math.round(primaryConsumers)} primary consumers, ${Math.round(secondaryConsumers)} secondary consumers, ${Math.round(tertiaryConsumers)} tertiary consumers.`;
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default FoodWebEcosystemFactory;