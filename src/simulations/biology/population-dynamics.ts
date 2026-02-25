import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const PopulationDynamicsFactory: SimulationFactory = () => {
  const config = getSimConfig("population-dynamics")!;
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800, H = 600, time = 0;
  
  // Lotka-Volterra parameters
  let preyGrowthRate = 0.8, predationRate = 0.4, predatorEfficiency = 0.3, predatorDeathRate = 0.5;
  let preyPop = 40, predatorPop = 20;

  const engine: SimulationEngine = {
    config,
    init(c) { canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height; time = 0; },
    update(dt, params) {
      preyGrowthRate = params.preyGrowthRate ?? preyGrowthRate;
      predationRate = params.predationRate ?? predationRate;
      predatorEfficiency = params.predatorEfficiency ?? predatorEfficiency;
      predatorDeathRate = params.predatorDeathRate ?? predatorDeathRate;
      time += dt;
      
      // Lotka-Volterra equations: dN/dt = αN - βNP, dP/dt = δβNP - γP
      const dN_dt = preyGrowthRate * preyPop - predationRate * preyPop * predatorPop;
      const dP_dt = predatorEfficiency * predationRate * preyPop * predatorPop - predatorDeathRate * predatorPop;
      preyPop = Math.max(0, preyPop + dN_dt * dt);
      predatorPop = Math.max(0, predatorPop + dP_dt * dt);
    },
    render() {
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 18px Arial"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
      ctx.fillText("Population Dynamics: Lotka-Volterra Model", W/2, 30);
      
      ctx.font = "16px Arial"; ctx.textAlign = "left";
      ctx.fillStyle = "#3b82f6"; ctx.fillText(`Prey Population: ${preyPop.toFixed(1)}`, 20, H-60);
      ctx.fillStyle = "#ef4444"; ctx.fillText(`Predator Population: ${predatorPop.toFixed(1)}`, 20, H-40);
      ctx.fillStyle = "#94a3b8"; ctx.fillText("Equations: dN/dt = αN - βNP, dP/dt = δβNP - γP", 20, H-20);
    },
    reset() { time = 0; preyPop = 40; predatorPop = 20; },
    destroy() {},
    getStateDescription() { return `Predator-prey dynamics: ${preyPop.toFixed(1)} prey, ${predatorPop.toFixed(1)} predators.`; },
    resize(w, h) { W = w; H = h; }
  };
  return engine;
};

export default PopulationDynamicsFactory;