export type Category =
  | "physics"
  | "chemistry"
  | "electricity"
  | "astronomy"
  | "waves"
  | "math"
  | "biology"
  | "earth";

export interface SimulationParameter {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
}

export interface SimulationConfig {
  slug: string;
  title: string;
  category: Category;
  description: string;
  longDescription: string;
  parameters: SimulationParameter[];
  /** Hex color for thumbnail background */
  thumbnailColor: string;
  /** Icon emoji for display */
  icon: string;
}

export interface SimulationState {
  params: Record<string, number>;
  isRunning: boolean;
  time: number;
}

export interface SimulationEngine {
  config: SimulationConfig;
  /** Initialize the simulation on a canvas */
  init(canvas: HTMLCanvasElement): void;
  /** Update simulation state (called each frame) */
  update(dt: number, params: Record<string, number>): void;
  /** Render the current frame */
  render(): void;
  /** Reset simulation to initial state */
  reset(): void;
  /** Clean up resources */
  destroy(): void;
  /** Get current state description for AI tutor context */
  getStateDescription(): string;
  /** Handle canvas resize */
  resize(width: number, height: number): void;
}

export type SimulationFactory = () => SimulationEngine;
