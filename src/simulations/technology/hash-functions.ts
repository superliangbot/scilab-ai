import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const HashFunctions: SimulationFactory = () => {
  const config = getSimConfig("hash-functions")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Parameters
  let inputText = "Hello World";
  let hashAlgorithm = 0; // 0=simple, 1=SHA-256 style, 2=collision demo
  let showAvalanche = 1;
  let animationSpeed = 1.0;
  let time = 0;

  // Hash state
  let currentHash = "";
  let hashSteps: string[] = [];
  let avalancheDemo: { input1: string; input2: string; hash1: string; hash2: string; diffBits: number } = {
    input1: "", input2: "", hash1: "", hash2: "", diffBits: 0
  };

  // Animation
  let animationPhase = 0;
  let hashingProgress = 0;

  // Colors
  const BG = "#0f172a";
  const INPUT_COLOR = "#10b981";
  const HASH_COLOR = "#3b82f6";
  const STEP_COLOR = "#f59e0b";
  const AVALANCHE_COLOR = "#ef4444";
  const COLLISION_COLOR = "#a855f7";
  const BIT_0_COLOR = "#64748b";
  const BIT_1_COLOR = "#fbbf24";
  const TEXT_COLOR = "#e2e8f0";
  const PANEL_BG = "rgba(30, 41, 59, 0.9)";
  const HIGHLIGHT_BG = "rgba(59, 130, 246, 0.1)";

  // Simple hash function implementation
  function simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  }

  // SHA-256-like visualization (simplified)
  function sha256StyleHash(input: string): string {
    // This is a demonstration, not actual SHA-256
    const blocks = [];
    for (let i = 0; i < input.length; i += 4) {
      blocks.push(input.slice(i, i + 4).padEnd(4, '0'));
    }
    
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    
    for (const block of blocks) {
      let w = 0;
      for (let i = 0; i < block.length; i++) {
        w = (w << 8) | block.charCodeAt(i);
      }
      
      // Simplified compression function
      const temp1 = h3 + w + 0x428a2f98;
      const temp2 = ((h0 << 30) | (h0 >>> 2)) + ((h0 & h1) | (~h0 & h2));
      
      h3 = h2;
      h2 = h1;
      h1 = h0;
      h0 = (temp1 + temp2) & 0xffffffff;
    }
    
    return ((h0 >>> 0).toString(16).padStart(8, '0') + 
            (h1 >>> 0).toString(16).padStart(8, '0')).toUpperCase();
  }

  function calculateHash(input: string, algorithm: number): { hash: string; steps: string[] } {
    const steps: string[] = [];
    let hash: string;

    switch (algorithm) {
      case 0: // Simple hash
        steps.push(`Input: "${input}"`);
        steps.push(`Convert to bytes: ${Array.from(input).map(c => c.charCodeAt(0)).join(', ')}`);
        
        let h = 0;
        for (let i = 0; i < input.length; i++) {
          const char = input.charCodeAt(i);
          const oldH = h;
          h = ((h << 5) - h) + char;
          h = h & h;
          steps.push(`Step ${i+1}: h = ((${oldH} << 5) - ${oldH}) + ${char} = ${h}`);
        }
        
        hash = Math.abs(h).toString(16).padStart(8, '0').toUpperCase();
        steps.push(`Final hash: ${hash}`);
        break;

      case 1: // SHA-256 style
        steps.push(`Input: "${input}"`);
        steps.push("Initialize hash values (h0-h3)");
        steps.push("Process input in 4-byte blocks");
        steps.push("Apply compression function");
        steps.push("Combine final hash values");
        hash = sha256StyleHash(input);
        steps.push(`Final hash: ${hash}`);
        break;

      case 2: // Collision demonstration
        hash = simpleHash(input);
        steps.push(`Hash("${input}") = ${hash}`);
        
        // Try to find a simple collision (for demo purposes)
        for (let i = 1; i < 1000; i++) {
          const testInput = input + i.toString();
          const testHash = simpleHash(testInput);
          if (testHash === hash && testInput !== input) {
            steps.push(`Collision found!`);
            steps.push(`Hash("${testInput}") = ${testHash}`);
            break;
          }
        }
        break;

      default:
        hash = simpleHash(input);
        steps = [`Hash: ${hash}`];
    }

    return { hash, steps };
  }

  function calculateAvalancheEffect() {
    const input1 = inputText;
    const input2 = input1.substring(0, input1.length - 1) + 
                   String.fromCharCode((input1.charCodeAt(input1.length - 1) || 65) ^ 1); // Flip one bit
    
    const hash1 = simpleHash(input1);
    const hash2 = simpleHash(input2);
    
    // Count different bits
    let diffBits = 0;
    const maxLen = Math.max(hash1.length, hash2.length);
    
    for (let i = 0; i < maxLen; i++) {
      const h1 = parseInt(hash1[i] || '0', 16);
      const h2 = parseInt(hash2[i] || '0', 16);
      diffBits += countBitDifferences(h1, h2);
    }
    
    avalancheDemo = { input1, input2, hash1, hash2, diffBits };
  }

  function countBitDifferences(a: number, b: number): number {
    let xor = a ^ b;
    let count = 0;
    while (xor) {
      count += xor & 1;
      xor >>>= 1;
    }
    return count;
  }

  function computePhysics(dt: number, params: Record<string, number>) {
    // Update parameters
    const textOptions = [
      "Hello World", "Hello", "The quick brown fox", "Bitcoin", 
      "Blockchain", "Cryptography", "Hash function", "Security"
    ];
    const textIndex = Math.floor((params.inputText ?? 0) * textOptions.length) % textOptions.length;
    inputText = textOptions[textIndex];

    hashAlgorithm = Math.floor((params.hashAlgorithm ?? 0) * 3) % 3;
    showAvalanche = params.showAvalanche ?? showAvalanche;
    animationSpeed = params.animationSpeed ?? animationSpeed;

    time += dt * animationSpeed;
    animationPhase = time % 4; // 4-second cycle
    hashingProgress = (animationPhase / 4) * 100;

    // Calculate hash
    const result = calculateHash(inputText, hashAlgorithm);
    currentHash = result.hash;
    hashSteps = result.steps;

    // Calculate avalanche effect
    if (showAvalanche) {
      calculateAvalancheEffect();
    }
  }

  function drawInputOutput() {
    const ioX = width * 0.02;
    const ioY = height * 0.02;
    const ioW = width * 0.96;
    const ioH = height * 0.12;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(ioX, ioY, ioW, ioH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(ioX, ioY, ioW, ioH);

    // Input section
    const inputX = ioX + 20;
    const inputY = ioY + 25;
    
    ctx.fillStyle = INPUT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("INPUT:", inputX, inputY);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`"${inputText}"`, inputX + 70, inputY);
    
    const inputBytes = Array.from(inputText).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.fillText(`Bytes: ${inputBytes}`, inputX + 70, inputY + 15);

    // Hash function arrow
    const arrowY = inputY + 30;
    ctx.strokeStyle = STEP_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(inputX + 200, arrowY);
    ctx.lineTo(inputX + 300, arrowY);
    ctx.stroke();
    
    // Arrow head
    ctx.fillStyle = STEP_COLOR;
    ctx.beginPath();
    ctx.moveTo(inputX + 300, arrowY);
    ctx.lineTo(inputX + 290, arrowY - 5);
    ctx.lineTo(inputX + 290, arrowY + 5);
    ctx.closePath();
    ctx.fill();

    const algorithms = ["Simple Hash", "SHA-256 Style", "Collision Demo"];
    ctx.fillStyle = STEP_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(algorithms[hashAlgorithm], inputX + 250, arrowY - 10);

    // Output section
    const outputX = inputX + 350;
    ctx.fillStyle = HASH_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("HASH:", outputX, inputY);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "13px monospace";
    ctx.fillText(currentHash, outputX + 60, inputY);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.fillText(`${currentHash.length * 4} bits, ${currentHash.length} hex chars`, outputX + 60, inputY + 15);
  }

  function drawHashSteps() {
    const stepsX = width * 0.02;
    const stepsY = height * 0.16;
    const stepsW = width * 0.48;
    const stepsH = height * 0.45;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(stepsX, stepsY, stepsW, stepsH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(stepsX, stepsY, stepsW, stepsH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Hash Computation Steps", stepsX + stepsW / 2, stepsY + 25);

    // Steps
    let y = stepsY + 50;
    const lineHeight = 16;
    const currentStepIndex = Math.floor((hashingProgress / 100) * hashSteps.length);

    hashSteps.forEach((step, index) => {
      const isCurrentStep = index === currentStepIndex;
      const isCompleted = index < currentStepIndex;

      // Highlight current step
      if (isCurrentStep) {
        ctx.fillStyle = HIGHLIGHT_BG;
        ctx.fillRect(stepsX + 5, y - 12, stepsW - 10, lineHeight + 4);
      }

      // Step text
      ctx.fillStyle = isCompleted ? "#10b981" : 
                     isCurrentStep ? STEP_COLOR : TEXT_COLOR;
      ctx.font = "11px monospace";
      ctx.textAlign = "left";

      // Wrap long lines
      const maxWidth = stepsW - 30;
      const words = step.split(' ');
      let line = '';
      
      for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && line !== '') {
          ctx.fillText(line.trim(), stepsX + 15, y);
          line = word + ' ';
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      
      if (line.trim()) {
        ctx.fillText(line.trim(), stepsX + 15, y);
      }
      
      y += lineHeight + 5;
      
      if (y > stepsY + stepsH - 20) return; // Don't overflow
    });

    // Progress bar
    const progressY = stepsY + stepsH - 15;
    const progressW = stepsW - 20;
    
    ctx.fillStyle = "#374151";
    ctx.fillRect(stepsX + 10, progressY, progressW, 8);
    
    ctx.fillStyle = STEP_COLOR;
    ctx.fillRect(stepsX + 10, progressY, (hashingProgress / 100) * progressW, 8);
  }

  function drawHashVisualization() {
    const vizX = width * 0.52;
    const vizY = width > 1000 ? height * 0.16 : height * 0.16;
    const vizW = width * 0.46;
    const vizH = width > 1000 ? height * 0.45 : height * 0.25;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(vizX, vizY, vizW, vizH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(vizX, vizY, vizW, vizH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Hash Visualization", vizX + vizW / 2, vizY + 25);

    // Binary representation
    const binaryY = vizY + 50;
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Binary:", vizX + 10, binaryY);

    // Convert hash to binary and display as colored blocks
    let bitX = vizX + 10;
    let bitY = binaryY + 20;
    const bitSize = 8;
    const bitsPerRow = Math.floor((vizW - 20) / (bitSize + 2));

    for (let i = 0; i < currentHash.length; i++) {
      const hexDigit = parseInt(currentHash[i], 16);
      const binary = hexDigit.toString(2).padStart(4, '0');

      for (let j = 0; j < 4; j++) {
        const bit = binary[j];
        const x = bitX + ((i * 4 + j) % bitsPerRow) * (bitSize + 2);
        const y = bitY + Math.floor((i * 4 + j) / bitsPerRow) * (bitSize + 2);

        ctx.fillStyle = bit === '1' ? BIT_1_COLOR : BIT_0_COLOR;
        ctx.fillRect(x, y, bitSize, bitSize);

        // Bit value
        ctx.fillStyle = bit === '1' ? "#000" : "#fff";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(bit, x + bitSize/2, y + bitSize/2 + 2);
      }
    }

    // Hash distribution visualization
    if (vizH > 200) {
      const distY = bitY + Math.ceil((currentHash.length * 4) / bitsPerRow) * (bitSize + 2) + 20;
      
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Bit Distribution:", vizX + 10, distY);

      // Count 0s and 1s
      let ones = 0, zeros = 0;
      for (let i = 0; i < currentHash.length; i++) {
        const hexDigit = parseInt(currentHash[i], 16);
        const binary = hexDigit.toString(2).padStart(4, '0');
        for (const bit of binary) {
          if (bit === '1') ones++;
          else zeros++;
        }
      }

      const total = ones + zeros;
      const barY = distY + 20;
      const barHeight = 20;
      const barWidth = vizW - 40;

      // Zeros bar
      ctx.fillStyle = BIT_0_COLOR;
      ctx.fillRect(vizX + 20, barY, (zeros / total) * barWidth, barHeight);

      // Ones bar
      ctx.fillStyle = BIT_1_COLOR;
      ctx.fillRect(vizX + 20 + (zeros / total) * barWidth, barY, (ones / total) * barWidth, barHeight);

      // Labels
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`0s: ${zeros} (${((zeros/total)*100).toFixed(1)}%)`, vizX + 20, barY + barHeight + 15);
      ctx.fillText(`1s: ${ones} (${((ones/total)*100).toFixed(1)}%)`, vizX + 20, barY + barHeight + 30);
    }
  }

  function drawAvalancheEffect() {
    if (!showAvalanche) return;

    const avalX = width * 0.02;
    const avalY = height * 0.63;
    const avalW = width * 0.96;
    const avalH = height * 0.35;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(avalX, avalY, avalW, avalH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(avalX, avalY, avalW, avalH);

    // Title
    ctx.fillStyle = AVALANCHE_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Avalanche Effect Demonstration", avalX + avalW / 2, avalY + 25);

    // Show two similar inputs and their very different hashes
    const col1X = avalX + 20;
    const col2X = avalX + avalW / 2 + 10;
    let y = avalY + 50;

    // Input 1
    ctx.fillStyle = INPUT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Input 1:", col1X, y);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`"${avalancheDemo.input1}"`, col1X + 70, y);

    ctx.fillStyle = HASH_COLOR;
    ctx.fillText("Hash 1:", col1X, y + 20);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(avalancheDemo.hash1, col1X + 70, y + 20);

    // Input 2
    ctx.fillStyle = INPUT_COLOR;
    ctx.fillText("Input 2:", col2X, y);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`"${avalancheDemo.input2}"`, col2X + 70, y);

    ctx.fillStyle = HASH_COLOR;
    ctx.fillText("Hash 2:", col2X, y + 20);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(avalancheDemo.hash2, col2X + 70, y + 20);

    y += 50;

    // Difference analysis
    ctx.fillStyle = AVALANCHE_COLOR;
    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Bit differences: ${avalancheDemo.diffBits} out of ${avalancheDemo.hash1.length * 4} bits`, avalX + avalW / 2, y);
    
    const diffPercentage = (avalancheDemo.diffBits / (avalancheDemo.hash1.length * 4)) * 100;
    ctx.fillText(`Difference: ${diffPercentage.toFixed(1)}% (ideal: ~50%)`, avalX + avalW / 2, y + 20);

    // Visual diff
    y += 50;
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Bit-by-bit comparison:", avalX + 20, y);

    const bitCompareY = y + 25;
    const bitSize = 6;
    let bitX = avalX + 20;

    for (let i = 0; i < Math.max(avalancheDemo.hash1.length, avalancheDemo.hash2.length); i++) {
      const h1 = parseInt(avalancheDemo.hash1[i] || '0', 16);
      const h2 = parseInt(avalancheDemo.hash2[i] || '0', 16);
      const isDifferent = h1 !== h2;

      const binary1 = h1.toString(2).padStart(4, '0');
      const binary2 = h2.toString(2).padStart(4, '0');

      for (let j = 0; j < 4; j++) {
        const bit1 = binary1[j];
        const bit2 = binary2[j];
        const bitDiff = bit1 !== bit2;

        const x = bitX + ((i * 4 + j) % Math.floor((avalW - 40) / (bitSize + 1))) * (bitSize + 1);
        const rowOffset = Math.floor((i * 4 + j) / Math.floor((avalW - 40) / (bitSize + 1))) * (bitSize * 2 + 10);

        // Bit 1
        ctx.fillStyle = bitDiff ? AVALANCHE_COLOR : (bit1 === '1' ? BIT_1_COLOR : BIT_0_COLOR);
        ctx.fillRect(x, bitCompareY + rowOffset, bitSize, bitSize);

        // Bit 2
        ctx.fillStyle = bitDiff ? AVALANCHE_COLOR : (bit2 === '1' ? BIT_1_COLOR : BIT_0_COLOR);
        ctx.fillRect(x, bitCompareY + bitSize + 2 + rowOffset, bitSize, bitSize);
      }
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      animationPhase = 0;
      hashingProgress = 0;
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawInputOutput();
      drawHashSteps();
      drawHashVisualization();
      drawAvalancheEffect();
    },

    reset() {
      time = 0;
      animationPhase = 0;
      hashingProgress = 0;
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const algorithms = ["simple hash", "SHA-256 style", "collision demonstration"];
      const totalBits = currentHash.length * 4;
      
      return (
        `Hash function visualization using ${algorithms[hashAlgorithm]} algorithm. ` +
        `Input "${inputText}" produces ${totalBits}-bit hash ${currentHash}. ` +
        `${showAvalanche ? `Avalanche effect: ${avalancheDemo.diffBits} bit differences (${((avalancheDemo.diffBits / totalBits) * 100).toFixed(1)}%) from 1-bit input change. ` : ''}` +
        `Hash functions provide: deterministic output, avalanche effect, collision resistance, and irreversibility. ` +
        `Critical for digital signatures, password storage, blockchain proof-of-work, and data integrity verification.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HashFunctions;