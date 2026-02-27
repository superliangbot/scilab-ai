import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const NaturalSelectionFactory: SimulationFactory = () => {
  const config = getSimConfig("natural-selection")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let mutationRate = 0.1;
  let selectionPressure = 1.0;
  let environmentalChange = 0.0;
  let populationSize = 50;

  // Organism traits
  interface Organism {
    x: number;
    y: number;
    vx: number;
    vy: number;
    traits: {
      speed: number;       // 0-1
      size: number;        // 0-1
      camouflage: number;  // 0-1 (color adaptation)
    };
    fitness: number;
    energy: number;
    age: number;
    generation: number;
  }

  let organisms: Organism[] = [];
  let generation = 1;
  let food: Array<{ x: number; y: number; value: number }> = [];
  let predators: Array<{ x: number; y: number; vx: number; vy: number }> = [];
  
  let fitnessHistory: Array<{
    generation: number;
    avgSpeed: number;
    avgSize: number;
    avgCamouflage: number;
    avgFitness: number;
  }> = [];

  function createOrganism(parent1?: Organism, parent2?: Organism, generation?: number): Organism {
    let traits: { speed: number; size: number; camouflage: number };
    
    if (parent1 && parent2) {
      // Sexual reproduction with crossover and mutation
      traits = {
        speed: (parent1.traits.speed + parent2.traits.speed) / 2,
        size: (parent1.traits.size + parent2.traits.size) / 2,
        camouflage: (parent1.traits.camouflage + parent2.traits.camouflage) / 2
      };
      
      // Apply mutations
      if (Math.random() < mutationRate) {
        traits.speed = Math.max(0, Math.min(1, traits.speed + (Math.random() - 0.5) * 0.2));
      }
      if (Math.random() < mutationRate) {
        traits.size = Math.max(0, Math.min(1, traits.size + (Math.random() - 0.5) * 0.2));
      }
      if (Math.random() < mutationRate) {
        traits.camouflage = Math.max(0, Math.min(1, traits.camouflage + (Math.random() - 0.5) * 0.2));
      }
    } else {
      // Random initial traits
      traits = {
        speed: Math.random(),
        size: Math.random(),
        camouflage: Math.random()
      };
    }

    return {
      x: Math.random() * (W - 100) + 50,
      y: Math.random() * (H - 200) + 100,
      vx: 0,
      vy: 0,
      traits,
      fitness: 0,
      energy: 100,
      age: 0,
      generation: generation || 1
    };
  }

  function calculateFitness(organism: Organism): number {
    // Multi-factor fitness function
    let fitness = 0;
    
    // Speed helps escape predators and find food
    fitness += organism.traits.speed * 30;
    
    // Size helps in combat but costs energy
    fitness += organism.traits.size * 20 - organism.traits.size * 10;
    
    // Camouflage helps avoid predators (environmental pressure)
    const optimalCamouflage = 0.5 + environmentalChange * 0.3;
    const camouflageBonus = 40 - Math.abs(organism.traits.camouflage - optimalCamouflage) * 80;
    fitness += camouflageBonus;
    
    // Energy and survival bonus
    fitness += (organism.energy / 100) * 20;
    
    // Age penalty (aging costs)
    fitness -= organism.age * 2;
    
    return Math.max(0, fitness * selectionPressure);
  }

  function initializePopulation() {
    organisms = [];
    food = [];
    predators = [];
    generation = 1;
    fitnessHistory = [];

    // Create initial random population
    for (let i = 0; i < populationSize; i++) {
      organisms.push(createOrganism(undefined, undefined, generation));
    }

    // Create food sources
    for (let i = 0; i < 30; i++) {
      food.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 200) + 100,
        value: 20 + Math.random() * 30
      });
    }

    // Create predators
    for (let i = 0; i < 3; i++) {
      predators.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 200) + 100,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60
      });
    }
  }

  function updateOrganisms(dt: number) {
    for (let i = organisms.length - 1; i >= 0; i--) {
      const org = organisms[i];
      org.age += dt;

      // Find nearest food
      let nearestFood = null;
      let minFoodDist = Infinity;
      for (const f of food) {
        const dist = Math.sqrt((org.x - f.x) ** 2 + (org.y - f.y) ** 2);
        if (dist < minFoodDist) {
          nearestFood = f;
          minFoodDist = dist;
        }
      }

      // Find nearest predator
      let nearestPredator = null;
      let minPredDist = Infinity;
      for (const p of predators) {
        const dist = Math.sqrt((org.x - p.x) ** 2 + (org.y - p.y) ** 2);
        if (dist < minPredDist) {
          nearestPredator = p;
          minPredDist = dist;
        }
      }

      // Behavior: flee from predators or seek food
      if (nearestPredator && minPredDist < 100) {
        // Flee from predator
        const dx = org.x - nearestPredator.x;
        const dy = org.y - nearestPredator.y;
        const fleeSpeed = org.traits.speed * 80;
        org.vx = (dx / minPredDist) * fleeSpeed;
        org.vy = (dy / minPredDist) * fleeSpeed;
        
        // Energy cost of fleeing
        org.energy -= org.traits.size * 5 * dt;
      } else if (nearestFood && minFoodDist < 150) {
        // Seek food
        const dx = nearestFood.x - org.x;
        const dy = nearestFood.y - org.y;
        const seekSpeed = org.traits.speed * 40;
        org.vx = (dx / minFoodDist) * seekSpeed;
        org.vy = (dy / minFoodDist) * seekSpeed;
      } else {
        // Random movement
        org.vx += (Math.random() - 0.5) * 20 * dt;
        org.vy += (Math.random() - 0.5) * 20 * dt;
        org.vx *= 0.9;
        org.vy *= 0.9;
      }

      // Update position
      org.x += org.vx * dt;
      org.y += org.vy * dt;

      // Boundaries
      org.x = Math.max(30, Math.min(W - 30, org.x));
      org.y = Math.max(90, Math.min(H - 130, org.y));

      // Check food consumption
      for (let j = food.length - 1; j >= 0; j--) {
        const f = food[j];
        const dist = Math.sqrt((org.x - f.x) ** 2 + (org.y - f.y) ** 2);
        if (dist < 15 + org.traits.size * 10) {
          org.energy = Math.min(150, org.energy + f.value);
          food.splice(j, 1);
        }
      }

      // Check predator capture
      if (nearestPredator && minPredDist < 20 + org.traits.size * 10) {
        // Survival chance based on traits
        const escapeChance = org.traits.speed * 0.4 + org.traits.camouflage * 0.4 + org.traits.size * 0.2;
        if (Math.random() > escapeChance) {
          organisms.splice(i, 1);
          continue;
        }
      }

      // Metabolic energy cost
      const metabolicCost = 5 + org.traits.size * 5 + org.traits.speed * 3;
      org.energy -= metabolicCost * dt;

      // Death from starvation or old age
      if (org.energy <= 0 || org.age > 20) {
        organisms.splice(i, 1);
        continue;
      }

      // Calculate fitness
      org.fitness = calculateFitness(org);
    }

    // Update predators
    for (const predator of predators) {
      // Simple predator AI - chase nearest organism
      let nearest = null;
      let minDist = Infinity;
      
      for (const org of organisms) {
        const dist = Math.sqrt((predator.x - org.x) ** 2 + (predator.y - org.y) ** 2);
        if (dist < minDist) {
          nearest = org;
          minDist = dist;
        }
      }

      if (nearest) {
        const dx = nearest.x - predator.x;
        const dy = nearest.y - predator.y;
        const speed = 50;
        predator.vx = (dx / minDist) * speed;
        predator.vy = (dy / minDist) * speed;
      }

      predator.x += predator.vx * dt;
      predator.y += predator.vy * dt;

      // Predator boundaries
      if (predator.x < 30 || predator.x > W - 30) predator.vx = -predator.vx;
      if (predator.y < 90 || predator.y > H - 130) predator.vy = -predator.vy;
      predator.x = Math.max(30, Math.min(W - 30, predator.x));
      predator.y = Math.max(90, Math.min(H - 130, predator.y));
    }

    // Reproduce food
    if (food.length < 25 && Math.random() < 0.3) {
      food.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 200) + 100,
        value: 20 + Math.random() * 30
      });
    }
  }

  function evolveGeneration() {
    if (organisms.length < 10) return;

    // Calculate statistics for current generation
    const avgSpeed = organisms.reduce((sum, org) => sum + org.traits.speed, 0) / organisms.length;
    const avgSize = organisms.reduce((sum, org) => sum + org.traits.size, 0) / organisms.length;
    const avgCamouflage = organisms.reduce((sum, org) => sum + org.traits.camouflage, 0) / organisms.length;
    const avgFitness = organisms.reduce((sum, org) => sum + org.fitness, 0) / organisms.length;

    fitnessHistory.push({
      generation,
      avgSpeed,
      avgSize,
      avgCamouflage,
      avgFitness
    });

    // Selection: keep top performers
    organisms.sort((a, b) => b.fitness - a.fitness);
    const survivors = organisms.slice(0, Math.floor(organisms.length * 0.3));

    // Reproduction: create new generation
    const newGeneration: Organism[] = [];
    
    // Elite reproduction
    for (let i = 0; i < survivors.length; i++) {
      newGeneration.push(createOrganism(survivors[i], survivors[i], generation + 1));
    }

    // Sexual reproduction
    while (newGeneration.length < populationSize) {
      const parent1 = survivors[Math.floor(Math.random() * survivors.length)];
      const parent2 = survivors[Math.floor(Math.random() * survivors.length)];
      newGeneration.push(createOrganism(parent1, parent2, generation + 1));
    }

    organisms = newGeneration;
    generation++;

    // Reset positions and energy
    for (const org of organisms) {
      org.x = Math.random() * (W - 100) + 50;
      org.y = Math.random() * (H - 200) + 100;
      org.energy = 100;
      org.age = 0;
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializePopulation();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      mutationRate = params.mutationRate ?? mutationRate;
      selectionPressure = params.selectionPressure ?? selectionPressure;
      environmentalChange = params.environmentalChange ?? environmentalChange;
      populationSize = Math.round(params.populationSize ?? populationSize);

      time += dt;
      updateOrganisms(dt);

      // Trigger evolution every 15 seconds
      if (Math.floor(time / 15) > Math.floor((time - dt) / 15)) {
        evolveGeneration();
      }
    },

    render() {
      // Background with environmental gradient
      const envColor = environmentalChange * 0.5 + 0.5; // 0.5 to 1.0
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, `hsl(${120 * envColor}, 30%, 10%)`);
      gradient.addColorStop(1, `hsl(${120 * envColor}, 50%, 20%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(`Natural Selection - Generation ${generation}`, W / 2, 25);

      // Environment area
      ctx.fillStyle = `hsla(${120 * envColor}, 40%, 25%, 0.3)`;
      ctx.fillRect(30, 90, W - 60, H - 220);
      ctx.strokeStyle = `hsla(${120 * envColor}, 60%, 40%, 0.5)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 90, W - 60, H - 220);

      // Draw food
      for (const f of food) {
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Food glow
        const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 12);
        glow.addColorStop(0, "rgba(16, 185, 129, 0.4)");
        glow.addColorStop(1, "rgba(16, 185, 129, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw predators
      for (const pred of predators) {
        ctx.fillStyle = "#7f1d1d";
        ctx.beginPath();
        ctx.arc(pred.x, pred.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Predator eyes
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(pred.x - 5, pred.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pred.x + 5, pred.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw organisms
      for (const org of organisms) {
        const size = 6 + org.traits.size * 8;
        const camouflageColor = Math.floor(org.traits.camouflage * 255);
        
        // Health/fitness ring
        const fitnessRatio = Math.min(1, org.fitness / 100);
        ctx.strokeStyle = fitnessRatio > 0.7 ? "#10b981" : 
                         fitnessRatio > 0.4 ? "#f59e0b" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(org.x, org.y, size + 3, 0, Math.PI * 2 * fitnessRatio);
        ctx.stroke();

        // Organism body (color represents camouflage)
        const r = Math.floor(100 + org.traits.camouflage * 100);
        const g = Math.floor(150 + org.traits.camouflage * 80);
        const b = Math.floor(80 + org.traits.camouflage * 120);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(org.x, org.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Speed indicator (motion lines)
        if (org.traits.speed > 0.7) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(org.x - org.vx * 0.02 * (i + 1), org.y - org.vy * 0.02 * (i + 1));
            ctx.lineTo(org.x - org.vx * 0.02 * (i + 2), org.y - org.vy * 0.02 * (i + 2));
            ctx.stroke();
          }
        }
      }

      // Evolution graph
      const graphX = 20;
      const graphY = H - 120;
      const graphW = 300;
      const graphH = 100;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(graphX, graphY, graphW, graphH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(graphX, graphY, graphW, graphH);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Trait Evolution", graphX + graphW / 2, graphY - 5);

      if (fitnessHistory.length > 1) {
        const drawTrait = (data: number[], color: string) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          
          for (let i = 0; i < fitnessHistory.length; i++) {
            const x = graphX + (i / (fitnessHistory.length - 1)) * graphW;
            const y = graphY + graphH - data[i] * graphH;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        };

        drawTrait(fitnessHistory.map(h => h.avgSpeed), "#3b82f6");
        drawTrait(fitnessHistory.map(h => h.avgSize), "#ef4444");
        drawTrait(fitnessHistory.map(h => h.avgCamouflage), "#10b981");
      }

      // Statistics panel
      const statsX = W - 250;
      const statsY = H - 120;
      const statsW = 230;
      const statsH = 100;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(statsX, statsY, statsW, statsH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(statsX, statsY, statsW, statsH);

      let infoY = statsY + 15;
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Population Statistics", statsX + 10, infoY);
      infoY += 18;

      if (organisms.length > 0) {
        const avgSpeed = organisms.reduce((sum, org) => sum + org.traits.speed, 0) / organisms.length;
        const avgSize = organisms.reduce((sum, org) => sum + org.traits.size, 0) / organisms.length;
        const avgCamouflage = organisms.reduce((sum, org) => sum + org.traits.camouflage, 0) / organisms.length;
        const avgFitness = organisms.reduce((sum, org) => sum + org.fitness, 0) / organisms.length;

        ctx.font = "10px Arial";
        ctx.fillStyle = "#3b82f6";
        ctx.fillText(`Avg Speed: ${avgSpeed.toFixed(3)}`, statsX + 10, infoY);
        infoY += 12;
        ctx.fillStyle = "#ef4444";
        ctx.fillText(`Avg Size: ${avgSize.toFixed(3)}`, statsX + 10, infoY);
        infoY += 12;
        ctx.fillStyle = "#10b981";
        ctx.fillText(`Avg Camouflage: ${avgCamouflage.toFixed(3)}`, statsX + 10, infoY);
        infoY += 12;
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`Avg Fitness: ${avgFitness.toFixed(1)}`, statsX + 10, infoY);
        infoY += 12;
        
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Population: ${organisms.length}`, statsX + 10, infoY);
      }

      // Legend
      ctx.font = "10px Arial";
      ctx.textAlign = "left";
      const legendY = 50;
      const items = [
        { color: "#3b82f6", label: "Speed" },
        { color: "#ef4444", label: "Size" },
        { color: "#10b981", label: "Camouflage" },
        { color: "#10b981", label: "Food" },
        { color: "#7f1d1d", label: "Predator" }
      ];

      items.forEach((item, i) => {
        const x = 40 + (i % 3) * 80;
        const y = legendY + Math.floor(i / 3) * 15;
        
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(item.label, x + 8, y + 3);
      });
    },

    reset() {
      time = 0;
      generation = 1;
      initializePopulation();
    },

    destroy() {
      organisms = [];
      food = [];
      predators = [];
      fitnessHistory = [];
    },

    getStateDescription(): string {
      if (organisms.length === 0) return "Natural Selection simulation - population extinct.";
      
      const avgSpeed = organisms.reduce((sum, org) => sum + org.traits.speed, 0) / organisms.length;
      const avgSize = organisms.reduce((sum, org) => sum + org.traits.size, 0) / organisms.length;
      const avgCamouflage = organisms.reduce((sum, org) => sum + org.traits.camouflage, 0) / organisms.length;

      return (
        `Natural Selection simulation at generation ${generation} with ${organisms.length} organisms. ` +
        `Average traits: Speed ${avgSpeed.toFixed(3)}, Size ${avgSize.toFixed(3)}, Camouflage ${avgCamouflage.toFixed(3)}. ` +
        `Selection pressure: ${selectionPressure.toFixed(1)}, Mutation rate: ${(mutationRate * 100).toFixed(1)}%, ` +
        `Environmental change: ${environmentalChange.toFixed(2)}. ` +
        `Organisms evolve through selection, reproduction, and mutation with fitness based on survival and reproduction success.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default NaturalSelectionFactory;