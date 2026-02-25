import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

interface HuffmanNode {
  char: string | null;
  freq: number;
  left: HuffmanNode | null;
  right: HuffmanNode | null;
  code?: string;
  id: number;
}

const HuffmanCoding: SimulationFactory = () => {
  const config = getSimConfig("huffman-coding")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Input parameters
  let inputText = "HELLO WORLD";
  let animationSpeed = 1.0;
  let showBuildProcess = 1;
  let time = 0;

  // Huffman tree state
  let charFrequencies: Map<string, number> = new Map();
  let huffmanTree: HuffmanNode | null = null;
  let huffmanCodes: Map<string, string> = new Map();
  let originalBits = 0;
  let compressedBits = 0;
  let compressionRatio = 0;

  // Animation state
  let buildStep = 0;
  let buildNodes: HuffmanNode[] = [];
  let nodeIdCounter = 0;

  // Tree visualization
  let treePositions: Map<number, { x: number; y: number }> = new Map();

  // Colors
  const BG = "#0f172a";
  const NODE_COLOR = "#3b82f6";
  const LEAF_COLOR = "#10b981";
  const TEXT_COLOR = "#e2e8f0";
  const HIGHLIGHT_COLOR = "#f59e0b";
  const FREQ_COLOR = "#a855f7";
  const CODE_COLOR = "#ef4444";
  const TREE_LINE = "#64748b";
  const PANEL_BG = "rgba(30, 41, 59, 0.9)";

  function computePhysics(dt: number, params: Record<string, number>) {
    // Update parameters from UI
    showBuildProcess = params.showBuildProcess ?? showBuildProcess;
    animationSpeed = params.animationSpeed ?? animationSpeed;
    
    // Handle text input (simplified - in real implementation would come from UI)
    const textOptions = [
      "HELLO WORLD",
      "ABRACADABRA", 
      "COMPRESSION",
      "AAAAABBBBCCCD",
      "THE QUICK BROWN FOX"
    ];
    const textIndex = Math.floor((params.inputText ?? 0) * textOptions.length) % textOptions.length;
    inputText = textOptions[textIndex];

    time += dt * animationSpeed;

    // Build Huffman tree
    buildHuffmanTree();
    
    // Calculate compression stats
    calculateCompressionStats();

    // Animate tree building process
    if (showBuildProcess) {
      animateBuildProcess();
    }
  }

  function buildHuffmanTree() {
    // Count character frequencies
    charFrequencies.clear();
    for (const char of inputText) {
      charFrequencies.set(char, (charFrequencies.get(char) || 0) + 1);
    }

    // Create leaf nodes
    const nodes: HuffmanNode[] = [];
    nodeIdCounter = 0;
    
    for (const [char, freq] of charFrequencies) {
      nodes.push({
        char,
        freq,
        left: null,
        right: null,
        id: nodeIdCounter++
      });
    }

    // Store initial nodes for animation
    buildNodes = [...nodes];

    // Build Huffman tree
    const queue = [...nodes].sort((a, b) => a.freq - b.freq);

    while (queue.length > 1) {
      const left = queue.shift()!;
      const right = queue.shift()!;

      const merged: HuffmanNode = {
        char: null,
        freq: left.freq + right.freq,
        left,
        right,
        id: nodeIdCounter++
      };

      // Insert in correct position to maintain sorted order
      let inserted = false;
      for (let i = 0; i < queue.length; i++) {
        if (merged.freq <= queue[i].freq) {
          queue.splice(i, 0, merged);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        queue.push(merged);
      }

      buildNodes.push(merged);
    }

    huffmanTree = queue[0] || null;
    
    // Generate codes
    huffmanCodes.clear();
    if (huffmanTree) {
      generateCodes(huffmanTree, "");
    }

    // Calculate tree positions for visualization
    calculateTreePositions();
  }

  function generateCodes(node: HuffmanNode, code: string) {
    if (node.char !== null) {
      // Leaf node
      huffmanCodes.set(node.char, code || "0"); // Handle single character case
      node.code = code || "0";
    } else {
      // Internal node
      if (node.left) generateCodes(node.left, code + "0");
      if (node.right) generateCodes(node.right, code + "1");
    }
  }

  function calculateCompressionStats() {
    // Original size (assuming 8 bits per character)
    originalBits = inputText.length * 8;

    // Compressed size
    compressedBits = 0;
    for (const char of inputText) {
      const code = huffmanCodes.get(char) || "";
      compressedBits += code.length;
    }

    compressionRatio = originalBits > 0 ? compressedBits / originalBits : 1;
  }

  function animateBuildProcess() {
    const stepsPerSecond = 0.5; // Slow animation
    buildStep = Math.floor(time * stepsPerSecond) % buildNodes.length;
  }

  function calculateTreePositions() {
    treePositions.clear();
    if (!huffmanTree) return;

    const treeX = width * 0.05;
    const treeY = height * 0.15;
    const treeW = width * 0.45;
    const treeH = height * 0.4;

    // Calculate tree depth
    const depth = calculateTreeDepth(huffmanTree);
    const levelHeight = treeH / Math.max(depth, 1);

    // Position nodes using recursive layout
    positionNode(huffmanTree, treeX + treeW / 2, treeY, treeW, levelHeight, 0);
  }

  function calculateTreeDepth(node: HuffmanNode | null): number {
    if (!node) return 0;
    return 1 + Math.max(
      calculateTreeDepth(node.left), 
      calculateTreeDepth(node.right)
    );
  }

  function positionNode(node: HuffmanNode, x: number, y: number, width: number, levelHeight: number, level: number) {
    treePositions.set(node.id, { x, y });

    if (node.left || node.right) {
      const childY = y + levelHeight;
      const childWidth = width / 2;
      
      if (node.left) {
        positionNode(node.left, x - childWidth / 2, childY, childWidth, levelHeight, level + 1);
      }
      if (node.right) {
        positionNode(node.right, x + childWidth / 2, childY, childWidth, levelHeight, level + 1);
      }
    }
  }

  function drawFrequencyTable() {
    const tableX = width * 0.52;
    const tableY = height * 0.15;
    const tableW = width * 0.22;
    const tableH = height * 0.4;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(tableX, tableY, tableW, tableH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, tableY, tableW, tableH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Character Frequencies", tableX + tableW / 2, tableY + 20);

    // Headers
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Char", tableX + 10, tableY + 45);
    ctx.fillText("Freq", tableX + 50, tableY + 45);
    ctx.fillText("Code", tableX + 90, tableY + 45);
    ctx.fillText("Bits", tableX + 140, tableY + 45);

    // Draw line under headers
    ctx.strokeStyle = "#4b5563";
    ctx.beginPath();
    ctx.moveTo(tableX + 5, tableY + 50);
    ctx.lineTo(tableX + tableW - 5, tableY + 50);
    ctx.stroke();

    // Character data
    let y = tableY + 70;
    const lineHeight = 20;
    
    for (const [char, freq] of charFrequencies) {
      const code = huffmanCodes.get(char) || "";
      
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "11px monospace";
      
      // Character (show space as ·)
      const displayChar = char === ' ' ? '·' : char;
      ctx.fillText(displayChar, tableX + 10, y);
      
      // Frequency
      ctx.fillStyle = FREQ_COLOR;
      ctx.fillText(freq.toString(), tableX + 50, y);
      
      // Code
      ctx.fillStyle = CODE_COLOR;
      ctx.fillText(code, tableX + 90, y);
      
      // Bit count
      ctx.fillStyle = "#6b7280";
      ctx.fillText((code.length * freq).toString(), tableX + 140, y);
      
      y += lineHeight;
      
      if (y > tableY + tableH - 20) break; // Don't overflow panel
    }
  }

  function drawHuffmanTree() {
    if (!huffmanTree) return;

    // Draw tree connections first
    drawTreeConnections(huffmanTree);
    
    // Draw nodes
    drawTreeNodes(huffmanTree);
  }

  function drawTreeConnections(node: HuffmanNode) {
    const pos = treePositions.get(node.id);
    if (!pos) return;

    ctx.strokeStyle = TREE_LINE;
    ctx.lineWidth = 2;

    if (node.left) {
      const leftPos = treePositions.get(node.left.id);
      if (leftPos) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y + 15);
        ctx.lineTo(leftPos.x, leftPos.y - 15);
        ctx.stroke();

        // Draw "0" label
        const midX = (pos.x + leftPos.x) / 2 - 10;
        const midY = (pos.y + leftPos.y) / 2;
        ctx.fillStyle = CODE_COLOR;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("0", midX, midY);
      }
      drawTreeConnections(node.left);
    }

    if (node.right) {
      const rightPos = treePositions.get(node.right.id);
      if (rightPos) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y + 15);
        ctx.lineTo(rightPos.x, rightPos.y - 15);
        ctx.stroke();

        // Draw "1" label
        const midX = (pos.x + rightPos.x) / 2 + 10;
        const midY = (pos.y + rightPos.y) / 2;
        ctx.fillStyle = CODE_COLOR;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("1", midX, midY);
      }
      drawTreeConnections(node.right);
    }
  }

  function drawTreeNodes(node: HuffmanNode) {
    const pos = treePositions.get(node.id);
    if (!pos) return;

    // Highlight current node in build process
    const isCurrentlyBuilding = showBuildProcess && node.id <= buildStep && node.id >= buildNodes.length - 5;
    const nodeColor = isCurrentlyBuilding ? HIGHLIGHT_COLOR : 
                     (node.char !== null ? LEAF_COLOR : NODE_COLOR);

    // Draw node circle
    ctx.fillStyle = nodeColor;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw node content
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (node.char !== null) {
      // Leaf node - show character
      const displayChar = node.char === ' ' ? '·' : node.char;
      ctx.fillText(displayChar, pos.x, pos.y - 3);
      ctx.font = "8px monospace";
      ctx.fillText(node.freq.toString(), pos.x, pos.y + 6);
    } else {
      // Internal node - show frequency
      ctx.fillText(node.freq.toString(), pos.x, pos.y);
    }

    // Draw code above leaf nodes
    if (node.char !== null && node.code) {
      ctx.fillStyle = CODE_COLOR;
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(node.code, pos.x, pos.y - 25);
    }

    // Recursively draw children
    if (node.left) drawTreeNodes(node.left);
    if (node.right) drawTreeNodes(node.right);
  }

  function drawEncodingExample() {
    const exampleX = width * 0.76;
    const exampleY = height * 0.15;
    const exampleW = width * 0.22;
    const exampleH = height * 0.4;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(exampleX, exampleY, exampleW, exampleH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(exampleX, exampleY, exampleW, exampleH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Encoding Example", exampleX + exampleW / 2, exampleY + 20);

    // Show original vs encoded
    const sampleText = inputText.substring(0, 8); // First 8 chars
    let y = exampleY + 45;

    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    
    // Original
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Original:", exampleX + 10, y);
    y += 20;

    for (let i = 0; i < sampleText.length; i++) {
      const char = sampleText[i];
      const displayChar = char === ' ' ? '·' : char;
      
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(displayChar, exampleX + 10 + i * 15, y);
      
      ctx.fillStyle = "#6b7280";
      ctx.font = "8px monospace";
      ctx.fillText("8 bits", exampleX + 10 + i * 15 - 4, y + 12);
      ctx.font = "11px monospace";
    }
    y += 35;

    // Huffman encoded
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Huffman:", exampleX + 10, y);
    y += 20;

    let bitX = exampleX + 10;
    for (let i = 0; i < sampleText.length; i++) {
      const char = sampleText[i];
      const code = huffmanCodes.get(char) || "";
      
      ctx.fillStyle = CODE_COLOR;
      ctx.fillText(code, bitX, y);
      
      ctx.fillStyle = "#6b7280";
      ctx.font = "8px monospace";
      ctx.fillText(`${code.length}b`, bitX, y + 12);
      ctx.font = "11px monospace";
      
      bitX += code.length * 8 + 10;
      if (bitX > exampleX + exampleW - 20) break;
    }
  }

  function drawCompressionStats() {
    const statsX = width * 0.05;
    const statsY = height * 0.58;
    const statsW = width * 0.9;
    const statsH = height * 0.15;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(statsX, statsY, statsW, statsH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(statsX, statsY, statsW, statsH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Compression Statistics", statsX + statsW / 2, statsY + 20);

    // Stats in columns
    const col1X = statsX + 20;
    const col2X = statsX + statsW / 3;
    const col3X = statsX + 2 * statsW / 3;
    const statsTop = statsY + 45;

    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    // Input text
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Input Text:", col1X, statsTop);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`"${inputText}"`, col1X, statsTop + 20);
    ctx.fillText(`${inputText.length} characters`, col1X, statsTop + 40);

    // Original encoding
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Original (ASCII):", col2X, statsTop);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`${originalBits} bits`, col2X, statsTop + 20);
    ctx.fillText(`8 bits/char`, col2X, statsTop + 40);

    // Huffman encoding
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Huffman Encoded:", col3X, statsTop);
    ctx.fillStyle = HIGHLIGHT_COLOR;
    ctx.fillText(`${compressedBits} bits`, col3X, statsTop + 20);
    ctx.fillStyle = compressionRatio < 1 ? "#10b981" : "#ef4444";
    ctx.fillText(`${(compressionRatio * 100).toFixed(1)}% of original`, col3X, statsTop + 40);
    
    const spaceSaved = originalBits - compressedBits;
    if (spaceSaved > 0) {
      ctx.fillStyle = "#10b981";
      ctx.fillText(`Saved: ${spaceSaved} bits (${(100 - compressionRatio * 100).toFixed(1)}%)`, col3X, statsTop + 60);
    }
  }

  function drawAlgorithmSteps() {
    const stepsX = width * 0.05;
    const stepsY = height * 0.75;
    const stepsW = width * 0.9;
    const stepsH = height * 0.22;

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
    ctx.fillText("Huffman Algorithm Steps", stepsX + stepsW / 2, stepsY + 20);

    const steps = [
      "1. Count frequency of each character",
      "2. Create leaf node for each character",
      "3. Build min-heap ordered by frequency", 
      "4. Repeatedly merge two lowest-frequency nodes",
      "5. Assign codes: 0 for left, 1 for right",
      "6. Encode text using generated codes"
    ];

    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    
    const stepY = stepsY + 40;
    const stepHeight = 15;
    const colWidth = stepsW / 3;

    steps.forEach((step, index) => {
      const x = stepsX + 20 + (index % 3) * colWidth;
      const y = stepY + Math.floor(index / 3) * stepHeight * 2;
      
      // Highlight current step if showing build process
      const isCurrentStep = showBuildProcess && index === Math.floor(buildStep / (buildNodes.length / 6));
      ctx.fillStyle = isCurrentStep ? HIGHLIGHT_COLOR : TEXT_COLOR;
      
      ctx.fillText(step, x, y);
    });

    // Properties box
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    
    const propsY = stepY + 60;
    ctx.fillText("Properties: • Prefix-free codes (no code is prefix of another)", stepsX + 20, propsY);
    ctx.fillText("           • Optimal for given character frequencies", stepsX + 20, propsY + 12);
    ctx.fillText("           • Greedy algorithm - locally optimal choices lead to global optimum", stepsX + 20, propsY + 24);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      buildStep = 0;
      charFrequencies.clear();
      huffmanCodes.clear();
      treePositions.clear();
      buildNodes = [];
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawFrequencyTable();
      drawHuffmanTree();
      drawEncodingExample();
      drawCompressionStats();
      drawAlgorithmSteps();
    },

    reset() {
      time = 0;
      buildStep = 0;
      charFrequencies.clear();
      huffmanCodes.clear();
      treePositions.clear();
      buildNodes = [];
    },

    destroy() {
      charFrequencies.clear();
      huffmanCodes.clear();
      treePositions.clear();
      buildNodes = [];
    },

    getStateDescription(): string {
      const uniqueChars = charFrequencies.size;
      const avgCodeLength = compressedBits > 0 ? compressedBits / inputText.length : 0;
      
      return (
        `Huffman coding compression of "${inputText}": ${inputText.length} characters, ${uniqueChars} unique symbols. ` +
        `Original: ${originalBits} bits (8 bits/char), Compressed: ${compressedBits} bits ` +
        `(avg ${avgCodeLength.toFixed(2)} bits/char). Compression ratio: ${(compressionRatio * 100).toFixed(1)}%. ` +
        `${compressionRatio < 1 ? `Space saved: ${originalBits - compressedBits} bits (${(100 - compressionRatio * 100).toFixed(1)}%).` : 'No compression achieved.'} ` +
        `Huffman coding creates optimal prefix-free codes by building binary tree where frequent characters get shorter codes.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HuffmanCoding;