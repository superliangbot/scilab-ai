import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const GoldenRatioSpiral: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("golden-ratio-spiral") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let fibonacciTerms = 10;
  let showSquares = 1;
  let showSpiral = 1;
  let animationSpeed = 1;

  // Golden ratio and Fibonacci sequence
  const PHI = (1 + Math.sqrt(5)) / 2; // Golden ratio ≈ 1.618
  let fibSequence: number[] = [];
  let squares: Array<{
    size: number;
    x: number;
    y: number;
    color: string;
    animationPhase: number;
  }> = [];

  // Animation state
  let currentTerm = 0;
  let termTimer = 0;
  let spiralProgress = 0;

  const CENTER_X = width * 0.4;
  const CENTER_Y = height * 0.5;
  const SCALE_FACTOR = 3;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    generateFibonacci();
    generateSquares();
  }

  function generateFibonacci() {
    fibSequence = [1, 1];
    for (let i = 2; i < fibonacciTerms; i++) {
      fibSequence[i] = fibSequence[i-1] + fibSequence[i-2];
    }
  }

  function generateSquares() {
    squares = [];
    
    // Starting positions and orientations
    let x = CENTER_X;
    let y = CENTER_Y;
    let direction = 0; // 0=right, 1=down, 2=left, 3=up
    
    const colors = [
      "#ef4444", "#f97316", "#eab308", "#22c55e", 
      "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
      "#f59e0b", "#10b981"
    ];

    for (let i = 0; i < Math.min(fibonacciTerms, fibSequence.length); i++) {
      const size = fibSequence[i] * SCALE_FACTOR;
      
      // Adjust position based on direction for proper tiling
      let squareX = x;
      let squareY = y;
      
      if (i === 0) {
        // First square at center
        squareX = CENTER_X - size/2;
        squareY = CENTER_Y - size/2;
      } else {
        const prevSize = fibSequence[i-1] * SCALE_FACTOR;
        
        switch (direction % 4) {
          case 0: // Right
            squareX = x;
            squareY = y - size;
            break;
          case 1: // Down
            squareX = x;
            squareY = y;
            break;
          case 2: // Left
            squareX = x - size;
            squareY = y;
            break;
          case 3: // Up
            squareX = x - size;
            squareY = y - size;
            break;
        }
      }
      
      squares.push({
        size: size,
        x: squareX,
        y: squareY,
        color: colors[i % colors.length],
        animationPhase: 0
      });
      
      // Update position for next square
      if (i > 0) {
        const prevSize = fibSequence[i-1] * SCALE_FACTOR;
        
        switch (direction % 4) {
          case 0: // Right
            x += prevSize;
            y -= size;
            break;
          case 1: // Down
            x += size;
            y += prevSize;
            break;
          case 2: // Left
            x -= size;
            y += size;
            break;
          case 3: // Up
            x -= prevSize;
            y -= prevSize;
            break;
        }
        direction++;
      }
    }
  }

  function update(dt: number, params: Record<string, number>) {
    const oldTerms = fibonacciTerms;
    fibonacciTerms = params.fibonacciTerms ?? fibonacciTerms;
    showSquares = Math.round(params.showSquares ?? showSquares);
    showSpiral = Math.round(params.showSpiral ?? showSpiral);
    animationSpeed = params.animationSpeed ?? animationSpeed;

    if (oldTerms !== fibonacciTerms) {
      generateFibonacci();
      generateSquares();
      currentTerm = 0;
      termTimer = 0;
      spiralProgress = 0;
    }

    time += dt;
    termTimer += dt * animationSpeed;

    // Animate square appearance
    if (currentTerm < squares.length && termTimer > 1) {
      currentTerm++;
      termTimer = 0;
    }

    // Update animation phases
    squares.forEach((square, index) => {
      if (index < currentTerm) {
        square.animationPhase = Math.min(1, square.animationPhase + dt * 2);
      }
    });

    // Animate spiral progress
    if (currentTerm >= squares.length) {
      spiralProgress = Math.min(1, spiralProgress + dt * animationSpeed * 0.5);
    }
  }

  function drawSquares() {
    if (!showSquares) return;

    squares.forEach((square, index) => {
      if (index >= currentTerm) return;

      const alpha = square.animationPhase;
      const scale = 0.3 + 0.7 * alpha;

      // Square background
      ctx.fillStyle = square.color + Math.floor(alpha * 0.3 * 255).toString(16).padStart(2, '0');
      ctx.fillRect(
        square.x + (square.size * (1 - scale)) / 2,
        square.y + (square.size * (1 - scale)) / 2,
        square.size * scale,
        square.size * scale
      );

      // Square border
      ctx.strokeStyle = square.color;
      ctx.lineWidth = 2 * alpha;
      ctx.strokeRect(
        square.x + (square.size * (1 - scale)) / 2,
        square.y + (square.size * (1 - scale)) / 2,
        square.size * scale,
        square.size * scale
      );

      // Fibonacci number label
      if (alpha > 0.5) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.min(16, square.size * 0.3)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          fibSequence[index].toString(),
          square.x + square.size / 2,
          square.y + square.size / 2
        );
      }
    });
  }

  function drawSpiral() {
    if (!showSpiral || currentTerm < 2) return;

    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.beginPath();

    let totalProgress = spiralProgress * (currentTerm - 1);
    let segmentStart = 0;

    for (let i = 1; i < currentTerm && totalProgress > 0; i++) {
      const square = squares[i];
      const radius = fibSequence[i] * SCALE_FACTOR;
      
      const segmentProgress = Math.min(1, Math.max(0, totalProgress - segmentStart));
      
      if (segmentProgress > 0) {
        // Determine quarter circle parameters based on square position
        let centerX, centerY, startAngle, endAngle;
        const direction = (i - 1) % 4;
        
        switch (direction) {
          case 0: // Right - bottom-left corner
            centerX = square.x;
            centerY = square.y + square.size;
            startAngle = -Math.PI / 2;
            endAngle = 0;
            break;
          case 1: // Down - top-left corner
            centerX = square.x;
            centerY = square.y;
            startAngle = 0;
            endAngle = Math.PI / 2;
            break;
          case 2: // Left - top-right corner
            centerX = square.x + square.size;
            centerY = square.y;
            startAngle = Math.PI / 2;
            endAngle = Math.PI;
            break;
          case 3: // Up - bottom-right corner
            centerX = square.x + square.size;
            centerY = square.y + square.size;
            startAngle = Math.PI;
            endAngle = -Math.PI / 2;
            break;
          default:
            centerX = square.x;
            centerY = square.y;
            startAngle = 0;
            endAngle = Math.PI / 2;
        }

        const currentAngle = startAngle + (endAngle - startAngle) * segmentProgress;
        
        if (i === 1) {
          ctx.moveTo(
            centerX + radius * Math.cos(startAngle),
            centerY + radius * Math.sin(startAngle)
          );
        }
        
        ctx.arc(centerX, centerY, radius, startAngle, currentAngle);
        
        totalProgress -= 1;
      }
      
      segmentStart += 1;
    }
    
    ctx.stroke();
    
    // Draw spiral endpoint
    if (spiralProgress > 0.95 && currentTerm > 1) {
      const lastSquare = squares[currentTerm - 1];
      const lastRadius = fibSequence[currentTerm - 1] * SCALE_FACTOR;
      const direction = (currentTerm - 2) % 4;
      
      let endX, endY;
      switch (direction) {
        case 0:
          endX = lastSquare.x + lastRadius;
          endY = lastSquare.y + lastSquare.size;
          break;
        case 1:
          endX = lastSquare.x;
          endY = lastSquare.y + lastRadius;
          break;
        case 2:
          endX = lastSquare.x + lastSquare.size - lastRadius;
          endY = lastSquare.y;
          break;
        case 3:
          endX = lastSquare.x + lastSquare.size;
          endY = lastSquare.y + lastSquare.size - lastRadius;
          break;
        default:
          endX = lastSquare.x + lastRadius;
          endY = lastSquare.y + lastSquare.size;
      }
      
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(endX, endY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "18px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Golden Ratio & Fibonacci Spiral", 20, 30);

    // Fibonacci sequence display
    ctx.font = "12px monospace";
    let infoY = 60;
    const lineHeight = 15;

    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Fibonacci Sequence:", 20, infoY);
    infoY += lineHeight;

    // Show sequence with highlighting
    let sequenceText = "";
    fibSequence.slice(0, Math.min(12, fibonacciTerms)).forEach((num, index) => {
      if (index < currentTerm) {
        const color = squares[index]?.color || "#22d3ee";
        ctx.fillStyle = color;
      } else {
        ctx.fillStyle = "#6b7280";
      }
      
      const numStr = num.toString();
      ctx.fillText(numStr, 20 + sequenceText.length * 8, infoY);
      sequenceText += numStr;
      
      if (index < fibSequence.length - 1 && index < 11) {
        ctx.fillStyle = "#9ca3af";
        ctx.fillText(", ", 20 + sequenceText.length * 8, infoY);
        sequenceText += ", ";
      }
    });

    infoY += lineHeight * 2;

    // Golden ratio information
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`Golden Ratio φ = ${PHI.toFixed(6)}`, 20, infoY);
    infoY += lineHeight;

    // Ratio convergence
    if (currentTerm >= 3) {
      const ratio = fibSequence[currentTerm - 1] / fibSequence[currentTerm - 2];
      const error = Math.abs(ratio - PHI);
      ctx.fillStyle = error < 0.01 ? "#22c55e" : "#fbbf24";
      ctx.fillText(`F(${currentTerm})/F(${currentTerm - 1}) = ${ratio.toFixed(6)}`, 20, infoY);
      infoY += lineHeight;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Error from φ: ${error.toFixed(6)}`, 20, infoY);
      infoY += lineHeight;
    }

    infoY += lineHeight;

    // Mathematical properties
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Properties:", 20, infoY);
    infoY += lineHeight;

    const properties = [
      "• F(n) = F(n-1) + F(n-2)",
      "• lim(F(n+1)/F(n)) = φ as n → ∞",
      "• φ = (1 + √5) / 2",
      "• φ² = φ + 1",
      "• 1/φ = φ - 1"
    ];

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    properties.forEach(prop => {
      ctx.fillText(prop, 30, infoY);
      infoY += 13;
    });
  }

  function drawGoldenRectangle() {
    const rectX = width - 250;
    const rectY = 80;
    const rectW = 200;
    const rectH = rectW / PHI;

    // Rectangle background
    ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
    ctx.fillRect(rectX, rectY, rectW, rectH);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.strokeRect(rectX, rectY, rectW, rectH);

    // Golden ratio dimensions
    const smallSide = rectH;
    const largeSide = rectW;

    // Divide into square and smaller golden rectangle
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(rectX + smallSide, rectY);
    ctx.lineTo(rectX + smallSide, rectY + rectH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = "#22c55e";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Golden Rectangle", rectX + rectW/2, rectY - 10);
    
    ctx.font = "10px monospace";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`φ = ${PHI.toFixed(3)}`, rectX + rectW/2, rectY + rectH + 15);
    
    ctx.textAlign = "left";
    ctx.fillText(`a = ${largeSide.toFixed(0)}`, rectX - 15, rectY + rectH/2);
    ctx.fillText(`b = ${smallSide.toFixed(0)}`, rectX + rectW/2, rectY + rectH + 30);
    ctx.fillText("a/b = φ", rectX + 10, rectY + 20);

    // Aspect ratio visualization
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rectX - 5, rectY);
    ctx.lineTo(rectX - 10, rectY);
    ctx.lineTo(rectX - 10, rectY + rectH);
    ctx.lineTo(rectX - 5, rectY + rectH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rectX, rectY + rectH + 5);
    ctx.lineTo(rectX, rectY + rectH + 10);
    ctx.lineTo(rectX + rectW, rectY + rectH + 10);
    ctx.lineTo(rectX + rectW, rectY + rectH + 5);
    ctx.stroke();
  }

  function drawNatureExamples() {
    const examplesX = width - 250;
    const examplesY = 220;

    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(examplesX - 10, examplesY - 10, 240, 160);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(examplesX - 10, examplesY - 10, 240, 160);

    ctx.fillStyle = "#34d399";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Golden Ratio in Nature:", examplesX, examplesY);

    const examples = [
      "🐚 Nautilus shell chambers",
      "🌻 Sunflower seed spirals (21, 34, 55, 89)",
      "🌸 Flower petals (3, 5, 8, 13, 21...)",
      "🍍 Pineapple segments (8, 13)",
      "🌿 Pinecone spirals (5, 8, 13)",
      "🦴 Human body proportions",
      "🎨 Art & architecture",
      "📐 Pentagon geometry"
    ];

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    examples.forEach((example, index) => {
      ctx.fillText(example, examplesX, examplesY + 20 + index * 16);
    });
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawSquares();
    drawSpiral();
    drawInfo();
    drawGoldenRectangle();
    drawNatureExamples();
  }

  function reset() {
    time = 0;
    currentTerm = 0;
    termTimer = 0;
    spiralProgress = 0;
    generateFibonacci();
    generateSquares();
  }

  function getStateDescription(): string {
    if (currentTerm < fibSequence.length) {
      return `Golden ratio spiral: showing ${currentTerm} of ${fibonacciTerms} Fibonacci squares. Current ratio convergence: ${currentTerm >= 2 ? (fibSequence[currentTerm-1] / fibSequence[currentTerm-2]).toFixed(4) : 'N/A'}`;
    } else {
      const finalRatio = fibSequence[fibSequence.length-1] / fibSequence[fibSequence.length-2];
      return `Golden ratio spiral complete. Final ratio: ${finalRatio.toFixed(6)}, φ = ${PHI.toFixed(6)}, error: ${Math.abs(finalRatio - PHI).toFixed(6)}`;
    }
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy: () => {},
    getStateDescription,
    resize: (w: number, h: number) => { width = w; height = h; }
  };
};

export default GoldenRatioSpiral;