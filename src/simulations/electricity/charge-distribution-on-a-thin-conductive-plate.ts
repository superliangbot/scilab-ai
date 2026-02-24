import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Charge particle ────────────────────────────────────────────────
interface Charge {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const ChargeDistributionFactory: SimulationFactory = () => {
  const config = getSimConfig("charge-distribution-on-a-thin-conductive-plate") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let shape = 0; // 0=Square, 1=Rectangle, 2=Circle, 3=Triangle
  let numCharges = 16;
  let speed = 1;
  let showField = 0;

  // Charges state
  let charges: Charge[] = [];
  let prevShape = -1;
  let prevNumCharges = -1;

  // Conductor geometry center and scale
  const plateMarginX = 160;
  const plateMarginY = 120;

  function plateCenter(): { cx: number; cy: number } {
    return { cx: W / 2, cy: H / 2 - 20 };
  }

  function plateSize(): { hw: number; hh: number } {
    const hw = Math.min(W - 2 * plateMarginX, 420) / 2;
    const hh = Math.min(H - 2 * plateMarginY, 320) / 2;
    return { hw, hh };
  }

  // ── Shape boundary ────────────────────────────────────────────────
  function isInsideShape(x: number, y: number): boolean {
    const { cx, cy } = plateCenter();
    const { hw, hh } = plateSize();
    const dx = x - cx;
    const dy = y - cy;

    switch (shape) {
      case 0: // Square
        return Math.abs(dx) <= hw * 0.8 && Math.abs(dy) <= hh * 0.8;
      case 1: // Rectangle
        return Math.abs(dx) <= hw && Math.abs(dy) <= hh * 0.55;
      case 2: // Circle
        {
          const r = Math.min(hw, hh) * 0.85;
          return dx * dx + dy * dy <= r * r;
        }
      case 3: // Triangle (equilateral-ish, apex up)
        {
          const triH = hh * 1.5;
          const triW = hw * 1.6;
          // Vertices: top center, bottom-left, bottom-right
          const topY = cy - triH * 0.5;
          const botY = cy + triH * 0.5;
          // Barycentric test
          const relY = (y - topY) / (botY - topY); // 0 at top, 1 at bottom
          if (relY < 0 || relY > 1) return false;
          const halfW = relY * triW * 0.5;
          return Math.abs(dx) <= halfW;
        }
      default:
        return false;
    }
  }

  function constrainToShape(x: number, y: number): { x: number; y: number } {
    if (isInsideShape(x, y)) return { x, y };
    // Project onto boundary (move toward center until inside)
    const { cx, cy } = plateCenter();
    const dx = x - cx;
    const dy = y - cy;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (isInsideShape(cx + dx * mid, cy + dy * mid)) lo = mid;
      else hi = mid;
    }
    return { x: cx + dx * lo, y: cy + dy * lo };
  }

  function distToEdge(x: number, y: number): number {
    // Approximate distance to edge by binary search outward
    const { cx, cy } = plateCenter();
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return distToEdgeFromCenter();
    const ux = dx / len;
    const uy = dy / len;

    // Find edge in this direction
    let lo = 0;
    let hi = Math.max(W, H);
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (isInsideShape(x + ux * mid, y + uy * mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function distToEdgeFromCenter(): number {
    const { cx, cy } = plateCenter();
    const { hw, hh } = plateSize();
    switch (shape) {
      case 0: return hw * 0.8;
      case 1: return hh * 0.55;
      case 2: return Math.min(hw, hh) * 0.85;
      case 3: return hh * 0.75;
      default: return hw * 0.5;
    }
  }

  function initCharges() {
    charges = [];
    const { cx, cy } = plateCenter();
    const { hw, hh } = plateSize();
    for (let i = 0; i < numCharges; i++) {
      let x: number, y: number;
      let attempts = 0;
      do {
        x = cx + (Math.random() - 0.5) * hw * 1.4;
        y = cy + (Math.random() - 0.5) * hh * 1.4;
        attempts++;
      } while (!isInsideShape(x, y) && attempts < 200);
      if (!isInsideShape(x, y)) {
        x = cx;
        y = cy;
      }
      charges.push({ x, y, vx: 0, vy: 0 });
    }
  }

  // ── Drawing helpers ───────────────────────────────────────────────

  function drawShapeOutline() {
    const { cx, cy } = plateCenter();
    const { hw, hh } = plateSize();

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    switch (shape) {
      case 0: // Square
        ctx.strokeRect(cx - hw * 0.8, cy - hh * 0.8, hw * 1.6, hh * 1.6);
        break;
      case 1: // Rectangle
        ctx.strokeRect(cx - hw, cy - hh * 0.55, hw * 2, hh * 1.1);
        break;
      case 2: // Circle
        {
          const r = Math.min(hw, hh) * 0.85;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case 3: // Triangle
        {
          const triH = hh * 1.5;
          const triW = hw * 1.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy - triH * 0.5); // apex
          ctx.lineTo(cx - triW * 0.5, cy + triH * 0.5); // bottom-left
          ctx.lineTo(cx + triW * 0.5, cy + triH * 0.5); // bottom-right
          ctx.closePath();
          ctx.stroke();
        }
        break;
    }

    // Fill interior with subtle color
    ctx.fillStyle = "rgba(100, 116, 139, 0.08)";
    switch (shape) {
      case 0:
        ctx.fillRect(cx - hw * 0.8, cy - hh * 0.8, hw * 1.6, hh * 1.6);
        break;
      case 1:
        ctx.fillRect(cx - hw, cy - hh * 0.55, hw * 2, hh * 1.1);
        break;
      case 2:
        {
          const r = Math.min(hw, hh) * 0.85;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 3:
        {
          const triH = hh * 1.5;
          const triW = hw * 1.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy - triH * 0.5);
          ctx.lineTo(cx - triW * 0.5, cy + triH * 0.5);
          ctx.lineTo(cx + triW * 0.5, cy + triH * 0.5);
          ctx.closePath();
          ctx.fill();
        }
        break;
    }
  }

  function drawFieldLines() {
    if (!showField) return;
    // Draw simple electric field arrows pointing outward from charges
    const { cx, cy } = plateCenter();
    const numRays = 24;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      // Sum contribution from all charges at the boundary
      let ex = 0;
      let ey = 0;
      const testDist = 40;
      const testX = cx + Math.cos(angle) * testDist;
      const testY = cy + Math.sin(angle) * testDist;

      for (const ch of charges) {
        const ddx = testX - ch.x;
        const ddy = testY - ch.y;
        const d2 = ddx * ddx + ddy * ddy + 100;
        const d = Math.sqrt(d2);
        ex += ddx / (d2 * d) * 5000;
        ey += ddy / (d2 * d) * 5000;
      }

      const mag = Math.sqrt(ex * ex + ey * ey);
      if (mag < 0.01) continue;
      const ux = ex / mag;
      const uy = ey / mag;

      // Find a point at the boundary in this direction
      let bx = cx;
      let by = cy;
      const step = 3;
      for (let s = 0; s < 200; s++) {
        const nx = bx + ux * step;
        const ny = by + uy * step;
        if (!isInsideShape(nx, ny)) break;
        bx = nx;
        by = ny;
      }

      // Draw field line extending outward from boundary
      const lineLen = 25 + mag * 5;
      const endX = bx + ux * lineLen;
      const endY = by + uy * lineLen;

      ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      ctx.save();
      ctx.translate(endX, endY);
      ctx.rotate(Math.atan2(uy, ux));
      ctx.fillStyle = "rgba(139, 92, 246, 0.5)";
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-3, -3);
      ctx.lineTo(-3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initCharges();
      prevShape = shape;
      prevNumCharges = numCharges;
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      shape = Math.round(params.shape ?? shape);
      numCharges = Math.round(params.numCharges ?? numCharges);
      speed = params.speed ?? speed;
      showField = Math.round(params.showField ?? showField);

      // Re-initialize if shape or count changed
      if (shape !== prevShape || numCharges !== prevNumCharges) {
        prevShape = shape;
        prevNumCharges = numCharges;
        initCharges();
      }

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      // Coulomb repulsion: F = k * q1 * q2 / r^2
      // We use arbitrary units for k and q
      const k = 8000; // Coulomb constant (arbitrary scale)
      const damping = 0.92;
      const minDist = 8;

      for (let i = 0; i < charges.length; i++) {
        let fx = 0;
        let fy = 0;
        for (let j = 0; j < charges.length; j++) {
          if (i === j) continue;
          const ddx = charges[i].x - charges[j].x;
          const ddy = charges[i].y - charges[j].y;
          const d2 = ddx * ddx + ddy * ddy;
          const d = Math.sqrt(d2);
          const dClamped = Math.max(d, minDist);
          // F = k / r^2, direction: away from other charge
          const fMag = k / (dClamped * dClamped);
          fx += (ddx / d) * fMag;
          fy += (ddy / d) * fMag;
        }

        charges[i].vx += fx * dtClamped * speed;
        charges[i].vy += fy * dtClamped * speed;
        charges[i].vx *= damping;
        charges[i].vy *= damping;
      }

      // Apply velocity and constrain to shape
      for (const ch of charges) {
        const nx = ch.x + ch.vx * dtClamped * speed;
        const ny = ch.y + ch.vy * dtClamped * speed;
        const constrained = constrainToShape(nx, ny);
        if (constrained.x !== nx || constrained.y !== ny) {
          // Hit boundary, kill velocity component toward boundary
          ch.vx *= 0.1;
          ch.vy *= 0.1;
        }
        ch.x = constrained.x;
        ch.y = constrained.y;
      }
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Charge Distribution on a Conductive Plate", W / 2, 28);

      const shapeNames = ["Square", "Rectangle", "Circle", "Triangle"];
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        `Shape: ${shapeNames[shape]}  |  Charges repel via Coulomb's Law: F = kq\u2081q\u2082/r\u00B2`,
        W / 2, 46
      );

      // Draw shape outline
      drawShapeOutline();

      // Draw field lines if enabled
      drawFieldLines();

      // Draw charges
      for (const ch of charges) {
        // Charge density halo (brighter near edges)
        const edgeDist = distToEdge(ch.x, ch.y);
        const edgeFactor = Math.max(0, 1 - edgeDist / 30);

        // Glow
        const glowR = 10 + edgeFactor * 6;
        const glow = ctx.createRadialGradient(ch.x, ch.y, 0, ch.x, ch.y, glowR);
        glow.addColorStop(0, `rgba(59, 130, 246, ${0.4 + edgeFactor * 0.3})`);
        glow.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx.beginPath();
        ctx.arc(ch.x, ch.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Electron
        ctx.beginPath();
        ctx.arc(ch.x, ch.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Minus sign
        ctx.fillStyle = "#fff";
        ctx.font = "bold 7px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("\u2013", ch.x, ch.y + 2.5);
      }

      // Compute charge density metrics
      let nearEdgeCount = 0;
      let centerCount = 0;
      const edgeThreshold = 20;
      for (const ch of charges) {
        const eDist = distToEdge(ch.x, ch.y);
        if (eDist < edgeThreshold) nearEdgeCount++;
        else centerCount++;
      }

      // Info panel
      const panelY = H - 110;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(12, panelY, W - 24, 100);
      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(12, panelY, W - 24, 100);

      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`Charges: ${numCharges} electrons on ${shapeNames[shape]} conductor`, 24, panelY + 18);

      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`Near edges: ${nearEdgeCount}  |  Interior: ${centerCount}`, 24, panelY + 36);

      ctx.fillStyle = "#34d399";
      ctx.fillText(
        "Charges migrate to edges & corners due to mutual Coulomb repulsion",
        24, panelY + 54
      );

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(
        "Sharp corners accumulate higher charge density (stronger E-field at tips)",
        24, panelY + 72
      );

      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        `Coulomb: F = kq\u2081q\u2082/r\u00B2  |  E-field lines ${showField ? "ON" : "OFF"}  |  Speed: ${speed.toFixed(1)}\u00D7`,
        24, panelY + 90
      );

      // Time
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 4);
    },

    reset() {
      shape = config.parameters.find((p) => p.key === "shape")!.defaultValue;
      numCharges = config.parameters.find((p) => p.key === "numCharges")!.defaultValue;
      speed = config.parameters.find((p) => p.key === "speed")!.defaultValue;
      showField = config.parameters.find((p) => p.key === "showField")!.defaultValue;
      prevShape = shape;
      prevNumCharges = numCharges;
      initCharges();
      time = 0;
    },

    destroy() {
      charges = [];
    },

    getStateDescription(): string {
      const shapeNames = ["Square", "Rectangle", "Circle", "Triangle"];
      let nearEdgeCount = 0;
      const edgeThreshold = 20;
      for (const ch of charges) {
        if (distToEdge(ch.x, ch.y) < edgeThreshold) nearEdgeCount++;
      }
      const centerCount = charges.length - nearEdgeCount;

      return (
        `Charge Distribution on a Conductive Plate: ${numCharges} electrons on a ${shapeNames[shape]} conductor. ` +
        `Charges repel each other via Coulomb's law F = kq\u2081q\u2082/r\u00B2. ` +
        `Currently ${nearEdgeCount} charges near edges, ${centerCount} in interior. ` +
        `In equilibrium, charges accumulate on the surface (edges) of conductors, ` +
        `with higher charge density at sharp corners and tips. ` +
        `This is because the electric field inside a conductor is zero at equilibrium, ` +
        `and surface charge distributes to cancel internal fields.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default ChargeDistributionFactory;
