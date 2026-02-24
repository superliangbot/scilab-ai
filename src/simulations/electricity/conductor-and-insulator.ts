import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Conductor and Insulator — Electrostatic Induction
 * A charged rod is brought near a conductor (metal) and an insulator (glass).
 * In a conductor, free electrons redistribute — opposite charge on near side.
 * In an insulator, bound charges shift slightly (polarisation) but don't flow.
 */

interface Electron {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
}

const ConductorInsulatorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("conductor-and-insulator") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let chargeSign = 1; // +1 or -1
  let rodDistance = 60; // % from object (100=far, 0=touching)
  let showElectrons = 1;

  // Objects
  let conductorElectrons: Electron[] = [];
  let insulatorElectrons: Electron[] = [];

  const GRID_COLS = 5;
  const GRID_ROWS = 4;

  function objectBounds(side: "top" | "bottom") {
    const w = width * 0.3;
    const h = height * 0.18;
    const x = width * 0.55;
    const y = side === "top" ? height * 0.22 : height * 0.58;
    return { x, y, w, h };
  }

  function createElectrons(bounds: { x: number; y: number; w: number; h: number }): Electron[] {
    const electrons: Electron[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const hx = bounds.x + (c + 0.5) / GRID_COLS * bounds.w;
        const hy = bounds.y + (r + 0.5) / GRID_ROWS * bounds.h;
        electrons.push({ x: hx, y: hy, homeX: hx, homeY: hy });
      }
    }
    return electrons;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    const cb = objectBounds("top");
    const ib = objectBounds("bottom");
    conductorElectrons = createElectrons(cb);
    insulatorElectrons = createElectrons(ib);
  }

  function update(dt: number, params: Record<string, number>): void {
    chargeSign = params.chargeSign >= 0 ? 1 : -1;
    rodDistance = params.rodDistance ?? 60;
    showElectrons = params.showElectrons ?? 1;

    // Rod position
    const rodX = width * 0.55 - width * 0.3 * (1 - rodDistance / 100) - 40;

    // Update conductor electrons — free to move
    const cb = objectBounds("top");
    for (const e of conductorElectrons) {
      const dx = e.homeX - rodX;
      const dy = e.homeY - (cb.y + cb.h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      // Electrons are attracted to positive rod, repelled by negative
      const force = chargeSign * -500 / (dist * dist) * (1 - rodDistance / 100);
      const moveX = (dx / dist) * force;

      // Target position: home + displacement (clamped within object)
      const targetX = Math.max(cb.x, Math.min(cb.x + cb.w, e.homeX + moveX));
      e.x += (targetX - e.x) * Math.min(1, dt * 8);
      e.y = e.homeY; // y stays at home (1D simplification)
    }

    // Update insulator electrons — bound, slight shift only
    const ib = objectBounds("bottom");
    for (const e of insulatorElectrons) {
      const dx = e.homeX - rodX;
      const dy = e.homeY - (ib.y + ib.h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = chargeSign * -50 / (dist * dist) * (1 - rodDistance / 100);
      const maxShift = 5; // very small shift
      const moveX = Math.max(-maxShift, Math.min(maxShift, (dx / dist) * force));

      e.x += (e.homeX + moveX - e.x) * Math.min(1, dt * 8);
      e.y = e.homeY;
    }

    time += dt;
  }

  function drawObject(bounds: { x: number; y: number; w: number; h: number }, electrons: Electron[], label: string, matColor: string) {
    // Object body
    ctx.fillStyle = matColor;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(150,180,220,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Atom nuclei (positive)
    if (showElectrons >= 1) {
      for (const e of electrons) {
        // Nucleus at home position
        ctx.beginPath();
        ctx.arc(e.homeX, e.homeY, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,100,100,0.7)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", e.homeX, e.homeY);

        // Electron cloud
        ctx.beginPath();
        ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(80,150,255,0.8)";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 7px system-ui, sans-serif";
        ctx.fillText("−", e.x, e.y);
      }
    }

    // Label
    ctx.font = `bold ${Math.max(11, width * 0.018)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.8)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bounds.x + bounds.w + 10, bounds.y + bounds.h / 2);
  }

  function drawRod() {
    const rodX = width * 0.55 - width * 0.3 * (1 - rodDistance / 100) - 40;
    const rodY = height * 0.15;
    const rodH = height * 0.7;
    const rodW = 20;

    // Rod body
    const grad = ctx.createLinearGradient(rodX, rodY, rodX + rodW, rodY);
    grad.addColorStop(0, chargeSign > 0 ? "#dc2626" : "#2563eb");
    grad.addColorStop(1, chargeSign > 0 ? "#991b1b" : "#1e40af");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(rodX, rodY, rodW, rodH, 4);
    ctx.fill();

    // Charge symbols
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    for (let i = 0; i < 5; i++) {
      ctx.fillText(chargeSign > 0 ? "+" : "−", rodX + rodW / 2, rodY + 20 + i * rodH / 5);
    }

    // Label
    ctx.font = `${Math.max(10, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Charged Rod", rodX + rodW / 2, rodY - 8);
    ctx.fillText(chargeSign > 0 ? "(+)" : "(−)", rodX + rodW / 2, rodY + rodH + 16);
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    drawRod();
    drawObject(objectBounds("top"), conductorElectrons, "Conductor (Metal)", "rgba(120,140,170,0.3)");
    drawObject(objectBounds("bottom"), insulatorElectrons, "Insulator (Glass)", "rgba(170,150,120,0.2)");

    // Explanation
    ctx.save();
    ctx.font = `${Math.max(9, width * 0.014)}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(180,200,240,0.5)";
    const cb = objectBounds("top");
    ctx.fillText("Free electrons redistribute →", cb.x - 8, cb.y + cb.h / 2);
    const ib = objectBounds("bottom");
    ctx.fillText("Electron clouds shift slightly →", ib.x - 8, ib.y + ib.h / 2);
    ctx.restore();

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Conductor vs Insulator — Electrostatic Induction", width / 2, height - 8);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    const cb = objectBounds("top");
    const ib = objectBounds("bottom");
    conductorElectrons = createElectrons(cb);
    insulatorElectrons = createElectrons(ib);
  }

  function destroy(): void { conductorElectrons = []; insulatorElectrons = []; }

  function getStateDescription(): string {
    return (
      `Conductor vs Insulator: charged rod (${chargeSign > 0 ? "positive" : "negative"}) at ${rodDistance}% distance. ` +
      `In the conductor, free electrons redistribute — opposite charges accumulate on the near side. ` +
      `In the insulator, electron clouds shift slightly (polarisation) but electrons remain bound to atoms.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    const cb = objectBounds("top");
    const ib = objectBounds("bottom");
    conductorElectrons = createElectrons(cb);
    insulatorElectrons = createElectrons(ib);
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ConductorInsulatorFactory;
