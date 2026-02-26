import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Moment of Inertia 3D: Visualizes moment of inertia for different 3D shapes
 * rotating about various axes. Shows the axis of rotation and angular velocity.
 * I = ∫ r² dm for continuous bodies.
 */
const MomentOfInertia3DFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("moment-of-inertia-3d") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let shapeType = 0; // 0=sphere, 1=cylinder, 2=rod, 3=disc, 4=ring
  let mass = 2; // kg
  let dimension = 0.5; // radius or length in meters
  let torque = 5; // N·m

  let angularVelocity = 0;
  let angle = 0;

  interface Shape {
    name: string;
    formula: string;
    compute: (m: number, r: number) => number;
    description: string;
  }

  const SHAPES: Shape[] = [
    {
      name: "Solid Sphere",
      formula: "I = (2/5)mR²",
      compute: (m, r) => (2 / 5) * m * r * r,
      description: "Axis through center",
    },
    {
      name: "Solid Cylinder",
      formula: "I = (1/2)mR²",
      compute: (m, r) => (1 / 2) * m * r * r,
      description: "Axis through center along length",
    },
    {
      name: "Thin Rod (center)",
      formula: "I = (1/12)mL²",
      compute: (m, l) => (1 / 12) * m * l * l,
      description: "Axis through center, perpendicular",
    },
    {
      name: "Thin Disc",
      formula: "I = (1/2)mR²",
      compute: (m, r) => (1 / 2) * m * r * r,
      description: "Axis through center, perpendicular to face",
    },
    {
      name: "Ring / Hoop",
      formula: "I = mR²",
      compute: (m, r) => m * r * r,
      description: "Axis through center, perpendicular to plane",
    },
  ];

  function getMomentOfInertia(): number {
    return SHAPES[shapeType].compute(mass, dimension);
  }

  function rotateY(x: number, y: number, z: number, a: number): [number, number, number] {
    const c = Math.cos(a), s = Math.sin(a);
    return [x * c + z * s, y, -x * s + z * c];
  }

  function rotateX(x: number, y: number, z: number, a: number): [number, number, number] {
    const c = Math.cos(a), s = Math.sin(a);
    return [x, y * c - z * s, y * s + z * c];
  }

  function project3D(x: number, y: number, z: number): { px: number; py: number } {
    const fov = 4;
    const s = fov / (fov + z + 2);
    return {
      px: W * 0.38 + x * 150 * s,
      py: H * 0.42 + y * 150 * s,
    };
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      angularVelocity = 0;
      angle = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newShape = Math.round(params.shapeType ?? 0);
      if (newShape !== shapeType) {
        shapeType = newShape;
        angularVelocity = 0;
        angle = 0;
      }
      mass = params.mass ?? 2;
      dimension = params.dimension ?? 0.5;
      torque = params.torque ?? 5;

      const I = getMomentOfInertia();
      if (I > 0) {
        // τ = Iα, α = τ/I
        const alpha = torque / I;
        angularVelocity += alpha * dt;
        // Cap angular velocity for visual sanity
        if (angularVelocity > 30) angularVelocity = 30;
        angle += angularVelocity * dt;
      }
      time += dt;
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      const shape = SHAPES[shapeType];
      const I = getMomentOfInertia();

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(`Moment of Inertia — ${shape.name}`, W / 2, 28);

      // Draw 3D shape
      const viewAngle = 0.4; // slight tilt for perspective

      if (shapeType === 0) {
        drawSphere(angle, viewAngle);
      } else if (shapeType === 1) {
        drawCylinder(angle, viewAngle);
      } else if (shapeType === 2) {
        drawRod(angle, viewAngle);
      } else if (shapeType === 3) {
        drawDisc(angle, viewAngle);
      } else {
        drawRing(angle, viewAngle);
      }

      // Draw rotation axis
      const axisLen = 1.5;
      const axTop = project3D(...rotateX(0, -axisLen, 0, viewAngle));
      const axBot = project3D(...rotateX(0, axisLen, 0, viewAngle));
      ctx.beginPath();
      ctx.moveTo(axTop.px, axTop.py);
      ctx.lineTo(axBot.px, axBot.py);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotation arrow
      if (angularVelocity > 0.1) {
        const arrowSize = Math.min(angularVelocity * 2, 20);
        ctx.beginPath();
        const arcR = 40;
        const arcCx = W * 0.38;
        const arcCy = H * 0.42 - 120;
        ctx.arc(arcCx, arcCy, arcR, -0.5, 1.5);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Arrowhead
        const endAngle = 1.5;
        const ax = arcCx + arcR * Math.cos(endAngle);
        const ay = arcCy + arcR * Math.sin(endAngle);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + arrowSize * 0.5, ay - arrowSize * 0.3);
        ctx.lineTo(ax + arrowSize * 0.1, ay + arrowSize * 0.5);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();

        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText("ω", arcCx, arcCy - arcR - 8);
      }

      // Info panel (right side)
      const infoX = W * 0.65;
      let infoY = 55;
      const panelW = W * 0.32;

      ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
      ctx.beginPath();
      ctx.roundRect(infoX - 10, infoY - 15, panelW, 300, 8);
      ctx.fill();

      ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(shape.name, infoX, infoY);
      infoY += 25;

      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(shape.formula, infoX, infoY);
      infoY += 25;

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(shape.description, infoX, infoY);
      infoY += 30;

      // Computed values
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#22c55e";
      ctx.fillText(`I = ${I.toFixed(4)} kg·m²`, infoX, infoY);
      infoY += 22;

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`ω = ${angularVelocity.toFixed(2)} rad/s`, infoX, infoY);
      infoY += 22;

      ctx.fillStyle = "#c084fc";
      const kineticRotational = 0.5 * I * angularVelocity * angularVelocity;
      ctx.fillText(`KE_rot = ½Iω² = ${kineticRotational.toFixed(2)} J`, infoX, infoY);
      infoY += 22;

      ctx.fillStyle = "#ef4444";
      ctx.fillText(`τ = ${torque.toFixed(1)} N·m`, infoX, infoY);
      infoY += 22;

      ctx.fillStyle = "#64748b";
      const alpha = I > 0 ? torque / I : 0;
      ctx.fillText(`α = τ/I = ${alpha.toFixed(2)} rad/s²`, infoX, infoY);
      infoY += 30;

      // Angular momentum
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillText("Angular Momentum:", infoX, infoY);
      infoY += 20;
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      const L = I * angularVelocity;
      ctx.fillText(`L = Iω = ${L.toFixed(3)} kg·m²/s`, infoX, infoY);

      // Comparison table at bottom
      const tableY = H - 95;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Moment of Inertia Comparison:", W / 2, tableY - 10);

      ctx.font = "10px system-ui, sans-serif";
      for (let i = 0; i < SHAPES.length; i++) {
        const s = SHAPES[i];
        const x = W * 0.1 + (i * W * 0.18);
        const iVal = s.compute(mass, dimension);
        const isActive = i === shapeType;

        ctx.fillStyle = isActive ? "#38bdf8" : "#64748b";
        ctx.fillText(s.name, x, tableY + 8);
        ctx.fillText(s.formula, x, tableY + 22);
        ctx.fillText(`= ${iVal.toFixed(4)}`, x, tableY + 36);
      }

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("τ = Iα  |  L = Iω  |  KE_rot = ½Iω²", W / 2, H - 10);
    },

    reset() {
      time = 0;
      angularVelocity = 0;
      angle = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const shape = SHAPES[shapeType];
      const I = getMomentOfInertia();
      const L = I * angularVelocity;
      const KE = 0.5 * I * angularVelocity * angularVelocity;
      return (
        `Moment of Inertia 3D: ${shape.name}, m=${mass}kg, R/L=${dimension}m. ` +
        `${shape.formula} = ${I.toFixed(4)} kg·m². ` +
        `τ=${torque}N·m, α=${(torque / I).toFixed(2)}rad/s², ω=${angularVelocity.toFixed(2)}rad/s. ` +
        `L=Iω=${L.toFixed(3)}kg·m²/s, KE_rot=½Iω²=${KE.toFixed(2)}J.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  function drawSphere(rot: number, tilt: number) {
    const cx = W * 0.38;
    const cy = H * 0.42;
    const r = 80;

    // Sphere with latitude lines
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    grad.addColorStop(0, "#5b8def");
    grad.addColorStop(0.7, "#2563eb");
    grad.addColorStop(1, "#1e40af");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Latitude lines
    for (let lat = -2; lat <= 2; lat++) {
      const latAngle = (lat / 3) * Math.PI / 2;
      const ringR = r * Math.cos(latAngle);
      const ringY = cy + r * Math.sin(latAngle) * Math.cos(tilt);

      ctx.beginPath();
      ctx.ellipse(cx, ringY, ringR, ringR * 0.3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(59,130,246,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Rotation line
    ctx.beginPath();
    const lx = cx + r * 0.8 * Math.cos(rot);
    const ly = cy + r * 0.8 * Math.sin(rot) * 0.3;
    ctx.moveTo(cx, cy);
    ctx.lineTo(lx, ly);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawCylinder(rot: number, tilt: number) {
    const cx = W * 0.38;
    const cy = H * 0.42;
    const r = 60;
    const halfH = 70;

    // Side
    ctx.fillStyle = "#22c55e40";
    ctx.fillRect(cx - r, cy - halfH, r * 2, halfH * 2);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - r, cy - halfH, r * 2, halfH * 2);

    // Top ellipse
    ctx.beginPath();
    ctx.ellipse(cx, cy - halfH, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#22c55e50";
    ctx.fill();
    ctx.strokeStyle = "#22c55e";
    ctx.stroke();

    // Bottom ellipse
    ctx.beginPath();
    ctx.ellipse(cx, cy + halfH, r, r * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.strokeStyle = "#22c55e";
    ctx.stroke();

    // Rotation indicator
    const lx = cx + r * 0.7 * Math.cos(rot);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(lx, cy);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawRod(rot: number, tilt: number) {
    const cx = W * 0.38;
    const cy = H * 0.42;
    const halfL = 100;

    const x1 = cx + halfL * Math.cos(rot);
    const y1 = cy + halfL * Math.sin(rot) * 0.3;
    const x2 = cx - halfL * Math.cos(rot);
    const y2 = cy - halfL * Math.sin(rot) * 0.3;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";

    // Center pivot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // End masses
    ctx.beginPath();
    ctx.arc(x1, y1, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x2, y2, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
  }

  function drawDisc(rot: number, tilt: number) {
    const cx = W * 0.38;
    const cy = H * 0.42;
    const r = 80;

    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#a855f740";
    ctx.fill();
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Radial line
    const lx = cx + r * Math.cos(rot);
    const ly = cy + r * 0.35 * Math.sin(rot);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(lx, ly);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  function drawRing(rot: number, tilt: number) {
    const cx = W * 0.38;
    const cy = H * 0.42;
    const r = 80;
    const thickness = 8;

    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = thickness;
    ctx.stroke();

    // Radial line
    const lx = cx + r * Math.cos(rot);
    const ly = cy + r * 0.35 * Math.sin(rot);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(lx, ly);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  return engine;
};

export default MomentOfInertia3DFactory;
