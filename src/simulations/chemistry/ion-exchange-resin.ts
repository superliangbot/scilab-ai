import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface IonParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "Ca" | "Mg" | "Na";
  trapped: boolean;
  attachedTo: number; // resin index, -1 if free
}

interface ResinBead {
  x: number;
  y: number;
  radius: number;
  naCount: number; // sodium ions remaining
}

const IonExchangeResinFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ion-exchange-resin") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let flowRate = 1;
  let numParticles = 20;
  let resinCount = 12;

  const ions: IonParticle[] = [];
  const resins: ResinBead[] = [];
  let exchangeCount = 0;
  let totalNaReleased = 0;

  function initResins() {
    resins.length = 0;
    const colW = width * 0.5;
    const colLeft = width * 0.25;
    const colTop = height * 0.2;
    const colH = height * 0.55;

    for (let i = 0; i < resinCount; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      resins.push({
        x: colLeft + colW * 0.2 + col * colW * 0.3,
        y: colTop + colH * 0.15 + row * colH * 0.2,
        radius: 14,
        naCount: 2,
      });
    }
  }

  function spawnIon(): IonParticle {
    const colLeft = width * 0.25;
    const colW = width * 0.5;
    const type = Math.random() < 0.5 ? "Ca" : "Mg";
    return {
      x: colLeft + Math.random() * colW,
      y: height * 0.12,
      vx: (Math.random() - 0.5) * 20,
      vy: 15 + Math.random() * 20 * flowRate,
      type,
      trapped: false,
      attachedTo: -1,
    };
  }

  function spawnNaIon(rx: number, ry: number): IonParticle {
    return {
      x: rx + (Math.random() - 0.5) * 10,
      y: ry,
      vx: (Math.random() - 0.5) * 30,
      vy: 20 + Math.random() * 30,
      type: "Na",
      trapped: false,
      attachedTo: -1,
    };
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      engine.reset();
    },
    update(dt: number, params: Record<string, number>) {
      flowRate = params.flowRate ?? 1;
      numParticles = Math.round(params.numParticles ?? 20);
      resinCount = Math.round(params.resinCount ?? 12);

      time += dt;

      // Spawn new ions
      const freeHardWater = ions.filter((p) => !p.trapped && (p.type === "Ca" || p.type === "Mg"));
      if (freeHardWater.length < numParticles && Math.random() < 0.3 * flowRate) {
        ions.push(spawnIon());
      }

      const colLeft = width * 0.25;
      const colRight = colLeft + width * 0.5;
      const colTop = height * 0.15;
      const colBottom = height * 0.8;

      for (let i = ions.length - 1; i >= 0; i--) {
        const ion = ions[i];
        if (ion.trapped) continue;

        ion.x += ion.vx * dt;
        ion.y += ion.vy * dt;

        // Bounce off column walls
        if (ion.x < colLeft + 8) { ion.x = colLeft + 8; ion.vx = Math.abs(ion.vx); }
        if (ion.x > colRight - 8) { ion.x = colRight - 8; ion.vx = -Math.abs(ion.vx); }

        // Remove if below column
        if (ion.y > colBottom + 30) {
          ions.splice(i, 1);
          continue;
        }

        // Check collision with resin beads (only Ca/Mg)
        if (ion.type === "Ca" || ion.type === "Mg") {
          for (let j = 0; j < resins.length; j++) {
            const r = resins[j];
            if (r.naCount <= 0) continue;
            const dx = ion.x - r.x;
            const dy = ion.y - r.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < r.radius + 6) {
              // Exchange!
              ion.trapped = true;
              ion.attachedTo = j;
              ion.x = r.x + (Math.random() - 0.5) * r.radius;
              ion.y = r.y + (Math.random() - 0.5) * r.radius;
              r.naCount--;
              exchangeCount++;

              // Release Na+ ions
              ions.push(spawnNaIon(r.x, r.y));
              ions.push(spawnNaIon(r.x, r.y));
              totalNaReleased += 2;
              break;
            }
          }
        }
      }
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Ion Exchange Resin — Water Softening", width / 2, 22);

      const colLeft = width * 0.25;
      const colW = width * 0.5;
      const colTop = height * 0.15;
      const colH = height * 0.65;

      // Column body
      ctx.fillStyle = "rgba(200, 230, 255, 0.08)";
      ctx.fillRect(colLeft, colTop, colW, colH);
      ctx.strokeStyle = "#4fc3f7";
      ctx.lineWidth = 2;
      ctx.strokeRect(colLeft, colTop, colW, colH);

      // Labels
      ctx.fillStyle = "#4fc3f7";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Hard Water In ↓", width / 2, colTop - 5);
      ctx.fillText("↓ Soft Water Out", width / 2, colTop + colH + 15);

      // Draw resin beads
      for (let i = 0; i < resins.length; i++) {
        const r = resins[i];
        const grad = ctx.createRadialGradient(r.x - 3, r.y - 3, 0, r.x, r.y, r.radius);
        grad.addColorStop(0, r.naCount > 0 ? "#66bb6a" : "#795548");
        grad.addColorStop(1, r.naCount > 0 ? "#2e7d32" : "#4e342e");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.fill();

        // Show Na+ count
        if (r.naCount > 0) {
          ctx.fillStyle = "#ffeb3b";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`Na⁺×${r.naCount}`, r.x, r.y + 3);
        } else {
          ctx.fillStyle = "#ef5350";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("full", r.x, r.y + 3);
        }
      }

      // Draw ions
      for (const ion of ions) {
        let color = "#ffeb3b";
        let label = "Na⁺";
        let radius = 5;

        if (ion.type === "Ca") {
          color = "#e040fb";
          label = "Ca²⁺";
          radius = 6;
        } else if (ion.type === "Mg") {
          color = "#42a5f5";
          label = "Mg²⁺";
          radius = 5.5;
        }

        if (ion.trapped) {
          ctx.globalAlpha = 0.6;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ion.x, ion.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, ion.x, ion.y - radius - 2);

        ctx.globalAlpha = 1;
      }

      // Legend
      const legY = colTop + colH + 30;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#e040fb";
      ctx.beginPath();
      ctx.arc(width * 0.15, legY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ccc";
      ctx.fillText("Ca²⁺ (calcium)", width * 0.15 + 10, legY + 4);

      ctx.fillStyle = "#42a5f5";
      ctx.beginPath();
      ctx.arc(width * 0.42, legY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ccc";
      ctx.fillText("Mg²⁺ (magnesium)", width * 0.42 + 10, legY + 4);

      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(width * 0.72, legY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ccc";
      ctx.fillText("Na⁺ (sodium)", width * 0.72 + 10, legY + 4);

      // Stats
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.1, legY + 18, width * 0.8, 30);
      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Exchanges: ${exchangeCount} | Na⁺ released: ${totalNaReleased} | Hard water ions removed and replaced with sodium`, width / 2, legY + 37);
    },
    reset() {
      time = 0;
      ions.length = 0;
      exchangeCount = 0;
      totalNaReleased = 0;
      initResins();
    },
    destroy() {},
    getStateDescription(): string {
      const activeResins = resins.filter((r) => r.naCount > 0).length;
      return `Ion exchange resin simulation: ${exchangeCount} exchanges completed. ${totalNaReleased} Na⁺ ions released. ${activeResins}/${resins.length} resin beads still active. Ca²⁺ and Mg²⁺ ions from hard water are captured by resin beads and replaced with Na⁺ ions, softening the water.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      initResins();
    },
  };

  return engine;
};

export default IonExchangeResinFactory;
