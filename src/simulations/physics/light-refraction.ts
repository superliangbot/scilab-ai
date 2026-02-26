import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LightRefractionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("light-refraction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let incidentAngle = 45; // degrees
  let n1 = 1.0; // refractive index of medium 1 (top)
  let n2 = 1.5; // refractive index of medium 2 (bottom)
  let showAngles = 1;

  interface Medium {
    name: string;
    n: number;
    color: string;
  }

  const MEDIA: Medium[] = [
    { name: "Vacuum", n: 1.0, color: "rgba(0, 0, 0, 0)" },
    { name: "Air", n: 1.0003, color: "rgba(200, 220, 255, 0.03)" },
    { name: "Water", n: 1.333, color: "rgba(56, 189, 248, 0.15)" },
    { name: "Glass", n: 1.52, color: "rgba(148, 163, 184, 0.12)" },
    { name: "Diamond", n: 2.42, color: "rgba(200, 200, 255, 0.15)" },
  ];

  function getMediumByN(n: number): Medium {
    let closest = MEDIA[0];
    let minDiff = Infinity;
    for (const m of MEDIA) {
      const diff = Math.abs(m.n - n);
      if (diff < minDiff) {
        minDiff = diff;
        closest = m;
      }
    }
    return closest;
  }

  function snellsLaw(theta1: number, n1Val: number, n2Val: number): number | null {
    const sinTheta2 = (n1Val / n2Val) * Math.sin(theta1 * Math.PI / 180);
    if (Math.abs(sinTheta2) > 1) return null; // Total internal reflection
    return Math.asin(sinTheta2) * 180 / Math.PI;
  }

  function criticalAngle(n1Val: number, n2Val: number): number | null {
    if (n1Val <= n2Val) return null;
    return Math.asin(n2Val / n1Val) * 180 / Math.PI;
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
  }

  function update(dt: number, params: Record<string, number>) {
    incidentAngle = params.incidentAngle ?? 45;
    n1 = params.n1 ?? 1.0;
    n2 = params.n2 ?? 1.5;
    showAngles = params.showAngles ?? 1;
    time += Math.min(dt, 0.05);
  }

  function render() {
    if (!ctx) return;

    const interfaceY = H * 0.48;
    const hitX = W * 0.5;

    // Background - top medium
    ctx.fillStyle = "#0c1222";
    ctx.fillRect(0, 0, W, interfaceY);

    // Bottom medium
    const med2 = getMediumByN(n2);
    ctx.fillStyle = "#0c1222";
    ctx.fillRect(0, interfaceY, W, H - interfaceY);
    ctx.fillStyle = med2.color;
    ctx.fillRect(0, interfaceY, W, H - interfaceY);

    // Interface line
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, interfaceY);
    ctx.lineTo(W, interfaceY);
    ctx.stroke();

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Light Refraction — Snell's Law", W / 2, 28);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("n₁ sin(θ₁) = n₂ sin(θ₂)", W / 2, 48);

    // Medium labels
    const med1 = getMediumByN(n1);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText(`Medium 1: ${med1.name} (n = ${n1.toFixed(3)})`, 15, interfaceY - 15);
    ctx.fillText(`Medium 2: ${med2.name} (n = ${n2.toFixed(3)})`, 15, interfaceY + 25);

    // Normal line (dashed vertical)
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hitX, interfaceY - 220);
    ctx.lineTo(hitX, interfaceY + 220);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText("Normal", hitX + 5, interfaceY - 210);

    // Calculate refraction
    const refractedAngle = snellsLaw(incidentAngle, n1, n2);
    const isTIR = refractedAngle === null;
    const critical = criticalAngle(n1, n2);

    // Incident ray
    const incRad = incidentAngle * Math.PI / 180;
    const rayLen = 250;
    const incStartX = hitX - rayLen * Math.sin(incRad);
    const incStartY = interfaceY - rayLen * Math.cos(incRad);

    // Draw incident wavefronts
    ctx.strokeStyle = "rgba(251, 191, 36, 0.15)";
    ctx.lineWidth = 1;
    const waveFrontSpacing = 25 / n1;
    const wavePhase = (time * 100) % waveFrontSpacing;
    for (let d = wavePhase; d < rayLen; d += waveFrontSpacing) {
      const fx = incStartX + (hitX - incStartX) * (d / rayLen);
      const fy = incStartY + (interfaceY - incStartY) * (d / rayLen);
      const perpAngle = incRad + Math.PI / 2;
      const len = 20;
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(perpAngle) * len, fy + Math.sin(perpAngle) * len);
      ctx.lineTo(fx + Math.cos(perpAngle) * len, fy - Math.sin(perpAngle) * len);
      ctx.stroke();
    }

    // Incident ray line
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(incStartX, incStartY);
    ctx.lineTo(hitX, interfaceY);
    ctx.stroke();

    // Arrow on incident ray
    const incDir = Math.atan2(interfaceY - incStartY, hitX - incStartX);
    drawArrow(hitX - 30 * Math.cos(incDir), interfaceY - 30 * Math.sin(incDir), incDir, "#fbbf24");

    // Reflected ray
    const refStartX = hitX + rayLen * Math.sin(incRad);
    const refStartY = interfaceY - rayLen * Math.cos(incRad);

    const reflectIntensity = isTIR ? 1 : calculateReflectance(incidentAngle, n1, n2);
    ctx.strokeStyle = `rgba(34, 211, 238, ${0.3 + reflectIntensity * 0.7})`;
    ctx.lineWidth = 1.5 + reflectIntensity;
    ctx.beginPath();
    ctx.moveTo(hitX, interfaceY);
    ctx.lineTo(refStartX, refStartY);
    ctx.stroke();

    // Refracted ray (if not total internal reflection)
    if (!isTIR && refractedAngle !== null) {
      const refRad = refractedAngle * Math.PI / 180;
      const refEndX = hitX + rayLen * Math.sin(refRad);
      const refEndY = interfaceY + rayLen * Math.cos(refRad);

      // Refracted wavefronts
      ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
      ctx.lineWidth = 1;
      const waveFrontSpacing2 = 25 / n2;
      for (let d = wavePhase * (n1 / n2); d < rayLen; d += waveFrontSpacing2) {
        const fx = hitX + (refEndX - hitX) * (d / rayLen);
        const fy = interfaceY + (refEndY - interfaceY) * (d / rayLen);
        const perpAngle = refRad + Math.PI / 2;
        const len = 20;
        ctx.beginPath();
        ctx.moveTo(fx - Math.cos(perpAngle) * len, fy + Math.sin(perpAngle) * len);
        ctx.lineTo(fx + Math.cos(perpAngle) * len, fy - Math.sin(perpAngle) * len);
        ctx.stroke();
      }

      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2.5 * (1 - reflectIntensity);
      ctx.beginPath();
      ctx.moveTo(hitX, interfaceY);
      ctx.lineTo(refEndX, refEndY);
      ctx.stroke();

      const refDir = Math.atan2(refEndY - interfaceY, refEndX - hitX);
      drawArrow(refEndX - 25 * Math.cos(refDir), refEndY - 25 * Math.sin(refDir), refDir, "#10b981");
    }

    // Angle arcs
    if (showAngles >= 0.5) {
      const arcR = 50;

      // Incident angle arc
      ctx.beginPath();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      const normalUp = -Math.PI / 2;
      ctx.arc(hitX, interfaceY, arcR, normalUp, normalUp - incRad, true);
      ctx.stroke();

      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "right";
      ctx.fillText(`θ₁ = ${incidentAngle.toFixed(1)}°`, hitX - arcR - 8, interfaceY - arcR / 2);

      // Refracted angle arc (if exists)
      if (!isTIR && refractedAngle !== null) {
        ctx.beginPath();
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        const normalDown = Math.PI / 2;
        const refRad2 = refractedAngle * Math.PI / 180;
        ctx.arc(hitX, interfaceY, arcR, normalDown, normalDown + refRad2);
        ctx.stroke();

        ctx.fillStyle = "#10b981";
        ctx.textAlign = "left";
        ctx.fillText(`θ₂ = ${refractedAngle.toFixed(1)}°`, hitX + arcR + 8, interfaceY + arcR / 2 + 5);
      }

      // Reflected angle
      ctx.beginPath();
      ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.arc(hitX, interfaceY, arcR * 0.7, normalUp, normalUp + incRad);
      ctx.stroke();
    }

    // TIR indicator
    if (isTIR) {
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("TOTAL INTERNAL REFLECTION", W / 2, interfaceY + 40);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("No refracted ray — all light is reflected", W / 2, interfaceY + 58);
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(W - 230, 60, 215, 130, 8);
    ctx.fill();

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Snell's Law", W - 220, 80);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`n₁ = ${n1.toFixed(3)}`, W - 220, 98);
    ctx.fillText(`n₂ = ${n2.toFixed(3)}`, W - 220, 114);
    ctx.fillText(`θ₁ = ${incidentAngle.toFixed(1)}°`, W - 220, 130);
    ctx.fillText(
      `θ₂ = ${isTIR ? "TIR" : refractedAngle!.toFixed(1) + "°"}`,
      W - 220, 146
    );
    if (critical !== null) {
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Critical angle: ${critical.toFixed(1)}°`, W - 220, 162);
    }
    ctx.fillText(
      `Reflectance: ${(reflectIntensity * 100).toFixed(0)}%`,
      W - 220, 178
    );

    // Legend
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    let ly = H - 50;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("— Incident ray", 15, ly);
    ctx.fillStyle = "#22d3ee";
    ctx.fillText("— Reflected ray", 130, ly);
    ctx.fillStyle = "#10b981";
    ctx.fillText("— Refracted ray", 250, ly);

    // Speed comparison
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    const v1 = (3e8 / n1 / 1e8).toFixed(2);
    const v2 = (3e8 / n2 / 1e8).toFixed(2);
    ctx.fillText(`Light speed: v₁ = ${v1}×10⁸ m/s  |  v₂ = ${v2}×10⁸ m/s`, W / 2, H - 15);
  }

  function calculateReflectance(theta: number, n1Val: number, n2Val: number): number {
    const thetaRad = theta * Math.PI / 180;
    const sinT2 = (n1Val / n2Val) * Math.sin(thetaRad);
    if (Math.abs(sinT2) >= 1) return 1;
    const cosT2 = Math.sqrt(1 - sinT2 * sinT2);
    const cosT1 = Math.cos(thetaRad);
    const rs = ((n1Val * cosT1 - n2Val * cosT2) / (n1Val * cosT1 + n2Val * cosT2)) ** 2;
    const rp = ((n2Val * cosT1 - n1Val * cosT2) / (n2Val * cosT1 + n1Val * cosT2)) ** 2;
    return (rs + rp) / 2;
  }

  function drawArrow(x: number, y: number, angle: number, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    const refracted = snellsLaw(incidentAngle, n1, n2);
    const critical2 = criticalAngle(n1, n2);
    const isTIR = refracted === null;
    return (
      `Light Refraction: n₁=${n1.toFixed(3)}, n₂=${n2.toFixed(3)}. ` +
      `Incident angle: ${incidentAngle.toFixed(1)}°. ` +
      `${isTIR ? "Total internal reflection! " : `Refracted angle: ${refracted!.toFixed(1)}°. `}` +
      `${critical2 !== null ? `Critical angle: ${critical2.toFixed(1)}°. ` : ""}` +
      `Snell's Law: n₁sin(θ₁) = n₂sin(θ₂). ` +
      `Light bends ${n2 > n1 ? "toward" : "away from"} the normal when entering a ${n2 > n1 ? "denser" : "less dense"} medium.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LightRefractionFactory;
