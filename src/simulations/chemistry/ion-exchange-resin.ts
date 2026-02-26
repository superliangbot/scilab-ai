import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Ion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "Ca" | "Mg" | "Na";
  radius: number;
  exchanged: boolean;
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
  let ionCount = 15;
  let resinCapacity = 1; // 0=depleted, 1=full

  let ions: Ion[] = [];
  let resinBeads: ResinBead[] = [];
  let releasedNa: Ion[] = [];
  let exchangeCount = 0;

  const COLORS = {
    Ca: "#22c55e",
    Mg: "#a855f7",
    Na: "#f59e0b",
  };
  const LABELS = {
    Ca: "Ca²⁺",
    Mg: "Mg²⁺",
    Na: "Na⁺",
  };

  function initResinBeads() {
    resinBeads = [];
    const cols = 4;
    const rows = 5;
    const regionTop = 0.3;
    const regionBot = 0.75;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = width * (0.25 + (c / (cols - 1)) * 0.5);
        const y = height * (regionTop + (r / (rows - 1)) * (regionBot - regionTop));
        resinBeads.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 15,
          radius: 14 + Math.random() * 4,
          naCount: 3,
        });
      }
    }
  }

  function spawnIons() {
    ions = [];
    for (let i = 0; i < ionCount; i++) {
      const type = Math.random() < 0.5 ? "Ca" : "Mg";
      ions.push({
        x: width * (0.2 + Math.random() * 0.6),
        y: height * 0.05 + Math.random() * height * 0.15,
        vx: (Math.random() - 0.5) * 30,
        vy: 20 + Math.random() * 20,
        type,
        radius: 6,
        exchanged: false,
      });
    }
    releasedNa = [];
    exchangeCount = 0;
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initResinBeads();
      spawnIons();
    },
    update(dt: number, params: Record<string, number>) {
      const newFlowRate = params.flowRate ?? 1;
      const newIonCount = Math.round(params.ionCount ?? 15);
      resinCapacity = params.resinCapacity ?? 1;

      if (newIonCount !== ionCount) {
        ionCount = newIonCount;
        spawnIons();
      }
      flowRate = newFlowRate;

      const dtc = Math.min(dt, 0.05);
      time += dtc;

      const containerLeft = width * 0.15;
      const containerRight = width * 0.85;

      // Move ions downward through column
      for (const ion of ions) {
        ion.vy += 10 * flowRate * dtc;
        ion.x += ion.vx * dtc;
        ion.y += ion.vy * dtc * flowRate;

        // Brownian motion
        ion.vx += (Math.random() - 0.5) * 60 * dtc;
        ion.vy += (Math.random() - 0.5) * 20 * dtc;

        // Wall bouncing
        if (ion.x < containerLeft + ion.radius) { ion.x = containerLeft + ion.radius; ion.vx = Math.abs(ion.vx); }
        if (ion.x > containerRight - ion.radius) { ion.x = containerRight - ion.radius; ion.vx = -Math.abs(ion.vx); }

        // Check collision with resin beads
        if (!ion.exchanged && (ion.type === "Ca" || ion.type === "Mg")) {
          for (const bead of resinBeads) {
            if (bead.naCount <= 0) continue;
            const dx = ion.x - bead.x;
            const dy = ion.y - bead.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bead.radius + ion.radius + 2) {
              // Exchange: remove Ca/Mg, release Na
              ion.exchanged = true;
              ion.type = "Na";
              bead.naCount--;
              exchangeCount++;

              // Release a sodium ion
              releasedNa.push({
                x: bead.x + (Math.random() - 0.5) * 10,
                y: bead.y + bead.radius,
                vx: (Math.random() - 0.5) * 40,
                vy: 30 + Math.random() * 20,
                type: "Na",
                radius: 5,
                exchanged: true,
              });
              break;
            }
          }
        }

        // Reset at bottom
        if (ion.y > height + 20) {
          ion.y = -10;
          ion.x = width * (0.2 + Math.random() * 0.6);
          ion.vy = 20 + Math.random() * 20;
          ion.vx = (Math.random() - 0.5) * 30;
          if (!ion.exchanged) {
            ion.type = Math.random() < 0.5 ? "Ca" : "Mg";
          }
          ion.exchanged = false;
        }
      }

      // Move released Na ions
      for (const na of releasedNa) {
        na.y += na.vy * dtc * flowRate;
        na.x += na.vx * dtc;
        if (na.x < containerLeft) na.vx = Math.abs(na.vx);
        if (na.x > containerRight) na.vx = -Math.abs(na.vx);
      }
      releasedNa = releasedNa.filter((n) => n.y < height + 30);
    },
    render() {
      // Background
      ctx.fillStyle = "#f0f9ff";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#1e293b";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Ion Exchange Resin — Water Softening", width / 2, 24);

      const containerLeft = width * 0.15;
      const containerRight = width * 0.85;
      const containerTop = height * 0.08;
      const containerBot = height * 0.88;

      // Column container
      ctx.fillStyle = "rgba(186, 230, 253, 0.3)";
      ctx.fillRect(containerLeft, containerTop, containerRight - containerLeft, containerBot - containerTop);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 3;
      ctx.strokeRect(containerLeft, containerTop, containerRight - containerLeft, containerBot - containerTop);

      // Labels
      ctx.fillStyle = "#0284c7";
      ctx.font = `${Math.max(10, width * 0.014)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Hard Water In ↓", width / 2, containerTop + 14);
      ctx.fillText("↓ Soft Water Out", width / 2, containerBot - 4);

      // Resin beads
      for (const bead of resinBeads) {
        const brightness = bead.naCount / 3;
        ctx.fillStyle = `rgba(251, 146, 60, ${0.3 + brightness * 0.5})`;
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, bead.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ea580c";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Na count indicator
        if (bead.naCount > 0) {
          ctx.fillStyle = "#92400e";
          ctx.font = "9px sans-serif";
          ctx.fillText(`Na×${bead.naCount}`, bead.x, bead.y + 3);
        }
      }

      // Draw ions
      const drawIon = (ion: Ion) => {
        ctx.fillStyle = COLORS[ion.type];
        ctx.beginPath();
        ctx.arc(ion.x, ion.y, ion.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${ion.radius}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ion.type === "Ca" ? "Ca" : ion.type === "Mg" ? "Mg" : "Na", ion.x, ion.y);
        ctx.textBaseline = "alphabetic";
      };

      for (const ion of ions) drawIon(ion);
      for (const na of releasedNa) drawIon(na);

      // Legend
      const legendY = height - 40;
      ctx.font = `${Math.max(11, width * 0.015)}px sans-serif`;
      ctx.textAlign = "left";
      const legendItems = [
        { color: COLORS.Ca, label: "Ca²⁺ (hard)" },
        { color: COLORS.Mg, label: "Mg²⁺ (hard)" },
        { color: COLORS.Na, label: "Na⁺ (soft)" },
        { color: "#fb923c", label: "Resin bead" },
      ];
      let lx = width * 0.1;
      for (const item of legendItems) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(lx, legendY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#475569";
        ctx.fillText(item.label, lx + 10, legendY + 4);
        lx += width * 0.22;
      }

      // Exchange counter
      ctx.fillStyle = "#1e293b";
      ctx.font = `bold ${Math.max(11, width * 0.015)}px sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(`Exchanges: ${exchangeCount}`, width * 0.9, height - 10);
    },
    reset() {
      time = 0;
      initResinBeads();
      spawnIons();
    },
    destroy() {},
    getStateDescription(): string {
      const totalNa = resinBeads.reduce((s, b) => s + b.naCount, 0);
      const maxNa = resinBeads.length * 3;
      return `Ion exchange resin simulation: ${ionCount} ions flowing through column at rate ${flowRate.toFixed(1)}×. ` +
        `${exchangeCount} exchanges completed. Resin sodium remaining: ${totalNa}/${maxNa}. ` +
        `Hard water ions (Ca²⁺, Mg²⁺) are captured by resin beads and replaced with Na⁺ ions.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      initResinBeads();
    },
  };
};

export default IonExchangeResinFactory;
