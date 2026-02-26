import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface DNAStrand {
  x: number;
  y: number;
  width: number;
  separated: number; // 0 = together, 1 = fully separated
  hasPrimers: boolean;
  extended: number; // 0 to 1, extension progress
}

const PcrFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pcr") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // PCR state
  let currentCycle = 1;
  let currentStep: "denaturation" | "annealing" | "extension" = "denaturation";
  let stepProgress = 0; // 0 to 1
  let temperature = 95;
  let targetTemp = 95;
  let dnaCopies = 1;
  let strands: DNAStrand[] = [];
  let tempHistory: Array<{ time: number; temp: number }> = [];

  // Params cache
  let numCycles = 5;
  let denatureTemp = 95;
  let annealTemp = 55;
  let extensionTemp = 72;

  // Timing
  const STEP_DURATION = 3.0; // seconds per step
  let stepTimer = 0;
  let cycleComplete = false;

  function initStrands(): void {
    strands = [];
    const maxVisible = Math.min(dnaCopies, 8);
    const strandW = Math.min(180, (width - 100) / maxVisible - 10);
    const totalW = maxVisible * (strandW + 10);
    const startX = (width - totalW) / 2;

    for (let i = 0; i < maxVisible; i++) {
      strands.push({
        x: startX + i * (strandW + 10) + strandW / 2,
        y: height * 0.35,
        width: strandW,
        separated: 0,
        hasPrimers: false,
        extended: 0,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    currentCycle = 1;
    currentStep = "denaturation";
    stepProgress = 0;
    stepTimer = 0;
    temperature = 25;
    targetTemp = denatureTemp;
    dnaCopies = 1;
    cycleComplete = false;
    tempHistory = [];
    initStrands();
  }

  function update(dt: number, params: Record<string, number>): void {
    numCycles = Math.round(params.numCycles ?? 5);
    denatureTemp = params.denatureTemp ?? 95;
    annealTemp = params.annealTemp ?? 55;
    extensionTemp = params.extensionTemp ?? 72;

    if (cycleComplete) return;

    const step = Math.min(dt, 0.05);
    time += step;

    // Smooth temperature transition
    const tempRate = 40; // degrees per second
    if (Math.abs(temperature - targetTemp) > 0.5) {
      temperature += Math.sign(targetTemp - temperature) * tempRate * step;
    } else {
      temperature = targetTemp;
    }

    // Record temperature
    if (tempHistory.length === 0 || time - tempHistory[tempHistory.length - 1].time > 0.1) {
      tempHistory.push({ time, temp: temperature });
      if (tempHistory.length > 400) tempHistory.shift();
    }

    stepTimer += step;
    stepProgress = Math.min(stepTimer / STEP_DURATION, 1);

    // Update strand visuals based on step
    for (const strand of strands) {
      if (currentStep === "denaturation") {
        strand.separated = stepProgress;
        strand.hasPrimers = false;
        strand.extended = 0;
      } else if (currentStep === "annealing") {
        strand.separated = 1;
        strand.hasPrimers = stepProgress > 0.4;
      } else if (currentStep === "extension") {
        strand.separated = 1;
        strand.hasPrimers = true;
        strand.extended = stepProgress;
      }
    }

    // Step transitions
    if (stepTimer >= STEP_DURATION) {
      stepTimer = 0;
      stepProgress = 0;

      if (currentStep === "denaturation") {
        currentStep = "annealing";
        targetTemp = annealTemp;
      } else if (currentStep === "annealing") {
        currentStep = "extension";
        targetTemp = extensionTemp;
      } else if (currentStep === "extension") {
        // Cycle complete
        dnaCopies = Math.pow(2, currentCycle);
        currentCycle++;

        if (currentCycle > numCycles) {
          cycleComplete = true;
          return;
        }

        currentStep = "denaturation";
        targetTemp = denatureTemp;
        initStrands();
      }
    }
  }

  function render(): void {
    // Dark background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a20");
    bgGrad.addColorStop(1, "#0d1528");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawThermometer();
    drawDNAStrands();
    drawTemperatureProfile();
    drawInfoPanel();
    drawStepIndicator();
  }

  function drawDNAStrands(): void {
    const baseHeight = 80;
    const basePairCount = 12;

    for (const strand of strands) {
      const hw = strand.width / 2;
      const sep = strand.separated * 15;

      for (let i = 0; i < basePairCount; i++) {
        const yOff = strand.y - baseHeight / 2 + (i / basePairCount) * baseHeight;
        const wave = Math.sin((i / basePairCount) * Math.PI * 3 + time * 2) * 3;

        // Left strand (template) - blue
        const lx = strand.x - hw / 2 - sep + wave;
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(lx - hw / 2, yOff, hw * 0.4, 4);

        // Right strand (complementary) - red
        const rx = strand.x + hw / 2 + sep + wave;
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(rx - hw * 0.4 + hw / 2, yOff, hw * 0.4, 4);

        // Base pair bonds (hydrogen bonds)
        if (strand.separated < 0.5) {
          const bondAlpha = 1 - strand.separated * 2;
          ctx.strokeStyle = `rgba(200,200,200,${bondAlpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(lx + hw * 0.4 - hw / 2, yOff + 2);
          ctx.lineTo(rx - hw * 0.4 + hw / 2, yOff + 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Base pair colors (A-T: green-yellow, G-C: orange-purple)
        const isAT = i % 3 !== 0;
        const leftBase = isAT ? "#22c55e" : "#f97316";
        const rightBase = isAT ? "#eab308" : "#a855f7";

        // Left bases
        ctx.fillStyle = leftBase;
        ctx.beginPath();
        ctx.arc(lx + hw * 0.4 - hw / 2 + 3, yOff + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Right bases
        ctx.fillStyle = rightBase;
        ctx.beginPath();
        ctx.arc(rx - hw * 0.4 + hw / 2 - 3, yOff + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Primers (short colored segments)
        if (strand.hasPrimers && i < 3) {
          ctx.fillStyle = "#f0abfc";
          ctx.globalAlpha = 0.9;
          // Primer on left strand
          ctx.fillRect(lx - hw / 2 - 6, yOff, 5, 4);
          // Primer on right strand
          ctx.fillRect(rx + hw / 2 + 1, yOff, 5, 4);
          ctx.globalAlpha = 1;
        }

        // Extension (new complementary strand growing)
        if (strand.extended > 0 && strand.separated > 0.5) {
          const extendedBases = Math.floor(strand.extended * basePairCount);
          if (i < extendedBases) {
            // New strand alongside left template
            ctx.fillStyle = `rgba(239,68,68,${0.6 + strand.extended * 0.4})`;
            ctx.fillRect(lx + hw * 0.1 - hw / 2, yOff, hw * 0.3, 4);

            // New strand alongside right template
            ctx.fillStyle = `rgba(59,130,246,${0.6 + strand.extended * 0.4})`;
            ctx.fillRect(rx - hw * 0.1 + hw / 2 - hw * 0.3, yOff, hw * 0.3, 4);
          }
        }
      }

      // Taq polymerase indicator during extension
      if (currentStep === "extension" && strand.extended > 0.05 && strand.extended < 0.95) {
        const polyY = strand.y - baseHeight / 2 + strand.extended * baseHeight;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(strand.x - hw / 2 - sep - 12, polyY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(strand.x + hw / 2 + sep + 12, polyY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 6px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Taq", strand.x - hw / 2 - sep - 12, polyY + 2);
        ctx.fillText("Taq", strand.x + hw / 2 + sep + 12, polyY + 2);
      }
    }

    // Show "and more..." if too many copies
    if (dnaCopies > 8) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Showing 8 of ${dnaCopies} copies...`, width / 2, height * 0.35 + 60);
    }
  }

  function drawThermometer(): void {
    const tx = width - 45;
    const ty = 60;
    const th = height * 0.35;
    const tw = 20;

    // Thermometer body
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.roundRect(tx - tw / 2, ty, tw, th, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mercury level
    const minT = 20;
    const maxT = 100;
    const fraction = (temperature - minT) / (maxT - minT);
    const mercuryH = fraction * (th - 10);

    let mercuryColor: string;
    if (temperature > 85) mercuryColor = "#ef4444";
    else if (temperature > 65) mercuryColor = "#f97316";
    else mercuryColor = "#3b82f6";

    const mercGrad = ctx.createLinearGradient(tx - tw / 2, ty + th, tx + tw / 2, ty + th);
    mercGrad.addColorStop(0, mercuryColor);
    mercGrad.addColorStop(1, mercuryColor + "aa");
    ctx.fillStyle = mercGrad;
    ctx.beginPath();
    ctx.roundRect(tx - tw / 2 + 3, ty + th - mercuryH - 5, tw - 6, mercuryH, 5);
    ctx.fill();

    // Bulb at bottom
    ctx.beginPath();
    ctx.arc(tx, ty + th + 10, 12, 0, Math.PI * 2);
    ctx.fillStyle = mercuryColor;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();

    // Temperature label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${temperature.toFixed(0)}\u00B0C`, tx, ty + th + 38);

    // Scale marks
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    for (let t = 30; t <= 100; t += 10) {
      const yPos = ty + th - ((t - minT) / (maxT - minT)) * (th - 10) - 5;
      ctx.fillText(`${t}`, tx - tw / 2 - 4, yPos + 3);
      ctx.beginPath();
      ctx.moveTo(tx - tw / 2, yPos);
      ctx.lineTo(tx - tw / 2 + 4, yPos);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.stroke();
    }
  }

  function drawTemperatureProfile(): void {
    const gx = 60;
    const gy = height * 0.68;
    const gw = width - 120;
    const gh = height * 0.25;

    // Graph background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(gx - 10, gy - 10, gw + 20, gh + 30, 8);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + gh);
    ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature Profile", gx + gw / 2, gy - 2);
    ctx.textAlign = "right";
    ctx.fillText("95\u00B0", gx - 5, gy + 8);
    ctx.fillText("55\u00B0", gx - 5, gy + gh * 0.5);
    ctx.fillText("25\u00B0", gx - 5, gy + gh);

    // Temperature curve
    if (tempHistory.length > 1) {
      ctx.beginPath();
      const minTime = tempHistory[0].time;
      const maxTime = tempHistory[tempHistory.length - 1].time;
      const timeRange = Math.max(maxTime - minTime, 1);

      for (let i = 0; i < tempHistory.length; i++) {
        const px = gx + ((tempHistory[i].time - minTime) / timeRange) * gw;
        const py = gy + gh - ((tempHistory[i].temp - 25) / 75) * gh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Step zone labels
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(239,68,68,0.6)";
    ctx.fillText("D = Denature", gx + 5, gy + gh + 15);
    ctx.fillStyle = "rgba(59,130,246,0.6)";
    ctx.fillText("A = Anneal", gx + gw * 0.35, gy + gh + 15);
    ctx.fillStyle = "rgba(34,197,94,0.6)";
    ctx.fillText("E = Extend", gx + gw * 0.65, gy + gh + 15);
  }

  function drawInfoPanel(): void {
    const panelW = 230;
    const panelH = 110;
    const px = 10;
    const py = 10;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("PCR - Polymerase Chain Reaction", px + 10, py + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Cycle: ${Math.min(currentCycle, numCycles)} / ${numCycles}`, px + 10, py + 40);

    let stepColor = "#ef4444";
    let stepLabel = "Denaturation";
    if (currentStep === "annealing") { stepColor = "#3b82f6"; stepLabel = "Annealing"; }
    else if (currentStep === "extension") { stepColor = "#22c55e"; stepLabel = "Extension"; }

    ctx.fillStyle = stepColor;
    ctx.fillText(`Step: ${stepLabel}`, px + 10, py + 56);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Temperature: ${temperature.toFixed(0)}\u00B0C`, px + 10, py + 72);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px system-ui, sans-serif";
    const copies = cycleComplete ? Math.pow(2, numCycles) : dnaCopies;
    ctx.fillText(`DNA Copies: ${copies} (2^${cycleComplete ? numCycles : Math.log2(dnaCopies)})`, px + 10, py + 92);

    if (cycleComplete) {
      ctx.fillStyle = "#22c55e";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("PCR Complete!", px + 10, py + 106);
    }
  }

  function drawStepIndicator(): void {
    const indicators = [
      { label: "Denature", temp: `${denatureTemp}\u00B0C`, color: "#ef4444", active: currentStep === "denaturation" },
      { label: "Anneal", temp: `${annealTemp}\u00B0C`, color: "#3b82f6", active: currentStep === "annealing" },
      { label: "Extend", temp: `${extensionTemp}\u00B0C`, color: "#22c55e", active: currentStep === "extension" },
    ];

    const totalW = 300;
    const startX = (width - totalW) / 2;
    const sy = height * 0.57;

    for (let i = 0; i < indicators.length; i++) {
      const ind = indicators[i];
      const ix = startX + i * 105;

      ctx.fillStyle = ind.active ? ind.color + "44" : "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.roundRect(ix, sy, 95, 35, 6);
      ctx.fill();
      ctx.strokeStyle = ind.active ? ind.color : "rgba(255,255,255,0.15)";
      ctx.lineWidth = ind.active ? 2 : 1;
      ctx.stroke();

      ctx.fillStyle = ind.active ? "#ffffff" : "rgba(255,255,255,0.5)";
      ctx.font = ind.active ? "bold 11px system-ui, sans-serif" : "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ind.label, ix + 47, sy + 15);
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(ind.temp, ix + 47, sy + 28);

      // Arrow between steps
      if (i < 2) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.moveTo(ix + 100, sy + 17);
        ctx.lineTo(ix + 107, sy + 17);
        ctx.lineTo(ix + 104, sy + 13);
        ctx.moveTo(ix + 107, sy + 17);
        ctx.lineTo(ix + 104, sy + 21);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  function reset(): void {
    time = 0;
    currentCycle = 1;
    currentStep = "denaturation";
    stepProgress = 0;
    stepTimer = 0;
    temperature = 25;
    targetTemp = denatureTemp;
    dnaCopies = 1;
    cycleComplete = false;
    tempHistory = [];
    initStrands();
  }

  function destroy(): void {
    strands = [];
    tempHistory = [];
  }

  function getStateDescription(): string {
    const copies = cycleComplete ? Math.pow(2, numCycles) : dnaCopies;
    return (
      `PCR simulation. Cycle ${Math.min(currentCycle, numCycles)}/${numCycles}. ` +
      `Current step: ${currentStep} at ${temperature.toFixed(0)}\u00B0C. ` +
      `DNA copies: ${copies}. ` +
      `Denaturation (${denatureTemp}\u00B0C): DNA strands separate. ` +
      `Annealing (${annealTemp}\u00B0C): primers bind. ` +
      `Extension (${extensionTemp}\u00B0C): Taq polymerase extends new strands. ` +
      `Each cycle doubles the DNA: 2^n copies after n cycles. ` +
      `${cycleComplete ? "PCR is complete." : "In progress."}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initStrands();
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default PcrFactory;
