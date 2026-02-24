import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Carrier {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "electron" | "hole";
}

const DiodeFactory = (): SimulationEngine => {
  const config = getSimConfig("diode") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};
  let carriers: Carrier[] = [];

  function createCarriers(): void {
    carriers = [];
    const numCarriers = 30;
    const junctionX = width / 2;
    const regionH = height * 0.45;
    const regionTop = height * 0.25;

    // P-type holes (left side)
    for (let i = 0; i < numCarriers; i++) {
      carriers.push({
        x: Math.random() * (junctionX - 40) + 20,
        y: regionTop + Math.random() * regionH,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        type: "hole",
      });
    }

    // N-type electrons (right side)
    for (let i = 0; i < numCarriers; i++) {
      carriers.push({
        x: junctionX + 40 + Math.random() * (junctionX - 60),
        y: regionTop + Math.random() * regionH,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        type: "electron",
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    createCarriers();
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    const biasMode = Math.round(params.biasMode ?? 0); // 0=forward, 1=unbiased, 2=reverse
    const junctionX = width / 2;
    const regionH = height * 0.45;
    const regionTop = height * 0.25;

    // Electric field effect based on bias
    let eField = 0;
    if (biasMode === 0) eField = 30; // Forward: push carriers toward junction
    else if (biasMode === 2) eField = -40; // Reverse: push carriers away from junction

    for (const c of carriers) {
      // Random thermal motion
      c.vx += (Math.random() - 0.5) * 80 * dt;
      c.vy += (Math.random() - 0.5) * 80 * dt;

      // Electric field effect
      if (c.type === "hole") {
        c.vx += eField * dt; // holes move in field direction
      } else {
        c.vx -= eField * dt; // electrons move against field direction
      }

      // Depletion zone barrier (when unbiased or reverse biased)
      const depletionW = biasMode === 0 ? 10 : biasMode === 1 ? 30 : 50;
      const depLeft = junctionX - depletionW;
      const depRight = junctionX + depletionW;

      if (biasMode !== 0) {
        // Barrier pushes carriers back
        if (c.type === "hole" && c.x > depLeft - 5 && c.x < junctionX) {
          c.vx -= 60 * dt;
        }
        if (c.type === "electron" && c.x < depRight + 5 && c.x > junctionX) {
          c.vx += 60 * dt;
        }
      }

      // Update position
      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Boundary constraints
      if (c.type === "hole") {
        if (c.x < 20) { c.x = 20; c.vx = Math.abs(c.vx); }
        if (biasMode !== 0 && c.x > junctionX) {
          c.x = junctionX - 5;
          c.vx = -Math.abs(c.vx) * 0.5;
        }
        if (biasMode === 0 && c.x > width - 20) {
          // Wrap around in forward bias (current flowing)
          c.x = 20;
        }
      } else {
        if (c.x > width - 20) { c.x = width - 20; c.vx = -Math.abs(c.vx); }
        if (biasMode !== 0 && c.x < junctionX) {
          c.x = junctionX + 5;
          c.vx = Math.abs(c.vx) * 0.5;
        }
        if (biasMode === 0 && c.x < 20) {
          c.x = width - 20;
        }
      }

      if (c.y < regionTop) { c.y = regionTop; c.vy = Math.abs(c.vy); }
      if (c.y > regionTop + regionH) { c.y = regionTop + regionH; c.vy = -Math.abs(c.vy); }

      // Speed limit
      const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
      const maxSpeed = biasMode === 0 ? 80 : 50;
      if (speed > maxSpeed) {
        c.vx = (c.vx / speed) * maxSpeed;
        c.vy = (c.vy / speed) * maxSpeed;
      }
    }

    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const biasMode = Math.round(currentParams.biasMode ?? 0);
    const zoom = currentParams.zoom ?? 1;
    const junctionX = width / 2;
    const regionH = height * 0.45;
    const regionTop = height * 0.25;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    const biasLabels = ["Forward Bias", "Unbiased", "Reverse Bias"];
    ctx.fillText(`Semiconductor Diode — ${biasLabels[biasMode]}`, width / 2, 28);

    // P-type region
    ctx.fillStyle = "rgba(236, 72, 153, 0.15)";
    ctx.fillRect(10, regionTop - 5, junctionX - 15, regionH + 10);
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, regionTop - 5, junctionX - 15, regionH + 10);

    // N-type region
    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    ctx.fillRect(junctionX + 5, regionTop - 5, junctionX - 15, regionH + 10);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(junctionX + 5, regionTop - 5, junctionX - 15, regionH + 10);

    // Region labels
    ctx.font = `bold ${Math.max(16, width * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ec4899";
    ctx.fillText("P-type", junctionX / 2, regionTop - 15);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("N-type", junctionX + junctionX / 2, regionTop - 15);

    // Depletion zone
    const depletionW = biasMode === 0 ? 10 : biasMode === 1 ? 30 : 50;
    ctx.fillStyle = "rgba(100, 116, 139, 0.3)";
    ctx.fillRect(junctionX - depletionW, regionTop, depletionW * 2, regionH);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(junctionX - depletionW, regionTop, depletionW * 2, regionH);
    ctx.setLineDash([]);

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Depletion Zone", junctionX, regionTop + regionH + 18);

    // Draw fixed dopant atoms (lattice)
    const gridSpacing = 35 / zoom;
    // P-type: Boron atoms (acceptors)
    ctx.fillStyle = "#ec489944";
    for (let x = 30; x < junctionX - depletionW; x += gridSpacing) {
      for (let y = regionTop + 15; y < regionTop + regionH - 10; y += gridSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // N-type: Phosphorus atoms (donors)
    ctx.fillStyle = "#3b82f644";
    for (let x = junctionX + depletionW + 15; x < width - 20; x += gridSpacing) {
      for (let y = regionTop + 15; y < regionTop + regionH - 10; y += gridSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw carriers
    for (const c of carriers) {
      if (c.type === "hole") {
        // Holes: red circles with +
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${8 * zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", c.x, c.y);
      } else {
        // Electrons: blue circles with -
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${8 * zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("−", c.x, c.y);
      }
    }
    ctx.textBaseline = "alphabetic";

    // Battery and wires
    const batY = regionTop + regionH + 50;
    if (biasMode !== 1) {
      // Left wire
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width * 0.15, regionTop + regionH + 5);
      ctx.lineTo(width * 0.15, batY);
      ctx.lineTo(width * 0.4, batY);
      ctx.stroke();

      // Right wire
      ctx.beginPath();
      ctx.moveTo(width * 0.85, regionTop + regionH + 5);
      ctx.lineTo(width * 0.85, batY);
      ctx.lineTo(width * 0.6, batY);
      ctx.stroke();

      // Battery
      ctx.strokeStyle = "#e2e8f0";
      if (biasMode === 0) {
        // Forward bias: positive on P-side
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width * 0.43, batY - 10);
        ctx.lineTo(width * 0.43, batY + 10);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(width * 0.57, batY - 6);
        ctx.lineTo(width * 0.57, batY + 6);
        ctx.stroke();

        ctx.fillStyle = "#ef4444";
        ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("+", width * 0.43, batY - 15);
        ctx.fillStyle = "#3b82f6";
        ctx.fillText("−", width * 0.57, batY - 15);
      } else {
        // Reverse bias: negative on P-side
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width * 0.57, batY - 10);
        ctx.lineTo(width * 0.57, batY + 10);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(width * 0.43, batY - 6);
        ctx.lineTo(width * 0.43, batY + 6);
        ctx.stroke();

        ctx.fillStyle = "#3b82f6";
        ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("−", width * 0.43, batY - 15);
        ctx.fillStyle = "#ef4444";
        ctx.fillText("+", width * 0.57, batY - 15);
      }
    }

    // Current flow indicator
    if (biasMode === 0) {
      ctx.fillStyle = "#22c55e";
      ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("→ Current Flows →", width / 2, regionTop - 40);
    } else if (biasMode === 2) {
      ctx.fillStyle = "#ef4444";
      ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("✕ No Current (Blocked)", width / 2, regionTop - 40);
    }

    // Diode symbol
    const symX = width - 80;
    const symY = 60;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    // Triangle
    ctx.beginPath();
    ctx.moveTo(symX - 15, symY - 12);
    ctx.lineTo(symX + 15, symY);
    ctx.lineTo(symX - 15, symY + 12);
    ctx.closePath();
    ctx.stroke();
    // Bar
    ctx.beginPath();
    ctx.moveTo(symX + 15, symY - 12);
    ctx.lineTo(symX + 15, symY + 12);
    ctx.stroke();
    // Leads
    ctx.beginPath();
    ctx.moveTo(symX - 25, symY);
    ctx.lineTo(symX - 15, symY);
    ctx.moveTo(symX + 15, symY);
    ctx.lineTo(symX + 25, symY);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Diode Symbol", symX, symY + 25);

    // Legend
    const legX = 15;
    const legY = height - 65;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(legX, legY, 200, 55);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(legX, legY, 200, 55);

    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("● Holes (+ carriers, P-type)", legX + 10, legY + 18);
    ctx.fillStyle = "#60a5fa";
    ctx.fillText("● Electrons (− carriers, N-type)", legX + 10, legY + 36);
    ctx.fillStyle = "#64748b";
    ctx.fillText("▪ Depletion Zone", legX + 10, legY + 50);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
    createCarriers();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const biasMode = Math.round(currentParams.biasMode ?? 0);
    const biasLabels = ["Forward Bias", "Unbiased", "Reverse Bias"];
    const depW = biasMode === 0 ? "narrow" : biasMode === 1 ? "moderate" : "wide";

    return `Semiconductor diode in ${biasLabels[biasMode]} mode. The P-N junction has a ${depW} depletion zone. ${biasMode === 0 ? "Current flows: the external voltage pushes holes toward the junction from the P-side and electrons from the N-side, narrowing the depletion zone and allowing charge carriers to cross." : biasMode === 1 ? "No external voltage: the built-in potential creates a depletion zone where mobile carriers have been swept away, preventing current flow." : "Current blocked: the external voltage widens the depletion zone by pulling carriers away from the junction, increasing the barrier and preventing current."} A diode is formed by joining P-type (boron-doped, holes as majority carriers) and N-type (phosphorus-doped, electrons as majority carriers) semiconductors.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createCarriers();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DiodeFactory;
