import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const galvanicCellFactory: SimulationFactory = () => {
  const config = getSimConfig("galvanic-cell-electrochemistry")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let temperature = 298;

  // Half-cell data: metal, ion, standard reduction potential (V)
  const electrodes = [
    { metal: "Zn", ion: "Zn²⁺", E0: -0.76, color: "#94a3b8", ionColor: "#60a5fa" },
    { metal: "Cu", ion: "Cu²⁺", E0: 0.34, color: "#f59e0b", ionColor: "#22c55e" },
  ];

  // Nernst equation: E = E° - (RT/nF) * ln(Q)
  const R_CONST = 8.314;
  const F_CONST = 96485;
  const n = 2; // electrons transferred

  // Moving particles
  interface Particle {
    x: number; y: number; vx: number; vy: number;
    type: "electron" | "cation" | "anion" | "ion";
    color: string; life: number;
  }
  let particles: Particle[] = [];

  function cellVoltage(): number {
    const E0cell = electrodes[1].E0 - electrodes[0].E0; // Cu - Zn = 1.10 V
    // Simple Nernst correction
    const lnQ = 0; // assuming unit concentrations
    return E0cell - (R_CONST * temperature) / (n * F_CONST) * lnQ;
  }

  function spawnParticles() {
    // Electrons flowing through wire (anode to cathode)
    if (Math.random() < 0.15) {
      particles.push({
        x: W * 0.25, y: H * 0.12,
        vx: 80 + Math.random() * 40, vy: (Math.random() - 0.5) * 10,
        type: "electron", color: "#facc15", life: 3,
      });
    }
    // Zn dissolving (anode)
    if (Math.random() < 0.08) {
      particles.push({
        x: W * 0.2 + (Math.random() - 0.5) * 30, y: H * 0.45,
        vx: (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 15,
        type: "cation", color: electrodes[0].ionColor, life: 4,
      });
    }
    // Cu depositing (cathode)
    if (Math.random() < 0.06) {
      particles.push({
        x: W * 0.7 + (Math.random() - 0.5) * 40, y: H * 0.3 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 5, vy: 10 + Math.random() * 10,
        type: "ion", color: electrodes[1].ionColor, life: 2,
      });
    }
    // Salt bridge ions
    if (Math.random() < 0.1) {
      const goRight = Math.random() > 0.5;
      particles.push({
        x: W * 0.45 + (Math.random() - 0.5) * 20, y: H * 0.22 + Math.random() * 8,
        vx: goRight ? 20 + Math.random() * 15 : -20 - Math.random() * 15,
        vy: (Math.random() - 0.5) * 5,
        type: "anion", color: goRight ? "#a78bfa" : "#f472b6", life: 2.5,
      });
    }
  }

  function drawBeaker(x: number, y: number, w: number, h: number, solutionColor: string, label: string) {
    // Solution
    ctx.fillStyle = solutionColor;
    ctx.fillRect(x, y + h * 0.2, w, h * 0.8);

    // Glass beaker outline
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    ctx.font = "11px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h + 16);
  }

  function drawElectrode(x: number, y: number, w: number, h: number, color: string, label: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y - 8);
  }

  function drawWire() {
    const anodeTop = { x: W * 0.22, y: H * 0.18 };
    const cathodeTop = { x: W * 0.72, y: H * 0.18 };
    const midY = H * 0.08;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(anodeTop.x, anodeTop.y);
    ctx.lineTo(anodeTop.x, midY);
    ctx.lineTo(cathodeTop.x, midY);
    ctx.lineTo(cathodeTop.x, cathodeTop.y);
    ctx.stroke();

    // Voltmeter
    const vmX = W * 0.47, vmY = midY - 2;
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(vmX, vmY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "#22c55e";
    ctx.textAlign = "center";
    ctx.fillText(`${cellVoltage().toFixed(2)}V`, vmX, vmY + 4);

    // Arrow showing electron flow
    ctx.font = "10px Arial";
    ctx.fillStyle = "#facc15";
    ctx.fillText("e⁻ →", W * 0.35, midY - 10);
  }

  function drawSaltBridge() {
    const x1 = W * 0.35, x2 = W * 0.58;
    const topY = H * 0.18, botY1 = H * 0.35, botY2 = H * 0.35;

    ctx.strokeStyle = "rgba(168, 162, 158, 0.7)";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, botY1);
    ctx.quadraticCurveTo((x1 + x2) / 2, topY, x2, botY2);
    ctx.stroke();

    ctx.font = "11px Arial";
    ctx.fillStyle = "#a8a29e";
    ctx.textAlign = "center";
    ctx.fillText("Salt Bridge (KNO₃)", (x1 + x2) / 2, topY - 5);
  }

  function drawReactions() {
    const y = H * 0.72;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(W * 0.03, y, W * 0.94, H * 0.25);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(W * 0.03, y, W * 0.94, H * 0.25);

    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Electrochemical Reactions", W / 2, y + 20);

    ctx.font = "13px monospace";
    ctx.textAlign = "left";

    // Anode (oxidation)
    ctx.fillStyle = "#ef4444";
    ctx.fillText("Anode (oxidation):", W * 0.06, y + 42);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Zn(s) → Zn²⁺(aq) + 2e⁻", W * 0.06, y + 60);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`E° = ${electrodes[0].E0.toFixed(2)} V`, W * 0.06, y + 76);

    // Cathode (reduction)
    ctx.fillStyle = "#22c55e";
    ctx.fillText("Cathode (reduction):", W * 0.55, y + 42);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Cu²⁺(aq) + 2e⁻ → Cu(s)", W * 0.55, y + 60);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`E° = +${electrodes[1].E0.toFixed(2)} V`, W * 0.55, y + 76);

    // Net
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#facc15";
    ctx.textAlign = "center";
    ctx.fillText(`E°cell = ${(electrodes[1].E0 - electrodes[0].E0).toFixed(2)} V  |  T = ${temperature} K  |  Nernst: E = E° − (RT/nF)ln(Q)`, W / 2, y + H * 0.25 - 10);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c;
      ctx = c.getContext("2d")!;
      W = c.width;
      H = c.height;
      time = 0;
      particles = [];
    },
    update(dt, params) {
      temperature = params.temperature ?? temperature;
      time += dt;
      spawnParticles();

      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter(p => p.life > 0 && p.x > 0 && p.x < W && p.y > 0 && p.y < H);
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Galvanic Cell (Daniell Cell)", W / 2, 28);

      // Beakers
      drawBeaker(W * 0.08, H * 0.25, W * 0.32, H * 0.38, "rgba(96, 165, 250, 0.15)", "ZnSO₄ (aq)");
      drawBeaker(W * 0.55, H * 0.25, W * 0.32, H * 0.38, "rgba(34, 197, 94, 0.15)", "CuSO₄ (aq)");

      // Electrodes
      drawElectrode(W * 0.19, H * 0.18, 14, H * 0.38, electrodes[0].color, "Zn (anode)");
      drawElectrode(W * 0.69, H * 0.18, 14, H * 0.38, electrodes[1].color, "Cu (cathode)");

      drawSaltBridge();
      drawWire();

      // Particles
      for (const p of particles) {
        const alpha = Math.min(1, p.life);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        const r = p.type === "electron" ? 3 : 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Labels
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("− ANODE", W * 0.22, H * 0.67);
      ctx.fillStyle = "#22c55e";
      ctx.fillText("+ CATHODE", W * 0.72, H * 0.67);

      drawReactions();
    },
    reset() {
      time = 0;
      particles = [];
    },
    destroy() {},
    getStateDescription() {
      const V = cellVoltage();
      return `Galvanic cell (Daniell Cell): Zn anode (E° = ${electrodes[0].E0} V) | Cu cathode (E° = ${electrodes[1].E0} V). Cell voltage: ${V.toFixed(3)} V at ${temperature} K. Zn is oxidized, Cu²⁺ is reduced. Electrons flow from Zn to Cu through external wire.`;
    },
    resize(w, h) {
      W = w;
      H = h;
    },
  };
  return engine;
};

export default galvanicCellFactory;
