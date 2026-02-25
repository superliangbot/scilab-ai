import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Individual in the population ──────────────────────────────────────
interface Individual {
  chromosome: boolean[]; // Binary chromosome
  fitness: number;
  x: number; // For visualization
  y: number;
  generation: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const GeneticAlgorithmFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("genetic-algorithm") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // GA Parameters
  let populationSize = 20;
  let mutationRate = 0.05;
  let crossoverRate = 0.8;
  let problemType = 0; // 0=OneMax, 1=Target String, 2=Knapsack

  // State
  let population: Individual[] = [];
  let generation = 0;
  let bestIndividual: Individual | null = null;
  let fitnessHistory: number[] = [];
  let isRunning = false;
  let stepDelay = 0;
  let targetString = "GENETIC";
  let targetBinary: boolean[] = [];

  const CHROMOSOME_LENGTH = 64;
  const INDIVIDUAL_SIZE = 15;

  function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    ctx = canvas.getContext("2d")!;
    resize(canvas.width, canvas.height);
    
    // Convert target string to binary
    stringToBinary();
    initializePopulation();
  }

  function resize(width: number, height: number): void {
    W = width;
    H = height;
  }

  function stringToBinary(): void {
    targetBinary = [];
    for (let i = 0; i < targetString.length; i++) {
      const char = targetString.charCodeAt(i);
      for (let j = 7; j >= 0; j--) {
        targetBinary.push((char & (1 << j)) !== 0);
      }
    }
    // Pad to chromosome length
    while (targetBinary.length < CHROMOSOME_LENGTH) {
      targetBinary.push(false);
    }
  }

  function initializePopulation(): void {
    population = [];
    generation = 0;
    fitnessHistory = [];
    bestIndividual = null;
    
    for (let i = 0; i < populationSize; i++) {
      const individual: Individual = {
        chromosome: Array(CHROMOSOME_LENGTH).fill(false).map(() => Math.random() < 0.5),
        fitness: 0,
        x: 100 + Math.random() * (W - 200),
        y: 100 + Math.random() * (H - 200),
        generation: 0
      };
      
      individual.fitness = calculateFitness(individual);
      population.push(individual);
    }
    
    updateBestIndividual();
  }

  function calculateFitness(individual: Individual): number {
    if (problemType === 0) { // OneMax - maximize number of 1s
      return individual.chromosome.filter(gene => gene).length;
    } else if (problemType === 1) { // Target String - minimize differences
      let matches = 0;
      for (let i = 0; i < Math.min(individual.chromosome.length, targetBinary.length); i++) {
        if (individual.chromosome[i] === targetBinary[i]) {
          matches++;
        }
      }
      return matches;
    } else { // Knapsack problem (simplified)
      const weights = [10, 20, 30, 40, 50, 60, 70, 80];
      const values = [15, 25, 35, 45, 55, 65, 75, 85];
      const maxWeight = 150;
      
      let totalWeight = 0;
      let totalValue = 0;
      
      for (let i = 0; i < Math.min(8, individual.chromosome.length); i++) {
        if (individual.chromosome[i]) {
          totalWeight += weights[i];
          totalValue += values[i];
        }
      }
      
      return totalWeight <= maxWeight ? totalValue : 0;
    }
  }

  function updateBestIndividual(): void {
    let best = population[0];
    for (const individual of population) {
      if (individual.fitness > best.fitness) {
        best = individual;
      }
    }
    bestIndividual = { ...best };
    fitnessHistory.push(best.fitness);
  }

  function selectParent(): Individual {
    // Tournament selection
    const tournamentSize = 3;
    let best = population[Math.floor(Math.random() * population.length)];
    
    for (let i = 1; i < tournamentSize; i++) {
      const candidate = population[Math.floor(Math.random() * population.length)];
      if (candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    
    return best;
  }

  function crossover(parent1: Individual, parent2: Individual): Individual[] {
    if (Math.random() > crossoverRate) {
      return [{ ...parent1 }, { ...parent2 }];
    }
    
    // Single-point crossover
    const crossoverPoint = Math.floor(Math.random() * CHROMOSOME_LENGTH);
    
    const child1: Individual = {
      chromosome: [
        ...parent1.chromosome.slice(0, crossoverPoint),
        ...parent2.chromosome.slice(crossoverPoint)
      ],
      fitness: 0,
      x: parent1.x + (Math.random() - 0.5) * 50,
      y: parent1.y + (Math.random() - 0.5) * 50,
      generation: generation + 1
    };
    
    const child2: Individual = {
      chromosome: [
        ...parent2.chromosome.slice(0, crossoverPoint),
        ...parent1.chromosome.slice(crossoverPoint)
      ],
      fitness: 0,
      x: parent2.x + (Math.random() - 0.5) * 50,
      y: parent2.y + (Math.random() - 0.5) * 50,
      generation: generation + 1
    };
    
    // Keep positions within bounds
    child1.x = Math.max(50, Math.min(W - 50, child1.x));
    child1.y = Math.max(50, Math.min(H - 50, child1.y));
    child2.x = Math.max(50, Math.min(W - 50, child2.x));
    child2.y = Math.max(50, Math.min(H - 50, child2.y));
    
    return [child1, child2];
  }

  function mutate(individual: Individual): void {
    for (let i = 0; i < individual.chromosome.length; i++) {
      if (Math.random() < mutationRate) {
        individual.chromosome[i] = !individual.chromosome[i];
      }
    }
  }

  function evolveGeneration(): void {
    const newPopulation: Individual[] = [];
    
    // Create new generation
    while (newPopulation.length < populationSize) {
      const parent1 = selectParent();
      const parent2 = selectParent();
      const children = crossover(parent1, parent2);
      
      for (const child of children) {
        mutate(child);
        child.fitness = calculateFitness(child);
        if (newPopulation.length < populationSize) {
          newPopulation.push(child);
        }
      }
    }
    
    population = newPopulation;
    generation++;
    updateBestIndividual();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newPopSize = params.populationSize ?? 20;
    const newMutationRate = params.mutationRate ?? 5; // Convert from percentage
    const newCrossoverRate = params.crossoverRate ?? 80; // Convert from percentage
    const newProblemType = params.problemType ?? 0;
    
    populationSize = newPopSize;
    mutationRate = newMutationRate / 100;
    crossoverRate = newCrossoverRate / 100;
    
    if (newProblemType !== problemType) {
      problemType = newProblemType;
      // Recalculate fitness for all individuals
      for (const individual of population) {
        individual.fitness = calculateFitness(individual);
      }
      updateBestIndividual();
    }

    // Auto-evolve
    stepDelay += dt;
    if (stepDelay >= 800) { // Evolve every 800ms
      evolveGeneration();
      stepDelay = 0;
    }
  }

  function render(): void {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, W, H);

    // Draw population
    for (let i = 0; i < population.length; i++) {
      const individual = population[i];
      
      // Color based on fitness (normalized to 0-1)
      const maxFitness = problemType === 0 ? CHROMOSOME_LENGTH : 
                         problemType === 1 ? CHROMOSOME_LENGTH : 340; // Max knapsack value
      const fitnessRatio = individual.fitness / maxFitness;
      
      const red = Math.floor(255 * (1 - fitnessRatio));
      const green = Math.floor(255 * fitnessRatio);
      const blue = 100;
      
      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      
      // Highlight best individual
      if (bestIndividual && individual.fitness === bestIndividual.fitness) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(individual.x, individual.y, INDIVIDUAL_SIZE + 3, 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      // Draw individual as circle
      ctx.beginPath();
      ctx.arc(individual.x, individual.y, INDIVIDUAL_SIZE, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = "#2d3748";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Show fitness
      ctx.fillStyle = "#2d3748";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(individual.fitness.toString(), individual.x, individual.y + 25);
    }

    // Draw chromosome of best individual
    drawBestChromosome();
    
    // Draw info panel
    drawInfoPanel();
    
    // Draw fitness graph
    drawFitnessGraph();
  }

  function drawBestChromosome(): void {
    if (!bestIndividual) return;
    
    const startX = 20;
    const startY = H - 80;
    const geneSize = 8;
    const genesPerRow = Math.min(32, Math.floor((W - 40) / (geneSize + 2)));
    
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#2d3748";
    ctx.textAlign = "left";
    ctx.fillText("Best Chromosome:", startX, startY - 10);
    
    for (let i = 0; i < bestIndividual.chromosome.length; i++) {
      const row = Math.floor(i / genesPerRow);
      const col = i % genesPerRow;
      const x = startX + col * (geneSize + 2);
      const y = startY + row * (geneSize + 2);
      
      ctx.fillStyle = bestIndividual.chromosome[i] ? "#22c55e" : "#ef4444";
      ctx.fillRect(x, y, geneSize, geneSize);
      
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, geneSize, geneSize);
    }

    // Show decoded string for target string problem
    if (problemType === 1) {
      const decoded = binaryToString(bestIndividual.chromosome);
      ctx.fillStyle = "#2d3748";
      ctx.font = "14px monospace";
      ctx.fillText(`Decoded: "${decoded}"`, startX, startY - 30);
      ctx.fillText(`Target:  "${targetString}"`, startX, startY - 50);
    }
  }

  function binaryToString(binary: boolean[]): string {
    let result = "";
    for (let i = 0; i < binary.length; i += 8) {
      if (i + 7 < binary.length) {
        let byte = 0;
        for (let j = 0; j < 8; j++) {
          if (binary[i + j]) {
            byte |= (1 << (7 - j));
          }
        }
        if (byte >= 32 && byte <= 126) { // Printable ASCII
          result += String.fromCharCode(byte);
        } else {
          result += "?";
        }
      }
    }
    return result;
  }

  function drawInfoPanel(): void {
    const panelX = W - 200;
    const panelY = 20;
    const panelW = 180;
    const panelH = 160;
    
    // Panel background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    // Info text
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    
    const problems = ["OneMax", "Target String", "Knapsack"];
    ctx.fillText(`Problem: ${problems[problemType]}`, panelX + 10, panelY + 20);
    ctx.fillText(`Generation: ${generation}`, panelX + 10, panelY + 40);
    ctx.fillText(`Population: ${populationSize}`, panelX + 10, panelY + 60);
    ctx.fillText(`Mutation: ${(mutationRate * 100).toFixed(1)}%`, panelX + 10, panelY + 80);
    ctx.fillText(`Crossover: ${(crossoverRate * 100).toFixed(0)}%`, panelX + 10, panelY + 100);
    
    if (bestIndividual) {
      ctx.fillText(`Best Fitness: ${bestIndividual.fitness}`, panelX + 10, panelY + 120);
      
      // Max possible fitness
      const maxFitness = problemType === 0 ? CHROMOSOME_LENGTH : 
                         problemType === 1 ? CHROMOSOME_LENGTH : 340;
      ctx.fillText(`Max Possible: ${maxFitness}`, panelX + 10, panelY + 140);
    }
  }

  function drawFitnessGraph(): void {
    if (fitnessHistory.length < 2) return;
    
    const graphX = 20;
    const graphY = 20;
    const graphW = 200;
    const graphH = 100;
    
    // Graph background
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Find min/max for scaling
    const maxFitness = Math.max(...fitnessHistory);
    const minFitness = Math.min(...fitnessHistory);
    const range = maxFitness - minFitness || 1;
    
    // Draw fitness line
    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    
    for (let i = 0; i < fitnessHistory.length; i++) {
      const x = graphX + (i / (fitnessHistory.length - 1)) * graphW;
      const y = graphY + graphH - ((fitnessHistory[i] - minFitness) / range) * graphH;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = "#2d3748";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Fitness Over Time", graphX, graphY - 5);
    ctx.fillText(maxFitness.toString(), graphX + graphW - 20, graphY + 10);
    ctx.fillText(minFitness.toString(), graphX + graphW - 20, graphY + graphH - 5);
  }

  function getStateDescription(): string {
    const problems = ["OneMax (maximize 1s)", "Target String matching", "Knapsack optimization"];
    return `Genetic Algorithm: Evolving population of ${populationSize} individuals over ${generation} generations. ` +
           `Solving ${problems[problemType]} problem. Best fitness: ${bestIndividual?.fitness ?? 0}. ` +
           `Mutation rate: ${(mutationRate * 100).toFixed(1)}%, Crossover rate: ${(crossoverRate * 100).toFixed(0)}%`;
  }

  function reset(): void {
    initializePopulation();
  }

  function destroy(): void {
    // Cleanup if needed
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default GeneticAlgorithmFactory;