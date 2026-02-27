import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Ion {
  x: number;
  y: number;
  charge: number; // +1 or -1
  symbol: string;
  radius: number;
  color: string;
}

const IonModelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ion-model") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let compoundType = 0; // 0=NaCl, 1=KCl, 2=MgO, 3=CaF2
  let gridSize = 5;
  let showLabels = 1;
  let rotationSpeed = 0.3;

  const compounds = [
    { name: "NaCl", cation: "Na⁺", anion: "Cl⁻", cColor: "#7e57c2", aColor: "#66bb6a", cRadius: 12, aRadius: 16 },
    { name: "KCl", cation: "K⁺", anion: "Cl⁻", cColor: "#ef5350", aColor: "#66bb6a", cRadius: 14, aRadius: 16 },
    { name: "MgO", cation: "Mg²⁺", anion: "O²⁻", cColor: "#ff9800", aColor: "#ef5350", cRadius: 10, aRadius: 14 },
    { name: "CaF₂", cation: "Ca²⁺", anion: "F⁻", cColor: "#42a5f5", aColor: "#ffeb3b", cRadius: 13, aRadius: 11 },
  ];

  let ions: Ion[] = [];
  let angle = 0;

  function buildLattice() {
    ions = [];
    const comp = compounds[Math.round(compoundType)] || compounds[0];
    const n = Math.round(gridSize);
    const spacing = Math.min(width, height) * 0.7 / n;
    const offsetX = width / 2 - (n - 1) * spacing / 2;
    const offsetY = height * 0.45 - (n - 1) * spacing / 2;

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const isPositive = (row + col) % 2 === 0;
        ions.push({
          x: offsetX + col * spacing,
          y: offsetY + row * spacing,
          charge: isPositive ? 1 : -1,
          symbol: isPositive ? comp.cation : comp.anion,
          radius: isPositive ? comp.cRadius : comp.aRadius,
          color: isPositive ? comp.cColor : comp.aColor,
        });
      }
    }
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      buildLattice();
    },
    update(dt: number, params: Record<string, number>) {
      const oldCompound = Math.round(compoundType);
      const oldGrid = Math.round(gridSize);
      compoundType = params.compoundType ?? 0;
      gridSize = params.gridSize ?? 5;
      showLabels = params.showLabels ?? 1;
      rotationSpeed = params.rotationSpeed ?? 0.3;

      if (Math.round(compoundType) !== oldCompound || Math.round(gridSize) !== oldGrid) {
        buildLattice();
      }

      angle += rotationSpeed * dt;
      time += dt;
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const comp = compounds[Math.round(compoundType)] || compounds[0];

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Ionic Crystal Lattice — ${comp.name}`, width / 2, 22);

      // Apply pseudo-3D rotation
      const cx = width / 2;
      const cy = height * 0.45;
      const cosA = Math.cos(angle);
      const depth = 0.15;

      // Draw bonds first (behind ions)
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      const n = Math.round(gridSize);
      const spacing = Math.min(width, height) * 0.7 / n;

      for (let i = 0; i < ions.length; i++) {
        const ion = ions[i];
        const dx = ion.x - cx;
        const rx = cx + dx * cosA;
        const ry = ion.y + dx * depth * Math.sin(angle);

        // Connect to right neighbor
        if (i + 1 < ions.length && Math.floor(i / n) === Math.floor((i + 1) / n)) {
          const next = ions[i + 1];
          const ndx = next.x - cx;
          const nrx = cx + ndx * cosA;
          const nry = next.y + ndx * depth * Math.sin(angle);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(nrx, nry);
          ctx.stroke();
        }

        // Connect to bottom neighbor
        if (i + n < ions.length) {
          const next = ions[i + n];
          const ndx = next.x - cx;
          const nrx = cx + ndx * cosA;
          const nry = next.y + ndx * depth * Math.sin(angle);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(nrx, nry);
          ctx.stroke();
        }
      }

      // Draw ions
      for (const ion of ions) {
        const dx = ion.x - cx;
        const rx = cx + dx * cosA;
        const ry = ion.y + dx * depth * Math.sin(angle);
        const scale = 1 + dx * depth * Math.cos(angle) * 0.001;
        const r = ion.radius * Math.max(0.7, scale);

        // Glow
        const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, r * 2);
        glow.addColorStop(0, ion.color + "40");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(rx, ry, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // Ion sphere
        const grad = ctx.createRadialGradient(rx - r * 0.3, ry - r * 0.3, 0, rx, ry, r);
        grad.addColorStop(0, ion.color);
        grad.addColorStop(1, "#222");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.arc(rx - r * 0.25, ry - r * 0.25, r * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Label
        if (showLabels > 0.5) {
          ctx.fillStyle = "#fff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ion.symbol, rx, ry);
          ctx.textBaseline = "alphabetic";
        }
      }

      // Legend
      const legY = height * 0.82;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.1, legY, width * 0.8, 55);

      ctx.fillStyle = comp.cColor;
      ctx.beginPath();
      ctx.arc(width * 0.2, legY + 18, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${comp.cation} (cation)`, width * 0.2 + 14, legY + 22);

      ctx.fillStyle = comp.aColor;
      ctx.beginPath();
      ctx.arc(width * 0.55, legY + 18, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e0e0e0";
      ctx.fillText(`${comp.anion} (anion)`, width * 0.55 + 14, legY + 22);

      ctx.fillStyle = "#aaa";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Each ion is surrounded by oppositely charged neighbors — this is the basis of ionic crystal structure", width / 2, legY + 48);
    },
    reset() {
      time = 0;
      angle = 0;
      buildLattice();
    },
    destroy() {},
    getStateDescription(): string {
      const comp = compounds[Math.round(compoundType)] || compounds[0];
      const n = Math.round(gridSize);
      return `Ionic lattice model of ${comp.name}: ${n}×${n} grid with alternating ${comp.cation} and ${comp.anion} ions. Each cation is surrounded by anions and vice versa, held together by electrostatic attraction. This regular arrangement minimizes energy and is characteristic of ionic crystals.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      buildLattice();
    },
  };

  return engine;
};

export default IonModelFactory;
