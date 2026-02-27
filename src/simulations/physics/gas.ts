import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface GasMolecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  color: string;
  label: string;
}

const GasFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gas") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 300;
  let numMolecules = 5;
  let moleculeMass = 28; // g/mol (N2 default)

  let molecules: GasMolecule[] = [];
  let speedHistory: number[][] = [];

  const R = 8.314; // J/(mol·K)
  const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#84cc16"];

  // Container dimensions
  let boxLeft = 0;
  let boxTop = 0;
  let boxW = 0;
  let boxH = 0;

  function initState() {
    time = 0;
    speedHistory = [];
    molecules = [];

    boxLeft = 40;
    boxTop = 80;
    boxW = width * 0.45;
    boxH = height - 160;

    // Initialize molecules with Maxwell-Boltzmann distributed velocities
    const vRms = Math.sqrt(3 * R * temperature / (moleculeMass / 1000)); // m/s
    const scale = 0.15; // pixel scale

    for (let i = 0; i < numMolecules; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = vRms * (0.5 + Math.random()) * scale;
      molecules.push({
        x: boxLeft + 20 + Math.random() * (boxW - 40),
        y: boxTop + 20 + Math.random() * (boxH - 40),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        mass: moleculeMass,
        color: colors[i % colors.length],
        label: `M${i + 1}`,
      });
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawContainer() {
    // Container background
    ctx.fillStyle = "rgba(30, 58, 138, 0.15)";
    ctx.fillRect(boxLeft, boxTop, boxW, boxH);

    // Container border
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxLeft, boxTop, boxW, boxH);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Gas Container", boxLeft + boxW / 2, boxTop - 10);
  }

  function drawMolecules() {
    const r = 10;
    for (const mol of molecules) {
      // Molecule body
      const grad = ctx.createRadialGradient(mol.x - 2, mol.y - 2, 0, mol.x, mol.y, r);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, mol.color);
      grad.addColorStop(1, mol.color + "88");
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Velocity arrow
      const arrowScale = 0.8;
      ctx.strokeStyle = mol.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mol.x, mol.y);
      ctx.lineTo(mol.x + mol.vx * arrowScale, mol.y + mol.vy * arrowScale);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#ffffff";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(mol.label, mol.x, mol.y + 3);
    }
  }

  function drawSpeedBarChart() {
    const chartLeft = boxLeft + boxW + 40;
    const chartTop = boxTop;
    const chartW = width - chartLeft - 30;
    const chartH = boxH;

    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(chartLeft - 10, chartTop - 5, chartW + 20, chartH + 30, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Molecular Speeds (m/s)", chartLeft + chartW / 2, chartTop + 12);

    // Compute speeds
    const scale = 1 / 0.15;
    const speeds = molecules.map(m => Math.sqrt(m.vx * m.vx + m.vy * m.vy) * scale);
    const maxSpeed = Math.max(...speeds, 100);

    const barW = Math.min(30, (chartW - 20) / molecules.length - 5);
    const barAreaTop = chartTop + 28;
    const barAreaH = chartH - 50;

    for (let i = 0; i < molecules.length; i++) {
      const mol = molecules[i];
      const barH = (speeds[i] / maxSpeed) * barAreaH;
      const x = chartLeft + 10 + i * (barW + 5);
      const y = barAreaTop + barAreaH - barH;

      // Bar
      const grad = ctx.createLinearGradient(x, y, x, barAreaTop + barAreaH);
      grad.addColorStop(0, mol.color);
      grad.addColorStop(1, mol.color + "44");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, barH);

      // Speed value
      ctx.fillStyle = mol.color;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(speeds[i].toFixed(0), x + barW / 2, y - 4);

      // Label
      ctx.fillText(mol.label, x + barW / 2, barAreaTop + barAreaH + 14);
    }

    // Axis
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartLeft + 5, barAreaTop);
    ctx.lineTo(chartLeft + 5, barAreaTop + barAreaH);
    ctx.lineTo(chartLeft + chartW - 5, barAreaTop + barAreaH);
    ctx.stroke();
  }

  function drawStats() {
    const scale = 1 / 0.15;
    const speeds = molecules.map(m => Math.sqrt(m.vx * m.vx + m.vy * m.vy) * scale);

    // Mean speed
    const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    // RMS speed
    const rmsSpeed = Math.sqrt(speeds.reduce((a, b) => a + b * b, 0) / speeds.length);
    // Theoretical v_rms
    const theoreticalRms = Math.sqrt(3 * R * temperature / (moleculeMass / 1000));
    // Theoretical mean speed
    const theoreticalMean = Math.sqrt(8 * R * temperature / (Math.PI * moleculeMass / 1000));

    const py = height - 65;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(10, py, width - 20, 55, 8);
    ctx.fill();

    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`Mean <v> = ${meanSpeed.toFixed(0)} m/s  (theory: ${theoreticalMean.toFixed(0)} m/s)`, 20, py + 20);

    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`v_rms = √(Σv²/N) = ${rmsSpeed.toFixed(0)} m/s  (theory: √(3RT/M) = ${theoreticalRms.toFixed(0)} m/s)`, 20, py + 40);
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RMS Speed of Gas Molecules", width / 2, 28);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.fillText(`T = ${temperature} K  |  M = ${moleculeMass} g/mol  |  v_rms = √(3RT/M)`, width / 2, 50);
  }

  return {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initState();
    },

    update(dt: number, params: Record<string, number>) {
      const newTemp = params.temperature ?? 300;
      const newN = Math.round(params.numMolecules ?? 5);
      const newMass = params.moleculeMass ?? 28;

      if (newN !== numMolecules || Math.abs(newMass - moleculeMass) > 0.5) {
        numMolecules = newN;
        moleculeMass = newMass;
        temperature = newTemp;
        initState();
        return;
      }

      // Rescale velocities if temperature changes
      if (Math.abs(newTemp - temperature) > 1) {
        const ratio = Math.sqrt(newTemp / temperature);
        for (const mol of molecules) {
          mol.vx *= ratio;
          mol.vy *= ratio;
        }
        temperature = newTemp;
      }

      time += dt;

      const r = 10;
      for (const mol of molecules) {
        mol.x += mol.vx * dt * 60;
        mol.y += mol.vy * dt * 60;

        // Wall collisions (elastic)
        if (mol.x - r < boxLeft) { mol.x = boxLeft + r; mol.vx = Math.abs(mol.vx); }
        if (mol.x + r > boxLeft + boxW) { mol.x = boxLeft + boxW - r; mol.vx = -Math.abs(mol.vx); }
        if (mol.y - r < boxTop) { mol.y = boxTop + r; mol.vy = Math.abs(mol.vy); }
        if (mol.y + r > boxTop + boxH) { mol.y = boxTop + boxH - r; mol.vy = -Math.abs(mol.vy); }
      }

      // Molecule-molecule elastic collisions
      for (let i = 0; i < molecules.length; i++) {
        for (let j = i + 1; j < molecules.length; j++) {
          const a = molecules[i];
          const b = molecules[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < r * 2 && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvn = dvx * nx + dvy * ny;
            if (dvn > 0) {
              a.vx -= dvn * nx;
              a.vy -= dvn * ny;
              b.vx += dvn * nx;
              b.vy += dvn * ny;
              // Separate
              const overlap = r * 2 - dist;
              a.x -= nx * overlap / 2;
              a.y -= ny * overlap / 2;
              b.x += nx * overlap / 2;
              b.y += ny * overlap / 2;
            }
          }
        }
      }
    },

    render() {
      drawBackground();
      drawContainer();
      drawMolecules();
      drawSpeedBarChart();
      drawStats();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {
      molecules = [];
    },

    getStateDescription(): string {
      const scale = 1 / 0.15;
      const speeds = molecules.map(m => Math.sqrt(m.vx * m.vx + m.vy * m.vy) * scale);
      const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const rmsSpeed = Math.sqrt(speeds.reduce((a, b) => a + b * b, 0) / speeds.length);
      const theoreticalRms = Math.sqrt(3 * R * temperature / (moleculeMass / 1000));
      return `Gas (RMS Speed): ${numMolecules} molecules at T=${temperature}K, M=${moleculeMass} g/mol. Measured v_rms=${rmsSpeed.toFixed(0)} m/s, mean=${meanSpeed.toFixed(0)} m/s. Theoretical v_rms=√(3RT/M)=${theoreticalRms.toFixed(0)} m/s. Kinetic energy ∝ temperature.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      boxW = width * 0.45;
      boxH = height - 160;
    },
  };
};

export default GasFactory;
