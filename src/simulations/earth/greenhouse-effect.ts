import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const GreenhouseEffectFactory: SimulationFactory = () => {
  const config = getSimConfig("greenhouse-effect")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let co2Concentration = 400;     // ppm
  let cloudCover = 0.3;           // 0-1
  let albedo = 0.3;               // Earth's reflectivity
  let solarIntensity = 1.0;       // Relative solar intensity

  // Energy balance
  let incomingSolar = 1361;       // W/m² (solar constant)
  let outgoingLongwave = 0;
  let surfaceTemperature = 15;    // °C
  let atmosphericTemperature = -18; // °C
  let energyImbalance = 0;

  // Radiation photons
  let solarPhotons: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    wavelength: number; // visible light: 400-700nm
    energy: number;
    absorbed: boolean;
  }> = [];

  let infraredPhotons: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    wavelength: number; // IR: 8-12μm
    energy: number;
    age: number;
    source: string; // 'surface' or 'atmosphere'
  }> = [];

  // Greenhouse gas molecules
  let greenhouseGases: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: string; // 'co2', 'h2o', 'ch4'
    absorption: number; // Current absorption state
  }> = [];

  // Clouds
  let clouds: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
  }> = [];

  // Temperature history for graph
  let temperatureHistory: Array<{ time: number; surface: number; atmosphere: number }> = [];

  const groundLevel = H * 0.8;
  const atmosphereTop = H * 0.2;

  function initializeAtmosphere() {
    greenhouseGases = [];
    clouds = [];
    
    // Add CO2 molecules based on concentration
    const numCO2 = Math.floor(co2Concentration / 10);
    for (let i = 0; i < numCO2; i++) {
      greenhouseGases.push({
        x: Math.random() * W,
        y: atmosphereTop + Math.random() * (groundLevel - atmosphereTop),
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 10,
        type: 'co2',
        absorption: 0
      });
    }
    
    // Add water vapor
    const numH2O = 50;
    for (let i = 0; i < numH2O; i++) {
      greenhouseGases.push({
        x: Math.random() * W,
        y: groundLevel - 100 + Math.random() * 100, // Lower atmosphere
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 15,
        type: 'h2o',
        absorption: 0
      });
    }
    
    // Add clouds based on cloud cover
    const numClouds = Math.floor(cloudCover * 20);
    for (let i = 0; i < numClouds; i++) {
      clouds.push({
        x: Math.random() * W,
        y: atmosphereTop + 50 + Math.random() * 100,
        vx: 5 + Math.random() * 15,
        vy: (Math.random() - 0.5) * 5,
        size: 30 + Math.random() * 40,
        opacity: 0.5 + Math.random() * 0.4
      });
    }
  }

  function calculateRadiativeForcing() {
    // Simplified radiative forcing calculation
    const co2Forcing = 5.35 * Math.log(co2Concentration / 280); // W/m²
    const cloudForcing = -cloudCover * 30; // Negative forcing (cooling)
    const albedoForcing = -albedo * incomingSolar * 0.25;
    
    return co2Forcing + cloudForcing + albedoForcing;
  }

  function updateEnergyBalance(dt: number) {
    // Incoming solar radiation
    const effectiveIncoming = incomingSolar * solarIntensity * (1 - albedo) * (1 - cloudCover * 0.3);
    
    // Stefan-Boltzmann law for outgoing radiation
    const sigma = 5.67e-8; // Stefan-Boltzmann constant (scaled)
    const surfaceTempK = surfaceTemperature + 273.15;
    
    // Greenhouse effect factor based on CO2 and other gases
    const greenhouseEffect = 1 - Math.exp(-co2Concentration / 1000);
    const atmosphericAbsorption = 0.8 + greenhouseEffect * 0.2;
    
    outgoingLongwave = sigma * surfaceTempK * surfaceTempK * surfaceTempK * surfaceTempK * 1e12;
    const effectiveOutgoing = outgoingLongwave * (1 - atmosphericAbsorption);
    
    // Energy imbalance
    energyImbalance = effectiveIncoming - effectiveOutgoing;
    
    // Update temperatures (simplified climate model)
    const heatCapacity = 1000; // Effective heat capacity
    surfaceTemperature += (energyImbalance / heatCapacity) * dt * 10;
    atmosphericTemperature += (energyImbalance / heatCapacity) * dt * 5;
    
    // Record temperature history
    if (temperatureHistory.length === 0 || time - temperatureHistory[temperatureHistory.length - 1].time > 0.2) {
      temperatureHistory.push({
        time: time,
        surface: surfaceTemperature,
        atmosphere: atmosphericTemperature
      });
      
      if (temperatureHistory.length > 200) {
        temperatureHistory.shift();
      }
    }
  }

  function updatePhotons(dt: number) {
    // Generate incoming solar photons
    if (Math.random() < solarIntensity * 0.1) {
      solarPhotons.push({
        x: Math.random() * W,
        y: 0,
        vx: 0,
        vy: 150,
        wavelength: 400 + Math.random() * 300, // Visible spectrum
        energy: 1 + Math.random(),
        absorbed: false
      });
    }
    
    // Update solar photons
    for (let i = solarPhotons.length - 1; i >= 0; i--) {
      const photon = solarPhotons[i];
      photon.x += photon.vx * dt;
      photon.y += photon.vy * dt;
      
      // Check cloud interaction
      for (const cloud of clouds) {
        const dx = photon.x - cloud.x;
        const dy = photon.y - cloud.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < cloud.size) {
          if (Math.random() < cloud.opacity * 0.3) {
            // Reflect photon
            photon.vy = -photon.vy;
          }
        }
      }
      
      // Check surface interaction
      if (photon.y > groundLevel) {
        photon.absorbed = true;
        
        // Generate IR photon from surface warming
        if (Math.random() < 0.7) {
          infraredPhotons.push({
            x: photon.x,
            y: groundLevel,
            vx: (Math.random() - 0.5) * 50,
            vy: -50 - Math.random() * 100,
            wavelength: 8000 + Math.random() * 4000, // IR wavelength (8-12μm)
            energy: photon.energy * 0.8,
            age: 0,
            source: 'surface'
          });
        }
        
        solarPhotons.splice(i, 1);
      } else if (photon.y < 0) {
        // Reflected to space
        solarPhotons.splice(i, 1);
      }
    }
    
    // Update IR photons
    for (let i = infraredPhotons.length - 1; i >= 0; i--) {
      const photon = infraredPhotons[i];
      photon.x += photon.vx * dt;
      photon.y += photon.vy * dt;
      photon.age += dt;
      
      // Check greenhouse gas absorption
      for (const gas of greenhouseGases) {
        const dx = photon.x - gas.x;
        const dy = photon.y - gas.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) {
          let absorptionChance = 0;
          
          // Different gases absorb different wavelengths
          if (gas.type === 'co2' && photon.wavelength >= 9000 && photon.wavelength <= 11000) {
            absorptionChance = 0.3;
          } else if (gas.type === 'h2o' && photon.wavelength >= 8000 && photon.wavelength <= 12000) {
            absorptionChance = 0.4;
          }
          
          if (Math.random() < absorptionChance) {
            gas.absorption = Math.min(1, gas.absorption + 0.5);
            
            // Re-emit in random direction
            const newAngle = Math.random() * Math.PI * 2;
            const reemitSpeed = 80;
            
            infraredPhotons.push({
              x: gas.x,
              y: gas.y,
              vx: reemitSpeed * Math.cos(newAngle),
              vy: reemitSpeed * Math.sin(newAngle),
              wavelength: photon.wavelength,
              energy: photon.energy * 0.9,
              age: 0,
              source: 'atmosphere'
            });
            
            infraredPhotons.splice(i, 1);
            break;
          }
        }
      }
      
      // Remove old photons or those that left the atmosphere
      if (photon.age > 5 || photon.y < -50 || photon.y > H + 50) {
        infraredPhotons.splice(i, 1);
      }
    }
  }

  function updateAtmosphere(dt: number) {
    // Update greenhouse gas positions
    for (const gas of greenhouseGases) {
      gas.x += gas.vx * dt;
      gas.y += gas.vy * dt;
      
      // Boundary conditions
      if (gas.x < 0 || gas.x > W) gas.vx = -gas.vx;
      if (gas.y < atmosphereTop) gas.vy = Math.abs(gas.vy);
      if (gas.y > groundLevel - 20) gas.vy = -Math.abs(gas.vy);
      
      // Decay absorption
      gas.absorption = Math.max(0, gas.absorption - dt * 2);
    }
    
    // Update clouds
    for (const cloud of clouds) {
      cloud.x += cloud.vx * dt;
      cloud.y += cloud.vy * dt;
      
      // Wrap around horizontally
      if (cloud.x > W + cloud.size) cloud.x = -cloud.size;
      
      // Vertical boundaries
      if (cloud.y < atmosphereTop || cloud.y > atmosphereTop + 150) {
        cloud.vy = -cloud.vy;
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
      initializeAtmosphere();
      time = 0;
      temperatureHistory = [];
    },

    update(dt: number, params: Record<string, number>) {
      const newCO2 = params.co2Concentration ?? co2Concentration;
      const newCloudCover = params.cloudCover ?? cloudCover;
      
      // Reinitialize if major parameters changed
      if (Math.abs(newCO2 - co2Concentration) > 50 || Math.abs(newCloudCover - cloudCover) > 0.1) {
        co2Concentration = newCO2;
        cloudCover = newCloudCover;
        initializeAtmosphere();
      } else {
        co2Concentration = newCO2;
        cloudCover = newCloudCover;
      }
      
      albedo = params.albedo ?? albedo;
      solarIntensity = params.solarIntensity ?? solarIntensity;

      time += dt;
      updateEnergyBalance(dt);
      updatePhotons(dt);
      updateAtmosphere(dt);
    },

    render() {
      // Background (space to ground)
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0a0a2e"); // Space
      gradient.addColorStop(0.2, "#2a4365"); // Upper atmosphere
      gradient.addColorStop(0.6, "#3182ce"); // Lower atmosphere
      gradient.addColorStop(0.8, "#63b3ed"); // Near surface
      gradient.addColorStop(1, "#e6fffa");   // Surface
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Greenhouse Effect", W / 2, 30);

      // Sun
      const sunSize = 40 * solarIntensity;
      const sunGradient = ctx.createRadialGradient(W / 2, -20, 0, W / 2, -20, sunSize);
      sunGradient.addColorStop(0, "#ffd700");
      sunGradient.addColorStop(0.7, "#ffed4a");
      sunGradient.addColorStop(1, "rgba(255, 237, 74, 0)");
      
      ctx.fillStyle = sunGradient;
      ctx.beginPath();
      ctx.arc(W / 2, -20, sunSize, 0, Math.PI * 2);
      ctx.fill();

      // Ground surface
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(0, groundLevel, W, H - groundLevel);
      
      // Surface temperature color
      const tempColorIntensity = Math.max(0, Math.min(1, (surfaceTemperature + 10) / 50));
      ctx.fillStyle = `rgba(255, ${Math.floor(100 + tempColorIntensity * 155)}, ${Math.floor(100 + tempColorIntensity * 155)}, 0.3)`;
      ctx.fillRect(0, groundLevel - 20, W, 20);

      // Draw clouds
      for (const cloud of clouds) {
        const cloudGradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.size);
        cloudGradient.addColorStop(0, `rgba(255, 255, 255, ${cloud.opacity})`);
        cloudGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        
        ctx.fillStyle = cloudGradient;
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw greenhouse gas molecules
      for (const gas of greenhouseGases) {
        let color: string;
        let size: number;
        
        if (gas.type === 'co2') {
          color = gas.absorption > 0 ? "#ff4444" : "#ff9999";
          size = 4;
        } else if (gas.type === 'h2o') {
          color = gas.absorption > 0 ? "#4444ff" : "#9999ff";
          size = 3;
        } else {
          color = "#44ff44";
          size = 3;
        }
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(gas.x, gas.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Absorption glow
        if (gas.absorption > 0) {
          const glowSize = size + gas.absorption * 8;
          const glowGradient = ctx.createRadialGradient(gas.x, gas.y, 0, gas.x, gas.y, glowSize);
          glowGradient.addColorStop(0, color.replace(")", `, ${gas.absorption * 0.5})`));
          glowGradient.addColorStop(1, color.replace(")", ", 0)"));
          
          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(gas.x, gas.y, glowSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw solar photons
      for (const photon of solarPhotons) {
        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.arc(photon.x, photon.y, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Photon trail
        ctx.strokeStyle = "rgba(255, 255, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(photon.x, photon.y);
        ctx.lineTo(photon.x - photon.vx * 0.1, photon.y - photon.vy * 0.1);
        ctx.stroke();
      }

      // Draw IR photons
      for (const photon of infraredPhotons) {
        const alpha = Math.max(0.3, 1 - photon.age / 3);
        ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
        ctx.beginPath();
        ctx.arc(photon.x, photon.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Energy balance diagram (top right)
      const diagramX = W - 200;
      const diagramY = 60;
      const diagramW = 180;
      const diagramH = 140;

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(diagramX, diagramY, diagramW, diagramH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(diagramX, diagramY, diagramW, diagramH);

      ctx.font = "bold 12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Energy Balance", diagramX + diagramW / 2, diagramY + 15);

      // Energy flow arrows
      ctx.font = "10px Arial";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "left";
      ctx.fillText(`Solar In: ${(incomingSolar * solarIntensity * (1-albedo)).toFixed(0)} W/m²`, diagramX + 5, diagramY + 35);
      
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`IR Out: ${outgoingLongwave.toFixed(0)} W/m²`, diagramX + 5, diagramY + 50);
      
      ctx.fillStyle = energyImbalance > 0 ? "#22c55e" : "#3b82f6";
      ctx.fillText(`Balance: ${energyImbalance > 0 ? '+' : ''}${energyImbalance.toFixed(1)} W/m²`, diagramX + 5, diagramY + 65);
      
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Forcing: ${calculateRadiativeForcing().toFixed(1)} W/m²`, diagramX + 5, diagramY + 80);

      // Temperature display
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Surface: ${surfaceTemperature.toFixed(1)}°C`, diagramX + 5, diagramY + 100);
      ctx.fillStyle = "#60a5fa";
      ctx.fillText(`Atmosphere: ${atmosphericTemperature.toFixed(1)}°C`, diagramX + 5, diagramY + 115);

      // Temperature history graph
      const graphX = 20;
      const graphY = H - 150;
      const graphW = 300;
      const graphH = 100;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(graphX, graphY, graphW, graphH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(graphX, graphY, graphW, graphH);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Temperature History", graphX + graphW / 2, graphY - 5);

      if (temperatureHistory.length > 1) {
        // Surface temperature
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const minTemp = -30;
        const maxTemp = 60;
        
        for (let i = 0; i < temperatureHistory.length; i++) {
          const point = temperatureHistory[i];
          const x = graphX + (i / (temperatureHistory.length - 1)) * graphW;
          const y = graphY + graphH - ((point.surface - minTemp) / (maxTemp - minTemp)) * graphH;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Atmospheric temperature
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < temperatureHistory.length; i++) {
          const point = temperatureHistory[i];
          const x = graphX + (i / (temperatureHistory.length - 1)) * graphW;
          const y = graphY + graphH - ((point.atmosphere - minTemp) / (maxTemp - minTemp)) * graphH;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Parameters panel
      const paramX = W - 200;
      const paramY = H - 180;
      const paramW = 180;
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
      ctx.fillText("Atmosphere", paramX + 10, infoY);
      infoY += 25;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`CO₂: ${co2Concentration.toFixed(0)} ppm`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Clouds: ${(cloudCover * 100).toFixed(0)}%`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Albedo: ${albedo.toFixed(2)}`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Solar: ${(solarIntensity * 100).toFixed(0)}%`, paramX + 10, infoY);
      infoY += 20;

      ctx.fillStyle = "#10b981";
      ctx.fillText(`Photons: ${solarPhotons.length + infraredPhotons.length}`, paramX + 10, infoY);
      infoY += 14;
      ctx.fillText(`GHG molecules: ${greenhouseGases.length}`, paramX + 10, infoY);

      // Legend
      const legendY = H - 40;
      ctx.font = "10px Arial";
      
      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.arc(50, legendY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Solar radiation", 60, legendY + 3);
      
      ctx.fillStyle = "#ff6464";
      ctx.beginPath();
      ctx.arc(180, legendY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("Infrared radiation", 190, legendY + 3);
      
      ctx.fillStyle = "#ff9999";
      ctx.beginPath();
      ctx.arc(320, legendY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("CO₂", 330, legendY + 3);
      
      ctx.fillStyle = "#9999ff";
      ctx.beginPath();
      ctx.arc(370, legendY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("H₂O", 380, legendY + 3);

      // Current greenhouse effect strength
      ctx.font = "11px Arial";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "left";
      const greenhouse = 1 - Math.exp(-co2Concentration / 1000);
      ctx.fillText(`Greenhouse effect: ${(greenhouse * 100).toFixed(1)}%`, 20, H - 5);
    },

    reset() {
      time = 0;
      surfaceTemperature = 15;
      atmosphericTemperature = -18;
      temperatureHistory = [];
      solarPhotons = [];
      infraredPhotons = [];
      initializeAtmosphere();
    },

    destroy() {
      solarPhotons = [];
      infraredPhotons = [];
      greenhouseGases = [];
      clouds = [];
      temperatureHistory = [];
    },

    getStateDescription(): string {
      const forcing = calculateRadiativeForcing();
      const greenhouse = 1 - Math.exp(-co2Concentration / 1000);
      
      return (
        `Greenhouse Effect simulation: CO₂ concentration ${co2Concentration.toFixed(0)}ppm, ` +
        `cloud cover ${(cloudCover * 100).toFixed(0)}%, albedo ${albedo.toFixed(2)}, ` +
        `solar intensity ${(solarIntensity * 100).toFixed(0)}%. ` +
        `Current temperatures: surface ${surfaceTemperature.toFixed(1)}°C, ` +
        `atmosphere ${atmosphericTemperature.toFixed(1)}°C. ` +
        `Energy imbalance: ${energyImbalance.toFixed(1)} W/m². ` +
        `Radiative forcing: ${forcing.toFixed(1)} W/m². ` +
        `Greenhouse effect strength: ${(greenhouse * 100).toFixed(1)}%. ` +
        `Tracking ${solarPhotons.length} solar and ${infraredPhotons.length} IR photons, ` +
        `${greenhouseGases.length} greenhouse gas molecules. ` +
        `Demonstrates how greenhouse gases trap outgoing infrared radiation, warming Earth's surface.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default GreenhouseEffectFactory;