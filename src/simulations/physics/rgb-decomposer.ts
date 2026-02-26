import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * RGB Decomposer
 * Decomposes a colour into its R, G, B components via a prism-like element.
 * Shows an input colour swatch on the left, an animated prism splitting the
 * light, and three separated channel bars on the right.
 */

const RGBDecomposerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rgb-decomposer") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let inputRed = 255;
  let inputGreen = 255;
  let inputBlue = 255;
  let separation = 80;

  // Animation state for light particles
  let particles: { x: number; y: number; vx: number; channel: number; alpha: number }[] = [];
  let lastSpawn = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    particles = [];
    lastSpawn = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    inputRed = Math.round(Math.min(255, Math.max(0, params.inputRed ?? 255)));
    inputGreen = Math.round(Math.min(255, Math.max(0, params.inputGreen ?? 255)));
    inputBlue = Math.round(Math.min(255, Math.max(0, params.inputBlue ?? 255)));
    separation = Math.min(200, Math.max(10, params.separation ?? 80));
    time += dt;

    // Spawn particles periodically
    const spawnInterval = 0.06;
    if (time - lastSpawn > spawnInterval) {
      lastSpawn = time;
      const prismX = width * 0.4;
      // Spawn one particle per channel (if channel intensity > 0)
      const channels = [
        { value: inputRed, idx: 0 },
        { value: inputGreen, idx: 1 },
        { value: inputBlue, idx: 2 },
      ];
      for (const ch of channels) {
        if (ch.value > 10) {
          particles.push({
            x: prismX + 10,
            y: height / 2,
            vx: 120 + Math.random() * 40,
            channel: ch.idx,
            alpha: 1,
          });
        }
      }
    }

    // Update particles
    const sepPx = separation;
    const targetYs = [
      height / 2 - sepPx,
      height / 2,
      height / 2 + sepPx,
    ];

    for (const p of particles) {
      p.x += p.vx * dt;
      // Lerp y towards target after passing prism
      const prismEnd = width * 0.45;
      if (p.x > prismEnd) {
        const targetY = targetYs[p.channel];
        p.y += (targetY - p.y) * 4 * dt;
      }
      // Fade out near right edge
      if (p.x > width * 0.85) {
        p.alpha -= 2 * dt;
      }
    }

    // Remove dead particles
    particles = particles.filter((p) => p.alpha > 0 && p.x < width);
    // Cap particle count
    if (particles.length > 300) {
      particles = particles.slice(particles.length - 300);
    }
  }

  function drawPrism(px: number, py: number, size: number): void {
    ctx.save();
    // Draw a triangular prism shape
    ctx.beginPath();
    ctx.moveTo(px, py - size);
    ctx.lineTo(px + size * 0.8, py + size * 0.6);
    ctx.lineTo(px - size * 0.8, py + size * 0.6);
    ctx.closePath();

    const grad = ctx.createLinearGradient(px - size, py, px + size, py);
    grad.addColorStop(0, "rgba(180,200,255,0.25)");
    grad.addColorStop(0.5, "rgba(220,230,255,0.35)");
    grad.addColorStop(1, "rgba(180,200,255,0.2)");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(200,220,255,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.font = `${Math.max(10, size * 0.22)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(200,220,255,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("PRISM", px, py + size * 0.35);
    ctx.restore();
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(14, width * 0.026)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.75)";
    ctx.textAlign = "center";
    ctx.fillText("RGB Decomposer", width / 2, 22);
    ctx.restore();

    const midY = height / 2;
    const prismX = width * 0.4;
    const prismSize = Math.min(width, height) * 0.15;
    const sepPx = separation;

    // -- Input colour swatch (left side) --
    const swatchW = width * 0.15;
    const swatchH = height * 0.35;
    const swatchX = width * 0.05;
    const swatchY = midY - swatchH / 2;

    ctx.fillStyle = `rgb(${inputRed},${inputGreen},${inputBlue})`;
    ctx.beginPath();
    ctx.roundRect(swatchX, swatchY, swatchW, swatchH, 8);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(swatchX, swatchY, swatchW, swatchH, 8);
    ctx.stroke();

    // Swatch label
    ctx.save();
    const lum = 0.299 * inputRed + 0.587 * inputGreen + 0.114 * inputBlue;
    ctx.fillStyle = lum > 128 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
    ctx.font = `bold ${Math.max(11, swatchW * 0.14)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Input", swatchX + swatchW / 2, swatchY + swatchH / 2 - 10);
    ctx.font = `${Math.max(9, swatchW * 0.11)}px monospace`;
    ctx.fillText(
      `(${inputRed},${inputGreen},${inputBlue})`,
      swatchX + swatchW / 2,
      swatchY + swatchH / 2 + 10
    );
    ctx.restore();

    // -- Light beam from swatch to prism --
    ctx.save();
    ctx.strokeStyle = `rgba(${inputRed},${inputGreen},${inputBlue},0.5)`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(swatchX + swatchW, midY);
    ctx.lineTo(prismX - prismSize * 0.6, midY);
    ctx.stroke();
    // Glow
    ctx.strokeStyle = `rgba(${inputRed},${inputGreen},${inputBlue},0.15)`;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(swatchX + swatchW, midY);
    ctx.lineTo(prismX - prismSize * 0.6, midY);
    ctx.stroke();
    ctx.restore();

    // -- Prism --
    drawPrism(prismX, midY, prismSize);

    // -- Animated particles --
    const channelColors = [
      `rgba(${inputRed},0,0,`,
      `rgba(0,${inputGreen},0,`,
      `rgba(0,0,${inputBlue},`,
    ];

    ctx.save();
    for (const p of particles) {
      const a = Math.max(0, p.alpha);
      ctx.fillStyle = channelColors[p.channel] + a.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // -- Three diverging beam lines from prism --
    const beamStartX = prismX + prismSize * 0.6;
    const targetYs = [midY - sepPx, midY, midY + sepPx];
    const beamColors = [
      `rgba(${inputRed},0,0,0.4)`,
      `rgba(0,${inputGreen},0,0.4)`,
      `rgba(0,0,${inputBlue},0.4)`,
    ];

    ctx.save();
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = beamColors[i];
      ctx.beginPath();
      ctx.moveTo(beamStartX, midY);
      ctx.lineTo(width * 0.75, targetYs[i]);
      ctx.stroke();
    }
    ctx.restore();

    // -- Channel bars on the right side --
    const barX = width * 0.72;
    const barW = width * 0.23;
    const barH = Math.max(24, height * 0.055);
    const channels = [
      { label: "Red", value: inputRed, color: "rgba(220,50,50,0.85)", textColor: "#ff6666", y: targetYs[0] },
      { label: "Green", value: inputGreen, color: "rgba(50,180,50,0.85)", textColor: "#66ff66", y: targetYs[1] },
      { label: "Blue", value: inputBlue, color: "rgba(60,60,220,0.85)", textColor: "#6688ff", y: targetYs[2] },
    ];

    for (const ch of channels) {
      const by = ch.y - barH / 2;

      // Track
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.roundRect(barX, by, barW, barH, 5);
      ctx.fill();

      // Filled bar
      const fillW = (ch.value / 255) * barW;
      ctx.fillStyle = ch.color;
      ctx.beginPath();
      ctx.roundRect(barX, by, fillW, barH, 5);
      ctx.fill();

      // Value text
      ctx.save();
      ctx.font = `bold ${Math.max(11, barH * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(`${ch.label}: ${ch.value}`, barX + 6, ch.y);

      // Percentage on right
      ctx.textAlign = "right";
      ctx.font = `${Math.max(10, barH * 0.45)}px monospace`;
      ctx.fillStyle = ch.textColor;
      ctx.fillText(`${((ch.value / 255) * 100).toFixed(0)}%`, barX + barW - 6, ch.y);
      ctx.restore();
    }

    // -- Combined vs decomposed info panel --
    ctx.save();
    const panelW = width * 0.4;
    const panelH = 42;
    const panelX = (width - panelW) / 2;
    const panelY = height - panelH - 12;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();

    ctx.font = `${Math.max(10, width * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(200,210,230,0.8)";
    ctx.fillText(
      `Combined: RGB(${inputRed}, ${inputGreen}, ${inputBlue})`,
      panelX + panelW / 2,
      panelY + 13
    );
    ctx.fillStyle = "rgba(170,180,210,0.6)";
    ctx.fillText(
      `R=${((inputRed / 255) * 100).toFixed(0)}%  G=${((inputGreen / 255) * 100).toFixed(0)}%  B=${((inputBlue / 255) * 100).toFixed(0)}%`,
      panelX + panelW / 2,
      panelY + 29
    );
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    particles = [];
    lastSpawn = 0;
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    return (
      `RGB Decomposer: input RGB(${inputRed},${inputGreen},${inputBlue}). ` +
      `Separation: ${separation}px. ` +
      `Red channel: ${inputRed}/255 (${((inputRed / 255) * 100).toFixed(0)}%), ` +
      `Green channel: ${inputGreen}/255 (${((inputGreen / 255) * 100).toFixed(0)}%), ` +
      `Blue channel: ${inputBlue}/255 (${((inputBlue / 255) * 100).toFixed(0)}%). ` +
      `White light contains all three channels at full intensity. ` +
      `A prism-like element decomposes light into its spectral components.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RGBDecomposerFactory;
