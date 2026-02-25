import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface NumberCell {
  number: number;
  isPrime: boolean;
  isComposite: boolean;
  isMarkedBy: number | null;
  animationPhase: number;
  glowIntensity: number;
}

const PrimeSieve: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("prime-sieve") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let maxNumber = 100;
  let animationSpeed = 1;
  let showSteps = 1;
  let currentPrime = 2;

  // Grid state
  let numbers: NumberCell[] = [];
  let sievingPhase = 0; // 0 = setup, 1 = sieving, 2 = complete
  let currentStep = 2;
  let stepTimer = 0;
  let foundPrimes: number[] = [];

  // Visual settings
  const GRID_COLS = 10;
  const CELL_SIZE = 35;
  const GRID_START_X = 50;
  const GRID_START_Y = 80;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initSieve();
  }

  function initSieve() {
    numbers = [];
    foundPrimes = [];
    currentStep = 2;
    sievingPhase = 0;
    stepTimer = 0;
    
    // Initialize all numbers
    for (let i = 1; i <= maxNumber; i++) {
      numbers.push({
        number: i,
        isPrime: i > 1, // Initially assume all numbers > 1 are prime
        isComposite: false,
        isMarkedBy: null,
        animationPhase: 0,
        glowIntensity: 0
      });
    }
    
    // 1 is neither prime nor composite
    if (numbers.length > 0) {
      numbers[0].isPrime = false;
    }
  }

  function update(dt: number, params: Record<string, number>) {
    const oldMaxNumber = maxNumber;
    maxNumber = params.maxNumber ?? maxNumber;
    animationSpeed = params.animationSpeed ?? animationSpeed;
    showSteps = Math.round(params.showSteps ?? showSteps);
    
    if (oldMaxNumber !== maxNumber) {
      initSieve();
    }
    
    time += dt;
    stepTimer += dt * animationSpeed;

    // Update visual effects
    numbers.forEach(cell => {
      cell.animationPhase += dt * 3;
      if (cell.glowIntensity > 0) {
        cell.glowIntensity = Math.max(0, cell.glowIntensity - dt * 2);
      }
    });

    // Sieve algorithm
    if (sievingPhase === 0) {
      // Starting phase
      if (stepTimer > 1) {
        sievingPhase = 1;
        stepTimer = 0;
        highlightCurrentPrime();
      }
    } else if (sievingPhase === 1) {
      // Active sieving
      if (stepTimer > (showSteps ? 1.5 : 0.1)) {
        performSieveStep();
        stepTimer = 0;
      }
    }
  }

  function highlightCurrentPrime() {
    const primeIndex = currentStep - 1;
    if (primeIndex < numbers.length) {
      numbers[primeIndex].glowIntensity = 1.0;
      foundPrimes.push(currentStep);
    }
  }

  function performSieveStep() {
    const currentPrimeIndex = currentStep - 1;
    
    if (currentStep * currentStep > maxNumber) {
      // Sieve complete
      sievingPhase = 2;
      return;
    }
    
    // Mark all multiples of current prime as composite
    let foundMultiples = false;
    for (let multiple = currentStep * currentStep; multiple <= maxNumber; multiple += currentStep) {
      const index = multiple - 1;
      if (index < numbers.length && numbers[index].isPrime) {
        numbers[index].isPrime = false;
        numbers[index].isComposite = true;
        numbers[index].isMarkedBy = currentStep;
        numbers[index].glowIntensity = 0.8;
        foundMultiples = true;
      }
    }
    
    // Move to next prime
    do {
      currentStep++;
    } while (currentStep <= maxNumber && !numbers[currentStep - 1].isPrime);
    
    if (currentStep <= maxNumber) {
      highlightCurrentPrime();
    } else {
      sievingPhase = 2;
    }
  }

  function drawGrid() {
    const rows = Math.ceil(maxNumber / GRID_COLS);
    
    for (let i = 0; i < maxNumber; i++) {
      const row = Math.floor(i / GRID_COLS);
      const col = i % GRID_COLS;
      const x = GRID_START_X + col * (CELL_SIZE + 2);
      const y = GRID_START_Y + row * (CELL_SIZE + 2);
      
      drawNumberCell(numbers[i], x, y);
    }
  }

  function drawNumberCell(cell: NumberCell, x: number, y: number) {
    const centerX = x + CELL_SIZE / 2;
    const centerY = y + CELL_SIZE / 2;
    
    // Cell background
    let bgColor = "#1e293b"; // Default dark
    let borderColor = "#475569";
    
    if (cell.number === 1) {
      bgColor = "#374151";
      borderColor = "#6b7280";
    } else if (cell.isComposite) {
      bgColor = "#7f1d1d"; // Dark red for composites
      borderColor = "#dc2626";
    } else if (cell.isPrime && sievingPhase === 2) {
      bgColor = "#14532d"; // Dark green for confirmed primes
      borderColor = "#22c55e";
    } else if (foundPrimes.includes(cell.number)) {
      bgColor = "#1e40af"; // Blue for current working prime
      borderColor = "#3b82f6";
    }
    
    // Glow effect
    if (cell.glowIntensity > 0) {
      const glowRadius = CELL_SIZE / 2 + cell.glowIntensity * 5;
      const glowAlpha = cell.glowIntensity * 0.3;
      
      const glowColor = cell.isComposite ? "#dc2626" : "#3b82f6";
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(${glowColor.slice(1).match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ')}, ${glowAlpha})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    
    // Cell rectangle
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
    
    // Number text
    ctx.fillStyle = cell.number === 1 ? "#9ca3af" : 
                   cell.isComposite ? "#fca5a5" :
                   cell.isPrime && sievingPhase === 2 ? "#86efac" :
                   foundPrimes.includes(cell.number) ? "#93c5fd" : 
                   "#e2e8f0";
    
    ctx.font = cell.number >= 100 ? "11px monospace" : "13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(cell.number.toString(), centerX, centerY);
    
    // Strikethrough for composites
    if (cell.isComposite) {
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + CELL_SIZE - 4, y + CELL_SIZE - 4);
      ctx.stroke();
    }
    
    // Small marker for what prime marked this as composite
    if (cell.isComposite && cell.isMarkedBy && showSteps) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "8px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(cell.isMarkedBy.toString(), x + CELL_SIZE - 2, y + 2);
    }
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "18px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Sieve of Eratosthenes", 20, 20);
    
    // Current status
    ctx.font = "12px monospace";
    let statusY = 50;
    
    if (sievingPhase === 0) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("Initializing sieve...", 20, statusY);
    } else if (sievingPhase === 1) {
      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`Marking multiples of ${currentPrime}`, 20, statusY);
      statusY += 15;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Checking up to √${maxNumber} = ${Math.floor(Math.sqrt(maxNumber))}`, 20, statusY);
    } else {
      ctx.fillStyle = "#22c55e";
      ctx.fillText("Sieve complete!", 20, statusY);
      statusY += 15;
      
      const primeCount = numbers.filter(n => n.isPrime).length;
      ctx.fillStyle = "#34d399";
      ctx.fillText(`Found ${primeCount} primes up to ${maxNumber}`, 20, statusY);
    }
  }

  function drawLegend() {
    const legendX = width - 200;
    const legendY = 80;
    const legendItemHeight = 25;
    
    // Legend background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(legendX - 10, legendY - 10, 180, 140);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 10, legendY - 10, 180, 140);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Legend:", legendX, legendY);
    
    const legendItems = [
      { color: "#6b7280", text: "1 (neither prime nor composite)", bg: "#374151" },
      { color: "#93c5fd", text: "Current prime", bg: "#1e40af" },
      { color: "#fca5a5", text: "Composite (marked out)", bg: "#7f1d1d" },
      { color: "#86efac", text: "Prime (confirmed)", bg: "#14532d" }
    ];
    
    legendItems.forEach((item, index) => {
      const itemY = legendY + 20 + index * legendItemHeight;
      
      // Color sample
      ctx.fillStyle = item.bg;
      ctx.fillRect(legendX, itemY, 15, 15);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, itemY, 15, 15);
      
      // Text
      ctx.fillStyle = item.color;
      ctx.font = "10px monospace";
      ctx.fillText(item.text, legendX + 20, itemY + 10);
    });
  }

  function drawAlgorithmSteps() {
    const stepsX = width - 200;
    const stepsY = 250;
    
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(stepsX - 10, stepsY - 10, 180, 200);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(stepsX - 10, stepsY - 10, 180, 200);
    
    ctx.fillStyle = "#22d3ee";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Algorithm:", stepsX, stepsY);
    
    const steps = [
      "1. List all numbers 2 to N",
      "2. Start with p = 2",
      "3. Mark multiples of p",
      "   (starting from p²)",
      "4. Find next unmarked",
      "   number > p",
      "5. Repeat until p² > N",
      "6. Remaining numbers",
      "   are prime"
    ];
    
    steps.forEach((step, index) => {
      const stepY = stepsY + 20 + index * 16;
      
      // Highlight current step
      let color = "#94a3b8";
      if (sievingPhase === 1) {
        if (index === 2 || index === 3) color = "#fbbf24"; // Marking multiples
        else if (index === 4) color = "#3b82f6"; // Finding next
      } else if (sievingPhase === 2) {
        if (index === 7 || index === 8) color = "#22c55e"; // Complete
      }
      
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      ctx.fillText(step, stepsX, stepY);
    });
  }

  function drawPrimeList() {
    if (sievingPhase !== 2) return;
    
    const primes = numbers.filter(n => n.isPrime).map(n => n.number);
    const listY = height - 60;
    
    ctx.fillStyle = "#22c55e";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Primes up to ${maxNumber}:`, 20, listY);
    
    // Display primes in rows
    const primesPerRow = Math.floor((width - 40) / 35);
    ctx.fillStyle = "#86efac";
    ctx.font = "11px monospace";
    
    let primeText = "";
    primes.forEach((prime, index) => {
      if (index > 0 && index % primesPerRow === 0) {
        ctx.fillText(primeText, 20, listY + 15 + Math.floor(index / primesPerRow - 1) * 15);
        primeText = "";
      }
      primeText += prime.toString().padStart(4, " ");
    });
    
    // Draw remaining primes
    if (primeText) {
      const row = Math.floor(primes.length / primesPerRow);
      ctx.fillText(primeText, 20, listY + 15 + row * 15);
    }
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    
    drawInfo();
    drawGrid();
    drawLegend();
    drawAlgorithmSteps();
    drawPrimeList();
  }

  function reset() {
    time = 0;
    initSieve();
  }

  function getStateDescription(): string {
    const phase = sievingPhase === 0 ? "initializing" : 
                 sievingPhase === 1 ? "sieving" : "complete";
    const primeCount = numbers.filter(n => n.isPrime).length;
    
    if (sievingPhase === 1) {
      return `Sieve of Eratosthenes: ${phase}, currently marking multiples of ${currentPrime}. Range: 2-${maxNumber}.`;
    } else if (sievingPhase === 2) {
      return `Sieve of Eratosthenes complete. Found ${primeCount} primes up to ${maxNumber}.`;
    } else {
      return `Sieve of Eratosthenes: initializing for range 2-${maxNumber}.`;
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

export default PrimeSieve;