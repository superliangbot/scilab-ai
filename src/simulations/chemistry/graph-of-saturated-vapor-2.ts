import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Substance {
  name: string;
  formula: string;
  // Antoine equation constants: log10(P) = A - B/(C+T) where P in mmHg, T in °C
  A: number;
  B: number;
  C: number;
  color: string;
  boilingPoint: number; // °C at 1 atm
}

const GraphOfSaturatedVapor2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("graph-of-saturated-vapor-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let temperature = 50; // °C
  let showSubstance1 = 1; // Water
  let showSubstance2 = 1; // Ethanol
  let showSubstance3 = 1; // Diethyl ether

  const substances: Substance[] = [
    { name: "Water", formula: "H₂O", A: 8.07131, B: 1730.63, C: 233.426, color: "#42a5f5", boilingPoint: 100 },
    { name: "Ethanol", formula: "C₂H₅OH", A: 8.20417, B: 1642.89, C: 230.300, color: "#ab47bc", boilingPoint: 78.37 },
    { name: "Diethyl Ether", formula: "(C₂H₅)₂O", A: 6.92032, B: 1064.07, C: 228.800, color: "#66bb6a", boilingPoint: 34.6 },
  ];

  // Calculate vapor pressure using Antoine equation (returns mmHg)
  function vaporPressure(sub: Substance, T: number): number {
    const logP = sub.A - sub.B / (sub.C + T);
    return Math.pow(10, logP);
  }

  // Convert mmHg to kPa
  function mmHgToKPa(mmHg: number): number {
    return mmHg * 0.133322;
  }

  function reset(): void {
    time = 0;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    temperature = params.temperature ?? 50;
    showSubstance1 = params.showSubstance1 ?? 1;
    showSubstance2 = params.showSubstance2 ?? 1;
    showSubstance3 = params.showSubstance3 ?? 1;
    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d1b2a");
    grad.addColorStop(1, "#1a2940");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawMainGraph(): void {
    const gx = W * 0.08;
    const gy = H * 0.06;
    const gw = W * 0.58;
    const gh = H * 0.6;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Saturated Vapor Pressure vs Temperature", gx + gw / 2, gy + 18);

    const px = gx + 60;
    const py = gy + 35;
    const pw = gw - 80;
    const ph = gh - 60;

    // Temperature range: 0 to 120°C
    const tMin = 0;
    const tMax = 120;
    // Pressure range: 0 to 200 kPa
    const pMin = 0;
    const pMax = 200;

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let t = 0; t <= 120; t += 20) {
      const x = px + ((t - tMin) / (tMax - tMin)) * pw;
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x, py + ph);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${t}°C`, x, py + ph + 14);
    }
    for (let p = 0; p <= 200; p += 25) {
      const y = py + ph - ((p - pMin) / (pMax - pMin)) * ph;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + pw, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${p}`, px - 5, y + 3);
    }

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature (°C)", px + pw / 2, py + ph + 30);
    ctx.save();
    ctx.translate(px - 45, py + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Pressure (kPa)", 0, 0);
    ctx.restore();

    // 1 atm = 101.325 kPa reference line
    const atmY = py + ph - ((101.325 - pMin) / (pMax - pMin)) * ph;
    ctx.strokeStyle = "rgba(255, 152, 0, 0.4)";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, atmY);
    ctx.lineTo(px + pw, atmY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffa726";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("1 atm (101.325 kPa)", px + pw - 5, atmY - 5);

    // Vapor pressure curves
    const showFlags = [showSubstance1, showSubstance2, showSubstance3];
    for (let si = 0; si < substances.length; si++) {
      if (showFlags[si] < 0.5) continue;
      const sub = substances[si];

      ctx.strokeStyle = sub.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      for (let t = tMin; t <= tMax; t += 0.5) {
        const pMmHg = vaporPressure(sub, t);
        const pKPa = mmHgToKPa(pMmHg);
        if (pKPa > pMax * 1.5) continue;
        const x = px + ((t - tMin) / (tMax - tMin)) * pw;
        const y = py + ph - ((Math.min(pKPa, pMax) - pMin) / (pMax - pMin)) * ph;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Boiling point marker
      const bpX = px + ((sub.boilingPoint - tMin) / (tMax - tMin)) * pw;
      ctx.beginPath();
      ctx.arc(bpX, atmY, 5, 0, Math.PI * 2);
      ctx.fillStyle = sub.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label at curve end
      const endT = Math.min(tMax, sub.boilingPoint + 15);
      const endP = mmHgToKPa(vaporPressure(sub, endT));
      const lx = px + ((endT - tMin) / (tMax - tMin)) * pw;
      const ly = py + ph - ((Math.min(endP, pMax) - pMin) / (pMax - pMin)) * ph;
      ctx.fillStyle = sub.color;
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(sub.name, lx + 5, ly - 5);
    }

    // Current temperature line
    const tempX = px + ((temperature - tMin) / (tMax - tMin)) * pw;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(tempX, py);
    ctx.lineTo(tempX, py + ph);
    ctx.stroke();
    ctx.setLineDash([]);

    // Points at current temperature
    for (let si = 0; si < substances.length; si++) {
      if (showFlags[si] < 0.5) continue;
      const sub = substances[si];
      const pKPa = mmHgToKPa(vaporPressure(sub, temperature));
      if (pKPa <= pMax) {
        const y = py + ph - ((pKPa - pMin) / (pMax - pMin)) * ph;
        ctx.beginPath();
        ctx.arc(tempX, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = sub.color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  function drawInfoPanel(): void {
    const ix = W * 0.7;
    const iy = H * 0.06;
    const iw = W * 0.27;
    const ih = H * 0.6;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(ix, iy, iw, ih, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Current Values", ix + 10, iy + 18);
    ctx.fillText(`T = ${temperature}°C`, ix + 10, iy + 38);

    const showFlags = [showSubstance1, showSubstance2, showSubstance3];
    let y = iy + 62;

    for (let si = 0; si < substances.length; si++) {
      const sub = substances[si];
      const pKPa = mmHgToKPa(vaporPressure(sub, temperature));
      const isBoiling = pKPa >= 101.325;

      ctx.fillStyle = sub.color;
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(sub.name, ix + 10, y);
      y += 15;
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(sub.formula, ix + 10, y);
      y += 15;

      if (showFlags[si] >= 0.5) {
        ctx.font = "11px monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText(`P = ${pKPa.toFixed(1)} kPa`, ix + 10, y);
        y += 15;
        ctx.fillText(`BP: ${sub.boilingPoint}°C`, ix + 10, y);
        y += 15;
        if (isBoiling) {
          ctx.fillStyle = "#ef5350";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText("BOILING!", ix + 10, y);
          y += 15;
        }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "10px sans-serif";
        ctx.fillText("(hidden)", ix + 10, y);
        y += 15;
      }
      y += 12;
    }

    // Explanation
    y += 10;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("Key Concept:", ix + 10, y);
    y += 14;
    ctx.font = "9px sans-serif";
    ctx.fillText("Boiling occurs when vapor", ix + 10, y); y += 12;
    ctx.fillText("pressure = atmospheric", ix + 10, y); y += 12;
    ctx.fillText("pressure (101.325 kPa).", ix + 10, y); y += 16;
    ctx.fillText("Substances with higher", ix + 10, y); y += 12;
    ctx.fillText("vapor pressure at a given T", ix + 10, y); y += 12;
    ctx.fillText("have lower boiling points.", ix + 10, y);
  }

  function drawPhaseVisualization(): void {
    const vx = W * 0.08;
    const vy = H * 0.7;
    const vw = W * 0.89;
    const vh = H * 0.26;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Phase State at Current Temperature", vx + vw / 2, vy + 16);

    const showFlags = [showSubstance1, showSubstance2, showSubstance3];
    const activeSubs = substances.filter((_, i) => showFlags[i] >= 0.5);
    if (activeSubs.length === 0) return;

    const beakerW = Math.min(100, (vw - 40) / activeSubs.length - 10);
    const beakerH = vh - 50;
    const startX = vx + (vw - activeSubs.length * (beakerW + 20)) / 2;

    for (let i = 0; i < activeSubs.length; i++) {
      const sub = activeSubs[i];
      const bx = startX + i * (beakerW + 20);
      const by = vy + 32;
      const pKPa = mmHgToKPa(vaporPressure(sub, temperature));
      const isBoiling = pKPa >= 101.325;
      const boilFrac = Math.min(pKPa / 101.325, 1);

      // Beaker
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by + beakerH);
      ctx.lineTo(bx + beakerW, by + beakerH);
      ctx.lineTo(bx + beakerW, by);
      ctx.stroke();

      // Liquid level (decreases as boiling)
      const liquidLevel = isBoiling ? 0.4 : 0.7;
      const liquidTop = by + beakerH * (1 - liquidLevel);
      ctx.fillStyle = sub.color + "40";
      ctx.fillRect(bx + 1, liquidTop, beakerW - 2, beakerH - (liquidTop - by) - 1);

      // Bubbles if close to or at boiling
      if (boilFrac > 0.7) {
        const numBubbles = Math.floor((boilFrac - 0.7) * 30);
        for (let b = 0; b < numBubbles; b++) {
          const bubbleX = bx + 10 + Math.random() * (beakerW - 20);
          const bubbleY = liquidTop + Math.random() * (by + beakerH - liquidTop - 5);
          const bubbleR = 2 + Math.random() * 3;
          ctx.beginPath();
          ctx.arc(bubbleX, bubbleY + Math.sin(time * 4 + b) * 3, bubbleR, 0, Math.PI * 2);
          ctx.fillStyle = `${sub.color}40`;
          ctx.fill();
          ctx.strokeStyle = `${sub.color}60`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Vapor above liquid
      if (boilFrac > 0.3) {
        for (let v = 0; v < Math.floor(boilFrac * 8); v++) {
          const vaporX = bx + 10 + Math.random() * (beakerW - 20);
          const vaporY = by + Math.random() * (liquidTop - by);
          ctx.beginPath();
          ctx.arc(vaporX, vaporY, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `${sub.color}30`;
          ctx.fill();
        }
      }

      // Label
      ctx.fillStyle = sub.color;
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(sub.name, bx + beakerW / 2, by + beakerH + 14);
      ctx.fillStyle = isBoiling ? "#ef5350" : "#ccc";
      ctx.font = "9px monospace";
      ctx.fillText(isBoiling ? "Boiling" : "Liquid", bx + beakerW / 2, by + beakerH + 26);
    }
  }

  function render(): void {
    drawBackground();
    drawMainGraph();
    drawInfoPanel();
    drawPhaseVisualization();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const showFlags = [showSubstance1, showSubstance2, showSubstance3];
    const descs = substances
      .filter((_, i) => showFlags[i] >= 0.5)
      .map((sub) => {
        const pKPa = mmHgToKPa(vaporPressure(sub, temperature));
        const isBoiling = pKPa >= 101.325;
        return `${sub.name} (${sub.formula}): P=${pKPa.toFixed(1)} kPa, BP=${sub.boilingPoint}°C${isBoiling ? " — BOILING" : ""}`;
      });
    return (
      `Saturated Vapor Pressure Graph at T=${temperature}°C. ` +
      `Substances: ${descs.join("; ")}. ` +
      `Boiling occurs when vapor pressure equals atmospheric pressure (101.325 kPa). ` +
      `Uses Antoine equation: log₁₀(P) = A - B/(C+T). ` +
      `Higher vapor pressure at a given temperature means lower boiling point.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GraphOfSaturatedVapor2Factory;
