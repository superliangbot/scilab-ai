import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const IonicBondFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ionic-bond") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let separation = 3.0; // Å (angstrom)
  let cationCharge = 1;
  let showForces = 1;

  // Physics constants (scaled)
  const k_coulomb = 14.4; // eV·Å for unit charges
  const rho = 0.3; // Å — Pauli repulsion range parameter
  const B = 1000; // repulsion strength coefficient

  function coulombEnergy(r: number): number {
    return -k_coulomb * cationCharge / r;
  }

  function pauliEnergy(r: number): number {
    return B * Math.exp(-r / rho);
  }

  function totalEnergy(r: number): number {
    return coulombEnergy(r) + pauliEnergy(r);
  }

  function equilibriumDistance(): number {
    // Find minimum energy numerically
    let minE = Infinity;
    let minR = 1;
    for (let r = 0.5; r < 6; r += 0.01) {
      const E = totalEnergy(r);
      if (E < minE) { minE = E; minR = r; }
    }
    return minR;
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },
    update(dt: number, params: Record<string, number>) {
      separation = params.separation ?? 3.0;
      cationCharge = Math.max(1, Math.round(params.cationCharge ?? 1));
      showForces = params.showForces ?? 1;
      time += dt;
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Ionic Bond — Energy vs Distance", width / 2, 26);

      const graphTop = height * 0.08;
      const graphH = height * 0.5;
      const graphLeft = width * 0.12;
      const graphW = width * 0.8;
      const ionY = height * 0.72;

      // Draw energy graph
      drawEnergyGraph(graphLeft, graphTop, graphW, graphH);

      // Draw ions
      drawIons(ionY);

      // Info
      const eqR = equilibriumDistance();
      const eqE = totalEnergy(eqR);
      const currE = totalEnergy(separation);

      ctx.fillStyle = "#94a3b8";
      ctx.font = `${Math.max(11, width * 0.015)}px monospace`;
      ctx.textAlign = "left";
      const ix = 15;
      let iy = height - 60;
      ctx.fillText(`r = ${separation.toFixed(2)} Å`, ix, iy);
      ctx.fillText(`E_total = ${currE.toFixed(2)} eV`, ix, iy + 16);
      ctx.fillStyle = "#10b981";
      ctx.fillText(`r_eq = ${eqR.toFixed(2)} Å, E_min = ${eqE.toFixed(2)} eV`, ix, iy + 32);
    },
    reset() {
      time = 0;
      separation = 3.0;
    },
    destroy() {},
    getStateDescription(): string {
      const eqR = equilibriumDistance();
      const eqE = totalEnergy(eqR);
      const currE = totalEnergy(separation);
      return `Ionic bond energy model: separation=${separation.toFixed(2)}Å, charge=${cationCharge}+. ` +
        `Coulomb energy=${coulombEnergy(separation).toFixed(2)}eV, Pauli repulsion=${pauliEnergy(separation).toFixed(2)}eV. ` +
        `Total energy=${currE.toFixed(2)}eV. Equilibrium at r=${eqR.toFixed(2)}Å with E=${eqE.toFixed(2)}eV. ` +
        `The bond forms at the distance where total energy is minimized.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawEnergyGraph(gx: number, gy: number, gw: number, gh: number) {
    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    const rMin = 0.5;
    const rMax = 6;
    const eMin = -8;
    const eMax = 5;

    const toX = (r: number) => gx + ((r - rMin) / (rMax - rMin)) * gw;
    const toY = (e: number) => gy + gh - ((e - eMin) / (eMax - eMin)) * gh;

    // Zero line
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(gx, toY(0));
    ctx.lineTo(gx + gw, toY(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("r (Å)", gx + gw / 2, gy + gh + 16);
    ctx.save();
    ctx.translate(gx - 8, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Energy (eV)", 0, 0);
    ctx.restore();

    // R tick marks
    for (let r = 1; r <= 5; r++) {
      ctx.fillText(r.toString(), toX(r), gy + gh + 12);
    }

    // Draw curves
    const drawCurve = (fn: (r: number) => number, color: string, label: string, labelR: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (let px = 0; px < gw; px++) {
        const r = rMin + (px / gw) * (rMax - rMin);
        const e = fn(r);
        if (e < eMin - 2 || e > eMax + 2) { started = false; continue; }
        const x = gx + px;
        const y = toY(e);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      const lx = toX(labelR);
      const ly = toY(Math.max(eMin, Math.min(eMax, fn(labelR))));
      ctx.fillText(label, lx + 4, ly - 6);
    };

    drawCurve(coulombEnergy, "#4ade80", "Coulomb (attractive)", 4);
    drawCurve(pauliEnergy, "#60a5fa", "Pauli (repulsive)", 1.2);
    drawCurve(totalEnergy, "#f87171", "Total Energy", 2.5);

    // Current position marker
    const cx = toX(separation);
    const cy = toY(Math.max(eMin, Math.min(eMax, totalEnergy(separation))));
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Equilibrium marker
    const eqR = equilibriumDistance();
    const eqX = toX(eqR);
    const eqY = toY(totalEnergy(eqR));
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(eqX, gy);
    ctx.lineTo(eqX, gy + gh);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#10b981";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("r_eq", eqX, gy + gh + 12);
  }

  function drawIons(y: number) {
    const cx = width / 2;
    const scale = Math.min(width, height) * 0.06;
    const pixelSep = separation * scale;

    // Cation (left)
    const cX = cx - pixelSep / 2;
    const aX = cx + pixelSep / 2;
    const r = 20;

    // Bond line
    ctx.strokeStyle = separation < equilibriumDistance() * 1.5
      ? `rgba(74, 222, 128, ${Math.max(0, 1 - separation / 5)})`
      : "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cX + r, y);
    ctx.lineTo(aX - r, y);
    ctx.stroke();

    // Cation
    const cGrad = ctx.createRadialGradient(cX, y, 2, cX, y, r);
    cGrad.addColorStop(0, "#93c5fd");
    cGrad.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(cX, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${cationCharge}`, cX, y);

    // Anion
    const aGrad = ctx.createRadialGradient(aX, y, 2, aX, y, r + 4);
    aGrad.addColorStop(0, "#fca5a5");
    aGrad.addColorStop(1, "#dc2626");
    ctx.fillStyle = aGrad;
    ctx.beginPath();
    ctx.arc(aX, y, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText("−1", aX, y);
    ctx.textBaseline = "alphabetic";

    // Force arrows
    if (showForces) {
      const netForce = -k_coulomb * cationCharge / (separation * separation)
        + (B / rho) * Math.exp(-separation / rho);
      const arrowScale = Math.min(Math.abs(netForce) * 3, 40);

      if (arrowScale > 2) {
        const dir = netForce > 0 ? 1 : -1; // positive = repulsive
        ctx.fillStyle = netForce > 0 ? "#f87171" : "#4ade80";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(netForce > 0 ? "Repulsive" : "Attractive", cx, y + r + 30);

        // Arrows on ions
        drawForceArrow(cX - r - 5, y, -dir * arrowScale, ctx.fillStyle);
        drawForceArrow(aX + r + 5, y, dir * arrowScale, ctx.fillStyle);
      }
    }

    // Distance label
    ctx.fillStyle = "#fbbf24";
    ctx.font = `${Math.max(11, width * 0.015)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`r = ${separation.toFixed(2)} Å`, cx, y - r - 12);
  }

  function drawForceArrow(x: number, y: number, len: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();

    const headLen = 6;
    const dir = Math.sign(len);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + len, y);
    ctx.lineTo(x + len - dir * headLen, y - 4);
    ctx.lineTo(x + len - dir * headLen, y + 4);
    ctx.closePath();
    ctx.fill();
  }
};

export default IonicBondFactory;
