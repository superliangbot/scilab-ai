import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const IgneousRockFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("igneous-rock") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let silicaContent = 70; // 40-80% (felsic to mafic)
  let coolingRate = 0.3; // 0=fast(extrusive), 1=slow(intrusive)

  interface Crystal {
    x: number;
    y: number;
    size: number;
    angle: number;
    color: string;
    shape: number; // 0-2 for different mineral shapes
  }

  let crystals: Crystal[] = [];

  const rockTypes: {
    name: string;
    silicaRange: [number, number];
    coolingRange: [number, number];
    colors: string[];
    description: string;
  }[] = [
    { name: "Granite", silicaRange: [65, 80], coolingRange: [0.5, 1], colors: ["#e8d5c4", "#f0e0d0", "#c4a882", "#888888", "#ff9999"], description: "Coarse-grained, felsic, intrusive" },
    { name: "Rhyolite", silicaRange: [65, 80], coolingRange: [0, 0.5], colors: ["#d4c4b4", "#c8b8a8", "#b0a090", "#998888"], description: "Fine-grained, felsic, extrusive" },
    { name: "Diorite", silicaRange: [52, 65], coolingRange: [0.5, 1], colors: ["#808080", "#666666", "#999999", "#aaaaaa", "#555555"], description: "Coarse-grained, intermediate, intrusive" },
    { name: "Andesite", silicaRange: [52, 65], coolingRange: [0, 0.5], colors: ["#707070", "#606060", "#808080", "#555555"], description: "Fine-grained, intermediate, extrusive" },
    { name: "Gabbro", silicaRange: [40, 52], coolingRange: [0.5, 1], colors: ["#333333", "#444444", "#222222", "#555555", "#2a3a2a"], description: "Coarse-grained, mafic, intrusive" },
    { name: "Basalt", silicaRange: [40, 52], coolingRange: [0, 0.5], colors: ["#2a2a2a", "#333333", "#1a1a1a", "#3a3a3a"], description: "Fine-grained, mafic, extrusive" },
  ];

  function getCurrentRock(): typeof rockTypes[0] {
    for (const rock of rockTypes) {
      if (silicaContent >= rock.silicaRange[0] && silicaContent <= rock.silicaRange[1] &&
          coolingRate >= rock.coolingRange[0] && coolingRate <= rock.coolingRange[1]) {
        return rock;
      }
    }
    // Fallback
    return rockTypes[0];
  }

  function generateCrystals() {
    crystals = [];
    const rock = getCurrentRock();
    const viewSize = Math.min(width * 0.45, height - 200);
    const viewX = width / 2 - viewSize / 2;
    const viewY = 120;

    // Crystal size based on cooling rate
    const baseCrystalSize = 3 + coolingRate * 25;
    const count = Math.round(200 - coolingRate * 150);

    for (let i = 0; i < count; i++) {
      const color = rock.colors[Math.floor(Math.random() * rock.colors.length)];
      crystals.push({
        x: viewX + Math.random() * viewSize,
        y: viewY + Math.random() * viewSize,
        size: baseCrystalSize * (0.5 + Math.random()),
        angle: Math.random() * Math.PI * 2,
        color,
        shape: Math.floor(Math.random() * 3),
      });
    }
  }

  function drawCrystal(c: Crystal) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);

    ctx.fillStyle = c.color;
    ctx.strokeStyle = lighten(c.color, 20);
    ctx.lineWidth = 0.5;

    if (c.shape === 0) {
      // Rectangular crystal
      ctx.fillRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.66);
      ctx.strokeRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.66);
    } else if (c.shape === 1) {
      // Hexagonal crystal
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * c.size / 2;
        const y = Math.sin(a) * c.size / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Irregular/elongated crystal
      ctx.beginPath();
      ctx.ellipse(0, 0, c.size / 2, c.size / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function lighten(color: string, amt: number): string {
    // Handle both hex and rgb
    if (color.startsWith("#")) {
      const r = Math.min(255, parseInt(color.slice(1, 3), 16) + amt);
      const g = Math.min(255, parseInt(color.slice(3, 5), 16) + amt);
      const b = Math.min(255, parseInt(color.slice(5, 7), 16) + amt);
      return `rgb(${r},${g},${b})`;
    }
    return color;
  }

  function drawClassificationChart() {
    const chartX = 15;
    const chartY = height - 170;
    const chartW = width - 30;
    const chartH = 150;

    ctx.fillStyle = "rgba(10,15,30,0.85)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(chartX, chartY, chartW, chartH, 8);
    ctx.fill();
    ctx.stroke();

    // Grid
    const gridX = chartX + 60;
    const gridY = chartY + 30;
    const gridW = chartW - 80;
    const gridH = chartH - 55;

    // X axis - silica content
    ctx.strokeStyle = "#445";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gridX, gridY + gridH);
    ctx.lineTo(gridX + gridW, gridY + gridH);
    ctx.stroke();

    // Y axis - cooling rate
    ctx.beginPath();
    ctx.moveTo(gridX, gridY);
    ctx.lineTo(gridX, gridY + gridH);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#aaa";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("← Mafic (low SiO₂)          Silica Content          Felsic (high SiO₂) →", gridX + gridW / 2, gridY + gridH + 15);

    ctx.save();
    ctx.translate(gridX - 15, gridY + gridH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Slow ← Cooling → Fast", 0, 0);
    ctx.restore();

    // Rock type boxes
    const cellW = gridW / 3;
    const cellH = gridH / 2;

    const chartRocks = [
      { name: "Granite", col: 2, row: 0, color: "#d4c4b4" },
      { name: "Rhyolite", col: 2, row: 1, color: "#b0a090" },
      { name: "Diorite", col: 1, row: 0, color: "#808080" },
      { name: "Andesite", col: 1, row: 1, color: "#606060" },
      { name: "Gabbro", col: 0, row: 0, color: "#444444" },
      { name: "Basalt", col: 0, row: 1, color: "#2a2a2a" },
    ];

    const currentRock = getCurrentRock();

    for (const cr of chartRocks) {
      const rx = gridX + cr.col * cellW;
      const ry = gridY + cr.row * cellH;

      ctx.fillStyle = cr.color;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(rx + 1, ry + 1, cellW - 2, cellH - 2);
      ctx.globalAlpha = 1;

      if (cr.name === currentRock.name) {
        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 2;
        ctx.strokeRect(rx + 1, ry + 1, cellW - 2, cellH - 2);
      }

      ctx.fillStyle = cr.name === currentRock.name ? "#ffcc00" : "#ccc";
      ctx.font = cr.name === currentRock.name ? "bold 11px sans-serif" : "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(cr.name, rx + cellW / 2, ry + cellH / 2 + 4);
    }

    // Row labels
    ctx.fillStyle = "#889";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Intrusive", gridX - 3, gridY + cellH / 2 + 3);
    ctx.fillText("Extrusive", gridX - 3, gridY + cellH + cellH / 2 + 3);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      generateCrystals();
    },

    update(dt: number, params: Record<string, number>) {
      const newSilica = params.silicaContent ?? 70;
      const newCooling = params.coolingRate ?? 0.3;

      if (Math.abs(newSilica - silicaContent) > 0.5 || Math.abs(newCooling - coolingRate) > 0.02) {
        silicaContent = newSilica;
        coolingRate = newCooling;
        generateCrystals();
      }

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      const rock = getCurrentRock();

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Igneous Rock Classification", width / 2, 28);

      // Current rock info
      ctx.fillStyle = "#ffcc88";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(rock.name, width / 2, 50);
      ctx.fillStyle = "#889";
      ctx.font = "12px sans-serif";
      ctx.fillText(rock.description, width / 2, 68);

      // Rock texture view
      const viewSize = Math.min(width * 0.6, height - 260);
      const viewX = width / 2 - viewSize / 2;
      const viewY = 85;

      // View background
      ctx.fillStyle = "#1a1a1a";
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(viewX - 2, viewY - 2, viewSize + 4, viewSize + 4, 8);
      ctx.fill();
      ctx.stroke();

      // Base rock color
      const baseColor = silicaContent > 60 ? "#c4b4a4" : silicaContent > 50 ? "#707070" : "#303030";
      ctx.fillStyle = baseColor;
      ctx.fillRect(viewX, viewY, viewSize, viewSize);

      // Draw crystals
      ctx.save();
      ctx.beginPath();
      ctx.rect(viewX, viewY, viewSize, viewSize);
      ctx.clip();

      for (const crystal of crystals) {
        drawCrystal(crystal);
      }

      ctx.restore();

      // Magnifying glass indicator
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(viewX + viewSize - 25, viewY + 25, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(viewX + viewSize - 14, viewY + 36);
      ctx.lineTo(viewX + viewSize - 6, viewY + 44);
      ctx.stroke();

      // SiO2 and cooling labels
      ctx.fillStyle = "#aaa";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`SiO₂: ${silicaContent.toFixed(0)}%  |  Cooling: ${coolingRate < 0.5 ? "Fast (extrusive)" : "Slow (intrusive)"}`, width / 2, viewY + viewSize + 18);

      // Classification chart
      drawClassificationChart();
    },

    reset() {
      time = 0;
      generateCrystals();
    },

    destroy() {
      crystals = [];
    },

    getStateDescription() {
      const rock = getCurrentRock();
      return `Igneous rock: ${rock.name}. SiO₂=${silicaContent.toFixed(0)}%, cooling rate=${coolingRate < 0.5 ? "fast (extrusive)" : "slow (intrusive)"}. ${rock.description}. Crystal size proportional to cooling time - slow cooling underground produces large crystals.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      generateCrystals();
    },
  };

  return engine;
};

export default IgneousRockFactory;
