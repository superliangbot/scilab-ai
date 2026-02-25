import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Coupled Oscillators
 * Two masses connected by springs showing normal modes
 * In-phase mode: both oscillate together
 * Out-of-phase mode: oscillate in opposition
 * Beat frequency = |f₁ - f₂| when weakly coupled
 */

const CoupledOscillatorsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("coupled-oscillators") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // System parameters
  let mass1 = 1; // kg
  let mass2 = 1; // kg
  let springConstant1 = 50; // N/m (left spring)
  let springConstant2 = 50; // N/m (right spring)
  let couplingConstant = 10; // N/m (coupling spring)
  let damping = 0.02;
  let initialDisplacement1 = 50; // pixels
  let initialDisplacement2 = 0; // pixels

  // Oscillator state
  let x1 = 0, v1 = 0; // Position and velocity of mass 1
  let x2 = 0, v2 = 0; // Position and velocity of mass 2

  // Fixed positions
  const EQUILIBRIUM_Y = 250;
  const MASS1_EQ_X = 200;
  const MASS2_EQ_X = 500;
  const SPRING_LENGTH = 100;

  // History for plotting
  const history1: number[] = [];
  const history2: number[] = [];
  const timeHistory: number[] = [];
  const energyHistory: number[] = [];

  function calculateNaturalFrequencies() {
    const m1 = mass1, m2 = mass2;
    const k1 = springConstant1, k2 = springConstant2, kc = couplingConstant;
    
    // Normal mode frequencies for coupled oscillators
    const mu = (m1 + m2) / (m1 * m2);
    const sum_k = k1/m1 + k2/m2 + kc*mu;
    const diff_k = Math.sqrt((k1/m1 - k2/m2)**2 + 4*kc*kc*mu*mu);
    
    const omega1_sq = (sum_k - diff_k) / 2;
    const omega2_sq = (sum_k + diff_k) / 2;
    
    return {
      f1: Math.sqrt(omega1_sq) / (2 * Math.PI),
      f2: Math.sqrt(omega2_sq) / (2 * Math.PI),
      omega1: Math.sqrt(omega1_sq),
      omega2: Math.sqrt(omega2_sq)
    };
  }

  function calculateTotalEnergy() {
    // Kinetic energy
    const KE = 0.5 * mass1 * v1 * v1 + 0.5 * mass2 * v2 * v2;
    
    // Potential energy
    const PE1 = 0.5 * springConstant1 * x1 * x1 / 10000; // Convert from pixels²
    const PE2 = 0.5 * springConstant2 * x2 * x2 / 10000;
    const PEc = 0.5 * couplingConstant * (x2 - x1) * (x2 - x1) / 10000; // Coupling spring
    
    return (KE + PE1 + PE2 + PEc) / 1000; // Scale for display
  }

  function updateOscillators(dt: number) {
    // Forces on each mass
    // Mass 1: F1 = -k1*x1 + kc*(x2-x1) - damping*v1
    const F1 = -springConstant1 * x1/100 + couplingConstant * (x2-x1)/100 - damping * v1 * mass1;
    
    // Mass 2: F2 = -k2*x2 + kc*(x1-x2) - damping*v2
    const F2 = -springConstant2 * x2/100 + couplingConstant * (x1-x2)/100 - damping * v2 * mass2;
    
    // Update velocities (F = ma)
    v1 += (F1 / mass1) * dt * 100;
    v2 += (F2 / mass2) * dt * 100;
    
    // Update positions
    x1 += v1 * dt;
    x2 += v2 * dt;
    
    // Limit oscillations to reasonable range
    x1 = Math.max(-150, Math.min(150, x1));
    x2 = Math.max(-150, Math.min(150, x2));
  }

  function drawSprings() {
    const y = EQUILIBRIUM_Y;
    
    // Left wall
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, y - 50);
    ctx.lineTo(50, y + 50);
    ctx.stroke();
    
    // Right wall
    ctx.beginPath();
    ctx.moveTo(650, y - 50);
    ctx.lineTo(650, y + 50);
    ctx.stroke();
    
    // Springs
    const drawSpring = (x1: number, x2: number, compressed: number) => {
      const springLength = x2 - x1;
      const coils = 8;
      const amplitude = 10;
      
      ctx.strokeStyle = compressed > 0 ? "#ef4444" : compressed < 0 ? "#3b82f6" : "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i <= coils * 4; i++) {
        const t = i / (coils * 4);
        const x = x1 + t * springLength;
        const yOffset = amplitude * Math.sin(i * Math.PI / 2) * (1 - Math.abs(compressed) / 100);
        
        if (i === 0) {
          ctx.moveTo(x, y + yOffset);
        } else {
          ctx.lineTo(x, y + yOffset);
        }
      }
      ctx.stroke();
    };
    
    // Left spring (wall to mass1)
    drawSpring(50, MASS1_EQ_X + x1, x1);
    
    // Coupling spring (mass1 to mass2)
    drawSpring(MASS1_EQ_X + x1 + 20, MASS2_EQ_X + x2 - 20, x2 - x1);
    
    // Right spring (mass2 to wall)
    drawSpring(MASS2_EQ_X + x2, 650, -x2);
  }

  function drawMasses() {
    const mass1X = MASS1_EQ_X + x1;
    const mass2X = MASS2_EQ_X + x2;
    const y = EQUILIBRIUM_Y;
    
    // Mass 1
    const mass1Size = 15 + mass1 * 5;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(mass1X, y, mass1Size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Mass 1 label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`m₁=${mass1}kg`, mass1X, y - mass1Size - 10);
    
    // Mass 2
    const mass2Size = 15 + mass2 * 5;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(mass2X, y, mass2Size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Mass 2 label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`m₂=${mass2}kg`, mass2X, y - mass2Size - 10);
    
    // Velocity vectors
    if (Math.abs(v1) > 5) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mass1X, y + mass1Size + 10);
      ctx.lineTo(mass1X + v1 * 0.5, y + mass1Size + 10);
      ctx.stroke();
      
      // Arrow
      const arrowX = mass1X + v1 * 0.5;
      const dir1 = v1 > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(arrowX, y + mass1Size + 10);
      ctx.lineTo(arrowX - dir1 * 8, y + mass1Size + 5);
      ctx.lineTo(arrowX - dir1 * 8, y + mass1Size + 15);
      ctx.closePath();
      ctx.fill();
    }
    
    if (Math.abs(v2) > 5) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mass2X, y + mass2Size + 10);
      ctx.lineTo(mass2X + v2 * 0.5, y + mass2Size + 10);
      ctx.stroke();
      
      // Arrow
      const arrowX = mass2X + v2 * 0.5;
      const dir2 = v2 > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(arrowX, y + mass2Size + 10);
      ctx.lineTo(arrowX - dir2 * 8, y + mass2Size + 5);
      ctx.lineTo(arrowX - dir2 * 8, y + mass2Size + 15);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPhaseGraph() {
    if (history1.length < 2) return;
    
    const graphX = width - 300;
    const graphY = 50;
    const graphWidth = 250;
    const graphHeight = 150;
    
    // Graph background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(graphX, graphY, graphWidth, graphHeight);
    
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);
    
    // Plot oscillations
    const maxDisp = 100;
    
    // Mass 1 history
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    history1.forEach((pos, i) => {
      const x = graphX + (i / (history1.length - 1)) * graphWidth;
      const y = graphY + graphHeight/2 - (pos / maxDisp) * (graphHeight/4);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Mass 2 history
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    history2.forEach((pos, i) => {
      const x = graphX + (i / (history2.length - 1)) * graphWidth;
      const y = graphY + graphHeight/2 + graphHeight/4 - (pos / maxDisp) * (graphHeight/4);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Zero lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphHeight/2 - graphHeight/8);
    ctx.lineTo(graphX + graphWidth, graphY + graphHeight/2 - graphHeight/8);
    ctx.moveTo(graphX, graphY + graphHeight/2 + graphHeight/8);
    ctx.lineTo(graphX + graphWidth, graphY + graphHeight/2 + graphHeight/8);
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Position vs Time", graphX + 10, graphY - 5);
    
    ctx.fillStyle = "#ef4444";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("m₁", graphX + 10, graphY + 15);
    
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("m₂", graphX + 10, graphY + graphHeight - 10);
  }

  function drawNormalModes() {
    const modes = calculateNaturalFrequencies();
    
    // Info about normal modes
    const infoX = width - 300;
    const infoY = 220;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(infoX, infoY, 250, 120);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText("Normal Modes", infoX + 10, infoY + 20);
    
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText(`In-phase: f₁ = ${modes.f1.toFixed(2)} Hz`, infoX + 10, infoY + 45);
    
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`Out-of-phase: f₂ = ${modes.f2.toFixed(2)} Hz`, infoX + 10, infoY + 70);
    
    const beatFreq = Math.abs(modes.f2 - modes.f1);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Beat frequency: ${beatFreq.toFixed(3)} Hz`, infoX + 10, infoY + 95);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    
    x1 = initialDisplacement1;
    x2 = initialDisplacement2;
    v1 = 0;
    v2 = 0;
    
    history1.length = 0;
    history2.length = 0;
    timeHistory.length = 0;
    energyHistory.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    mass1 = params.mass1 ?? 1;
    mass2 = params.mass2 ?? 1;
    springConstant1 = params.springConstant1 ?? 50;
    springConstant2 = params.springConstant2 ?? 50;
    couplingConstant = params.couplingConstant ?? 10;
    damping = params.damping ?? 0.02;

    time += dt;
    updateOscillators(dt);

    // Record history
    history1.push(x1);
    history2.push(x2);
    timeHistory.push(time);
    energyHistory.push(calculateTotalEnergy());
    
    // Limit history length
    if (history1.length > 200) {
      history1.shift();
      history2.shift();
      timeHistory.shift();
      energyHistory.shift();
    }
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawSprings();
    drawMasses();
    drawPhaseGraph();
    drawNormalModes();

    const modes = calculateNaturalFrequencies();
    const totalEnergy = calculateTotalEnergy();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 350, 200);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Coupled Oscillators", 20, 30);
    
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Mass 1: m₁ = ${mass1} kg`, 20, 55);
    ctx.fillText(`Mass 2: m₂ = ${mass2} kg`, 20, 75);
    ctx.fillText(`Spring Constants: k₁ = ${springConstant1}, k₂ = ${springConstant2} N/m`, 20, 95);
    ctx.fillText(`Coupling: kc = ${couplingConstant} N/m`, 20, 115);
    ctx.fillText(`Damping: γ = ${damping}`, 20, 135);
    
    ctx.fillStyle = "#10b981";
    ctx.fillText(`Total Energy: E = ${totalEnergy.toFixed(3)} J`, 20, 160);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`x₁ = ${x1.toFixed(1)} px, v₁ = ${v1.toFixed(1)} px/s`, 20, 180);
    ctx.fillText(`x₂ = ${x2.toFixed(1)} px, v₂ = ${v2.toFixed(1)} px/s`, 20, 195);

    // Theory panel
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 300, height - 150, 290, 140);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Coupled Oscillator Theory:", width - 290, height - 125);
    ctx.fillText("• Two normal modes of oscillation", width - 290, height - 105);
    ctx.fillText("• In-phase: masses move together", width - 290, height - 85);
    ctx.fillText("• Out-of-phase: masses oppose", width - 290, height - 65);
    ctx.fillText("• Beat frequency from mode mixing", width - 290, height - 45);
    ctx.fillText("• Energy transfers between masses", width - 290, height - 25);

    // Applications
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Applications: Molecular vibrations, bridge oscillations, electrical circuits", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    x1 = initialDisplacement1;
    x2 = initialDisplacement2;
    v1 = 0;
    v2 = 0;
    history1.length = 0;
    history2.length = 0;
    timeHistory.length = 0;
    energyHistory.length = 0;
  }

  function destroy(): void {
    history1.length = 0;
    history2.length = 0;
    timeHistory.length = 0;
    energyHistory.length = 0;
  }

  function getStateDescription(): string {
    const modes = calculateNaturalFrequencies();
    const totalEnergy = calculateTotalEnergy();
    const beatFreq = Math.abs(modes.f2 - modes.f1);
    
    return (
      `Coupled Oscillators: m₁=${mass1}kg, m₂=${mass2}kg connected by springs k₁=${springConstant1}N/m, k₂=${springConstant2}N/m, kc=${couplingConstant}N/m. ` +
      `Normal modes at f₁=${modes.f1.toFixed(2)}Hz (in-phase), f₂=${modes.f2.toFixed(2)}Hz (out-of-phase). ` +
      `Current positions x₁=${x1.toFixed(1)}px, x₂=${x2.toFixed(1)}px. Beat frequency ${beatFreq.toFixed(3)}Hz. ` +
      `Total energy E=${totalEnergy.toFixed(3)}J. Demonstrates energy transfer between oscillators.`
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

export default CoupledOscillatorsFactory;