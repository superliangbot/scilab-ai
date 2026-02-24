import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface RollingObject {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  radius: number;
  mass: number;
  momentOfInertia: number;
  type: "solid-sphere" | "hollow-sphere" | "solid-cylinder" | "hollow-cylinder" | "ring";
  color: string;
  onGround: boolean;
}

const RollingMotionDynamicsFactory: SimulationFactory = () => {
  const config = getSimConfig("rolling-motion-dynamics") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let inclineAngle = 15; // degrees
  let friction = 0.8;
  let gravity = 9.81;
  let objectType = 0; // index into object types
  let showVectors = 1;
  let showTrail = 1;

  // Object templates
  const objectTypes = [
    { type: "solid-sphere", name: "Solid Sphere", I_factor: 2/5, color: "#3b82f6" },
    { type: "hollow-sphere", name: "Hollow Sphere", I_factor: 2/3, color: "#ef4444" },
    { type: "solid-cylinder", name: "Solid Cylinder", I_factor: 1/2, color: "#10b981" },
    { type: "hollow-cylinder", name: "Hollow Cylinder", I_factor: 1, color: "#f59e0b" },
    { type: "ring", name: "Ring", I_factor: 1, color: "#8b5cf6" },
  ] as const;

  // State
  let rollingObject: RollingObject;
  let trail: { x: number; y: number; time: number }[] = [];
  let groundY: number;
  let inclineStartX: number;
  let raceResults: { name: string; time: number }[] = [];

  function initializeObject() {
    const template = objectTypes[objectType];
    const mass = 1; // kg
    const radius = 25; // pixels
    
    groundY = H * 0.8;
    inclineStartX = W * 0.1;
    
    rollingObject = {
      x: inclineStartX + 50,
      y: groundY - radius - Math.sin(inclineAngle * Math.PI / 180) * 50,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVelocity: 0,
      radius: radius,
      mass: mass,
      momentOfInertia: template.I_factor * mass * radius * radius / 10000, // Scale for pixels
      type: template.type,
      color: template.color,
      onGround: false,
    };
    
    trail = [];
  }

  function getInclineY(x: number): number {
    const startX = inclineStartX;
    const endX = W * 0.9;
    
    if (x < startX) {
      return groundY - rollingObject.radius;
    } else if (x > endX) {
      return groundY - rollingObject.radius;
    } else {
      const progress = (x - startX) / (endX - startX);
      const height = Math.sin(inclineAngle * Math.PI / 180) * (endX - startX) * 0.3;
      return groundY - rollingObject.radius - height * (1 - progress);
    }
  }

  function updatePhysics(dt: number) {
    const obj = rollingObject;
    
    // Check if object is on the incline
    const expectedY = getInclineY(obj.x);
    obj.onGround = Math.abs(obj.y - expectedY) < 5;
    
    if (obj.onGround) {
      obj.y = expectedY;
      
      // Forces on incline
      const angleRad = inclineAngle * Math.PI / 180;
      const mg_sin = obj.mass * gravity * Math.sin(angleRad);
      const mg_cos = obj.mass * gravity * Math.cos(angleRad);
      
      // For rolling without slipping: a = g*sin(θ) / (1 + I/(mR²))
      const I_factor = obj.momentOfInertia / (obj.mass * obj.radius * obj.radius);
      const acceleration = (gravity * Math.sin(angleRad)) / (1 + I_factor);
      
      // Update linear motion
      obj.vx += acceleration * dt * Math.cos(angleRad);
      obj.x += obj.vx * dt;
      
      // Rolling constraint: v = ωR (no slipping)
      obj.angularVelocity = obj.vx / obj.radius;
      obj.angle += obj.angularVelocity * dt;
      
    } else {
      // Free fall
      obj.vy += gravity * dt;
      obj.x += obj.vx * dt;
      obj.y += obj.vy * dt;
      
      // Keep rotating
      obj.angle += obj.angularVelocity * dt;
    }
    
    // Add to trail
    if (showTrail && trail.length < 100) {
      trail.push({ x: obj.x, y: obj.y, time: time });
    }
    
    // Keep object bounds
    if (obj.x > W + obj.radius) {
      obj.x = -obj.radius;
      obj.y = getInclineY(obj.x);
      obj.vx = 0;
      obj.vy = 0;
      obj.angularVelocity = 0;
      trail = [];
    }
  }

  function drawIncline() {
    const startX = inclineStartX;
    const endX = W * 0.9;
    const height = Math.sin(inclineAngle * Math.PI / 180) * (endX - startX) * 0.3;
    
    // Draw incline surface
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    
    // Flat start
    ctx.moveTo(0, groundY);
    ctx.lineTo(startX, groundY);
    
    // Inclined section
    ctx.lineTo(endX, groundY - height);
    
    // Flat end
    ctx.lineTo(W, groundY - height);
    ctx.stroke();
    
    // Fill ground
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(startX, groundY);
    ctx.lineTo(endX, groundY - height);
    ctx.lineTo(W, groundY - height);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    
    // Grid pattern on ground
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    
    // Angle indicator
    const angleX = startX + 60;
    const angleY = groundY;
    const arcRadius = 30;
    
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(angleX, angleY, arcRadius, 0, -inclineAngle * Math.PI / 180, true);
    ctx.stroke();
    
    ctx.fillStyle = "#fbbf24";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${inclineAngle.toFixed(1)}°`, angleX + 15, angleY - 15);
  }

  function drawRollingObject(obj: RollingObject) {
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.rotate(obj.angle);
    
    // Main body
    const gradient = ctx.createRadialGradient(-8, -8, 0, 0, 0, obj.radius);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.3, obj.color);
    gradient.addColorStop(1, obj.color + "80");
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = 2;
    
    if (obj.type === "ring" || obj.type === "hollow-cylinder" || obj.type === "hollow-sphere") {
      // Hollow objects - draw outline only
      ctx.beginPath();
      ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
      ctx.stroke();
      
      if (obj.type === "hollow-cylinder") {
        // Add inner circle for hollow cylinder
        ctx.beginPath();
        ctx.arc(0, 0, obj.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Spokes/structure
      ctx.strokeStyle = obj.color + "80";
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * obj.radius * 0.8, Math.sin(angle) * obj.radius * 0.8);
        ctx.stroke();
      }
    } else {
      // Solid objects
      ctx.beginPath();
      ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      if (obj.type === "solid-cylinder") {
        // Add 3D effect for cylinder
        ctx.fillStyle = obj.color + "40";
        ctx.beginPath();
        ctx.ellipse(0, -obj.radius * 0.3, obj.radius * 0.8, obj.radius * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Rotation indicator - dot on edge
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(obj.radius - 3, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Center dot
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Draw velocity and angular velocity vectors if enabled
    if (showVectors) {
      // Linear velocity vector
      if (Math.abs(obj.vx) > 5) {
        const scale = 0.2;
        const endX = obj.x + obj.vx * scale;
        
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y - obj.radius - 10);
        ctx.lineTo(endX, obj.y - obj.radius - 10);
        ctx.stroke();
        
        // Arrowhead
        const arrowSize = 6;
        const direction = obj.vx > 0 ? 1 : -1;
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.moveTo(endX, obj.y - obj.radius - 10);
        ctx.lineTo(endX - direction * arrowSize, obj.y - obj.radius - 10 - 3);
        ctx.lineTo(endX - direction * arrowSize, obj.y - obj.radius - 10 + 3);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = "#22d3ee";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`v=${obj.vx.toFixed(1)}`, obj.x, obj.y - obj.radius - 25);
      }
      
      // Angular velocity indicator
      if (Math.abs(obj.angularVelocity) > 0.1) {
        const radius = obj.radius + 15;
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        
        const startAngle = -Math.PI / 3;
        const endAngle = startAngle + Math.sign(obj.angularVelocity) * Math.PI / 2;
        
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, radius, startAngle, endAngle);
        ctx.stroke();
        
        // Angular velocity arrow
        const arrowX = obj.x + Math.cos(endAngle) * radius;
        const arrowY = obj.y + Math.sin(endAngle) * radius;
        const arrowAngle = endAngle + Math.sign(obj.angularVelocity) * Math.PI / 2;
        
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX + Math.cos(arrowAngle + 0.5) * 6, arrowY + Math.sin(arrowAngle + 0.5) * 6);
        ctx.lineTo(arrowX + Math.cos(arrowAngle - 0.5) * 6, arrowY + Math.sin(arrowAngle - 0.5) * 6);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = "#10b981";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`ω=${obj.angularVelocity.toFixed(1)}`, obj.x, obj.y + obj.radius + 35);
      }
    }
  }

  function drawTrail() {
    if (!showTrail || trail.length < 2) return;
    
    ctx.strokeStyle = rollingObject.color + "60";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < trail.length; i++) {
      const point = trail[i];
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
  }

  function drawInfoPanel() {
    const panelX = W * 0.02;
    const panelY = H * 0.02;
    const panelW = W * 0.25;
    const panelH = H * 0.4;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    const template = objectTypes[objectType];
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    let infoY = panelY + 20;
    
    ctx.fillText("Rolling Motion", panelX + 10, infoY);
    infoY += 20;
    
    ctx.fillStyle = template.color;
    ctx.fillText(`Object: ${template.name}`, panelX + 10, infoY);
    infoY += 16;
    
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`I = ${template.I_factor.toFixed(2)} MR²`, panelX + 10, infoY);
    infoY += 16;
    
    ctx.fillText(`Angle: ${inclineAngle.toFixed(1)}°`, panelX + 10, infoY);
    infoY += 16;
    
    // Current values
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Position: ${rollingObject.x.toFixed(0)} px`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Velocity: ${rollingObject.vx.toFixed(1)} px/s`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`ω: ${rollingObject.angularVelocity.toFixed(2)} rad/s`, panelX + 10, infoY);
    infoY += 20;
    
    // Rolling condition
    const theoreticalV = rollingObject.angularVelocity * rollingObject.radius;
    const slipRatio = Math.abs(rollingObject.vx - theoreticalV) / Math.max(Math.abs(rollingObject.vx), 1);
    
    ctx.fillStyle = slipRatio < 0.1 ? "#10b981" : "#ef4444";
    ctx.fillText(`v = ωR? ${slipRatio < 0.1 ? "YES" : "NO"}`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Slip: ${(slipRatio * 100).toFixed(1)}%`, panelX + 10, infoY);
    infoY += 20;
    
    // Energy
    const kineticEnergy = 0.5 * rollingObject.mass * rollingObject.vx * rollingObject.vx;
    const rotationalEnergy = 0.5 * rollingObject.momentOfInertia * rollingObject.angularVelocity * rollingObject.angularVelocity;
    const totalEnergy = kineticEnergy + rotationalEnergy;
    
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`KE_trans: ${kineticEnergy.toFixed(1)} J`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`KE_rot: ${rotationalEnergy.toFixed(1)} J`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Total: ${totalEnergy.toFixed(1)} J`, panelX + 10, infoY);
    infoY += 20;
    
    // Theory
    ctx.fillStyle = "#8b5cf6";
    ctx.font = "10px monospace";
    ctx.fillText("Rolling without slipping:", panelX + 10, infoY);
    infoY += 14;
    ctx.fillText("a = g sin θ / (1 + I/mR²)", panelX + 10, infoY);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeObject();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newObjectType = Math.round(params.objectType ?? objectType);
      inclineAngle = Math.max(0, Math.min(45, params.inclineAngle ?? inclineAngle));
      friction = params.friction ?? friction;
      gravity = params.gravity ?? gravity;
      showVectors = Math.round(params.showVectors ?? showVectors);
      showTrail = Math.round(params.showTrail ?? showTrail);
      
      if (newObjectType !== objectType) {
        objectType = newObjectType;
        initializeObject();
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
      ctx.fillText("Rolling Motion Dynamics", W / 2, 30);
      
      const template = objectTypes[objectType];
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${template.name} rolling down an incline`, W / 2, 50);

      // Draw scene
      drawIncline();
      drawTrail();
      drawRollingObject(rollingObject);
      drawInfoPanel();

      // Forces diagram (small)
      const forceX = W * 0.75;
      const forceY = H * 0.15;
      const forceScale = 30;
      
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(forceX - forceScale, forceY + forceScale);
      ctx.lineTo(forceX + forceScale, forceY - forceScale * Math.tan(inclineAngle * Math.PI / 180));
      ctx.stroke();
      
      // Weight vector
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(forceX, forceY);
      ctx.lineTo(forceX, forceY + forceScale);
      ctx.stroke();
      
      // Weight components
      const angleRad = inclineAngle * Math.PI / 180;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      
      // mg sin θ (down the incline)
      ctx.beginPath();
      ctx.moveTo(forceX, forceY);
      ctx.lineTo(forceX + forceScale * Math.sin(angleRad), forceY + forceScale * Math.cos(angleRad));
      ctx.stroke();
      
      // mg cos θ (perpendicular to incline)
      ctx.beginPath();
      ctx.moveTo(forceX, forceY);
      ctx.lineTo(forceX - forceScale * Math.cos(angleRad), forceY + forceScale * Math.sin(angleRad));
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Forces", forceX, forceY + forceScale + 15);
      
      // Display theoretical acceleration
      const template_I_factor = objectTypes[objectType].I_factor;
      const theoreticalAccel = (gravity * Math.sin(angleRad)) / (1 + template_I_factor);
      
      ctx.fillStyle = "#10b981";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`Theory: a = ${theoreticalAccel.toFixed(2)} m/s²`, W - 10, H - 20);
      
      // Show rolling constraint
      ctx.fillStyle = "#22d3ee";
      ctx.textAlign = "right";
      ctx.fillText("Rolling constraint: v = ωR", W - 10, H - 5);
    },

    reset() {
      time = 0;
      initializeObject();
    },

    destroy() {},

    getStateDescription(): string {
      const template = objectTypes[objectType];
      const slipRatio = Math.abs(rollingObject.vx - rollingObject.angularVelocity * rollingObject.radius) / Math.max(Math.abs(rollingObject.vx), 1);
      
      return `Rolling motion: ${template.name} (I=${template.I_factor.toFixed(2)}mR²) on ${inclineAngle.toFixed(1)}° incline. ` +
             `Position: ${rollingObject.x.toFixed(0)}px, velocity: ${rollingObject.vx.toFixed(1)}px/s, ` +
             `angular velocity: ${rollingObject.angularVelocity.toFixed(2)}rad/s. ` +
             `${slipRatio < 0.1 ? "Rolling without slipping" : `Slipping (${(slipRatio*100).toFixed(1)}%)`}. ` +
             `Demonstrates moment of inertia effects on acceleration.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default RollingMotionDynamicsFactory;