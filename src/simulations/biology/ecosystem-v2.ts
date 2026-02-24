import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EcosystemV2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ecosystem-v2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let herbGrowthRate = 2;
  let hareBreedRate = 1;
  let wolfBreedRate = 0.5;
  let simSpeed = 1;

  interface Creature {
    x: number;
    y: number;
    vx: number;
    vy: number;
    vitality: number;
    stamina: number;
    age: number;
    type: "herb" | "hare" | "wolf";
  }

  let creatures: Creature[] = [];
  let history: { t: number; herbs: number; hares: number; wolves: number }[] = [];
  const MAX_HISTORY = 400;
  let herbTimer = 0;

  function spawn(type: "herb" | "hare" | "wolf", x?: number, y?: number): Creature {
    const areaW = width * 0.6;
    return {
      x: x ?? 10 + Math.random() * (areaW - 20),
      y: y ?? 10 + Math.random() * (height - 20),
      vx: type === "herb" ? 0 : (Math.random() - 0.5) * 30,
      vy: type === "herb" ? 0 : (Math.random() - 0.5) * 30,
      vitality: 0.7 + Math.random() * 0.3,
      stamina: 0.5 + Math.random() * 0.5,
      age: 0,
      type,
    };
  }

  function initWorld(): void {
    creatures = [];
    history = [];
    for (let i = 0; i < 25; i++) creatures.push(spawn("herb"));
    for (let i = 0; i < 12; i++) creatures.push(spawn("hare"));
    for (let i = 0; i < 4; i++) creatures.push(spawn("wolf"));
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    herbTimer = 0;
    initWorld();
  }

  function dist(a: Creature, b: Creature): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function update(dt: number, params: Record<string, number>): void {
    herbGrowthRate = params.herbGrowthRate ?? 2;
    hareBreedRate = params.hareBreedRate ?? 1;
    wolfBreedRate = params.wolfBreedRate ?? 0.5;
    simSpeed = params.simSpeed ?? 1;

    const sDt = dt * simSpeed;
    time += sDt;
    const areaW = width * 0.6;

    // Spawn herbs
    herbTimer += sDt;
    const herbCount = creatures.filter((c) => c.type === "herb").length;
    if (herbTimer > (3 - herbGrowthRate * 0.8) && herbCount < 80) {
      creatures.push(spawn("herb"));
      herbTimer = 0;
    }

    const newCreatures: Creature[] = [];

    for (const c of creatures) {
      c.age += sDt;

      if (c.type === "herb") {
        c.vitality -= sDt * 0.008;
        continue;
      }

      // Animals
      const isHare = c.type === "hare";
      c.vitality -= sDt * (isHare ? 0.035 : 0.025);
      c.stamina -= sDt * (isHare ? 0.055 : 0.035);

      const prey = isHare ? "herb" : "hare";
      const preyList = creatures.filter((p) => p.type === prey);

      // Seek food
      if (c.stamina < 0.6 && preyList.length > 0) {
        let nearest = preyList[0];
        let minD = dist(c, nearest);
        for (const p of preyList) {
          const d = dist(c, p);
          if (d < minD) { nearest = p; minD = d; }
        }

        const dx = nearest.x - c.x;
        const dy = nearest.y - c.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = isHare ? 45 : 38;
        c.vx += (dx / d) * speed * sDt;
        c.vy += (dy / d) * speed * sDt;

        if (minD < 12) {
          c.stamina = Math.min(1, c.stamina + (isHare ? 0.25 : 0.35));
          nearest.vitality = -1; // mark for removal
        }
      } else {
        c.vx += (Math.random() - 0.5) * 15 * sDt;
        c.vy += (Math.random() - 0.5) * 15 * sDt;
      }

      // Hares flee wolves
      if (isHare) {
        for (const w of creatures) {
          if (w.type === "wolf" && dist(c, w) < 55) {
            c.vx -= (w.x - c.x) * 0.5;
            c.vy -= (w.y - c.y) * 0.5;
          }
        }
      }

      // Breeding
      const breedChance = isHare ? 0.002 * hareBreedRate : 0.001 * wolfBreedRate;
      const maxPop = isHare ? 40 : 12;
      const samePop = creatures.filter((p) => p.type === c.type).length;
      if (c.stamina > 0.5 && c.vitality > 0.4 && samePop < maxPop && Math.random() < breedChance) {
        const baby = spawn(c.type, c.x + (Math.random() - 0.5) * 15, c.y + (Math.random() - 0.5) * 15);
        baby.vitality = 0.6;
        baby.stamina = 0.4;
        newCreatures.push(baby);
      }

      // Clamp velocity
      const speed = Math.sqrt(c.vx ** 2 + c.vy ** 2);
      const maxSpeed = isHare ? 70 : 55;
      if (speed > maxSpeed) { c.vx *= maxSpeed / speed; c.vy *= maxSpeed / speed; }

      c.x += c.vx * sDt;
      c.y += c.vy * sDt;
      c.vx *= 0.93;
      c.vy *= 0.93;

      // Bounds
      if (c.x < 5) { c.x = 5; c.vx = Math.abs(c.vx); }
      if (c.x > areaW - 5) { c.x = areaW - 5; c.vx = -Math.abs(c.vx); }
      if (c.y < 5) { c.y = 5; c.vy = Math.abs(c.vy); }
      if (c.y > height - 5) { c.y = height - 5; c.vy = -Math.abs(c.vy); }
    }

    // Remove dead, add newborns
    creatures = creatures.filter((c) => c.vitality > 0 && (c.type === "herb" || c.stamina > 0));
    creatures.push(...newCreatures);

    // Record history
    if (Math.floor(time * 4) > Math.floor((time - sDt) * 4)) {
      const herbs = creatures.filter((c) => c.type === "herb").length;
      const hares = creatures.filter((c) => c.type === "hare").length;
      const wolves = creatures.filter((c) => c.type === "wolf").length;
      history.push({ t: time, herbs, hares, wolves });
      if (history.length > MAX_HISTORY) history.shift();
    }
  }

  function render(): void {
    const areaW = width * 0.6;

    // Nature background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#7ec8e3");
    bg.addColorStop(0.25, "#87CEEB");
    bg.addColorStop(0.3, "#4a8c3f");
    bg.addColorStop(1, "#2d6a2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, areaW, height);

    // Some grass tufts
    ctx.fillStyle = "rgba(34,120,34,0.3)";
    for (let i = 0; i < 30; i++) {
      const gx = (i * 67.3) % areaW;
      const gy = height * 0.35 + (i * 43.7) % (height * 0.6);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 3, gy - 8);
      ctx.lineTo(gx + 3, gy - 6);
      ctx.fill();
    }

    // Draw creatures
    for (const c of creatures) {
      // Health bar
      if (c.type !== "herb") {
        const bw = 14;
        ctx.fillStyle = "rgba(80,0,0,0.6)";
        ctx.fillRect(c.x - bw / 2, c.y - 12, bw, 2);
        ctx.fillStyle = `rgb(${Math.round(255 * (1 - c.vitality))},${Math.round(255 * c.vitality)},0)`;
        ctx.fillRect(c.x - bw / 2, c.y - 12, bw * c.vitality, 2);

        ctx.fillStyle = "rgba(0,80,0,0.6)";
        ctx.fillRect(c.x - bw / 2, c.y - 9, bw, 2);
        ctx.fillStyle = "#44dd44";
        ctx.fillRect(c.x - bw / 2, c.y - 9, bw * c.stamina, 2);
      }

      if (c.type === "herb") {
        // Green plant
        ctx.fillStyle = "#33aa33";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#228822";
        ctx.fillRect(c.x - 1, c.y, 2, 5);
      } else if (c.type === "hare") {
        // Brown rabbit
        ctx.fillStyle = "#c49a6c";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.fillStyle = "#b88a5c";
        ctx.beginPath();
        ctx.ellipse(c.x - 3, c.y - 6, 2, 4, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c.x + 3, c.y - 6, 2, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Eye
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(c.x + 2, c.y - 1, 1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Gray wolf
        ctx.fillStyle = "#666";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.fillStyle = "#555";
        ctx.beginPath();
        ctx.moveTo(c.x - 5, c.y - 5);
        ctx.lineTo(c.x - 7, c.y - 10);
        ctx.lineTo(c.x - 2, c.y - 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c.x + 5, c.y - 5);
        ctx.lineTo(c.x + 7, c.y - 10);
        ctx.lineTo(c.x + 2, c.y - 5);
        ctx.fill();
        // Eye
        ctx.fillStyle = "#ff0";
        ctx.beginPath();
        ctx.arc(c.x + 3, c.y - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Right panel
    ctx.fillStyle = "rgba(10,10,20,0.9)";
    ctx.fillRect(areaW, 0, width - areaW, height);

    const panelX = areaW + 12;
    const panelW = width - areaW - 24;

    // Title
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ecosystem v2", areaW + (width - areaW) / 2, 22);

    // Population counters
    const herbs = creatures.filter((c) => c.type === "herb").length;
    const hares = creatures.filter((c) => c.type === "hare").length;
    const wolves = creatures.filter((c) => c.type === "wolf").length;

    const counters = [
      { label: "Herbs", count: herbs, color: "#33aa33", icon: "🌿" },
      { label: "Hares", count: hares, color: "#c49a6c", icon: "🐇" },
      { label: "Wolves", count: wolves, color: "#888", icon: "🐺" },
    ];

    for (let i = 0; i < counters.length; i++) {
      const cy = 42 + i * 22;
      ctx.fillStyle = counters[i].color;
      ctx.fillRect(panelX, cy, 10, 10);
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${counters[i].label}: ${counters[i].count}`, panelX + 16, cy + 9);
    }

    // Graph
    const graphY = 110;
    const graphH = height * 0.45;

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX, graphY);
    ctx.lineTo(panelX, graphY + graphH);
    ctx.lineTo(panelX + panelW, graphY + graphH);
    ctx.stroke();

    if (history.length > 1) {
      const maxPop = Math.max(5, ...history.map((h) => Math.max(h.herbs, h.hares, h.wolves)));
      const speciesColors = { herbs: "#33aa33", hares: "#c49a6c", wolves: "#888" };

      for (const key of ["herbs", "hares", "wolves"] as const) {
        ctx.strokeStyle = speciesColors[key];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < history.length; i++) {
          const x = panelX + (i / MAX_HISTORY) * panelW;
          const y = graphY + graphH - (history[i][key] / maxPop) * graphH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Food chain diagram
    const chainY = graphY + graphH + 30;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const chainCX = areaW + (width - areaW) / 2;
    ctx.fillText("Food Chain", chainCX, chainY);

    ctx.fillText("🐺 Wolves", chainCX, chainY + 20);
    ctx.fillText("↓ eat", chainCX, chainY + 35);
    ctx.fillText("🐇 Hares", chainCX, chainY + 50);
    ctx.fillText("↓ eat", chainCX, chainY + 65);
    ctx.fillText("🌿 Herbs", chainCX, chainY + 80);

    // Time
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX, height - 8);
  }

  function reset(): void {
    time = 0;
    herbTimer = 0;
    initWorld();
  }

  function destroy(): void {
    creatures = [];
    history = [];
  }

  function getStateDescription(): string {
    const herbs = creatures.filter((c) => c.type === "herb").length;
    const hares = creatures.filter((c) => c.type === "hare").length;
    const wolves = creatures.filter((c) => c.type === "wolf").length;
    return (
      `Ecosystem v2: herbs=${herbs}, hares=${hares}, wolves=${wolves}, time=${time.toFixed(1)}s. ` +
      `Herb growth rate=${herbGrowthRate}, hare breed rate=${hareBreedRate}, wolf breed rate=${wolfBreedRate}. ` +
      `Each creature has vitality (depletes over time) and stamina (depletes when hungry). ` +
      `Populations oscillate: more predators → fewer prey → fewer predators → prey recovery (Lotka-Volterra cycles).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EcosystemV2Factory;
