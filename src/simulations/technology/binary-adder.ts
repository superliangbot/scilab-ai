import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const BinaryAdder: SimulationFactory = () => {
  const config = getSimConfig("binary-adder")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Binary numbers to add
  let numberA = 5; // 4-bit: 0101
  let numberB = 3; // 4-bit: 0011
  let numBits = 4;
  let showAnimation = true;
  let time = 0;

  // Full adder components
  interface FullAdder {
    x: number;
    y: number;
    bitPosition: number;
    inputA: boolean;
    inputB: boolean;
    carryIn: boolean;
    sum: boolean;
    carryOut: boolean;
    width: number;
    height: number;
  }

  const fullAdders: FullAdder[] = [];
  const ADDER_WIDTH = 120;
  const ADDER_HEIGHT = 100;

  // Colors
  const BG_COLOR = "#0f172a";
  const ADDER_COLOR = "#374151";
  const ADDER_ACTIVE_COLOR = "#4f46e5";
  const BIT_HIGH_COLOR = "#10b981";
  const BIT_LOW_COLOR = "#6b7280";
  const CARRY_COLOR = "#f59e0b";
  const SUM_COLOR = "#ef4444";
  const WIRE_COLOR = "#9ca3af";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function getBit(number: number, position: number): boolean {
    return ((number >> position) & 1) === 1;
  }

  function initializeAdders() {
    fullAdders.length = 0;
    
    const startX = width * 0.15;
    const spacing = (width * 0.7) / numBits;
    const adderY = height * 0.4;
    
    for (let i = 0; i < numBits; i++) {
      const x = startX + i * spacing - ADDER_WIDTH / 2;
      
      fullAdders.push({
        x,
        y: adderY - ADDER_HEIGHT / 2,
        bitPosition: i,
        inputA: getBit(numberA, i),
        inputB: getBit(numberB, i),
        carryIn: false,
        sum: false,
        carryOut: false,
        width: ADDER_WIDTH,
        height: ADDER_HEIGHT
      });
    }
  }

  function calculateAddition() {
    let carry = false;
    
    for (let i = 0; i < fullAdders.length; i++) {
      const adder = fullAdders[i];
      
      adder.inputA = getBit(numberA, i);
      adder.inputB = getBit(numberB, i);
      adder.carryIn = carry;
      
      // Full adder logic
      // Sum = A XOR B XOR CarryIn
      adder.sum = adder.inputA !== adder.inputB !== adder.carryIn;
      
      // CarryOut = (A AND B) OR (CarryIn AND (A XOR B))
      adder.carryOut = (adder.inputA && adder.inputB) || 
                      (adder.carryIn && (adder.inputA !== adder.inputB));
      
      carry = adder.carryOut;
    }
  }

  function getResult(): number {
    let result = 0;
    for (let i = 0; i < fullAdders.length; i++) {
      if (fullAdders[i].sum) {
        result |= (1 << i);
      }
    }
    return result;
  }

  function getFinalCarry(): boolean {
    return fullAdders.length > 0 ? fullAdders[fullAdders.length - 1].carryOut : false;
  }

  function drawBinaryNumber(x: number, y: number, number: number, bits: number, label: string) {
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Label
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(label, x, y - 30);
    
    // Decimal value
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "12px monospace";
    ctx.fillText(`(${number})`, x, y - 15);
    
    // Binary bits
    ctx.font = "16px monospace";
    for (let i = bits - 1; i >= 0; i--) {
      const bit = getBit(number, i);
      const bitX = x - (bits - 1) * 15 + i * 30;
      
      ctx.fillStyle = bit ? BIT_HIGH_COLOR : BIT_LOW_COLOR;
      ctx.fillText(bit ? "1" : "0", bitX, y);
      
      // Bit position label
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.fillText(`2^${i}`, bitX, y + 20);
      ctx.font = "16px monospace";
    }
  }

  function drawWire(startX: number, startY: number, endX: number, endY: number, 
                   active: boolean, color: string = WIRE_COLOR) {
    ctx.strokeStyle = active ? color : WIRE_COLOR;
    ctx.lineWidth = active ? 3 : 2;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Animation for active wires
    if (active && showAnimation) {
      const progress = (time * 3) % 1;
      const pulseX = startX + (endX - startX) * progress;
      const pulseY = startY + (endY - startY) * progress;
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFullAdder(adder: FullAdder) {
    const centerX = adder.x + adder.width / 2;
    const centerY = adder.y + adder.height / 2;
    
    // Adder body
    const isActive = adder.inputA || adder.inputB || adder.carryIn;
    ctx.fillStyle = isActive ? ADDER_ACTIVE_COLOR : ADDER_COLOR;
    ctx.fillRect(adder.x, adder.y, adder.width, adder.height);
    
    ctx.strokeStyle = TEXT_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(adder.x, adder.y, adder.width, adder.height);
    
    // Bit position label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`Bit ${adder.bitPosition}`, centerX, adder.y + 5);
    
    // Input labels and connections
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    // Input A
    ctx.fillStyle = adder.inputA ? BIT_HIGH_COLOR : BIT_LOW_COLOR;
    ctx.fillText(`A: ${adder.inputA ? "1" : "0"}`, adder.x + 10, centerY - 20);
    
    // Input B
    ctx.fillStyle = adder.inputB ? BIT_HIGH_COLOR : BIT_LOW_COLOR;
    ctx.fillText(`B: ${adder.inputB ? "1" : "0"}`, adder.x + 10, centerY);
    
    // Carry In
    ctx.fillStyle = adder.carryIn ? CARRY_COLOR : BIT_LOW_COLOR;
    ctx.fillText(`Cin: ${adder.carryIn ? "1" : "0"}`, adder.x + 10, centerY + 20);
    
    // Outputs
    ctx.textAlign = "right";
    
    // Sum output
    ctx.fillStyle = adder.sum ? SUM_COLOR : BIT_LOW_COLOR;
    ctx.fillText(`S: ${adder.sum ? "1" : "0"}`, adder.x + adder.width - 10, centerY - 10);
    
    // Carry Out
    ctx.fillStyle = adder.carryOut ? CARRY_COLOR : BIT_LOW_COLOR;
    ctx.fillText(`Cout: ${adder.carryOut ? "1" : "0"}`, adder.x + adder.width - 10, centerY + 10);
    
    // Input connections from top
    const inputY = adder.y - 20;
    drawWire(centerX - 20, inputY, adder.x + 20, adder.y, adder.inputA, BIT_HIGH_COLOR);
    drawWire(centerX + 20, inputY, adder.x + 40, adder.y, adder.inputB, BIT_HIGH_COLOR);
    
    // Carry chain
    if (adder.bitPosition > 0) {
      const prevAdder = fullAdders[adder.bitPosition - 1];
      const prevCenterX = prevAdder.x + prevAdder.width / 2;
      const prevCenterY = prevAdder.y + prevAdder.height / 2;
      
      drawWire(
        prevAdder.x + prevAdder.width, prevCenterY + 10,
        adder.x, centerY + 20,
        adder.carryIn, CARRY_COLOR
      );
    }
    
    // Sum output to bottom
    const outputY = adder.y + adder.height + 40;
    drawWire(centerX, adder.y + adder.height, centerX, outputY, adder.sum, SUM_COLOR);
  }

  function drawInputNumbers() {
    const inputY = height * 0.15;
    
    drawBinaryNumber(width * 0.3, inputY, numberA, numBits, `Number A`);
    drawBinaryNumber(width * 0.7, inputY, numberB, numBits, `Number B`);
    
    // Plus sign
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", width * 0.5, inputY);
  }

  function drawResult() {
    const resultY = height * 0.8;
    const result = getResult();
    const finalCarry = getFinalCarry();
    
    // Equals sign
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("=", width * 0.1, resultY);
    
    // Result binary
    drawBinaryNumber(width * 0.5, resultY, result, numBits, "Sum");
    
    // Final carry (overflow)
    if (finalCarry) {
      ctx.fillStyle = CARRY_COLOR;
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const carryX = width * 0.5 - (numBits - 1) * 15 - 15;
      ctx.fillText("1", carryX, resultY);
      
      ctx.font = "10px monospace";
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText("overflow", carryX, resultY + 20);
    }
    
    // Decimal calculation
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const decimalResult = finalCarry ? result + (1 << numBits) : result;
    ctx.fillText(
      `${numberA} + ${numberB} = ${decimalResult}`,
      width * 0.5, resultY + 40
    );
  }

  function drawBitwiseBreakdown() {
    const breakdownX = width - 250;
    const breakdownY = height * 0.2;
    const lineH = 20;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(breakdownX - 10, breakdownY - 10, 240, lineH * 8 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(breakdownX - 10, breakdownY - 10, 240, lineH * 8 + 20);
    
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let y = breakdownY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Bitwise Addition", breakdownX, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    
    for (let i = numBits - 1; i >= 0; i--) {
      const adder = fullAdders[i];
      const a = adder.inputA ? "1" : "0";
      const b = adder.inputB ? "1" : "0";
      const cin = adder.carryIn ? "1" : "0";
      const s = adder.sum ? "1" : "0";
      const cout = adder.carryOut ? "1" : "0";
      
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(`Bit ${i}: ${a} + ${b} + ${cin} = ${cout}${s}`, breakdownX, y);
      y += lineH;
    }
  }

  function drawInfoPanel() {
    const panelX = 20;
    const panelY = height - 140;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX - 10, panelY - 10, 300, lineH * 6 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX - 10, panelY - 10, 300, lineH * 6 + 20);
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX;
    let y = panelY;
    
    ctx.fillStyle = "#4f46e5";
    ctx.fillText("Binary Adder Circuit", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Adding ${numBits}-bit numbers`, x, y);
    y += lineH;
    
    ctx.fillText("Sum = A ⊕ B ⊕ Cin (XOR)", x, y);
    y += lineH;
    
    ctx.fillText("Carry = AB + Cin(A ⊕ B)", x, y);
    y += lineH;
    
    ctx.fillText("Each full adder handles one bit", x, y);
    y += lineH;
    
    ctx.fillText("Carry propagates left to next bit", x, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      
      initializeAdders();
      calculateAddition();
    },

    update(dt: number, params: Record<string, number>) {
      numberA = Math.floor(params.numberA ?? numberA);
      numberB = Math.floor(params.numberB ?? numberB);
      numBits = Math.floor(params.numBits ?? numBits);
      showAnimation = (params.showAnimation ?? 1) > 0.5;
      
      time += dt;
      
      // Clamp numbers to fit in the specified number of bits
      const maxValue = (1 << numBits) - 1;
      numberA = Math.max(0, Math.min(maxValue, numberA));
      numberB = Math.max(0, Math.min(maxValue, numberB));
      
      // Reinitialize if bit width changed
      if (fullAdders.length !== numBits) {
        initializeAdders();
      }
      
      calculateAddition();
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw input numbers
      drawInputNumbers();
      
      // Draw full adders
      for (const adder of fullAdders) {
        drawFullAdder(adder);
      }
      
      // Draw result
      drawResult();
      
      // Draw breakdown
      drawBitwiseBreakdown();
      
      // Draw info panel
      drawInfoPanel();
    },

    reset() {
      time = 0;
      numberA = 5;
      numberB = 3;
      numBits = 4;
      initializeAdders();
      calculateAddition();
    },

    destroy() {
      fullAdders.length = 0;
    },

    getStateDescription(): string {
      const result = getResult();
      const finalCarry = getFinalCarry();
      const decimalResult = finalCarry ? result + (1 << numBits) : result;
      
      return (
        `Binary Adder: ${numBits}-bit ripple-carry adder performing ${numberA} + ${numberB} = ${decimalResult}. ` +
        `Each full adder computes Sum = A⊕B⊕Cin and Carry = AB + Cin(A⊕B). ` +
        `Binary: ${numberA.toString(2).padStart(numBits, '0')} + ` +
        `${numberB.toString(2).padStart(numBits, '0')} = ` +
        `${finalCarry ? '1' : ''}${result.toString(2).padStart(numBits, '0')}. ` +
        `${finalCarry ? 'Overflow detected - result exceeds ' + numBits + ' bits.' : 'No overflow.'}`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      initializeAdders();
    },
  };

  return engine;
};

export default BinaryAdder;