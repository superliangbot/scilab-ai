import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TWO_PI = Math.PI * 2;

const StroboscopeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stroboscope") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let objectFrequency = 5;   // Hz
  let strobeFrequency = 5;   // Hz
  let showContinuous = 0;
  let brightness = 0.8;

  // State
  let discAngle = 0;          // radians (real continuous angle)
  let strobePhase = 0;        // 0-1 within strobe cycle
  let strobeOn = false;
  let lastStrobeAngle = 0;    // disc angle at last strobe flash
  let flashHistory: number[] = []; // recent strobe-captured angles
  const FLASH_DURATION = 0.02; // seconds the "flash" stays visible
  let flashTimer = 0;

  // Spoke configuration
  const NUM_SPOKES = 8;
  const NUM_DOTS = 12;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    discAngle = 0;
    strobePhase = 0;
    flashHistory = [];
    flashTimer = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    objectFrequency = params.objectFrequency ?? objectFrequency;
    strobeFrequency = params.strobeFrequency ?? strobeFrequency;
    showContinuous = params.showContinuous ?? showContinuous;
    brightness = params.brightness ?? brightness;

    time += step;

    // Update disc rotation (continuous)
    discAngle += objectFrequency * TWO_PI * step;
    discAngle = discAngle % TWO_PI;

    // Update strobe phase
    const prevPhase = strobePhase;
    strobePhase += strobeFrequency * step;

    // Check if strobe just fired (phase crossed integer boundary)
    if (Math.floor(strobePhase) > Math.floor(prevPhase)) {
      strobeOn = true;
      flashTimer = FLASH_DURATION;
      lastStrobeAngle = discAngle;
      flashHistory.push(discAngle);
      if (flashHistory.length > 60) flashHistory.shift();
    }

    // Flash timer countdown
    if (flashTimer > 0) {
      flashTimer -= step;
      if (flashTimer <= 0) {
        strobeOn = false;
        flashTimer = 0;
      }
    }
  }

  function drawDisc(cx: number, cy: number, radius: number, angle: number, alpha: number): void {
    // Disc body
    const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    discGrad.addColorStop(0, `rgba(60, 60, 70, ${alpha})`);
    discGrad.addColorStop(0.85, `rgba(45, 45, 55, ${alpha})`);
    discGrad.addColorStop(1, `rgba(30, 30, 40, ${alpha})`);
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.fill();

    // Rim
    ctx.strokeStyle = `rgba(120, 130, 150, ${alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = `rgba(200, 210, 230, ${alpha * 0.9})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < NUM_SPOKES; i++) {
      const a = angle + (i / NUM_SPOKES) * TWO_PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * radius * 0.15, cy + Math.sin(a) * radius * 0.15);
      ctx.lineTo(cx + Math.cos(a) * radius * 0.85, cy + Math.sin(a) * radius * 0.85);
      ctx.stroke();
    }

    // Dots around the edge
    for (let i = 0; i < NUM_DOTS; i++) {
      const a = angle + (i / NUM_DOTS) * TWO_PI;
      const dotR = radius * 0.9;
      const dx = cx + Math.cos(a) * dotR;
      const dy = cy + Math.sin(a) * dotR;
      ctx.fillStyle = i === 0
        ? `rgba(255, 80, 80, ${alpha})`
        : `rgba(230, 230, 255, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(dx, dy, 4, 0, TWO_PI);
      ctx.fill();
    }

    // Center hub
    ctx.fillStyle = `rgba(100, 110, 130, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.1, 0, TWO_PI);
    ctx.fill();

    // Reference mark (red arrow)
    const refAngle = angle;
    ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
    ctx.beginPath();
    const tipX = cx + Math.cos(refAngle) * radius * 0.7;
    const tipY = cy + Math.sin(refAngle) * radius * 0.7;
    const baseL = refAngle + 0.15;
    const baseR = refAngle - 0.15;
    const baseD = radius * 0.45;
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx + Math.cos(baseL) * baseD, cy + Math.sin(baseL) * baseD);
    ctx.lineTo(cx + Math.cos(baseR) * baseD, cy + Math.sin(baseR) * baseD);
    ctx.closePath();
    ctx.fill();
  }

  function render(): void {
    if (!ctx) return;

    // Dark background
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Stroboscope Effect", width / 2, 28);

    const discCx = width * 0.45;
    const discCy = height * 0.48;
    const discRadius = Math.min(width, height) * 0.28;

    // Continuous view (dim or bright based on showContinuous)
    if (showContinuous >= 0.5) {
      // Show continuously lit disc
      drawDisc(discCx, discCy, discRadius, discAngle, brightness);
    } else {
      // Strobe mode: dark room effect
      // Show ambient very dim disc
      drawDisc(discCx, discCy, discRadius, discAngle, 0.05);

      // Flash effect
      if (strobeOn) {
        // Bright flash on screen
        const flashAlpha = (flashTimer / FLASH_DURATION) * brightness;

        // Flash glow
        const glowGrad = ctx.createRadialGradient(discCx, discCy, 0, discCx, discCy, discRadius * 1.5);
        glowGrad.addColorStop(0, `rgba(255, 255, 200, ${flashAlpha * 0.15})`);
        glowGrad.addColorStop(1, "rgba(255, 255, 200, 0)");
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, width, height);

        drawDisc(discCx, discCy, discRadius, lastStrobeAngle, flashAlpha);
      }

      // Afterimage trail (persistence of vision)
      const trailCount = Math.min(flashHistory.length, 8);
      for (let i = flashHistory.length - trailCount; i < flashHistory.length - 1; i++) {
        const age = flashHistory.length - 1 - i;
        const alpha = Math.max(0.02, 0.12 - age * 0.015);
        drawDisc(discCx, discCy, discRadius, flashHistory[i], alpha);
      }
    }

    // Strobe light indicator (top right)
    const lightX = width * 0.82;
    const lightY = height * 0.15;
    const lightOn = strobeOn || showContinuous >= 0.5;
    ctx.fillStyle = lightOn
      ? `rgba(255, 255, 100, ${brightness})`
      : "rgba(80, 80, 60, 0.3)";
    ctx.beginPath();
    ctx.arc(lightX, lightY, 15, 0, TWO_PI);
    ctx.fill();
    if (lightOn) {
      const lglow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 40);
      lglow.addColorStop(0, `rgba(255, 255, 150, ${brightness * 0.3})`);
      lglow.addColorStop(1, "rgba(255, 255, 150, 0)");
      ctx.fillStyle = lglow;
      ctx.beginPath();
      ctx.arc(lightX, lightY, 40, 0, TWO_PI);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STROBE", lightX, lightY + 28);

    // Info panel
    const panelX = 14;
    let panelY = height * 0.72;

    ctx.textAlign = "left";
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("Frequencies", panelX, panelY);

    panelY += 20;
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`Object: ${objectFrequency.toFixed(1)} Hz`, panelX, panelY);

    panelY += 18;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Strobe: ${strobeFrequency.toFixed(1)} Hz`, panelX, panelY);

    panelY += 18;
    const ratio = strobeFrequency > 0 ? objectFrequency / strobeFrequency : 0;
    ctx.fillStyle = "#34d399";
    ctx.fillText(`f_obj / f_strobe = ${ratio.toFixed(3)}`, panelX, panelY);

    panelY += 22;
    // Apparent motion description
    const freqDiff = Math.abs(objectFrequency - strobeFrequency);
    const nearInteger = Math.abs(ratio - Math.round(ratio));
    let effectDesc = "";
    if (nearInteger < 0.02) {
      effectDesc = "FROZEN (frequencies matched)";
      ctx.fillStyle = "#4ade80";
    } else if (nearInteger < 0.1) {
      effectDesc = `Slow apparent motion (${freqDiff.toFixed(2)} Hz)`;
      ctx.fillStyle = "#fbbf24";
    } else {
      effectDesc = "Aliasing / complex pattern";
      ctx.fillStyle = "#f87171";
    }
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillText(effectDesc, panelX, panelY);

    panelY += 24;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillText("When f_strobe = f_object, the disc appears", panelX, panelY);
    ctx.fillText("frozen due to stroboscopic effect.", panelX, panelY + 14);
    ctx.fillText("Aliasing occurs when frequencies differ slightly.", panelX, panelY + 28);

    // Time
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    discAngle = 0;
    strobePhase = 0;
    flashHistory = [];
    flashTimer = 0;
    strobeOn = false;
  }

  function destroy(): void {
    flashHistory = [];
  }

  function getStateDescription(): string {
    const ratio = strobeFrequency > 0 ? objectFrequency / strobeFrequency : 0;
    const nearInt = Math.abs(ratio - Math.round(ratio));
    const effect = nearInt < 0.02 ? "frozen (matched)" :
                   nearInt < 0.1 ? "slow apparent motion" : "aliasing/complex pattern";
    return (
      `Stroboscope: object freq=${objectFrequency.toFixed(1)} Hz, strobe freq=${strobeFrequency.toFixed(1)} Hz. ` +
      `Ratio = ${ratio.toFixed(3)}. Effect: ${effect}. ` +
      `The stroboscopic effect makes a rotating object appear stationary when the strobe ` +
      `frequency matches the rotation frequency. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StroboscopeFactory;
