import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const BinaryCountingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("binary-counting") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters (cached)
  let numBits = 8;
  let speed = 3;
  let autoCount = 0;

  // Counter state
  let currentValue = 0;
  let stepCount = 0;
  let autoAccumulator = 0;

  // Bit flip animation state
  interface BitFlip {
    bitIndex: number;
    fromValue: number;
    toValue: number;
    progress: number; // 0 to 1
  }
  let activeFlips: BitFlip[] = [];
  const FLIP_DURATION = 0.25; // seconds

  function getBit(value: number, bitIndex: number): number {
    return (value >> bitIndex) & 1;
  }

  function maxValue(): number {
    return (1 << numBits) - 1;
  }

  function incrementCounter(): void {
    const oldValue = currentValue;
    currentValue = (currentValue + 1) % (maxValue() + 1);
    stepCount++;

    // Create flip animations for changed bits
    for (let i = 0; i < numBits; i++) {
      const oldBit = getBit(oldValue, i);
      const newBit = getBit(currentValue, i);
      if (oldBit !== newBit) {
        // Remove any existing flip for this bit
        activeFlips = activeFlips.filter((f) => f.bitIndex !== i);
        activeFlips.push({
          bitIndex: i,
          fromValue: oldBit,
          toValue: newBit,
          progress: 0,
        });
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    currentValue = 0;
    stepCount = 0;
    autoAccumulator = 0;
    activeFlips = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    const newNumBits = Math.round(params.numBits ?? 8);
    speed = params.speed ?? 3;
    autoCount = params.autoCount ?? 0;

    // Handle bit count change
    if (newNumBits !== numBits) {
      numBits = newNumBits;
      // Clamp current value to new bit range
      currentValue = currentValue % (maxValue() + 1);
      activeFlips = [];
    }

    time += dt;

    // Auto-counting
    if (autoCount >= 0.5) {
      autoAccumulator += dt * speed;
      while (autoAccumulator >= 1) {
        autoAccumulator -= 1;
        incrementCounter();
      }
    }

    // Update flip animations
    for (const flip of activeFlips) {
      flip.progress += dt / FLIP_DURATION;
    }
    activeFlips = activeFlips.filter((f) => f.progress < 1);
  }

  function drawBitCell(
    x: number, y: number, cellW: number, cellH: number,
    bitIndex: number, bitValue: number
  ): void {
    // Check for active flip animation
    const flip = activeFlips.find((f) => f.bitIndex === bitIndex);
    let displayProgress = 0;
    let isFlipping = false;

    if (flip) {
      isFlipping = true;
      displayProgress = Math.min(flip.progress, 1);
    }

    // Cell background with rounded corners
    const isOn = bitValue === 1;
    const cornerR = 8;

    if (isFlipping) {
      // Animate: scale horizontally to simulate a flip
      const scaleX = Math.abs(Math.cos(displayProgress * Math.PI));
      const showNewValue = displayProgress > 0.5;
      const currentBit = showNewValue ? flip!.toValue : flip!.fromValue;
      const on = currentBit === 1;

      ctx.save();
      ctx.translate(x + cellW / 2, y + cellH / 2);
      ctx.scale(scaleX, 1);
      ctx.translate(-(cellW / 2), -(cellH / 2));

      // Background
      if (on) {
        const grad = ctx.createLinearGradient(0, 0, 0, cellH);
        grad.addColorStop(0, "#22c55e");
        grad.addColorStop(1, "#16a34a");
        ctx.fillStyle = grad;
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, cellH);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#0f172a");
        ctx.fillStyle = grad;
      }
      ctx.beginPath();
      ctx.roundRect(0, 0, cellW, cellH, cornerR);
      ctx.fill();

      // Border
      ctx.strokeStyle = on ? "#4ade80" : "#334155";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bit value text
      ctx.font = `bold ${Math.min(cellW * 0.5, 36)}px 'Courier New', monospace`;
      ctx.fillStyle = on ? "#ffffff" : "#475569";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${currentBit}`, cellW / 2, cellH / 2);

      ctx.restore();
    } else {
      // Static rendering
      if (isOn) {
        const grad = ctx.createLinearGradient(x, y, x, y + cellH);
        grad.addColorStop(0, "#22c55e");
        grad.addColorStop(1, "#16a34a");
        ctx.fillStyle = grad;
      } else {
        const grad = ctx.createLinearGradient(x, y, x, y + cellH);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#0f172a");
        ctx.fillStyle = grad;
      }
      ctx.beginPath();
      ctx.roundRect(x, y, cellW, cellH, cornerR);
      ctx.fill();

      // Glow for ON bits
      if (isOn) {
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.roundRect(x, y, cellW, cellH, cornerR);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Border
      ctx.strokeStyle = isOn ? "#4ade80" : "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cellW, cellH, cornerR);
      ctx.stroke();

      // Bit value text
      ctx.font = `bold ${Math.min(cellW * 0.5, 36)}px 'Courier New', monospace`;
      ctx.fillStyle = isOn ? "#ffffff" : "#475569";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${bitValue}`, x + cellW / 2, y + cellH / 2);
    }
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Binary Counting", width / 2, 30);

    // ── Bit display layout ──────────────────────
    const margin = 30;
    const gap = 6;
    const availW = width - margin * 2;
    const cellW = Math.min(60, (availW - gap * (numBits - 1)) / numBits);
    const cellH = cellW * 1.3;
    const totalW = numBits * cellW + (numBits - 1) * gap;
    const startX = (width - totalW) / 2;
    const bitsY = height * 0.2;

    // Bit position labels (MSB to LSB)
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < numBits; i++) {
      const bitIndex = numBits - 1 - i; // MSB first
      const x = startX + i * (cellW + gap);
      ctx.fillText(`bit ${bitIndex}`, x + cellW / 2, bitsY - 8);
    }

    // Draw bit cells (MSB on left, LSB on right)
    for (let i = 0; i < numBits; i++) {
      const bitIndex = numBits - 1 - i;
      const bitValue = getBit(currentValue, bitIndex);
      const x = startX + i * (cellW + gap);
      drawBitCell(x, bitsY, cellW, cellH, bitIndex, bitValue);
    }

    // Place value labels below each bit
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const placeY = bitsY + cellH + 18;
    for (let i = 0; i < numBits; i++) {
      const bitIndex = numBits - 1 - i;
      const x = startX + i * (cellW + gap);
      const placeValue = 1 << bitIndex;
      ctx.fillStyle = getBit(currentValue, bitIndex) === 1 ? "#4ade80" : "#475569";
      ctx.fillText(`${placeValue}`, x + cellW / 2, placeY);
    }

    // ── Decimal value display ───────────────────
    const decY = bitsY + cellH + 65;

    // Large decimal display
    ctx.font = `bold ${Math.min(64, width * 0.08)}px 'Courier New', monospace`;
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.fillText(`${currentValue}`, width / 2, decY);

    // "decimal" label
    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Decimal Value", width / 2, decY + 22);

    // ── Binary string display ───────────────────
    const binY = decY + 55;
    const binStr = currentValue.toString(2).padStart(numBits, "0");

    ctx.font = `bold ${Math.min(28, width * 0.035)}px 'Courier New', monospace`;
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "center";
    // Color each digit
    const charWidth = ctx.measureText("0").width + 2;
    const binTotalW = binStr.length * charWidth;
    const binStartX = width / 2 - binTotalW / 2;
    for (let i = 0; i < binStr.length; i++) {
      const ch = binStr[i];
      ctx.fillStyle = ch === "1" ? "#4ade80" : "#334155";
      ctx.textAlign = "left";
      ctx.fillText(ch, binStartX + i * charWidth, binY);
    }

    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Binary Representation", width / 2, binY + 22);

    // ── Conversion formula ──────────────────────
    const formulaY = binY + 58;
    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#b197fc";
    ctx.textAlign = "center";

    // Build expansion: decimal = sum of b_i * 2^i
    let expansion = "";
    let terms: string[] = [];
    for (let i = numBits - 1; i >= 0; i--) {
      const bit = getBit(currentValue, i);
      if (bit === 1) {
        terms.push(`2${superscript(i)}`);
      }
    }
    if (terms.length === 0) {
      expansion = `${currentValue} = 0`;
    } else {
      expansion = `${currentValue} = ${terms.join(" + ")}`;
    }
    ctx.fillText(expansion, width / 2, formulaY);

    // General formula
    ctx.fillStyle = "#64748b";
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillText("Decimal = \u03A3 b\u1D62 \u00D7 2\u2071   (sum of each bit times its place value)", width / 2, formulaY + 22);

    // ── Step counter and status ─────────────────
    const statusY = formulaY + 60;
    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Steps: ${stepCount}`, 30, statusY);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Max value: ${maxValue()} (2${superscript(numBits)} - 1)`, 30, statusY + 22);

    ctx.fillStyle = autoCount >= 0.5 ? "#4ade80" : "#475569";
    ctx.fillText(
      autoCount >= 0.5 ? `Auto-counting (speed: ${speed}x)` : "Auto-count: OFF",
      30, statusY + 44
    );

    // ── Hex representation ──────────────────────
    ctx.textAlign = "right";
    ctx.fillStyle = "#f97316";
    ctx.font = "13px 'Courier New', monospace";
    ctx.fillText(`Hex: 0x${currentValue.toString(16).toUpperCase().padStart(Math.ceil(numBits / 4), "0")}`, width - 30, statusY);

    ctx.fillStyle = "#06b6d4";
    ctx.fillText(`Oct: 0o${currentValue.toString(8).padStart(Math.ceil(numBits / 3), "0")}`, width - 30, statusY + 22);

    // ── Bit toggle frequency note ───────────────
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText(
      "LSB toggles every step | bit 1 every 2 steps | bit 2 every 4 steps | bit n every 2\u207F steps",
      width / 2, height - 35
    );

    // Time display at bottom-left
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function superscript(n: number): string {
    const sup: Record<string, string> = {
      "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3",
      "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077",
      "8": "\u2078", "9": "\u2079",
    };
    return n.toString().split("").map((c) => sup[c] || c).join("");
  }

  function reset(): void {
    time = 0;
    currentValue = 0;
    stepCount = 0;
    autoAccumulator = 0;
    activeFlips = [];
  }

  function destroy(): void {
    activeFlips = [];
  }

  function getStateDescription(): string {
    const binStr = currentValue.toString(2).padStart(numBits, "0");
    return (
      `Binary Counting: ${numBits} bits, current value = ${currentValue} ` +
      `(binary: ${binStr}, hex: 0x${currentValue.toString(16).toUpperCase()}). ` +
      `Max value: ${maxValue()}. Steps taken: ${stepCount}. ` +
      `Auto-count: ${autoCount >= 0.5 ? "ON" : "OFF"}, speed: ${speed}. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default BinaryCountingFactory;
