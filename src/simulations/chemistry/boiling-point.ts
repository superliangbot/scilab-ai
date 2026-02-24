import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Substance data ─────────────────────────────────────────────────
interface SubstanceData {
  name: string;
  boilingPoint: number; // °C
  specificHeat: number; // J/(g·°C)
  latentHeat: number; // J/g  (latent heat of vaporization)
  color: string;
  bubbleColor: string;
  liquidColor: string;
}

const SUBSTANCES: SubstanceData[] = [
  {
    name: "Water (H\u2082O)",
    boilingPoint: 100,
    specificHeat: 4.186,
    latentHeat: 2260,
    color: "#38bdf8",
    bubbleColor: "rgba(200, 230, 255, 0.6)",
    liquidColor: "#1e6091",
  },
  {
    name: "Ethanol (C\u2082H\u2085OH)",
    boilingPoint: 78.3,
    specificHeat: 2.44,
    latentHeat: 841,
    color: "#a78bfa",
    bubbleColor: "rgba(200, 180, 255, 0.6)",
    liquidColor: "#5b3d8f",
  },
];

// ─── Particle for molecular motion ──────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// ─── Bubble ─────────────────────────────────────────────────────────
interface Bubble {
  x: number;
  y: number;
  radius: number;
  vy: number;
  alpha: number;
}

// ─── Container state ────────────────────────────────────────────────
interface ContainerState {
  temperature: number; // current temperature °C
  boiling: boolean;
  particles: Particle[];
  bubbles: Bubble[];
  energyAbsorbed: number; // cumulative energy (J) for heating
  vaporized: number; // fraction vaporized (0..1) once boiling
}

// ─── Factory ────────────────────────────────────────────────────────
const BoilingPointFactory: SimulationFactory = () => {
  const config = getSimConfig("boiling-point") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters (cached)
  let substance1Idx = 0;
  let substance2Idx = 1;
  let heatRate = 3;
  let mass = 50; // grams

  const INITIAL_TEMP = 20; // start at 20°C
  const NUM_PARTICLES = 30; // per container

  // Two container states
  let containers: ContainerState[] = [];

  // Temperature history for the graph
  const tempHistory: Array<{ t: number; temp1: number; temp2: number }> = [];
  const MAX_HISTORY = 200;

  // ── Helpers ───────────────────────────────────────────────────────
  function containerBounds(index: number) {
    const gap = 20;
    const topMargin = 60;
    const bottomMargin = 140;
    const sideMargin = 30;
    const availW = (W - gap - 2 * sideMargin) / 2;
    const left = sideMargin + index * (availW + gap);
    const right = left + availW;
    const top = topMargin;
    const bottom = H - bottomMargin;
    return { left, right, top, bottom, width: availW, height: bottom - top };
  }

  function createParticles(bounds: ReturnType<typeof containerBounds>): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const r = 3;
      particles.push({
        x: bounds.left + r + Math.random() * (bounds.width - 2 * r),
        y: bounds.top + r + Math.random() * (bounds.height - 2 * r),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: r,
      });
    }
    return particles;
  }

  function initContainers() {
    containers = [];
    for (let i = 0; i < 2; i++) {
      const bounds = containerBounds(i);
      containers.push({
        temperature: INITIAL_TEMP,
        boiling: false,
        particles: createParticles(bounds),
        bubbles: [],
        energyAbsorbed: 0,
        vaporized: 0,
      });
    }
    tempHistory.length = 0;
    time = 0;
  }

  function getSubstance(idx: number): SubstanceData {
    return SUBSTANCES[Math.min(Math.max(Math.round(idx), 0), SUBSTANCES.length - 1)];
  }

  // Speed scales with sqrt(temperature in K) normalized
  function speedFactor(tempC: number): number {
    const tempK = tempC + 273.15;
    return Math.sqrt(tempK / 293.15); // normalized to room temp
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initContainers();
    },

    update(dt: number, params: Record<string, number>) {
      substance1Idx = Math.round(params.substance1 ?? 0);
      substance2Idx = Math.round(params.substance2 ?? 1);
      heatRate = params.heatRate ?? 3;
      mass = params.mass ?? 50;

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      const substanceIndices = [substance1Idx, substance2Idx];

      for (let ci = 0; ci < 2; ci++) {
        const cs = containers[ci];
        const sub = getSubstance(substanceIndices[ci]);
        const bounds = containerBounds(ci);

        // Apply heat: Q = heatRate * scale * dt (Watts scaled)
        // dT = Q / (m * c)  where Q = power * dt
        const power = heatRate * 100; // scale factor for visible heating
        const Q = power * dtClamped;

        if (!cs.boiling) {
          // Heating phase: dT = Q / (m * c)
          const dT = Q / (mass * sub.specificHeat);
          cs.temperature += dT;
          cs.energyAbsorbed += Q;

          if (cs.temperature >= sub.boilingPoint) {
            cs.temperature = sub.boilingPoint;
            cs.boiling = true;
          }
        } else {
          // Boiling phase: energy goes into latent heat
          cs.temperature = sub.boilingPoint;
          const totalLatent = mass * sub.latentHeat;
          cs.vaporized += Q / totalLatent;
          if (cs.vaporized > 1) cs.vaporized = 1;

          // Generate bubbles at boiling
          if (Math.random() < 0.3 * heatRate * dtClamped * 10) {
            const bx = bounds.left + 10 + Math.random() * (bounds.width - 20);
            const by = bounds.bottom - 10;
            cs.bubbles.push({
              x: bx,
              y: by,
              radius: 2 + Math.random() * 5,
              vy: -(1 + Math.random() * 2) * heatRate * 0.5,
              alpha: 0.7 + Math.random() * 0.3,
            });
          }
        }

        // Update particles - speed based on temperature
        const sf = speedFactor(cs.temperature) * 1.5;
        for (const p of cs.particles) {
          p.x += p.vx * sf;
          p.y += p.vy * sf;

          // Wall collisions
          if (p.x - p.radius < bounds.left) {
            p.x = bounds.left + p.radius;
            p.vx = Math.abs(p.vx);
          }
          if (p.x + p.radius > bounds.right) {
            p.x = bounds.right - p.radius;
            p.vx = -Math.abs(p.vx);
          }
          if (p.y - p.radius < bounds.top) {
            p.y = bounds.top + p.radius;
            p.vy = Math.abs(p.vy);
          }
          if (p.y + p.radius > bounds.bottom) {
            p.y = bounds.bottom - p.radius;
            p.vy = -Math.abs(p.vy);
          }

          // Random thermal jitter
          p.vx += (Math.random() - 0.5) * 0.3 * sf;
          p.vy += (Math.random() - 0.5) * 0.3 * sf;

          // Clamp speed
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const maxSpeed = 4 * sf;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        }

        // Update bubbles
        for (let bi = cs.bubbles.length - 1; bi >= 0; bi--) {
          const b = cs.bubbles[bi];
          b.y += b.vy;
          b.x += (Math.random() - 0.5) * 0.5; // wobble
          b.alpha -= 0.005;
          b.radius += 0.02;

          if (b.y < bounds.top + 10 || b.alpha <= 0) {
            cs.bubbles.splice(bi, 1);
          }
        }
      }

      // Record temperature history
      if (tempHistory.length === 0 || time - tempHistory[tempHistory.length - 1].t > 0.1) {
        tempHistory.push({
          t: time,
          temp1: containers[0].temperature,
          temp2: containers[1].temperature,
        });
        if (tempHistory.length > MAX_HISTORY) {
          tempHistory.shift();
        }
      }
    },

    render() {
      if (!ctx) return;

      // ── Background ──────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Boiling Point Comparison", W / 2, 28);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "Q = mc\u0394T (heating)  |  Q = mL (vaporization)  |  Different substances have different boiling points",
        W / 2,
        46
      );

      const substanceIndices = [substance1Idx, substance2Idx];

      // ── Draw each container ─────────────────────────
      for (let ci = 0; ci < 2; ci++) {
        const cs = containers[ci];
        const sub = getSubstance(substanceIndices[ci]);
        const bounds = containerBounds(ci);

        // Container label
        ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = sub.color;
        ctx.textAlign = "center";
        ctx.fillText(sub.name, (bounds.left + bounds.right) / 2, bounds.top - 8);

        // Container background - darker when hot
        const tempFrac = Math.min((cs.temperature - INITIAL_TEMP) / 120, 1);
        const r = Math.round(20 + 40 * tempFrac);
        const g = Math.round(20 + 5 * tempFrac);
        const b2 = Math.round(40 - 10 * tempFrac);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b2})`;
        ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);

        // Liquid level (decreases as substance vaporizes)
        const liquidFrac = 1 - cs.vaporized * 0.8;
        const liquidTop = bounds.bottom - bounds.height * 0.7 * liquidFrac;
        const liquidGrad = ctx.createLinearGradient(0, liquidTop, 0, bounds.bottom);
        const lAlpha = 0.6 + 0.2 * (1 - cs.vaporized);
        liquidGrad.addColorStop(0, sub.liquidColor + "80");
        liquidGrad.addColorStop(1, sub.liquidColor + "cc");
        ctx.fillStyle = liquidGrad;
        ctx.fillRect(bounds.left + 2, liquidTop, bounds.width - 4, bounds.bottom - liquidTop - 2);

        // Container border
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

        // Heat source (flame at bottom)
        const flameX = (bounds.left + bounds.right) / 2;
        const flameY = bounds.bottom + 5;
        const flameHeight = 10 + heatRate * 2;

        for (let fi = 0; fi < 5; fi++) {
          const fx = flameX + (fi - 2) * 8;
          const fOff = Math.sin(time * 8 + fi * 1.5) * 3;
          const grad = ctx.createRadialGradient(fx, flameY, 0, fx, flameY - flameHeight / 2, flameHeight);
          grad.addColorStop(0, "rgba(255, 200, 50, 0.9)");
          grad.addColorStop(0.4, "rgba(255, 100, 20, 0.7)");
          grad.addColorStop(1, "rgba(255, 50, 0, 0)");
          ctx.beginPath();
          ctx.ellipse(fx, flameY + fOff, 5, flameHeight * 0.6, 0, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Draw bubbles
        for (const bub of cs.bubbles) {
          ctx.beginPath();
          ctx.arc(bub.x, bub.y, bub.radius, 0, Math.PI * 2);
          ctx.fillStyle = sub.bubbleColor.replace(/[\d.]+\)$/, `${bub.alpha})`);
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${bub.alpha * 0.4})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        // Draw particles (molecules)
        const sf = speedFactor(cs.temperature);
        for (const p of cs.particles) {
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const speedNorm = Math.min(speed / (4 * sf), 1);

          // Color: blue (cold) -> yellow (warm) -> red (hot/boiling)
          let pr: number, pg: number, pb: number;
          if (speedNorm < 0.5) {
            const s = speedNorm / 0.5;
            pr = Math.round(60 + 195 * s);
            pg = Math.round(100 + 155 * s);
            pb = Math.round(255 - 155 * s);
          } else {
            const s = (speedNorm - 0.5) / 0.5;
            pr = 255;
            pg = Math.round(255 - 200 * s);
            pb = Math.round(100 - 100 * s);
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${pr}, ${pg}, ${pb})`;
          ctx.fill();

          // Glow for hot particles
          if (speedNorm > 0.5) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, ${Math.round(150 - 150 * speedNorm)}, 0, ${0.15 * speedNorm})`;
            ctx.fill();
          }
        }

        // Temperature readout
        ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
        const tempColor = cs.boiling ? "#ef4444" : "#fbbf24";
        ctx.fillStyle = tempColor;
        ctx.textAlign = "center";
        ctx.fillText(
          `${cs.temperature.toFixed(1)}\u00B0C`,
          (bounds.left + bounds.right) / 2,
          bounds.top + 20
        );

        // Boiling indicator
        if (cs.boiling) {
          ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
          ctx.fillStyle = "#ef4444";
          ctx.fillText("BOILING!", (bounds.left + bounds.right) / 2, bounds.top + 36);
        }

        // Info below container
        const infoY = bounds.bottom + 28;
        ctx.font = "11px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText(
          `BP: ${sub.boilingPoint}\u00B0C | c: ${sub.specificHeat} J/g\u00B7\u00B0C`,
          (bounds.left + bounds.right) / 2,
          infoY
        );
        ctx.fillText(
          `L: ${sub.latentHeat} J/g | ${cs.vaporized > 0 ? (cs.vaporized * 100).toFixed(0) + "% vaporized" : "heating..."}`,
          (bounds.left + bounds.right) / 2,
          infoY + 15
        );
      }

      // ── Temperature graph ───────────────────────────
      const graphLeft = 30;
      const graphRight = W - 30;
      const graphTop = H - 90;
      const graphBottom = H - 15;
      const graphW = graphRight - graphLeft;
      const graphH = graphBottom - graphTop;

      // Graph background
      ctx.fillStyle = "rgba(15, 20, 40, 0.8)";
      ctx.fillRect(graphLeft, graphTop, graphW, graphH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(graphLeft, graphTop, graphW, graphH);

      // Graph label
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText("Temperature (\u00B0C) vs Time", graphLeft + 5, graphTop + 12);

      // Boiling point reference lines
      for (let si = 0; si < 2; si++) {
        const sub = getSubstance(substanceIndices[si]);
        const yFrac = 1 - (sub.boilingPoint - INITIAL_TEMP) / 120;
        const refY = graphTop + 15 + yFrac * (graphH - 20);
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(graphLeft, refY);
        ctx.lineTo(graphRight, refY);
        ctx.strokeStyle = sub.color + "60";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = sub.color;
        ctx.textAlign = "right";
        ctx.fillText(`${sub.boilingPoint}\u00B0C`, graphRight - 3, refY - 3);
      }

      // Plot temperature curves
      if (tempHistory.length > 1) {
        const tMin = tempHistory[0].t;
        const tMax = tempHistory[tempHistory.length - 1].t;
        const tRange = Math.max(tMax - tMin, 0.1);

        for (let si = 0; si < 2; si++) {
          const sub = getSubstance(substanceIndices[si]);
          ctx.beginPath();
          ctx.strokeStyle = sub.color;
          ctx.lineWidth = 2;

          for (let hi = 0; hi < tempHistory.length; hi++) {
            const h = tempHistory[hi];
            const px = graphLeft + ((h.t - tMin) / tRange) * graphW;
            const temp = si === 0 ? h.temp1 : h.temp2;
            const yFrac = 1 - (temp - INITIAL_TEMP) / 120;
            const py = graphTop + 15 + yFrac * (graphH - 20);

            if (hi === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // Time display
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s  |  mass = ${mass}g  |  heat rate = ${heatRate}x`, 12, H - 2);
    },

    reset() {
      initContainers();
    },

    destroy() {
      containers = [];
      tempHistory.length = 0;
    },

    getStateDescription(): string {
      const sub1 = getSubstance(substance1Idx);
      const sub2 = getSubstance(substance2Idx);
      const c1 = containers[0];
      const c2 = containers[1];
      return (
        `Boiling Point simulation: Two containers with ${mass}g each, heat rate ${heatRate}x. ` +
        `Container 1: ${sub1.name} at ${c1.temperature.toFixed(1)}\u00B0C (BP: ${sub1.boilingPoint}\u00B0C, ` +
        `specific heat: ${sub1.specificHeat} J/g\u00B7\u00B0C), ` +
        `${c1.boiling ? "BOILING" : "heating"}, ${(c1.vaporized * 100).toFixed(0)}% vaporized. ` +
        `Container 2: ${sub2.name} at ${c2.temperature.toFixed(1)}\u00B0C (BP: ${sub2.boilingPoint}\u00B0C, ` +
        `specific heat: ${sub2.specificHeat} J/g\u00B7\u00B0C), ` +
        `${c2.boiling ? "BOILING" : "heating"}, ${(c2.vaporized * 100).toFixed(0)}% vaporized. ` +
        `Time: ${time.toFixed(1)}s. ` +
        `Key physics: Q=mc\u0394T for heating, Q=mL for phase change.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
      // Reposition particles within new bounds
      for (let ci = 0; ci < 2; ci++) {
        const bounds = containerBounds(ci);
        for (const p of containers[ci].particles) {
          p.x = Math.max(bounds.left + p.radius, Math.min(bounds.right - p.radius, p.x));
          p.y = Math.max(bounds.top + p.radius, Math.min(bounds.bottom - p.radius, p.y));
        }
      }
    },
  };

  return engine;
};

export default BoilingPointFactory;
