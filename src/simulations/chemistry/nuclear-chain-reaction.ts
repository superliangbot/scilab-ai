import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NuclearChainReactionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("nuclear-chain-reaction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let enrichment = 50; // % U-235
  let controlRods = 50; // % inserted (absorb neutrons)
  let initialNeutrons = 1;
  let showStats = 1;

  // Particle system
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "neutron" | "U235" | "U238" | "fission" | "fragment";
    radius: number;
    life: number;
    maxLife: number;
    fissioned: boolean;
  }
  let particles: Particle[] = [];

  // Stats
  let fissionCount = 0;
  let generation = 0;
  let neutronsPerGeneration: number[] = [];
  let kEffective = 1;
  let energyReleased = 0;

  // Grid of uranium atoms
  const GRID_COLS = 16;
  const GRID_ROWS = 12;
  let atomGrid: Array<{ x: number; y: number; type: "U235" | "U238"; fissioned: boolean }> = [];

  function initGrid(): void {
    atomGrid = [];
    const marginX = 80;
    const marginY = 80;
    const spacingX = (width - marginX * 2) / (GRID_COLS - 1);
    const spacingY = (height * 0.65 - marginY) / (GRID_ROWS - 1);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const isU235 = Math.random() * 100 < enrichment;
        atomGrid.push({
          x: marginX + c * spacingX + (Math.random() - 0.5) * 8,
          y: marginY + r * spacingY + (Math.random() - 0.5) * 8,
          type: isU235 ? "U235" : "U238",
          fissioned: false,
        });
      }
    }
  }

  function spawnNeutron(x: number, y: number): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 150;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      type: "neutron",
      radius: 3,
      life: 0,
      maxLife: 5,
      fissioned: false,
    });
  }

  function spawnFissionFragments(x: number, y: number): void {
    // Release 2-3 neutrons and 2 fission fragments
    const numNeutrons = 2 + (Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < numNeutrons; i++) {
      // Control rods absorb some neutrons
      if (Math.random() * 100 < controlRods) continue;
      spawnNeutron(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
    }

    // Fission fragments
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      particles.push({
        x: x + (Math.random() - 0.5) * 5,
        y: y + (Math.random() - 0.5) * 5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        type: "fragment",
        radius: 5,
        life: 0,
        maxLife: 1.5,
        fissioned: false,
      });
    }

    // Flash effect
    particles.push({
      x, y,
      vx: 0, vy: 0,
      type: "fission",
      radius: 30,
      life: 0,
      maxLife: 0.4,
      fissioned: false,
    });
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    particles = [];
    fissionCount = 0;
    generation = 0;
    neutronsPerGeneration = [];
    energyReleased = 0;
    initGrid();

    // Spawn initial neutrons
    for (let i = 0; i < initialNeutrons; i++) {
      spawnNeutron(width / 2 + (Math.random() - 0.5) * 50, height * 0.05);
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    const newEnrichment = params.enrichment ?? 50;
    const newInitial = Math.round(params.initialNeutrons ?? 1);

    if (Math.abs(newEnrichment - enrichment) > 1) {
      enrichment = newEnrichment;
      initGrid();
    }

    controlRods = params.controlRods ?? 50;
    initialNeutrons = newInitial;
    showStats = params.showStats ?? 1;

    time += dt;

    // Track neutrons per generation
    const currentNeutrons = particles.filter(p => p.type === "neutron").length;

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;

      if (p.life > p.maxLife) {
        particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Boundary
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        particles.splice(i, 1);
        continue;
      }

      // Neutron-atom interactions
      if (p.type === "neutron") {
        for (const atom of atomGrid) {
          if (atom.fissioned) continue;

          const dx = p.x - atom.x;
          const dy = p.y - atom.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 12) {
            if (atom.type === "U235") {
              // Fission!
              atom.fissioned = true;
              fissionCount++;
              generation++;
              energyReleased += 200; // MeV per fission
              spawnFissionFragments(atom.x, atom.y);
              particles.splice(i, 1);
              break;
            } else {
              // U-238 captures neutron (no fission at thermal energies usually)
              if (Math.random() < 0.3) {
                particles.splice(i, 1);
                break;
              }
            }
          }
        }
      }

      // Slow down fragments
      if (p.type === "fragment") {
        p.vx *= 0.97;
        p.vy *= 0.97;
      }
    }

    // k-effective calculation
    neutronsPerGeneration.push(currentNeutrons);
    if (neutronsPerGeneration.length > 60) neutronsPerGeneration.shift();
    if (neutronsPerGeneration.length > 2) {
      const recent = neutronsPerGeneration.slice(-10);
      const old = neutronsPerGeneration.slice(-20, -10);
      if (old.length > 0) {
        const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
        const avgOld = old.reduce((a, b) => a + b, 0) / old.length;
        kEffective = avgOld > 0 ? avgRecent / avgOld : 1;
      }
    }

    // Auto-restart if all neutrons gone and some atoms left
    if (particles.filter(p => p.type === "neutron").length === 0 && time > 2) {
      const remaining = atomGrid.filter(a => !a.fissioned && a.type === "U235").length;
      if (remaining > 0) {
        time = 0;
        for (let i = 0; i < initialNeutrons; i++) {
          spawnNeutron(width / 2 + (Math.random() - 0.5) * 100, height * 0.05);
        }
      }
    }
  }

  function drawAtoms(): void {
    for (const atom of atomGrid) {
      if (atom.fissioned) {
        // Fissioned atom remnant
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 100, 100, 0.2)";
        ctx.fill();
        continue;
      }

      const grad = ctx.createRadialGradient(atom.x - 1, atom.y - 1, 0, atom.x, atom.y, 8);
      if (atom.type === "U235") {
        grad.addColorStop(0, "#60a5fa");
        grad.addColorStop(1, "#1d4ed8");
      } else {
        grad.addColorStop(0, "#94a3b8");
        grad.addColorStop(1, "#475569");
      }

      ctx.beginPath();
      ctx.arc(atom.x, atom.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 6px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(atom.type === "U235" ? "235" : "238", atom.x, atom.y);
    }
  }

  function drawParticles(): void {
    for (const p of particles) {
      const lifeRatio = 1 - p.life / p.maxLife;

      if (p.type === "neutron") {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
        glow.addColorStop(0, `rgba(34, 197, 94, ${lifeRatio * 0.5})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 197, 94, ${lifeRatio})`;
        ctx.fill();
      } else if (p.type === "fragment") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * lifeRatio, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${lifeRatio * 0.8})`;
        ctx.fill();
      } else if (p.type === "fission") {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * lifeRatio);
        glow.addColorStop(0, `rgba(255, 255, 255, ${lifeRatio * 0.8})`);
        glow.addColorStop(0.3, `rgba(251, 191, 36, ${lifeRatio * 0.6})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (2 - lifeRatio), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawControlRods(): void {
    // Visual control rod indicators at the top
    const rodWidth = 8;
    const maxRodHeight = height * 0.3;
    const rodHeight = maxRodHeight * (controlRods / 100);
    const numRods = 5;
    const spacing = (width - 200) / (numRods + 1);

    for (let i = 0; i < numRods; i++) {
      const rx = 100 + (i + 1) * spacing;

      ctx.fillStyle = "rgba(107, 114, 128, 0.6)";
      ctx.fillRect(rx - rodWidth / 2, 0, rodWidth, rodHeight);

      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      ctx.strokeRect(rx - rodWidth / 2, 0, rodWidth, rodHeight);
    }

    if (controlRods > 30) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Control Rods", width / 2, rodHeight + 12);
    }
  }

  function drawStats(): void {
    if (showStats < 1) return;

    const panelX = 10;
    const panelY = height * 0.7;
    const panelW = width - 20;
    const panelH = height * 0.27;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Nuclear Chain Reaction Statistics", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 38;
    const lineH = 16;
    const col2 = panelX + panelW / 2;

    const neutronCount = particles.filter(p => p.type === "neutron").length;
    const u235Remaining = atomGrid.filter(a => !a.fissioned && a.type === "U235").length;
    const totalU235 = atomGrid.filter(a => a.type === "U235").length;

    ctx.fillText(`Active Neutrons: ${neutronCount}`, panelX + 10, y);
    ctx.fillText(`Fission Events: ${fissionCount}`, col2, y); y += lineH;

    ctx.fillText(`U-235 Remaining: ${u235Remaining} / ${totalU235}`, panelX + 10, y);
    ctx.fillText(`Energy Released: ${energyReleased.toFixed(0)} MeV`, col2, y); y += lineH;

    ctx.fillText(`Enrichment: ${enrichment}%`, panelX + 10, y);
    ctx.fillText(`Control Rods: ${controlRods}% inserted`, col2, y); y += lineH;

    // k-effective indicator
    const kColor = kEffective > 1.05 ? "#ef4444" : kEffective < 0.95 ? "#3b82f6" : "#22c55e";
    ctx.fillStyle = kColor;
    const kLabel = kEffective > 1.05 ? "SUPERCRITICAL" : kEffective < 0.95 ? "SUBCRITICAL" : "CRITICAL";
    ctx.fillText(`k-eff ≈ ${kEffective.toFixed(2)} (${kLabel})`, panelX + 10, y); y += lineH + 3;

    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("²³⁵U + n → fragments + 2-3 neutrons + ~200 MeV  |  k > 1: chain grows, k < 1: chain dies, k = 1: sustained", panelX + 10, y);
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Nuclear Chain Reaction — Uranium Fission", width / 2, 28);

    drawControlRods();
    drawAtoms();
    drawParticles();
    drawStats();

    // Legend
    const legY = height * 0.67;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(20, legY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("U-235 (fissile)", 30, legY + 4);

    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(140, legY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("U-238", 150, legY + 4);

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(220, legY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Neutron", 228, legY + 4);

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(310, legY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Fragment", 319, legY + 4);
  }

  function reset(): void {
    time = 0;
    particles = [];
    fissionCount = 0;
    generation = 0;
    neutronsPerGeneration = [];
    energyReleased = 0;
    initGrid();
    for (let i = 0; i < initialNeutrons; i++) {
      spawnNeutron(width / 2 + (Math.random() - 0.5) * 50, height * 0.05);
    }
  }

  function destroy(): void {
    particles = [];
    atomGrid = [];
  }

  function getStateDescription(): string {
    const neutronCount = particles.filter(p => p.type === "neutron").length;
    const u235Remaining = atomGrid.filter(a => !a.fissioned && a.type === "U235").length;
    return (
      `Nuclear Chain Reaction: Enrichment=${enrichment}%, control rods=${controlRods}% inserted. ` +
      `Active neutrons: ${neutronCount}, fission events: ${fissionCount}. ` +
      `U-235 remaining: ${u235Remaining}. Energy released: ${energyReleased.toFixed(0)} MeV. ` +
      `k-effective ≈ ${kEffective.toFixed(2)}. ` +
      `Each U-235 fission releases 2-3 neutrons and ~200 MeV. ` +
      `k>1: supercritical (chain grows), k<1: subcritical (chain dies), k=1: critical (sustained).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NuclearChainReactionFactory;
