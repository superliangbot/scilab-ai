import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Seeing The Light — demonstrates how we see objects by light reflecting off them
 * and entering our eyes. Shows light source, object, and eye with ray tracing.
 */

const SeeingTheLightFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("seeing-the-light") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let lightX = 0.2;
  let lightY = 0.3;
  let objectColor = 0; // 0=red, 1=green, 2=blue, 3=white
  let lightBrightness = 8;
  let showRays = 1;

  const colors = [
    { name: "Red", rgb: [255, 60, 60], hex: "#ff3c3c" },
    { name: "Green", rgb: [60, 200, 60], hex: "#3cc83c" },
    { name: "Blue", rgb: [60, 100, 255], hex: "#3c64ff" },
    { name: "White", rgb: [255, 255, 255], hex: "#ffffff" },
  ];

  let rayPhase = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    rayPhase = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    lightX = params.lightX ?? 0.2;
    lightY = params.lightY ?? 0.3;
    objectColor = Math.round(params.objectColor ?? 0);
    lightBrightness = params.lightBrightness ?? 8;
    showRays = params.showRays ?? 1;

    const step = Math.min(dt, 0.033);
    time += step;
    rayPhase += step * 3;
  }

  function drawDashedRay(x1: number, y1: number, x2: number, y2: number, color: string, moving: boolean): void {
    ctx.save();
    if (moving) {
      const dashLen = 8;
      const gapLen = 6;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) return;
      const nx = dx / dist;
      const ny = dy / dist;

      const offset = (rayPhase * 20) % (dashLen + gapLen);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      let d = -offset;
      while (d < dist) {
        const startD = Math.max(d, 0);
        const endD = Math.min(d + dashLen, dist);
        if (endD > startD) {
          ctx.beginPath();
          ctx.moveTo(x1 + nx * startD, y1 + ny * startD);
          ctx.lineTo(x1 + nx * endD, y1 + ny * endD);
          ctx.stroke();
        }
        d += dashLen + gapLen;
      }

      // Arrowhead at end
      const aLen = 10;
      const aAngle = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - aLen * Math.cos(aAngle - 0.3), y2 - aLen * Math.sin(aAngle - 0.3));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - aLen * Math.cos(aAngle + 0.3), y2 - aLen * Math.sin(aAngle + 0.3));
      ctx.stroke();
    }
    ctx.restore();
  }

  function render(): void {
    // Dark room background
    const bgBright = lightBrightness / 10 * 0.15;
    ctx.fillStyle = `rgb(${Math.round(10 + bgBright * 30)}, ${Math.round(10 + bgBright * 25)}, ${Math.round(15 + bgBright * 20)})`;
    ctx.fillRect(0, 0, width, height);

    // Floor
    const floorY = height * 0.75;
    ctx.fillStyle = "rgba(60, 50, 40, 0.5)";
    ctx.fillRect(0, floorY, width, height - floorY);

    // Positions
    const lx = width * lightX;
    const ly = height * lightY;
    const objX = width * 0.5;
    const objY = floorY - 30;
    const eyeX = width * 0.8;
    const eyeY = height * 0.45;

    const colIdx = Math.min(Math.max(Math.round(objectColor), 0), 3);
    const col = colors[colIdx];

    // Light source glow
    const bright = lightBrightness / 10;
    const glowR = 60 + bright * 40;
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, glowR);
    glow.addColorStop(0, `rgba(255, 255, 200, ${bright * 0.8})`);
    glow.addColorStop(0.5, `rgba(255, 255, 100, ${bright * 0.3})`);
    glow.addColorStop(1, "rgba(255, 255, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, ly, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Light bulb
    ctx.fillStyle = `rgba(255, 255, ${Math.round(150 + bright * 105)}, ${0.8 + bright * 0.2})`;
    ctx.beginPath();
    ctx.arc(lx, ly, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Light Source", lx, ly - 20);

    // Rays from light to object
    if (showRays >= 0.5) {
      // Incident rays (white/yellow)
      drawDashedRay(lx, ly, objX, objY, `rgba(255, 255, 150, ${bright * 0.6})`, true);

      // Additional incident rays (spread)
      drawDashedRay(lx, ly, objX - 15, objY, `rgba(255, 255, 150, ${bright * 0.3})`, true);
      drawDashedRay(lx, ly, objX + 15, objY, `rgba(255, 255, 150, ${bright * 0.3})`, true);

      // Reflected rays from object to eye (colored by object)
      const reflColor = `rgba(${col.rgb[0]}, ${col.rgb[1]}, ${col.rgb[2]}, ${bright * 0.6})`;
      drawDashedRay(objX, objY, eyeX, eyeY, reflColor, true);
      drawDashedRay(objX - 10, objY - 5, eyeX, eyeY, `rgba(${col.rgb[0]}, ${col.rgb[1]}, ${col.rgb[2]}, ${bright * 0.3})`, true);
    }

    // Object
    const objGlow = ctx.createRadialGradient(objX, objY, 0, objX, objY, 25);
    const objBright = Math.min(bright * 1.2, 1);
    objGlow.addColorStop(0, `rgba(${col.rgb[0]}, ${col.rgb[1]}, ${col.rgb[2]}, ${objBright})`);
    objGlow.addColorStop(1, `rgba(${Math.round(col.rgb[0] * 0.3)}, ${Math.round(col.rgb[1] * 0.3)}, ${Math.round(col.rgb[2] * 0.3)}, ${objBright})`);
    ctx.fillStyle = objGlow;
    ctx.beginPath();
    ctx.arc(objX, objY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${col.rgb[0]}, ${col.rgb[1]}, ${col.rgb[2]}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${col.name} Object`, objX, objY + 35);

    // Eye
    ctx.save();
    // Eye shape
    ctx.fillStyle = "#f5f0e8";
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8B7355";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Iris
    ctx.fillStyle = "#4488aa";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(eyeX + 2, eyeY - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Eye", eyeX, eyeY + 25);

    // Brain perception indicator
    if (showRays >= 0.5) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.roundRect(eyeX - 40, eyeY - 55, 80, 25, 5);
      ctx.fill();
      ctx.fillStyle = col.hex;
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Sees: ${col.name}`, eyeX, eyeY - 38);
    }

    // Explanation labels
    if (showRays >= 0.5) {
      // Incident label
      const midIncX = (lx + objX) / 2;
      const midIncY = (ly + objY) / 2 - 15;
      ctx.fillStyle = "rgba(255, 255, 150, 0.6)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("White light", midIncX, midIncY);

      // Reflected label
      const midRefX = (objX + eyeX) / 2;
      const midRefY = (objY + eyeY) / 2 - 15;
      ctx.fillStyle = `rgba(${col.rgb[0]}, ${col.rgb[1]}, ${col.rgb[2]}, 0.7)`;
      ctx.fillText(`${col.name} reflected`, midRefX, midRefY);
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 280, 90, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Seeing The Light", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("Light hits object → object absorbs some colors", 20, 46);
    ctx.fillText("Remaining color reflects → enters our eyes", 20, 62);
    ctx.fillText("Brain interprets reflected wavelength as color", 20, 78);
    ctx.fillText(`Object appears ${col.name.toLowerCase()}`, 20, 94);
  }

  function reset(): void {
    time = 0;
    rayPhase = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const colIdx = Math.min(Math.max(Math.round(objectColor), 0), 3);
    return (
      `Seeing The Light: Light source at (${(lightX * 100).toFixed(0)}%, ${(lightY * 100).toFixed(0)}%). ` +
      `Object color: ${colors[colIdx].name}. Brightness: ${lightBrightness.toFixed(0)}/10. ` +
      `White light hits object, ${colors[colIdx].name.toLowerCase()} wavelength reflected to eye. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SeeingTheLightFactory;
