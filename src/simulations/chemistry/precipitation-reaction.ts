import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PrecipitationReactionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("precipitation-reaction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let solution1 = 0; // 0=AgNO3, 1=BaCl2, 2=Pb(NO3)2, 3=CuSO4
  let solution2 = 0; // 0=NaCl, 1=Na2SO4, 2=Na2S, 3=KI
  let mixRate = 5;

  const cations = [
    { name: "Ag⁺", color: "#c0c0c0", formula: "AgNO₃" },
    { name: "Ba²⁺", color: "#90d090", formula: "BaCl₂" },
    { name: "Pb²⁺", color: "#a0a0d0", formula: "Pb(NO₃)₂" },
    { name: "Cu²⁺", color: "#50a0d0", formula: "CuSO₄" },
  ];

  const anions = [
    { name: "Cl⁻", color: "#80d0ff", formula: "NaCl" },
    { name: "SO₄²⁻", color: "#e0d080", formula: "Na₂SO₄" },
    { name: "S²⁻", color: "#d0a050", formula: "Na₂S" },
    { name: "I⁻", color: "#d080d0", formula: "KI" },
  ];

  // Precipitate lookup: [cation][anion] = { color, name } or null
  const precipitates: Record<string, { color: string; name: string } | null> = {
    "0-0": { color: "#f0f0f0", name: "AgCl (white)" },
    "0-1": null, // Ag2SO4 slightly soluble, skip
    "0-2": { color: "#1a1a1a", name: "Ag₂S (black)" },
    "0-3": { color: "#e0e060", name: "AgI (yellow)" },
    "1-0": null,
    "1-1": { color: "#f0f0f0", name: "BaSO₄ (white)" },
    "1-2": null,
    "1-3": null,
    "2-0": { color: "#f0f0f0", name: "PbCl₂ (white)" },
    "2-1": { color: "#f0f0f0", name: "PbSO₄ (white)" },
    "2-2": { color: "#1a1a1a", name: "PbS (black)" },
    "2-3": { color: "#e0e060", name: "PbI₂ (yellow)" },
    "3-0": null,
    "3-1": null,
    "3-2": { color: "#1a1a1a", name: "CuS (black)" },
    "3-3": null,
  };

  interface Ion {
    x: number; y: number; vx: number; vy: number;
    type: "cation" | "anion" | "spectator";
    index: number; alive: boolean;
  }

  interface Precipitate {
    x: number; y: number; vy: number; size: number; color: string;
  }

  let ions: Ion[] = [];
  let precipitateParticles: Precipitate[] = [];
  let spawnTimer = 0;

  // Beaker layout
  let beakerX = 0, beakerY = 0, beakerW = 0, beakerH = 0, waterLevel = 0;

  function layout() {
    beakerW = width * 0.45;
    beakerH = height * 0.5;
    beakerX = (width - beakerW) / 2;
    beakerY = height * 0.3;
    waterLevel = beakerY + beakerH * 0.15;
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    ions = [];
    precipitateParticles = [];
    spawnTimer = 0;
    layout();
  }

  function update(dt: number, params: Record<string, number>) {
    solution1 = Math.round(params.solution1 ?? 0);
    solution2 = Math.round(params.solution2 ?? 0);
    mixRate = params.mixRate ?? 5;

    // Spawn ions
    spawnTimer += dt;
    const rate = 0.2 / mixRate;
    while (spawnTimer > rate) {
      spawnTimer -= rate;
      // Add cation
      ions.push({
        x: beakerX + 20 + Math.random() * (beakerW - 40),
        y: waterLevel + 10,
        vx: (Math.random() - 0.5) * 40,
        vy: 10 + Math.random() * 20,
        type: "cation",
        index: solution1,
        alive: true,
      });
      // Add anion
      ions.push({
        x: beakerX + 20 + Math.random() * (beakerW - 40),
        y: waterLevel + 10,
        vx: (Math.random() - 0.5) * 40,
        vy: 10 + Math.random() * 20,
        type: "anion",
        index: solution2,
        alive: true,
      });
    }

    // Update ions
    for (const ion of ions) {
      if (!ion.alive) continue;
      ion.vx += (Math.random() - 0.5) * 30 * dt;
      ion.vy += (Math.random() - 0.5) * 20 * dt + 5 * dt; // slight downward
      ion.vx *= 0.98;
      ion.vy *= 0.98;
      ion.x += ion.vx * dt;
      ion.y += ion.vy * dt;

      // Bounce in beaker
      if (ion.x < beakerX + 10) { ion.x = beakerX + 10; ion.vx = Math.abs(ion.vx); }
      if (ion.x > beakerX + beakerW - 10) { ion.x = beakerX + beakerW - 10; ion.vx = -Math.abs(ion.vx); }
      if (ion.y < waterLevel) { ion.y = waterLevel; ion.vy = Math.abs(ion.vy); }
      if (ion.y > beakerY + beakerH - 10) { ion.y = beakerY + beakerH - 10; ion.vy = -Math.abs(ion.vy) * 0.5; }
    }

    // Check for precipitation reactions
    const key = `${solution1}-${solution2}`;
    const precip = precipitates[key];
    if (precip) {
      for (let i = 0; i < ions.length; i++) {
        if (!ions[i].alive || ions[i].type !== "cation") continue;
        for (let j = 0; j < ions.length; j++) {
          if (!ions[j].alive || ions[j].type !== "anion") continue;
          const dx = ions[i].x - ions[j].x;
          const dy = ions[i].y - ions[j].y;
          if (dx * dx + dy * dy < 400) {
            // React!
            ions[i].alive = false;
            ions[j].alive = false;
            precipitateParticles.push({
              x: (ions[i].x + ions[j].x) / 2,
              y: (ions[i].y + ions[j].y) / 2,
              vy: 15 + Math.random() * 10,
              size: 3 + Math.random() * 3,
              color: precip.color,
            });
            break;
          }
        }
      }
    }

    // Update precipitates (settle to bottom)
    for (const p of precipitateParticles) {
      p.y += p.vy * dt;
      p.vy *= 0.98;
      if (p.y > beakerY + beakerH - p.size - 5) {
        p.y = beakerY + beakerH - p.size - 5;
        p.vy = 0;
      }
    }

    // Cleanup
    ions = ions.filter((i) => i.alive);
    if (ions.length > 120) ions.splice(0, ions.length - 120);
    if (precipitateParticles.length > 200) precipitateParticles.splice(0, precipitateParticles.length - 200);

    time += dt;
  }

  function render() {
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Beaker
    ctx.strokeStyle = "rgba(150,200,255,0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(beakerX, beakerY);
    ctx.lineTo(beakerX, beakerY + beakerH);
    ctx.lineTo(beakerX + beakerW, beakerY + beakerH);
    ctx.lineTo(beakerX + beakerW, beakerY);
    ctx.stroke();

    // Water
    ctx.fillStyle = "rgba(100,160,230,0.15)";
    ctx.fillRect(beakerX + 2, waterLevel, beakerW - 4, beakerY + beakerH - waterLevel - 2);

    // Water surface
    ctx.strokeStyle = "rgba(100,180,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(beakerX + 2, waterLevel);
    for (let x = beakerX + 2; x <= beakerX + beakerW - 2; x += 4) {
      ctx.lineTo(x, waterLevel + Math.sin(x * 0.1 + time * 3) * 1.5);
    }
    ctx.stroke();

    // Precipitate particles
    for (const p of precipitateParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    // Ions
    for (const ion of ions) {
      const info = ion.type === "cation" ? cations[ion.index] : anions[ion.index];
      ctx.beginPath();
      ctx.arc(ion.x, ion.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = info.color;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "7px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ion.type === "cation" ? "+" : "−", ion.x, ion.y);
    }

    // Solution labels (top)
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";

    const cat = cations[solution1];
    const an = anions[solution2];
    ctx.fillStyle = cat.color;
    ctx.fillText(cat.formula, beakerX + beakerW * 0.3, beakerY - 25);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("+", beakerX + beakerW * 0.5, beakerY - 25);
    ctx.fillStyle = an.color;
    ctx.fillText(an.formula, beakerX + beakerW * 0.7, beakerY - 25);

    // Result
    const key = `${solution1}-${solution2}`;
    const precip = precipitates[key];
    ctx.font = `bold ${Math.max(13, height * 0.024)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    if (precip) {
      ctx.fillStyle = "rgba(255,220,100,0.8)";
      ctx.fillText(`Precipitate: ${precip.name}`, width / 2, beakerY - 5);
    } else {
      ctx.fillStyle = "rgba(100,255,100,0.6)";
      ctx.fillText("No precipitate — all ions remain in solution", width / 2, beakerY - 5);
    }

    // Reference table (right side)
    const tableX = beakerX + beakerW + 20;
    const tableY = height * 0.15;
    const tableW = width - tableX - 10;
    if (tableW > 80) {
      ctx.fillStyle = "rgba(10,10,30,0.8)";
      ctx.beginPath();
      ctx.roundRect(tableX, tableY, tableW, height * 0.7, 6);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `bold ${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Precipitate Table", tableX + tableW / 2, tableY + 15);

      ctx.font = `${Math.max(8, height * 0.012)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      let row = 0;
      for (let ci = 0; ci < 4; ci++) {
        for (let ai = 0; ai < 4; ai++) {
          const k = `${ci}-${ai}`;
          const p = precipitates[k];
          if (p) {
            const yy = tableY + 30 + row * 16;
            ctx.fillStyle = p.color;
            ctx.fillRect(tableX + 5, yy - 5, 8, 8);
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillText(`${cations[ci].name}+${anions[ai].name}: ${p.name}`, tableX + 18, yy + 2);
            row++;
          }
        }
      }
    }

    // Info bar
    const infoY = height * 0.88;
    ctx.fillStyle = "rgba(10,10,30,0.8)";
    ctx.beginPath();
    ctx.roundRect(width * 0.03, infoY, width * 0.94, height * 0.1, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Precipitation occurs when cation-anion pairs form insoluble compounds that settle out of solution", width / 2, infoY + 18);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Precipitation Reaction", width / 2, 25);
  }

  function reset() {
    time = 0;
    ions = [];
    precipitateParticles = [];
    spawnTimer = 0;
  }

  function destroy() {
    ions = [];
    precipitateParticles = [];
  }

  function getStateDescription(): string {
    const key = `${solution1}-${solution2}`;
    const precip = precipitates[key];
    return `Precipitation Reaction | ${cations[solution1].formula} + ${anions[solution2].formula} | ${precip ? `Precipitate: ${precip.name}` : "No precipitate"} | Ions: ${ions.length} | Precipitate particles: ${precipitateParticles.length}`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout();
    ions = [];
    precipitateParticles = [];
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PrecipitationReactionFactory;
