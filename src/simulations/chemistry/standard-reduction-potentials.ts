import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface MetalData {
  name: string;
  symbol: string;
  ion: string;
  electrons: number;
  potential: number; // E° in volts
  color: string;
  ionColor: string;
}

const METALS: MetalData[] = [
  { name: "Zinc", symbol: "Zn", ion: "Zn\u00B2\u207A", electrons: 2, potential: -0.76, color: "#94a3b8", ionColor: "rgba(148,163,184,0.6)" },
  { name: "Iron", symbol: "Fe", ion: "Fe\u00B2\u207A", electrons: 2, potential: -0.44, color: "#78716c", ionColor: "rgba(120,113,108,0.6)" },
  { name: "Nickel", symbol: "Ni", ion: "Ni\u00B2\u207A", electrons: 2, potential: -0.26, color: "#a3a3a3", ionColor: "rgba(163,163,163,0.6)" },
  { name: "Copper", symbol: "Cu", ion: "Cu\u00B2\u207A", electrons: 2, potential: 0.34, color: "#c2410c", ionColor: "rgba(59,130,246,0.6)" },
  { name: "Silver", symbol: "Ag", ion: "Ag\u207A", electrons: 1, potential: 0.80, color: "#d1d5db", ionColor: "rgba(209,213,219,0.6)" },
  { name: "Gold", symbol: "Au", ion: "Au\u00B3\u207A", electrons: 3, potential: 1.50, color: "#fbbf24", ionColor: "rgba(251,191,36,0.6)" },
];

interface Electron {
  x: number;
  y: number;
  t: number;
  speed: number;
}

const StandardReductionPotentialsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("standard-reduction-potentials") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let metal1Idx = 0;
  let metal2Idx = 3;
  let showVoltage = 1;
  let animateElectrons = 1;
  let electrons: Electron[] = [];

  function getAnode(): MetalData {
    const m1 = METALS[metal1Idx];
    const m2 = METALS[metal2Idx];
    return m1.potential <= m2.potential ? m1 : m2;
  }

  function getCathode(): MetalData {
    const m1 = METALS[metal1Idx];
    const m2 = METALS[metal2Idx];
    return m1.potential > m2.potential ? m1 : m2;
  }

  function getCellVoltage(): number {
    return getCathode().potential - getAnode().potential;
  }

  function initElectrons(): void {
    electrons = [];
    for (let i = 0; i < 12; i++) {
      electrons.push({
        x: 0, y: 0,
        t: Math.random(),
        speed: 0.3 + Math.random() * 0.4,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initElectrons();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    const newM1 = Math.min(Math.round(params.metal1 ?? 0), METALS.length - 1);
    const newM2 = Math.min(Math.round(params.metal2 ?? 3), METALS.length - 1);
    showVoltage = Math.round(params.showVoltage ?? 1);
    animateElectrons = Math.round(params.animateElectrons ?? 1);

    if (newM1 !== metal1Idx || newM2 !== metal2Idx) {
      metal1Idx = newM1;
      metal2Idx = newM2;
      initElectrons();
    }

    time += step;

    // Update electron positions along the wire
    if (animateElectrons && metal1Idx !== metal2Idx) {
      for (const e of electrons) {
        e.t += e.speed * step;
        if (e.t > 1) e.t -= 1;
      }
    }
  }

  function drawElectrode(x: number, y: number, w: number, h: number, metal: MetalData, isAnode: boolean): void {
    // Solution beaker
    const beakerX = x - w / 2 - 10;
    const beakerY = y;
    const beakerW = w + 20;
    const beakerH = h + 20;

    // Solution
    const solGrad = ctx.createLinearGradient(beakerX, beakerY, beakerX, beakerY + beakerH);
    solGrad.addColorStop(0, metal.ionColor);
    solGrad.addColorStop(1, `rgba(30,40,60,0.8)`);
    ctx.fillStyle = solGrad;
    ctx.beginPath();
    ctx.roundRect(beakerX, beakerY + 20, beakerW, beakerH - 20, [0, 0, 6, 6]);
    ctx.fill();

    // Beaker outline
    ctx.strokeStyle = "rgba(200,220,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beakerX, beakerY + 10);
    ctx.lineTo(beakerX, beakerY + beakerH);
    ctx.lineTo(beakerX + beakerW, beakerY + beakerH);
    ctx.lineTo(beakerX + beakerW, beakerY + 10);
    ctx.stroke();

    // Metal electrode plate
    const plateGrad = ctx.createLinearGradient(x - 8, y, x + 8, y);
    plateGrad.addColorStop(0, metal.color);
    plateGrad.addColorStop(0.5, `${metal.color}ee`);
    plateGrad.addColorStop(1, metal.color);
    ctx.fillStyle = plateGrad;
    ctx.fillRect(x - 8, y - 15, 16, h + 25);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 8, y - 15, 16, h + 25);

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(metal.symbol, x, y - 25);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = isAnode ? "#ef4444" : "#22c55e";
    ctx.fillText(isAnode ? "ANODE (\u2212)" : "CATHODE (+)", x, y - 40);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`E\u00B0 = ${metal.potential.toFixed(2)} V`, x, y + h + 30);
    ctx.fillText(isAnode ? "Oxidation" : "Reduction", x, y + h + 44);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0e1a");
    bgGrad.addColorStop(1, "#141828");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const anode = getAnode();
    const cathode = getCathode();
    const cellVoltage = getCellVoltage();
    const isAnodeLeft = METALS[metal1Idx].potential <= METALS[metal2Idx].potential;
    const sameMetals = metal1Idx === metal2Idx;

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Galvanic Cell - Standard Reduction Potentials", width / 2, 22);

    // Cell layout
    const cellTop = 80;
    const cellH = 130;
    const leftX = width * 0.25;
    const rightX = width * 0.75;
    const electrodeW = 80;

    if (sameMetals) {
      ctx.fillStyle = "rgba(255,200,50,0.7)";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Select two different metals to form a galvanic cell", width / 2, height / 2);
      return;
    }

    // Draw electrodes
    if (isAnodeLeft) {
      drawElectrode(leftX, cellTop, electrodeW, cellH, anode, true);
      drawElectrode(rightX, cellTop, electrodeW, cellH, cathode, false);
    } else {
      drawElectrode(leftX, cellTop, electrodeW, cellH, cathode, false);
      drawElectrode(rightX, cellTop, electrodeW, cellH, anode, true);
    }

    // Salt bridge
    const bridgeY = cellTop + 10;
    ctx.strokeStyle = "rgba(200,200,255,0.5)";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(leftX + electrodeW / 2 + 10, bridgeY + 20);
    ctx.quadraticCurveTo(width / 2, bridgeY - 20, rightX - electrodeW / 2 - 10, bridgeY + 20);
    ctx.stroke();

    ctx.fillStyle = "rgba(200,200,255,0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Salt Bridge", width / 2, bridgeY - 10);

    // Wire connecting electrodes (at top)
    const wireY = cellTop - 55;
    ctx.strokeStyle = "rgba(180,180,200,0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(leftX, cellTop - 15);
    ctx.lineTo(leftX, wireY);
    ctx.lineTo(rightX, wireY);
    ctx.lineTo(rightX, cellTop - 15);
    ctx.stroke();

    // Electron flow arrows on wire
    if (animateElectrons) {
      const anodeX = isAnodeLeft ? leftX : rightX;
      const cathodeX = isAnodeLeft ? rightX : leftX;

      for (const e of electrons) {
        const t = e.t;
        let ex: number, ey: number;
        // Path: anode up -> across wire -> cathode down
        if (t < 0.2) {
          // Going up from anode
          const segT = t / 0.2;
          ex = anodeX;
          ey = cellTop - 15 - segT * (cellTop - 15 - wireY);
        } else if (t < 0.8) {
          // Across the wire
          const segT = (t - 0.2) / 0.6;
          ex = anodeX + (cathodeX - anodeX) * segT;
          ey = wireY;
        } else {
          // Going down to cathode
          const segT = (t - 0.8) / 0.2;
          ex = cathodeX;
          ey = wireY + segT * (cellTop - 15 - wireY);
        }

        // Electron dot
        const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6);
        glow.addColorStop(0, "rgba(100,180,255,0.9)");
        glow.addColorStop(1, "rgba(100,180,255,0)");
        ctx.beginPath();
        ctx.arc(ex, ey, 6, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#60a5fa";
        ctx.fill();
      }

      // Arrow showing electron flow direction
      const arrowMidX = width / 2;
      const dir = isAnodeLeft ? 1 : -1;
      ctx.fillStyle = "rgba(100,180,255,0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("e\u207B flow \u2192", arrowMidX, wireY - 8);
    }

    // Voltmeter
    if (showVoltage) {
      const vmX = width / 2;
      const vmY = wireY - 2;
      const vmR = 20;

      ctx.beginPath();
      ctx.arc(vmX, vmY, vmR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30,40,60,0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(200,200,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("V", vmX, vmY - 4);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillText(`${cellVoltage.toFixed(2)}`, vmX, vmY + 10);
    }

    // Reduction potential table
    const tableX = 10;
    const tableY = cellTop + cellH + 65;
    const rowH = 18;
    const colW = [90, 80, 75];

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(tableX, tableY - 5, colW[0] + colW[1] + colW[2] + 20, METALS.length * rowH + 30, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Half-Reaction", tableX + 8, tableY + 12);
    ctx.fillText("E\u00B0 (V)", tableX + colW[0] + colW[1] + 8, tableY + 12);

    for (let i = 0; i < METALS.length; i++) {
      const m = METALS[i];
      const ry = tableY + 22 + i * rowH;
      const isActive = (i === metal1Idx || i === metal2Idx);

      if (isActive) {
        ctx.fillStyle = "rgba(59,130,246,0.15)";
        ctx.fillRect(tableX + 4, ry - 10, colW[0] + colW[1] + colW[2] + 12, rowH);
      }

      ctx.fillStyle = isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${m.ion} + ${m.electrons}e\u207B \u2192 ${m.symbol}`, tableX + 8, ry);

      const potColor = m.potential >= 0 ? "#22c55e" : "#ef4444";
      ctx.fillStyle = isActive ? potColor : "rgba(200,200,200,0.5)";
      ctx.textAlign = "right";
      ctx.fillText(m.potential.toFixed(2), tableX + colW[0] + colW[1] + colW[2] + 12, ry);
    }

    // Cell notation and voltage panel
    ctx.save();
    const infoX = width - 270;
    const infoY = tableY;
    const infoW = 258;
    const infoH = 110;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(infoX, infoY, infoW, infoH, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Cell Information", infoX + 10, infoY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`${anode.symbol} | ${anode.ion} || ${cathode.ion} | ${cathode.symbol}`, infoX + 10, infoY + 36);

    ctx.fillText(`E\u00B0cell = E\u00B0cathode \u2212 E\u00B0anode`, infoX + 10, infoY + 54);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`E\u00B0cell = (${cathode.potential.toFixed(2)}) \u2212 (${anode.potential.toFixed(2)}) = ${cellVoltage.toFixed(2)} V`, infoX + 10, infoY + 72);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Anode (oxidation): ${anode.symbol} \u2192 ${anode.ion} + ${anode.electrons}e\u207B`, infoX + 10, infoY + 90);
    ctx.fillText(`Cathode (reduction): ${cathode.ion} + ${cathode.electrons}e\u207B \u2192 ${cathode.symbol}`, infoX + 10, infoY + 104);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    initElectrons();
  }

  function destroy(): void {
    electrons = [];
  }

  function getStateDescription(): string {
    const anode = getAnode();
    const cathode = getCathode();
    const v = getCellVoltage();
    return (
      `Galvanic Cell: Anode=${anode.name} (E\u00B0=${anode.potential.toFixed(2)}V), ` +
      `Cathode=${cathode.name} (E\u00B0=${cathode.potential.toFixed(2)}V). ` +
      `Cell voltage E\u00B0cell=${v.toFixed(2)}V. ` +
      `Electrons flow from ${anode.symbol} to ${cathode.symbol}. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StandardReductionPotentialsFactory;
