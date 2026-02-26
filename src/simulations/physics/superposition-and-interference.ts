import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SuperpositionAndInterferenceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("superposition-and-interference") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let wavelength = 40;
  let separation = 150;
  let frequency = 1;
  let showNodeLines = 1;

  // Image data for interference pattern
  let imageData: ImageData | null = null;

  // Mouse position for path difference display
  let mouseX = -1;
  let mouseY = -1;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    imageData = null;

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
  }

  function onMouseMove(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  }

  function onMouseLeave(): void {
    mouseX = -1;
    mouseY = -1;
  }

  function update(dt: number, params: Record<string, number>): void {
    wavelength = params.wavelength ?? 40;
    separation = params.separation ?? 150;
    frequency = params.frequency ?? 1;
    showNodeLines = params.showNodeLines ?? 1;
    time += dt;
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#060a14");
    bgGrad.addColorStop(1, "#0c1220");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.4;
    const cy = height * 0.5;
    const s1x = cx - separation / 2;
    const s1y = cy;
    const s2x = cx + separation / 2;
    const s2y = cy;

    const omega = 2 * Math.PI * frequency;
    const k = (2 * Math.PI) / wavelength;

    // Render interference pattern using pixel manipulation
    const patternW = Math.floor(width * 0.72);
    const patternH = Math.floor(height * 0.85);
    const patternX = Math.floor(width * 0.03);
    const patternY = Math.floor(height * 0.075);

    if (!imageData || imageData.width !== patternW || imageData.height !== patternH) {
      imageData = ctx.createImageData(patternW, patternH);
    }

    const data = imageData.data;
    const step = 2; // render every 2nd pixel for performance

    for (let py = 0; py < patternH; py += step) {
      for (let px = 0; px < patternW; px += step) {
        const worldX = patternX + px;
        const worldY = patternY + py;

        const d1 = Math.sqrt((worldX - s1x) ** 2 + (worldY - s1y) ** 2);
        const d2 = Math.sqrt((worldX - s2x) ** 2 + (worldY - s2y) ** 2);

        const wave1 = Math.sin(k * d1 - omega * time) / (1 + d1 * 0.003);
        const wave2 = Math.sin(k * d2 - omega * time) / (1 + d2 * 0.003);
        const combined = wave1 + wave2;

        // Map to color: blue for negative, cyan/white for positive
        const intensity = combined / 2;
        const absI = Math.abs(intensity);

        let r: number, g: number, b: number;
        if (intensity > 0) {
          r = Math.floor(20 + absI * 180);
          g = Math.floor(60 + absI * 195);
          b = Math.floor(120 + absI * 135);
        } else {
          r = Math.floor(10 + absI * 40);
          g = Math.floor(15 + absI * 30);
          b = Math.floor(60 + absI * 80);
        }

        // Fill step x step block
        for (let dy = 0; dy < step && py + dy < patternH; dy++) {
          for (let dx = 0; dx < step && px + dx < patternW; dx++) {
            const idx = ((py + dy) * patternW + (px + dx)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, patternX, patternY);

    // Draw source points
    for (const [sx, sy, label] of [[s1x, s1y, "S₁"], [s2x, s2y, "S₂"]] as [number, number, string][]) {
      // Pulsing glow
      const pulseR = 8 + 4 * Math.sin(omega * time);
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, pulseR * 3);
      glow.addColorStop(0, "rgba(255, 255, 100, 0.8)");
      glow.addColorStop(0.5, "rgba(255, 255, 100, 0.2)");
      glow.addColorStop(1, "rgba(255, 255, 100, 0)");
      ctx.beginPath();
      ctx.arc(sx, sy, pulseR * 3, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffaa";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, sx, sy - 14);
    }

    // Draw nodal lines (approximate) if enabled
    if (showNodeLines) {
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;

      // Draw nodal lines for path difference = (n+0.5)*lambda
      for (let n = -6; n <= 6; n++) {
        const pathDiff = (n + 0.5) * wavelength;
        // Hyperbola: |d1 - d2| = pathDiff
        // Points where d1 - d2 = pathDiff
        if (Math.abs(pathDiff) >= separation) continue;

        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 100, 100, 0.3)";
        let started = false;

        for (let t = -Math.PI / 2; t <= Math.PI / 2; t += 0.02) {
          // Parametric hyperbola in rotated coordinates
          const a = Math.abs(pathDiff) / 2;
          const c = separation / 2;
          if (a >= c) continue;
          const bVal = Math.sqrt(c * c - a * a);
          const hx = cx + a / Math.cos(t) * (pathDiff < 0 ? -1 : 1);
          const hy = cy + bVal * Math.tan(t);

          if (Math.abs(Math.cos(t)) < 0.01) continue;
          if (hx < patternX || hx > patternX + patternW) continue;
          if (hy < patternY || hy > patternY + patternH) continue;

          if (!started) { ctx.moveTo(hx, hy); started = true; }
          else ctx.lineTo(hx, hy);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Mouse hover: show path difference
    if (mouseX > 0 && mouseY > 0) {
      const d1 = Math.sqrt((mouseX - s1x) ** 2 + (mouseY - s1y) ** 2);
      const d2 = Math.sqrt((mouseX - s2x) ** 2 + (mouseY - s2y) ** 2);
      const pathDiff = Math.abs(d1 - d2);
      const nLambda = pathDiff / wavelength;

      // Lines from sources to mouse
      ctx.beginPath();
      ctx.moveTo(s1x, s1y);
      ctx.lineTo(mouseX, mouseY);
      ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(s2x, s2y);
      ctx.lineTo(mouseX, mouseY);
      ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Info box near mouse
      const bx = mouseX + 15;
      const by = mouseY - 60;
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.beginPath();
      ctx.roundRect(bx, by, 160, 55, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#ffd966";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`d₁ = ${d1.toFixed(1)}px, d₂ = ${d2.toFixed(1)}px`, bx + 8, by + 16);
      ctx.fillText(`|d₁−d₂| = ${pathDiff.toFixed(1)}px = ${nLambda.toFixed(2)}λ`, bx + 8, by + 32);

      const isConstructive = Math.abs(nLambda - Math.round(nLambda)) < 0.15;
      const isDestructive = Math.abs(nLambda - Math.round(nLambda) - 0.5) < 0.15 ||
        Math.abs(nLambda - Math.round(nLambda) + 0.5) < 0.15;
      ctx.fillStyle = isConstructive ? "#66ffaa" : isDestructive ? "#ff6666" : "#aaa";
      ctx.fillText(
        isConstructive ? "≈ Constructive" : isDestructive ? "≈ Destructive" : "Intermediate",
        bx + 8,
        by + 48
      );

      // Crosshair
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 4, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffd966";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Info panel on right
    const panelX = width * 0.76;
    const panelY2 = height * 0.08;
    const panelW = width * 0.22;
    const panelH = height * 0.84;

    ctx.fillStyle = "rgba(8, 12, 24, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY2, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 160, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let ty = panelY2 + 14;
    const lx = panelX + 12;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#8cb4ff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("2-Source Interference", lx, ty);
    ty += 24;

    ctx.fillStyle = "#ffd966";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Conditions:", lx, ty);
    ty += 20;

    ctx.fillStyle = "rgba(200, 220, 255, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Constructive:", lx, ty);
    ty += 16;
    ctx.fillStyle = "#66ffaa";
    ctx.fillText("Δd = nλ (n = 0,1,2...)", lx, ty);
    ty += 20;

    ctx.fillStyle = "rgba(200, 220, 255, 0.8)";
    ctx.fillText("Destructive:", lx, ty);
    ty += 16;
    ctx.fillStyle = "#ff6666";
    ctx.fillText("Δd = (n+½)λ", lx, ty);
    ty += 24;

    ctx.fillStyle = "rgba(200, 220, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`λ = ${wavelength} px`, lx, ty);
    ty += 16;
    ctx.fillText(`d = ${separation} px`, lx, ty);
    ty += 16;
    ctx.fillText(`f = ${frequency.toFixed(1)} Hz`, lx, ty);
    ty += 24;

    ctx.fillStyle = "#ff9966";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Key Concepts:", lx, ty);
    ty += 18;

    ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    const notes = [
      "Bright bands: waves",
      "arrive in phase.",
      "",
      "Dark bands: waves",
      "arrive out of phase.",
      "",
      "Hover to see path",
      "difference at any point.",
    ];
    for (const line of notes) {
      ctx.fillText(line, lx, ty);
      ty += 15;
    }

    // Legend
    ty += 8;
    ctx.fillStyle = "rgba(255, 100, 100, 0.5)";
    ctx.fillText("--- Nodal lines", lx, ty);

    // Time
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 14);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    if (canvas) {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    }
  }

  function getStateDescription(): string {
    return (
      `Two-Source Interference: λ=${wavelength}px, separation=${separation}px, ` +
      `f=${frequency.toFixed(1)}Hz. Constructive when path diff = nλ, ` +
      `destructive when path diff = (n+0.5)λ. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    imageData = null;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SuperpositionAndInterferenceFactory;
