import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const PopulationDynamicsFactory: SimulationFactory = () => {
  const config = getSimConfig("population-dynamics")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Lotka-Volterra parameters
  let preyGrowthRate = 0.8;     // α - prey reproduction rate
  let predationRate = 0.4;      // β - predation efficiency
  let predatorEfficiency = 0.3; // δ - predator reproduction efficiency
  let predatorDeathRate = 0.5;  // γ - predator natural death rate

  // Population state
  let preyPop = 40;
  let predatorPop = 20;

  // History for graphs
  let populationHistory: Array<{
    time: number;
    prey: number;
    predator: number;
  }> = [];

  // Visual representation
  let preyAgents: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    energy: number;
    age: number;
  }> = [];

  let predatorAgents: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    energy: number;
    age: number;
    huntTarget: number | null;
  }> = [];

  function initializePopulations() {
    preyAgents = [];
    predatorAgents = [];
    populationHistory = [];

    // Create prey agents
    for (let i = 0; i < preyPop; i++) {
      preyAgents.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 200) + 100,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        energy: 80 + Math.random() * 20,
        age: Math.random() * 5
      });
    }

    // Create predator agents
    for (let i = 0; i < predatorPop; i++) {
      predatorAgents.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 200) + 100,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        energy: 60 + Math.random() * 30,
        age: Math.random() * 8,
        huntTarget: null
      });
    }
  }

  function updateLotkaVolterra(dt: number) {
    // Classic Lotka-Volterra equations:
    // dN/dt = αN - βNP  (prey)
    // dP/dt = δβNP - γP (predators)
    
    const N = preyPop;
    const P = predatorPop;
    
    const dN_dt = preyGrowthRate * N - predationRate * N * P;
    const dP_dt = predatorEfficiency * predationRate * N * P - predatorDeathRate * P;
    
    preyPop = Math.max(0, preyPop + dN_dt * dt);
    predatorPop = Math.max(0, predatorPop + dP_dt * dt);

    // Record history
    if (populationHistory.length === 0 || time - populationHistory[populationHistory.length - 1].time > 0.1) {
      populationHistory.push({
        time: time,
        prey: preyPop,
        predator: predatorPop
      });

      // Keep only recent history
      if (populationHistory.length > 500) {
        populationHistory.shift();
      }
    }
  }

  function updateAgentBehavior(dt: number) {
    // Update prey behavior
    for (let i = preyAgents.length - 1; i >= 0; i--) {
      const prey = preyAgents[i];
      prey.age += dt;

      // Flee from nearest predator
      let nearestPredator = null;
      let minPredDist = Infinity;
      
      for (const pred of predatorAgents) {
        const dx = pred.x - prey.x;
        const dy = pred.y - prey.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minPredDist) {
          minPredDist = dist;
          nearestPredator = pred;
        }
      }

      if (nearestPredator && minPredDist < 120) {
        // Flee from predator
        const dx = prey.x - nearestPredator.x;
        const dy = prey.y - nearestPredator.y;
        const fleeForce = 100 / Math.max(minPredDist, 10);
        prey.vx += (dx / minPredDist) * fleeForce * dt;
        prey.vy += (dy / minPredDist) * fleeForce * dt;
      } else {
        // Random browsing behavior
        prey.vx += (Math.random() - 0.5) * 20 * dt;
        prey.vy += (Math.random() - 0.5) * 20 * dt;
      }

      // Damping and speed limit
      prey.vx *= 0.95;
      prey.vy *= 0.95;
      const speed = Math.sqrt(prey.vx * prey.vx + prey.vy * prey.vy);
      if (speed > 80) {
        prey.vx = (prey.vx / speed) * 80;
        prey.vy = (prey.vy / speed) * 80;
      }

      // Update position
      prey.x += prey.vx * dt;
      prey.y += prey.vy * dt;

      // Boundary conditions
      if (prey.x < 20) { prey.x = 20; prey.vx = Math.abs(prey.vx); }
      if (prey.x > W - 20) { prey.x = W - 20; prey.vx = -Math.abs(prey.vx); }
      if (prey.y < 80) { prey.y = 80; prey.vy = Math.abs(prey.vy); }
      if (prey.y > H - 120) { prey.y = H - 120; prey.vy = -Math.abs(prey.vy); }

      // Energy and aging
      prey.energy -= 5 * dt;
      if (prey.energy <= 0 || prey.age > 15) {
        preyAgents.splice(i, 1);
      }
    }

    // Update predator behavior
    for (let i = predatorAgents.length - 1; i >= 0; i--) {
      const pred = predatorAgents[i];
      pred.age += dt;

      // Hunt nearest prey
      if (pred.huntTarget === null || pred.huntTarget >= preyAgents.length) {
        // Find new target
        let nearestPrey = null;
        let minPreyDist = Infinity;
        let nearestIndex = -1;

        for (let j = 0; j < preyAgents.length; j++) {
          const prey = preyAgents[j];
          const dx = prey.x - pred.x;
          const dy = prey.y - pred.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minPreyDist) {
            minPreyDist = dist;
            nearestPrey = prey;
            nearestIndex = j;
          }
        }

        pred.huntTarget = nearestIndex;
      }

      if (pred.huntTarget !== null && pred.huntTarget < preyAgents.length) {
        const target = preyAgents[pred.huntTarget];
        const dx = target.x - pred.x;
        const dy = target.y - pred.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 15) {
          // Catch prey
          pred.energy += 40;
          preyAgents.splice(pred.huntTarget, 1);
          pred.huntTarget = null;
        } else {
          // Chase prey
          const huntSpeed = 100;
          pred.vx = (dx / dist) * huntSpeed;
          pred.vy = (dy / dist) * huntSpeed;
        }
      } else {
        // Random patrol
        pred.vx += (Math.random() - 0.5) * 30 * dt;
        pred.vy += (Math.random() - 0.5) * 30 * dt;
        pred.vx *= 0.9;
        pred.vy *= 0.9;
      }

      // Update position
      pred.x += pred.vx * dt;
      pred.y += pred.vy * dt;

      // Boundary conditions
      if (pred.x < 20) { pred.x = 20; pred.vx = Math.abs(pred.vx); }
      if (pred.x > W - 20) { pred.x = W - 20; pred.vx = -Math.abs(pred.vx); }
      if (pred.y < 80) { pred.y = 80; pred.vy = Math.abs(pred.vy); }
      if (pred.y > H - 120) { pred.y = H - 120; pred.vy = -Math.abs(pred.vy); }

      // Energy consumption and aging
      pred.energy -= 8 * dt;
      if (pred.energy <= 0 || pred.age > 25) {
        predatorAgents.splice(i, 1);
      }
    }

    // Adjust agent populations to match model
    const targetPrey = Math.round(preyPop);
    const targetPredators = Math.round(predatorPop);

    // Add or remove prey agents
    while (preyAgents.length < targetPrey && preyAgents.length < 200) {
      preyAgents.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 200) + 100,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        energy: 80 + Math.random() * 20,
        age: 0
      });
    }

    while (preyAgents.length > targetPrey) {
      preyAgents.pop();
    }

    // Add or remove predator agents
    while (predatorAgents.length < targetPredators && predatorAgents.length < 100) {
      predatorAgents.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 200) + 100,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        energy: 60 + Math.random() * 30,
        age: 0,
        huntTarget: null
      });
    }

    while (predatorAgents.length > targetPredators) {
      predatorAgents.pop();
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializePopulations();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      preyGrowthRate = params.preyGrowthRate ?? preyGrowthRate;
      predationRate = params.predationRate ?? predationRate;
      predatorEfficiency = params.predatorEfficiency ?? predatorEfficiency;
      predatorDeathRate = params.predatorDeathRate ?? predatorDeathRate;

      time += dt;
      updateLotkaVolterra(dt);
      updateAgentBehavior(dt);
    },

    render() {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(1, "#1e293b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Population Dynamics: Lotka-Volterra Model", W / 2, 25);

      // Environment area
      ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
      ctx.fillRect(20, 80, W - 40, H - 200);
      ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(20, 80, W - 40, H - 200);

      // Draw prey agents
      for (const prey of preyAgents) {
        // Energy indicator (health ring)
        const healthRatio = prey.energy / 100;
        ctx.strokeStyle = healthRatio > 0.5 ? "#10b981" : 
                         healthRatio > 0.2 ? "#f59e0b" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(prey.x, prey.y, 12, 0, Math.PI * 2 * healthRatio);
        ctx.stroke();

        // Prey body (rabbit-like)
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.ellipse(prey.x, prey.y, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1e40af";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ears
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.ellipse(prey.x - 4, prey.y - 8, 2, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(prey.x + 4, prey.y - 8, 2, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw predator agents
      for (const pred of predatorAgents) {
        // Energy indicator
        const healthRatio = pred.energy / 100;
        ctx.strokeStyle = healthRatio > 0.5 ? "#10b981" : 
                         healthRatio > 0.2 ? "#f59e0b" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pred.x, pred.y, 16, 0, Math.PI * 2 * healthRatio);
        ctx.stroke();

        // Predator body (wolf-like)
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.ellipse(pred.x, pred.y, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Eyes (hunting indicator)
        ctx.fillStyle = pred.huntTarget !== null ? "#fbbf24" : "#ffffff";
        ctx.beginPath();
        ctx.arc(pred.x - 4, pred.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pred.x + 4, pred.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Hunting line to target
        if (pred.huntTarget !== null && pred.huntTarget < preyAgents.length) {
          const target = preyAgents[pred.huntTarget];
          ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(pred.x, pred.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Population graph
      const graphX = 20;
      const graphY = H - 180;
      const graphW = 350;
      const graphH = 140;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(graphX, graphY, graphW, graphH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(graphX, graphY, graphW, graphH);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Population vs Time", graphX + graphW / 2, graphY - 8);

      if (populationHistory.length > 1) {
        const maxPop = Math.max(80, Math.max(...populationHistory.map(h => Math.max(h.prey, h.predator))));
        
        // Plot prey population
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < populationHistory.length; i++) {
          const point = populationHistory[i];
          const x = graphX + (i / (populationHistory.length - 1)) * graphW;
          const y = graphY + graphH - (point.prey / maxPop) * graphH;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Plot predator population
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < populationHistory.length; i++) {
          const point = populationHistory[i];
          const x = graphX + (i / (populationHistory.length - 1)) * graphW;
          const y = graphY + graphH - (point.predator / maxPop) * graphH;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Phase portrait (prey vs predator)
      const phaseX = W - 200;
      const phaseY = H - 180;
      const phaseW = 180;
      const phaseH = 140;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(phaseX, phaseY, phaseW, phaseH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(phaseX, phaseY, phaseW, phaseH);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Phase Portrait", phaseX + phaseW / 2, phaseY - 8);

      if (populationHistory.length > 1) {
        const maxPreyPhase = Math.max(...populationHistory.map(h => h.prey));
        const maxPredPhase = Math.max(...populationHistory.map(h => h.predator));
        
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < populationHistory.length; i++) {
          const point = populationHistory[i];
          const x = phaseX + (point.prey / maxPreyPhase) * phaseW;
          const y = phaseY + phaseH - (point.predator / maxPredPhase) * phaseH;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Current point
        if (populationHistory.length > 0) {
          const current = populationHistory[populationHistory.length - 1];
          const x = phaseX + (current.prey / maxPreyPhase) * phaseW;
          const y = phaseY + phaseH - (current.predator / maxPredPhase) * phaseH;
          
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Parameters panel
      const paramX = 420;
      const paramY = H - 180;
      const paramW = 200;
      const paramH = 140;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(paramX, paramY, paramW, paramH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(paramX, paramY, paramW, paramH);

      let infoY = paramY + 20;
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Lotka-Volterra Model", paramX + 10, infoY);
      infoY += 20;

      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("dN/dt = αN - βNP", paramX + 10, infoY);
      infoY += 12;
      ctx.fillText("dP/dt = δβNP - γP", paramX + 10, infoY);
      infoY += 18;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`Prey (N): ${preyPop.toFixed(1)}`, paramX + 10, infoY);
      infoY += 14;
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Predators (P): ${predatorPop.toFixed(1)}`, paramX + 10, infoY);
      infoY += 18;

      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`α (prey growth): ${preyGrowthRate.toFixed(2)}`, paramX + 10, infoY);
      infoY += 12;
      ctx.fillText(`β (predation): ${predationRate.toFixed(2)}`, paramX + 10, infoY);
      infoY += 12;
      ctx.fillText(`δ (efficiency): ${predatorEfficiency.toFixed(2)}`, paramX + 10, infoY);
      infoY += 12;
      ctx.fillText(`γ (pred. death): ${predatorDeathRate.toFixed(2)}`, paramX + 10, infoY);

      // Legend
      const legendY = 55;
      ctx.font = "11px Arial";
      ctx.textAlign = "left";

      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(30, legendY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Prey (Rabbits)", 45, legendY + 4);

      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(180, legendY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Predators (Wolves)", 195, legendY + 4);
    },

    reset() {
      time = 0;
      preyPop = 40;
      predatorPop = 20;
      initializePopulations();
    },

    destroy() {
      preyAgents = [];
      predatorAgents = [];
      populationHistory = [];
    },

    getStateDescription(): string {
      return (
        `Population Dynamics using the Lotka-Volterra model. ` +
        `Current populations: ${preyPop.toFixed(1)} prey (rabbits), ${predatorPop.toFixed(1)} predators (wolves). ` +
        `Model parameters: prey growth rate α=${preyGrowthRate.toFixed(2)}, predation rate β=${predationRate.toFixed(2)}, ` +
        `predator efficiency δ=${predatorEfficiency.toFixed(2)}, predator death rate γ=${predatorDeathRate.toFixed(2)}. ` +
        `The system shows oscillating populations where prey numbers peak first, followed by predator numbers. ` +
        `This creates a phase portrait cycle representing the predator-prey relationship balance.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default PopulationDynamicsFactory;