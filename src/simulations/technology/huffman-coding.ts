import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Huffman tree node ──────────────────────────────────────────
interface HuffmanNode {
  char: string | null;
  frequency: number;
  left: HuffmanNode | null;
  right: HuffmanNode | null;
  isLeaf: boolean;
  code?: string;
  x?: number;
  y?: number;
  id: number;
}

// ─── Character frequency ──────────────────────────────────────────
interface CharFrequency {
  char: string;
  frequency: number;
}

// ─── Factory ────────────────────────────────────────────────────
const HuffmanCodingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("huffman-coding") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // State
  let inputText = "HELLO WORLD";
  let charFrequencies: CharFrequency[] = [];
  let huffmanTree: HuffmanNode | null = null;
  let huffmanCodes: Map<string, string> = new Map();
  let encodedText = "";
  let isBuilding = false;
  let buildStep = 0;
  let buildNodes: HuffmanNode[] = [];
  let stepDelay = 0;
  let nextNodeId = 0;

  // Parameters
  let animationSpeed = 3;
  let textInput = 0; // 0=HELLO WORLD, 1=ABRACADABRA, 2=Custom
  let showCodes = 1;

  const NODE_RADIUS = 20;
  const LEVEL_HEIGHT = 80;

  const presetTexts = [
    "HELLO WORLD",
    "ABRACADABRA", 
    "COMPRESSION"
  ];

  function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    ctx = canvas.getContext("2d")!;
    resize(canvas.width, canvas.height);
    
    buildHuffmanTree();
  }

  function resize(width: number, height: number): void {
    W = width;
    H = height;
  }

  function countFrequencies(): void {
    const freqMap = new Map<string, number>();
    
    for (const char of inputText) {
      freqMap.set(char, (freqMap.get(char) || 0) + 1);
    }
    
    charFrequencies = Array.from(freqMap.entries()).map(([char, freq]) => ({
      char,
      frequency: freq
    })).sort((a, b) => a.frequency - b.frequency);
  }

  function buildHuffmanTree(): void {
    nextNodeId = 0;
    countFrequencies();
    
    if (charFrequencies.length === 0) return;
    if (charFrequencies.length === 1) {
      // Special case: single character
      huffmanTree = createNode(charFrequencies[0].char, charFrequencies[0].frequency, true);
      huffmanCodes.set(charFrequencies[0].char, "0");
      calculatePositions();
      return;
    }
    
    // Create initial leaf nodes
    buildNodes = charFrequencies.map(cf => 
      createNode(cf.char, cf.frequency, true)
    );
    
    // Start building animation
    isBuilding = true;
    buildStep = 0;
  }

  function createNode(char: string | null, freq: number, isLeaf: boolean): HuffmanNode {
    return {
      char,
      frequency: freq,
      left: null,
      right: null,
      isLeaf,
      id: nextNodeId++,
      x: 0,
      y: 0
    };
  }

  function stepBuild(): void {
    if (buildNodes.length <= 1) {
      huffmanTree = buildNodes[0] || null;
      isBuilding = false;
      generateCodes();
      calculatePositions();
      return;
    }
    
    // Sort by frequency
    buildNodes.sort((a, b) => a.frequency - b.frequency);
    
    // Take two nodes with lowest frequency
    const left = buildNodes.shift()!;
    const right = buildNodes.shift()!;
    
    // Create new internal node
    const merged = createNode(
      null, 
      left.frequency + right.frequency, 
      false
    );
    merged.left = left;
    merged.right = right;
    
    // Insert back into array
    buildNodes.push(merged);
  }

  function generateCodes(): void {
    huffmanCodes.clear();
    if (!huffmanTree) return;
    
    if (huffmanTree.isLeaf) {
      // Single character case
      huffmanCodes.set(huffmanTree.char!, "0");
      huffmanTree.code = "0";
    } else {
      generateCodesRecursive(huffmanTree, "");
    }
    
    // Generate encoded text
    encodedText = "";
    for (const char of inputText) {
      encodedText += huffmanCodes.get(char) || "";
    }
  }

  function generateCodesRecursive(node: HuffmanNode, code: string): void {
    if (node.isLeaf && node.char) {
      huffmanCodes.set(node.char, code || "0");
      node.code = code || "0";
    } else {
      if (node.left) {
        generateCodesRecursive(node.left, code + "0");
      }
      if (node.right) {
        generateCodesRecursive(node.right, code + "1");
      }
    }
  }

  function calculatePositions(): void {
    if (!huffmanTree) return;
    
    // Calculate tree dimensions
    const depth = getTreeDepth(huffmanTree);
    const leaves = getLeafCount(huffmanTree);
    
    // Position root
    huffmanTree.x = W / 2;
    huffmanTree.y = 80;
    
    // Position all nodes
    positionNode(huffmanTree, W / 2, 80, W / 4, 0, depth);
  }

  function getTreeDepth(node: HuffmanNode | null): number {
    if (!node) return 0;
    return 1 + Math.max(getTreeDepth(node.left), getTreeDepth(node.right));
  }

  function getLeafCount(node: HuffmanNode | null): number {
    if (!node) return 0;
    if (node.isLeaf) return 1;
    return getLeafCount(node.left) + getLeafCount(node.right);
  }

  function positionNode(
    node: HuffmanNode, 
    x: number, 
    y: number, 
    xOffset: number, 
    level: number,
    maxDepth: number
  ): void {
    node.x = x;
    node.y = y;
    
    if (node.left) {
      positionNode(
        node.left, 
        x - xOffset, 
        y + LEVEL_HEIGHT, 
        xOffset / 2, 
        level + 1,
        maxDepth
      );
    }
    
    if (node.right) {
      positionNode(
        node.right, 
        x + xOffset, 
        y + LEVEL_HEIGHT, 
        xOffset / 2, 
        level + 1,
        maxDepth
      );
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    const newSpeed = params.animationSpeed ?? 3;
    const newTextInput = params.textInput ?? 0;
    const newShowCodes = params.showCodes ?? 1;
    
    animationSpeed = newSpeed;
    showCodes = newShowCodes;
    
    if (newTextInput !== textInput) {
      textInput = newTextInput;
      inputText = presetTexts[textInput] || "HELLO WORLD";
      buildHuffmanTree();
    }

    if (isBuilding) {
      stepDelay += dt;
      if (stepDelay >= 1000 / animationSpeed) {
        stepBuild();
        stepDelay = 0;
      }
    }
  }

  function render(): void {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, W, H);

    // Draw frequency table
    drawFrequencyTable();
    
    // Draw Huffman tree
    if (huffmanTree && !isBuilding) {
      drawTree(huffmanTree);
    }
    
    // Draw building animation
    if (isBuilding) {
      drawBuildingAnimation();
    }
    
    // Draw encoding info
    drawEncodingInfo();
  }

  function drawFrequencyTable(): void {
    const tableX = 20;
    const tableY = 20;
    const cellW = 35;
    const cellH = 25;
    
    // Title
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Input: "${inputText}"`, tableX, tableY - 5);
    
    // Table headers
    ctx.fillStyle = "#4a5568";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    
    for (let i = 0; i < charFrequencies.length; i++) {
      const x = tableX + i * cellW;
      const y = tableY + 20;
      
      // Character
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = "#cbd5e0";
      ctx.strokeRect(x, y, cellW, cellH);
      
      ctx.fillStyle = "#2d3748";
      const char = charFrequencies[i].char === ' ' ? '␣' : charFrequencies[i].char;
      ctx.fillText(char, x + cellW/2, y + 16);
      
      // Frequency
      ctx.fillStyle = "#f7fafc";
      ctx.fillRect(x, y + cellH, cellW, cellH);
      ctx.strokeStyle = "#cbd5e0";
      ctx.strokeRect(x, y + cellH, cellW, cellH);
      
      ctx.fillStyle = "#2d3748";
      ctx.fillText(charFrequencies[i].frequency.toString(), x + cellW/2, y + cellH + 16);
      
      // Huffman code (if available)
      if (showCodes && huffmanCodes.has(charFrequencies[i].char)) {
        ctx.fillStyle = "#e6fffa";
        ctx.fillRect(x, y + 2*cellH, cellW, cellH);
        ctx.strokeStyle = "#cbd5e0";
        ctx.strokeRect(x, y + 2*cellH, cellW, cellH);
        
        ctx.fillStyle = "#2d3748";
        ctx.font = "10px monospace";
        const code = huffmanCodes.get(charFrequencies[i].char) || "";
        ctx.fillText(code, x + cellW/2, y + 2*cellH + 16);
        ctx.font = "12px sans-serif";
      }
    }
    
    // Labels
    ctx.fillStyle = "#4a5568";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Char:", tableX - 5, tableY + 20 + 16);
    ctx.fillText("Freq:", tableX - 5, tableY + 20 + cellH + 16);
    if (showCodes) {
      ctx.fillText("Code:", tableX - 5, tableY + 20 + 2*cellH + 16);
    }
  }

  function drawTree(node: HuffmanNode): void {
    if (!node.x || !node.y) return;
    
    // Draw connections to children
    if (node.left && node.left.x && node.left.y) {
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(node.left.x, node.left.y);
      ctx.stroke();
      
      // Label with "0"
      const midX = (node.x + node.left.x) / 2;
      const midY = (node.y + node.left.y) / 2;
      ctx.fillStyle = "#e53e3e";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("0", midX - 10, midY);
    }
    
    if (node.right && node.right.x && node.right.y) {
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(node.right.x, node.right.y);
      ctx.stroke();
      
      // Label with "1"
      const midX = (node.x + node.right.x) / 2;
      const midY = (node.y + node.right.y) / 2;
      ctx.fillStyle = "#38a169";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("1", midX + 10, midY);
    }
    
    // Draw node
    ctx.fillStyle = node.isLeaf ? "#bee3f8" : "#fed7d7";
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.strokeStyle = "#2d3748";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Node label
    ctx.fillStyle = "#2d3748";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    
    if (node.isLeaf && node.char) {
      const char = node.char === ' ' ? '␣' : node.char;
      ctx.fillText(char, node.x, node.y - 2);
      ctx.font = "10px sans-serif";
      ctx.fillText(node.frequency.toString(), node.x, node.y + 10);
    } else {
      ctx.fillText(node.frequency.toString(), node.x, node.y + 3);
    }
    
    // Draw children recursively
    if (node.left) drawTree(node.left);
    if (node.right) drawTree(node.right);
  }

  function drawBuildingAnimation(): void {
    // Draw current nodes being processed
    const startX = 50;
    const startY = 300;
    const nodeSpacing = 60;
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Building Huffman Tree...", startX, startY - 20);
    
    for (let i = 0; i < buildNodes.length; i++) {
      const x = startX + i * nodeSpacing;
      const y = startY;
      
      // Highlight first two nodes (being merged)
      if (i < 2) {
        ctx.strokeStyle = "#f56565";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 3, 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      // Draw node
      ctx.fillStyle = buildNodes[i].isLeaf ? "#bee3f8" : "#fed7d7";
      ctx.beginPath();
      ctx.arc(x, y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = "#2d3748";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Node label
      ctx.fillStyle = "#2d3748";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      
      if (buildNodes[i].isLeaf && buildNodes[i].char) {
        const char = buildNodes[i].char === ' ' ? '␣' : buildNodes[i].char;
        ctx.fillText(char, x, y - 2);
        ctx.fillText(buildNodes[i].frequency.toString(), x, y + 10);
      } else {
        ctx.fillText(buildNodes[i].frequency.toString(), x, y + 3);
      }
    }
  }

  function drawEncodingInfo(): void {
    if (!huffmanTree || isBuilding) return;
    
    const infoX = 20;
    const infoY = H - 120;
    
    // Original vs compressed
    const originalBits = inputText.length * 8; // ASCII
    const compressedBits = encodedText.length;
    const compressionRatio = originalBits > 0 ? (compressedBits / originalBits) : 0;
    const savings = Math.max(0, 100 * (1 - compressionRatio));
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    
    ctx.fillText(`Original (ASCII): ${originalBits} bits`, infoX, infoY);
    ctx.fillText(`Huffman coded: ${compressedBits} bits`, infoX, infoY + 20);
    ctx.fillText(`Compression: ${savings.toFixed(1)}% savings`, infoX, infoY + 40);
    
    // Show encoded text (truncated if too long)
    ctx.font = "12px monospace";
    let displayEncoded = encodedText;
    if (displayEncoded.length > 60) {
      displayEncoded = displayEncoded.substring(0, 60) + "...";
    }
    ctx.fillText(`Encoded: ${displayEncoded}`, infoX, infoY + 70);
    
    // Average code length
    let totalCodeLength = 0;
    for (const char of inputText) {
      totalCodeLength += huffmanCodes.get(char)?.length || 0;
    }
    const avgCodeLength = inputText.length > 0 ? (totalCodeLength / inputText.length) : 0;
    
    ctx.font = "14px sans-serif";
    ctx.fillText(`Avg code length: ${avgCodeLength.toFixed(2)} bits/char`, infoX + 300, infoY);
  }

  function getStateDescription(): string {
    if (isBuilding) {
      return `Building Huffman tree for "${inputText}". Processing ${buildNodes.length} nodes remaining. ` +
             `Character frequencies calculated from input text.`;
    } else {
      const originalBits = inputText.length * 8;
      const compressedBits = encodedText.length;
      const savings = originalBits > 0 ? (100 * (1 - compressedBits / originalBits)) : 0;
      
      return `Huffman coding complete for "${inputText}". ` +
             `Original: ${originalBits} bits, Compressed: ${compressedBits} bits. ` +
             `${savings.toFixed(1)}% compression achieved. Tree depth: ${huffmanTree ? getTreeDepth(huffmanTree) : 0}`;
    }
  }

  function reset(): void {
    buildHuffmanTree();
  }

  function destroy(): void {
    // Cleanup if needed
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

export default HuffmanCodingFactory;