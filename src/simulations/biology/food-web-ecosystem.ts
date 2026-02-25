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

  // Trophic levels
  interface Organism {
    x: number;
    y: number;
    vx: number;
    vy: number;
    level: number; // 1=producer, 2=primary consumer, 3=secondary consumer, 4=tertiary
    energy: number;
    maxEnergy: number;
    radius: number;
    color: string;
    name: string;
    age: number;
    reproductionCooldown: number;
  }

  let organisms: Organism[] = [];
  let energyFlows: Array<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    amount: number;
    age: number;
  }> = [];

  const trophicLevels = [
    { level: 1, name: "Grass", color: "#22c55e", maxEnergy: 20, baseCount: 40 },
    { level: 2, name: "Rabbit", color: "#f59e0b", maxEnergy: 30, baseCount: 15 },
    { level: 3, name: "Fox", color: "#ef4444", maxEnergy: 40, baseCount: 5 },
    { level: 4, name: "Eagle", color: "#6366f1", maxEnergy: 50, baseCount: 2 }
  ];

  function createOrganism(level: number, x?: number, y?: number): Organism {
    const levelInfo = trophicLevels[level - 1];
    return {
      x: x ?? Math.random() * (W - 100) + 50,
      y: y ?? Math.random() * (H - 100) + 50,
      vx: level === 1 ? 0 : (Math.random() - 0.5) * (50 / level), // Producers don't move
      vy: level === 1 ? 0 : (Math.random() - 0.5) * (50 / level),
      level,
      energy: levelInfo.maxEnergy * 0.8,
      maxEnergy: levelInfo.maxEnergy,
      radius: 8 + level * 2,
      color: levelInfo.color,
      name: levelInfo.name,
      age: 0,
      reproductionCooldown: 0
    };
  }

  function initEcosystem() {
    organisms = [];
    energyFlows = [];

    // Create initial population
    trophicLevels.forEach((levelInfo) => {
      const count = Math.round(levelInfo.baseCount * carryingCapacity / 100);
      for (let i = 0; i < count; i++) {
        organisms.push(createOrganism(levelInfo.level));
      }
    });
  }

  function findNearestPrey(predator: Organism): Organism | null {
    const preyLevel = predator.level - 1;
    if (preyLevel < 1) return null;

    let nearest: Organism | null = null;
    let minDistance = Infinity;

    for (const org of organisms) {
      if (org.level === preyLevel && org !== predator) {
        const dx = predator.x - org.x;
        const dy = predator.y - org.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance && distance < 80) {
          nearest = org;
          minDistance = distance;
        }
      }
    }

    return nearest;
  }

  function updateOrganisms(dt: number) {
    // Update all organisms
    for (let i = organisms.length - 1; i >= 0; i--) {
      const org = organisms[i];
      org.age += dt;
      org.reproductionCooldown = Math.max(0, org.reproductionCooldown - dt);

      // Move organisms (except producers)
      if (org.level > 1) {
        // Look for prey
        const prey = findNearestPrey(org);
        if (prey) {
          // Move toward prey
          const dx = prey.x - org.x;
          const dy = prey.y - org.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const speed = (50 / org.level) * (1 + org.energy / org.maxEnergy);
            org.vx = (dx / distance) * speed;
            org.vy = (dy / distance) * speed;
          }

          // Hunt if close enough
          if (distance < org.radius + prey.radius + 5) {
            const energyGained = prey.energy * predationEfficiency;
            org.energy = Math.min(org.maxEnergy, org.energy + energyGained);
            
            if (showEnergyFlow) {
              energyFlows.push({
                from: { x: prey.x, y: prey.y },
                to: { x: org.x, y: org.y },
                amount: energyGained,
                age: 0
              });
            }

            // Remove prey
            const preyIndex = organisms.indexOf(prey);
            if (preyIndex >= 0) {
              organisms.splice(preyIndex, 1);
              if (preyIndex < i) i--; // Adjust loop index
            }
          }
        } else {
          // Random movement if no prey found
          org.vx += (Math.random() - 0.5) * 20 * dt;
          org.vy += (Math.random() - 0.5) * 20 * dt;
          
          // Damping
          org.vx *= 0.95;
          org.vy *= 0.95;
        }

        // Update position
        org.x += org.vx * dt;
        org.y += org.vy * dt;

        // Boundary constraints
        org.x = Math.max(org.radius, Math.min(W - org.radius, org.x));
        org.y = Math.max(org.radius, Math.min(H - org.radius, org.y));

        // Energy consumption (metabolism)
        const metabolicRate = 0.1 + 0.05 * org.level;
        org.energy -= metabolicRate * dt;
      } else {
        // Producers gain energy from sunlight
        org.energy += primaryProductivity * dt * 2;
        org.energy = Math.min(org.maxEnergy, org.energy);
      }

      // Death from starvation or old age
      if (org.energy <= 0 || org.age > 30 + org.level * 10) {
        organisms.splice(i, 1);
        continue;
      }

      // Reproduction
      if (org.energy > org.maxEnergy * 0.7 && 
          org.reproductionCooldown <= 0 && 
          org.age > 2) {
        
        const currentCount = organisms.filter(o => o.level === org.level).length;
        const maxCount = Math.round(trophicLevels[org.level - 1].baseCount * carryingCapacity / 100);
        
        if (currentCount < maxCount) {
          // Create offspring
          const offspring = createOrganism(
            org.level, 
            org.x + (Math.random() - 0.5) * 30,
            org.y + (Math.random() - 0.5) * 30
          );
          offspring.energy = org.maxEnergy * 0.5;
          organisms.push(offspring);
          
          org.energy *= 0.6; // Parent loses energy
          org.reproductionCooldown = 5 + Math.random() * 5;
        }
      }
    }

    // Update energy flow animations
    for (let i = energyFlows.length - 1; i >= 0; i--) {
      energyFlows[i].age += dt;
      if (energyFlows[i].age > 2) {
        energyFlows.splice(i, 1);
      }
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initEcosystem();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      primaryProductivity = params.primaryProductivity ?? primaryProductivity;
      carryingCapacity = params.carryingCapacity ?? carryingCapacity;
      predationEfficiency = params.predationEfficiency ?? predationEfficiency;
      showEnergyFlow = Math.round(params.showEnergyFlow ?? showEnergyFlow);

      time += dt;
      updateOrganisms(dt);
    },

    render() {
      // Background (representing environment)
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#87ceeb"); // Sky blue
      gradient.addColorStop(0.7, "#90ee90"); // Light green
      gradient.addColorStop(1, "#8fbc8f"); // Dark sea green
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#2d3748";
      ctx.textAlign = "center";
      ctx.fillText("Food Web Ecosystem", W / 2, 25);

      // Draw energy flows
      if (showEnergyFlow) {
        for (const flow of energyFlows) {
          const alpha = Math.max(0, 1 - flow.age / 2);
          
          ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.8})`;
          ctx.lineWidth = Math.max(1, flow.amount / 10);
          
          // Animate flow
          const progress = Math.min(1, flow.age * 2);
          const currentX = flow.from.x + (flow.to.x - flow.from.x) * progress;
          const currentY = flow.from.y + (flow.to.y - flow.from.y) * progress;
          
          ctx.beginPath();
          ctx.moveTo(flow.from.x, flow.from.y);
          ctx.lineTo(currentX, currentY);
          ctx.stroke();

          // Energy amount label
          if (alpha > 0.5) {
            ctx.font = "10px Arial";
            ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
            ctx.textAlign = "center";
            ctx.fillText(`+${flow.amount.toFixed(1)}`, currentX, currentY - 10);
          }
        }
      }

      // Draw organisms
      for (const org of organisms) {
        // Health/energy ring
        const healthRatio = org.energy / org.maxEnergy;
        const ringRadius = org.radius + 4;
        
        ctx.strokeStyle = healthRatio > 0.6 ? "#10b981" : 
                         healthRatio > 0.3 ? "#f59e0b" : "#ef4444";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(org.x, org.y, ringRadius, 0, Math.PI * 2 * healthRatio);
        ctx.stroke();

        // Organism body with glow
        const glowGradient = ctx.createRadialGradient(org.x, org.y, 0, org.x, org.y, org.radius + 8);
        glowGradient.addColorStop(0, org.color + "AA");
        glowGradient.addColorStop(1, org.color + "00");
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(org.x, org.y, org.radius + 8, 0, Math.PI * 2);
        ctx.fill();

        // Main body
        ctx.fillStyle = org.color;
        ctx.beginPath();
        ctx.arc(org.x, org.y, org.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Trophic level indicator
        ctx.fillStyle = "white";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(org.level.toString(), org.x, org.y);

        // Name label
        ctx.font = "9px Arial";
        ctx.fillStyle = "#2d3748";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(org.name, org.x, org.y + org.radius + 8);
      }

      // Population counts panel
      const panelX = 20;
      const panelY = 50;
      const panelW = 200;
      const panelH = 160;

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 2;
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      let infoY = panelY + 20;
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#2d3748";
      ctx.textAlign = "left";
      ctx.fillText("Population Counts", panelX + 10, infoY);
      infoY += 20;

      trophicLevels.forEach((levelInfo) => {
        const count = organisms.filter(o => o.level === levelInfo.level).length;
        const maxCount = Math.round(levelInfo.baseCount * carryingCapacity / 100);
        
        ctx.font = "11px Arial";
        ctx.fillStyle = levelInfo.color;
        ctx.fillText(`${levelInfo.name}:`, panelX + 10, infoY);
        
        ctx.fillStyle = "#4a5568";
        ctx.fillText(`${count}/${maxCount}`, panelX + 100, infoY);
        
        // Bar chart
        const barWidth = 60;
        const barHeight = 8;
        const barX = panelX + 120;
        const barY = infoY - 6;
        
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        if (maxCount > 0) {
          ctx.fillStyle = levelInfo.color;
          ctx.fillRect(barX, barY, (count / maxCount) * barWidth, barHeight);
        }
        
        infoY += 18;
      });

      // Parameters panel
      const paramsY = panelY + panelH + 20;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(panelX, paramsY, panelW, 100);
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 2;
      ctx.strokeRect(panelX, paramsY, panelW, 100);

      let paramY = paramsY + 20;
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#2d3748";
      ctx.fillText("Ecosystem Parameters", panelX + 10, paramY);
      paramY += 18;

      ctx.font = "10px Arial";
      ctx.fillStyle = "#4a5568";
      ctx.fillText(`Primary Productivity: ${primaryProductivity.toFixed(1)}`, panelX + 10, paramY);
      paramY += 14;
      ctx.fillText(`Carrying Capacity: ${carryingCapacity}%`, panelX + 10, paramY);
      paramY += 14;
      ctx.fillText(`Predation Efficiency: ${(predationEfficiency * 100).toFixed(0)}%`, panelX + 10, paramY);
      paramY += 14;
      ctx.fillText(`Total Organisms: ${organisms.length}`, panelX + 10, paramY);

      // Food web diagram (right side)
      const diagramX = W - 180;
      const diagramY = 60;
      const diagramW = 160;
      const diagramH = 200;

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(diagramX, diagramY, diagramW, diagramH);
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 2;
      ctx.strokeRect(diagramX, diagramY, diagramW, diagramH);

      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#2d3748";
      ctx.textAlign = "center";
      ctx.fillText("Trophic Levels", diagramX + diagramW / 2, diagramY + 20);

      // Draw trophic pyramid
      const levelHeight = 30;
      trophicLevels.forEach((levelInfo, i) => {
        const y = diagramY + 40 + i * levelHeight;
        const levelWidth = diagramW - 20 - i * 15;
        const x = diagramX + 10 + i * 7.5;
        
        ctx.fillStyle = levelInfo.color + "AA";
        ctx.fillRect(x, y, levelWidth, levelHeight - 5);
        ctx.strokeStyle = levelInfo.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, levelWidth, levelHeight - 5);
        
        ctx.font = "10px Arial";
        ctx.fillStyle = "#2d3748";
        ctx.textAlign = "center";
        ctx.fillText(`${levelInfo.level}. ${levelInfo.name}`, x + levelWidth / 2, y + 18);

        // Draw arrows between levels
        if (i < trophicLevels.length - 1) {
          const arrowY = y + levelHeight - 2;
          ctx.strokeStyle = "#666";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(diagramX + diagramW / 2, arrowY);
          ctx.lineTo(diagramX + diagramW / 2, arrowY + 8);
          ctx.stroke();
          
          // Arrowhead
          ctx.beginPath();
          ctx.moveTo(diagramX + diagramW / 2 - 3, arrowY + 5);
          ctx.lineTo(diagramX + diagramW / 2, arrowY + 8);
          ctx.lineTo(diagramX + diagramW / 2 + 3, arrowY + 5);
          ctx.stroke();
        }
      });
    },

    reset() {
      time = 0;
      initEcosystem();
    },

    destroy() {
      organisms = [];
      energyFlows = [];
    },

    getStateDescription(): string {
      const counts = trophicLevels.map(level => ({
        name: level.name,
        count: organisms.filter(o => o.level === level.level).length
      }));

      return (
        `Food Web Ecosystem simulation with ${organisms.length} total organisms. ` +
        `Population: ${counts.map(c => `${c.count} ${c.name}s`).join(", ")}. ` +
        `Environment parameters: Primary productivity ${primaryProductivity.toFixed(1)}, ` +
        `carrying capacity ${carryingCapacity}%, predation efficiency ${(predationEfficiency * 100).toFixed(0)}%. ` +
        `Energy flows through trophic levels: Producers (1) → Primary consumers (2) → Secondary consumers (3) → Tertiary consumers (4). ` +
        `Each level represents a 90% energy loss due to metabolic inefficiency.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default FoodWebEcosystemFactory;