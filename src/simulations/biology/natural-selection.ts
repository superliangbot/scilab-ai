import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const PLACEHOLDER_SLUG = "natural-selection";

const PlaceholderFactory: SimulationFactory = () => {
  const config = getSimConfig(PLACEHOLDER_SLUG.replace("PLACEHOLDER", "natural-selection"))!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  const engine: SimulationEngine = {
    config,
    init(c) { canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height; time = 0; },
    update(dt, params) { time += dt; },
    render() {
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 18px Arial"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
      ctx.fillText("natural-selection Simulation", W/2, H/2);
    },
    reset() { time = 0; },
    destroy() {},
    getStateDescription() { return "natural-selection simulation placeholder."; },
    resize(w, h) { W = w; H = h; }
  };
  return engine;
};

export default PlaceholderFactory;
