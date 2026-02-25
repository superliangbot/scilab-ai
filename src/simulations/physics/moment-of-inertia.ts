import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Moment of Inertia: I = Σmᵢrᵢ²
 * Interactive demonstration showing:
 * - Parallel axis theorem: I = Icm + md²
 * - Different shapes and their moment of inertia formulas
 * - Effect of mass distribution on rotational motion
 * - Angular acceleration: τ = Iα
 * - Comparison of different objects rolling down an incline
 */

interface RotationalObject {
  name: string;
  shape: string;
  mass: number; // kg
  dimension1: number; // radius or length (m)
  dimension2?: number; // width for rectangular objects (m)
  momentFormula: string;
  color: string;
  position: {x: number, y: number, angle: number};
  velocity: {angular: number};
  centerOfMass: {x: number, y: number};
}

interface MassPoint {
  x: number;
  y: number;
  mass: number;
  distance: number; // from rotation axis
}

const MomentOfInertiaFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("moment-of-inertia") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Simulation parameters
  let selectedShape = 0; // index of current shape
  let showMassPoints = 1;
  let showAxis = 1;
  let appliedTorque = 0.5; // N⋅m
  let axisDistance = 0; // distance from center of mass (for parallel axis theorem)

  // Predefined objects
  let objects: RotationalObject[] = [];
  let currentObject: RotationalObject | null = null;
  let massPoints: MassPoint[] = [];

  // Animation state
  let isRotating = false;
  let rotationAxis = {x: 0, y: 0}; // screen coordinates

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    
    setupObjects();
    selectObject(0);
  }

  function setupObjects(): void {
    objects = [
      {
        name: "Point Mass",
        shape: "point",
        mass: 1.0,
        dimension1: 0.1, // distance from axis
        momentFormula: "I = mr²",
        color: "#ef4444",
        position: {x: width * 0.3, y: height * 0.4, angle: 0},
        velocity: {angular: 0},
        centerOfMass: {x: width * 0.3, y: height * 0.4}
      },
      {
        name: "Solid Disk",
        shape: "disk",
        mass: 2.0,
        dimension1: 0.2, // radius
        momentFormula: "I = ½mr²",
        color: "#3b82f6",
        position: {x: width * 0.3, y: height * 0.4, angle: 0},
        velocity: {angular: 0},
        centerOfMass: {x: width * 0.3, y: height * 0.4}
      },
      {
        name: "Ring",
        shape: "ring",
        mass: 1.5,
        dimension1: 0.2, // radius
        momentFormula: "I = mr²",
        color: "#10b981",
        position: {x: width * 0.3, y: height * 0.4, angle: 0},
        velocity: {angular: 0},
        centerOfMass: {x: width * 0.3, y: height * 0.4}
      },
      {
        name: "Solid Sphere",
        shape: "sphere",
        mass: 2.5,
        dimension1: 0.15, // radius
        momentFormula: "I = ⅖mr²",
        color: "#f59e0b",
        position: {x: width * 0.3, y: height * 0.4, angle: 0},
        velocity: {angular: 0},
        centerOfMass: {x: width * 0.3, y: height * 0.4}
      },
      {
        name: "Rod (center)",
        shape: "rod_center",
        mass: 1.2,
        dimension1: 0.4, // length
        momentFormula: "I = 1/12 mL²",
        color: "#8b5cf6",
        position: {x: width * 0.3, y: height * 0.4, angle: 0},
        velocity: {angular: 0},
        centerOfMass: {x: width * 0.3, y: height * 0.4}
      },
      {
        name: "Rod (end)",
        shape: "rod_end",
        mass: 1.2,
        dimension1: 0.4, // length
        momentFormula: "I = ⅓mL²",
        color: "#ec4899",
        position: {x: width * 0.3, y: height * 0.4, angle: 0},
        velocity: {angular: 0},
        centerOfMass: {x: width * 0.3, y: height * 0.4}
      }
    ];
  }

  function selectObject(index: number): void {
    selectedShape = Math.max(0, Math.min(index, objects.length - 1));
    currentObject = objects[selectedShape];
    
    // Reset position and rotation
    currentObject.position.angle = 0;
    currentObject.velocity.angular = 0;
    
    // Set rotation axis
    if (axisDistance === 0) {
      rotationAxis.x = currentObject.centerOfMass.x;
      rotationAxis.y = currentObject.centerOfMass.y;
    } else {
      rotationAxis.x = currentObject.centerOfMass.x + axisDistance * 200; // pixels per meter
      rotationAxis.y = currentObject.centerOfMass.y;
    }

    generateMassPoints();
  }

  function generateMassPoints(): void {
    if (!currentObject) return;
    
    massPoints = [];
    const pointCount = 20;
    
    switch (currentObject.shape) {
      case "point":
        massPoints.push({
          x: currentObject.centerOfMass.x,
          y: currentObject.centerOfMass.y,
          mass: currentObject.mass,
          distance: axisDistance + currentObject.dimension1
        });
        break;
        
      case "disk":
      case "sphere":
        // Distribute points radially
        const radius = currentObject.dimension1 * 200; // pixels
        for (let i = 0; i < pointCount; i++) {
          const angle = (i / pointCount) * 2 * Math.PI;
          const r = Math.sqrt(Math.random()) * radius; // uniform distribution
          const x = currentObject.centerOfMass.x + r * Math.cos(angle);
          const y = currentObject.centerOfMass.y + r * Math.sin(angle);
          const distanceFromAxis = Math.sqrt(
            Math.pow(x - rotationAxis.x, 2) + Math.pow(y - rotationAxis.y, 2)
          ) / 200; // convert to meters
          
          massPoints.push({
            x, y,
            mass: currentObject.mass / pointCount,
            distance: distanceFromAxis
          });
        }
        break;
        
      case "ring":
        // Points on circumference only
        const ringRadius = currentObject.dimension1 * 200;
        for (let i = 0; i < pointCount; i++) {
          const angle = (i / pointCount) * 2 * Math.PI;
          const x = currentObject.centerOfMass.x + ringRadius * Math.cos(angle);
          const y = currentObject.centerOfMass.y + ringRadius * Math.sin(angle);
          const distanceFromAxis = Math.sqrt(
            Math.pow(x - rotationAxis.x, 2) + Math.pow(y - rotationAxis.y, 2)
          ) / 200;
          
          massPoints.push({
            x, y,
            mass: currentObject.mass / pointCount,
            distance: distanceFromAxis
          });
        }
        break;
        
      case "rod_center":
      case "rod_end":
        // Points along rod
        const rodLength = currentObject.dimension1 * 200;
        const startX = currentObject.centerOfMass.x - rodLength/2;
        
        for (let i = 0; i < pointCount; i++) {
          const x = startX + (i / (pointCount - 1)) * rodLength;
          const y = currentObject.centerOfMass.y;
          const distanceFromAxis = Math.abs(x - rotationAxis.x) / 200;
          
          massPoints.push({
            x, y,
            mass: currentObject.mass / pointCount,
            distance: distanceFromAxis
          });
        }
        break;
    }
  }

  function calculateMomentOfInertia(): number {
    if (!currentObject) return 0;
    
    const m = currentObject.mass;
    const r = currentObject.dimension1;
    const d = axisDistance;
    
    let Icm = 0; // moment about center of mass
    
    switch (currentObject.shape) {
      case "point":
        Icm = 0;
        break;
      case "disk":
        Icm = 0.5 * m * r * r;
        break;
      case "ring":
        Icm = m * r * r;
        break;
      case "sphere":
        Icm = 0.4 * m * r * r;
        break;
      case "rod_center":
        Icm = (1/12) * m * r * r;
        break;
      case "rod_end":
        Icm = (1/3) * m * r * r;
        break;
    }
    
    // Parallel axis theorem: I = Icm + md²
    return Icm + m * d * d;
  }

  function calculateDiscreteInertia(): number {
    // Calculate from mass points for comparison
    return massPoints.reduce((sum, point) => {
      return sum + point.mass * point.distance * point.distance;
    }, 0);
  }

  function update(dt: number, params: Record<string, number>): void {
    const newShape = Math.round(params.selectedShape ?? 0);
    showMassPoints = params.showMassPoints ?? 1;
    showAxis = params.showAxis ?? 1;
    appliedTorque = params.appliedTorque ?? 0.5;
    axisDistance = (params.axisDistance ?? 0) / 100; // convert cm to m

    if (newShape !== selectedShape) {
      selectObject(newShape);
    }

    // Update rotation axis position when axisDistance changes
    if (currentObject) {
      rotationAxis.x = currentObject.centerOfMass.x + axisDistance * 200;
      rotationAxis.y = currentObject.centerOfMass.y;
      generateMassPoints();
    }

    time += dt;

    // Apply rotational dynamics: τ = Iα
    if (currentObject && appliedTorque !== 0) {
      const I = calculateMomentOfInertia();
      const alpha = appliedTorque / I; // angular acceleration
      
      currentObject.velocity.angular += alpha * dt;
      currentObject.position.angle += currentObject.velocity.angular * dt;
      
      isRotating = true;
    } else {
      isRotating = false;
    }

    // Apply damping
    if (currentObject) {
      currentObject.velocity.angular *= 0.98;
      if (Math.abs(currentObject.velocity.angular) < 0.01) {
        currentObject.velocity.angular = 0;
      }
    }
  }

  function drawObject(): void {
    if (!currentObject) return;

    ctx.save();
    ctx.translate(currentObject.centerOfMass.x, currentObject.centerOfMass.y);
    ctx.rotate(currentObject.position.angle);

    const pixelRadius = currentObject.dimension1 * 200;
    const pixelLength = currentObject.dimension1 * 200;

    switch (currentObject.shape) {
      case "point":
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = currentObject.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
        
      case "disk":
        const diskGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, pixelRadius);
        diskGrad.addColorStop(0, currentObject.color);
        diskGrad.addColorStop(1, currentObject.color + "60");
        
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius, 0, Math.PI * 2);
        ctx.fillStyle = diskGrad;
        ctx.fill();
        ctx.strokeStyle = currentObject.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Radius line to show rotation
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pixelRadius, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
        
      case "sphere":
        const sphereGrad = ctx.createRadialGradient(-pixelRadius/3, -pixelRadius/3, 0, 0, 0, pixelRadius);
        sphereGrad.addColorStop(0, "#ffffff40");
        sphereGrad.addColorStop(0.7, currentObject.color);
        sphereGrad.addColorStop(1, currentObject.color + "80");
        
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();
        
        // Highlight line
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pixelRadius * 0.8, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
        
      case "ring":
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius, 0, Math.PI * 2);
        ctx.strokeStyle = currentObject.color;
        ctx.lineWidth = 12;
        ctx.stroke();
        
        // Radius line
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pixelRadius, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
        
      case "rod_center":
      case "rod_end":
        ctx.fillStyle = currentObject.color;
        ctx.fillRect(-pixelLength/2, -8, pixelLength, 16);
        
        // Center mark
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-2, -8, 4, 16);
        
        // End marks
        ctx.fillRect(-pixelLength/2-2, -10, 4, 20);
        ctx.fillRect(pixelLength/2-2, -10, 4, 20);
        break;
    }

    ctx.restore();
  }

  function drawMassPoints(): void {
    if (!showMassPoints || massPoints.length === 0) return;

    // Draw mass points
    massPoints.forEach((point, i) => {
      const angle = currentObject?.position.angle ?? 0;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Rotate point around center of mass
      const relX = point.x - currentObject!.centerOfMass.x;
      const relY = point.y - currentObject!.centerOfMass.y;
      
      const rotatedX = currentObject!.centerOfMass.x + relX * cos - relY * sin;
      const rotatedY = currentObject!.centerOfMass.y + relX * sin + relY * cos;
      
      // Point size based on mass
      const size = Math.max(2, Math.sqrt(point.mass) * 3);
      
      ctx.beginPath();
      ctx.arc(rotatedX, rotatedY, size, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fill();
      
      // Distance line to axis
      if (showAxis) {
        ctx.beginPath();
        ctx.moveTo(rotatedX, rotatedY);
        ctx.lineTo(rotationAxis.x, rotationAxis.y);
        ctx.strokeStyle = "rgba(255, 100, 100, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  function drawRotationAxis(): void {
    if (!showAxis) return;

    // Axis line (vertical)
    ctx.beginPath();
    ctx.moveTo(rotationAxis.x, rotationAxis.y - 100);
    ctx.lineTo(rotationAxis.x, rotationAxis.y + 100);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axis point
    ctx.beginPath();
    ctx.arc(rotationAxis.x, rotationAxis.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Axis label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Axis", rotationAxis.x, rotationAxis.y - 110);
  }

  function drawCalculations(): void {
    const calcX = width * 0.55;
    const calcY = height * 0.05;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(calcX, calcY, width * 0.4, height * 0.4, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Moment of Inertia Calculation", calcX + width * 0.2, calcY + 20);

    if (!currentObject) return;

    const I_analytical = calculateMomentOfInertia();
    const I_discrete = calculateDiscreteInertia();
    const Icm = I_analytical - currentObject.mass * axisDistance * axisDistance;

    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";

    const lines = [
      "",
      `Object: ${currentObject.name}`,
      `Mass: m = ${currentObject.mass.toFixed(1)} kg`,
      `Dimension: ${currentObject.dimension1.toFixed(2)} m`,
      "",
      `Formula: ${currentObject.momentFormula}`,
      `Icm = ${Icm.toFixed(4)} kg⋅m²`,
      "",
      axisDistance > 0 ? "Parallel Axis Theorem:" : "",
      axisDistance > 0 ? `I = Icm + md²` : "",
      axisDistance > 0 ? `d = ${axisDistance.toFixed(3)} m` : "",
      axisDistance > 0 ? `md² = ${(currentObject.mass * axisDistance * axisDistance).toFixed(4)} kg⋅m²` : "",
      "",
      `Total I = ${I_analytical.toFixed(4)} kg⋅m²`,
      `Discrete I = ${I_discrete.toFixed(4)} kg⋅m²`,
      `Error = ${(Math.abs(I_analytical - I_discrete) / I_analytical * 100).toFixed(1)}%`,
    ];

    lines.forEach((line, i) => {
      if (line === "" || line.includes(":") && !line.includes("=")) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        ctx.font = line.includes(":") ? "bold 12px system-ui, sans-serif" : "13px system-ui, sans-serif";
      } else if (line.includes("Total I") || line.includes("Formula")) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 13px system-ui, sans-serif";
      } else {
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = "12px system-ui, sans-serif";
      }
      
      if (line !== "") {
        ctx.fillText(line, calcX + 15, calcY + 45 + i * 16);
      }
    });
  }

  function drawDynamics(): void {
    if (!currentObject) return;

    const dynX = width * 0.55;
    const dynY = height * 0.5;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(dynX, dynY, width * 0.4, height * 0.4, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Rotational Dynamics", dynX + width * 0.2, dynY + 20);

    const I = calculateMomentOfInertia();
    const alpha = appliedTorque / I;
    const omega = currentObject.velocity.angular;
    const kineticEnergy = 0.5 * I * omega * omega;

    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";

    const lines = [
      "",
      "Newton's Second Law (Rotation):",
      "τ = Iα",
      "",
      `Applied torque: τ = ${appliedTorque.toFixed(2)} N⋅m`,
      `Moment of inertia: I = ${I.toFixed(4)} kg⋅m²`,
      `Angular acceleration: α = ${alpha.toFixed(2)} rad/s²`,
      `Angular velocity: ω = ${omega.toFixed(2)} rad/s`,
      "",
      "Rotational Kinetic Energy:",
      "KE = ½Iω²",
      `KE = ${kineticEnergy.toFixed(3)} J`,
      "",
      `Period (if oscillating): T = ${(2*Math.PI/Math.abs(omega)||0).toFixed(1)} s`,
    ];

    lines.forEach((line, i) => {
      if (line === "" || (line.includes(":") && !line.includes("="))) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        ctx.font = line.includes(":") ? "bold 12px system-ui, sans-serif" : "13px system-ui, sans-serif";
      } else if (line === "τ = Iα" || line === "KE = ½Iω²") {
        ctx.fillStyle = "#3b82f6";
        ctx.font = "bold 14px system-ui, sans-serif";
      } else {
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = "12px system-ui, sans-serif";
      }
      
      if (line !== "") {
        ctx.fillText(line, dynX + 15, dynY + 45 + i * 16);
      }
    });

    // Angular velocity indicator
    if (Math.abs(omega) > 0.1) {
      const indicatorX = dynX + width * 0.35;
      const indicatorY = dynY + height * 0.2;
      
      ctx.save();
      ctx.translate(indicatorX, indicatorY);
      
      // Circle
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Rotating arrow
      ctx.rotate(currentObject.position.angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(25, 0);
      ctx.strokeStyle = omega > 0 ? "#10b981" : "#ef4444";
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(25, 0);
      ctx.lineTo(20, -4);
      ctx.lineTo(20, 4);
      ctx.closePath();
      ctx.fillStyle = omega > 0 ? "#10b981" : "#ef4444";
      ctx.fill();
      
      ctx.restore();
      
      // Direction indicator
      ctx.fillStyle = omega > 0 ? "#10b981" : "#ef4444";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(omega > 0 ? "CCW" : "CW", indicatorX, indicatorY + 45);
    }
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Draw components
    drawRotationAxis();
    drawObject();
    drawMassPoints();
    drawCalculations();
    drawDynamics();

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = `bold ${Math.max(18, width * 0.028)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Moment of Inertia", width/2, 30);

    // Subtitle
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = `${Math.max(12, width * 0.018)}px system-ui, sans-serif`;
    ctx.fillText("I = Σmᵢrᵢ² and Parallel Axis Theorem", width/2, 50);

    // Instructions
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Adjust shape, torque, and axis position to explore rotational inertia", 20, height - 15);
  }

  function reset(): void {
    time = 0;
    if (currentObject) {
      currentObject.position.angle = 0;
      currentObject.velocity.angular = 0;
    }
  }

  function destroy(): void {
    objects = [];
    massPoints = [];
  }

  function getStateDescription(): string {
    if (!currentObject) return "No object selected";
    
    const I = calculateMomentOfInertia();
    const omega = currentObject.velocity.angular;
    const alpha = appliedTorque / I;
    const KE = 0.5 * I * omega * omega;

    return (
      `Moment of Inertia: ${currentObject.name}, m=${currentObject.mass}kg, ` +
      `I=${I.toFixed(4)} kg⋅m². Formula: ${currentObject.momentFormula}. ` +
      `Dynamics: τ=${appliedTorque}N⋅m, α=${alpha.toFixed(2)}rad/s², ` +
      `ω=${omega.toFixed(2)}rad/s, KE=${KE.toFixed(3)}J. ` +
      `${axisDistance > 0 ? `Parallel axis: d=${axisDistance.toFixed(3)}m, ` +
        `demonstrating I=Icm+md².` : 'Rotation about center of mass.'}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    setupObjects();
    if (currentObject) {
      selectObject(selectedShape);
    }
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MomentOfInertiaFactory;