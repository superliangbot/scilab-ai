import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface IonParticle {
  x: number;
  y: number;
  symbol: string;
  charge: number;
  color: string;
  radius: number;
  placed: boolean;
}

const IonModelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ion-model") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;

  let compoundType = 0; // 0=NaCl, 1=MgO, 2=CaCl2, 3=MgF2
  let showCharges = 1;
  let showLabels = 1;
  let gridSize = 3; // grid dimension

  interface CompoundDef {
    name: string;
    formula: string;
    cation: { symbol: string; charge: number; color: string };
    anion: { symbol: string; charge: number; color: string };
    ratio: [number, number]; // cation:anion
  }

  const compounds: CompoundDef[] = [
    { name: "Sodium Chloride", formula: "NaCl", cation: { symbol: "Na", charge: 1, color: "#818cf8" }, anion: { symbol: "Cl", charge: -1, color: "#34d399" }, ratio: [1, 1] },
    { name: "Magnesium Oxide", formula: "MgO", cation: { symbol: "Mg", charge: 2, color: "#f472b6" }, anion: { symbol: "O", charge: -2, color: "#f87171" }, ratio: [1, 1] },
    { name: "Calcium Chloride", formula: "CaCl₂", cation: { symbol: "Ca", charge: 2, color: "#fbbf24" }, anion: { symbol: "Cl", charge: -1, color: "#34d399" }, ratio: [1, 2] },
    { name: "Magnesium Fluoride", formula: "MgF₂", cation: { symbol: "Mg", charge: 2, color: "#f472b6" }, anion: { symbol: "F", charge: -1, color: "#38bdf8" }, ratio: [1, 2] },
  ];

  let particles: IonParticle[] = [];
  let animTime = 0;

  function buildLattice() {
    particles = [];
    const comp = compounds[compoundType];
    const spacing = Math.min(width, height) * 0.7 / gridSize;
    const startX = width / 2 - (gridSize - 1) * spacing / 2;
    const startY = height / 2 - (gridSize - 1) * spacing / 2;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const isCation = (row + col) % 2 === 0;
        // For 1:2 ratios, alternate anions more
        if (comp.ratio[0] === 1 && comp.ratio[1] === 2) {
          // Place cation at even positions, anions everywhere else
          if ((row + col) % 3 === 0) {
            particles.push({
              x: startX + col * spacing,
              y: startY + row * spacing,
              symbol: comp.cation.symbol,
              charge: comp.cation.charge,
              color: comp.cation.color,
              radius: 22,
              placed: true,
            });
          } else {
            particles.push({
              x: startX + col * spacing,
              y: startY + row * spacing,
              symbol: comp.anion.symbol,
              charge: comp.anion.charge,
              color: comp.anion.color,
              radius: 18,
              placed: true,
            });
          }
        } else {
          // 1:1 ratio — alternating pattern
          const ion = isCation ? comp.cation : comp.anion;
          particles.push({
            x: startX + col * spacing,
            y: startY + row * spacing,
            symbol: ion.symbol,
            charge: ion.charge,
            color: ion.color,
            radius: isCation ? 22 : 18,
            placed: true,
          });
        }
      }
    }
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      buildLattice();
    },
    update(dt: number, params: Record<string, number>) {
      const newType = Math.round(params.compoundType ?? 0);
      const newGrid = Math.max(2, Math.min(6, Math.round(params.gridSize ?? 3)));
      showCharges = params.showCharges ?? 1;
      showLabels = params.showLabels ?? 1;

      if (newType !== compoundType || newGrid !== gridSize) {
        compoundType = newType;
        gridSize = newGrid;
        buildLattice();
      }

      animTime += dt;
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      const comp = compounds[compoundType];

      // Title
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`Ionic Compound Model: ${comp.name} (${comp.formula})`, width / 2, 28);

      // Draw bonds between adjacent particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const spacing = Math.min(width, height) * 0.7 / gridSize;
          if (dist < spacing * 1.2 && particles[i].charge * particles[j].charge < 0) {
            // Attractive bond
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.3 + 0.1 * Math.sin(animTime * 2)})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        // Glow
        const glow = ctx.createRadialGradient(p.x, p.y, p.radius * 0.5, p.x, p.y, p.radius * 1.5);
        glow.addColorStop(0, p.color);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Symbol
        if (showLabels) {
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${p.radius * 0.7}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.symbol, p.x, p.y);
          ctx.textBaseline = "alphabetic";
        }

        // Charge
        if (showCharges) {
          const chargeStr = p.charge > 0
            ? (p.charge > 1 ? `${p.charge}+` : "+")
            : (p.charge < -1 ? `${Math.abs(p.charge)}−` : "−");
          ctx.fillStyle = p.charge > 0 ? "#fbbf24" : "#f87171";
          ctx.font = `bold ${p.radius * 0.5}px sans-serif`;
          ctx.textAlign = "left";
          ctx.fillText(chargeStr, p.x + p.radius * 0.5, p.y - p.radius * 0.5);
        }
      }

      // Info panel
      ctx.fillStyle = "#94a3b8";
      ctx.font = `${Math.max(11, width * 0.015)}px sans-serif`;
      ctx.textAlign = "center";
      const infoY = height - 30;
      ctx.fillText(`Ionic lattice structure — oppositely charged ions attract and form a crystal`, width / 2, infoY);

      // Legend
      ctx.textAlign = "left";
      ctx.font = `${Math.max(10, width * 0.014)}px sans-serif`;
      const lx = 15;
      let ly = height - 70;
      ctx.fillStyle = comp.cation.color;
      ctx.fillText(`● ${comp.cation.symbol}${comp.cation.charge > 0 ? "⁺".repeat(comp.cation.charge) : ""} (cation)`, lx, ly);
      ly += 18;
      ctx.fillStyle = comp.anion.color;
      ctx.fillText(`● ${comp.anion.symbol}${Math.abs(comp.anion.charge) > 1 ? "²" : ""}⁻ (anion)`, lx, ly);
    },
    reset() {
      animTime = 0;
      buildLattice();
    },
    destroy() {},
    getStateDescription(): string {
      const comp = compounds[compoundType];
      const totalCations = particles.filter((p) => p.charge > 0).length;
      const totalAnions = particles.filter((p) => p.charge < 0).length;
      return `Ionic compound model: ${comp.name} (${comp.formula}). ` +
        `${gridSize}×${gridSize} lattice with ${totalCations} cations and ${totalAnions} anions. ` +
        `Cation: ${comp.cation.symbol}${"⁺".repeat(comp.cation.charge)}, Anion: ${comp.anion.symbol} with charge ${comp.anion.charge}. ` +
        `Ionic bonds form due to electrostatic attraction between oppositely charged ions.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      buildLattice();
    },
  };
};

export default IonModelFactory;
