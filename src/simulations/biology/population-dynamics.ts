import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const PopulationDynamicsFactory: SimulationFactory = () => {
  const config = getSimConfig("population-dynamics")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800, H = 600, time = 0;

  // Lotka-Volterra parameters
  let preyGrowthRate = 0.8, predationRate = 0.4, predatorEfficiency = 0.3, predatorDeathRate = 0.5;
  let preyPop = 40, predatorPop = 20;

  // History for graphing
  const preyHistory: number[] = [];
  const predatorHistory: number[] = [];
  const maxHistory = 500;

  // Animated creatures
  interface Creature { x: number; y: number; vx: number; vy: number; type: "prey" | "predator"; }
  let creatures: Creature[] = [];

  function syncCreatures() {
    const targetPrey = Math.min(80, Math.round(preyPop));
    const targetPred = Math.min(40, Math.round(predatorPop));
    const currentPrey = creatures.filter(c => c.type === "prey").length;
    const currentPred = creatures.filter(c => c.type === "predator").length;

    // Add/remove prey
    for (let i = currentPrey; i < targetPrey; i++) {
      creatures.push({ x: Math.random() * W * 0.6 + W * 0.02, y: Math.random() * H * 0.35 + H * 0.08, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, type: "prey" });
    }
    if (currentPrey > targetPrey) {
      let removed = 0;
      creatures = creatures.filter(c => { if (c.type === "prey" && removed < currentPrey - targetPrey) { removed++; return false; } return true; });
    }

    // Add/remove predators
    for (let i = currentPred; i < targetPred; i++) {
      creatures.push({ x: Math.random() * W * 0.6 + W * 0.02, y: Math.random() * H * 0.35 + H * 0.08, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, type: "predator" });
    }
    if (currentPred > targetPred) {
      let removed = 0;
      creatures = creatures.filter(c => { if (c.type === "predator" && removed < currentPred - targetPred) { removed++; return false; } return true; });
    }
  }

  function drawEcosystem() {
    // Background
    const grad = ctx.createLinearGradient(0, H * 0.05, 0, H * 0.48);
    grad.addColorStop(0, "#0c4a1a");
    grad.addColorStop(1, "#1a3a0c");
    ctx.fillStyle = grad;
    ctx.fillRect(W * 0.01, H * 0.05, W * 0.62, H * 0.43);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(W * 0.01, H * 0.05, W * 0.62, H * 0.43);

    // Creatures
    for (const c of creatures) {
      if (c.type === "prey") {
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        // Triangle for predator
        ctx.moveTo(c.x, c.y - 6);
        ctx.lineTo(c.x - 5, c.y + 4);
        ctx.lineTo(c.x + 5, c.y + 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Legend
    ctx.font = "11px Arial";
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "left";
    ctx.fillText("● Prey", W * 0.03, H * 0.07 + 12);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("▲ Predator", W * 0.12, H * 0.07 + 12);
  }

  function drawPopulationGraph() {
    const gx = W * 0.01, gy = H * 0.5, gw = W * 0.62, gh = H * 0.46;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Population Over Time", gx + gw / 2, gy + 16);

    if (preyHistory.length < 2) return;

    const maxVal = Math.max(1, ...preyHistory, ...predatorHistory) * 1.1;

    // Y-axis
    ctx.font = "9px monospace";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const v = (maxVal * i) / 4;
      const py = gy + gh - 15 - ((v / maxVal) * (gh - 35));
      ctx.fillText(v.toFixed(0), gx + 28, py + 3);
      ctx.strokeStyle = "rgba(71, 85, 105, 0.2)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(gx + 32, py);
      ctx.lineTo(gx + gw - 5, py);
      ctx.stroke();
    }

    // Prey line
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < preyHistory.length; i++) {
      const px = gx + 35 + (i / maxHistory) * (gw - 45);
      const py = gy + gh - 15 - ((preyHistory[i] / maxVal) * (gh - 35));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Predator line
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < predatorHistory.length; i++) {
      const px = gx + 35 + (i / maxHistory) * (gw - 45);
      const py = gy + gh - 15 - ((predatorHistory[i] / maxVal) * (gh - 35));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Legend
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`Prey: ${preyPop.toFixed(1)}`, gx + gw - 160, gy + gh - 5);
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Predator: ${predatorPop.toFixed(1)}`, gx + gw - 80, gy + gh - 5);
  }

  function drawPhasePortrait() {
    const gx = W * 0.65, gy = H * 0.05, gw = W * 0.33, gh = H * 0.43;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Phase Portrait", gx + gw / 2, gy + 16);

    ctx.font = "9px Arial";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Prey →", gx + gw / 2, gy + gh - 3);
    ctx.save();
    ctx.translate(gx + 10, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Predator →", 0, 0);
    ctx.restore();

    if (preyHistory.length < 2) return;

    const maxPrey = Math.max(1, ...preyHistory) * 1.1;
    const maxPred = Math.max(1, ...predatorHistory) * 1.1;

    ctx.strokeStyle = "rgba(250, 204, 21, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < preyHistory.length; i++) {
      const px = gx + 20 + (preyHistory[i] / maxPrey) * (gw - 30);
      const py = gy + gh - 20 - (predatorHistory[i] / maxPred) * (gh - 35);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Current point
    const cx = gx + 20 + (preyPop / maxPrey) * (gw - 30);
    const cy = gy + gh - 20 - (predatorPop / maxPred) * (gh - 35);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEquations() {
    const gx = W * 0.65, gy = H * 0.5, gw = W * 0.33, gh = H * 0.46;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Lotka-Volterra Equations", gx + 10, gy + 20);

    ctx.font = "13px monospace";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("dN/dt = αN − βNP", gx + 10, gy + 44);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("dP/dt = δβNP − γP", gx + 10, gy + 64);

    ctx.font = "11px Arial";
    ctx.fillStyle = "#94a3b8";
    const y0 = gy + 90;
    ctx.fillText(`α (prey growth) = ${preyGrowthRate.toFixed(2)}`, gx + 10, y0);
    ctx.fillText(`β (predation) = ${predationRate.toFixed(2)}`, gx + 10, y0 + 18);
    ctx.fillText(`δ (efficiency) = ${predatorEfficiency.toFixed(2)}`, gx + 10, y0 + 36);
    ctx.fillText(`γ (predator death) = ${predatorDeathRate.toFixed(2)}`, gx + 10, y0 + 54);

    // Equilibrium point
    const eqPrey = predatorDeathRate / (predatorEfficiency * predationRate);
    const eqPred = preyGrowthRate / predationRate;
    ctx.fillStyle = "#64748b";
    ctx.font = "11px Arial";
    ctx.fillText("Equilibrium:", gx + 10, y0 + 82);
    ctx.fillText(`  N* = ${eqPrey.toFixed(1)}, P* = ${eqPred.toFixed(1)}`, gx + 10, y0 + 98);

    ctx.font = "10px Arial";
    ctx.fillStyle = "#475569";
    ctx.fillText("Oscillatory dynamics: populations", gx + 10, gy + gh - 30);
    ctx.fillText("cycle with predators lagging prey.", gx + 10, gy + gh - 15);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height;
      time = 0; preyPop = 40; predatorPop = 20;
      preyHistory.length = 0; predatorHistory.length = 0;
      creatures = [];
    },
    update(dt, params) {
      preyGrowthRate = params.preyGrowthRate ?? preyGrowthRate;
      predationRate = params.predationRate ?? predationRate;
      predatorEfficiency = params.predatorEfficiency ?? predatorEfficiency;
      predatorDeathRate = params.predatorDeathRate ?? predatorDeathRate;
      time += dt;

      // Lotka-Volterra with RK2
      const dN1 = preyGrowthRate * preyPop - predationRate * preyPop * predatorPop;
      const dP1 = predatorEfficiency * predationRate * preyPop * predatorPop - predatorDeathRate * predatorPop;
      const midN = Math.max(0, preyPop + dN1 * dt * 0.5);
      const midP = Math.max(0, predatorPop + dP1 * dt * 0.5);
      const dN2 = preyGrowthRate * midN - predationRate * midN * midP;
      const dP2 = predatorEfficiency * predationRate * midN * midP - predatorDeathRate * midP;
      preyPop = Math.max(0, preyPop + dN2 * dt);
      predatorPop = Math.max(0, predatorPop + dP2 * dt);

      // Record history
      preyHistory.push(preyPop);
      predatorHistory.push(predatorPop);
      if (preyHistory.length > maxHistory) {
        preyHistory.shift();
        predatorHistory.shift();
      }

      // Sync visual creatures
      syncCreatures();

      // Animate creatures
      for (const c of creatures) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        // Bounce
        if (c.x < W * 0.03 || c.x > W * 0.61) c.vx *= -1;
        if (c.y < H * 0.08 || c.y > H * 0.45) c.vy *= -1;
        c.x = Math.max(W * 0.03, Math.min(W * 0.61, c.x));
        c.y = Math.max(H * 0.08, Math.min(H * 0.45, c.y));
        // Random direction changes
        if (Math.random() < dt * 2) {
          c.vx += (Math.random() - 0.5) * 30;
          c.vy += (Math.random() - 0.5) * 30;
          const speed = c.type === "prey" ? 40 : 60;
          const mag = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
          if (mag > speed) { c.vx *= speed / mag; c.vy *= speed / mag; }
        }
      }
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Population Dynamics: Lotka-Volterra", W / 2, 28);

      drawEcosystem();
      drawPopulationGraph();
      drawPhasePortrait();
      drawEquations();
    },
    reset() {
      time = 0; preyPop = 40; predatorPop = 20;
      preyHistory.length = 0; predatorHistory.length = 0;
      creatures = [];
    },
    destroy() {},
    getStateDescription() {
      const eqPrey = predatorDeathRate / (predatorEfficiency * predationRate);
      const eqPred = preyGrowthRate / predationRate;
      return `Lotka-Volterra predator-prey: ${preyPop.toFixed(1)} prey, ${predatorPop.toFixed(1)} predators. Equilibrium at N*=${eqPrey.toFixed(1)}, P*=${eqPred.toFixed(1)}. Parameters: α=${preyGrowthRate}, β=${predationRate}, δ=${predatorEfficiency}, γ=${predatorDeathRate}.`;
    },
    resize(w, h) { W = w; H = h; }
  };
  return engine;
};

export default PopulationDynamicsFactory;
