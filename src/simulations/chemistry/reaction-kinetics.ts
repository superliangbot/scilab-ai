import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Molecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "A" | "B" | "C" | "D";
  energy: number;
  radius: number;
  color: string;
}

interface Reaction {
  name: string;
  equation: string;
  rateConstant: number;
  activationEnergy: number; // kJ/mol
  order: number;
  type: "elementary" | "complex";
}

const ReactionKineticsFactory: SimulationFactory = () => {
  const config = getSimConfig("reaction-kinetics") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let temperature = 300; // K
  let reactionType = 0;
  let initialConcentrationA = 2.0; // M
  let initialConcentrationB = 1.0; // M
  let showActivationEnergy = 1;
  let catalyzed = 0;

  // Available reactions
  const reactions: Reaction[] = [
    { name: "First Order", equation: "A → B", rateConstant: 0.1, activationEnergy: 50, order: 1, type: "elementary" },
    { name: "Second Order", equation: "A + B → C", rateConstant: 0.05, activationEnergy: 80, order: 2, type: "elementary" },
    { name: "Zero Order", equation: "A → B", rateConstant: 0.2, activationEnergy: 30, order: 0, type: "elementary" },
    { name: "Enzyme Kinetics", equation: "E + S → ES → E + P", rateConstant: 0.15, activationEnergy: 40, order: 1, type: "complex" },
  ];

  // State
  let molecules: Molecule[] = [];
  let concentrationHistory: { time: number; A: number; B: number; C: number; D: number }[] = [];
  let currentReaction: Reaction;
  let reactionEvents: { x: number; y: number; age: number }[] = [];

  // Constants
  const R = 8.314; // J/(mol⋅K)
  const kB = 1.381e-23; // Boltzmann constant

  function initializeReaction() {
    currentReaction = reactions[reactionType];
    molecules = [];
    concentrationHistory = [];
    reactionEvents = [];
    
    // Create molecules based on initial concentrations
    const totalMolecules = 150;
    const numA = Math.floor(totalMolecules * initialConcentrationA / (initialConcentrationA + initialConcentrationB));
    const numB = totalMolecules - numA;
    
    // Create A molecules
    for (let i = 0; i < numA; i++) {
      molecules.push(createMolecule("A"));
    }
    
    // Create B molecules for second-order reactions
    if (currentReaction.order === 2) {
      for (let i = 0; i < numB; i++) {
        molecules.push(createMolecule("B"));
      }
    }
  }

  function createMolecule(type: "A" | "B" | "C" | "D"): Molecule {
    const colors = { A: "#3b82f6", B: "#ef4444", C: "#10b981", D: "#8b5cf6" };
    const radii = { A: 8, B: 6, C: 7, D: 5 };
    
    // Maxwell-Boltzmann velocity distribution
    const mass = 1; // Simplified
    const avgKE = 1.5 * kB * temperature * 1e23; // Scale for visualization
    const speed = Math.sqrt(2 * avgKE / mass) * (0.5 + Math.random() * 0.5);
    const angle = Math.random() * 2 * Math.PI;
    
    return {
      x: 50 + Math.random() * (W * 0.5 - 100),
      y: 100 + Math.random() * (H - 200),
      vx: Math.cos(angle) * speed * 0.1,
      vy: Math.sin(angle) * speed * 0.1,
      type: type,
      energy: avgKE * (0.8 + Math.random() * 0.4),
      radius: radii[type],
      color: colors[type],
    };
  }

  function updateMolecules(dt: number) {
    // Update positions
    for (const mol of molecules) {
      mol.x += mol.vx * dt;
      mol.y += mol.vy * dt;
      
      // Bounce off walls
      if (mol.x <= mol.radius || mol.x >= W * 0.6 - mol.radius) {
        mol.vx *= -0.9;
        mol.x = Math.max(mol.radius, Math.min(W * 0.6 - mol.radius, mol.x));
      }
      if (mol.y <= mol.radius || mol.y >= H - mol.radius) {
        mol.vy *= -0.9;
        mol.y = Math.max(mol.radius, Math.min(H - mol.radius, mol.y));
      }
    }
    
    // Handle collisions and reactions
    for (let i = 0; i < molecules.length; i++) {
      for (let j = i + 1; j < molecules.length; j++) {
        const mol1 = molecules[i];
        const mol2 = molecules[j];
        
        const dx = mol2.x - mol1.x;
        const dy = mol2.y - mol1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < mol1.radius + mol2.radius) {
          // Collision detected
          handleCollision(mol1, mol2, i, j);
        }
      }
    }
    
    // Spontaneous reactions (first and zero order)
    if (currentReaction.order === 1 || currentReaction.order === 0) {
      for (let i = molecules.length - 1; i >= 0; i--) {
        const mol = molecules[i];
        if (mol.type === "A") {
          const reactionRate = calculateReactionRate();
          const probability = reactionRate * dt * 0.01; // Scale for simulation
          
          if (Math.random() < probability && mol.energy > getActivationEnergy()) {
            // Convert A to B
            mol.type = "B";
            mol.color = "#10b981";
            mol.radius = 6;
            
            // Add reaction event
            reactionEvents.push({ x: mol.x, y: mol.y, age: 0 });
          }
        }
      }
    }
    
    // Update reaction events
    for (let i = reactionEvents.length - 1; i >= 0; i--) {
      const event = reactionEvents[i];
      event.age += dt;
      if (event.age > 1.0) {
        reactionEvents.splice(i, 1);
      }
    }
  }

  function handleCollision(mol1: Molecule, mol2: Molecule, i: number, j: number) {
    // Elastic collision for position correction
    const dx = mol2.x - mol1.x;
    const dy = mol2.y - mol1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const overlap = (mol1.radius + mol2.radius - distance) / 2;
      const moveX = (dx / distance) * overlap;
      const moveY = (dy / distance) * overlap;
      
      mol1.x -= moveX;
      mol1.y -= moveY;
      mol2.x += moveX;
      mol2.y += moveY;
      
      // Velocity exchange (simplified)
      const tempVx = mol1.vx;
      const tempVy = mol1.vy;
      mol1.vx = mol2.vx * 0.9;
      mol1.vy = mol2.vy * 0.9;
      mol2.vx = tempVx * 0.9;
      mol2.vy = tempVy * 0.9;
    }
    
    // Check for reaction (second order: A + B → C)
    if (currentReaction.order === 2) {
      if ((mol1.type === "A" && mol2.type === "B") || (mol1.type === "B" && mol2.type === "A")) {
        const totalEnergy = mol1.energy + mol2.energy;
        const activationEnergy = getActivationEnergy();
        
        if (totalEnergy > activationEnergy) {
          // Reaction occurs
          const reactionRate = calculateReactionRate();
          const probability = Math.min(reactionRate * 0.1, 0.3); // Scale for collision
          
          if (Math.random() < probability) {
            // Convert to product C
            mol1.type = "C";
            mol1.color = "#10b981";
            mol1.radius = 7;
            mol1.energy = totalEnergy - activationEnergy;
            
            // Remove second molecule
            molecules.splice(j, 1);
            
            // Add reaction event
            reactionEvents.push({ x: mol1.x, y: mol1.y, age: 0 });
          }
        }
      }
    }
  }

  function calculateReactionRate(): number {
    const activationEnergy = getActivationEnergy() * 1000; // Convert to J/mol
    const k = currentReaction.rateConstant * Math.exp(-activationEnergy / (R * temperature));
    return k;
  }

  function getActivationEnergy(): number {
    const baseEa = currentReaction.activationEnergy;
    return catalyzed ? baseEa * 0.6 : baseEa; // Catalyst reduces activation energy
  }

  function updateConcentrations() {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    
    for (const mol of molecules) {
      counts[mol.type]++;
    }
    
    const total = molecules.length || 1;
    const concentrations = {
      A: counts.A / total,
      B: counts.B / total,
      C: counts.C / total,
      D: counts.D / total,
    };
    
    if (concentrationHistory.length > 300) concentrationHistory.shift();
    concentrationHistory.push({ time, ...concentrations });
  }

  function drawMolecules() {
    for (const mol of molecules) {
      // Energy-based glow
      const energyFactor = mol.energy / (getActivationEnergy() || 50);
      const glowSize = mol.radius * (1 + energyFactor * 0.3);
      
      // Molecule glow
      const glowGrad = ctx.createRadialGradient(mol.x, mol.y, 0, mol.x, mol.y, glowSize);
      glowGrad.addColorStop(0, mol.color + "60");
      glowGrad.addColorStop(1, mol.color + "00");
      
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, glowSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Molecule body
      const bodyGrad = ctx.createRadialGradient(
        mol.x - mol.radius * 0.3, mol.y - mol.radius * 0.3, 0,
        mol.x, mol.y, mol.radius
      );
      bodyGrad.addColorStop(0, "#ffffff");
      bodyGrad.addColorStop(0.5, mol.color);
      bodyGrad.addColorStop(1, mol.color + "cc");
      
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = mol.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Label
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mol.type, mol.x, mol.y);
    }
    
    // Draw reaction events
    for (const event of reactionEvents) {
      const alpha = 1 - event.age;
      const size = 5 + event.age * 15;
      
      ctx.strokeStyle = `rgba(255, 255, 100, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(event.x, event.y, size, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnergyProfile() {
    if (!showActivationEnergy) return;
    
    const profileX = W * 0.63;
    const profileY = H * 0.1;
    const profileW = W * 0.34;
    const profileH = H * 0.3;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(profileX, profileY, profileW, profileH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(profileX, profileY, profileW, profileH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Energy Profile", profileX + profileW/2, profileY + 15);
    
    const reactantLevel = profileY + profileH * 0.7;
    const productLevel = profileY + profileH * 0.8;
    const activationHeight = profileY + profileH * 0.3;
    const catalyzedHeight = catalyzed ? profileY + profileH * 0.45 : activationHeight;
    
    // Reaction coordinate curve
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const numPoints = 50;
    for (let i = 0; i <= numPoints; i++) {
      const x = profileX + 20 + (i / numPoints) * (profileW - 40);
      let y;
      
      if (i < numPoints * 0.3) {
        // Rising to activation energy
        const progress = i / (numPoints * 0.3);
        y = reactantLevel - (reactantLevel - activationHeight) * progress;
      } else if (i < numPoints * 0.7) {
        // At transition state
        y = activationHeight + Math.sin((i - numPoints * 0.3) / (numPoints * 0.4) * Math.PI) * 5;
      } else {
        // Falling to products
        const progress = (i - numPoints * 0.7) / (numPoints * 0.3);
        y = activationHeight - (activationHeight - productLevel) * progress;
      }
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Catalyzed pathway
    if (catalyzed) {
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      
      for (let i = 0; i <= numPoints; i++) {
        const x = profileX + 20 + (i / numPoints) * (profileW - 40);
        let y;
        
        if (i < numPoints * 0.3) {
          const progress = i / (numPoints * 0.3);
          y = reactantLevel - (reactantLevel - catalyzedHeight) * progress;
        } else if (i < numPoints * 0.7) {
          y = catalyzedHeight + Math.sin((i - numPoints * 0.3) / (numPoints * 0.4) * Math.PI) * 3;
        } else {
          const progress = (i - numPoints * 0.7) / (numPoints * 0.3);
          y = catalyzedHeight - (catalyzedHeight - productLevel) * progress;
        }
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Energy levels
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Reactants
    ctx.beginPath();
    ctx.moveTo(profileX + 20, reactantLevel);
    ctx.lineTo(profileX + profileW * 0.25, reactantLevel);
    ctx.stroke();
    
    // Products
    ctx.beginPath();
    ctx.moveTo(profileX + profileW * 0.75, productLevel);
    ctx.lineTo(profileX + profileW - 20, productLevel);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    // Labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Reactants", profileX + 25, reactantLevel - 5);
    ctx.fillText("Products", profileX + profileW * 0.75 + 5, productLevel - 5);
    
    ctx.fillText(`Ea = ${getActivationEnergy().toFixed(0)} kJ/mol`, profileX + 5, profileY + 30);
    if (catalyzed) {
      ctx.fillStyle = "#10b981";
      ctx.fillText("Catalyzed", profileX + 5, profileY + 45);
    }
  }

  function drawConcentrationGraph() {
    const graphX = W * 0.63;
    const graphY = H * 0.45;
    const graphW = W * 0.34;
    const graphH = H * 0.5;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Concentration vs Time", graphX + graphW/2, graphY + 15);
    
    if (concentrationHistory.length > 1) {
      const maxTime = Math.max(...concentrationHistory.map(h => h.time));
      const minTime = 0;
      const timeRange = maxTime || 1;
      
      const axisX = graphX + 30;
      const axisY = graphY + graphH - 30;
      const plotW = graphW - 60;
      const plotH = graphH - 60;
      
      // Axes
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisX, graphY + 30);
      ctx.lineTo(axisX, axisY);
      ctx.lineTo(axisX + plotW, axisY);
      ctx.stroke();
      
      // Plot concentration curves
      const species = [
        { key: "A" as const, color: "#3b82f6", name: "[A]" },
        { key: "B" as const, color: "#ef4444", name: "[B]" },
        { key: "C" as const, color: "#10b981", name: "[C]" },
      ];
      
      for (const s of species) {
        const maxConc = Math.max(...concentrationHistory.map(h => h[s.key]), 0.1);
        if (maxConc > 0.01) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          
          for (let i = 0; i < concentrationHistory.length; i++) {
            const point = concentrationHistory[i];
            const x = axisX + (point.time / timeRange) * plotW;
            const y = axisY - (point[s.key] / 1) * plotH * 0.8;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      
      // Legend
      let legendY = graphY + 35;
      for (const s of species) {
        ctx.fillStyle = s.color;
        ctx.font = "9px monospace";
        ctx.textAlign = "left";
        ctx.fillText(s.name, graphX + 5, legendY);
        legendY += 14;
      }
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeReaction();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newReactionType = Math.round(Math.max(0, Math.min(3, params.reactionType ?? reactionType)));
      const newTemp = Math.max(250, Math.min(500, params.temperature ?? temperature));
      
      if (newReactionType !== reactionType || Math.abs(newTemp - temperature) > 10) {
        reactionType = newReactionType;
        temperature = newTemp;
        initializeReaction();
        time = 0;
      }
      
      initialConcentrationA = Math.max(0.5, Math.min(5.0, params.concentrationA ?? initialConcentrationA));
      initialConcentrationB = Math.max(0.5, Math.min(5.0, params.concentrationB ?? initialConcentrationB));
      showActivationEnergy = Math.round(params.showActivationEnergy ?? showActivationEnergy);
      catalyzed = Math.round(params.catalyzed ?? catalyzed);
      
      time += dt;
      updateMolecules(dt);
      
      if (Math.floor(time * 10) % 3 === 0) {
        updateConcentrations();
      }
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Reaction vessel
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 80, W * 0.6 - 80, H - 160);
      
      // Title
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Chemical Reaction Kinetics", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${currentReaction.name}: ${currentReaction.equation}`, W / 2, 50);

      // Draw simulation components
      drawMolecules();
      drawEnergyProfile();
      drawConcentrationGraph();

      // Current conditions
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`T = ${temperature}K`, 50, 70);
      ctx.fillText(`k = ${calculateReactionRate().toExponential(2)} s⁻¹`, 150, 70);
      ctx.fillText(`Ea = ${getActivationEnergy().toFixed(0)} kJ/mol`, 280, 70);
      if (catalyzed) {
        ctx.fillStyle = "#10b981";
        ctx.fillText("CATALYZED", 400, 70);
      }

      // Molecule counts
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      for (const mol of molecules) counts[mol.type]++;
      
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`A: ${counts.A}  B: ${counts.B}  C: ${counts.C}`, W * 0.6 - 10, H - 20);
    },

    reset() {
      time = 0;
      initializeReaction();
    },

    destroy() {},

    getStateDescription(): string {
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      for (const mol of molecules) counts[mol.type]++;
      const rate = calculateReactionRate();
      
      return `Reaction kinetics: ${currentReaction.name} (${currentReaction.equation}) at ${temperature}K. ` +
             `Rate constant: ${rate.toExponential(2)} s⁻¹. Activation energy: ${getActivationEnergy().toFixed(0)} kJ/mol. ` +
             `Current concentrations - A: ${counts.A}, B: ${counts.B}, C: ${counts.C}. ` +
             `${catalyzed ? "Catalyzed reaction (lower Ea). " : ""}` +
             `Demonstrates molecular collisions, activation energy, and concentration-time relationships.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default ReactionKineticsFactory;