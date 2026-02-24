import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

const SpringMassSystemFactory: SimulationFactory = () => {
  const config = getSimConfig("spring-mass-system") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

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
      time += dt;
    },

    render() {
      if (!ctx) return;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);
      
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Spring-Mass System", W/2, H/2);
    },

    reset() { time = 0; },
    destroy() {},
    getStateDescription(): string { return "Spring-mass system simulation"; },
    resize(width: number, height: number) { W = width; H = height; },
  };

  return engine;
};

export default SpringMassSystemFactory;