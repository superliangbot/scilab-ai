import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Rolling Motion Dynamics
 * Demonstrates:
 * - Rolling without slipping: v = ωR
 * - Combined translational and rotational motion
 * - Energy partitioning: KE = ½mv² + ½Iω²
 * - Race between different objects on an incline
 * - Instantaneous center of rotation
 * - Acceleration down incline: a = g sin θ / (1 + I/mR²)
 */

interface RollingObject {
  name: string;
  shape: string;
  mass: number;
  radius: number;
  momentRatio: number; // I/(mR²)
  color: string;
  position: {x: number, y: number, angle: number};
  velocity: {linear: number, angular: number};
  trail: Array<{x: number, y: number, time: number}>;
}

const RollingMotionDynamicsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rolling-motion-dynamics") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physics parameters
  let inclineAngle = 15; // degrees
  let showVectors = 1;
  let showEnergy = 1;
  let raceMode = 0;
  let friction = 0.5; // coefficient

  // Incline geometry
  let inclineTop = {x: 0, y: 0};
  let inclineBottom = {x: 0, y: 0};
  let inclineLength = 0;

  // Objects
  let objects: RollingObject[] = [];
  let selectedObject = 0;

  // Race state
  let raceStarted = false;
  let raceTime = 0;
  let finishOrder: string[] = [];

  // Constants
  const g = 9.81; // m/s²
  const pixelsPerMeter = 100;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    
    setupIncline();
    setupObjects();
    resetPositions();
  }

  function setupIncline(): void {
    inclineTop.x = width * 0.15;
    inclineTop.y = height * 0.25;
    inclineBottom.x = width * 0.85;
    inclineBottom.y = height * 0.75;
    inclineLength = Math.sqrt(
      Math.pow(inclineBottom.x - inclineTop.x, 2) + 
      Math.pow(inclineBottom.y - inclineTop.y, 2)
    ) / pixelsPerMeter;
  }

  function setupObjects(): void {
    objects = [
      {
        name: "Solid Sphere",
        shape: "sphere",
        mass: 1.0,
        radius: 0.05,
        momentRatio: 2/5, // I = (2/5)mR²
        color: "#ef4444",
        position: {x: 0, y: 0, angle: 0},
        velocity: {linear: 0, angular: 0},
        trail: []
      },
      {
        name: "Solid Cylinder", 
        shape: "cylinder",
        mass: 1.0,
        radius: 0.05,
        momentRatio: 1/2, // I = (1/2)mR²
        color: "#3b82f6",
        position: {x: 0, y: 0, angle: 0},
        velocity: {linear: 0, angular: 0},
        trail: []
      },
      {
        name: "Hollow Sphere",
        shape: "hollow_sphere", 
        mass: 1.0,
        radius: 0.05,
        momentRatio: 2/3, // I = (2/3)mR²
        color: "#10b981",
        position: {x: 0, y: 0, angle: 0},
        velocity: {linear: 0, angular: 0},
        trail: []
      },
      {
        name: "Ring/Hoop",
        shape: "ring",
        mass: 1.0,
        radius: 0.05,
        momentRatio: 1, // I = mR²
        color: "#f59e0b",
        position: {x: 0, y: 0, angle: 0},
        velocity: {linear: 0, angular: 0},
        trail: []
      },
      {
        name: "Sliding Block",
        shape: "block",
        mass: 1.0,
        radius: 0.05,
        momentRatio: 0, // no rotation
        color: "#8b5cf6",
        position: {x: 0, y: 0, angle: 0},
        velocity: {linear: 0, angular: 0},
        trail: []
      }
    ];
  }

  function resetPositions(): void {
    objects.forEach((obj, index) => {
      const startDistance = 0.2; // meters from top
      const position = startDistance / inclineLength;
      
      obj.position.x = inclineTop.x + position * (inclineBottom.x - inclineTop.x);
      obj.position.y = inclineTop.y + position * (inclineBottom.y - inclineTop.y);
      
      if (raceMode) {
        // Stagger positions for race
        obj.position.y += (index - 2) * 25;
      }
      
      obj.position.angle = 0;
      obj.velocity.linear = 0;
      obj.velocity.angular = 0;
      obj.trail = [];
    });
    
    raceStarted = false;
    raceTime = 0;
    finishOrder = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    const newAngle = params.inclineAngle ?? 15;
    showVectors = params.showVectors ?? 1;
    showEnergy = params.showEnergy ?? 1;
    const newRaceMode = Math.round(params.raceMode ?? 0);
    friction = params.friction ?? 0.5;
    selectedObject = Math.round(params.selectedObject ?? 0);

    if (newAngle !== inclineAngle) {
      inclineAngle = newAngle;
      setupIncline();
      resetPositions();
    }

    if (newRaceMode !== raceMode) {
      raceMode = newRaceMode;
      resetPositions();
    }

    time += dt;
    if (raceMode && raceStarted) {
      raceTime += dt;
    }

    // Physics simulation
    const angleRad = inclineAngle * Math.PI / 180;
    const sinTheta = Math.sin(angleRad);
    const cosTheta = Math.cos(angleRad);

    const objectsToUpdate = raceMode ? objects : [objects[selectedObject]];

    objectsToUpdate.forEach(obj => {
      // Calculate acceleration down incline
      let acceleration;
      
      if (obj.shape === "block") {
        // Sliding block (no rolling)
        const normalForce = obj.mass * g * cosTheta;
        const frictionForce = friction * normalForce;
        const netForce = obj.mass * g * sinTheta - frictionForce;
        acceleration = netForce / obj.mass;
      } else {
        // Rolling objects: a = g sin θ / (1 + I/mR²)
        acceleration = g * sinTheta / (1 + obj.momentRatio);
      }

      // Update velocities
      obj.velocity.linear += acceleration * dt;
      
      // Rolling constraint: v = ωR
      if (obj.shape !== "block") {
        obj.velocity.angular = obj.velocity.linear / obj.radius;
      }

      // Update positions
      const step = Math.min(dt, 0.016);
      
      // Move along incline
      const distance = obj.velocity.linear * step;
      const direction = Math.atan2(
        inclineBottom.y - inclineTop.y,
        inclineBottom.x - inclineTop.x
      );
      
      obj.position.x += distance * Math.cos(direction) * pixelsPerMeter;
      obj.position.y += distance * Math.sin(direction) * pixelsPerMeter;
      obj.position.angle += obj.velocity.angular * step;

      // Record trail
      obj.trail.push({
        x: obj.position.x,
        y: obj.position.y,
        time: time
      });
      
      if (obj.trail.length > 100) {
        obj.trail.shift();
      }

      // Check finish line
      if (raceMode && obj.position.x > inclineBottom.x - 50) {
        if (!finishOrder.includes(obj.name)) {
          finishOrder.push(obj.name);
        }
      }

      // Prevent objects from going past bottom
      if (obj.position.x > inclineBottom.x) {
        obj.position.x = inclineBottom.x;
        obj.velocity.linear = 0;
        obj.velocity.angular = 0;
      }
    });
  }

  function drawIncline(): void {
    // Incline surface
    const inclineThickness = 20;
    
    // Shadow
    ctx.beginPath();
    ctx.moveTo(inclineTop.x + 3, inclineTop.y + 3);
    ctx.lineTo(inclineBottom.x + 3, inclineBottom.y + 3);
    ctx.lineTo(inclineBottom.x + 3, inclineBottom.y + inclineThickness + 3);
    ctx.lineTo(inclineTop.x + 3, inclineTop.y + inclineThickness + 3);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fill();

    // Main surface
    ctx.beginPath();
    ctx.moveTo(inclineTop.x, inclineTop.y);
    ctx.lineTo(inclineBottom.x, inclineBottom.y);
    ctx.lineTo(inclineBottom.x, inclineBottom.y + inclineThickness);
    ctx.lineTo(inclineTop.x, inclineTop.y + inclineThickness);
    ctx.closePath();
    
    const inclineGrad = ctx.createLinearGradient(
      inclineTop.x, inclineTop.y,
      inclineTop.x, inclineTop.y + inclineThickness
    );
    inclineGrad.addColorStop(0, "#64748b");
    inclineGrad.addColorStop(1, "#374151");
    ctx.fillStyle = inclineGrad;
    ctx.fill();

    // Grid lines for measurement
    ctx.strokeStyle = "rgba(156, 163, 175, 0.3)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const x = inclineTop.x + t * (inclineBottom.x - inclineTop.x);
      const y = inclineTop.y + t * (inclineBottom.y - inclineTop.y);
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 15);
      ctx.stroke();
    }

    // Angle indicator
    const angleRadius = 60;
    const angleArc = inclineAngle * Math.PI / 180;
    
    ctx.beginPath();
    ctx.arc(inclineBottom.x, inclineBottom.y, angleRadius, Math.PI, Math.PI - angleArc, true);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Angle label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${inclineAngle}°`, inclineBottom.x - 30, inclineBottom.y - 10);

    // Finish line
    if (raceMode) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(inclineBottom.x - 50, inclineTop.y);
      ctx.lineTo(inclineBottom.x - 50, inclineBottom.y + 50);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "#ef4444";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FINISH", inclineBottom.x - 50, inclineBottom.y + 70);
    }
  }

  function drawObject(obj: RollingObject): void {
    ctx.save();
    ctx.translate(obj.position.x, obj.position.y);

    const pixelRadius = obj.radius * pixelsPerMeter;

    // Draw trail
    if (obj.trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = obj.color + "40";
      ctx.lineWidth = 3;
      
      for (let i = 0; i < obj.trail.length - 1; i++) {
        const point = obj.trail[i];
        const alpha = i / obj.trail.length;
        
        if (i === 0) {
          ctx.moveTo(point.x - obj.position.x, point.y - obj.position.y);
        } else {
          ctx.lineTo(point.x - obj.position.x, point.y - obj.position.y);
        }
      }
      ctx.stroke();
    }

    // Object shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(5, 10, pixelRadius * 0.8, pixelRadius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(obj.position.angle);

    switch (obj.shape) {
      case "sphere":
        const sphereGrad = ctx.createRadialGradient(
          -pixelRadius/3, -pixelRadius/3, 0, 
          0, 0, pixelRadius
        );
        sphereGrad.addColorStop(0, "#ffffff60");
        sphereGrad.addColorStop(0.7, obj.color);
        sphereGrad.addColorStop(1, obj.color + "80");
        
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();
        
        // Rotation indicator
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pixelRadius * 0.8, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;

      case "hollow_sphere":
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius, 0, Math.PI * 2);
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 6;
        ctx.stroke();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = obj.color + "60";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Spokes
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(pixelRadius * 0.7 * Math.cos(angle), pixelRadius * 0.7 * Math.sin(angle));
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        break;

      case "cylinder":
        const cylGrad = ctx.createLinearGradient(-pixelRadius, 0, pixelRadius, 0);
        cylGrad.addColorStop(0, obj.color + "80");
        cylGrad.addColorStop(0.5, obj.color);
        cylGrad.addColorStop(1, obj.color + "80");
        
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius, 0, Math.PI * 2);
        ctx.fillStyle = cylGrad;
        ctx.fill();
        
        // Side highlights
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Rotation line
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pixelRadius, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;

      case "ring":
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius, 0, Math.PI * 2);
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 8;
        ctx.stroke();
        
        // Inner ring
        ctx.beginPath();
        ctx.arc(0, 0, pixelRadius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = obj.color + "60";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Rotation indicator
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pixelRadius, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;

      case "block":
        ctx.fillStyle = obj.color;
        ctx.fillRect(-pixelRadius, -pixelRadius * 0.7, pixelRadius * 2, pixelRadius * 1.4);
        
        // Highlight
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(-pixelRadius, -pixelRadius * 0.7, pixelRadius * 2, 8);
        break;
    }

    ctx.restore();

    // Velocity vector
    if (showVectors && Math.abs(obj.velocity.linear) > 0.01) {
      const vScale = 20; // pixels per m/s
      const vLength = obj.velocity.linear * vScale;
      const direction = Math.atan2(
        inclineBottom.y - inclineTop.y,
        inclineBottom.x - inclineTop.x
      );

      ctx.beginPath();
      ctx.moveTo(obj.position.x, obj.position.y - pixelRadius - 15);
      ctx.lineTo(
        obj.position.x + vLength * Math.cos(direction),
        obj.position.y - pixelRadius - 15 + vLength * Math.sin(direction)
      );
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrow head
      if (Math.abs(vLength) > 5) {
        const headX = obj.position.x + vLength * Math.cos(direction);
        const headY = obj.position.y - pixelRadius - 15 + vLength * Math.sin(direction);
        
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX - 8 * Math.cos(direction) + 4 * Math.sin(direction), 
                   headY - 8 * Math.sin(direction) - 4 * Math.cos(direction));
        ctx.lineTo(headX - 8 * Math.cos(direction) - 4 * Math.sin(direction), 
                   headY - 8 * Math.sin(direction) + 4 * Math.cos(direction));
        ctx.closePath();
        ctx.fillStyle = "#ef4444";
        ctx.fill();
      }

      // Velocity label
      ctx.fillStyle = "#ef4444";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `v = ${obj.velocity.linear.toFixed(1)} m/s`,
        obj.position.x + vLength/2 * Math.cos(direction),
        obj.position.y - pixelRadius - 25 + vLength/2 * Math.sin(direction)
      );
    }

    // Object label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(obj.name, obj.position.x, obj.position.y + pixelRadius + 20);
  }

  function drawAnalysis(): void {
    const analysisX = width * 0.05;
    const analysisY = height * 0.05;
    const analysisW = width * 0.4;
    const analysisH = height * 0.35;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(analysisX, analysisY, analysisW, analysisH, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Rolling Motion Analysis", analysisX + analysisW/2, analysisY + 20);

    const obj = raceMode ? objects[0] : objects[selectedObject]; // Use first object in race mode
    if (!obj) return;

    // Calculate theoretical acceleration
    const angleRad = inclineAngle * Math.PI / 180;
    const theoreticalAccel = g * Math.sin(angleRad) / (1 + obj.momentRatio);
    
    // Calculate energies
    const translationalKE = 0.5 * obj.mass * obj.velocity.linear * obj.velocity.linear;
    const rotationalKE = 0.5 * (obj.momentRatio * obj.mass * obj.radius * obj.radius) * 
                         obj.velocity.angular * obj.velocity.angular;
    const totalKE = translationalKE + rotationalKE;

    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";

    const lines = [
      "",
      `Object: ${obj.name}`,
      `Moment ratio: I/(mR²) = ${obj.momentRatio.toFixed(2)}`,
      "",
      "Rolling motion equations:",
      "No slip condition: v = ωR",
      "Acceleration: a = g sin θ / (1 + I/mR²)",
      "",
      `Theoretical acceleration: ${theoreticalAccel.toFixed(2)} m/s²`,
      `Actual velocity: ${obj.velocity.linear.toFixed(2)} m/s`,
      `Angular velocity: ${obj.velocity.angular.toFixed(1)} rad/s`,
      "",
      "Energy distribution:",
      `Translational KE: ${translationalKE.toFixed(3)} J`,
      `Rotational KE: ${rotationalKE.toFixed(3)} J`,
      `Total KE: ${totalKE.toFixed(3)} J`,
      `Rotation fraction: ${totalKE > 0 ? (rotationalKE/totalKE*100).toFixed(1) : 0}%`
    ];

    lines.forEach((line, i) => {
      if (line === "" || line.includes(":") && !line.includes("=")) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        ctx.font = line.includes(":") ? "bold 11px system-ui, sans-serif" : "12px system-ui, sans-serif";
      } else if (line.includes("v = ωR") || line.includes("a = g")) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 12px system-ui, sans-serif";
      } else {
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = "11px system-ui, sans-serif";
      }
      
      if (line !== "") {
        ctx.fillText(line, analysisX + 15, analysisY + 40 + i * 15);
      }
    });
  }

  function drawRaceResults(): void {
    if (!raceMode) return;

    const resultsX = width * 0.55;
    const resultsY = height * 0.05;
    const resultsW = width * 0.4;
    const resultsH = height * 0.35;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(resultsX, resultsY, resultsW, resultsH, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Race Results", resultsX + resultsW/2, resultsY + 20);

    if (!raceStarted) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("Click to start race!", resultsX + resultsW/2, resultsY + 50);
      return;
    }

    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.fillText(`Race time: ${raceTime.toFixed(1)} s`, resultsX + 15, resultsY + 50);

    // Theoretical finish order
    const sortedObjects = [...objects].sort((a, b) => {
      const aAccel = g * Math.sin(inclineAngle * Math.PI / 180) / (1 + a.momentRatio);
      const bAccel = g * Math.sin(inclineAngle * Math.PI / 180) / (1 + b.momentRatio);
      return bAccel - aAccel; // Higher acceleration = faster = first
    });

    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.fillText("Predicted order:", resultsX + 15, resultsY + 80);
    
    sortedObjects.forEach((obj, index) => {
      ctx.fillStyle = obj.color;
      ctx.fillText(`${index + 1}. ${obj.name}`, resultsX + 25, resultsY + 100 + index * 18);
    });

    // Actual finish order
    if (finishOrder.length > 0) {
      ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
      ctx.fillText("Actual finish order:", resultsX + 200, resultsY + 80);
      
      finishOrder.forEach((name, index) => {
        const obj = objects.find(o => o.name === name);
        ctx.fillStyle = obj ? obj.color : "#ffffff";
        ctx.fillText(`${index + 1}. ${name}`, resultsX + 210, resultsY + 100 + index * 18);
      });
    }

    // Current speeds
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.fillText("Current speeds:", resultsX + 15, resultsY + 220);
    
    objects.forEach((obj, index) => {
      ctx.fillStyle = obj.color;
      ctx.fillText(
        `${obj.name}: ${obj.velocity.linear.toFixed(1)} m/s`,
        resultsX + 25,
        resultsY + 240 + index * 15
      );
    });
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Draw components
    drawIncline();
    
    if (raceMode) {
      objects.forEach(obj => drawObject(obj));
      drawRaceResults();
    } else {
      drawObject(objects[selectedObject]);
    }
    
    drawAnalysis();

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = `bold ${Math.max(18, width * 0.028)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Rolling Motion Dynamics", width/2, 30);

    // Subtitle
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = `${Math.max(12, width * 0.018)}px system-ui, sans-serif`;
    ctx.fillText("Combined Translation & Rotation • No-Slip Condition", width/2, 50);

    // Controls hint
    if (raceMode && !raceStarted) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
      ctx.font = "14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡ Race Mode: Objects will compete down the incline!", width/2, height - 30);
    }
  }

  function reset(): void {
    time = 0;
    resetPositions();
    if (raceMode && !raceStarted) {
      raceStarted = true;
    }
  }

  function destroy(): void {
    objects.forEach(obj => obj.trail = []);
  }

  function getStateDescription(): string {
    if (raceMode) {
      const leaders = objects.map((obj, i) => ({
        name: obj.name,
        position: obj.position.x,
        speed: obj.velocity.linear,
        index: i
      })).sort((a, b) => b.position - a.position);

      return (
        `Rolling Motion Race: ${objects.length} objects on ${inclineAngle}° incline. ` +
        `Leader: ${leaders[0].name} at ${leaders[0].speed.toFixed(1)} m/s. ` +
        `Race time: ${raceTime.toFixed(1)}s. ` +
        `Finished: ${finishOrder.length}/${objects.length}. ` +
        `Physics: Objects with lower I/(mR²) ratios accelerate faster due to a = g sin θ / (1 + I/mR²).`
      );
    } else {
      const obj = objects[selectedObject];
      const accel = g * Math.sin(inclineAngle * Math.PI / 180) / (1 + obj.momentRatio);
      const transKE = 0.5 * obj.mass * obj.velocity.linear * obj.velocity.linear;
      const rotKE = 0.5 * (obj.momentRatio * obj.mass * obj.radius * obj.radius) * obj.velocity.angular * obj.velocity.angular;

      return (
        `Rolling Motion: ${obj.name} on ${inclineAngle}° incline. ` +
        `I/(mR²) = ${obj.momentRatio.toFixed(2)}, a = ${accel.toFixed(2)} m/s². ` +
        `Current: v = ${obj.velocity.linear.toFixed(2)} m/s, ω = ${obj.velocity.angular.toFixed(1)} rad/s. ` +
        `Energy: Trans KE = ${transKE.toFixed(3)}J, Rot KE = ${rotKE.toFixed(3)}J. ` +
        `No-slip condition: v = ωR demonstrates coupled translational and rotational motion.`
      );
    }
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    setupIncline();
    resetPositions();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RollingMotionDynamicsFactory;