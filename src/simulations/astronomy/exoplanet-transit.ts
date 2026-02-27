import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const ExoplanetTransitFactory: SimulationFactory = () => {
  const config = getSimConfig("exoplanet-transit")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let planetRadius = 0.1;    // Fraction of stellar radius
  let orbitalPeriod = 3.0;   // Days
  let inclination = 89;      // Degrees (90 = edge-on transit)
  let stellarRadius = 1.0;   // Solar radii

  // System properties
  let orbitRadius = 200;     // Display pixels
  let planetAngle = 0;       // Current orbital position
  let transitDepth = 0;      // Current brightness dip
  let isTransiting = false;
  let transitProgress = 0;   // 0 to 1 during transit
  
  // Light curve data
  let lightCurve: Array<{ 
    phase: number;      // Orbital phase 0-1
    brightness: number; // Relative brightness 0-1
    time: number;       // Time in orbital periods
  }> = [];
  
  let currentBrightness = 1.0;
  let transitDuration = 0;
  let transitDetected = false;

  // Kepler's laws calculations
  function calculateTransitProperties() {
    // Convert parameters to physical units
    const planetRadiusReal = planetRadius * stellarRadius;
    const inclinationRad = inclination * Math.PI / 180;
    
    // Transit occurs when |b| < R* + Rp, where b is impact parameter
    const impactParameter = Math.cos(inclinationRad);
    const willTransit = Math.abs(impactParameter) < (1 + planetRadius);
    
    // Transit depth (simplified - assumes uniform stellar disk)
    transitDepth = willTransit ? (planetRadiusReal * planetRadiusReal) / (stellarRadius * stellarRadius) : 0;
    
    // Transit duration (fraction of orbit)
    const transitArc = willTransit ? 
      2 * Math.asin(Math.sqrt((1 + planetRadius) * (1 + planetRadius) - impactParameter * impactParameter)) : 0;
    transitDuration = transitArc / (2 * Math.PI);
    
    return { willTransit, transitDepth, transitDuration, impactParameter };
  }

  function updateOrbit(dt: number) {
    // Update orbital position
    const orbitalFreq = 2 * Math.PI / (orbitalPeriod * 24 * 3600); // rad/s (scaled for display)
    planetAngle += orbitalFreq * dt * 100; // Speed up for visualization
    
    // Wrap angle
    planetAngle = planetAngle % (2 * Math.PI);
    
    // Current orbital phase (0 to 1)
    const phase = planetAngle / (2 * Math.PI);
    
    // Check for transit
    const { willTransit, transitDepth: maxDepth, transitDuration: duration } = calculateTransitProperties();
    
    // Transit occurs around phase 0.5 (when planet is in front of star)
    const transitPhaseStart = 0.5 - duration / 2;
    const transitPhaseEnd = 0.5 + duration / 2;
    
    isTransiting = willTransit && phase >= transitPhaseStart && phase <= transitPhaseEnd;
    
    if (isTransiting) {
      // Calculate transit progress (0 at start, 1 at center, 0 at end)
      const transitPhase = (phase - transitPhaseStart) / duration;
      transitProgress = 1 - Math.abs(2 * transitPhase - 1); // Triangle wave
      
      // Brightness dip during transit (simplified box model)
      currentBrightness = 1 - maxDepth * transitProgress;
      
      if (!transitDetected && transitProgress > 0.5) {
        transitDetected = true; // Mark detection at mid-transit
      }
    } else {
      currentBrightness = 1.0;
      transitProgress = 0;
    }
    
    // Record light curve data
    if (lightCurve.length === 0 || 
        Math.abs(phase - lightCurve[lightCurve.length - 1].phase) > 0.005) {
      
      lightCurve.push({
        phase: phase,
        brightness: currentBrightness,
        time: time / (orbitalPeriod * 24 * 3600) * 100 // Convert to orbital periods
      });
      
      // Keep recent data (about 3 orbits)
      if (lightCurve.length > 600) {
        lightCurve.shift();
      }
    }
  }

  function calculatePlanetPosition(): { x: number; y: number; z: number } {
    const inclinationRad = inclination * Math.PI / 180;
    
    // 3D orbital position
    const x = orbitRadius * Math.cos(planetAngle);
    const y = orbitRadius * Math.sin(planetAngle) * Math.cos(inclinationRad);
    const z = orbitRadius * Math.sin(planetAngle) * Math.sin(inclinationRad);
    
    return { x, y, z };
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      planetAngle = 0;
      lightCurve = [];
      transitDetected = false;
    },

    update(dt: number, params: Record<string, number>) {
      planetRadius = params.planetRadius ?? planetRadius;
      orbitalPeriod = params.orbitalPeriod ?? orbitalPeriod;
      inclination = params.inclination ?? inclination;
      stellarRadius = params.stellarRadius ?? stellarRadius;

      time += dt;
      updateOrbit(dt);
    },

    render() {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#0a0a1f");
      gradient.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Exoplanet Transit Detection", W / 2, 25);

      // System view (left side)
      const systemCenterX = W * 0.25;
      const systemCenterY = H * 0.4;
      const starRadius = 30 * stellarRadius;

      // Orbital plane visualization
      const inclinationRad = inclination * Math.PI / 180;
      const orbitHeight = orbitRadius * Math.sin(inclinationRad);
      
      // Draw orbital ellipse (perspective view)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(systemCenterX, systemCenterY, orbitRadius, 
                  Math.abs(orbitRadius * Math.cos(inclinationRad)), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Star
      const starBrightness = currentBrightness;
      const starGlow = ctx.createRadialGradient(systemCenterX, systemCenterY, 0, 
                                               systemCenterX, systemCenterY, starRadius * 2);
      starGlow.addColorStop(0, `rgba(255, 255, 120, ${starBrightness * 0.8})`);
      starGlow.addColorStop(0.5, `rgba(255, 255, 80, ${starBrightness * 0.4})`);
      starGlow.addColorStop(1, "rgba(255, 255, 80, 0)");
      ctx.fillStyle = starGlow;
      ctx.beginPath();
      ctx.arc(systemCenterX, systemCenterY, starRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Star body
      ctx.fillStyle = `rgb(255, 255, ${Math.floor(120 + starBrightness * 135)})`;
      ctx.beginPath();
      ctx.arc(systemCenterX, systemCenterY, starRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Planet
      const planetPos = calculatePlanetPosition();
      const planetDisplayX = systemCenterX + planetPos.x;
      const planetDisplayY = systemCenterY + planetPos.y;
      const planetDisplayRadius = starRadius * planetRadius;
      
      // Planet shadow during transit
      if (isTransiting && planetPos.z > 0) {
        const shadowRadius = planetDisplayRadius * 1.5;
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.arc(systemCenterX, systemCenterY, shadowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Planet body
      const planetColor = planetPos.z > 0 ? "#8b5a3c" : "#a0a0a0"; // Different color when behind star
      ctx.fillStyle = planetColor;
      ctx.beginPath();
      ctx.arc(planetDisplayX, planetDisplayY, planetDisplayRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Transit indicator
      if (isTransiting) {
        ctx.font = "bold 12px Arial";
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "center";
        ctx.fillText("TRANSIT IN PROGRESS", systemCenterX, systemCenterY + starRadius + 30);
        
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`Depth: ${(transitDepth * 100).toFixed(2)}%`, systemCenterX, systemCenterY + starRadius + 50);
      }

      // Light curve (right side)
      const curveX = W * 0.55;
      const curveY = H * 0.15;
      const curveW = W * 0.4;
      const curveH = 200;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(curveX, curveY, curveW, curveH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(curveX, curveY, curveW, curveH);

      ctx.font = "14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Light Curve", curveX + curveW / 2, curveY - 8);

      // Plot light curve
      if (lightCurve.length > 1) {
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < lightCurve.length; i++) {
          const point = lightCurve[i];
          const x = curveX + (point.phase % 1) * curveW;
          const y = curveY + curveH - (point.brightness * curveH);
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Current position indicator
        if (lightCurve.length > 0) {
          const current = lightCurve[lightCurve.length - 1];
          const currentX = curveX + (current.phase % 1) * curveW;
          const currentY = curveY + curveH - (current.brightness * curveH);
          
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Light curve axes and labels
      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText("1.0", curveX - 25, curveY + 5);
      ctx.fillText("0.99", curveX - 25, curveY + curveH / 2);
      ctx.fillText("0.98", curveX - 25, curveY + curveH);
      
      ctx.textAlign = "center";
      ctx.fillText("0.0", curveX, curveY + curveH + 15);
      ctx.fillText("0.5", curveX + curveW / 2, curveY + curveH + 15);
      ctx.fillText("1.0", curveX + curveW, curveY + curveH + 15);
      ctx.fillText("Orbital Phase", curveX + curveW / 2, curveY + curveH + 30);

      // Y-axis label
      ctx.save();
      ctx.translate(curveX - 40, curveY + curveH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Relative Brightness", 0, 0);
      ctx.restore();

      // System parameters panel
      const paramX = 20;
      const paramY = H * 0.6;
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
      ctx.fillText("System Parameters", paramX + 10, infoY);
      infoY += 25;

      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Planet Radius: ${(planetRadius * stellarRadius).toFixed(2)} R☉`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Orbital Period: ${orbitalPeriod.toFixed(1)} days`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Inclination: ${inclination.toFixed(0)}°`, paramX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Stellar Radius: ${stellarRadius.toFixed(1)} R☉`, paramX + 10, infoY);
      infoY += 20;

      const { willTransit } = calculateTransitProperties();
      ctx.fillStyle = willTransit ? "#10b981" : "#ef4444";
      ctx.fillText(`Transit: ${willTransit ? "YES" : "NO"}`, paramX + 10, infoY);
      infoY += 16;

      if (willTransit) {
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Transit Depth: ${(transitDepth * 100).toFixed(2)}%`, paramX + 10, infoY);
        infoY += 16;
        ctx.fillText(`Duration: ${(transitDuration * orbitalPeriod * 24).toFixed(1)} hours`, paramX + 10, infoY);
      }

      // Detection status panel
      const detectionX = W - 220;
      const detectionY = H * 0.6;
      const detectionW = 200;
      const detectionH = 120;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(detectionX, detectionY, detectionW, detectionH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(detectionX, detectionY, detectionW, detectionH);

      let detY = detectionY + 20;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Detection Status", detectionX + 10, detY);
      detY += 25;

      ctx.font = "11px Arial";
      ctx.fillStyle = transitDetected ? "#10b981" : "#64748b";
      ctx.fillText(`Exoplanet: ${transitDetected ? "DETECTED" : "Monitoring..."}`, detectionX + 10, detY);
      detY += 18;

      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Current Brightness:`, detectionX + 10, detY);
      detY += 14;
      ctx.fillStyle = isTransiting ? "#fbbf24" : "#10b981";
      ctx.fillText(`${(currentBrightness * 100).toFixed(3)}%`, detectionX + 20, detY);
      detY += 18;

      if (transitDetected) {
        ctx.fillStyle = "#10b981";
        ctx.fillText("✓ Transit confirmed", detectionX + 10, detY);
        detY += 14;
        ctx.fillText("✓ Periodic signal", detectionX + 10, detY);
      }

      // Phase and orbital info
      const currentPhase = (planetAngle / (2 * Math.PI)) % 1;
      ctx.font = "11px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText(`Orbital Phase: ${(currentPhase * 100).toFixed(1)}%`, 20, H - 60);
      ctx.fillText(`Time: ${(time / 10).toFixed(1)} time units`, 20, H - 40);
      ctx.fillText(`Observations: ${lightCurve.length} data points`, 20, H - 20);

      // Method description
      ctx.font = "10px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("Transit photometry: Detecting exoplanets by measuring periodic brightness dips", W / 2, H - 10);
    },

    reset() {
      time = 0;
      planetAngle = 0;
      lightCurve = [];
      transitDetected = false;
    },

    destroy() {
      lightCurve = [];
    },

    getStateDescription(): string {
      const { willTransit, transitDepth: maxDepth, transitDuration: duration, impactParameter } = calculateTransitProperties();
      const currentPhase = (planetAngle / (2 * Math.PI)) % 1;
      
      return (
        `Exoplanet transit simulation: Planet with radius ${(planetRadius * stellarRadius).toFixed(2)}R☉ ` +
        `orbiting star every ${orbitalPeriod.toFixed(1)} days at inclination ${inclination.toFixed(0)}°. ` +
        `Current orbital phase: ${(currentPhase * 100).toFixed(1)}%. ` +
        `Transit ${willTransit ? `detected with depth ${(maxDepth * 100).toFixed(2)}% and duration ${(duration * orbitalPeriod * 24).toFixed(1)} hours` : 'not detectable (no alignment)'}. ` +
        `Impact parameter: ${Math.abs(impactParameter).toFixed(2)}. ` +
        `Current brightness: ${(currentBrightness * 100).toFixed(3)}%. ` +
        `${transitDetected ? 'Exoplanet confirmed through periodic transit detection' : 'Monitoring for transit events'}. ` +
        `Light curve shows ${lightCurve.length} observations.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default ExoplanetTransitFactory;