import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EquilibriumConstantsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("equilibrium-constants") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let forwardRate = 5; // k_forward (0-10)
  let reverseRate = 3; // k_reverse (0-10)
  let temperature = 300; // K

  // Particles: A (red) + B (blue) ⇌ C (cyan)
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "A" | "B" | "C";
    radius: number;
    flashTimer: number;
  }

  let particles: Particle[] = [];
  const BOX_LEFT = 40;
  const BOX_TOP = 80;
  const BOX_RIGHT = 460;
  const BOX_BOTTOM = 480;

  // K history for graph
  let kHistory: number[] = [];
  const MAX_K_HISTORY = 200;

  // Concentration history
  let concAHistory: number[] = [];
  let concBHistory: number[] = [];
  let concCHistory: number[] = [];

  function createParticle(type: "A" | "B" | "C"): Particle {
    const speed = 40 + Math.random() * 60;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: BOX_LEFT + 20 + Math.random() * (BOX_RIGHT - BOX_LEFT - 40),
      y: BOX_TOP + 20 + Math.random() * (BOX_BOTTOM - BOX_TOP - 40),
      vx: speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      type,
      radius: type === "C" ? 8 : 6,
      flashTimer: 0,
    };
  }

  function initParticles(): void {
    particles = [];
    for (let i = 0; i < 15; i++) particles.push(createParticle("A"));
    for (let i = 0; i < 15; i++) particles.push(createParticle("B"));
    for (let i = 0; i < 5; i++) particles.push(createParticle("C"));
    kHistory = [];
    concAHistory = [];
    concBHistory = [];
    concCHistory = [];
  }

  function countType(t: string): number {
    return particles.filter((p) => p.type === t).length;
  }

  function computeK(): number {
    const a = Math.max(1, countType("A"));
    const b = Math.max(1, countType("B"));
    const c = countType("C");
    return c / (a * b) * 100; // Scaled for display
  }

  function init(canv: HTMLCanvasElement): void {
    canvas = canv;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    initParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    forwardRate = params.forwardRate ?? 5;
    reverseRate = params.reverseRate ?? 3;
    temperature = params.temperature ?? 300;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // Speed scaling by temperature
    const speedFactor = Math.sqrt(temperature / 300);

    // Move particles
    for (const p of particles) {
      p.x += p.vx * speedFactor * dtClamped;
      p.y += p.vy * speedFactor * dtClamped;
      p.flashTimer = Math.max(0, p.flashTimer - dtClamped);

      // Wall collisions
      if (p.x - p.radius < BOX_LEFT) { p.x = BOX_LEFT + p.radius; p.vx = Math.abs(p.vx); }
      if (p.x + p.radius > BOX_RIGHT) { p.x = BOX_RIGHT - p.radius; p.vx = -Math.abs(p.vx); }
      if (p.y - p.radius < BOX_TOP) { p.y = BOX_TOP + p.radius; p.vy = Math.abs(p.vy); }
      if (p.y + p.radius > BOX_BOTTOM) { p.y = BOX_BOTTOM - p.radius; p.vy = -Math.abs(p.vy); }
    }

    // Forward reaction: A + B → C
    const forwardProb = forwardRate * 0.001 * dtClamped * 60;
    const aParticles = particles.filter((p) => p.type === "A");
    const bParticles = particles.filter((p) => p.type === "B");

    for (const a of aParticles) {
      for (const b of bParticles) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < a.radius + b.radius + 5 && Math.random() < forwardProb) {
          // React: remove A and B, create C
          const idx_a = particles.indexOf(a);
          const idx_b = particles.indexOf(b);
          if (idx_a >= 0 && idx_b >= 0) {
            const newC = createParticle("C");
            newC.x = (a.x + b.x) / 2;
            newC.y = (a.y + b.y) / 2;
            newC.vx = (a.vx + b.vx) / 2;
            newC.vy = (a.vy + b.vy) / 2;
            newC.flashTimer = 0.5;
            particles.splice(Math.max(idx_a, idx_b), 1);
            particles.splice(Math.min(idx_a, idx_b), 1);
            particles.push(newC);
          }
          break;
        }
      }
    }

    // Reverse reaction: C → A + B
    const reverseProb = reverseRate * 0.002 * dtClamped * 60;
    const cParticles = particles.filter((p) => p.type === "C");
    for (const c of cParticles) {
      if (Math.random() < reverseProb) {
        const idx = particles.indexOf(c);
        if (idx >= 0) {
          particles.splice(idx, 1);
          const newA = createParticle("A");
          newA.x = c.x - 5;
          newA.y = c.y;
          newA.flashTimer = 0.5;
          const newB = createParticle("B");
          newB.x = c.x + 5;
          newB.y = c.y;
          newB.flashTimer = 0.5;
          particles.push(newA, newB);
        }
      }
    }

    // Record K and concentrations
    const k = computeK();
    kHistory.push(k);
    if (kHistory.length > MAX_K_HISTORY) kHistory.shift();

    concAHistory.push(countType("A"));
    concBHistory.push(countType("B"));
    concCHistory.push(countType("C"));
    if (concAHistory.length > MAX_K_HISTORY) {
      concAHistory.shift();
      concBHistory.shift();
      concCHistory.shift();
    }
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawReactionBox(): void {
    ctx.fillStyle = "rgba(20, 30, 50, 0.6)";
    ctx.fillRect(BOX_LEFT, BOX_TOP, BOX_RIGHT - BOX_LEFT, BOX_BOTTOM - BOX_TOP);
    ctx.strokeStyle = "rgba(100, 140, 200, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(BOX_LEFT, BOX_TOP, BOX_RIGHT - BOX_LEFT, BOX_BOTTOM - BOX_TOP);
  }

  function drawParticles(): void {
    for (const p of particles) {
      const colors = { A: "#ef4444", B: "#3b82f6", C: "#06b6d4" };
      const color = colors[p.type];

      // Flash on reaction
      if (p.flashTimer > 0) {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
        glow.addColorStop(0, `rgba(255, 255, 200, ${p.flashTimer})`);
        glow.addColorStop(1, "rgba(255, 255, 200, 0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = `bold ${p.radius}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.type, p.x, p.y);
    }
    ctx.textBaseline = "alphabetic";
  }

  function drawKGraph(): void {
    const gx = 490;
    const gy = 80;
    const gw = 280;
    const gh = 180;

    ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText("Equilibrium Constant K over Time", gx + gw / 2, gy - 6);

    if (kHistory.length > 1) {
      const maxK = Math.max(1, ...kHistory) * 1.2;
      ctx.beginPath();
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      for (let i = 0; i < kHistory.length; i++) {
        const x = gx + (i / MAX_K_HISTORY) * gw;
        const y = gy + gh - (kHistory[i] / maxK) * gh;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current K value
      const currentK = kHistory[kHistory.length - 1];
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`K = ${currentK.toFixed(2)}`, gx + gw - 8, gy + 18);
    }
  }

  function drawConcentrationGraph(): void {
    const gx = 490;
    const gy = 290;
    const gw = 280;
    const gh = 180;

    ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText("Concentrations [A], [B], [C]", gx + gw / 2, gy - 6);

    const maxConc = Math.max(1, ...concAHistory, ...concBHistory, ...concCHistory) * 1.2;

    const drawLine = (data: number[], color: string) => {
      if (data.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < data.length; i++) {
        const x = gx + (i / MAX_K_HISTORY) * gw;
        const y = gy + gh - (data[i] / maxConc) * gh;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawLine(concAHistory, "#ef4444");
    drawLine(concBHistory, "#3b82f6");
    drawLine(concCHistory, "#06b6d4");

    // Legend
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`[A]=${countType("A")}`, gx + 8, gy + 16);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`[B]=${countType("B")}`, gx + 60, gy + 16);
    ctx.fillStyle = "#06b6d4";
    ctx.fillText(`[C]=${countType("C")}`, gx + 110, gy + 16);
  }

  function drawReactionLabel(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("A + B ⇌ C", (BOX_LEFT + BOX_RIGHT) / 2, BOX_TOP - 12);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`K = [C]/([A][B]) = ${computeK().toFixed(2)}`, (BOX_LEFT + BOX_RIGHT) / 2, BOX_BOTTOM + 20);
    ctx.fillText(`k_f = ${forwardRate.toFixed(1)} | k_r = ${reverseRate.toFixed(1)} | T = ${temperature.toFixed(0)}K`, (BOX_LEFT + BOX_RIGHT) / 2, BOX_BOTTOM + 38);
  }

  function drawInfoPanel(): void {
    ctx.save();
    const px = 40;
    const py = 500;
    const pw = 420;
    const ph = 80;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Dynamic equilibrium: forward and reverse reactions continue", px + 12, py + 18);
    ctx.fillText("At equilibrium, K = [C]/([A][B]) remains constant", px + 12, py + 36);
    ctx.fillText("Changing rates shifts equilibrium (Le Chatelier's principle)", px + 12, py + 54);
    ctx.fillText(`Time: ${time.toFixed(1)}s`, px + 12, py + 70);

    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawReactionBox();
    drawParticles();
    drawReactionLabel();
    drawKGraph();
    drawConcentrationGraph();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    initParticles();
  }

  function destroy(): void {
    particles = [];
    kHistory = [];
  }

  function getStateDescription(): string {
    return (
      `Chemical Equilibrium: A + B ⇌ C. Forward rate k_f=${forwardRate.toFixed(1)}, reverse k_r=${reverseRate.toFixed(1)}. ` +
      `T=${temperature}K. [A]=${countType("A")}, [B]=${countType("B")}, [C]=${countType("C")}. ` +
      `K = ${computeK().toFixed(2)}. At equilibrium, K remains constant even though both reactions continue. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EquilibriumConstantsFactory;
