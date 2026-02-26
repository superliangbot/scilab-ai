import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Molecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "H2" | "O2" | "H2O";
  radius: number;
}

const LawOfDefiniteProportionsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("law-of-definite-proportions") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let hydrogenCount = 4;
  let oxygenCount = 2;
  let autoReact = 0;

  let molecules: Molecule[] = [];
  let reactionFlashes: { x: number; y: number; t: number }[] = [];

  // Container bounds
  let cLeft = 0;
  let cRight = 0;
  let cTop = 0;
  let cBottom = 0;

  function updateBounds() {
    cLeft = width * 0.08;
    cRight = width * 0.92;
    cTop = height * 0.12;
    cBottom = height * 0.72;
  }

  function spawnMolecules() {
    molecules = [];
    const cw = cRight - cLeft - 30;
    const ch = cBottom - cTop - 30;
    for (let i = 0; i < hydrogenCount; i++) {
      molecules.push({
        x: cLeft + 15 + Math.random() * cw,
        y: cTop + 15 + Math.random() * ch,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        type: "H2",
        radius: 10,
      });
    }
    for (let i = 0; i < oxygenCount; i++) {
      molecules.push({
        x: cLeft + 15 + Math.random() * cw,
        y: cTop + 15 + Math.random() * ch,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        type: "O2",
        radius: 13,
      });
    }
    reactionFlashes = [];
  }

  function tryReaction() {
    // Find 2 H2 + 1 O2 that are close enough
    const h2 = molecules.filter((m) => m.type === "H2");
    const o2 = molecules.filter((m) => m.type === "O2");
    if (h2.length < 2 || o2.length < 1) return;

    const threshold = 50;
    for (const oxygen of o2) {
      const nearH2: Molecule[] = [];
      for (const hydrogen of h2) {
        const dx = hydrogen.x - oxygen.x;
        const dy = hydrogen.y - oxygen.y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          nearH2.push(hydrogen);
          if (nearH2.length === 2) break;
        }
      }
      if (nearH2.length === 2) {
        // React: remove 2 H2 + 1 O2, create 2 H2O
        const rx = oxygen.x;
        const ry = oxygen.y;
        molecules = molecules.filter((m) => m !== nearH2[0] && m !== nearH2[1] && m !== oxygen);

        for (let i = 0; i < 2; i++) {
          molecules.push({
            x: rx + (i - 0.5) * 20,
            y: ry,
            vx: (Math.random() - 0.5) * 40,
            vy: (Math.random() - 0.5) * 40,
            type: "H2O",
            radius: 12,
          });
        }
        reactionFlashes.push({ x: rx, y: ry, t: 0 });
        return;
      }
    }
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      updateBounds();
      spawnMolecules();
    },
    update(dt: number, params: Record<string, number>) {
      const newH = Math.round(params.hydrogenCount ?? 4);
      const newO = Math.round(params.oxygenCount ?? 2);
      autoReact = params.autoReact ?? 0;

      if (newH !== hydrogenCount || newO !== oxygenCount) {
        hydrogenCount = newH;
        oxygenCount = newO;
        spawnMolecules();
      }

      const dtc = Math.min(dt, 0.04);
      time += dtc;

      // Move molecules
      for (const m of molecules) {
        m.x += m.vx * dtc;
        m.y += m.vy * dtc;

        // Brownian jitter
        m.vx += (Math.random() - 0.5) * 30 * dtc;
        m.vy += (Math.random() - 0.5) * 30 * dtc;
        m.vx *= 0.995;
        m.vy *= 0.995;

        // Container bounds
        if (m.x - m.radius < cLeft) { m.x = cLeft + m.radius; m.vx = Math.abs(m.vx); }
        if (m.x + m.radius > cRight) { m.x = cRight - m.radius; m.vx = -Math.abs(m.vx); }
        if (m.y - m.radius < cTop) { m.y = cTop + m.radius; m.vy = Math.abs(m.vy); }
        if (m.y + m.radius > cBottom) { m.y = cBottom - m.radius; m.vy = -Math.abs(m.vy); }
      }

      // Molecule-molecule soft repulsion
      for (let i = 0; i < molecules.length; i++) {
        for (let j = i + 1; j < molecules.length; j++) {
          const a = molecules[i];
          const b = molecules[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.radius + b.radius;
          if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
            // Bounce
            const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (dvn > 0) {
              a.vx -= dvn * nx * 0.5;
              a.vy -= dvn * ny * 0.5;
              b.vx += dvn * nx * 0.5;
              b.vy += dvn * ny * 0.5;
            }
          }
        }
      }

      // Auto-react
      if (autoReact) {
        tryReaction();
      }

      // Update flashes
      for (const f of reactionFlashes) f.t += dtc;
      reactionFlashes = reactionFlashes.filter((f) => f.t < 1);
    },
    render() {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#1e293b";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Law of Definite Proportions", width / 2, 24);

      // Subtitle
      ctx.fillStyle = "#64748b";
      ctx.font = `${Math.max(11, width * 0.015)}px sans-serif`;
      ctx.fillText("2H₂ + O₂ → 2H₂O (hydrogen:oxygen mass ratio = 1:8)", width / 2, 42);

      // Container
      ctx.fillStyle = "#f0f9ff";
      ctx.fillRect(cLeft, cTop, cRight - cLeft, cBottom - cTop);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2;
      ctx.strokeRect(cLeft, cTop, cRight - cLeft, cBottom - cTop);

      // Draw molecules
      for (const m of molecules) {
        drawMolecule(m);
      }

      // Reaction flashes
      for (const f of reactionFlashes) {
        const alpha = 1 - f.t;
        const r = 20 + f.t * 30;
        ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Counts panel
      drawCounts();

      // Ratio analysis
      drawRatioPanel();
    },
    reset() {
      time = 0;
      spawnMolecules();
    },
    destroy() {},
    getStateDescription(): string {
      const h2Count = molecules.filter((m) => m.type === "H2").length;
      const o2Count = molecules.filter((m) => m.type === "O2").length;
      const h2oCount = molecules.filter((m) => m.type === "H2O").length;
      return `Law of Definite Proportions: ${h2Count} H₂, ${o2Count} O₂, ${h2oCount} H₂O molecules. ` +
        `Water always forms in ratio 2H₂ : 1O₂ → 2H₂O. ` +
        `By mass: 4g H₂ + 32g O₂ → 36g H₂O (hydrogen:oxygen = 1:8 by mass). ` +
        `This demonstrates that compounds have fixed composition regardless of amount.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      updateBounds();
    },
  };

  function drawMolecule(m: Molecule) {
    if (m.type === "H2") {
      // Two small white circles bonded
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(m.x - 5, m.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.x + 5, m.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m.x - 5, m.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x + 5, m.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      // Bond line
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x - 3, m.y);
      ctx.lineTo(m.x + 3, m.y);
      ctx.stroke();
      // Label
      ctx.fillStyle = "#475569";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", m.x - 5, m.y);
      ctx.fillText("H", m.x + 5, m.y);
      ctx.textBaseline = "alphabetic";
    } else if (m.type === "O2") {
      // Two red circles
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(m.x - 6, m.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.x + 6, m.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b91c1c";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m.x - 6, m.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x + 6, m.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      // Double bond
      ctx.strokeStyle = "#7f1d1d";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(m.x - 3, m.y - 2);
      ctx.lineTo(m.x + 3, m.y - 2);
      ctx.moveTo(m.x - 3, m.y + 2);
      ctx.lineTo(m.x + 3, m.y + 2);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("O", m.x - 6, m.y);
      ctx.fillText("O", m.x + 6, m.y);
      ctx.textBaseline = "alphabetic";
    } else {
      // H2O: bent molecule
      const angle = Math.PI * 104.5 / 180;
      const bondLen = 8;
      const ox = m.x;
      const oy = m.y;
      const h1x = ox + bondLen * Math.cos(-angle / 2);
      const h1y = oy + bondLen * Math.sin(-angle / 2);
      const h2x = ox + bondLen * Math.cos(angle / 2);
      const h2y = oy + bondLen * Math.sin(angle / 2);

      // Oxygen
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(ox, oy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Hydrogens
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(h1x, h1y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(h2x, h2y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Bonds
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(h1x, h1y);
      ctx.moveTo(ox, oy);
      ctx.lineTo(h2x, h2y);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("O", ox, oy);
      ctx.fillText("H", h1x, h1y);
      ctx.fillText("H", h2x, h2y);
      ctx.textBaseline = "alphabetic";
    }
  }

  function drawCounts() {
    const h2Count = molecules.filter((m) => m.type === "H2").length;
    const o2Count = molecules.filter((m) => m.type === "O2").length;
    const h2oCount = molecules.filter((m) => m.type === "H2O").length;

    ctx.font = `${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.textAlign = "left";
    const px = cLeft;
    const py = cBottom + 20;

    ctx.fillStyle = "#64748b";
    ctx.fillText(`H₂: ${h2Count}`, px, py);
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`O₂: ${o2Count}`, px + width * 0.2, py);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`H₂O: ${h2oCount}`, px + width * 0.4, py);
  }

  function drawRatioPanel() {
    const h2Count = molecules.filter((m) => m.type === "H2").length;
    const o2Count = molecules.filter((m) => m.type === "O2").length;
    const h2oCount = molecules.filter((m) => m.type === "H2O").length;
    const totalH = h2Count * 2 + h2oCount * 2;
    const totalO = o2Count * 2 + h2oCount;

    const px = cLeft;
    const py = cBottom + 44;

    ctx.fillStyle = "#475569";
    ctx.font = `${Math.max(10, width * 0.014)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`Total H atoms: ${totalH} | Total O atoms: ${totalO}`, px, py);
    if (h2oCount > 0) {
      ctx.fillText(`In H₂O: H:O = ${h2oCount * 2}:${h2oCount} = 2:1 (always!)`, px, py + 16);
      const massFracH = (h2oCount * 2 * 1) / (h2oCount * 2 * 1 + h2oCount * 16);
      const massFracO = (h2oCount * 16) / (h2oCount * 2 * 1 + h2oCount * 16);
      ctx.fillText(`Mass fraction: H=${(massFracH * 100).toFixed(1)}%, O=${(massFracO * 100).toFixed(1)}%`, px, py + 32);
    }
  }
};

export default LawOfDefiniteProportionsFactory;
