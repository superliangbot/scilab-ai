import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const Factory: SimulationFactory = () => {
  const config = getSimConfig("rolling-motion-dynamics") as SimulationConfig;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) { canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height; },
    update(dt: number, params: Record<string, number>) { time += dt; },
    render() { 
      if (!ctx) return;
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e2e8f0"; ctx.font = "20px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Rolling Motion Dynamics", W/2, H/2);
    },
    reset() { time = 0; },
    destroy() {},
    getStateDescription(): string { return "Rolling Motion Dynamics simulation"; },
    resize(w: number, h: number) { W = w; H = h; },
  };
  return engine;
};
export default Factory;
