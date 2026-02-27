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
  let separation = 4; // Angstroms
  let cationCharge = 1;
  let anionCharge = 1;
  let showForces = 1;

  // Physics constants (scaled)
  const ke = 14.4; // eV·Å for e²/(4πε₀)
  const sigma = 2.5; // Å, Pauli repulsion range
  const repulsionB = 1000; // repulsion coefficient

  // Dragging
  let dragging = false;
  let dragIon: "cation" | "anion" | null = null;

  function coulombEnergy(r: number): number {
    return -ke * cationCharge * anionCharge / r;
  }

  function repulsionEnergy(r: number): number {
    return repulsionB * Math.pow(sigma / r, 9);
  }

  function totalEnergy(r: number): number {
    return coulombEnergy(r) + repulsionEnergy(r);
  }

  function totalForce(r: number): number {
    // F = -dU/dr (numerical)
    const dr = 0.01;
    return -(totalEnergy(r + dr) - totalEnergy(r - dr)) / (2 * dr);
  }

  function findEquilibrium(): number {
    let rMin = 1;
    let eMin = totalEnergy(rMin);
    for (let r = 1; r <= 8; r += 0.01) {
      const e = totalEnergy(r);
      if (e < eMin) { eMin = e; rMin = r; }
    }
    return rMin;
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;

      canvas.addEventListener("mousedown", (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (width / rect.width);
        const ionY = height * 0.25;
        const cX = width / 2 - separation * 30;
        const aX = width / 2 + separation * 30;
        if (Math.abs(mx - cX) < 25 && Math.abs(e.clientY - rect.top - ionY * rect.height / height) < 25) {
          dragging = true;
          dragIon = "cation";
        } else if (Math.abs(mx - aX) < 25) {
          dragging = true;
          dragIon = "anion";
        }
      });
      canvas.addEventListener("mousemove", (e: MouseEvent) => {
        if (!dragging || !dragIon) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (width / rect.width);
        const center = width / 2;
        if (dragIon === "cation") {
          separation = Math.max(1.5, Math.min(8, (center - mx) / 30));
        } else {
          separation = Math.max(1.5, Math.min(8, (mx - center) / 30));
        }
      });
      canvas.addEventListener("mouseup", () => { dragging = false; dragIon = null; });
    },
    update(dt: number, params: Record<string, number>) {
      if (!dragging) {
        separation = params.separation ?? 4;
      }
      cationCharge = params.cationCharge ?? 1;
      anionCharge = params.anionCharge ?? 1;
      showForces = params.showForces ?? 1;
      time += dt;
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
      ctx.fillText("Ionic Bond — Energy vs Distance", width / 2, 22);

      // Ion visualization
      const ionY = height * 0.18;
      const cX = width / 2 - separation * 30;
      const aX = width / 2 + separation * 30;
      const ionR = 22;

      // Cation
      const cGrad = ctx.createRadialGradient(cX - 5, ionY - 5, 0, cX, ionY, ionR);
      cGrad.addColorStop(0, "#ef5350");
      cGrad.addColorStop(1, "#b71c1c");
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(cX, ionY, ionR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${cationCharge}`, cX, ionY);

      // Anion
      const aGrad = ctx.createRadialGradient(aX - 5, ionY - 5, 0, aX, ionY, ionR + 4);
      aGrad.addColorStop(0, "#42a5f5");
      aGrad.addColorStop(1, "#0d47a1");
      ctx.fillStyle = aGrad;
      ctx.beginPath();
      ctx.arc(aX, ionY, ionR + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(`−${anionCharge}`, aX, ionY);
      ctx.textBaseline = "alphabetic";

      // Distance label
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cX, ionY + ionR + 12);
      ctx.lineTo(aX, ionY + ionR + 12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#aaa";
      ctx.font = "12px sans-serif";
      ctx.fillText(`r = ${separation.toFixed(2)} Å`, width / 2, ionY + ionR + 26);

      // Force arrows
      if (showForces > 0.5) {
        const force = totalForce(separation);
        const arrowLen = Math.min(Math.abs(force) * 3, 50);
        const arrowDir = force > 0 ? 1 : -1; // positive = repulsion

        ctx.strokeStyle = force > 0 ? "#ff9800" : "#4caf50";
        ctx.fillStyle = force > 0 ? "#ff9800" : "#4caf50";
        ctx.lineWidth = 2.5;

        // Arrow on cation (pointing left if attractive)
        const cArrowEnd = cX - arrowLen * arrowDir;
        ctx.beginPath();
        ctx.moveTo(cX, ionY);
        ctx.lineTo(cArrowEnd, ionY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cArrowEnd, ionY);
        ctx.lineTo(cArrowEnd + arrowDir * 8, ionY - 4);
        ctx.lineTo(cArrowEnd + arrowDir * 8, ionY + 4);
        ctx.fill();

        // Arrow on anion (pointing right if attractive)
        const aArrowEnd = aX + arrowLen * arrowDir;
        ctx.beginPath();
        ctx.moveTo(aX, ionY);
        ctx.lineTo(aArrowEnd, ionY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(aArrowEnd, ionY);
        ctx.lineTo(aArrowEnd - arrowDir * 8, ionY - 4);
        ctx.lineTo(aArrowEnd - arrowDir * 8, ionY + 4);
        ctx.fill();
      }

      // Energy graph
      const gx = width * 0.12;
      const gy = height * 0.42;
      const gw = width * 0.76;
      const gh = height * 0.38;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.strokeRect(gx, gy, gw, gh);

      // Energy curves
      const rMin = 1;
      const rMax = 8;
      const eMin = -20;
      const eMax = 15;

      const toGx = (r: number) => gx + ((r - rMin) / (rMax - rMin)) * gw;
      const toGy = (e: number) => gy + gh - ((e - eMin) / (eMax - eMin)) * gh;

      // Zero line
      ctx.strokeStyle = "#666";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(gx, toGy(0));
      ctx.lineTo(gx + gw, toGy(0));
      ctx.stroke();
      ctx.setLineDash([]);

      // Coulomb curve (green)
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let first = true;
      for (let r = rMin; r <= rMax; r += 0.05) {
        const e = coulombEnergy(r);
        if (e < eMin || e > eMax) { first = true; continue; }
        const px = toGx(r);
        const py = toGy(e);
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Repulsion curve (blue)
      ctx.strokeStyle = "#42a5f5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      first = true;
      for (let r = rMin; r <= rMax; r += 0.05) {
        const e = repulsionEnergy(r);
        if (e > eMax) { first = true; continue; }
        const px = toGx(r);
        const py = toGy(e);
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Total energy curve (red)
      ctx.strokeStyle = "#ef5350";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      first = true;
      for (let r = rMin; r <= rMax; r += 0.05) {
        const e = totalEnergy(r);
        if (e < eMin || e > eMax) { first = true; continue; }
        const px = toGx(r);
        const py = toGy(e);
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current position marker
      const currentE = totalEnergy(separation);
      if (currentE >= eMin && currentE <= eMax) {
        ctx.fillStyle = "#ffeb3b";
        ctx.beginPath();
        ctx.arc(toGx(separation), toGy(currentE), 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Equilibrium marker
      const rEq = findEquilibrium();
      ctx.strokeStyle = "#ffeb3b";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(toGx(rEq), gy);
      ctx.lineTo(toGx(rEq), gy + gh);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffeb3b";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`r₀=${rEq.toFixed(2)}Å`, toGx(rEq), gy - 3);

      // Legend
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#4caf50";
      ctx.fillText("— Coulomb (attractive)", gx + 5, gy + 15);
      ctx.fillStyle = "#42a5f5";
      ctx.fillText("— Pauli repulsion", gx + 5, gy + 30);
      ctx.fillStyle = "#ef5350";
      ctx.fillText("— Total energy", gx + 5, gy + 45);

      // Axis labels
      ctx.fillStyle = "#aaa";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Distance r (Å)", gx + gw / 2, gy + gh + 16);
      ctx.save();
      ctx.translate(gx - 8, gy + gh / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Energy (eV)", 0, 0);
      ctx.restore();

      // Info
      const infoY = gy + gh + 22;
      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`E_total = ${currentE.toFixed(2)} eV | Equilibrium at r₀ = ${rEq.toFixed(2)} Å (E = ${totalEnergy(rEq).toFixed(2)} eV)`, width / 2, infoY + 12);
      ctx.fillStyle = "#aaa";
      ctx.fillText("Drag ions to change separation — bond forms at minimum energy", width / 2, infoY + 28);
    },
    reset() {
      time = 0;
      separation = 4;
      dragging = false;
    },
    destroy() {
      // Listeners cleaned up by canvas removal
    },
    getStateDescription(): string {
      const rEq = findEquilibrium();
      const currentE = totalEnergy(separation);
      return `Ionic bond simulation: Cation (+${cationCharge}) and anion (−${anionCharge}) at r=${separation.toFixed(2)}Å. Total energy=${currentE.toFixed(2)}eV. Equilibrium distance=${rEq.toFixed(2)}Å. The bond forms where the attractive Coulomb force balances the short-range Pauli repulsion, creating an energy minimum.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default IonicBondFactory;
