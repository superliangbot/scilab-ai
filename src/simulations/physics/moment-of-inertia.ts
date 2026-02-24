import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Shape {
  type: "solid-disk" | "hollow-disk" | "solid-sphere" | "hollow-sphere" | "rod" | "rectangle";
  mass: number;
  radius: number;
  length: number;
  width: number;
  momentOfInertia: number;
  color: string;
  rotationAngle: number;
  angularVelocity: number;
}

const MomentOfInertiaFactory: SimulationFactory = () => {
  const config = getSimConfig("moment-of-inertia") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let shapeType = 0; // 0=solid disk, 1=hollow disk, 2=solid sphere, etc.
  let mass = 2;
  let radius = 50;
  let length = 100;
  let appliedTorque = 5;
  let showRotation = 1;

  // Current shape
  let currentShape: Shape;

  // Rotation simulation
  let angularAcceleration = 0;
  let rotationHistory: { angle: number; velocity: number; time: number }[] = [];

  const shapeTemplates = [
    { type: "solid-disk", name: "Solid Disk", formula: "I = ½mr²", color: "#3b82f6" },
    { type: "hollow-disk", name: "Hollow Disk/Ring", formula: "I = mr²", color: "#ef4444" },
    { type: "solid-sphere", name: "Solid Sphere", formula: "I = ⅖mr²", color: "#10b981" },
    { type: "hollow-sphere", name: "Hollow Sphere", formula: "I = ⅔mr²", color: "#f59e0b" },
    { type: "rod", name: "Rod (about center)", formula: "I = 1/12 ml²", color: "#8b5cf6" },
    { type: "rectangle", name: "Rectangle (about center)", formula: "I = 1/12 m(w²+h²)", color: "#ec4899" },
  ] as const;

  function calculateMomentOfInertia(shape: Shape): number {
    const { type, mass, radius, length, width } = shape;
    
    switch (type) {
      case "solid-disk":
        return 0.5 * mass * radius * radius;
      case "hollow-disk":
        return mass * radius * radius;
      case "solid-sphere":
        return 0.4 * mass * radius * radius;
      case "hollow-sphere":
        return (2/3) * mass * radius * radius;
      case "rod":
        return (1/12) * mass * length * length;
      case "rectangle":
        return (1/12) * mass * (width * width + length * length);
      default:
        return mass * radius * radius;
    }
  }

  function initShape() {
    const template = shapeTemplates[shapeType];
    currentShape = {
      type: template.type,
      mass,
      radius,
      length,
      width: length * 0.6,
      momentOfInertia: 0,
      color: template.color,
      rotationAngle: 0,
      angularVelocity: 0,
    };
    
    currentShape.momentOfInertia = calculateMomentOfInertia(currentShape);
    rotationHistory = [];
  }

  function updatePhysics(dt: number) {
    // Angular acceleration: α = τ/I
    angularAcceleration = appliedTorque / currentShape.momentOfInertia;
    
    // Update angular velocity: ω = ω₀ + αt
    currentShape.angularVelocity += angularAcceleration * dt;
    
    // Update rotation angle: θ = θ₀ + ω₀t + ½αt²
    currentShape.rotationAngle += currentShape.angularVelocity * dt + 0.5 * angularAcceleration * dt * dt;
    
    // Keep angle in reasonable range
    currentShape.rotationAngle = currentShape.rotationAngle % (2 * Math.PI);
    
    // Store history for graphs
    if (rotationHistory.length > 200) rotationHistory.shift();
    rotationHistory.push({
      angle: currentShape.rotationAngle,
      velocity: currentShape.angularVelocity,
      time: time
    });
  }

  function drawShape(x: number, y: number, shape: Shape) {
    ctx.save();
    ctx.translate(x, y);
    
    if (showRotation) {
      ctx.rotate(shape.rotationAngle);
    }

    const gradient = ctx.createRadialGradient(-10, -10, 0, 0, 0, Math.max(shape.radius, shape.length/2));
    gradient.addColorStop(0, shape.color + "ff");
    gradient.addColorStop(1, shape.color + "80");

    ctx.fillStyle = gradient;
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = 3;

    switch (shape.type) {
      case "solid-disk":
        ctx.beginPath();
        ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw radius line for rotation visualization
        if (showRotation) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(shape.radius - 5, 0);
          ctx.stroke();
          
          // Draw small masses around edge
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const px = Math.cos(angle) * shape.radius * 0.8;
            const py = Math.sin(angle) * shape.radius * 0.8;
            ctx.fillStyle = "#ffffff80";
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case "hollow-disk":
        // Outer circle
        ctx.beginPath();
        ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner circle (hollow)
        ctx.beginPath();
        ctx.arc(0, 0, shape.radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = shape.color + "40";
        ctx.stroke();
        
        // Spokes
        if (showRotation) {
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = 4;
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * shape.radius * 0.6, Math.sin(angle) * shape.radius * 0.6);
            ctx.lineTo(Math.cos(angle) * shape.radius, Math.sin(angle) * shape.radius);
            ctx.stroke();
          }
        }
        break;

      case "solid-sphere":
        // Main sphere
        ctx.beginPath();
        ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Meridian lines for 3D effect
        if (showRotation) {
          ctx.strokeStyle = "#ffffff60";
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, shape.radius * Math.cos(i * Math.PI / 6), shape.radius, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        break;

      case "hollow-sphere":
        // Outer sphere outline
        ctx.beginPath();
        ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner circle to show hollow
        ctx.beginPath();
        ctx.arc(0, 0, shape.radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = shape.color + "40";
        ctx.stroke();
        
        // Meridian lines
        if (showRotation) {
          ctx.strokeStyle = shape.color + "80";
          ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, shape.radius * Math.cos(i * Math.PI / 8), shape.radius, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        break;

      case "rod":
        ctx.fillRect(-shape.length / 2, -5, shape.length, 10);
        ctx.strokeRect(-shape.length / 2, -5, shape.length, 10);
        
        // Mass points along rod
        if (showRotation) {
          const numPoints = 7;
          ctx.fillStyle = "#ffffff";
          for (let i = 0; i < numPoints; i++) {
            const x = -shape.length / 2 + (shape.length * i) / (numPoints - 1);
            ctx.beginPath();
            ctx.arc(x, 0, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case "rectangle":
        const w = shape.width;
        const h = shape.length;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        
        // Diagonal lines for rotation reference
        if (showRotation) {
          ctx.strokeStyle = "#ffffff60";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-w / 2, -h / 2);
          ctx.lineTo(w / 2, h / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(w / 2, -h / 2);
          ctx.lineTo(-w / 2, h / 2);
          ctx.stroke();
        }
        break;
    }

    ctx.restore();

    // Draw rotation axis
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, y - Math.max(shape.radius, shape.length/2) - 20);
    ctx.lineTo(x, y + Math.max(shape.radius, shape.length/2) + 20);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Axis", x, y - Math.max(shape.radius, shape.length/2) - 30);
  }

  function drawTorqueArrow(x: number, y: number) {
    if (Math.abs(appliedTorque) < 0.1) return;
    
    const torqueRadius = Math.max(currentShape.radius, currentShape.length/2) + 25;
    const arrowAngle = appliedTorque > 0 ? Math.PI / 4 : -Math.PI / 4;
    
    // Curved arrow for torque
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const startAngle = appliedTorque > 0 ? -Math.PI/3 : Math.PI/3;
    const endAngle = appliedTorque > 0 ? Math.PI/3 : -Math.PI/3;
    
    ctx.arc(x, y, torqueRadius, startAngle, endAngle);
    ctx.stroke();
    
    // Arrow head
    const headX = x + Math.cos(endAngle) * torqueRadius;
    const headY = y + Math.sin(endAngle) * torqueRadius;
    const headAngle = endAngle + (appliedTorque > 0 ? Math.PI/2 : -Math.PI/2);
    
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    ctx.lineTo(headX + Math.cos(headAngle + 0.5) * 10, headY + Math.sin(headAngle + 0.5) * 10);
    ctx.lineTo(headX + Math.cos(headAngle - 0.5) * 10, headY + Math.sin(headAngle - 0.5) * 10);
    ctx.closePath();
    ctx.fill();
    
    // Torque label
    ctx.fillStyle = "#ef4444";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`τ = ${appliedTorque.toFixed(1)} N⋅m`, x, y - torqueRadius - 15);
  }

  function drawGraphs() {
    const graphX = W * 0.05;
    const graphY = H * 0.7;
    const graphW = W * 0.4;
    const graphH = H * 0.25;
    
    // Angular velocity vs time graph
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    if (rotationHistory.length > 1) {
      const maxVel = Math.max(...rotationHistory.map(h => Math.abs(h.velocity)), 1);
      
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < rotationHistory.length; i++) {
        const point = rotationHistory[i];
        const x = graphX + (i / rotationHistory.length) * graphW;
        const y = graphY + graphH * 0.5 - (point.velocity / maxVel) * graphH * 0.4;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Angular Velocity vs Time", graphX + graphW * 0.5, graphY - 5);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initShape();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newShapeType = Math.round(params.shapeType ?? shapeType);
      mass = params.mass ?? mass;
      radius = params.radius ?? radius;
      length = params.length ?? length;
      appliedTorque = params.torque ?? appliedTorque;
      showRotation = Math.round(params.showRotation ?? showRotation);
      
      if (newShapeType !== shapeType) {
        shapeType = newShapeType;
        initShape();
      } else {
        currentShape.mass = mass;
        currentShape.radius = radius;
        currentShape.length = length;
        currentShape.width = length * 0.6;
        currentShape.momentOfInertia = calculateMomentOfInertia(currentShape);
      }
      
      time += dt;
      updatePhysics(dt);
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
      ctx.fillText("Moment of Inertia", W / 2, 30);
      
      const template = shapeTemplates[shapeType];
      ctx.font = "14px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${template.name}: ${template.formula}`, W / 2, 50);

      // Draw shape in center
      const shapeX = W * 0.4;
      const shapeY = H * 0.4;
      drawShape(shapeX, shapeY, currentShape);
      
      // Draw torque arrow
      drawTorqueArrow(shapeX, shapeY);

      // Information panel
      const panelX = W * 0.02;
      const panelY = H * 0.08;
      const panelW = W * 0.3;
      const panelH = H * 0.25;
      
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX, panelY, panelW, panelH);
      
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      let infoY = panelY + 20;
      
      ctx.fillText(`Shape: ${template.name}`, panelX + 10, infoY);
      infoY += 18;
      ctx.fillText(`Mass: ${mass.toFixed(1)} kg`, panelX + 10, infoY);
      infoY += 18;
      
      if (currentShape.type === "rod" || currentShape.type === "rectangle") {
        ctx.fillText(`Length: ${length.toFixed(1)} m`, panelX + 10, infoY);
      } else {
        ctx.fillText(`Radius: ${radius.toFixed(1)} m`, panelX + 10, infoY);
      }
      infoY += 18;
      
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`I = ${currentShape.momentOfInertia.toFixed(2)} kg⋅m²`, panelX + 10, infoY);
      infoY += 18;
      
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`τ = ${appliedTorque.toFixed(1)} N⋅m`, panelX + 10, infoY);
      infoY += 18;
      
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`α = ${angularAcceleration.toFixed(2)} rad/s²`, panelX + 10, infoY);
      infoY += 18;
      ctx.fillText(`ω = ${currentShape.angularVelocity.toFixed(2)} rad/s`, panelX + 10, infoY);

      // Current values display
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      const valuesX = W * 0.65;
      let valuesY = H * 0.15;
      
      ctx.fillText("Current Values:", valuesX, valuesY);
      valuesY += 20;
      
      const rotationalKE = 0.5 * currentShape.momentOfInertia * currentShape.angularVelocity * currentShape.angularVelocity;
      const angularMomentum = currentShape.momentOfInertia * currentShape.angularVelocity;
      
      ctx.fillText(`Angle: ${(currentShape.rotationAngle * 180 / Math.PI).toFixed(1)}°`, valuesX, valuesY);
      valuesY += 16;
      ctx.fillText(`KE_rot: ${rotationalKE.toFixed(1)} J`, valuesX, valuesY);
      valuesY += 16;
      ctx.fillText(`L: ${angularMomentum.toFixed(1)} kg⋅m²/s`, valuesX, valuesY);

      // Equations display
      ctx.fillStyle = "#10b981";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      const eqY = H * 0.55;
      
      ctx.fillText("τ = Iα", W * 0.7, eqY);
      ctx.fillText("KE = ½Iω²", W * 0.7, eqY + 20);
      ctx.fillText("L = Iω", W * 0.7, eqY + 40);

      // Draw comparison table
      const tableX = W * 0.55;
      const tableY = H * 0.7;
      const tableW = W * 0.42;
      const tableH = H * 0.25;
      
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.fillRect(tableX, tableY, tableW, tableH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(tableX, tableY, tableW, tableH);
      
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Moment of Inertia Formulas", tableX + tableW * 0.5, tableY + 15);
      
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      let tableRowY = tableY + 35;
      
      for (let i = 0; i < shapeTemplates.length; i++) {
        const template = shapeTemplates[i];
        const isSelected = i === shapeType;
        
        ctx.fillStyle = isSelected ? template.color : "#94a3b8";
        ctx.fillText(`${template.name}:`, tableX + 8, tableRowY);
        ctx.fillText(template.formula, tableX + tableW * 0.6, tableRowY);
        
        if (isSelected) {
          ctx.fillStyle = template.color + "40";
          ctx.fillRect(tableX + 3, tableRowY - 10, tableW - 6, 14);
        }
        
        tableRowY += 16;
      }

      // Draw graphs
      drawGraphs();
    },

    reset() {
      time = 0;
      initShape();
    },

    destroy() {},

    getStateDescription(): string {
      const template = shapeTemplates[shapeType];
      const rotationalKE = 0.5 * currentShape.momentOfInertia * currentShape.angularVelocity * currentShape.angularVelocity;
      
      return `Moment of inertia simulation showing ${template.name.toLowerCase()} with I=${currentShape.momentOfInertia.toFixed(2)}kg⋅m². ` +
             `Applied torque: ${appliedTorque.toFixed(1)}N⋅m causes angular acceleration ${angularAcceleration.toFixed(2)}rad/s². ` +
             `Current angular velocity: ${currentShape.angularVelocity.toFixed(2)}rad/s, rotational KE: ${rotationalKE.toFixed(1)}J. ` +
             `Formula: ${template.formula}. Demonstrates relationship τ = Iα.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default MomentOfInertiaFactory;