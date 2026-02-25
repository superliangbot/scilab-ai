import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Nuclear Chain Reaction
 * Shows neutron-induced fission creating more neutrons
 * Critical mass concept: k = 1 (sustained), k < 1 (subcritical), k > 1 (supercritical)
 * Demonstrates exponential growth and nuclear reactor control
 */

const NuclearChainReactionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("nuclear-chain-reaction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let reproductionFactor = 1.2; // k-factor (neutrons produced per neutron absorbed)
  let fissionProbability = 0.3; // Probability of neutron causing fission
  let moderationRate = 0.8; // Control rod effectiveness
  let showControlRods = 1;

  // Particles
  const neutrons: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    energy: string; // "thermal" or "fast"
    age: number;
  }> = [];

  const nuclei: Array<{
    x: number;
    y: number;
    fissioned: boolean;
    type: string; // "U235" or "U238"
  }> = [];

  const fissionProducts: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    type: string;
  }> = [];

  let totalFissions = 0;
  let neutronCount = 0;
  let generationCount = 0;

  const REACTOR_CORE_X = 150;
  const REACTOR_CORE_Y = 100;
  const REACTOR_CORE_WIDTH = 400;
  const REACTOR_CORE_HEIGHT = 300;

  function initializeCore() {
    nuclei.length = 0;
    neutrons.length = 0;
    fissionProducts.length = 0;
    totalFissions = 0;
    neutronCount = 0;
    generationCount = 0;

    // Create fuel nuclei grid
    for (let x = 0; x < 15; x++) {
      for (let y = 0; y < 10; y++) {
        const nucX = REACTOR_CORE_X + 30 + x * 25;
        const nucY = REACTOR_CORE_Y + 30 + y * 25;
        
        nuclei.push({
          x: nucX,
          y: nucY,
          fissioned: false,
          type: Math.random() < 0.7 ? "U235" : "U238" // 70% fissile U-235
        });
      }
    }

    // Start with initial neutrons
    for (let i = 0; i < 5; i++) {
      neutrons.push({
        x: REACTOR_CORE_X + Math.random() * REACTOR_CORE_WIDTH,
        y: REACTOR_CORE_Y + Math.random() * REACTOR_CORE_HEIGHT,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100,
        energy: "thermal",
        age: 0
      });
    }
    neutronCount = neutrons.length;
  }

  function updateNeutrons(dt: number) {
    for (let i = neutrons.length - 1; i >= 0; i--) {
      const neutron = neutrons[i];
      
      // Update position
      neutron.x += neutron.vx * dt;
      neutron.y += neutron.vy * dt;
      neutron.age += dt;
      
      // Boundary reflection
      if (neutron.x <= REACTOR_CORE_X || neutron.x >= REACTOR_CORE_X + REACTOR_CORE_WIDTH) {
        neutron.vx *= -1;
      }
      if (neutron.y <= REACTOR_CORE_Y || neutron.y >= REACTOR_CORE_Y + REACTOR_CORE_HEIGHT) {
        neutron.vy *= -1;
      }
      
      // Keep neutrons in bounds
      neutron.x = Math.max(REACTOR_CORE_X, Math.min(REACTOR_CORE_X + REACTOR_CORE_WIDTH, neutron.x));
      neutron.y = Math.max(REACTOR_CORE_Y, Math.min(REACTOR_CORE_Y + REACTOR_CORE_HEIGHT, neutron.y));
      
      // Check for nucleus interaction
      for (let j = 0; j < nuclei.length; j++) {
        const nucleus = nuclei[j];
        if (nucleus.fissioned) continue;
        
        const dx = neutron.x - nucleus.x;
        const dy = neutron.y - nucleus.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 15 && Math.random() < fissionProbability * dt * 5) {
          // Fission occurs!
          if (nucleus.type === "U235") {
            // Fissile nucleus
            nucleus.fissioned = true;
            totalFissions++;
            
            // Remove absorbed neutron
            neutrons.splice(i, 1);
            
            // Create new neutrons (2-3 per fission)
            const newNeutronCount = 2 + (Math.random() < 0.5 ? 1 : 0);
            
            for (let k = 0; k < newNeutronCount * reproductionFactor * (showControlRods ? moderationRate : 1); k++) {
              neutrons.push({
                x: nucleus.x,
                y: nucleus.y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                energy: "fast",
                age: 0
              });
            }
            
            // Create fission products
            for (let k = 0; k < 2; k++) {
              fissionProducts.push({
                x: nucleus.x,
                y: nucleus.y,
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150,
                age: 0,
                type: Math.random() < 0.5 ? "Ba" : "Kr"
              });
            }
            
            break;
          } else {
            // U-238 absorbs neutron without fission
            neutrons.splice(i, 1);
            break;
          }
        }
      }
      
      // Remove old neutrons (neutron lifetime)
      if (neutron.age > 10) {
        neutrons.splice(i, 1);
      }
    }
    
    neutronCount = neutrons.length;
  }

  function updateFissionProducts(dt: number) {
    for (let i = fissionProducts.length - 1; i >= 0; i--) {
      const product = fissionProducts[i];
      
      product.x += product.vx * dt;
      product.y += product.vy * dt;
      product.age += dt;
      product.vx *= 0.98; // Slow down
      product.vy *= 0.98;
      
      // Remove old products
      if (product.age > 5 || fissionProducts.length > 200) {
        fissionProducts.splice(i, 1);
      }
    }
  }

  function drawReactorCore() {
    // Core boundary
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.strokeRect(REACTOR_CORE_X, REACTOR_CORE_Y, REACTOR_CORE_WIDTH, REACTOR_CORE_HEIGHT);
    
    // Core shielding
    ctx.fillStyle = "rgba(100, 116, 139, 0.1)";
    ctx.fillRect(REACTOR_CORE_X, REACTOR_CORE_Y, REACTOR_CORE_WIDTH, REACTOR_CORE_HEIGHT);
    
    // Control rods (if enabled)
    if (showControlRods) {
      ctx.fillStyle = "rgba(107, 114, 128, 0.8)";
      
      for (let i = 0; i < 5; i++) {
        const rodX = REACTOR_CORE_X + 50 + i * 80;
        ctx.fillRect(rodX, REACTOR_CORE_Y, 10, REACTOR_CORE_HEIGHT);
      }
      
      // Control rod label
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Control Rods", REACTOR_CORE_X + REACTOR_CORE_WIDTH / 2, REACTOR_CORE_Y - 5);
    }
    
    // Core label
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Reactor Core", REACTOR_CORE_X + REACTOR_CORE_WIDTH / 2, REACTOR_CORE_Y + REACTOR_CORE_HEIGHT + 20);
  }

  function drawNuclei() {
    nuclei.forEach(nucleus => {
      if (nucleus.fissioned) {
        // Fissioned nucleus - smaller, darker
        ctx.beginPath();
        ctx.arc(nucleus.x, nucleus.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(107, 114, 128, 0.5)";
        ctx.fill();
      } else {
        // Unfissioned nucleus
        ctx.beginPath();
        ctx.arc(nucleus.x, nucleus.y, 8, 0, Math.PI * 2);
        
        if (nucleus.type === "U235") {
          ctx.fillStyle = "#f59e0b"; // Fissile U-235
        } else {
          ctx.fillStyle = "#6b7280"; // Fertile U-238
        }
        
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  function drawNeutrons() {
    neutrons.forEach(neutron => {
      const size = neutron.energy === "thermal" ? 3 : 5;
      const color = neutron.energy === "thermal" ? "#10b981" : "#ef4444";
      
      ctx.beginPath();
      ctx.arc(neutron.x, neutron.y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Velocity trail
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(neutron.x, neutron.y);
      ctx.lineTo(neutron.x - neutron.vx * 0.1, neutron.y - neutron.vy * 0.1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  function drawFissionProducts() {
    fissionProducts.forEach(product => {
      const alpha = Math.max(0.3, 1 - product.age / 5);
      ctx.globalAlpha = alpha;
      
      ctx.beginPoint();
      ctx.arc(product.x, product.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = product.type === "Ba" ? "#8b5cf6" : "#f97316";
      ctx.fill();
      
      ctx.globalAlpha = 1;
    });
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initializeCore();
  }

  function update(dt: number, params: Record<string, number>): void {
    reproductionFactor = params.reproductionFactor ?? 1.2;
    fissionProbability = params.fissionProbability ?? 0.3;
    moderationRate = params.moderationRate ?? 0.8;
    showControlRods = Math.round(params.showControlRods ?? 1);

    time += dt;
    
    updateNeutrons(dt);
    updateFissionProducts(dt);
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    drawReactorCore();
    drawNuclei();
    drawNeutrons();
    drawFissionProducts();

    const criticality = reproductionFactor * (showControlRods ? moderationRate : 1);
    const criticalityStatus = criticality < 1 ? "Subcritical" : criticality === 1 ? "Critical" : "Supercritical";

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 350, 200);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Nuclear Chain Reaction", 20, 30);
    
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`k-factor: ${criticality.toFixed(2)} (${criticalityStatus})`, 20, 55);
    ctx.fillText(`Active Neutrons: ${neutronCount}`, 20, 75);
    ctx.fillText(`Total Fissions: ${totalFissions}`, 20, 95);
    ctx.fillText(`Fission Probability: ${(fissionProbability * 100).toFixed(1)}%`, 20, 115);
    
    if (showControlRods) {
      ctx.fillStyle = "#6b7280";
      ctx.fillText(`Control Rod Absorption: ${((1 - moderationRate) * 100).toFixed(0)}%`, 20, 135);
    }
    
    // Criticality indicator
    let statusColor = "#10b981";
    if (criticality > 1.1) statusColor = "#ef4444";
    else if (criticality > 1.05) statusColor = "#f59e0b";
    
    ctx.fillStyle = statusColor;
    ctx.fillText(`Status: ${criticalityStatus}`, 20, 160);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("🟡 U-235 (fissile) 🔘 U-238 (fertile)", 20, 180);
    ctx.fillText("🟢 Thermal neutrons 🔴 Fast neutrons", 20, 195);

    // Legend
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 280, 10, 270, 140);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Chain Reaction:", width - 270, 30);
    ctx.fillText("• Neutron hits U-235 → Fission", width - 270, 50);
    ctx.fillText("• Releases 2-3 new neutrons", width - 270, 70);
    ctx.fillText("• k < 1: Reaction dies out", width - 270, 90);
    ctx.fillText("• k = 1: Sustained reaction", width - 270, 110);
    ctx.fillText("• k > 1: Exponential growth", width - 270, 130);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Control rods absorb neutrons to control reaction rate", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    initializeCore();
  }

  function destroy(): void {
    neutrons.length = 0;
    nuclei.length = 0;
    fissionProducts.length = 0;
  }

  function getStateDescription(): string {
    const criticality = reproductionFactor * (showControlRods ? moderationRate : 1);
    const criticalityStatus = criticality < 1 ? "subcritical" : criticality === 1 ? "critical" : "supercritical";
    
    return (
      `Nuclear Chain Reaction: k-factor=${criticality.toFixed(2)} (${criticalityStatus}). ` +
      `${neutronCount} active neutrons, ${totalFissions} total fissions. ` +
      `Fission probability=${(fissionProbability * 100).toFixed(1)}%. ` +
      `${showControlRods ? `Control rods absorbing ${((1 - moderationRate) * 100).toFixed(0)}% neutrons. ` : ''}` +
      `Demonstrates nuclear reactor physics and criticality control.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
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

export default NuclearChainReactionFactory;