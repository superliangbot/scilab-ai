import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const OceanCurrentsFactory: SimulationFactory = () => {
  const config = getSimConfig("ocean-currents")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let windStrength = 1.0;       // Wind-driven circulation
  let temperatureDiff = 1.0;    // Temperature gradient (thermohaline)
  let coriolisStrength = 1.0;   // Coriolis effect strength
  let showTemperature = 1;      // Show temperature colors

  // Ocean grid for simulation
  const gridW = 80;
  const gridH = 60;
  let velocityField: Float32Array; // u, v components
  let temperatureField: Float32Array;
  let salinityField: Float32Array;
  let pressureField: Float32Array;

  // Tracer particles to visualize flow
  let tracerParticles: Array<{
    x: number;
    y: number;
    age: number;
    temperature: number;
    salinity: number;
    depth: number; // 0 = surface, 1 = deep
  }> = [];

  // Major ocean current systems
  const currentSystems = [
    { name: "Gulf Stream", lat: 40, strength: 1.5, direction: 90 },
    { name: "Kuroshio", lat: 35, strength: 1.3, direction: 45 },
    { name: "Antarctic Circumpolar", lat: -60, strength: 2.0, direction: 90 },
    { name: "California Current", lat: 35, strength: 0.8, direction: 180 },
    { name: "Canary Current", lat: 30, strength: 0.7, direction: 200 }
  ];

  let densityField: Float32Array;
  let circulationCells: Array<{
    centerX: number;
    centerY: number;
    strength: number;
    clockwise: boolean;
    type: 'surface' | 'deep';
  }> = [];

  function initializeOcean() {
    const totalCells = gridW * gridH;
    velocityField = new Float32Array(totalCells * 2); // u, v components
    temperatureField = new Float32Array(totalCells);
    salinityField = new Float32Array(totalCells);
    pressureField = new Float32Array(totalCells);
    densityField = new Float32Array(totalCells);

    // Initialize temperature field (warm equator, cold poles)
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const idx = y * gridW + x;
        
        // Latitude effect (equator at center, poles at top/bottom)
        const lat = (y / gridH - 0.5) * 180; // -90 to +90 degrees
        const baseTemp = 25 - Math.abs(lat) * 0.4; // Warmer near equator
        
        // Add some longitudinal variation (land masses, etc.)
        const lonVariation = Math.sin((x / gridW) * Math.PI * 4) * 3;
        
        temperatureField[idx] = baseTemp + lonVariation;
        
        // Salinity (higher in subtropical gyres, lower near poles and equator)
        const baseSalinity = 34 + Math.cos(lat * Math.PI / 90) * 2;
        salinityField[idx] = Math.max(30, Math.min(37, baseSalinity));
        
        // Calculate density based on temperature and salinity
        densityField[idx] = calculateSeawaterDensity(temperatureField[idx], salinityField[idx]);
      }
    }

    // Initialize circulation cells
    circulationCells = [
      // Northern subtropical gyre
      { centerX: gridW * 0.3, centerY: gridH * 0.25, strength: 1.2, clockwise: true, type: 'surface' },
      { centerX: gridW * 0.7, centerY: gridH * 0.25, strength: 1.0, clockwise: true, type: 'surface' },
      
      // Southern subtropical gyre
      { centerX: gridW * 0.3, centerY: gridH * 0.75, strength: 1.1, clockwise: false, type: 'surface' },
      { centerX: gridW * 0.7, centerY: gridH * 0.75, strength: 0.9, clockwise: false, type: 'surface' },
      
      // Thermohaline circulation (deep water)
      { centerX: gridW * 0.2, centerY: gridH * 0.8, strength: 0.6, clockwise: true, type: 'deep' },
      { centerX: gridW * 0.8, centerY: gridH * 0.2, strength: 0.5, clockwise: false, type: 'deep' }
    ];

    // Initialize tracer particles
    tracerParticles = [];
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * gridW;
      const y = Math.random() * gridH;
      const idx = Math.floor(y) * gridW + Math.floor(x);
      
      tracerParticles.push({
        x: x,
        y: y,
        age: Math.random() * 10,
        temperature: temperatureField[idx] || 15,
        salinity: salinityField[idx] || 35,
        depth: Math.random() > 0.8 ? 1 : 0 // Mostly surface particles
      });
    }
  }

  function calculateSeawaterDensity(temp: number, salinity: number): number {
    // Simplified seawater density equation (UNESCO formula approximation)
    const t = temp;
    const s = salinity;
    
    // Density at standard atmospheric pressure
    const rho0 = 999.842594 + 6.793952e-2 * t - 9.095290e-3 * t * t + 1.001685e-4 * t * t * t;
    const rhoS = rho0 + (0.824493 - 4.0899e-3 * t + 7.6438e-5 * t * t) * s;
    
    return rhoS / 1000; // Convert to relative density
  }

  function updateVelocityField(dt: number) {
    const newVelocityField = new Float32Array(velocityField.length);
    
    for (let y = 1; y < gridH - 1; y++) {
      for (let x = 1; x < gridW - 1; x++) {
        const idx = y * gridW + x;
        const uIdx = idx * 2;
        const vIdx = idx * 2 + 1;
        
        // Current velocity
        let u = velocityField[uIdx];
        let v = velocityField[vIdx];
        
        // Wind stress (simplified)
        const lat = (y / gridH - 0.5) * 180;
        const windU = windStrength * Math.cos(lat * Math.PI / 180) * Math.sin((x / gridW) * Math.PI * 6);
        const windV = windStrength * Math.sin(lat * Math.PI / 90) * 0.3;
        
        // Coriolis force: f = 2Ω sin(φ)
        const f = 2 * coriolisStrength * Math.sin(lat * Math.PI / 180);
        const coriolisU = f * v;
        const coriolisV = -f * u;
        
        // Pressure gradient force (simplified)
        const pressureGradU = -(pressureField[idx + 1] - pressureField[idx - 1]) * 0.01;
        const pressureGradV = -(pressureField[(y + 1) * gridW + x] - pressureField[(y - 1) * gridW + x]) * 0.01;
        
        // Buoyancy force (thermohaline circulation)
        const density = densityField[idx];
        const densityGradV = (densityField[(y + 1) * gridW + x] - densityField[(y - 1) * gridW + x]) * temperatureDiff;
        
        // Add circulation from major current systems
        let systemU = 0, systemV = 0;
        for (const cell of circulationCells) {
          const dx = x - cell.centerX;
          const dy = y - cell.centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxRadius = 15;
          
          if (distance < maxRadius) {
            const strength = cell.strength * (1 - distance / maxRadius);
            const angle = Math.atan2(dy, dx);
            
            if (cell.clockwise) {
              systemU += strength * Math.cos(angle + Math.PI / 2) * 0.1;
              systemV += strength * Math.sin(angle + Math.PI / 2) * 0.1;
            } else {
              systemU += strength * Math.cos(angle - Math.PI / 2) * 0.1;
              systemV += strength * Math.sin(angle - Math.PI / 2) * 0.1;
            }
          }
        }
        
        // Update velocity
        const damping = 0.95;
        newVelocityField[uIdx] = (u + dt * (windU * 0.1 + coriolisU * 0.01 + pressureGradU + systemU)) * damping;
        newVelocityField[vIdx] = (v + dt * (windV * 0.1 + coriolisV * 0.01 + pressureGradV + densityGradV * 0.05 + systemV)) * damping;
        
        // Limit maximum velocity
        const speed = Math.sqrt(newVelocityField[uIdx] * newVelocityField[uIdx] + newVelocityField[vIdx] * newVelocityField[vIdx]);
        if (speed > 2) {
          newVelocityField[uIdx] = (newVelocityField[uIdx] / speed) * 2;
          newVelocityField[vIdx] = (newVelocityField[vIdx] / speed) * 2;
        }
      }
    }
    
    velocityField = newVelocityField;
  }

  function updateTracerParticles(dt: number) {
    for (let i = tracerParticles.length - 1; i >= 0; i--) {
      const particle = tracerParticles[i];
      
      // Get velocity at particle position (bilinear interpolation)
      const gridX = Math.max(0, Math.min(gridW - 1, particle.x));
      const gridY = Math.max(0, Math.min(gridH - 1, particle.y));
      
      const x0 = Math.floor(gridX);
      const y0 = Math.floor(gridY);
      const x1 = Math.min(x0 + 1, gridW - 1);
      const y1 = Math.min(y0 + 1, gridH - 1);
      
      const fx = gridX - x0;
      const fy = gridY - y0;
      
      // Interpolate velocity
      const v00u = velocityField[(y0 * gridW + x0) * 2];
      const v00v = velocityField[(y0 * gridW + x0) * 2 + 1];
      const v01u = velocityField[(y0 * gridW + x1) * 2];
      const v01v = velocityField[(y0 * gridW + x1) * 2 + 1];
      const v10u = velocityField[(y1 * gridW + x0) * 2];
      const v10v = velocityField[(y1 * gridW + x0) * 2 + 1];
      const v11u = velocityField[(y1 * gridW + x1) * 2];
      const v11v = velocityField[(y1 * gridW + x1) * 2 + 1];
      
      const u = v00u * (1 - fx) * (1 - fy) + v01u * fx * (1 - fy) + v10u * (1 - fx) * fy + v11u * fx * fy;
      const v = v00v * (1 - fx) * (1 - fy) + v01v * fx * (1 - fy) + v10v * (1 - fx) * fy + v11v * fx * fy;
      
      // Update particle position
      particle.x += u * dt * 5;
      particle.y += v * dt * 5;
      
      // Wrap around boundaries
      if (particle.x < 0) particle.x = gridW - 1;
      if (particle.x >= gridW) particle.x = 0;
      if (particle.y < 0) particle.y = gridH - 1;
      if (particle.y >= gridH) particle.y = 0;
      
      // Update particle properties based on local conditions
      if (particle.x >= 0 && particle.x < gridW && particle.y >= 0 && particle.y < gridH) {
        const idx = Math.floor(particle.y) * gridW + Math.floor(particle.x);
        particle.temperature = particle.temperature * 0.99 + temperatureField[idx] * 0.01;
        particle.salinity = particle.salinity * 0.99 + salinityField[idx] * 0.01;
      }
      
      // Age particles
      particle.age += dt;
      
      // Remove old particles and create new ones
      if (particle.age > 20) {
        particle.x = Math.random() * gridW;
        particle.y = Math.random() * gridH;
        particle.age = 0;
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
      initializeOcean();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      windStrength = params.windStrength ?? windStrength;
      temperatureDiff = params.temperatureDiff ?? temperatureDiff;
      coriolisStrength = params.coriolisStrength ?? coriolisStrength;
      showTemperature = Math.round(params.showTemperature ?? showTemperature);

      time += dt;
      updateVelocityField(dt);
      updateTracerParticles(dt);
    },

    render() {
      // Background ocean
      ctx.fillStyle = "#1e40af";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Ocean Currents", W / 2, 30);

      const cellW = W / gridW;
      const cellH = H / gridH;

      // Draw temperature field if enabled
      if (showTemperature) {
        for (let y = 0; y < gridH; y++) {
          for (let x = 0; x < gridW; x++) {
            const idx = y * gridW + x;
            const temp = temperatureField[idx];
            
            // Temperature to color mapping
            const normalizedTemp = (temp + 10) / 40; // -10°C to 30°C range
            const hue = 240 - normalizedTemp * 240; // Blue (cold) to Red (warm)
            const saturation = 70;
            const lightness = 30 + normalizedTemp * 40;
            
            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
          }
        }
      }

      // Draw velocity field as arrows
      const arrowSpacing = 8;
      for (let y = 0; y < gridH; y += arrowSpacing) {
        for (let x = 0; x < gridW; x += arrowSpacing) {
          const idx = y * gridW + x;
          const u = velocityField[idx * 2];
          const v = velocityField[idx * 2 + 1];
          
          const magnitude = Math.sqrt(u * u + v * v);
          if (magnitude > 0.1) {
            const centerX = (x + 0.5) * cellW;
            const centerY = (y + 0.5) * cellH;
            
            const arrowLength = Math.min(magnitude * 20, cellW * 2);
            const endX = centerX + u * arrowLength;
            const endY = centerY + v * arrowLength;
            
            // Arrow shaft
            const alpha = Math.min(1, magnitude * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 1 + magnitude;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Arrow head
            if (arrowLength > 5) {
              const angle = Math.atan2(v, u);
              const headLength = Math.min(8, arrowLength * 0.3);
              
              ctx.beginPath();
              ctx.moveTo(endX, endY);
              ctx.lineTo(endX - headLength * Math.cos(angle - 0.3), endY - headLength * Math.sin(angle - 0.3));
              ctx.moveTo(endX, endY);
              ctx.lineTo(endX - headLength * Math.cos(angle + 0.3), endY - headLength * Math.sin(angle + 0.3));
              ctx.stroke();
            }
          }
        }
      }

      // Draw circulation cells
      for (const cell of circulationCells) {
        const centerX = cell.centerX * cellW;
        const centerY = cell.centerY * cellH;
        const radius = 150 * cell.strength;
        
        ctx.strokeStyle = cell.type === 'surface' ? 
          `rgba(255, 255, 0, 0.4)` : `rgba(0, 255, 255, 0.3)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Direction indicator
        ctx.font = "12px Arial";
        ctx.fillStyle = ctx.strokeStyle;
        ctx.textAlign = "center";
        ctx.fillText(cell.clockwise ? "↻" : "↺", centerX, centerY + 5);
      }

      // Draw tracer particles
      for (const particle of tracerParticles) {
        const x = particle.x * cellW;
        const y = particle.y * cellH;
        
        let color: string;
        if (showTemperature) {
          // Color by temperature
          const normalizedTemp = (particle.temperature + 10) / 40;
          const hue = 240 - normalizedTemp * 240;
          color = `hsl(${hue}, 100%, 60%)`;
        } else {
          // Color by depth
          color = particle.depth > 0.5 ? '#60a5fa' : '#fbbf24';
        }
        
        const alpha = Math.max(0.3, 1 - particle.age / 20);
        ctx.fillStyle = color.replace(')', `, ${alpha})`);
        ctx.beginPath();
        ctx.arc(x, y, 2 + particle.depth, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw major current labels
      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.textAlign = "center";
      
      const labels = [
        { name: "Gulf Stream", x: W * 0.25, y: H * 0.4 },
        { name: "California Current", x: W * 0.15, y: H * 0.35 },
        { name: "Kuroshio Current", x: W * 0.85, y: H * 0.35 },
        { name: "Antarctic Circumpolar", x: W * 0.5, y: H * 0.9 },
        { name: "Thermohaline Circulation", x: W * 0.5, y: H * 0.75 }
      ];
      
      labels.forEach(label => {
        ctx.fillText(label.name, label.x, label.y);
      });

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
      ctx.fillText("Ocean Parameters", paramX + 10, infoY);
      infoY += 25;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Wind Strength: ${windStrength.toFixed(1)}`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Temp. Gradient: ${temperatureDiff.toFixed(1)}`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Coriolis Effect: ${coriolisStrength.toFixed(1)}`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Show Temperature: ${showTemperature ? "ON" : "OFF"}`, paramX + 10, infoY);
      infoY += 20;

      ctx.fillStyle = "#10b981";
      ctx.fillText(`Tracer Particles: ${tracerParticles.length}`, paramX + 10, infoY);
      infoY += 14;
      ctx.fillText(`Circulation Cells: ${circulationCells.length}`, paramX + 10, infoY);
      infoY += 14;

      const avgU = velocityField.reduce((sum, val, i) => i % 2 === 0 ? sum + Math.abs(val) : sum, 0) / (velocityField.length / 2);
      ctx.fillText(`Avg. Current Speed: ${avgU.toFixed(3)}`, paramX + 10, infoY);

      // Physics info panel
      const physicsX = W - 280;
      const physicsY = H - 180;
      const physicsW = 260;
      const physicsH = 160;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(physicsX, physicsY, physicsW, physicsH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(physicsX, physicsY, physicsW, physicsH);

      let physY = physicsY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Ocean Circulation Physics", physicsX + 10, physY);
      physY += 25;

      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      const concepts = [
        "• Wind stress drives surface currents",
        "• Coriolis effect deflects moving water",
        "• Thermohaline: density-driven circulation",
        "• Warm water rises, cold water sinks",
        "• Gyres: large circular current systems",
        "• Ekman transport: 90° to wind direction",
        "• Upwelling brings deep nutrients up",
        "• Global conveyor belt circulation"
      ];
      
      concepts.forEach(concept => {
        ctx.fillText(concept, physicsX + 10, physY);
        physY += 14;
      });

      // Temperature scale
      if (showTemperature) {
        const scaleX = W - 50;
        const scaleY = 60;
        const scaleH = 200;
        const scaleW = 20;
        
        // Temperature gradient
        const gradient = ctx.createLinearGradient(0, scaleY, 0, scaleY + scaleH);
        gradient.addColorStop(0, "hsl(0, 70%, 60%)");    // Hot (red)
        gradient.addColorStop(0.5, "hsl(120, 70%, 60%)"); // Moderate (green)
        gradient.addColorStop(1, "hsl(240, 70%, 60%)");   // Cold (blue)
        
        ctx.fillStyle = gradient;
        ctx.fillRect(scaleX, scaleY, scaleW, scaleH);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.strokeRect(scaleX, scaleY, scaleW, scaleH);
        
        // Labels
        ctx.font = "10px Arial";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "left";
        ctx.fillText("30°C", scaleX + 25, scaleY + 5);
        ctx.fillText("10°C", scaleX + 25, scaleY + scaleH / 2);
        ctx.fillText("-10°C", scaleX + 25, scaleY + scaleH);
      }

      // Legend
      ctx.font = "10px Arial";
      ctx.textAlign = "left";
      const legendY = H - 30;
      
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, legendY);
      ctx.lineTo(70, legendY);
      ctx.stroke();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Current velocity", 75, legendY + 3);
      
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(200, legendY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("Surface tracer", 210, legendY + 3);
      
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.arc(320, legendY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("Deep tracer", 330, legendY + 3);

      // Circulation info
      ctx.font = "11px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("Ocean currents redistribute heat and drive global climate patterns", W / 2, H - 5);
    },

    reset() {
      time = 0;
      initializeOcean();
    },

    destroy() {
      velocityField = new Float32Array(0);
      temperatureField = new Float32Array(0);
      salinityField = new Float32Array(0);
      pressureField = new Float32Array(0);
      densityField = new Float32Array(0);
      tracerParticles = [];
    },

    getStateDescription(): string {
      const avgSpeed = velocityField.reduce((sum, val, i) => i % 2 === 0 ? sum + Math.abs(val) : sum, 0) / (velocityField.length / 2);
      const surfaceTracers = tracerParticles.filter(p => p.depth < 0.5).length;
      const deepTracers = tracerParticles.filter(p => p.depth >= 0.5).length;
      
      const avgTemp = tracerParticles.reduce((sum, p) => sum + p.temperature, 0) / tracerParticles.length;
      const avgSalinity = tracerParticles.reduce((sum, p) => sum + p.salinity, 0) / tracerParticles.length;
      
      return (
        `Ocean Currents simulation: Wind strength ${windStrength.toFixed(1)}, ` +
        `temperature gradient ${temperatureDiff.toFixed(1)}, Coriolis effect ${coriolisStrength.toFixed(1)}. ` +
        `${circulationCells.length} circulation cells active. ` +
        `Tracking ${tracerParticles.length} particles (${surfaceTracers} surface, ${deepTracers} deep). ` +
        `Average current speed: ${avgSpeed.toFixed(3)} units/s. ` +
        `Average water temperature: ${avgTemp.toFixed(1)}°C, salinity: ${avgSalinity.toFixed(1)}psu. ` +
        `Temperature visualization: ${showTemperature ? 'enabled' : 'disabled'}. ` +
        `Demonstrates wind-driven surface circulation and density-driven thermohaline circulation. ` +
        `Coriolis effect creates gyres, while temperature/salinity differences drive deep ocean conveyor belt.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default OceanCurrentsFactory;