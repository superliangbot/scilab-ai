import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StellarParallax3dFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stellar-parallax-3d") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let starDistance = 8;
  let fov = 60;
  let showBaseline = 1;
  let animSpeed = 1;

  interface BgStar {
    ra: number;
    dec: number;
    brightness: number;
    size: number;
    color: string;
  }

  let bgStars: BgStar[] = [];
  const trailPoints: { x: number; y: number }[] = [];
  const maxTrail = 200;

  const starColors = ["#ffffff", "#ffeedd", "#ddeeff", "#ffddbb", "#bbddff", "#ffffcc"];

  function generateBgStars(): void {
    bgStars = [];
    for (let i = 0; i < 80; i++) {
      bgStars.push({
        ra: (Math.random() - 0.5) * 120,
        dec: (Math.random() - 0.5) * 90,
        brightness: 0.3 + Math.random() * 0.7,
        size: 0.8 + Math.random() * 2,
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    trailPoints.length = 0;
    generateBgStars();
  }

  function project(ra: number, dec: number): { x: number; y: number } | null {
    const fovRad = (fov * Math.PI) / 180;
    const scale = (height * 0.8) / fovRad;
    const raRad = (ra * Math.PI) / 180;
    const decRad = (dec * Math.PI) / 180;
    if (Math.abs(raRad) > fovRad / 2 || Math.abs(decRad) > fovRad / 2) return null;
    const skyW = width * 0.65;
    const skyH = height - 40;
    const px = skyW / 2 + raRad * scale;
    const py = skyH / 2 - decRad * scale;
    if (px < 0 || px > skyW || py < 0 || py > skyH) return null;
    return { x: px, y: py + 20 };
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    starDistance = params.starDistance ?? 8;
    fov = params.fov ?? 60;
    showBaseline = params.showBaseline ?? 1;
    animSpeed = params.animSpeed ?? 1;
    time += step * animSpeed;
  }

  function render(): void {
    // Sky background
    const skyW = width * 0.65;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#050515");
    bgGrad.addColorStop(0.5, "#080822");
    bgGrad.addColorStop(1, "#050515");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, skyW, height);

    // Side panel background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(skyW, 0, width - skyW, height);
    ctx.strokeStyle = "rgba(100,150,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(skyW, 0);
    ctx.lineTo(skyW, height);
    ctx.stroke();

    // Draw background stars on sky view
    for (const s of bgStars) {
      const p = project(s.ra, s.dec);
      if (!p) continue;
      ctx.globalAlpha = s.brightness * 0.5;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Parallax of the nearby star
    const parallaxArcsec = 1 / starDistance;
    const parallaxDeg = parallaxArcsec / 3600;
    const earthAngle = time * 0.7;
    const apparentRA = parallaxDeg * Math.cos(earthAngle) * 3600 * 2;
    const apparentDec = parallaxDeg * Math.sin(earthAngle) * 3600 * 1.2;

    // Visual amplification for display
    const ampFactor = Math.min(15 / starDistance, 8);
    const visRA = apparentRA * ampFactor;
    const visDec = apparentDec * ampFactor;

    const starPos = project(visRA, visDec);

    // Draw parallax ellipse trail
    if (starPos) {
      trailPoints.push({ x: starPos.x, y: starPos.y });
      if (trailPoints.length > maxTrail) trailPoints.shift();

      if (trailPoints.length > 2) {
        ctx.strokeStyle = "rgba(255,180,50,0.35)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
        for (let i = 1; i < trailPoints.length; i++) {
          ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
        }
        ctx.stroke();
      }

      // Draw the full theoretical ellipse
      ctx.strokeStyle = "rgba(255,200,80,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.05) {
        const eRA = parallaxDeg * Math.cos(a) * 3600 * 2 * ampFactor;
        const eDec = parallaxDeg * Math.sin(a) * 3600 * 1.2 * ampFactor;
        const ep = project(eRA, eDec);
        if (!ep) continue;
        if (a === 0) ctx.moveTo(ep.x, ep.y);
        else ctx.lineTo(ep.x, ep.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Nearby star
      const sGrad = ctx.createRadialGradient(starPos.x, starPos.y, 0, starPos.x, starPos.y, 8);
      sGrad.addColorStop(0, "#ffffff");
      sGrad.addColorStop(0.3, "#fff3cc");
      sGrad.addColorStop(1, "rgba(255,200,50,0)");
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(starPos.x, starPos.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(starPos.x, starPos.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffcc80";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Target Star", starPos.x, starPos.y + 18);
    }

    // Show baseline crosshair if enabled
    if (showBaseline > 0.5) {
      const center = project(0, 0);
      if (center) {
        ctx.strokeStyle = "rgba(100,255,100,0.2)";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(center.x - 40, center.y);
        ctx.lineTo(center.x + 40, center.y);
        ctx.moveTo(center.x, center.y - 40);
        ctx.lineTo(center.x, center.y + 40);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Sky view label
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(5, 5, 130, 22, 4);
    ctx.fill();
    ctx.fillStyle = "#88bbff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Observer's Sky View", 12, 20);

    // FOV indicator
    ctx.fillStyle = "rgba(100,150,255,0.15)";
    ctx.strokeStyle = "rgba(100,150,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 20, skyW - 10, height - 25);

    // Side panel content
    const panelX = skyW + 15;
    let panelY = 30;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Stellar Parallax 3D", panelX, panelY);
    panelY += 25;

    ctx.fillStyle = "#aaddff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Distance Calculation:", panelX, panelY);
    panelY += 22;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(`d = 1/p`, panelX, panelY);
    panelY += 22;

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#ffcc80";
    ctx.fillText(`p = ${parallaxArcsec.toFixed(4)}"`, panelX, panelY);
    panelY += 18;
    ctx.fillText(`d = ${starDistance.toFixed(1)} pc`, panelX, panelY);
    panelY += 18;
    ctx.fillStyle = "#aaddff";
    ctx.fillText(`  = ${(starDistance * 3.262).toFixed(1)} ly`, panelX, panelY);
    panelY += 18;
    ctx.fillText(`  = ${(starDistance * 3.086e13).toExponential(2)} km`, panelX, panelY);
    panelY += 30;

    // Diagram: side view of Earth-Sun-Star
    ctx.fillStyle = "#667";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Side View:", panelX, panelY);
    panelY += 15;

    const diagCx = skyW + (width - skyW) / 2;
    const diagCy = panelY + 40;
    const diagR = Math.min((width - skyW) * 0.3, 30);

    // Sun in diagram
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.arc(diagCx, diagCy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ccc";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sun", diagCx, diagCy + 16);

    // Earth orbit in diagram
    ctx.strokeStyle = "rgba(100,150,255,0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(diagCx, diagCy, diagR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth position in diagram
    const dex = diagCx + diagR * Math.cos(earthAngle);
    const dey = diagCy + diagR * Math.sin(earthAngle);
    ctx.fillStyle = "#42a5f5";
    ctx.beginPath();
    ctx.arc(dex, dey, 4, 0, Math.PI * 2);
    ctx.fill();

    // Star in diagram (far right)
    const dsx = diagCx + diagR * 3;
    ctx.fillStyle = "#ffcc80";
    ctx.beginPath();
    ctx.arc(dsx, diagCy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ccc";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("Star", dsx, diagCy + 14);

    // Lines from Earth to star
    ctx.strokeStyle = "rgba(255,200,80,0.4)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(dex, dey);
    ctx.lineTo(dsx, diagCy);
    ctx.stroke();

    panelY = diagCy + 50;

    // Earth orbit info
    ctx.fillStyle = "#667";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("How it works:", panelX, panelY);
    panelY += 16;
    ctx.fillStyle = "#aaa";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("As Earth orbits the Sun,", panelX, panelY);
    panelY += 14;
    ctx.fillText("nearby stars shift against", panelX, panelY);
    panelY += 14;
    ctx.fillText("distant background stars.", panelX, panelY);
    panelY += 14;
    ctx.fillText("The angular shift is the", panelX, panelY);
    panelY += 14;
    ctx.fillText("parallax angle p.", panelX, panelY);
    panelY += 22;

    ctx.fillStyle = "#667";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`FOV: ${fov.toFixed(0)}\u00B0`, panelX, panelY);
    panelY += 16;

    const phase = ((earthAngle % (Math.PI * 2)) / (Math.PI * 2) * 12).toFixed(1);
    ctx.fillText(`Month: ${phase}`, panelX, panelY);
  }

  function reset(): void {
    time = 0;
    trailPoints.length = 0;
  }

  function destroy(): void {
    trailPoints.length = 0;
  }

  function getStateDescription(): string {
    const parallaxArcsec = 1 / starDistance;
    return (
      `Stellar Parallax 3D view: target star at ${starDistance.toFixed(1)} parsecs ` +
      `(${(starDistance * 3.262).toFixed(1)} light-years). ` +
      `Parallax angle p = ${parallaxArcsec.toFixed(4)} arcseconds. ` +
      `FOV = ${fov}\u00B0. Observer sees the star trace an ellipse against the background ` +
      `as Earth orbits the Sun over one year. d = 1/p.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    trailPoints.length = 0;
    generateBgStars();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StellarParallax3dFactory;
