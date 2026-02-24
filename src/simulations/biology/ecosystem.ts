import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EcosystemFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ecosystem") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let initialHerbs = 30;
  let initialHares = 10;
  let initialWolves = 3;

  interface Organism {
    x: number;
    y: number;
    vx: number;
    vy: number;
    vitality: number; // 0-1, dies at 0
    stamina: number; // 0-1, starves at 0
    age: number;
  }

  let herbs: Organism[] = [];
  let hares: Organism[] = [];
  let wolves: Organism[] = [];

  // Population history for graph
  let history: { herbs: number; hares: number; wolves: number }[] = [];
  const MAX_HISTORY = 300;

  let herbSpawnTimer = 0;

  function randomOrg(areaW: number, areaH: number): Organism {
    return {
      x: 20 + Math.random() * (areaW - 40),
      y: 20 + Math.random() * (areaH - 40),
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      vitality: 0.8 + Math.random() * 0.2,
      stamina: 0.6 + Math.random() * 0.4,
      age: 0,
    };
  }

  function initPopulations(): void {
    const areaW = width * 0.65;
    const areaH = height;
    herbs = [];
    hares = [];
    wolves = [];
    history = [];

    for (let i = 0; i < initialHerbs; i++) herbs.push(randomOrg(areaW, areaH));
    for (let i = 0; i < initialHares; i++) hares.push(randomOrg(areaW, areaH));
    for (let i = 0; i < initialWolves; i++) wolves.push(randomOrg(areaW, areaH));
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    herbSpawnTimer = 0;
    initPopulations();
  }

  function distance(a: Organism, b: Organism): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function moveToward(org: Organism, tx: number, ty: number, speed: number): void {
    const dx = tx - org.x;
    const dy = ty - org.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    org.vx += (dx / d) * speed;
    org.vy += (dy / d) * speed;
  }

  function update(dt: number, params: Record<string, number>): void {
    initialHerbs = Math.round(params.initialHerbs ?? 30);
    initialHares = Math.round(params.initialHares ?? 10);
    initialWolves = Math.round(params.initialWolves ?? 3);
    time += dt;

    const areaW = width * 0.65;

    // Spawn herbs periodically
    herbSpawnTimer += dt;
    if (herbSpawnTimer > 1.5 && herbs.length < 60) {
      herbs.push(randomOrg(areaW, height));
      herbSpawnTimer = 0;
    }

    // Update herbs
    for (const h of herbs) {
      h.age += dt;
      h.vitality -= dt * 0.01; // herbs die slowly
    }
    herbs = herbs.filter((h) => h.vitality > 0);

    // Update hares
    for (const hare of hares) {
      hare.age += dt;
      hare.vitality -= dt * 0.04;
      hare.stamina -= dt * 0.06;

      // Seek food when hungry
      if (hare.stamina < 0.5 && herbs.length > 0) {
        let nearest = herbs[0];
        let minDist = distance(hare, nearest);
        for (const h of herbs) {
          const d = distance(hare, h);
          if (d < minDist) { nearest = h; minDist = d; }
        }
        moveToward(hare, nearest.x, nearest.y, 40);

        // Eat
        if (minDist < 15) {
          hare.stamina = Math.min(1, hare.stamina + 0.3);
          herbs.splice(herbs.indexOf(nearest), 1);
        }
      } else {
        // Random wander
        hare.vx += (Math.random() - 0.5) * 20;
        hare.vy += (Math.random() - 0.5) * 20;
      }

      // Flee from wolves
      for (const w of wolves) {
        if (distance(hare, w) < 60) {
          moveToward(hare, hare.x - (w.x - hare.x), hare.y - (w.y - hare.y), 50);
        }
      }

      // Reproduce
      if (hare.stamina > 0.5 && hare.vitality > 0.5 && hares.length < 50 && Math.random() < 0.002) {
        const baby = randomOrg(areaW, height);
        baby.x = hare.x + (Math.random() - 0.5) * 20;
        baby.y = hare.y + (Math.random() - 0.5) * 20;
        baby.vitality = 0.7;
        baby.stamina = 0.5;
        hares.push(baby);
      }

      // Move
      const speed = Math.sqrt(hare.vx ** 2 + hare.vy ** 2);
      if (speed > 60) { hare.vx *= 60 / speed; hare.vy *= 60 / speed; }
      hare.x += hare.vx * dt;
      hare.y += hare.vy * dt;
      hare.vx *= 0.95;
      hare.vy *= 0.95;

      // Bounds
      if (hare.x < 5) { hare.x = 5; hare.vx = Math.abs(hare.vx); }
      if (hare.x > areaW - 5) { hare.x = areaW - 5; hare.vx = -Math.abs(hare.vx); }
      if (hare.y < 5) { hare.y = 5; hare.vy = Math.abs(hare.vy); }
      if (hare.y > height - 5) { hare.y = height - 5; hare.vy = -Math.abs(hare.vy); }
    }
    hares = hares.filter((h) => h.vitality > 0 && h.stamina > 0);

    // Update wolves
    for (const wolf of wolves) {
      wolf.age += dt;
      wolf.vitality -= dt * 0.03;
      wolf.stamina -= dt * 0.04;

      // Hunt hares
      if (wolf.stamina < 0.6 && hares.length > 0) {
        let nearest = hares[0];
        let minDist = distance(wolf, nearest);
        for (const h of hares) {
          const d = distance(wolf, h);
          if (d < minDist) { nearest = h; minDist = d; }
        }
        moveToward(wolf, nearest.x, nearest.y, 35);

        // Catch and eat
        if (minDist < 12) {
          wolf.stamina = Math.min(1, wolf.stamina + 0.4);
          hares.splice(hares.indexOf(nearest), 1);
        }
      } else {
        wolf.vx += (Math.random() - 0.5) * 15;
        wolf.vy += (Math.random() - 0.5) * 15;
      }

      // Reproduce
      if (wolf.vitality > 0.4 && wolf.stamina > 0.3 && wolves.length < 15 && Math.random() < 0.001) {
        const baby = randomOrg(areaW, height);
        baby.x = wolf.x + (Math.random() - 0.5) * 20;
        baby.y = wolf.y + (Math.random() - 0.5) * 20;
        baby.vitality = 0.6;
        baby.stamina = 0.5;
        wolves.push(baby);
      }

      // Move
      const speed = Math.sqrt(wolf.vx ** 2 + wolf.vy ** 2);
      if (speed > 50) { wolf.vx *= 50 / speed; wolf.vy *= 50 / speed; }
      wolf.x += wolf.vx * dt;
      wolf.y += wolf.vy * dt;
      wolf.vx *= 0.95;
      wolf.vy *= 0.95;

      if (wolf.x < 5) { wolf.x = 5; wolf.vx = Math.abs(wolf.vx); }
      if (wolf.x > areaW - 5) { wolf.x = areaW - 5; wolf.vx = -Math.abs(wolf.vx); }
      if (wolf.y < 5) { wolf.y = 5; wolf.vy = Math.abs(wolf.vy); }
      if (wolf.y > height - 5) { wolf.y = height - 5; wolf.vy = -Math.abs(wolf.vy); }
    }
    wolves = wolves.filter((w) => w.vitality > 0 && w.stamina > 0);

    // Record history
    if (Math.floor(time * 5) > Math.floor((time - dt) * 5)) {
      history.push({ herbs: herbs.length, hares: hares.length, wolves: wolves.length });
      if (history.length > MAX_HISTORY) history.shift();
    }
  }

  function drawOrganism(org: Organism, color: string, size: number, shape: "circle" | "triangle" | "square"): void {
    // Health bars
    const barW = size * 2;
    const barH = 2;
    // Vitality (red)
    ctx.fillStyle = "rgba(100,0,0,0.5)";
    ctx.fillRect(org.x - barW / 2, org.y - size - 6, barW, barH);
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(org.x - barW / 2, org.y - size - 6, barW * org.vitality, barH);
    // Stamina (green)
    ctx.fillStyle = "rgba(0,100,0,0.5)";
    ctx.fillRect(org.x - barW / 2, org.y - size - 3, barW, barH);
    ctx.fillStyle = "#44ff44";
    ctx.fillRect(org.x - barW / 2, org.y - size - 3, barW * org.stamina, barH);

    ctx.fillStyle = color;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(org.x, org.y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === "triangle") {
      ctx.beginPath();
      ctx.moveTo(org.x, org.y - size);
      ctx.lineTo(org.x - size, org.y + size);
      ctx.lineTo(org.x + size, org.y + size);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(org.x - size, org.y - size, size * 2, size * 2);
    }
  }

  function render(): void {
    const areaW = width * 0.65;

    // Grassland background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#87CEEB");
    bg.addColorStop(0.3, "#87CEEB");
    bg.addColorStop(0.35, "#228B22");
    bg.addColorStop(1, "#1a5e1a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, areaW, height);

    // Draw organisms
    for (const h of herbs) drawOrganism(h, "#22aa22", 5, "square");
    for (const h of hares) drawOrganism(h, "#cc8844", 6, "circle");
    for (const w of wolves) drawOrganism(w, "#666666", 7, "triangle");

    // Separator
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(areaW, 0, width - areaW, height);

    // Population graph
    const graphX = areaW + 15;
    const graphY = 30;
    const graphW = width - areaW - 30;
    const graphH = height * 0.55;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Population Over Time", graphX + graphW / 2, 20);

    // Graph axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY);
    ctx.lineTo(graphX, graphY + graphH);
    ctx.lineTo(graphX + graphW, graphY + graphH);
    ctx.stroke();

    if (history.length > 1) {
      const maxPop = Math.max(10, ...history.map((h) => Math.max(h.herbs, h.hares, h.wolves)));

      // Draw lines for each species
      const colors = { herbs: "#22aa22", hares: "#cc8844", wolves: "#888888" };
      for (const species of ["herbs", "hares", "wolves"] as const) {
        ctx.strokeStyle = colors[species];
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < history.length; i++) {
          const x = graphX + (i / MAX_HISTORY) * graphW;
          const y = graphY + graphH - (history[i][species] / maxPop) * graphH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Legend
    const legendY = graphY + graphH + 20;
    const items = [
      { label: `Herbs: ${herbs.length}`, color: "#22aa22" },
      { label: `Hares: ${hares.length}`, color: "#cc8844" },
      { label: `Wolves: ${wolves.length}`, color: "#888888" },
    ];

    for (let i = 0; i < items.length; i++) {
      const ly = legendY + i * 22;
      ctx.fillStyle = items[i].color;
      ctx.fillRect(graphX, ly, 12, 12);
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(items[i].label, graphX + 18, ly + 10);
    }

    // Time
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, graphX, height - 10);

    // Explanation
    const expY = legendY + 80;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    const lines = [
      "Predator-prey dynamics:",
      "• Herbs grow naturally",
      "• Hares eat herbs",
      "• Wolves hunt hares",
      "• Populations cycle in",
      "  dynamic equilibrium",
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], graphX, expY + i * 14);
    }
  }

  function reset(): void {
    time = 0;
    herbSpawnTimer = 0;
    initPopulations();
  }

  function destroy(): void {
    herbs = [];
    hares = [];
    wolves = [];
    history = [];
  }

  function getStateDescription(): string {
    return (
      `Ecosystem: herbs=${herbs.length}, hares=${hares.length}, wolves=${wolves.length}. ` +
      `Time: ${time.toFixed(1)}s. ` +
      `Predator-prey dynamics: wolves eat hares, hares eat herbs. ` +
      `Populations oscillate in cycles (Lotka-Volterra model). ` +
      `When predators increase, prey decreases; when prey is scarce, predators decline, allowing prey recovery.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EcosystemFactory;
