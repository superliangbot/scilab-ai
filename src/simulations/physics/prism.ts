import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PrismFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("prism") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let prismAngle = 60;
  let incidentAngle = 45;
  let refractiveIndex = 1.52;
  let showSpectrum = 1;

  const spectralColors = [
    { name: "Red", wavelength: 700, color: "#ff0000", n: 1.510 },
    { name: "Orange", wavelength: 620, color: "#ff7700", n: 1.514 },
    { name: "Yellow", wavelength: 580, color: "#ffdd00", n: 1.518 },
    { name: "Green", wavelength: 530, color: "#00cc00", n: 1.522 },
    { name: "Blue", wavelength: 470, color: "#0044ff", n: 1.530 },
    { name: "Indigo", wavelength: 440, color: "#4400aa", n: 1.535 },
    { name: "Violet", wavelength: 400, color: "#8800cc", n: 1.542 },
  ];

  function getPrismVertices(): { x: number; y: number }[] {
    const cx = width * 0.45;
    const cy = height * 0.52;
    const size = Math.min(width, height) * 0.28;
    const angleRad = (prismAngle * Math.PI) / 180;
    const halfBase = size * Math.sin(angleRad / 2);
    const h = size * Math.cos(angleRad / 2);
    return [
      { x: cx, y: cy - h * 0.6 },
      { x: cx - halfBase, y: cy + h * 0.4 },
      { x: cx + halfBase, y: cy + h * 0.4 },
    ];
  }

  function snell(theta1: number, n1: number, n2: number): number {
    const sinTheta2 = (n1 / n2) * Math.sin(theta1);
    if (Math.abs(sinTheta2) > 1) return NaN;
    return Math.asin(sinTheta2);
  }

  function lineIntersectSegment(
    ox: number, oy: number, dx: number, dy: number,
    ax: number, ay: number, bx: number, by: number
  ): { t: number; x: number; y: number } | null {
    const ex = bx - ax, ey = by - ay;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) return null;
    const t = ((ax - ox) * ey - (ay - oy) * ex) / denom;
    const s = ((ax - ox) * dy - (ay - oy) * dx) / denom;
    if (t < 0.001 || s < 0 || s > 1) return null;
    return { t, x: ox + dx * t, y: oy + dy * t };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    prismAngle = params.prismAngle ?? 60;
    incidentAngle = params.incidentAngle ?? 45;
    refractiveIndex = params.refractiveIndex ?? 1.52;
    showSpectrum = params.showSpectrum ?? 1;
    time += dt;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const verts = getPrismVertices();

    // Draw prism
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    ctx.lineTo(verts[1].x, verts[1].y);
    ctx.lineTo(verts[2].x, verts[2].y);
    ctx.closePath();
    const prismGrad = ctx.createLinearGradient(verts[0].x, verts[0].y, verts[1].x, verts[1].y);
    prismGrad.addColorStop(0, "rgba(180, 220, 255, 0.15)");
    prismGrad.addColorStop(1, "rgba(100, 160, 255, 0.08)");
    ctx.fillStyle = prismGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 220, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left face: verts[0] to verts[1]
    const leftFace = { ax: verts[1].x, ay: verts[1].y, bx: verts[0].x, by: verts[0].y };
    const leftNx = -(leftFace.by - leftFace.ay);
    const leftNy = leftFace.bx - leftFace.ax;
    const leftNLen = Math.sqrt(leftNx * leftNx + leftNy * leftNy);
    const lnx = leftNx / leftNLen, lny = leftNy / leftNLen;

    // Incident ray direction
    const incRad = (incidentAngle * Math.PI) / 180;
    const faceDx = verts[0].x - verts[1].x;
    const faceDy = verts[0].y - verts[1].y;
    const faceAngle = Math.atan2(faceDy, faceDx);
    const normalAngle = Math.atan2(lny, lnx);

    // Ray comes from the left
    const rayAngle = normalAngle + incRad;
    const rayDx = Math.cos(rayAngle);
    const rayDy = Math.sin(rayAngle);

    // Find intersection with left face
    const midLeftX = (verts[0].x + verts[1].x) / 2;
    const midLeftY = (verts[0].y + verts[1].y) / 2;
    const startX = midLeftX - rayDx * 400;
    const startY = midLeftY - rayDy * 400;

    const hit1 = lineIntersectSegment(
      startX, startY, rayDx, rayDy,
      verts[1].x, verts[1].y, verts[0].x, verts[0].y
    );

    if (!hit1) {
      drawLabel();
      return;
    }

    // Draw incident ray (white)
    ctx.beginPath();
    ctx.moveTo(hit1.x - rayDx * 300, hit1.y - rayDy * 300);
    ctx.lineTo(hit1.x, hit1.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw glow on incident ray
    ctx.beginPath();
    ctx.moveTo(hit1.x - rayDx * 300, hit1.y - rayDy * 300);
    ctx.lineTo(hit1.x, hit1.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 8;
    ctx.stroke();

    // Normal at entry point
    ctx.beginPath();
    ctx.moveTo(hit1.x - lnx * 40, hit1.y - lny * 40);
    ctx.lineTo(hit1.x + lnx * 40, hit1.y + lny * 40);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Right face: verts[0] to verts[2]
    const rightFace = { ax: verts[0].x, ay: verts[0].y, bx: verts[2].x, by: verts[2].y };
    const rNx = -(rightFace.by - rightFace.ay);
    const rNy = rightFace.bx - rightFace.ax;
    const rNLen = Math.sqrt(rNx * rNx + rNy * rNy);
    const rnx = rNx / rNLen, rny = rNy / rNLen;

    // Refract through prism and disperse
    const colors = showSpectrum ? spectralColors : [{ name: "White", wavelength: 550, color: "#ffffff", n: refractiveIndex }];

    for (const c of colors) {
      const n = showSpectrum ? refractiveIndex * (c.n / 1.52) : refractiveIndex;

      // Refraction at entry (air -> glass)
      const dotIn = -(rayDx * lnx + rayDy * lny);
      const theta1 = Math.acos(Math.min(1, Math.abs(dotIn)));
      const theta2 = snell(theta1, 1.0, n);
      if (isNaN(theta2)) continue;

      // Compute refracted direction inside prism
      const sign = dotIn < 0 ? -1 : 1;
      const cosT2 = Math.cos(theta2);
      const sinRatio = Math.sin(theta1) > 0 ? Math.sin(theta2) / Math.sin(theta1) : 0;
      const refDx = rayDx * sinRatio + lnx * sign * (cosT2 - dotIn * sinRatio);
      const refDy = rayDy * sinRatio + lny * sign * (cosT2 - dotIn * sinRatio);
      const refLen = Math.sqrt(refDx * refDx + refDy * refDy);
      const nRefDx = refDx / refLen, nRefDy = refDy / refLen;

      // Find intersection with right face
      const hit2 = lineIntersectSegment(
        hit1.x, hit1.y, nRefDx, nRefDy,
        verts[0].x, verts[0].y, verts[2].x, verts[2].y
      );
      if (!hit2) {
        // Try bottom face
        const hit2b = lineIntersectSegment(
          hit1.x, hit1.y, nRefDx, nRefDy,
          verts[1].x, verts[1].y, verts[2].x, verts[2].y
        );
        if (!hit2b) continue;
        // Draw internal ray
        ctx.beginPath();
        ctx.moveTo(hit1.x, hit1.y);
        ctx.lineTo(hit2b.x, hit2b.y);
        ctx.strokeStyle = showSpectrum ? c.color : "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }

      // Draw internal ray
      ctx.beginPath();
      ctx.moveTo(hit1.x, hit1.y);
      ctx.lineTo(hit2.x, hit2.y);
      ctx.strokeStyle = showSpectrum ? c.color : "rgba(255,255,255,0.6)";
      ctx.lineWidth = showSpectrum ? 1.5 : 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Second refraction (glass -> air)
      const dot2 = -(nRefDx * rnx + nRefDy * rny);
      const phi1 = Math.acos(Math.min(1, Math.abs(dot2)));
      const phi2 = snell(phi1, n, 1.0);
      if (isNaN(phi2)) continue;

      const sign2 = dot2 < 0 ? -1 : 1;
      const cosP2 = Math.cos(phi2);
      const sinR2 = Math.sin(phi1) > 0 ? Math.sin(phi2) / Math.sin(phi1) : 0;
      const outDx = nRefDx * sinR2 + rnx * sign2 * (cosP2 - dot2 * sinR2);
      const outDy = nRefDy * sinR2 + rny * sign2 * (cosP2 - dot2 * sinR2);
      const outLen = Math.sqrt(outDx * outDx + outDy * outDy);

      // Draw exit ray
      ctx.beginPath();
      ctx.moveTo(hit2.x, hit2.y);
      ctx.lineTo(hit2.x + (outDx / outLen) * 400, hit2.y + (outDy / outLen) * 400);
      ctx.strokeStyle = c.color;
      ctx.lineWidth = showSpectrum ? 2 : 2.5;
      ctx.stroke();

      // Glow on exit ray
      ctx.beginPath();
      ctx.moveTo(hit2.x, hit2.y);
      ctx.lineTo(hit2.x + (outDx / outLen) * 400, hit2.y + (outDy / outLen) * 400);
      ctx.strokeStyle = c.color.replace(")", ",0.2)").replace("rgb", "rgba");
      ctx.lineWidth = 6;
      ctx.stroke();

      // Color label at end of ray
      if (showSpectrum) {
        const labelX = hit2.x + (outDx / outLen) * 250;
        const labelY = hit2.y + (outDy / outLen) * 250;
        ctx.fillStyle = c.color;
        ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${c.name} (${c.wavelength}nm)`, labelX + 8, labelY);
      }
    }

    drawLabel();
  }

  function drawLabel(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Dispersion of Light Through a Prism", width / 2, 30);

    ctx.fillStyle = "rgba(180, 220, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(
      `Prism angle: ${prismAngle.toFixed(0)}°  |  Incident angle: ${incidentAngle.toFixed(0)}°  |  n = ${refractiveIndex.toFixed(2)}`,
      width / 2, height - 20
    );

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `Prism simulation: A triangular prism with apex angle ${prismAngle}° and refractive index ${refractiveIndex}. ` +
      `White light enters at ${incidentAngle}° incident angle. The prism disperses light into its spectral components ` +
      `(red through violet) due to wavelength-dependent refraction (dispersion). ` +
      `Shorter wavelengths (violet) are refracted more than longer wavelengths (red). ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PrismFactory;
