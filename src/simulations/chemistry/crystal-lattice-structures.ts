import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Atom {
  x: number;
  y: number;
  z: number;
  type: "A" | "B";
  radius: number;
  color: string;
  vibration: { x: number; y: number; z: number };
}

interface LatticeType {
  name: string;
  description: string;
  unitCellParams: { a: number; b: number; c: number; alpha: number; beta: number; gamma: number };
  atomPositions: Array<{ x: number; y: number; z: number; type: "A" | "B" }>;
  coordinationNumber: number;
}

const CrystalLatticeStructuresFactory: SimulationFactory = () => {
  const config = getSimConfig("crystal-lattice-structures") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let latticeType = 0;
  let temperature = 300; // K
  let rotationX = 20;
  let rotationY = 30;
  let showUnitCell = 1;
  let showBonds = 1;

  // Available lattice types
  const latticeTypes: LatticeType[] = [
    {
      name: "Simple Cubic",
      description: "Atoms at cube corners only",
      unitCellParams: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 },
      atomPositions: [
        { x: 0, y: 0, z: 0, type: "A" },
        { x: 1, y: 0, z: 0, type: "A" },
        { x: 0, y: 1, z: 0, type: "A" },
        { x: 0, y: 0, z: 1, type: "A" },
        { x: 1, y: 1, z: 0, type: "A" },
        { x: 1, y: 0, z: 1, type: "A" },
        { x: 0, y: 1, z: 1, type: "A" },
        { x: 1, y: 1, z: 1, type: "A" },
      ],
      coordinationNumber: 6,
    },
    {
      name: "Body-Centered Cubic",
      description: "Atoms at corners + center",
      unitCellParams: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 },
      atomPositions: [
        { x: 0, y: 0, z: 0, type: "A" },
        { x: 1, y: 0, z: 0, type: "A" },
        { x: 0, y: 1, z: 0, type: "A" },
        { x: 0, y: 0, z: 1, type: "A" },
        { x: 1, y: 1, z: 0, type: "A" },
        { x: 1, y: 0, z: 1, type: "A" },
        { x: 0, y: 1, z: 1, type: "A" },
        { x: 1, y: 1, z: 1, type: "A" },
        { x: 0.5, y: 0.5, z: 0.5, type: "A" },
      ],
      coordinationNumber: 8,
    },
    {
      name: "Face-Centered Cubic",
      description: "Atoms at corners + face centers",
      unitCellParams: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 },
      atomPositions: [
        { x: 0, y: 0, z: 0, type: "A" },
        { x: 1, y: 0, z: 0, type: "A" },
        { x: 0, y: 1, z: 0, type: "A" },
        { x: 0, y: 0, z: 1, type: "A" },
        { x: 1, y: 1, z: 0, type: "A" },
        { x: 1, y: 0, z: 1, type: "A" },
        { x: 0, y: 1, z: 1, type: "A" },
        { x: 1, y: 1, z: 1, type: "A" },
        { x: 0.5, y: 0.5, z: 0, type: "A" },
        { x: 0.5, y: 0, z: 0.5, type: "A" },
        { x: 0, y: 0.5, z: 0.5, type: "A" },
        { x: 0.5, y: 0.5, z: 1, type: "A" },
        { x: 0.5, y: 1, z: 0.5, type: "A" },
        { x: 1, y: 0.5, z: 0.5, type: "A" },
      ],
      coordinationNumber: 12,
    },
    {
      name: "Hexagonal Close Packed",
      description: "ABAB stacking sequence",
      unitCellParams: { a: 1, b: 1, c: 1.633, alpha: 90, beta: 90, gamma: 120 },
      atomPositions: [
        { x: 0, y: 0, z: 0, type: "A" },
        { x: 1, y: 0, z: 0, type: "A" },
        { x: 0.5, y: 0.866, z: 0, type: "A" },
        { x: 0.5, y: 0.289, z: 0.5, type: "A" },
        { x: 0, y: 0.577, z: 0.5, type: "A" },
        { x: 1, y: 0.577, z: 0.5, type: "A" },
      ],
      coordinationNumber: 12,
    },
    {
      name: "Sodium Chloride (NaCl)",
      description: "FCC lattice with 2 atom types",
      unitCellParams: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 },
      atomPositions: [
        // Na+ ions (FCC)
        { x: 0, y: 0, z: 0, type: "A" },
        { x: 0.5, y: 0.5, z: 0, type: "A" },
        { x: 0.5, y: 0, z: 0.5, type: "A" },
        { x: 0, y: 0.5, z: 0.5, type: "A" },
        // Cl- ions (FCC, offset)
        { x: 0.5, y: 0, z: 0, type: "B" },
        { x: 0, y: 0.5, z: 0, type: "B" },
        { x: 0, y: 0, z: 0.5, type: "B" },
        { x: 0.5, y: 0.5, z: 0.5, type: "B" },
      ],
      coordinationNumber: 6,
    },
    {
      name: "Diamond",
      description: "Carbon atoms in tetrahedral coordination",
      unitCellParams: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 },
      atomPositions: [
        { x: 0, y: 0, z: 0, type: "A" },
        { x: 0.25, y: 0.25, z: 0.25, type: "A" },
        { x: 0.5, y: 0.5, z: 0, type: "A" },
        { x: 0.75, y: 0.75, z: 0.25, type: "A" },
        { x: 0.5, y: 0, z: 0.5, type: "A" },
        { x: 0.75, y: 0.25, z: 0.75, type: "A" },
        { x: 0, y: 0.5, z: 0.5, type: "A" },
        { x: 0.25, y: 0.75, z: 0.75, type: "A" },
      ],
      coordinationNumber: 4,
    },
  ];

  // Current lattice
  let currentLattice: LatticeType;
  let atoms: Atom[] = [];

  function initializeLattice() {
    currentLattice = latticeTypes[latticeType];
    atoms = [];

    // Generate atoms for display (2x2x2 supercell for better visualization)
    for (let nx = -1; nx <= 2; nx++) {
      for (let ny = -1; ny <= 2; ny++) {
        for (let nz = -1; nz <= 2; nz++) {
          for (const pos of currentLattice.atomPositions) {
            const atom: Atom = {
              x: pos.x + nx,
              y: pos.y + ny,
              z: pos.z + nz,
              type: pos.type,
              radius: pos.type === "A" ? 20 : 15,
              color: pos.type === "A" ? "#3b82f6" : "#ef4444",
              vibration: { x: 0, y: 0, z: 0 },
            };
            atoms.push(atom);
          }
        }
      }
    }
  }

  function updateVibrations(dt: number) {
    const vibrationAmplitude = Math.min(temperature / 1000, 0.1);
    
    for (const atom of atoms) {
      atom.vibration.x = Math.sin(time * 5 + atom.x * 3) * vibrationAmplitude;
      atom.vibration.y = Math.sin(time * 4 + atom.y * 2) * vibrationAmplitude;
      atom.vibration.z = Math.sin(time * 3 + atom.z * 4) * vibrationAmplitude;
    }
  }

  function project3D(x: number, y: number, z: number): { x: number; y: number; depth: number } {
    const scale = 80;
    const centerX = W * 0.4;
    const centerY = H * 0.5;
    
    // Apply rotations
    const cosX = Math.cos(rotationX * Math.PI / 180);
    const sinX = Math.sin(rotationX * Math.PI / 180);
    const cosY = Math.cos(rotationY * Math.PI / 180);
    const sinY = Math.sin(rotationY * Math.PI / 180);
    
    // Rotate around Y axis then X axis
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    
    return {
      x: centerX + x1 * scale,
      y: centerY - y2 * scale,
      depth: z2,
    };
  }

  function drawUnitCellOutline() {
    if (!showUnitCell) return;
    
    const corners = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
      { x: 1, y: 1, z: 1 },
      { x: 0, y: 1, z: 1 },
    ];
    
    const projectedCorners = corners.map(c => project3D(c.x, c.y, c.z));
    
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    // Draw edges
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // bottom face
      [4, 5], [5, 6], [6, 7], [7, 4], // top face
      [0, 4], [1, 5], [2, 6], [3, 7], // vertical edges
    ];
    
    for (const [i, j] of edges) {
      const p1 = projectedCorners[i];
      const p2 = projectedCorners[j];
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
  }

  function drawBonds() {
    if (!showBonds) return;
    
    const bondDistance = 0.8; // Maximum bond distance
    
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    
    // Sort atoms by depth for proper rendering
    const sortedAtoms = [...atoms].sort((a, b) => {
      const pA = project3D(a.x + a.vibration.x, a.y + a.vibration.y, a.z + a.vibration.z);
      const pB = project3D(b.x + b.vibration.x, b.y + b.vibration.y, b.z + b.vibration.z);
      return pB.depth - pA.depth;
    });
    
    for (let i = 0; i < sortedAtoms.length; i++) {
      const atom1 = sortedAtoms[i];
      const p1 = project3D(atom1.x + atom1.vibration.x, atom1.y + atom1.vibration.y, atom1.z + atom1.vibration.z);
      
      for (let j = i + 1; j < sortedAtoms.length; j++) {
        const atom2 = sortedAtoms[j];
        const dx = atom1.x - atom2.x;
        const dy = atom1.y - atom2.y;
        const dz = atom1.z - atom2.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance < bondDistance) {
          const p2 = project3D(atom2.x + atom2.vibration.x, atom2.y + atom2.vibration.y, atom2.z + atom2.vibration.z);
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
  }

  function drawAtoms() {
    // Sort atoms by depth for proper rendering
    const sortedAtoms = [...atoms].sort((a, b) => {
      const pA = project3D(a.x + a.vibration.x, a.y + a.vibration.y, a.z + a.vibration.z);
      const pB = project3D(b.x + b.vibration.x, b.y + b.vibration.y, b.z + b.vibration.z);
      return pB.depth - pA.depth;
    });
    
    for (const atom of sortedAtoms) {
      const projected = project3D(
        atom.x + atom.vibration.x,
        atom.y + atom.vibration.y,
        atom.z + atom.vibration.z
      );
      
      // Depth-based scaling and opacity
      const depthScale = 0.7 + 0.3 * Math.max(0, (projected.depth + 2) / 4);
      const radius = atom.radius * depthScale;
      const alpha = Math.max(0.3, depthScale);
      
      // Atom glow
      const glowGrad = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius * 1.5);
      glowGrad.addColorStop(0, atom.color + Math.floor(alpha * 0.3 * 255).toString(16).padStart(2, '0'));
      glowGrad.addColorStop(1, atom.color + "00");
      
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Atom body
      const bodyGrad = ctx.createRadialGradient(
        projected.x - radius * 0.3, projected.y - radius * 0.3, 0,
        projected.x, projected.y, radius
      );
      bodyGrad.addColorStop(0, "#ffffff");
      bodyGrad.addColorStop(0.3, atom.color);
      bodyGrad.addColorStop(1, atom.color + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
      
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Atom outline
      ctx.strokeStyle = atom.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawInfoPanel() {
    const panelX = W * 0.65;
    const panelY = H * 0.05;
    const panelW = W * 0.32;
    const panelH = H * 0.4;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    let infoY = panelY + 20;
    
    ctx.fillText("Crystal Structure", panelX + 10, infoY);
    infoY += 25;
    
    ctx.fillStyle = "#fbbf24";
    ctx.font = "12px monospace";
    ctx.fillText(currentLattice.name, panelX + 10, infoY);
    infoY += 18;
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    const descLines = currentLattice.description.split(' ');
    let currentLine = "";
    for (const word of descLines) {
      const testLine = currentLine ? currentLine + " " + word : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > panelW - 20 && currentLine) {
        ctx.fillText(currentLine, panelX + 10, infoY);
        infoY += 14;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, panelX + 10, infoY);
      infoY += 18;
    }
    
    ctx.fillStyle = "#22d3ee";
    ctx.font = "11px monospace";
    ctx.fillText("Unit Cell Parameters:", panelX + 10, infoY);
    infoY += 16;
    
    const params = currentLattice.unitCellParams;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText(`a = ${params.a.toFixed(2)}`, panelX + 10, infoY);
    infoY += 14;
    ctx.fillText(`b = ${params.b.toFixed(2)}`, panelX + 10, infoY);
    infoY += 14;
    ctx.fillText(`c = ${params.c.toFixed(2)}`, panelX + 10, infoY);
    infoY += 14;
    ctx.fillText(`α = ${params.alpha}°`, panelX + 10, infoY);
    infoY += 14;
    ctx.fillText(`β = ${params.beta}°`, panelX + 10, infoY);
    infoY += 14;
    ctx.fillText(`γ = ${params.gamma}°`, panelX + 10, infoY);
    infoY += 18;
    
    ctx.fillStyle = "#10b981";
    ctx.font = "11px monospace";
    ctx.fillText(`Coordination Number: ${currentLattice.coordinationNumber}`, panelX + 10, infoY);
    infoY += 18;
    
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText(`Temperature: ${temperature}K`, panelX + 10, infoY);
    infoY += 16;
    
    // Legend
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.fillText("Legend:", panelX + 10, infoY);
    infoY += 16;
    
    // Type A atoms
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(panelX + 20, infoY - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Type A atoms", panelX + 35, infoY);
    infoY += 14;
    
    // Type B atoms (if present)
    const hasTypeB = currentLattice.atomPositions.some(pos => pos.type === "B");
    if (hasTypeB) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(panelX + 20, infoY - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Type B atoms", panelX + 35, infoY);
    }
  }

  function drawControls() {
    const controlsY = H * 0.5;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(W * 0.65, controlsY, W * 0.32, H * 0.45);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(W * 0.65, controlsY, W * 0.32, H * 0.45);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    let y = controlsY + 20;
    
    ctx.fillText("Controls & Properties", W * 0.65 + 10, y);
    y += 25;
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("• Rotation: Use rotationX/rotationY", W * 0.65 + 10, y);
    y += 16;
    ctx.fillText("• Temperature affects vibrations", W * 0.65 + 10, y);
    y += 16;
    ctx.fillText("• Unit cell shows basic repeat unit", W * 0.65 + 10, y);
    y += 16;
    ctx.fillText("• Bonds show nearest neighbors", W * 0.65 + 10, y);
    y += 20;
    
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px monospace";
    ctx.fillText("Crystal Properties:", W * 0.65 + 10, y);
    y += 18;
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    
    // Calculate packing efficiency (simplified)
    let packingEfficiency = 0;
    if (latticeType === 0) packingEfficiency = 52.4; // Simple cubic
    else if (latticeType === 1) packingEfficiency = 68.0; // BCC
    else if (latticeType === 2) packingEfficiency = 74.0; // FCC
    else if (latticeType === 3) packingEfficiency = 74.0; // HCP
    else if (latticeType === 4) packingEfficiency = 64.0; // NaCl
    else if (latticeType === 5) packingEfficiency = 34.0; // Diamond
    
    ctx.fillText(`Packing Efficiency: ${packingEfficiency}%`, W * 0.65 + 10, y);
    y += 16;
    
    const atomsPerUnitCell = currentLattice.atomPositions.length;
    ctx.fillText(`Atoms per unit cell: ${atomsPerUnitCell}`, W * 0.65 + 10, y);
    y += 16;
    
    ctx.fillText(`Coordination #: ${currentLattice.coordinationNumber}`, W * 0.65 + 10, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeLattice();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newLatticeType = Math.round(Math.max(0, Math.min(5, params.latticeType ?? latticeType)));
      if (newLatticeType !== latticeType) {
        latticeType = newLatticeType;
        initializeLattice();
      }
      
      temperature = Math.max(0, Math.min(1000, params.temperature ?? temperature));
      rotationX = params.rotationX ?? rotationX;
      rotationY = params.rotationY ?? rotationY;
      showUnitCell = Math.round(params.showUnitCell ?? showUnitCell);
      showBonds = Math.round(params.showBonds ?? showBonds);
      
      time += dt;
      updateVibrations(dt);
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Crystal Lattice Structures", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("3D visualization of crystalline solids", W / 2, 50);

      // Draw 3D crystal structure
      drawBonds();
      drawUnitCellOutline();
      drawAtoms();
      
      // Information panels
      drawInfoPanel();
      drawControls();
    },

    reset() {
      time = 0;
      initializeLattice();
    },

    destroy() {},

    getStateDescription(): string {
      const packingEfficiencies = [52.4, 68.0, 74.0, 74.0, 64.0, 34.0];
      const packingEff = packingEfficiencies[latticeType];
      
      return `Crystal lattice: ${currentLattice.name}. ${currentLattice.description}. ` +
             `Unit cell parameters: a=${currentLattice.unitCellParams.a}, b=${currentLattice.unitCellParams.b}, c=${currentLattice.unitCellParams.c}. ` +
             `Coordination number: ${currentLattice.coordinationNumber}. Packing efficiency: ${packingEff}%. ` +
             `Temperature: ${temperature}K (affects atomic vibrations). Demonstrates crystalline solid structures and symmetry.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default CrystalLatticeStructuresFactory;