import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "H2" | "O2" | "H+" | "e-" | "H2O";
  alpha: number;
}

const FuelCellFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("fuel-cell") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let hydrogenFlow = 5;
  let oxygenFlow = 3;
  let temperature = 80;
  let loadResistance = 10;

  // State
  let voltage = 0;
  let current = 0;
  let power = 0;
  let waterProduced = 0;
  let efficiency = 0;

  const particles: Particle[] = [];
  const MAX_PARTICLES = 200;
  let spawnTimer = 0;

  // Voltage/power history
  const voltageHistory: Array<{ t: number; v: number }> = [];
  const powerHistory: Array<{ t: number; p: number }> = [];

  function reset(): void {
    time = 0;
    voltage = 0;
    current = 0;
    power = 0;
    waterProduced = 0;
    efficiency = 0;
    particles.length = 0;
    spawnTimer = 0;
    voltageHistory.length = 0;
    powerHistory.length = 0;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  // Cell geometry
  function cellBounds() {
    return {
      x: W * 0.15,
      y: H * 0.12,
      w: W * 0.55,
      h: H * 0.55,
      membraneX: W * 0.15 + W * 0.55 * 0.5,
    };
  }

  function spawnParticle(type: "H2" | "O2"): void {
    const cb = cellBounds();
    if (type === "H2") {
      particles.push({
        x: cb.x + 10,
        y: cb.y + Math.random() * cb.h,
        vx: 20 + Math.random() * 30,
        vy: (Math.random() - 0.5) * 20,
        type: "H2",
        alpha: 1,
      });
    } else {
      particles.push({
        x: cb.x + cb.w - 10,
        y: cb.y + Math.random() * cb.h,
        vx: -(20 + Math.random() * 30),
        vy: (Math.random() - 0.5) * 20,
        type: "O2",
        alpha: 1,
      });
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    const newH2 = params.hydrogenFlow ?? 5;
    const newO2 = params.oxygenFlow ?? 3;
    const newTemp = params.temperature ?? 80;
    const newLoad = params.loadResistance ?? 10;

    if (newH2 !== hydrogenFlow || newO2 !== oxygenFlow || newTemp !== temperature || newLoad !== loadResistance) {
      hydrogenFlow = newH2;
      oxygenFlow = newO2;
      temperature = newTemp;
      loadResistance = newLoad;
    }

    time += dt;

    // Theoretical cell voltage: E = E0 - losses
    const E0 = 1.23; // Standard cell potential for H2/O2
    const tempFactor = 1 - 0.0008 * (temperature - 25);
    const activationLoss = 0.1 + 0.02 * (1 / Math.max(hydrogenFlow, 0.1));
    const ohmicLoss = 0.05 * (current / Math.max(loadResistance, 0.1));
    voltage = Math.max(0, E0 * tempFactor - activationLoss - ohmicLoss);
    current = voltage / Math.max(loadResistance, 0.01);
    power = voltage * current;

    // Water production rate proportional to current (2H2 + O2 -> 2H2O)
    const reactionRate = Math.min(hydrogenFlow / 2, oxygenFlow) * 0.1;
    waterProduced += reactionRate * dt;
    efficiency = Math.min(95, (voltage / 1.48) * 100); // Thermoneutral voltage = 1.48V

    // Spawn particles
    spawnTimer += dt;
    if (spawnTimer > 0.1 && particles.length < MAX_PARTICLES) {
      spawnTimer = 0;
      for (let i = 0; i < Math.ceil(hydrogenFlow / 2); i++) spawnParticle("H2");
      for (let i = 0; i < Math.ceil(oxygenFlow / 2); i++) spawnParticle("O2");
    }

    const cb = cellBounds();

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (Math.random() - 0.5) * 40 * dt;

      // Bounce off walls
      if (p.y < cb.y + 5 || p.y > cb.y + cb.h - 5) p.vy *= -1;

      // H2 reaching membrane -> splits into H+ and e-
      if (p.type === "H2" && p.x >= cb.membraneX - 15) {
        particles.splice(i, 1);
        // Create H+ ions (pass through membrane)
        particles.push({
          x: cb.membraneX + 5,
          y: p.y,
          vx: 25 + Math.random() * 20,
          vy: (Math.random() - 0.5) * 15,
          type: "H+",
          alpha: 1,
        });
        // Create electrons (go through external circuit)
        particles.push({
          x: cb.membraneX - 20,
          y: cb.y - 10,
          vx: 30,
          vy: -20,
          type: "e-",
          alpha: 1,
        });
        continue;
      }

      // O2 reaching membrane area -> combine with H+ to form H2O
      if (p.type === "O2" && p.x <= cb.membraneX + 30) {
        particles.splice(i, 1);
        particles.push({
          x: cb.membraneX + 40,
          y: p.y + 20,
          vx: 15,
          vy: 10 + Math.random() * 10,
          type: "H2O",
          alpha: 1,
        });
        continue;
      }

      // H+ combining with O2 on cathode side
      if (p.type === "H+" && p.x > cb.x + cb.w - 30) {
        particles.splice(i, 1);
        continue;
      }

      // Water draining
      if (p.type === "H2O" && p.y > cb.y + cb.h - 5) {
        p.alpha -= dt * 2;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
      }

      // Electrons in external circuit
      if (p.type === "e-") {
        p.alpha -= dt * 0.8;
        if (p.alpha <= 0 || p.x > cb.x + cb.w + 50) {
          particles.splice(i, 1);
          continue;
        }
      }

      // Remove out-of-bounds
      if (p.x < cb.x - 20 || p.x > cb.x + cb.w + 60) {
        particles.splice(i, 1);
      }
    }

    // Record history
    if (voltageHistory.length === 0 || time - voltageHistory[voltageHistory.length - 1].t > 0.2) {
      voltageHistory.push({ t: time, v: voltage });
      powerHistory.push({ t: time, p: power });
      if (voltageHistory.length > 150) voltageHistory.shift();
      if (powerHistory.length > 150) powerHistory.shift();
    }
  }

  function drawCell(): void {
    const cb = cellBounds();

    // Cell body
    ctx.fillStyle = "rgba(30, 40, 60, 0.8)";
    ctx.strokeStyle = "#546e7a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cb.x, cb.y, cb.w, cb.h, 8);
    ctx.fill();
    ctx.stroke();

    // Anode (left)
    ctx.fillStyle = "#37474f";
    ctx.fillRect(cb.x + 5, cb.y + 5, 30, cb.h - 10);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(cb.x + 20, cb.y + cb.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("ANODE (−)", 0, 0);
    ctx.restore();

    // Cathode (right)
    ctx.fillStyle = "#37474f";
    ctx.fillRect(cb.x + cb.w - 35, cb.y + 5, 30, cb.h - 10);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 11px sans-serif";
    ctx.save();
    ctx.translate(cb.x + cb.w - 20, cb.y + cb.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("CATHODE (+)", 0, 0);
    ctx.restore();

    // PEM Membrane (center)
    ctx.fillStyle = "rgba(76, 175, 80, 0.3)";
    ctx.fillRect(cb.membraneX - 8, cb.y + 5, 16, cb.h - 10);
    ctx.strokeStyle = "#4caf50";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cb.membraneX, cb.y + 5);
    ctx.lineTo(cb.membraneX, cb.y + cb.h - 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#4caf50";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PEM", cb.membraneX, cb.y + cb.h + 14);

    // External circuit (wire from anode top to cathode top)
    ctx.strokeStyle = "#ffa726";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cb.x + 20, cb.y);
    ctx.lineTo(cb.x + 20, cb.y - 30);
    ctx.lineTo(cb.x + cb.w - 20, cb.y - 30);
    ctx.lineTo(cb.x + cb.w - 20, cb.y);
    ctx.stroke();

    // Light bulb on circuit
    const bulbX = cb.x + cb.w / 2;
    const bulbY = cb.y - 30;
    const bulbR = 12;
    const glowIntensity = Math.min(1, power * 5);
    if (glowIntensity > 0.1) {
      ctx.fillStyle = `rgba(255, 235, 59, ${glowIntensity * 0.3})`;
      ctx.beginPath();
      ctx.arc(bulbX, bulbY, bulbR + 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255, 235, 59, ${0.3 + glowIntensity * 0.7})`;
    ctx.beginPath();
    ctx.arc(bulbX, bulbY, bulbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LOAD", bulbX, bulbY);

    // Flow labels
    ctx.fillStyle = "#42a5f5";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("H₂ →", cb.x - 20, cb.y + cb.h / 2);

    ctx.fillStyle = "#ef5350";
    ctx.fillText("← O₂", cb.x + cb.w + 25, cb.y + cb.h / 2);

    ctx.fillStyle = "#81d4fa";
    ctx.fillText("H₂O ↓", cb.x + cb.w + 25, cb.y + cb.h - 10);
  }

  function drawParticles(): void {
    const cb = cellBounds();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cb.x, cb.y - 40, cb.w + 60, cb.h + 60);
    ctx.clip();

    for (const p of particles) {
      let color = "#42a5f5";
      let r = 5;
      let label = "";

      switch (p.type) {
        case "H2":
          color = "#42a5f5";
          r = 6;
          label = "H₂";
          break;
        case "O2":
          color = "#ef5350";
          r = 7;
          label = "O₂";
          break;
        case "H+":
          color = "#66bb6a";
          r = 4;
          label = "H⁺";
          break;
        case "e-":
          color = "#ffa726";
          r = 3;
          label = "e⁻";
          break;
        case "H2O":
          color = "#81d4fa";
          r = 6;
          label = "H₂O";
          break;
      }

      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (r >= 5) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawInfoPanel(): void {
    const px = W * 0.73;
    const py = H * 0.12;
    const pw = W * 0.24;
    const ph = H * 0.55;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Cell Performance", px + 10, py + 10);

    ctx.font = "12px monospace";
    let y = py + 35;
    const items = [
      { label: "Voltage", value: `${voltage.toFixed(3)} V`, color: "#42a5f5" },
      { label: "Current", value: `${(current * 1000).toFixed(1)} mA`, color: "#ffa726" },
      { label: "Power", value: `${(power * 1000).toFixed(1)} mW`, color: "#66bb6a" },
      { label: "Efficiency", value: `${efficiency.toFixed(1)}%`, color: "#ab47bc" },
      { label: "H₂O produced", value: `${waterProduced.toFixed(2)} mol`, color: "#81d4fa" },
      { label: "Temperature", value: `${temperature}°C`, color: "#ef5350" },
    ];

    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillText(item.label + ":", px + 10, y);
      ctx.fillStyle = "#fff";
      ctx.fillText(item.value, px + 10, y + 15);
      y += 36;
    }

    // Reactions
    y += 10;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("Reactions:", px + 10, y);
    y += 16;
    ctx.font = "9px monospace";
    ctx.fillStyle = "#42a5f5";
    ctx.fillText("Anode:  2H₂→4H⁺+4e⁻", px + 10, y);
    y += 14;
    ctx.fillStyle = "#ef5350";
    ctx.fillText("Cathode: O₂+4H⁺+4e⁻→2H₂O", px + 10, y);
    y += 14;
    ctx.fillStyle = "#fff";
    ctx.fillText("Overall: 2H₂+O₂→2H₂O", px + 10, y);
  }

  function drawVoltageGraph(): void {
    const gx = W * 0.15;
    const gy = H * 0.72;
    const gw = W * 0.7;
    const gh = H * 0.24;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Voltage & Power over Time", gx + 10, gy + 14);

    if (voltageHistory.length < 2) return;

    const px = gx + 40;
    const py = gy + 25;
    const pw = gw - 60;
    const ph = gh - 40;

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    const tMin = voltageHistory[0].t;
    const tMax = voltageHistory[voltageHistory.length - 1].t;
    const tRange = Math.max(tMax - tMin, 1);

    // Voltage line
    ctx.strokeStyle = "#42a5f5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < voltageHistory.length; i++) {
      const x = px + ((voltageHistory[i].t - tMin) / tRange) * pw;
      const y = py + ph - (voltageHistory[i].v / 1.5) * ph;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Power line
    const maxP = Math.max(...powerHistory.map((d) => d.p), 0.01);
    ctx.strokeStyle = "#66bb6a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < powerHistory.length; i++) {
      const x = px + ((powerHistory[i].t - tMin) / tRange) * pw;
      const y = py + ph - (powerHistory[i].p / (maxP * 1.2)) * ph;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Legend
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#42a5f5";
    ctx.fillText("— Voltage (V)", px + pw - 150, gy + 14);
    ctx.fillStyle = "#66bb6a";
    ctx.fillText("— Power (W)", px + pw - 50, gy + 14);
  }

  function render(): void {
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d1b2a");
    grad.addColorStop(1, "#1a2940");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Hydrogen Fuel Cell (PEM)", W / 2, 8);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("2H₂ + O₂ → 2H₂O + Electrical Energy", W / 2, 30);

    drawCell();
    drawParticles();
    drawInfoPanel();
    drawVoltageGraph();
  }

  function destroy(): void {
    particles.length = 0;
    voltageHistory.length = 0;
    powerHistory.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Hydrogen Fuel Cell (PEM): H₂ flow=${hydrogenFlow}, O₂ flow=${oxygenFlow}, ` +
      `temperature=${temperature}°C, load=${loadResistance}Ω. ` +
      `Output: voltage=${voltage.toFixed(3)}V, current=${(current * 1000).toFixed(1)}mA, ` +
      `power=${(power * 1000).toFixed(1)}mW. Efficiency=${efficiency.toFixed(1)}%. ` +
      `Water produced: ${waterProduced.toFixed(2)} mol. ` +
      `Reaction: 2H₂ + O₂ → 2H₂O + electricity. ` +
      `The PEM (Proton Exchange Membrane) allows H⁺ ions to pass while electrons flow through external circuit.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FuelCellFactory;
