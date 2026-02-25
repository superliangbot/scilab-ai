import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const exoplanet_transitFactory: SimulationFactory = () => {
  const config = getSimConfig("exoplanet-transit")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  const engine: SimulationEngine = {
    config,
    init(c) { canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height; time = 0; },
    update(dt, params) { time += dt; },
    render() {
      ctx.fillStyle = "#0a0a1f"; ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 18px Arial"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
      ctx.fillText("exoplanet-transit Simulation", W/2, H/2);
    },
    reset() { time = 0; },
    destroy() {},
    getStateDescription() { return "exoplanet-transit simulation placeholder."; },
    resize(w, h) { W = w; H = h; }
  };
  return engine;
};

export default exoplanet_transitFactory;
