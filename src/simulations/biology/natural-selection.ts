import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const naturalSelectionFactory: SimulationFactory = () => {
  const config = getSimConfig("natural-selection")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let mutationRate = 0.1;
  let selectionPressure = 1;
  let environmentalChange = 0;
  let populationSize = 50;

  interface Organism {
    x: number; y: number;
    speed: number; // 0-1
    size: number; // 0-1
    camouflage: number; // 0-1
    fitness: number;
    alive: boolean;
    age: number;
  }

  let population: Organism[] = [];
  let generation = 0;
  let generationTimer = 0;
  const generationDuration = 4; // seconds

  // Stats history
  const avgSpeedHistory: number[] = [];
  const avgSizeHistory: number[] = [];
  const avgCamoHistory: number[] = [];
  const maxHistory = 60;

  function randomTrait(): number {
    return Math.max(0, Math.min(1, Math.random()));
  }

  function mutate(val: number): number {
    if (Math.random() < mutationRate) {
      return Math.max(0, Math.min(1, val + (Math.random() - 0.5) * 0.3));
    }
    return val;
  }

  function calcFitness(org: Organism): number {
    // Environmental change shifts optimal traits
    const optimalSpeed = 0.5 + environmentalChange * 0.3;
    const optimalSize = 0.5 - environmentalChange * 0.2;
    const optimalCamo = 0.5 + environmentalChange * 0.1;

    const speedFit = 1 - Math.abs(org.speed - optimalSpeed);
    const sizeFit = 1 - Math.abs(org.size - optimalSize);
    const camoFit = 1 - Math.abs(org.camouflage - optimalCamo);

    return (speedFit * 0.4 + sizeFit * 0.3 + camoFit * 0.3) * selectionPressure;
  }

  function initPopulation() {
    population = [];
    for (let i = 0; i < populationSize; i++) {
      const org: Organism = {
        x: Math.random() * W * 0.6 + W * 0.02,
        y: Math.random() * H * 0.45 + H * 0.08,
        speed: randomTrait(),
        size: randomTrait(),
        camouflage: randomTrait(),
        fitness: 0,
        alive: true,
        age: 0,
      };
      org.fitness = calcFitness(org);
      population.push(org);
    }
  }

  function reproduce() {
    // Selection: fitness-proportional
    const alive = population.filter(o => o.alive);
    if (alive.length < 2) { initPopulation(); return; }

    alive.sort((a, b) => b.fitness - a.fitness);

    const newPop: Organism[] = [];
    const targetSize = Math.floor(populationSize);

    for (let i = 0; i < targetSize; i++) {
      // Tournament selection
      const p1 = alive[Math.floor(Math.random() * Math.min(alive.length, Math.ceil(alive.length * 0.6)))];
      const p2 = alive[Math.floor(Math.random() * alive.length)];
      const parent = p1.fitness > p2.fitness ? p1 : p2;

      const child: Organism = {
        x: Math.random() * W * 0.6 + W * 0.02,
        y: Math.random() * H * 0.45 + H * 0.08,
        speed: mutate(parent.speed),
        size: mutate(parent.size),
        camouflage: mutate(parent.camouflage),
        fitness: 0,
        alive: true,
        age: 0,
      };
      child.fitness = calcFitness(child);
      newPop.push(child);
    }

    population = newPop;
    generation++;

    // Record stats
    const avgSpeed = population.reduce((s, o) => s + o.speed, 0) / population.length;
    const avgSize = population.reduce((s, o) => s + o.size, 0) / population.length;
    const avgCamo = population.reduce((s, o) => s + o.camouflage, 0) / population.length;
    avgSpeedHistory.push(avgSpeed);
    avgSizeHistory.push(avgSize);
    avgCamoHistory.push(avgCamo);
    if (avgSpeedHistory.length > maxHistory) {
      avgSpeedHistory.shift();
      avgSizeHistory.shift();
      avgCamoHistory.shift();
    }
  }

  function drawEnvironment() {
    // Background color shifts with environmental change
    const envHue = 120 + environmentalChange * 60;
    const bgColor = `hsl(${envHue}, 20%, 12%)`;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, H * 0.05, W * 0.65, H * 0.55);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, H * 0.05, W * 0.65, H * 0.55);

    // Ground
    ctx.fillStyle = `hsl(${envHue}, 30%, 18%)`;
    ctx.fillRect(0, H * 0.45, W * 0.65, H * 0.15);
  }

  function drawOrganism(org: Organism) {
    if (!org.alive) return;
    const r = 4 + org.size * 10;

    // Color based on traits: speed=red, size=green, camouflage=blue
    const red = Math.floor(100 + org.speed * 155);
    const green = Math.floor(100 + org.size * 155);
    const blue = Math.floor(100 + org.camouflage * 155);

    // Camouflage = more transparent
    const alpha = 1 - org.camouflage * 0.6;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
    ctx.beginPath();
    ctx.arc(org.x, org.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Fitness indicator ring
    ctx.strokeStyle = org.fitness > 0.6 ? "#22c55e" : org.fitness > 0.3 ? "#f59e0b" : "#ef4444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(org.x, org.y, r + 2, 0, Math.PI * 2 * org.fitness);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawStats() {
    const px = W * 0.67, py = H * 0.05, pw = W * 0.31, ph = H * 0.55;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText(`Generation: ${generation}`, px + 10, py + 20);

    const avgFit = population.length > 0 ? population.reduce((s, o) => s + o.fitness, 0) / population.length : 0;
    ctx.font = "12px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Population: ${population.filter(o => o.alive).length}`, px + 10, py + 40);
    ctx.fillText(`Avg Fitness: ${avgFit.toFixed(3)}`, px + 10, py + 58);
    ctx.fillText(`Mutation Rate: ${(mutationRate * 100).toFixed(0)}%`, px + 10, py + 76);

    // Average traits
    const avgSpeed = population.reduce((s, o) => s + o.speed, 0) / Math.max(1, population.length);
    const avgSize = population.reduce((s, o) => s + o.size, 0) / Math.max(1, population.length);
    const avgCamo = population.reduce((s, o) => s + o.camouflage, 0) / Math.max(1, population.length);

    ctx.fillText("Average Traits:", px + 10, py + 100);

    // Trait bars
    const traits = [
      { name: "Speed", val: avgSpeed, color: "#ef4444" },
      { name: "Size", val: avgSize, color: "#22c55e" },
      { name: "Camouflage", val: avgCamo, color: "#3b82f6" },
    ];

    for (let i = 0; i < traits.length; i++) {
      const ty = py + 118 + i * 24;
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Arial";
      ctx.fillText(traits[i].name, px + 10, ty);
      // Bar background
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(px + 85, ty - 10, pw - 100, 14);
      // Bar fill
      ctx.fillStyle = traits[i].color;
      ctx.fillRect(px + 85, ty - 10, (pw - 100) * traits[i].val, 14);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "10px Arial";
      ctx.fillText(traits[i].val.toFixed(2), px + pw - 35, ty);
    }

    // Trait history graph
    if (avgSpeedHistory.length > 1) {
      const graphY = py + 200;
      const graphH = ph - 210;

      ctx.font = "10px Arial";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Trait Evolution Over Generations", px + 10, graphY);

      const drawLine = (history: number[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < history.length; i++) {
          const gx2 = px + 10 + (i / maxHistory) * (pw - 20);
          const gy2 = graphY + 15 + (1 - history[i]) * (graphH - 20);
          if (i === 0) ctx.moveTo(gx2, gy2);
          else ctx.lineTo(gx2, gy2);
        }
        ctx.stroke();
      };

      drawLine(avgSpeedHistory, "#ef4444");
      drawLine(avgSizeHistory, "#22c55e");
      drawLine(avgCamoHistory, "#3b82f6");
    }
  }

  function drawInfo() {
    const py = H * 0.62, ph = H * 0.35;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(W * 0.02, py, W * 0.96, ph);
    ctx.strokeRect(W * 0.02, py, W * 0.96, ph);

    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Natural Selection — Key Concepts", W * 0.04, py + 20);

    ctx.font = "11px Arial";
    ctx.fillStyle = "#94a3b8";
    const y0 = py + 40;
    ctx.fillText("• Variation: Organisms differ in traits (speed, size, camouflage)", W * 0.04, y0);
    ctx.fillText("• Selection: Traits affecting survival determine fitness (closer to optimum = higher fitness)", W * 0.04, y0 + 16);
    ctx.fillText("• Inheritance: Offspring inherit traits from fitter parents (tournament selection)", W * 0.04, y0 + 32);
    ctx.fillText("• Mutation: Random changes introduce new variation (rate controlled by parameter)", W * 0.04, y0 + 48);

    ctx.fillStyle = "#64748b";
    ctx.fillText(`Environmental change (${environmentalChange > 0 ? "+" : ""}${environmentalChange.toFixed(1)}) shifts optimal trait values, driving adaptation.`, W * 0.04, y0 + 72);
    ctx.fillText("Fitness = weighted distance from optimal traits × selection pressure. Higher fitness → more likely to reproduce.", W * 0.04, y0 + 88);

    // Generation timer
    const progress = generationTimer / generationDuration;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(W * 0.04, py + ph - 18, W * 0.92, 10);
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(W * 0.04, py + ph - 18, W * 0.92 * progress, 10);
    ctx.font = "9px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(`Next generation in ${(generationDuration - generationTimer).toFixed(1)}s`, W / 2, py + ph - 8);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height;
      time = 0; generation = 0; generationTimer = 0;
      avgSpeedHistory.length = 0; avgSizeHistory.length = 0; avgCamoHistory.length = 0;
      initPopulation();
    },
    update(dt, params) {
      mutationRate = params.mutationRate ?? mutationRate;
      selectionPressure = params.selectionPressure ?? selectionPressure;
      environmentalChange = params.environmentalChange ?? environmentalChange;
      populationSize = params.populationSize ?? populationSize;
      time += dt;
      generationTimer += dt;

      // Animate organisms
      for (const org of population) {
        if (!org.alive) continue;
        org.x += (Math.random() - 0.5) * org.speed * 30 * dt;
        org.y += (Math.random() - 0.5) * org.speed * 20 * dt;
        org.x = Math.max(5, Math.min(W * 0.63, org.x));
        org.y = Math.max(H * 0.08, Math.min(H * 0.55, org.y));
        org.fitness = calcFitness(org);
        org.age += dt;
      }

      // Natural death (low fitness)
      for (const org of population) {
        if (org.alive && org.fitness < 0.2 && Math.random() < dt * 0.3 * selectionPressure) {
          org.alive = false;
        }
      }

      if (generationTimer >= generationDuration) {
        reproduce();
        generationTimer = 0;
      }
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Natural Selection", W / 2, 28);

      drawEnvironment();
      for (const org of population) drawOrganism(org);
      drawStats();
      drawInfo();
    },
    reset() {
      time = 0; generation = 0; generationTimer = 0;
      avgSpeedHistory.length = 0; avgSizeHistory.length = 0; avgCamoHistory.length = 0;
      initPopulation();
    },
    destroy() {},
    getStateDescription() {
      const avgFit = population.reduce((s, o) => s + o.fitness, 0) / Math.max(1, population.length);
      const avgSpeed = population.reduce((s, o) => s + o.speed, 0) / Math.max(1, population.length);
      return `Natural selection: generation ${generation}, population ${population.filter(o => o.alive).length}. Average fitness: ${avgFit.toFixed(3)}, average speed: ${avgSpeed.toFixed(2)}. Mutation rate: ${(mutationRate * 100).toFixed(0)}%, selection pressure: ${selectionPressure.toFixed(1)}×, environmental change: ${environmentalChange.toFixed(1)}.`;
    },
    resize(w, h) { W = w; H = h; },
  };
  return engine;
};

export default naturalSelectionFactory;
