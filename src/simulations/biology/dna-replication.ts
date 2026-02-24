import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const DNAReplication: SimulationFactory = () => {
  const config = getSimConfig("dna-replication")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Replication parameters
  let replicationSpeed = 2; // base pairs per second
  let showEnzymes = true;
  let showDetails = true;
  let time = 0;

  // DNA structure
  type Base = "A" | "T" | "G" | "C";
  
  interface DNAStrand {
    bases: Base[];
    x: number;
    y: number;
    replicated: boolean[];
    isTemplate: boolean;
  }

  interface ReplicationFork {
    position: number; // position along the DNA
    leadingStrand: Base[];
    laggingStrand: Base[];
    leadingComplete: boolean;
    laggingComplete: boolean;
  }

  // DNA data
  let originalDNA: DNAStrand[] = [];
  let replicationForks: ReplicationFork[] = [];
  let dnaLength = 30;
  let replicationStarted = false;
  let replicationComplete = false;

  // Enzyme positions
  interface Enzyme {
    name: string;
    x: number;
    y: number;
    color: string;
    function: string;
  }

  const enzymes: Enzyme[] = [];

  // Colors
  const BG_COLOR = "#0f172a";
  const DNA_BACKBONE_COLOR = "#6b7280";
  const BASE_COLORS = {
    A: "#ef4444", // red
    T: "#3b82f6", // blue  
    G: "#10b981", // green
    C: "#f59e0b"  // yellow
  };
  const NEW_STRAND_COLOR = "#8b5cf6";
  const HELICASE_COLOR = "#f97316";
  const POLYMERASE_COLOR = "#06b6d4";
  const PRIMASE_COLOR = "#84cc16";
  const LIGASE_COLOR = "#ec4899";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function generateRandomSequence(length: number): Base[] {
    const bases: Base[] = ["A", "T", "G", "C"];
    const sequence: Base[] = [];
    
    for (let i = 0; i < length; i++) {
      sequence.push(bases[Math.floor(Math.random() * bases.length)]);
    }
    
    return sequence;
  }

  function getComplementaryBase(base: Base): Base {
    switch (base) {
      case "A": return "T";
      case "T": return "A";
      case "G": return "C";
      case "C": return "G";
    }
  }

  function initializeDNA() {
    originalDNA = [];
    replicationForks = [];
    enzymes.length = 0;
    replicationStarted = false;
    replicationComplete = false;
    
    // Create original double helix
    const template1Bases = generateRandomSequence(dnaLength);
    const template2Bases = template1Bases.map(getComplementaryBase);
    
    const centerX = width / 2;
    const centerY = height / 2;
    
    originalDNA.push({
      bases: template1Bases,
      x: centerX,
      y: centerY - 20,
      replicated: new Array(dnaLength).fill(false),
      isTemplate: true
    });
    
    originalDNA.push({
      bases: template2Bases,
      x: centerX,
      y: centerY + 20,
      replicated: new Array(dnaLength).fill(false),
      isTemplate: true
    });
  }

  function startReplication() {
    if (replicationStarted) return;
    
    replicationStarted = true;
    
    // Initialize replication fork
    replicationForks.push({
      position: 0,
      leadingStrand: [],
      laggingStrand: [],
      leadingComplete: false,
      laggingComplete: false
    });
    
    // Place enzymes
    if (showEnzymes) {
      enzymes.push({
        name: "Helicase",
        x: width / 2 - 50,
        y: height / 2,
        color: HELICASE_COLOR,
        function: "Unwinds DNA double helix"
      });
      
      enzymes.push({
        name: "Primase",
        x: width / 2 - 30,
        y: height / 2 - 40,
        color: PRIMASE_COLOR,
        function: "Synthesizes RNA primers"
      });
      
      enzymes.push({
        name: "DNA Pol III",
        x: width / 2 - 10,
        y: height / 2 - 30,
        color: POLYMERASE_COLOR,
        function: "Synthesizes new DNA strand"
      });
      
      enzymes.push({
        name: "DNA Ligase",
        x: width / 2 + 20,
        y: height / 2 + 30,
        color: LIGASE_COLOR,
        function: "Joins Okazaki fragments"
      });
    }
  }

  function updateReplication(dt: number) {
    if (!replicationStarted || replicationComplete) return;
    
    for (const fork of replicationForks) {
      const stepsPerSecond = replicationSpeed;
      const stepInterval = 1 / stepsPerSecond;
      
      if (time % stepInterval < dt) {
        // Leading strand replication (continuous)
        if (fork.position < dnaLength && !fork.leadingComplete) {
          const templateBase = originalDNA[0].bases[fork.position];
          const newBase = getComplementaryBase(templateBase);
          fork.leadingStrand.push(newBase);
          originalDNA[0].replicated[fork.position] = true;
          
          if (fork.position === dnaLength - 1) {
            fork.leadingComplete = true;
          }
        }
        
        // Lagging strand replication (discontinuous - Okazaki fragments)
        if (fork.position < dnaLength && !fork.laggingComplete) {
          const templateBase = originalDNA[1].bases[dnaLength - 1 - fork.position];
          const newBase = getComplementaryBase(templateBase);
          fork.laggingStrand.unshift(newBase); // Add to beginning for lagging strand
          originalDNA[1].replicated[dnaLength - 1 - fork.position] = true;
          
          if (fork.position === dnaLength - 1) {
            fork.laggingComplete = true;
          }
        }
        
        fork.position++;
        
        // Update enzyme positions
        if (showEnzymes) {
          const progress = fork.position / dnaLength;
          const baseX = width / 2 - 150 + progress * 300;
          
          for (const enzyme of enzymes) {
            enzyme.x = baseX + Math.sin(time * 2 + enzyme.name.length) * 10;
          }
        }
        
        // Check if replication is complete
        if (fork.leadingComplete && fork.laggingComplete) {
          replicationComplete = true;
        }
      }
    }
  }

  function drawDNAStrand(strand: DNAStrand, newStrand?: Base[], isNew: boolean = false) {
    const baseSpacing = 15;
    const startX = strand.x - (dnaLength * baseSpacing) / 2;
    
    // Draw backbone
    ctx.strokeStyle = isNew ? NEW_STRAND_COLOR : DNA_BACKBONE_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, strand.y);
    ctx.lineTo(startX + dnaLength * baseSpacing, strand.y);
    ctx.stroke();
    
    // Draw bases
    const basesToDraw = newStrand || strand.bases;
    const maxBases = newStrand ? newStrand.length : basesToDraw.length;
    
    for (let i = 0; i < maxBases; i++) {
      const x = startX + i * baseSpacing;
      const base = basesToDraw[i];
      
      // Base circle
      ctx.fillStyle = BASE_COLORS[base];
      ctx.beginPath();
      ctx.arc(x, strand.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Base letter
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(base, x, strand.y);
      
      // Replication progress indicator
      if (!isNew && strand.replicated[i]) {
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, strand.y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawHydrogenBonds() {
    const baseSpacing = 15;
    const centerX = width / 2;
    const startX = centerX - (dnaLength * baseSpacing) / 2;
    
    for (let i = 0; i < dnaLength; i++) {
      const x = startX + i * baseSpacing;
      const base1 = originalDNA[0].bases[i];
      const base2 = originalDNA[1].bases[i];
      
      // Draw hydrogen bonds between complementary bases
      ctx.strokeStyle = "rgba(156, 163, 175, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      
      const bondCount = (base1 === "A" || base1 === "T") ? 2 : 3; // A-T: 2 bonds, G-C: 3 bonds
      
      for (let j = 0; j < bondCount; j++) {
        const offset = bondCount === 2 ? (j === 0 ? -2 : 2) : (j === 0 ? -3 : j === 1 ? 0 : 3);
        ctx.beginPath();
        ctx.moveTo(x + offset, originalDNA[0].y + 8);
        ctx.lineTo(x + offset, originalDNA[1].y - 8);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }
  }

  function drawReplicationFork() {
    if (!replicationStarted) return;
    
    const fork = replicationForks[0];
    if (!fork) return;
    
    const baseSpacing = 15;
    const centerX = width / 2;
    const forkX = centerX - (dnaLength * baseSpacing) / 2 + fork.position * baseSpacing;
    
    // Draw fork opening
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(forkX, height / 2 - 20);
    ctx.lineTo(forkX + 30, height / 2 - 40);
    ctx.moveTo(forkX, height / 2 + 20);
    ctx.lineTo(forkX + 30, height / 2 + 40);
    ctx.stroke();
    
    // Draw new strands
    if (fork.leadingStrand.length > 0) {
      drawDNAStrand({
        bases: fork.leadingStrand,
        x: centerX,
        y: height / 2 - 40,
        replicated: [],
        isTemplate: false
      }, fork.leadingStrand, true);
    }
    
    if (fork.laggingStrand.length > 0) {
      drawDNAStrand({
        bases: fork.laggingStrand,
        x: centerX,
        y: height / 2 + 40,
        replicated: [],
        isTemplate: false
      }, fork.laggingStrand, true);
    }
  }

  function drawEnzymes() {
    if (!showEnzymes) return;
    
    for (const enzyme of enzymes) {
      // Enzyme circle
      ctx.fillStyle = enzyme.color;
      ctx.beginPath();
      ctx.arc(enzyme.x, enzyme.y, 12, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = TEXT_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enzyme.x, enzyme.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      
      // Enzyme name
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(enzyme.name, enzyme.x, enzyme.y - 15);
    }
  }

  function drawReplicationSteps() {
    if (!showDetails) return;
    
    const stepsX = 20;
    const stepsY = 50;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(stepsX - 10, stepsY - 10, 300, lineH * 8 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(stepsX - 10, stepsY - 10, 300, lineH * 8 + 20);
    
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = stepsX;
    let y = stepsY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("DNA Replication Steps:", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    
    const steps = [
      "1. Helicase unwinds double helix",
      "2. Primase synthesizes RNA primers", 
      "3. DNA Polymerase III adds nucleotides",
      "4. Leading strand: continuous synthesis",
      "5. Lagging strand: Okazaki fragments",
      "6. DNA Polymerase I replaces primers",
      "7. DNA Ligase joins fragments"
    ];
    
    for (let i = 0; i < steps.length; i++) {
      const currentStep = Math.floor((replicationForks[0]?.position || 0) / dnaLength * steps.length);
      
      if (i <= currentStep && replicationStarted) {
        ctx.fillStyle = "#22c55e";
      } else {
        ctx.fillStyle = TEXT_DIM;
      }
      
      ctx.fillText(steps[i], x, y);
      y += lineH;
    }
  }

  function drawBasepairing() {
    const pairX = width - 250;
    const pairY = 50;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(pairX - 10, pairY - 10, 240, lineH * 8 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(pairX - 10, pairY - 10, 240, lineH * 8 + 20);
    
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = pairX;
    let y = pairY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Base Pairing Rules:", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    
    // Base pairing examples
    const pairings = [
      { base1: "A", base2: "T", bonds: 2 },
      { base1: "T", base2: "A", bonds: 2 },
      { base1: "G", base2: "C", bonds: 3 },
      { base1: "C", base2: "G", bonds: 3 }
    ];
    
    for (const pair of pairings) {
      // Draw base 1
      ctx.fillStyle = BASE_COLORS[pair.base1];
      ctx.beginPath();
      ctx.arc(x + 15, y + 8, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pair.base1, x + 15, y + 8);
      
      // Draw bonds
      ctx.strokeStyle = TEXT_DIM;
      ctx.lineWidth = 1;
      for (let i = 0; i < pair.bonds; i++) {
        const bondY = y + 5 + i * 2;
        ctx.beginPath();
        ctx.moveTo(x + 25, bondY);
        ctx.lineTo(x + 35, bondY);
        ctx.stroke();
      }
      
      // Draw base 2
      ctx.fillStyle = BASE_COLORS[pair.base2];
      ctx.beginPath();
      ctx.arc(x + 45, y + 8, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pair.base2, x + 45, y + 8);
      
      // Bond count
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${pair.bonds} H-bonds`, x + 60, y + 3);
      
      y += lineH;
    }
  }

  function drawInfoPanel() {
    const panelX = width - 250;
    const panelY = height - 150;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX - 10, panelY - 10, 240, lineH * 6 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX - 10, panelY - 10, 240, lineH * 6 + 20);
    
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX;
    let y = panelY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Replication Status:", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    
    if (!replicationStarted) {
      ctx.fillText("Click to start replication", x, y);
    } else if (replicationComplete) {
      ctx.fillStyle = "#22c55e";
      ctx.fillText("✓ Replication complete!", x, y);
      y += lineH;
      
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText("Two identical DNA molecules formed", x, y);
    } else {
      const fork = replicationForks[0];
      const progress = (fork.position / dnaLength) * 100;
      
      ctx.fillText(`Progress: ${progress.toFixed(0)}%`, x, y);
      y += lineH;
      
      ctx.fillText(`Speed: ${replicationSpeed} bp/s`, x, y);
      y += lineH;
      
      ctx.fillText(`Leading strand: ${fork.leadingStrand.length} bp`, x, y);
      y += lineH;
      
      ctx.fillText(`Lagging strand: ${fork.laggingStrand.length} bp`, x, y);
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      
      initializeDNA();
      
      // Click to start replication
      canvas.addEventListener('click', () => {
        if (!replicationStarted) {
          startReplication();
        } else if (replicationComplete) {
          initializeDNA(); // Reset for new replication
        }
      });
    },

    update(dt: number, params: Record<string, number>) {
      replicationSpeed = params.replicationSpeed ?? replicationSpeed;
      showEnzymes = (params.showEnzymes ?? 1) > 0.5;
      showDetails = (params.showDetails ?? 1) > 0.5;
      
      const newLength = Math.floor(params.dnaLength ?? dnaLength);
      if (newLength !== dnaLength && newLength >= 10 && newLength <= 50) {
        dnaLength = newLength;
        initializeDNA();
      }
      
      time += dt;
      updateReplication(dt);
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw original DNA strands
      drawHydrogenBonds();
      drawDNAStrand(originalDNA[0]);
      drawDNAStrand(originalDNA[1]);
      
      // Draw replication fork and new strands
      drawReplicationFork();
      
      // Draw enzymes
      drawEnzymes();
      
      // Draw information panels
      drawReplicationSteps();
      drawBasepairing();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      initializeDNA();
    },

    destroy() {
      enzymes.length = 0;
      replicationForks.length = 0;
      originalDNA.length = 0;
    },

    getStateDescription(): string {
      if (!replicationStarted) {
        return `DNA Replication: Double helix with ${dnaLength} base pairs ready for replication. ` +
               `Complementary base pairing: A-T (2 H-bonds), G-C (3 H-bonds). ` +
               `Process involves helicase, primase, DNA polymerase, and ligase enzymes. ` +
               `Leading strand synthesized continuously, lagging strand in Okazaki fragments.`;
      }
      
      const fork = replicationForks[0];
      const progress = fork ? (fork.position / dnaLength) * 100 : 0;
      
      if (replicationComplete) {
        return `DNA Replication: Complete! Original ${dnaLength} bp DNA molecule replicated into ` +
               `two identical copies. Semi-conservative replication ensures each new molecule ` +
               `contains one original and one newly synthesized strand. Process involved ` +
               `${fork?.leadingStrand.length || 0} bp leading strand and ` +
               `${fork?.laggingStrand.length || 0} bp lagging strand synthesis.`;
      }
      
      return `DNA Replication: ${progress.toFixed(0)}% complete. Replication fork progressing ` +
             `at ${replicationSpeed} bp/s. Leading strand: ${fork?.leadingStrand.length || 0} bp ` +
             `(continuous), Lagging strand: ${fork?.laggingStrand.length || 0} bp (Okazaki fragments). ` +
             `Enzymes: Helicase unwinds, primase adds primers, DNA polymerase synthesizes, ` +
             `ligase joins fragments.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default DNAReplication;