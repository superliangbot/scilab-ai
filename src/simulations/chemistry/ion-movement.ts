import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Ion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  charge: number;
  symbol: string;
  color: string;
  radius: number;
}

const IonMovementFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ion-movement") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 5; // V applied
  let ionCount = 20;
  let temperature = 25; // °C — affects Brownian motion

  let ions: Ion[] = [];

  // Container bounds
  let containerLeft = 0;
  let containerRight = 0;
  let containerTop = 0;
  let containerBot = 0;

  function initIons() {
    ions = [];
    const cL = containerLeft + 20;
    const cR = containerRight - 20;
    const cT = containerTop + 20;
    const cB = containerBot - 20;

    for (let i = 0; i < ionCount; i++) {
      const isPositive = i < ionCount / 2;
      if (isPositive) {
        // Cu2+ or K+ ions
        const isCu = Math.random() < 0.5;
        ions.push({
          x: cL + Math.random() * (cR - cL),
          y: cT + Math.random() * (cB - cT),
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          charge: isCu ? 2 : 1,
          symbol: isCu ? "Cu²⁺" : "K⁺",
          color: isCu ? "#38bdf8" : "#a78bfa",
          radius: isCu ? 8 : 6,
        });
      } else {
        // MnO4- or Cl- ions
        const isMnO4 = Math.random() < 0.5;
        ions.push({
          x: cL + Math.random() * (cR - cL),
          y: cT + Math.random() * (cB - cT),
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          charge: -1,
          symbol: isMnO4 ? "MnO₄⁻" : "Cl⁻",
          color: isMnO4 ? "#c084fc" : "#4ade80",
          radius: isMnO4 ? 9 : 6,
        });
      }
    }
  }

  function updateBounds() {
    containerLeft = width * 0.1;
    containerRight = width * 0.9;
    containerTop = height * 0.15;
    containerBot = height * 0.75;
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      updateBounds();
      initIons();
    },
    update(dt: number, params: Record<string, number>) {
      voltage = params.voltage ?? 5;
      temperature = params.temperature ?? 25;
      const newCount = Math.round(params.ionCount ?? 20);
      if (newCount !== ionCount) {
        ionCount = newCount;
        initIons();
      }

      const dtc = Math.min(dt, 0.05);
      time += dtc;

      // Electric field direction: positive electrode on left, negative on right
      // So E field points left→right (positive to negative)
      // Positive ions move right (toward cathode), negative ions move left (toward anode)
      const E = voltage * 15; // scaled field strength
      const brownian = (temperature + 273) * 0.15;

      for (const ion of ions) {
        // Coulomb force: F = qE
        const ax = ion.charge * E;
        ion.vx += ax * dtc;
        ion.vy += 0;

        // Brownian motion
        ion.vx += (Math.random() - 0.5) * brownian * dtc * 20;
        ion.vy += (Math.random() - 0.5) * brownian * dtc * 20;

        // Drag
        ion.vx *= 0.98;
        ion.vy *= 0.98;

        ion.x += ion.vx * dtc;
        ion.y += ion.vy * dtc;

        // Container bounds
        if (ion.x < containerLeft + ion.radius) {
          ion.x = containerLeft + ion.radius;
          ion.vx = Math.abs(ion.vx) * 0.5;
        }
        if (ion.x > containerRight - ion.radius) {
          ion.x = containerRight - ion.radius;
          ion.vx = -Math.abs(ion.vx) * 0.5;
        }
        if (ion.y < containerTop + ion.radius) {
          ion.y = containerTop + ion.radius;
          ion.vy = Math.abs(ion.vy) * 0.5;
        }
        if (ion.y > containerBot - ion.radius) {
          ion.y = containerBot - ion.radius;
          ion.vy = -Math.abs(ion.vy) * 0.5;
        }
      }
    },
    render() {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#1e293b";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Ion Movement in an Electric Field", width / 2, 24);

      // Container (electrolyte solution)
      ctx.fillStyle = "rgba(186, 230, 253, 0.3)";
      ctx.fillRect(containerLeft, containerTop, containerRight - containerLeft, containerBot - containerTop);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.strokeRect(containerLeft, containerTop, containerRight - containerLeft, containerBot - containerTop);

      // Electrodes
      const electrodeW = 12;
      // Anode (+) on left
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(containerLeft - electrodeW, containerTop, electrodeW, containerBot - containerTop);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(14, width * 0.02)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("+", containerLeft - electrodeW / 2, (containerTop + containerBot) / 2 + 5);

      // Cathode (-) on right
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(containerRight, containerTop, electrodeW, containerBot - containerTop);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("−", containerRight + electrodeW / 2, (containerTop + containerBot) / 2 + 5);

      // Electric field lines
      ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      const numLines = 5;
      for (let i = 0; i < numLines; i++) {
        const y = containerTop + ((i + 1) / (numLines + 1)) * (containerBot - containerTop);
        ctx.beginPath();
        ctx.moveTo(containerLeft + 15, y);
        ctx.lineTo(containerRight - 15, y);
        ctx.stroke();
        // Arrow
        ctx.fillStyle = "rgba(100, 116, 139, 0.3)";
        const ax = containerRight - 25;
        ctx.beginPath();
        ctx.moveTo(ax + 8, y);
        ctx.lineTo(ax, y - 4);
        ctx.lineTo(ax, y + 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.setLineDash([]);

      // Draw ions
      for (const ion of ions) {
        // Trail
        const trailLen = Math.abs(ion.vx) * 0.3;
        if (trailLen > 2) {
          ctx.strokeStyle = ion.color + "40";
          ctx.lineWidth = ion.radius * 0.8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(ion.x - Math.sign(ion.vx) * trailLen, ion.y);
          ctx.lineTo(ion.x, ion.y);
          ctx.stroke();
        }

        // Body
        ctx.fillStyle = ion.color;
        ctx.beginPath();
        ctx.arc(ion.x, ion.y, ion.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.max(7, ion.radius * 0.7)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ion.symbol.replace(/[⁺⁻²]/g, "").substring(0, 3), ion.x, ion.y);
        ctx.textBaseline = "alphabetic";
      }

      // Voltage label
      ctx.fillStyle = "#475569";
      ctx.font = `${Math.max(12, width * 0.016)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`Applied Voltage: ${voltage.toFixed(1)} V`, width / 2, containerBot + 24);

      // Legend
      const ly = height - 40;
      ctx.font = `${Math.max(10, width * 0.014)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("● Cu²⁺ → cathode (−)", width * 0.08, ly);
      ctx.fillStyle = "#a78bfa";
      ctx.fillText("● K⁺ → cathode (−)", width * 0.32, ly);
      ctx.fillStyle = "#c084fc";
      ctx.fillText("● MnO₄⁻ → anode (+)", width * 0.53, ly);
      ctx.fillStyle = "#4ade80";
      ctx.fillText("● Cl⁻ → anode (+)", width * 0.78, ly);

      // Info
      ctx.fillStyle = "#64748b";
      ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Positive ions migrate toward the negative electrode; negative ions toward the positive electrode", width / 2, height - 12);
    },
    reset() {
      time = 0;
      initIons();
    },
    destroy() {},
    getStateDescription(): string {
      const posIons = ions.filter((i) => i.charge > 0);
      const negIons = ions.filter((i) => i.charge < 0);
      const avgPosX = posIons.reduce((s, i) => s + i.x, 0) / Math.max(posIons.length, 1);
      const avgNegX = negIons.reduce((s, i) => s + i.x, 0) / Math.max(negIons.length, 1);
      return `Ion movement in electric field: ${voltage.toFixed(1)}V applied, ${ionCount} ions, T=${temperature}°C. ` +
        `Positive ions (${posIons.length}) avg position at ${((avgPosX - containerLeft) / (containerRight - containerLeft) * 100).toFixed(0)}% across container. ` +
        `Negative ions (${negIons.length}) avg position at ${((avgNegX - containerLeft) / (containerRight - containerLeft) * 100).toFixed(0)}% across. ` +
        `Cations move toward cathode (−), anions toward anode (+), demonstrating electrophoresis.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      updateBounds();
    },
  };
};

export default IonMovementFactory;
