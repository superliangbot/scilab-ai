import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const PlateTectonics: SimulationFactory = () => {
  const config = getSimConfig("plate-tectonics")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let convergenceRate = 2; // cm/year (scaled for visualization)
  let timeScale = 50; // speed multiplier for animation
  let showMagma = true;
  let time = 0;
  let animationTime = 0;

  // Plate data
  interface TectonicPlate {
    x: number;
    y: number;
    width: number;
    height: number;
    velocityX: number;
    color: string;
    name: string;
    type: "oceanic" | "continental";
    age: number; // millions of years
  }

  const plates: TectonicPlate[] = [
    {
      x: 50,
      y: 300,
      width: 300,
      height: 80,
      velocityX: convergenceRate / 100,
      color: "#2563eb",
      name: "Oceanic Plate A",
      type: "oceanic",
      age: 180
    },
    {
      x: 450,
      y: 280,
      width: 300,
      height: 100,
      velocityX: -convergenceRate / 100,
      color: "#059669",
      name: "Continental Plate B",
      type: "continental",
      age: 2500
    }
  ];

  // Geological features
  interface GeologicalFeature {
    x: number;
    y: number;
    type: "volcano" | "mountain" | "trench" | "earthquake";
    intensity: number;
    active: boolean;
  }

  const features: GeologicalFeature[] = [];

  // Colors
  const BG_COLOR = "#0f172a";
  const OCEAN_COLOR = "#1e40af";
  const MANTLE_COLOR = "#dc2626";
  const MAGMA_COLOR = "#f97316";
  const MOUNTAIN_COLOR = "#78716c";
  const VOLCANO_COLOR = "#ef4444";
  const EARTHQUAKE_COLOR = "#fbbf24";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function updatePlateMovement(dt: number) {
    const scaledDt = dt * timeScale;
    
    // Move plates toward each other
    for (const plate of plates) {
      plate.x += plate.velocityX * scaledDt * 10; // scaled for visualization
    }
    
    // Check for collisions and interactions
    const plate1 = plates[0];
    const plate2 = plates[1];
    
    const collisionZone = plate1.x + plate1.width;
    const plate2Edge = plate2.x;
    
    if (collisionZone >= plate2Edge - 20) {
      // Collision detected - create geological activity
      updateGeologicalActivity(plate2Edge - 10);
    }
    
    // Reset plates when they get too close to maintain simulation
    if (collisionZone > plate2Edge + 50) {
      plate1.x = 50;
      plate2.x = 450;
      features.length = 0; // Clear old features
    }
  }

  function updateGeologicalActivity(collisionX: number) {
    // Remove old features near collision zone
    for (let i = features.length - 1; i >= 0; i--) {
      const feature = features[i];
      if (Math.abs(feature.x - collisionX) < 100) {
        features.splice(i, 1);
      }
    }
    
    // Add new geological features based on plate interaction
    const oceanic = plates[0];
    const continental = plates[1];
    
    // Ocean trench (where oceanic plate subducts)
    if (Math.random() < 0.3) {
      features.push({
        x: collisionX - 30,
        y: oceanic.y + oceanic.height,
        type: "trench",
        intensity: 0.8,
        active: true
      });
    }
    
    // Volcanic activity (from subducting plate melting)
    if (Math.random() < 0.4) {
      features.push({
        x: collisionX + 20 + Math.random() * 60,
        y: continental.y - 20,
        type: "volcano",
        intensity: 0.5 + Math.random() * 0.5,
        active: true
      });
    }
    
    // Mountain building (crustal compression)
    if (Math.random() < 0.5) {
      features.push({
        x: collisionX + 10 + Math.random() * 40,
        y: continental.y - 10,
        type: "mountain",
        intensity: 0.6 + Math.random() * 0.4,
        active: true
      });
    }
    
    // Earthquakes (stress release)
    if (Math.random() < 0.6) {
      features.push({
        x: collisionX + (Math.random() - 0.5) * 80,
        y: oceanic.y + Math.random() * oceanic.height,
        type: "earthquake",
        intensity: 0.3 + Math.random() * 0.7,
        active: true
      });
    }
  }

  function drawEarthCrossSection() {
    // Draw mantle layer (background)
    const gradient = ctx.createLinearGradient(0, height * 0.6, 0, height);
    gradient.addColorStop(0, "#dc2626");
    gradient.addColorStop(1, "#7f1d1d");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height * 0.6, width, height * 0.4);
    
    // Draw ocean
    ctx.fillStyle = OCEAN_COLOR;
    ctx.fillRect(0, height * 0.4, width, height * 0.2);
  }

  function drawPlates() {
    for (const plate of plates) {
      // Plate body
      const plateGradient = ctx.createLinearGradient(0, plate.y, 0, plate.y + plate.height);
      if (plate.type === "oceanic") {
        plateGradient.addColorStop(0, "#1e40af");
        plateGradient.addColorStop(1, "#1e3a8a");
      } else {
        plateGradient.addColorStop(0, "#059669");
        plateGradient.addColorStop(1, "#047857");
      }
      
      ctx.fillStyle = plateGradient;
      ctx.fillRect(plate.x, plate.y, plate.width, plate.height);
      
      // Plate boundary
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.strokeRect(plate.x, plate.y, plate.width, plate.height);
      
      // Velocity arrow
      const arrowY = plate.y - 20;
      const arrowLength = Math.abs(plate.velocityX) * 1000;
      const arrowX = plate.x + plate.width / 2;
      
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX + (plate.velocityX > 0 ? arrowLength : -arrowLength), arrowY);
      ctx.stroke();
      
      // Arrow head
      const headSize = 8;
      const headX = arrowX + (plate.velocityX > 0 ? arrowLength : -arrowLength);
      ctx.beginPath();
      if (plate.velocityX > 0) {
        ctx.moveTo(headX, arrowY);
        ctx.lineTo(headX - headSize, arrowY - headSize/2);
        ctx.lineTo(headX - headSize, arrowY + headSize/2);
        ctx.closePath();
      } else {
        ctx.moveTo(headX, arrowY);
        ctx.lineTo(headX + headSize, arrowY - headSize/2);
        ctx.lineTo(headX + headSize, arrowY + headSize/2);
        ctx.closePath();
      }
      ctx.fillStyle = "#f97316";
      ctx.fill();
      
      // Plate label
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(plate.name, plate.x + plate.width / 2, plate.y + plate.height / 2);
      
      // Age label
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.fillText(`${plate.age}Ma`, plate.x + plate.width / 2, plate.y + plate.height / 2 + 15);
    }
  }

  function drawMagmaFlow() {
    if (!showMagma) return;
    
    const collisionX = plates[0].x + plates[0].width;
    
    // Subducting plate path (showing melting)
    ctx.strokeStyle = MAGMA_COLOR;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    
    ctx.beginPath();
    ctx.moveTo(collisionX, plates[0].y + plates[0].height);
    ctx.quadraticCurveTo(
      collisionX + 50,
      plates[1].y + plates[1].height + 50,
      collisionX + 100,
      height * 0.8
    );
    ctx.stroke();
    
    // Magma rising to surface
    ctx.beginPath();
    ctx.moveTo(collisionX + 80, height * 0.8);
    ctx.lineTo(collisionX + 60, plates[1].y);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    // Magma chamber
    ctx.fillStyle = "rgba(249, 115, 22, 0.6)";
    ctx.beginPath();
    ctx.ellipse(collisionX + 70, height * 0.75, 25, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Animated magma bubbles
    for (let i = 0; i < 5; i++) {
      const bubbleX = collisionX + 70 + (Math.random() - 0.5) * 40;
      const bubbleY = height * 0.75 + (Math.random() - 0.5) * 20;
      const size = 2 + Math.random() * 3;
      const alpha = 0.3 + 0.4 * Math.sin(animationTime * 3 + i);
      
      ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;
      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGeologicalFeatures() {
    for (const feature of features) {
      switch (feature.type) {
        case "volcano":
          // Volcano cone
          ctx.fillStyle = MOUNTAIN_COLOR;
          const coneHeight = 30 * feature.intensity;
          const coneWidth = 20 * feature.intensity;
          
          ctx.beginPath();
          ctx.moveTo(feature.x - coneWidth/2, feature.y);
          ctx.lineTo(feature.x, feature.y - coneHeight);
          ctx.lineTo(feature.x + coneWidth/2, feature.y);
          ctx.closePath();
          ctx.fill();
          
          // Eruption
          if (feature.active && Math.random() < 0.3) {
            ctx.fillStyle = VOLCANO_COLOR;
            for (let i = 0; i < 3; i++) {
              const particleX = feature.x + (Math.random() - 0.5) * 10;
              const particleY = feature.y - coneHeight - Math.random() * 20;
              ctx.beginPath();
              ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
          
        case "mountain":
          // Mountain range
          ctx.fillStyle = MOUNTAIN_COLOR;
          const mountainHeight = 25 * feature.intensity;
          const mountainWidth = 30 * feature.intensity;
          
          ctx.beginPath();
          ctx.moveTo(feature.x - mountainWidth/2, feature.y);
          ctx.lineTo(feature.x - mountainWidth/4, feature.y - mountainHeight);
          ctx.lineTo(feature.x + mountainWidth/4, feature.y - mountainHeight);
          ctx.lineTo(feature.x + mountainWidth/2, feature.y);
          ctx.closePath();
          ctx.fill();
          break;
          
        case "trench":
          // Ocean trench
          ctx.strokeStyle = "#1e3a8a";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(feature.x, feature.y, 15 * feature.intensity, 0, Math.PI, false);
          ctx.stroke();
          break;
          
        case "earthquake":
          // Earthquake epicenter
          if (feature.active) {
            const pulseRadius = 5 + 10 * Math.sin(animationTime * 8) * feature.intensity;
            ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 * feature.intensity})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(feature.x, feature.y, pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Seismic waves
            for (let r = pulseRadius; r < 50; r += 15) {
              ctx.strokeStyle = `rgba(251, 191, 36, ${0.2 * feature.intensity * (50 - r) / 50})`;
              ctx.beginPath();
              ctx.arc(feature.x, feature.y, r, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          break;
      }
    }
  }

  function drawInfoPanel() {
    const convergenceRateMmYear = convergenceRate * 10; // convert to mm/year for display
    const collisionX = plates[0].x + plates[0].width;
    const collision = collisionX >= plates[1].x - 20;
    
    const panelX = 15;
    const panelY = 15;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 320, lineH * 10 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 320, lineH * 10 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#f97316";
    ctx.fillText("Plate Tectonics", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Convergence rate: ${convergenceRateMmYear} mm/year`, x, y);
    y += lineH;
    
    ctx.fillText(`Time scale: ${timeScale}x accelerated`, x, y);
    y += lineH;
    
    ctx.fillStyle = "#2563eb";
    ctx.fillText("Oceanic Plate: Dense, young, subducts", x, y);
    y += lineH;
    
    ctx.fillStyle = "#059669";
    ctx.fillText("Continental Plate: Light, old, rises", x, y);
    y += lineH;
    
    if (collision) {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("⚠ Active convergent boundary", x, y);
      y += lineH;
      
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText("• Ocean trench formation", x, y);
      y += lineH;
      
      ctx.fillText("• Volcanic arc development", x, y);
      y += lineH;
      
      ctx.fillText("• Mountain building", x, y);
      y += lineH;
      
      ctx.fillText("• Seismic activity", x, y);
    } else {
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText("Plates approaching...", x, y);
      y += lineH * 5;
    }
  }

  function drawLegend() {
    const legendX = width - 150;
    const legendY = height - 120;
    const lineH = 16;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.beginPath();
    ctx.roundRect(legendX - 10, legendY - 10, 140, lineH * 6 + 20, 6);
    ctx.fill();
    
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let y = legendY;
    
    // Legend items
    const legendItems = [
      { color: VOLCANO_COLOR, text: "Volcano" },
      { color: MOUNTAIN_COLOR, text: "Mountains" },
      { color: "#1e3a8a", text: "Ocean trench" },
      { color: EARTHQUAKE_COLOR, text: "Earthquake" },
      { color: MAGMA_COLOR, text: "Magma flow" }
    ];
    
    for (const item of legendItems) {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, y + 3, 8, 8);
      
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(item.text, legendX + 12, y);
      y += lineH;
    }
    
    // Show magma toggle
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(showMagma ? "Magma: ON" : "Magma: OFF", legendX, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },

    update(dt: number, params: Record<string, number>) {
      convergenceRate = params.convergenceRate ?? convergenceRate;
      timeScale = params.timeScale ?? timeScale;
      showMagma = (params.showMagma ?? 1) > 0.5;
      
      time += dt;
      animationTime += dt;
      
      updatePlateMovement(dt);
      
      // Age earthquake features
      for (const feature of features) {
        if (feature.type === "earthquake") {
          feature.intensity *= 0.99; // fade over time
          if (feature.intensity < 0.1) {
            feature.active = false;
          }
        }
      }
    },

    render() {
      // Clear and draw background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw Earth layers
      drawEarthCrossSection();
      
      // Draw tectonic plates
      drawPlates();
      
      // Draw magma if enabled
      drawMagmaFlow();
      
      // Draw geological features
      drawGeologicalFeatures();
      
      // UI elements
      drawInfoPanel();
      drawLegend();
    },

    reset() {
      time = 0;
      animationTime = 0;
      plates[0].x = 50;
      plates[1].x = 450;
      features.length = 0;
    },

    destroy() {
      features.length = 0;
    },

    getStateDescription(): string {
      const collisionX = plates[0].x + plates[0].width;
      const collision = collisionX >= plates[1].x - 20;
      const activeFeatures = features.filter(f => f.active).length;
      
      return (
        `Plate Tectonics: ${collision ? 'Active' : 'Approaching'} convergent boundary between oceanic and continental plates. ` +
        `Convergence rate: ${convergenceRate * 10}mm/year. ${collision ? 
          `Active geological processes: ${activeFeatures} features including volcanism, mountain building, trenches, and earthquakes. ` +
          `Dense oceanic plate subducts beneath buoyant continental plate, creating magma from melting and pressure.` : 
          'Plates moving toward collision zone.'} Time scale: ${timeScale}x accelerated.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default PlateTectonics;