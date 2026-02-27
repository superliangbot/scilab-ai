import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const EarthsMagneticFieldFactory: SimulationFactory = () => {
  const config = getSimConfig("earths-magnetic-field")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let fieldStrength = 1.0;      // Relative magnetic field strength
  let solarWindStrength = 1.0;  // Solar wind intensity
  let showAurora = 1;           // Show aurora borealis/australis
  let dipoleTilt = 11.5;        // Magnetic dipole tilt in degrees

  // Earth properties
  const earthRadius = 80;
  const earthX = W * 0.5;
  const earthY = H * 0.5;

  // Magnetic field lines and solar wind
  let fieldLines: Array<Array<{ x: number; y: number; strength: number }>> = [];
  let solarWindParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    charge: number; // +1 for protons, -1 for electrons
    energy: number;
    trapped: boolean;
  }> = [];

  let auroraParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    intensity: number;
    color: string;
    age: number;
  }> = [];

  // Magnetospheric boundaries
  let magnetopause: Array<{ x: number; y: number }> = [];
  let bowShock: Array<{ x: number; y: number }> = [];
  
  function calculateMagneticField(x: number, y: number): { Bx: number; By: number; strength: number } {
    // Relative to Earth's center
    const dx = x - earthX;
    const dy = y - earthY;
    const r = Math.sqrt(dx * dx + dy * dy);
    
    if (r < earthRadius) {
      // Inside Earth - simplified internal field
      return { Bx: 0, By: fieldStrength * 0.5, strength: fieldStrength * 0.5 };
    }
    
    // Magnetic dipole field in 2D (simplified)
    const tiltRad = (dipoleTilt * Math.PI) / 180;
    
    // Dipole moment components (tilted)
    const mx = Math.sin(tiltRad) * fieldStrength;
    const my = Math.cos(tiltRad) * fieldStrength;
    
    // Magnetic field components for dipole
    const r3 = r * r * r;
    const r5 = r3 * r * r;
    
    // Convert to magnetic coordinates
    const dotProduct = dx * mx + dy * my;
    
    const Bx = (3 * dotProduct * dx / r5 - mx / r3) * 1000;
    const By = (3 * dotProduct * dy / r5 - my / r3) * 1000;
    
    const strength = Math.sqrt(Bx * Bx + By * By);
    
    return { Bx, By, strength };
  }

  function generateFieldLines() {
    fieldLines = [];
    
    // Generate field lines starting from various points around Earth
    const numLines = 16;
    
    for (let i = 0; i < numLines; i++) {
      const startAngle = (i / numLines) * Math.PI; // Upper hemisphere
      const startRadius = earthRadius + 5;
      const startX = earthX + startRadius * Math.cos(startAngle);
      const startY = earthY - startRadius * Math.sin(startAngle); // North up
      
      const line: Array<{ x: number; y: number; strength: number }> = [];
      
      let x = startX;
      let y = startY;
      let step = 0;
      const maxSteps = 200;
      const stepSize = 2;
      
      while (step < maxSteps) {
        const field = calculateMagneticField(x, y);
        
        if (field.strength < 0.001) break;
        
        line.push({ x, y, strength: field.strength });
        
        // Follow field direction
        const magnitude = Math.sqrt(field.Bx * field.Bx + field.By * field.By);
        if (magnitude > 0) {
          const dirX = field.Bx / magnitude;
          const dirY = field.By / magnitude;
          
          x += dirX * stepSize;
          y += dirY * stepSize;
        }
        
        // Check if we're too far away or hit Earth
        const distFromEarth = Math.sqrt((x - earthX) ** 2 + (y - earthY) ** 2);
        if (distFromEarth > 400 || distFromEarth < earthRadius) break;
        
        step++;
      }
      
      if (line.length > 5) {
        fieldLines.push(line);
      }
    }
  }

  function generateMagnetosphericBoundaries() {
    magnetopause = [];
    bowShock = [];
    
    // Magnetopause - boundary where solar wind pressure balances magnetic pressure
    const numPoints = 50;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      
      // Day side compressed, night side extended
      let radius;
      if (Math.cos(angle) > 0) {
        // Day side (compressed)
        radius = 180 - 50 * Math.cos(angle) * solarWindStrength;
      } else {
        // Night side (extended magnetotail)
        radius = 280 + 100 * Math.cos(angle);
      }
      
      radius *= fieldStrength; // Scale with field strength
      
      const x = earthX + radius * Math.cos(angle);
      const y = earthY + radius * Math.sin(angle);
      
      magnetopause.push({ x, y });
    }
    
    // Bow shock - formed where solar wind encounters magnetosphere
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI; // Front half only
      
      const radius = 220 + 30 * solarWindStrength;
      const x = earthX + radius * Math.cos(angle - Math.PI);
      const y = earthY + radius * Math.sin(angle - Math.PI);
      
      bowShock.push({ x, y });
    }
  }

  function updateSolarWind(dt: number) {
    // Add new solar wind particles from the left
    if (Math.random() < solarWindStrength * 0.1) {
      solarWindParticles.push({
        x: -20,
        y: earthY + (Math.random() - 0.5) * 400,
        vx: 100 + solarWindStrength * 50,
        vy: (Math.random() - 0.5) * 20,
        charge: Math.random() > 0.1 ? 1 : -1, // Mostly protons, some electrons
        energy: 1 + Math.random() * solarWindStrength,
        trapped: false
      });
    }
    
    // Update existing particles
    for (let i = solarWindParticles.length - 1; i >= 0; i--) {
      const particle = solarWindParticles[i];
      
      // Apply Lorentz force: F = q(v × B)
      const field = calculateMagneticField(particle.x, particle.y);
      const lorentzForceX = particle.charge * particle.vy * field.By * 0.001;
      const lorentzForceY = -particle.charge * particle.vx * field.Bx * 0.001;
      
      particle.vx += lorentzForceX * dt;
      particle.vy += lorentzForceY * dt;
      
      // Update position
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      
      // Check if particle is trapped in radiation belt
      const distFromEarth = Math.sqrt((particle.x - earthX) ** 2 + (particle.y - earthY) ** 2);
      if (distFromEarth > earthRadius * 1.5 && distFromEarth < earthRadius * 4 && field.strength > 0.1) {
        particle.trapped = true;
        // Reduce velocity for trapped particles
        particle.vx *= 0.95;
        particle.vy *= 0.95;
      }
      
      // Generate aurora when energetic particles hit upper atmosphere
      if (distFromEarth < earthRadius * 1.2 && distFromEarth > earthRadius && particle.energy > 0.5) {
        if (showAurora && Math.random() < 0.3) {
          const auroraIntensity = particle.energy * field.strength;
          const color = particle.charge > 0 ? '#00ff88' : '#ff4488'; // Green for protons, red for electrons
          
          auroraParticles.push({
            x: particle.x,
            y: particle.y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            intensity: auroraIntensity,
            color: color,
            age: 0
          });
        }
        
        // Particle absorbed by atmosphere
        solarWindParticles.splice(i, 1);
        continue;
      }
      
      // Remove particles that are too far away
      if (particle.x > W + 50 || particle.y < -50 || particle.y > H + 50) {
        solarWindParticles.splice(i, 1);
      }
    }
  }

  function updateAurora(dt: number) {
    for (let i = auroraParticles.length - 1; i >= 0; i--) {
      const aurora = auroraParticles[i];
      aurora.age += dt;
      
      // Update position with some random motion
      aurora.x += aurora.vx * dt;
      aurora.y += aurora.vy * dt;
      
      // Fade out over time
      aurora.intensity = Math.max(0, aurora.intensity - dt * 0.5);
      
      // Remove old aurora particles
      if (aurora.age > 3 || aurora.intensity <= 0) {
        auroraParticles.splice(i, 1);
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
      generateFieldLines();
      generateMagnetosphericBoundaries();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      fieldStrength = params.fieldStrength ?? fieldStrength;
      solarWindStrength = params.solarWindStrength ?? solarWindStrength;
      showAurora = Math.round(params.showAurora ?? showAurora);
      dipoleTilt = params.dipoleTilt ?? dipoleTilt;

      time += dt;
      
      // Regenerate field geometry if parameters changed significantly
      if (Math.random() < 0.1) { // Occasional refresh
        generateFieldLines();
        generateMagnetosphericBoundaries();
      }
      
      updateSolarWind(dt);
      updateAurora(dt);
    },

    render() {
      // Background (space)
      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, "#0a0a1f");
      gradient.addColorStop(0.5, "#1a1a3a");
      gradient.addColorStop(1, "#0a0a1f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      for (let i = 0; i < 50; i++) {
        const x = (i * 37) % W;
        const y = (i * 41) % H;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Title
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Earth's Magnetic Field", W / 2, 30);

      // Solar wind direction indicator
      ctx.font = "12px Arial";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "left";
      ctx.fillText("Solar Wind →", 20, 60);

      // Draw bow shock
      if (bowShock.length > 0) {
        ctx.strokeStyle = "rgba(255, 100, 100, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < bowShock.length; i++) {
          const point = bowShock[i];
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        
        ctx.font = "10px Arial";
        ctx.fillStyle = "#ff6464";
        ctx.textAlign = "center";
        ctx.fillText("Bow Shock", bowShock[bowShock.length / 2].x - 50, bowShock[bowShock.length / 2].y - 10);
      }

      // Draw magnetopause
      if (magnetopause.length > 0) {
        ctx.strokeStyle = "rgba(100, 255, 100, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < magnetopause.length; i++) {
          const point = magnetopause[i];
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.font = "10px Arial";
        ctx.fillStyle = "#64ff64";
        ctx.textAlign = "center";
        ctx.fillText("Magnetopause", magnetopause[0].x + 30, magnetopause[0].y);
      }

      // Draw magnetic field lines
      for (const line of fieldLines) {
        if (line.length < 2) continue;
        
        ctx.strokeStyle = `rgba(100, 150, 255, ${0.3 + fieldStrength * 0.4})`;
        ctx.lineWidth = 1 + fieldStrength;
        ctx.beginPath();
        
        for (let i = 0; i < line.length; i++) {
          const point = line[i];
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        
        // Draw field direction arrows
        if (line.length > 10) {
          const midIndex = Math.floor(line.length / 2);
          const p1 = line[midIndex];
          const p2 = line[midIndex + 1];
          
          if (p2) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const angle = Math.atan2(dy, dx);
            
            ctx.strokeStyle = `rgba(150, 200, 255, ${0.5 + fieldStrength * 0.3})`;
            ctx.lineWidth = 2;
            
            // Arrowhead
            const arrowLength = 8;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p1.x - arrowLength * Math.cos(angle - 0.3), p1.y - arrowLength * Math.sin(angle - 0.3));
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p1.x - arrowLength * Math.cos(angle + 0.3), p1.y - arrowLength * Math.sin(angle + 0.3));
            ctx.stroke();
          }
        }
      }

      // Draw solar wind particles
      for (const particle of solarWindParticles) {
        const alpha = particle.trapped ? 1.0 : 0.7;
        const color = particle.charge > 0 ? `rgba(255, 100, 100, ${alpha})` : `rgba(100, 100, 255, ${alpha})`;
        const radius = particle.trapped ? 3 : 2;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Particle trail for trapped particles
        if (particle.trapped) {
          ctx.strokeStyle = color.replace(/[\d.]+\)/, '0.3)');
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(particle.x - particle.vx * 0.1, particle.y - particle.vy * 0.1);
          ctx.stroke();
        }
      }

      // Draw aurora
      for (const aurora of auroraParticles) {
        const alpha = aurora.intensity * 0.8;
        ctx.fillStyle = aurora.color.replace(')', `, ${alpha})`);
        
        // Aurora glow effect
        const glowGradient = ctx.createRadialGradient(aurora.x, aurora.y, 0, aurora.x, aurora.y, 15);
        glowGradient.addColorStop(0, aurora.color.replace(')', `, ${alpha})`));
        glowGradient.addColorStop(1, aurora.color.replace(')', ', 0)'));
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(aurora.x, aurora.y, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Earth
      const earthGradient = ctx.createRadialGradient(earthX - 20, earthY - 20, 0, earthX, earthY, earthRadius);
      earthGradient.addColorStop(0, "#4ade80");
      earthGradient.addColorStop(0.4, "#22c55e");
      earthGradient.addColorStop(0.7, "#16a34a");
      earthGradient.addColorStop(1, "#15803d");
      
      ctx.fillStyle = earthGradient;
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Earth's magnetic dipole indicator
      const tiltRad = (dipoleTilt * Math.PI) / 180;
      const dipoleLength = 60;
      const dipoleEndX = earthX + dipoleLength * Math.sin(tiltRad);
      const dipoleEndY = earthY - dipoleLength * Math.cos(tiltRad);
      
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(earthX, earthY);
      ctx.lineTo(dipoleEndX, dipoleEndY);
      ctx.stroke();
      
      // Magnetic poles
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(dipoleEndX, dipoleEndY, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#4444ff";
      ctx.beginPath();
      ctx.arc(earthX - dipoleLength * Math.sin(tiltRad), earthY + dipoleLength * Math.cos(tiltRad), 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.font = "10px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText("N", dipoleEndX, dipoleEndY - 8);
      ctx.fillText("S", earthX - dipoleLength * Math.sin(tiltRad), earthY + dipoleLength * Math.cos(tiltRad) + 15);

      // Van Allen radiation belts indication
      ctx.strokeStyle = "rgba(255, 255, 100, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      // Inner belt
      ctx.beginPath();
      ctx.ellipse(earthX, earthY, earthRadius * 2, earthRadius * 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      // Outer belt
      ctx.beginPath();
      ctx.ellipse(earthX, earthY, earthRadius * 3.5, earthRadius * 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Parameters panel
      const paramX = 20;
      const paramY = H - 180;
      const paramW = 250;
      const paramH = 160;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(paramX, paramY, paramW, paramH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(paramX, paramY, paramW, paramH);

      let infoY = paramY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Magnetic Field Properties", paramX + 10, infoY);
      infoY += 25;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Field Strength: ${fieldStrength.toFixed(1)}×`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Solar Wind: ${solarWindStrength.toFixed(1)}×`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Dipole Tilt: ${dipoleTilt.toFixed(1)}°`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Aurora: ${showAurora ? "ON" : "OFF"}`, paramX + 10, infoY);
      infoY += 20;

      ctx.fillStyle = "#10b981";
      ctx.fillText(`Active Particles: ${solarWindParticles.length}`, paramX + 10, infoY);
      infoY += 14;
      const trappedCount = solarWindParticles.filter(p => p.trapped).length;
      ctx.fillText(`Trapped: ${trappedCount}`, paramX + 10, infoY);
      infoY += 14;
      ctx.fillText(`Aurora Events: ${auroraParticles.length}`, paramX + 10, infoY);

      // Legend and physics panel
      const legendX = W - 300;
      const legendY = H - 180;
      const legendW = 280;
      const legendH = 160;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(legendX, legendY, legendW, legendH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, legendW, legendH);

      let legY = legendY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Magnetospheric Physics", legendX + 10, legY);
      legY += 25;

      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      const concepts = [
        "• Dipole field deflects solar wind",
        "• Charged particles follow field lines",
        "• Van Allen belts trap radiation",
        "• Aurora from particle precipitation",
        "• Magnetopause: pressure balance",
        "• Bow shock: supersonic deceleration",
        "• Magnetic reconnection drives storms"
      ];
      
      concepts.forEach((concept, i) => {
        ctx.fillText(concept, legendX + 10, legY);
        legY += 14;
      });

      // Legend for particle types
      legY += 10;
      ctx.font = "11px Arial";
      ctx.fillStyle = "#ff6464";
      ctx.fillText("● Protons (H+)", legendX + 10, legY);
      legY += 14;
      ctx.fillStyle = "#6464ff";
      ctx.fillText("● Electrons (e-)", legendX + 10, legY);
      legY += 14;
      ctx.fillStyle = "#64ff64";
      ctx.fillText("— Magnetosphere boundary", legendX + 10, legY);

      // Current magnetic field strength at Earth's surface
      const surfaceField = calculateMagneticField(earthX, earthY + earthRadius);
      ctx.font = "11px Arial";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "left";
      ctx.fillText(`Surface field: ${(surfaceField.strength * 50000).toFixed(0)} nT`, 20, H - 10);
    },

    reset() {
      time = 0;
      solarWindParticles = [];
      auroraParticles = [];
      generateFieldLines();
      generateMagnetosphericBoundaries();
    },

    destroy() {
      solarWindParticles = [];
      auroraParticles = [];
      fieldLines = [];
      magnetopause = [];
      bowShock = [];
    },

    getStateDescription(): string {
      const trappedParticles = solarWindParticles.filter(p => p.trapped).length;
      const surfaceField = calculateMagneticField(earthX, earthY + earthRadius);
      
      return (
        `Earth's magnetic field simulation: Dipole field strength ${fieldStrength.toFixed(1)}× with ` +
        `${dipoleTilt.toFixed(1)}° tilt. Solar wind intensity ${solarWindStrength.toFixed(1)}×. ` +
        `Currently tracking ${solarWindParticles.length} charged particles, ` +
        `${trappedParticles} trapped in Van Allen radiation belts. ` +
        `${auroraParticles.length} active aurora events ${showAurora ? 'visible' : 'disabled'}. ` +
        `Surface magnetic field strength: ${(surfaceField.strength * 50000).toFixed(0)} nanotesla. ` +
        `Magnetosphere shows bow shock, magnetopause boundary, and particle deflection. ` +
        `Demonstrates how Earth's magnetic field protects from harmful solar radiation.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default EarthsMagneticFieldFactory;