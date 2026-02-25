import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const EnzymeKineticsFactory: SimulationFactory = () => {
  const config = getSimConfig("enzyme-kinetics")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let substrateConc = 2.0; // [S] in mM
  let enzymeConc = 0.1; // [E] in mM 
  let km = 1.0; // Michaelis constant in mM
  let vmax = 2.0; // Maximum velocity in mM/s

  // Simulation state
  let molecules: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: 'substrate' | 'enzyme' | 'product' | 'complex';
    radius: number;
    color: string;
    age?: number;
  }> = [];

  let reactionHistory: Array<{ time: number; velocity: number; [S]: number }> = [];
  let currentVelocity = 0;

  function initMolecules() {
    molecules = [];
    
    // Add substrate molecules
    const numSubstrate = Math.round(substrateConc * 30);
    for (let i = 0; i < numSubstrate; i++) {
      molecules.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 100) + 50,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        type: 'substrate',
        radius: 8,
        color: '#3b82f6'
      });
    }

    // Add enzyme molecules
    const numEnzyme = Math.round(enzymeConc * 200);
    for (let i = 0; i < numEnzyme; i++) {
      molecules.push({
        x: Math.random() * (W - 100) + 50,
        y: Math.random() * (H - 100) + 50,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        type: 'enzyme',
        radius: 12,
        color: '#ef4444'
      });
    }

    reactionHistory = [];
  }

  function updateMolecules(dt: number) {
    // Update positions
    for (const mol of molecules) {
      mol.x += mol.vx * dt;
      mol.y += mol.vy * dt;

      // Bounce off walls
      if (mol.x <= mol.radius || mol.x >= W - mol.radius) {
        mol.vx = -mol.vx;
        mol.x = Math.max(mol.radius, Math.min(W - mol.radius, mol.x));
      }
      if (mol.y <= mol.radius || mol.y >= H - mol.radius) {
        mol.vy = -mol.vy;
        mol.y = Math.max(mol.radius, Math.min(H - mol.radius, mol.y));
      }

      // Age enzyme-substrate complexes
      if (mol.type === 'complex') {
        mol.age = (mol.age || 0) + dt;
        // Complex breaks down after ~1 second
        if (mol.age > 1.0) {
          // Convert to product
          mol.type = 'product';
          mol.color = '#10b981';
          mol.radius = 6;
          delete mol.age;
          
          // Create new enzyme at same location
          molecules.push({
            x: mol.x,
            y: mol.y,
            vx: (Math.random() - 0.5) * 40,
            vy: (Math.random() - 0.5) * 40,
            type: 'enzyme',
            radius: 12,
            color: '#ef4444'
          });
        }
      }
    }

    // Check for collisions between enzymes and substrates
    const enzymes = molecules.filter(m => m.type === 'enzyme');
    const substrates = molecules.filter(m => m.type === 'substrate');

    for (const enzyme of enzymes) {
      for (let i = substrates.length - 1; i >= 0; i--) {
        const substrate = substrates[i];
        const dx = enzyme.x - substrate.x;
        const dy = enzyme.y - substrate.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < enzyme.radius + substrate.radius) {
          // Form enzyme-substrate complex
          const complexIndex = molecules.indexOf(enzyme);
          const substrateIndex = molecules.indexOf(substrate);
          
          if (complexIndex >= 0 && substrateIndex >= 0) {
            // Remove substrate
            molecules.splice(substrateIndex, 1);
            
            // Convert enzyme to complex
            enzyme.type = 'complex';
            enzyme.color = '#a855f7';
            enzyme.radius = 15;
            enzyme.age = 0;
            enzyme.vx *= 0.5; // Slower movement
            enzyme.vy *= 0.5;
          }
          break;
        }
      }
    }
  }

  function calculateMichaelisValues() {
    const currentSubstrates = molecules.filter(m => m.type === 'substrate').length;
    const currentS = currentSubstrates / 30; // Convert back to mM
    
    // Michaelis-Menten equation: v = (Vmax * [S]) / (Km + [S])
    currentVelocity = (vmax * currentS) / (km + currentS);
    
    // Store history for graph
    if (reactionHistory.length === 0 || time - reactionHistory[reactionHistory.length - 1].time > 0.1) {
      reactionHistory.push({
        time: time,
        velocity: currentVelocity,
        [Symbol.for('S')]: currentS
      });
      
      // Keep only recent history
      if (reactionHistory.length > 200) {
        reactionHistory.shift();
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
      initMolecules();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newSubstrateConc = params.substrateConc ?? substrateConc;
      const newEnzymeConc = params.enzymeConc ?? enzymeConc;
      const newKm = params.km ?? km;
      const newVmax = params.vmax ?? vmax;

      // Reinitialize if parameters changed significantly
      if (Math.abs(newSubstrateConc - substrateConc) > 0.1 || 
          Math.abs(newEnzymeConc - enzymeConc) > 0.01) {
        substrateConc = newSubstrateConc;
        enzymeConc = newEnzymeConc;
        km = newKm;
        vmax = newVmax;
        initMolecules();
      } else {
        substrateConc = newSubstrateConc;
        enzymeConc = newEnzymeConc;
        km = newKm;
        vmax = newVmax;
      }

      time += dt;
      updateMolecules(dt);
      calculateMichaelisValues();
    },

    render() {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(1, "#1e293b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Enzyme Kinetics: Michaelis-Menten Model", W / 2, 30);

      // Draw molecules
      for (const mol of molecules) {
        // Glow effect
        const gradient = ctx.createRadialGradient(mol.x, mol.y, 0, mol.x, mol.y, mol.radius + 8);
        gradient.addColorStop(0, mol.color + "80");
        gradient.addColorStop(1, mol.color + "00");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(mol.x, mol.y, mol.radius + 8, 0, Math.PI * 2);
        ctx.fill();

        // Main molecule
        ctx.fillStyle = mol.color;
        ctx.beginPath();
        ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Labels for different molecule types
        ctx.font = "bold 10px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (mol.type === 'substrate') ctx.fillText("S", mol.x, mol.y);
        else if (mol.type === 'enzyme') ctx.fillText("E", mol.x, mol.y);
        else if (mol.type === 'complex') ctx.fillText("ES", mol.x, mol.y);
        else if (mol.type === 'product') ctx.fillText("P", mol.x, mol.y);
      }

      // Draw kinetics graph
      const graphX = W - 280;
      const graphY = 60;
      const graphW = 260;
      const graphH = 180;

      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(graphX, graphY, graphW, graphH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(graphX, graphY, graphW, graphH);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("Reaction Velocity vs Time", graphX + graphW / 2, graphY - 5);

      // Plot velocity over time
      if (reactionHistory.length > 1) {
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const maxVel = Math.max(vmax, Math.max(...reactionHistory.map(h => h.velocity)));
        
        for (let i = 0; i < reactionHistory.length; i++) {
          const point = reactionHistory[i];
          const x = graphX + (i / (reactionHistory.length - 1)) * graphW;
          const y = graphY + graphH - (point.velocity / maxVel) * graphH;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Axes labels
      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Time", graphX + graphW / 2, graphY + graphH + 15);
      
      ctx.save();
      ctx.translate(graphX - 15, graphY + graphH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Velocity (mM/s)", 0, 0);
      ctx.restore();

      // Info panel
      const panelX = 20;
      const panelY = H - 160;
      const panelW = 300;
      const panelH = 140;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX, panelY, panelW, panelH);

      let infoY = panelY + 20;
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Michaelis-Menten Parameters", panelX + 10, infoY);
      infoY += 20;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`[S] = ${substrateConc.toFixed(2)} mM`, panelX + 10, infoY);
      ctx.fillText(`[E] = ${enzymeConc.toFixed(2)} mM`, panelX + 160, infoY);
      infoY += 16;
      
      ctx.fillText(`Km = ${km.toFixed(2)} mM`, panelX + 10, infoY);
      ctx.fillText(`Vmax = ${vmax.toFixed(2)} mM/s`, panelX + 160, infoY);
      infoY += 16;

      ctx.fillStyle = "#10b981";
      ctx.fillText(`Current v = ${currentVelocity.toFixed(3)} mM/s`, panelX + 10, infoY);
      infoY += 20;

      // Equation
      ctx.font = "12px Arial";
      ctx.fillStyle = "#f59e0b";
      ctx.fillText("v = (Vmax × [S]) / (Km + [S])", panelX + 10, infoY);

      // Legend
      const legendY = panelY + panelH + 20;
      const items = [
        { color: "#3b82f6", label: "Substrate (S)" },
        { color: "#ef4444", label: "Enzyme (E)" },
        { color: "#a855f7", label: "Complex (ES)" },
        { color: "#10b981", label: "Product (P)" }
      ];

      ctx.font = "11px Arial";
      items.forEach((item, i) => {
        const x = panelX + (i % 2) * 150;
        const y = legendY + Math.floor(i / 2) * 20;
        
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "left";
        ctx.fillText(item.label, x + 12, y + 4);
      });
    },

    reset() {
      time = 0;
      initMolecules();
    },

    destroy() {
      molecules = [];
      reactionHistory = [];
    },

    getStateDescription(): string {
      const numS = molecules.filter(m => m.type === 'substrate').length;
      const numE = molecules.filter(m => m.type === 'enzyme').length;
      const numES = molecules.filter(m => m.type === 'complex').length;
      const numP = molecules.filter(m => m.type === 'product').length;

      return (
        `Enzyme Kinetics simulation showing Michaelis-Menten model. ` +
        `Current state: ${numS} substrate molecules, ${numE} free enzymes, ` +
        `${numES} enzyme-substrate complexes, ${numP} product molecules. ` +
        `Parameters: [S]=${substrateConc.toFixed(2)}mM, [E]=${enzymeConc.toFixed(2)}mM, ` +
        `Km=${km.toFixed(2)}mM, Vmax=${vmax.toFixed(2)}mM/s. ` +
        `Current reaction velocity: ${currentVelocity.toFixed(3)}mM/s. ` +
        `The Michaelis-Menten equation describes enzyme kinetics: v = (Vmax × [S]) / (Km + [S]).`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default EnzymeKineticsFactory;