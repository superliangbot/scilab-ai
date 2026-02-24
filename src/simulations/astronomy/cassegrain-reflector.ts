import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const CassegrainReflectorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cassegrain-reflector") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let lightAngle = 0; // degrees
  let primaryFocal = 120;
  let secondarySize = 0.3;
  let numRays = 8;

  // Stars for background
  let stars: Array<{ x: number; y: number; brightness: number; size: number }> = [];

  // Computed layout values
  let tubeLeft = 0;
  let tubeRight = 0;
  let tubeTop = 0;
  let tubeBottom = 0;
  let primaryCenterX = 0;
  let primaryCenterY = 0;
  let primaryRadius = 0; // half-height of primary mirror
  let secondaryCenterX = 0;
  let secondaryCenterY = 0;
  let secondaryRadius = 0;
  let focalPointX = 0;
  let focalPointY = 0;
  let primaryFocalPointX = 0;

  function computeLayout(): void {
    const margin = Math.min(width, height) * 0.08;
    tubeLeft = margin + width * 0.05;
    tubeRight = width - margin - width * 0.15;
    tubeTop = height * 0.2;
    tubeBottom = height * 0.8;

    const tubeWidth = tubeRight - tubeLeft;
    const tubeHeight = tubeBottom - tubeTop;

    // Primary mirror at right end of tube
    primaryCenterX = tubeRight;
    primaryCenterY = (tubeTop + tubeBottom) / 2;
    primaryRadius = tubeHeight * 0.45;

    // Primary focal point (inside the tube)
    const scaledFocal = (primaryFocal / 200) * tubeWidth * 0.6;
    primaryFocalPointX = primaryCenterX - scaledFocal;

    // Secondary mirror near the focal point of primary, but closer to the opening
    secondaryCenterX = primaryFocalPointX + scaledFocal * 0.15;
    secondaryCenterY = primaryCenterY;
    secondaryRadius = primaryRadius * secondarySize;

    // Focal point behind the primary mirror (through the hole)
    focalPointX = primaryCenterX + tubeWidth * 0.12;
    focalPointY = primaryCenterY;
  }

  function generateStars(): void {
    stars = [];
    const count = Math.floor((width * height) / 800);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        brightness: 0.15 + Math.random() * 0.85,
        size: 0.3 + Math.random() * 1.2,
      });
    }
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#050510");
    bgGrad.addColorStop(0.5, "#0a0a1a");
    bgGrad.addColorStop(1, "#0d0d25");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (const star of stars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * 2.5 + star.x * 0.03 + star.y * 0.05);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle})`;
      ctx.fill();
    }
  }

  function drawTubeBody(): void {
    // Telescope tube
    ctx.fillStyle = "rgba(30, 35, 50, 0.7)";
    ctx.beginPath();
    ctx.roundRect(tubeLeft - 5, tubeTop - 8, tubeRight - tubeLeft + 10, tubeBottom - tubeTop + 16, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 120, 160, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner tube
    ctx.fillStyle = "rgba(15, 18, 30, 0.9)";
    ctx.fillRect(tubeLeft, tubeTop, tubeRight - tubeLeft, tubeBottom - tubeTop);

    // Tube top/bottom rails
    ctx.fillStyle = "rgba(80, 90, 120, 0.4)";
    ctx.fillRect(tubeLeft, tubeTop - 2, tubeRight - tubeLeft, 4);
    ctx.fillRect(tubeLeft, tubeBottom - 2, tubeRight - tubeLeft, 4);
  }

  function drawPrimaryMirror(): void {
    // Parabolic primary mirror (concave, at right side)
    const segments = 60;
    const holeRadius = secondaryRadius * 0.6; // hole for light to pass through

    ctx.save();

    // Mirror surface (parabolic curve)
    const curvature = primaryRadius * 0.12;

    // Draw the mirror as a curved surface
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = primaryCenterY - primaryRadius + t * primaryRadius * 2;
      const dy = (y - primaryCenterY) / primaryRadius;
      // Parabolic shape: x offset = curvature * y^2
      const x = primaryCenterX + curvature * dy * dy;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Mirror back
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const y = primaryCenterY - primaryRadius + t * primaryRadius * 2;
      const dy = (y - primaryCenterY) / primaryRadius;
      const x = primaryCenterX + curvature * dy * dy + 8;

      ctx.lineTo(x, y);
    }

    ctx.closePath();

    // Mirror gradient (reflective look)
    const mirGrad = ctx.createLinearGradient(primaryCenterX - 10, primaryCenterY - primaryRadius, primaryCenterX + 10, primaryCenterY + primaryRadius);
    mirGrad.addColorStop(0, "rgba(140, 160, 200, 0.8)");
    mirGrad.addColorStop(0.3, "rgba(180, 200, 240, 0.9)");
    mirGrad.addColorStop(0.5, "rgba(220, 230, 255, 0.95)");
    mirGrad.addColorStop(0.7, "rgba(180, 200, 240, 0.9)");
    mirGrad.addColorStop(1, "rgba(140, 160, 200, 0.8)");
    ctx.fillStyle = mirGrad;
    ctx.fill();

    // Highlight edge
    ctx.strokeStyle = "rgba(200, 220, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hole in center for Cassegrain focus
    const holeCurvatureX = primaryCenterX + curvature * 0.001; // approximately at center
    ctx.beginPath();
    ctx.arc(holeCurvatureX + 4, primaryCenterY, holeRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 18, 30, 0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 120, 160, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Label
    ctx.fillStyle = "rgba(180, 200, 255, 0.6)";
    ctx.font = `${Math.max(10, Math.min(12, width / 60))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Primary Mirror", primaryCenterX + 20, tubeBottom + 14);
    ctx.fillText("(Parabolic, Concave)", primaryCenterX + 20, tubeBottom + 28);
  }

  function drawSecondaryMirror(): void {
    // Convex secondary mirror
    const curvature = secondaryRadius * 0.15;
    const segments = 30;

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = secondaryCenterY - secondaryRadius + t * secondaryRadius * 2;
      const dy = (y - secondaryCenterY) / secondaryRadius;
      const x = secondaryCenterX - curvature * dy * dy;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Back of secondary
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const y = secondaryCenterY - secondaryRadius + t * secondaryRadius * 2;
      const dy = (y - secondaryCenterY) / secondaryRadius;
      const x = secondaryCenterX - curvature * dy * dy - 5;

      ctx.lineTo(x, y);
    }

    ctx.closePath();

    const secGrad = ctx.createLinearGradient(secondaryCenterX - 5, secondaryCenterY - secondaryRadius, secondaryCenterX + 5, secondaryCenterY + secondaryRadius);
    secGrad.addColorStop(0, "rgba(160, 180, 220, 0.85)");
    secGrad.addColorStop(0.5, "rgba(210, 225, 255, 0.95)");
    secGrad.addColorStop(1, "rgba(160, 180, 220, 0.85)");
    ctx.fillStyle = secGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 220, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Support struts (spider vanes)
    ctx.strokeStyle = "rgba(120, 140, 180, 0.3)";
    ctx.lineWidth = 1.5;

    // 4 struts from secondary to tube walls
    const strutEnds = [
      { x: secondaryCenterX, y: tubeTop },
      { x: secondaryCenterX, y: tubeBottom },
      { x: secondaryCenterX - (secondaryCenterX - tubeLeft) * 0.5, y: tubeTop },
      { x: secondaryCenterX - (secondaryCenterX - tubeLeft) * 0.5, y: tubeBottom },
    ];

    for (const end of strutEnds) {
      ctx.beginPath();
      ctx.moveTo(secondaryCenterX, secondaryCenterY);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = "rgba(180, 200, 255, 0.6)";
    ctx.font = `${Math.max(10, Math.min(12, width / 60))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Secondary Mirror", secondaryCenterX, tubeTop - 14);
    ctx.fillText("(Hyperbolic, Convex)", secondaryCenterX, tubeTop - 0);
  }

  function drawLightRays(): void {
    const angleRad = (lightAngle * Math.PI) / 180;

    // Primary mirror curvature for reflection calculations
    const primaryCurvature = primaryRadius * 0.12;
    const holeRadius = secondaryRadius * 0.6;

    ctx.lineWidth = 1.5;

    for (let i = 0; i < numRays; i++) {
      // Distribute rays evenly across the aperture, but avoid the secondary mirror shadow
      const t = (i + 0.5) / numRays;
      const rayY = primaryCenterY - primaryRadius * 0.9 + t * primaryRadius * 1.8;

      // Skip rays that hit the secondary mirror obstruction directly
      if (Math.abs(rayY - secondaryCenterY) < secondaryRadius * 0.5) continue;

      // Incoming ray animation
      const rayProgress = Math.min(1, (time * 0.8 - i * 0.05) * 2);
      if (rayProgress <= 0) continue;

      // 1. Incoming parallel ray (from left, slightly angled)
      const incomingStartX = tubeLeft - width * 0.1;
      const incomingStartY = rayY - Math.tan(angleRad) * (primaryCenterX - incomingStartX);

      // Point on primary mirror where ray hits
      const hitY = rayY;
      const hitDy = (hitY - primaryCenterY) / primaryRadius;
      const hitX = primaryCenterX + primaryCurvature * hitDy * hitDy;

      // Draw incoming ray (yellow)
      const inAlpha = Math.min(1, rayProgress * 2);
      ctx.strokeStyle = `rgba(255, 230, 100, ${inAlpha * 0.8})`;
      ctx.beginPath();
      const inEndX = incomingStartX + (hitX - incomingStartX) * Math.min(1, rayProgress * 2);
      const inEndY = incomingStartY + (hitY - incomingStartY) * Math.min(1, rayProgress * 2);
      ctx.moveTo(incomingStartX, incomingStartY);
      ctx.lineTo(inEndX, inEndY);
      ctx.stroke();

      // Ray glow
      ctx.strokeStyle = `rgba(255, 230, 100, ${inAlpha * 0.2})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(incomingStartX, incomingStartY);
      ctx.lineTo(inEndX, inEndY);
      ctx.stroke();
      ctx.lineWidth = 1.5;

      if (rayProgress < 0.5) continue;

      // 2. Reflected ray from primary mirror toward secondary mirror
      // Primary is concave parabolic, reflects incoming parallel light toward focal point
      // The reflected ray goes toward the primary focal point
      const reflectProgress = Math.min(1, (rayProgress - 0.5) * 3);

      // Direction toward primary focal point
      const toPrimFocalDx = primaryFocalPointX - hitX;
      const toPrimFocalDy = primaryCenterY - hitY; // focal point is on axis

      // Where does reflected ray intersect with secondary mirror plane?
      // Parametric: point = hit + t * toFocal
      // When x = secondaryCenterX
      const tToSecondary = (secondaryCenterX - hitX) / toPrimFocalDx;
      const secHitY = hitY + tToSecondary * toPrimFocalDy;

      // Check if the ray actually hits the secondary mirror
      const hitsSecondary = Math.abs(secHitY - secondaryCenterY) <= secondaryRadius;

      if (hitsSecondary) {
        // Draw reflected ray from primary to secondary (orange)
        const refEndX = hitX + (secondaryCenterX - hitX) * reflectProgress;
        const refEndY = hitY + (secHitY - hitY) * reflectProgress;
        ctx.strokeStyle = `rgba(255, 180, 50, ${0.8})`;
        ctx.beginPath();
        ctx.moveTo(hitX, hitY);
        ctx.lineTo(refEndX, refEndY);
        ctx.stroke();

        // Glow
        ctx.strokeStyle = `rgba(255, 180, 50, 0.2)`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(hitX, hitY);
        ctx.lineTo(refEndX, refEndY);
        ctx.stroke();
        ctx.lineWidth = 1.5;

        if (reflectProgress < 1) continue;

        // 3. Reflected from secondary mirror back through the hole in primary to focal point
        // Secondary is convex hyperbolic, diverges the converging light back through the hole
        const finalProgress = Math.min(1, (rayProgress - 0.83) * 6);

        const finalEndX = secondaryCenterX + (focalPointX - secondaryCenterX) * finalProgress;
        const finalEndY = secHitY + (focalPointY - secHitY) * finalProgress;

        ctx.strokeStyle = `rgba(255, 120, 50, ${0.8})`;
        ctx.beginPath();
        ctx.moveTo(secondaryCenterX, secHitY);
        ctx.lineTo(finalEndX, finalEndY);
        ctx.stroke();

        // Glow
        ctx.strokeStyle = `rgba(255, 120, 50, 0.2)`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(secondaryCenterX, secHitY);
        ctx.lineTo(finalEndX, finalEndY);
        ctx.stroke();
        ctx.lineWidth = 1.5;
      } else {
        // Ray misses secondary, just draw it going toward focal point
        const focalDist = Math.sqrt(toPrimFocalDx * toPrimFocalDx + toPrimFocalDy * toPrimFocalDy);
        const extLen = focalDist * 1.2;
        const refEndX = hitX + (toPrimFocalDx / focalDist) * extLen * reflectProgress;
        const refEndY = hitY + (toPrimFocalDy / focalDist) * extLen * reflectProgress;

        ctx.strokeStyle = `rgba(255, 180, 50, ${0.4})`;
        ctx.beginPath();
        ctx.moveTo(hitX, hitY);
        ctx.lineTo(refEndX, refEndY);
        ctx.stroke();
      }
    }

    // Focal point indicator
    const focalGlow = ctx.createRadialGradient(focalPointX, focalPointY, 0, focalPointX, focalPointY, 25);
    focalGlow.addColorStop(0, `rgba(255, 200, 100, ${0.3 + 0.3 * Math.sin(time * 3)})`);
    focalGlow.addColorStop(0.5, `rgba(255, 150, 50, ${0.15 + 0.1 * Math.sin(time * 3)})`);
    focalGlow.addColorStop(1, "rgba(255, 100, 50, 0)");
    ctx.fillStyle = focalGlow;
    ctx.beginPath();
    ctx.arc(focalPointX, focalPointY, 25, 0, Math.PI * 2);
    ctx.fill();

    // Focal point dot
    ctx.fillStyle = "rgba(255, 220, 150, 0.9)";
    ctx.beginPath();
    ctx.arc(focalPointX, focalPointY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Focal point label
    ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
    ctx.font = `${Math.max(10, Math.min(12, width / 60))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Focus / Eyepiece", focalPointX, focalPointY + 16);

    // Primary focal point indicator (inside tube)
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.arc(primaryFocalPointX, primaryCenterY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = `${Math.max(9, Math.min(10, width / 70))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("f\u2081", primaryFocalPointX, primaryCenterY - 8);
  }

  function drawEyepiece(): void {
    // Eyepiece housing behind primary mirror
    const epX = focalPointX;
    const epY = focalPointY;
    const epW = 20;
    const epH = 30;

    ctx.fillStyle = "rgba(60, 65, 85, 0.8)";
    ctx.beginPath();
    ctx.roundRect(epX - epW / 2, epY - epH / 2, epW, epH, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 140, 180, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lens element
    ctx.fillStyle = "rgba(150, 180, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(epX - epW / 2, epY, 4, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
  }

  function drawInfoPanel(): void {
    const panelH = 60;
    const panelY = height - panelH - 8;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, width - 16, panelH, 6);
    ctx.fill();

    const fontSize = Math.max(10, Math.min(12, width / 60));
    ctx.font = `${fontSize}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const y1 = panelY + 15;
    const y2 = panelY + 32;
    const y3 = panelY + 49;

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Primary focal length: ${primaryFocal}mm`, 16, y1);
    ctx.fillText(`Secondary size ratio: ${(secondarySize * 100).toFixed(0)}%`, 16 + width * 0.35, y1);

    ctx.fillText(`Light angle: ${lightAngle.toFixed(1)}\u00B0`, 16, y2);
    ctx.fillText(`Rays: ${numRays}`, 16 + width * 0.35, y2);

    // Effective focal length approximation
    const effectiveFocal = primaryFocal / (1 - secondarySize);
    ctx.fillText(`Effective f.l. \u2248 ${effectiveFocal.toFixed(0)}mm (amplified by secondary)`, 16, y3);

    // Design label
    ctx.fillStyle = "rgba(180, 200, 255, 0.5)";
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("Cassegrain Reflector Design", width - 16, y1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillText("Parabolic primary + Hyperbolic secondary", width - 16, y2);
    ctx.fillText(`t = ${time.toFixed(1)}s`, width - 16, y3);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `bold ${Math.max(12, Math.min(15, width / 45))}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Cassegrain Reflector Telescope", 12, 10);

    // Light source label on far left
    ctx.fillStyle = "rgba(255, 230, 100, 0.5)";
    ctx.font = `${Math.max(10, Math.min(11, width / 60))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Incoming Light", tubeLeft - width * 0.03, primaryCenterY - primaryRadius - 10);
    ctx.fillText(`(${lightAngle.toFixed(1)}\u00B0)`, tubeLeft - width * 0.03, primaryCenterY - primaryRadius + 4);

    // Incoming light arrows
    for (let i = 0; i < 3; i++) {
      const arrowX = tubeLeft - width * 0.06 - i * 12;
      const arrowY = primaryCenterY;
      ctx.fillStyle = `rgba(255, 230, 100, ${0.3 - i * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(arrowX + 6, arrowY);
      ctx.lineTo(arrowX, arrowY - 4);
      ctx.lineTo(arrowX, arrowY + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    computeLayout();
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    lightAngle = params.lightAngle ?? 0;
    primaryFocal = params.primaryFocal ?? 120;
    secondarySize = params.secondarySize ?? 0.3;
    numRays = Math.round(params.numRays ?? 8);
    computeLayout();
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();
    drawTubeBody();
    drawPrimaryMirror();
    drawSecondaryMirror();
    drawLightRays();
    drawEyepiece();
    drawInfoPanel();
    drawTitle();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    stars = [];
  }

  function getStateDescription(): string {
    const effectiveFocal = primaryFocal / (1 - secondarySize);
    return (
      `Cassegrain Reflector Telescope simulation. ` +
      `Primary mirror focal length: ${primaryFocal}mm (parabolic, concave). ` +
      `Secondary mirror size: ${(secondarySize * 100).toFixed(0)}% of primary (hyperbolic, convex). ` +
      `Effective focal length: ${effectiveFocal.toFixed(0)}mm. ` +
      `Incoming light angle: ${lightAngle.toFixed(1)} degrees. ` +
      `${numRays} light rays shown. ` +
      `Light path: parallel rays hit concave primary, reflect toward primary focus, ` +
      `intercepted by convex secondary, re-diverged through hole in primary to Cassegrain focus. ` +
      `Key advantage: long effective focal length in a compact tube. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
    generateStars();
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default CassegrainReflectorFactory;
