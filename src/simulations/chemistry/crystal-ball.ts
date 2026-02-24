import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DEG = Math.PI / 180;

interface RaySegment {
  x1: number; y1: number;
  x2: number; y2: number;
  type: "incident" | "internal" | "exit";
}

interface RefractionPoint {
  x: number; y: number;
  thetaI: number;
  thetaR: number;
}

const CrystalBallFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("crystal-ball") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let refractiveIndex = 1.5;
  let sphereRadius = 100;
  let numRays = 7;
  let objectDistance = 250;

  let rays: RaySegment[][] = [];
  let refractionPoints: RefractionPoint[] = [];
  let focalX = 0;

  function sphereCenterX(): number { return width * 0.45; }
  function sphereCenterY(): number { return height * 0.5; }

  function computeRays(): void {
    rays = [];
    refractionPoints = [];
    const cx = sphereCenterX();
    const cy = sphereCenterY();
    const R = sphereRadius;
    const n1 = 1.0;
    const n2 = refractiveIndex;

    const spacing = (R * 1.6) / (numRays + 1);
    const focalCandidates: number[] = [];

    for (let i = 0; i < numRays; i++) {
      const yOffset = -R * 0.8 + spacing * (i + 1);
      const rayY = cy + yOffset;
      const segments: RaySegment[] = [];

      // Incident ray from left to sphere front surface
      const dx = cx;
      const dy = rayY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Find entry point on sphere (front, left side)
      // Ray travels horizontally: direction (1, 0)
      // Sphere: (x-cx)^2 + (y-cy)^2 = R^2
      // With ray y = rayY: (x-cx)^2 = R^2 - (rayY-cy)^2
      const dySq = (rayY - cy) * (rayY - cy);
      if (dySq > R * R) continue; // ray misses sphere

      const xEntry = cx - Math.sqrt(R * R - dySq);
      const yEntry = rayY;

      // Normal at entry point (outward from center)
      const nx1 = (xEntry - cx) / R;
      const ny1 = (yEntry - cy) / R;

      // Incident direction: (1, 0)
      const dotIN1 = 1 * nx1 + 0 * ny1;
      // angle of incidence
      const cosTheta1 = Math.abs(dotIN1);
      const sinTheta1 = Math.sqrt(1 - cosTheta1 * cosTheta1);

      // Snell's law: n1*sin(theta1) = n2*sin(theta2)
      const sinTheta2 = (n1 / n2) * sinTheta1;
      if (Math.abs(sinTheta2) > 1) continue; // total internal reflection

      const theta1 = Math.asin(sinTheta1);
      const theta2 = Math.asin(sinTheta2);

      // Refracted direction at entry (using vector form of Snell's law)
      const ratio = n1 / n2;
      const inwardN1x = -nx1;
      const inwardN1y = -ny1;
      const c1 = -(1 * nx1 + 0 * ny1);
      const refX1 = ratio * 1 + (ratio * c1 - Math.sqrt(1 - ratio * ratio * (1 - c1 * c1))) * inwardN1x;
      const refY1 = ratio * 0 + (ratio * c1 - Math.sqrt(1 - ratio * ratio * (1 - c1 * c1))) * inwardN1y;
      const refLen1 = Math.sqrt(refX1 * refX1 + refY1 * refY1);
      const rdx1 = refX1 / refLen1;
      const rdy1 = refY1 / refLen1;

      // Find exit point: ray from (xEntry, yEntry) in direction (rdx1, rdy1) intersects sphere
      // Parametric: P = entry + t * dir
      // |P - C|^2 = R^2
      const ex = xEntry - cx;
      const ey = yEntry - cy;
      const a = rdx1 * rdx1 + rdy1 * rdy1;
      const b = 2 * (ex * rdx1 + ey * rdy1);
      const c = ex * ex + ey * ey - R * R;
      const disc = b * b - 4 * a * c;
      if (disc < 0) continue;

      const t2 = (-b + Math.sqrt(disc)) / (2 * a);
      if (t2 <= 0.01) continue;

      const xExit = xEntry + rdx1 * t2;
      const yExit = yEntry + rdy1 * t2;

      // Normal at exit point (outward)
      const nx2 = (xExit - cx) / R;
      const ny2 = (yExit - cy) / R;

      // Snell's law at exit: n2 -> n1
      const cosTheta3 = Math.abs(rdx1 * nx2 + rdy1 * ny2);
      const sinTheta3 = Math.sqrt(Math.max(0, 1 - cosTheta3 * cosTheta3));
      const sinTheta4 = (n2 / n1) * sinTheta3;
      if (Math.abs(sinTheta4) > 1) continue; // total internal reflection

      const theta3 = Math.asin(sinTheta3);
      const theta4 = Math.asin(sinTheta4);

      // Refracted direction at exit
      const ratio2 = n2 / n1;
      const c2 = -(rdx1 * nx2 + rdy1 * ny2);
      const sqrtTerm = 1 - ratio2 * ratio2 * (1 - c2 * c2);
      if (sqrtTerm < 0) continue;
      const refX2 = ratio2 * rdx1 + (ratio2 * c2 - Math.sqrt(sqrtTerm)) * nx2;
      const refY2 = ratio2 * rdy1 + (ratio2 * c2 - Math.sqrt(sqrtTerm)) * ny2;
      const refLen2 = Math.sqrt(refX2 * refX2 + refY2 * refY2);
      const rdx2 = refX2 / refLen2;
      const rdy2 = refY2 / refLen2;

      // Draw segments
      const incidentStart = Math.max(0, xEntry - objectDistance);
      segments.push({ x1: incidentStart, y1: rayY, x2: xEntry, y2: yEntry, type: "incident" });
      segments.push({ x1: xEntry, y1: yEntry, x2: xExit, y2: yExit, type: "internal" });

      const exitExtend = width * 0.6;
      segments.push({
        x1: xExit, y1: yExit,
        x2: xExit + rdx2 * exitExtend, y2: yExit + rdy2 * exitExtend,
        type: "exit",
      });

      rays.push(segments);

      // Store refraction info
      refractionPoints.push({ x: xEntry, y: yEntry, thetaI: theta1 / DEG, thetaR: theta2 / DEG });
      refractionPoints.push({ x: xExit, y: yExit, thetaI: theta3 / DEG, thetaR: theta4 / DEG });

      // Estimate focal point (where exit ray crosses optical axis)
      if (Math.abs(rdy2) > 0.001) {
        const tFocal = (cy - yExit) / rdy2;
        if (tFocal > 0) {
          focalCandidates.push(xExit + rdx2 * tFocal);
        }
      }
    }

    if (focalCandidates.length > 0) {
      focalX = focalCandidates.reduce((s, v) => s + v, 0) / focalCandidates.length;
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    computeRays();
  }

  function update(dt: number, params: Record<string, number>): void {
    refractiveIndex = params.refractiveIndex ?? 1.5;
    sphereRadius = params.sphereRadius ?? 100;
    numRays = Math.round(params.numRays ?? 7);
    objectDistance = params.objectDistance ?? 250;
    time += dt;
    computeRays();
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#070714");
    grad.addColorStop(0.5, "#0c0c22");
    grad.addColorStop(1, "#0a0a1c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawOpticalAxis(): void {
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, sphereCenterY());
    ctx.lineTo(width, sphereCenterY());
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawSphere(): void {
    const cx = sphereCenterX();
    const cy = sphereCenterY();
    const R = sphereRadius;

    ctx.save();
    // Outer glow
    const outerGlow = ctx.createRadialGradient(cx, cy, R - 4, cx, cy, R + 20);
    outerGlow.addColorStop(0, "rgba(180, 210, 255, 0.08)");
    outerGlow.addColorStop(1, "rgba(180, 210, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, R + 20, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Glass sphere with gradient
    const glassGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.05, cx, cy, R);
    glassGrad.addColorStop(0, "rgba(220, 240, 255, 0.18)");
    glassGrad.addColorStop(0.4, "rgba(160, 200, 240, 0.10)");
    glassGrad.addColorStop(0.8, "rgba(120, 170, 220, 0.06)");
    glassGrad.addColorStop(1, "rgba(100, 150, 200, 0.12)");
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Edge highlight
    ctx.strokeStyle = "rgba(180, 215, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Specular highlight
    const specGrad = ctx.createRadialGradient(
      cx - R * 0.35, cy - R * 0.35, 0,
      cx - R * 0.35, cy - R * 0.35, R * 0.4
    );
    specGrad.addColorStop(0, "rgba(255, 255, 255, 0.25)");
    specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx - R * 0.35, cy - R * 0.35, R * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    ctx.restore();
  }

  function drawRays(): void {
    ctx.save();
    for (const segs of rays) {
      for (const seg of segs) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);

        if (seg.type === "incident") {
          ctx.strokeStyle = "rgba(255, 220, 60, 0.8)";
          ctx.lineWidth = 1.8;
        } else if (seg.type === "internal") {
          ctx.strokeStyle = "rgba(100, 200, 255, 0.7)";
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = "rgba(255, 120, 60, 0.75)";
          ctx.lineWidth = 1.8;
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFocalPoint(): void {
    if (rays.length === 0) return;
    const cy = sphereCenterY();

    // Focal point glow
    const glow = ctx.createRadialGradient(focalX, cy, 0, focalX, cy, 14);
    glow.addColorStop(0, "rgba(255, 160, 50, 0.6)");
    glow.addColorStop(0.5, "rgba(255, 100, 30, 0.2)");
    glow.addColorStop(1, "rgba(255, 80, 20, 0)");
    ctx.beginPath();
    ctx.arc(focalX, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(focalX, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ff9030";
    ctx.fill();

    ctx.fillStyle = "rgba(255, 180, 80, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F", focalX, cy + 22);
  }

  function drawObject(): void {
    const cx = sphereCenterX();
    const cy = sphereCenterY();
    const objX = cx - objectDistance;
    const arrowH = sphereRadius * 0.6;

    ctx.save();
    // Arrow (object)
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(objX, cy);
    ctx.lineTo(objX, cy - arrowH);
    ctx.stroke();

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.moveTo(objX, cy - arrowH);
    ctx.lineTo(objX - 6, cy - arrowH + 12);
    ctx.lineTo(objX + 6, cy - arrowH + 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Object", objX, cy + 16);
    ctx.restore();

    // Inverted image near focal point
    if (rays.length > 0 && focalX > cx) {
      const imgX = focalX + 15;
      const imgH = arrowH * 0.4;

      ctx.save();
      ctx.strokeStyle = "rgba(168, 85, 247, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(imgX, cy);
      ctx.lineTo(imgX, cy + imgH); // inverted
      ctx.stroke();

      ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
      ctx.beginPath();
      ctx.moveTo(imgX, cy + imgH);
      ctx.lineTo(imgX - 5, cy + imgH - 10);
      ctx.lineTo(imgX + 5, cy + imgH - 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Image (inverted)", imgX, cy - 10);
      ctx.restore();
    }
  }

  function drawAngleLabels(): void {
    if (refractionPoints.length < 2) return;
    ctx.save();

    // Show angles at first entry and first exit point
    const entry = refractionPoints[0];
    const exit = refractionPoints[1];

    ctx.fillStyle = "rgba(255, 220, 60, 0.7)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`i=${entry.thetaI.toFixed(1)}`, entry.x - 50, entry.y - 10);
    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.fillText(`r=${entry.thetaR.toFixed(1)}`, entry.x - 50, entry.y + 2);

    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.textAlign = "right";
    ctx.fillText(`i=${exit.thetaI.toFixed(1)}`, exit.x + 52, exit.y - 10);
    ctx.fillStyle = "rgba(255, 120, 60, 0.7)";
    ctx.fillText(`r=${exit.thetaR.toFixed(1)}`, exit.x + 52, exit.y + 2);

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 260;
    const ph = 140;
    const px = 10;
    const py = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Crystal Ball Refraction", px + 10, py + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("Snell's Law: n\u2081 sin(\u03B8\u2081) = n\u2082 sin(\u03B8\u2082)", px + 10, py + 40);
    ctx.fillText(`n(glass) = ${refractiveIndex.toFixed(2)}, n(air) = 1.00`, px + 10, py + 58);
    ctx.fillText(`Sphere radius = ${sphereRadius.toFixed(0)} px`, px + 10, py + 74);
    ctx.fillText(`Rays = ${numRays}, Object dist = ${objectDistance.toFixed(0)} px`, px + 10, py + 90);

    if (rays.length > 0) {
      const fDist = (focalX - sphereCenterX()).toFixed(1);
      ctx.fillText(`Focal distance from center: ${fDist} px`, px + 10, py + 108);
    }

    // Legend
    const ly = py + 126;
    ctx.fillStyle = "rgba(255, 220, 60, 0.9)";
    ctx.fillRect(px + 10, ly - 4, 18, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("Incident", px + 32, ly);

    ctx.fillStyle = "rgba(100, 200, 255, 0.9)";
    ctx.fillRect(px + 82, ly - 4, 18, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText("Internal", px + 104, ly);

    ctx.fillStyle = "rgba(255, 120, 60, 0.9)";
    ctx.fillRect(px + 156, ly - 4, 18, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText("Exit", px + 178, ly);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawOpticalAxis();
    drawRays();
    drawSphere();
    drawFocalPoint();
    drawObject();
    drawAngleLabels();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const fDist = rays.length > 0 ? (focalX - sphereCenterX()).toFixed(1) : "N/A";
    return (
      `Crystal Ball Refraction: glass sphere with n=${refractiveIndex.toFixed(2)}, ` +
      `radius=${sphereRadius}px, ${numRays} parallel rays. ` +
      `Snell's law n\u2081 sin(\u03B8\u2081) = n\u2082 sin(\u03B8\u2082) applied at entry and exit surfaces. ` +
      `Rays converge to focal point at distance ${fDist}px from sphere center. ` +
      `Object at ${objectDistance}px produces an inverted real image. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeRays();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default CrystalBallFactory;
