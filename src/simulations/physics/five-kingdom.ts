import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "five-kingdom",
  title: "Five Kingdom Classification",
  category: "physics",
  description:
    "Interactive biological classification — explore the five-kingdom system of life.",
  longDescription:
    "Robert Whittaker's Five Kingdom Classification (1969) divides all living organisms into Monera (prokaryotes), Protista (unicellular eukaryotes), Fungi (decomposers), Plantae (autotrophs), and Animalia (heterotrophs). This interactive diagram lets you explore each kingdom's characteristics, cell type, nutrition mode, and example organisms through a visual taxonomy tree.",
  parameters: [
    { key: "selectedKingdom", label: "Kingdom (0=All, 1-5)", min: 0, max: 5, step: 1, defaultValue: 0 },
    { key: "showDetails", label: "Show Details (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    { key: "animationSpeed", label: "Animation Speed", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
  ],
  thumbnailColor: "#059669",
};

interface Kingdom {
  name: string;
  color: string;
  cellType: string;
  nutrition: string;
  examples: string[];
  characteristics: string[];
  symbol: string;
}

const KINGDOMS: Kingdom[] = [
  {
    name: "Monera",
    color: "#8b5cf6",
    cellType: "Prokaryotic",
    nutrition: "Autotrophic / Heterotrophic",
    examples: ["Bacteria", "Cyanobacteria", "Archaea"],
    characteristics: ["No nucleus", "Single-celled", "Cell wall present"],
    symbol: "M",
  },
  {
    name: "Protista",
    color: "#06b6d4",
    cellType: "Eukaryotic",
    nutrition: "Autotrophic / Heterotrophic",
    examples: ["Amoeba", "Paramecium", "Euglena", "Algae"],
    characteristics: ["Nucleus present", "Mostly unicellular", "Diverse group"],
    symbol: "P",
  },
  {
    name: "Fungi",
    color: "#f59e0b",
    cellType: "Eukaryotic",
    nutrition: "Heterotrophic (Saprophytic)",
    examples: ["Mushroom", "Yeast", "Mold", "Penicillium"],
    characteristics: ["Cell wall (chitin)", "Spore reproduction", "Decomposers"],
    symbol: "F",
  },
  {
    name: "Plantae",
    color: "#22c55e",
    cellType: "Eukaryotic",
    nutrition: "Autotrophic (Photosynthesis)",
    examples: ["Fern", "Pine tree", "Rose", "Moss"],
    characteristics: ["Cell wall (cellulose)", "Chloroplasts", "Multicellular"],
    symbol: "Pl",
  },
  {
    name: "Animalia",
    color: "#ef4444",
    cellType: "Eukaryotic",
    nutrition: "Heterotrophic (Ingestion)",
    examples: ["Human", "Fish", "Insect", "Bird"],
    characteristics: ["No cell wall", "Multicellular", "Nervous system"],
    symbol: "A",
  },
];

const FiveKingdomFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let selectedKingdom = 0;
  let showDetails = 1;
  let animSpeed = 1;

  function drawBranch(x1: number, y1: number, x2: number, y2: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1, y2, x2, y2);
    ctx.stroke();
  }

  function drawKingdomNode(x: number, y: number, kingdom: Kingdom, index: number, isSelected: boolean) {
    const r = isSelected ? 35 : 28;
    const pulse = isSelected ? Math.sin(time * animSpeed * 4) * 3 : 0;

    // Glow
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, r + 12 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = kingdom.color + "33";
      ctx.fill();
    }

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r + pulse, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x - r / 3, y - r / 3, 0, x, y, r + pulse);
    grad.addColorStop(0, kingdom.color + "cc");
    grad.addColorStop(1, kingdom.color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Symbol
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${isSelected ? 16 : 13}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(kingdom.symbol, x, y);

    // Name below
    ctx.fillStyle = kingdom.color;
    ctx.font = `bold ${isSelected ? 14 : 12}px sans-serif`;
    ctx.fillText(kingdom.name, x, y + r + 18);
  }

  function drawDetailPanel(kingdom: Kingdom, x: number, y: number) {
    const pw = Math.min(W * 0.45, 250);
    const ph = 170;
    const px = Math.min(Math.max(x - pw / 2, 10), W - pw - 10);

    // Panel background
    ctx.fillStyle = "rgba(15,23,42,0.92)";
    ctx.strokeStyle = kingdom.color + "88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 8, y);
    ctx.lineTo(px + pw - 8, y);
    ctx.quadraticCurveTo(px + pw, y, px + pw, y + 8);
    ctx.lineTo(px + pw, y + ph - 8);
    ctx.quadraticCurveTo(px + pw, y + ph, px + pw - 8, y + ph);
    ctx.lineTo(px + 8, y + ph);
    ctx.quadraticCurveTo(px, y + ph, px, y + ph - 8);
    ctx.lineTo(px, y + 8);
    ctx.quadraticCurveTo(px, y, px + 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    let ty = y + 22;
    ctx.fillStyle = kingdom.color;
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(kingdom.name, px + 15, ty);
    ty += 22;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Cell type: ${kingdom.cellType}`, px + 15, ty); ty += 18;
    ctx.fillText(`Nutrition: ${kingdom.nutrition}`, px + 15, ty); ty += 22;

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("Characteristics:", px + 15, ty); ty += 16;
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#94a3b8";
    for (const c of kingdom.characteristics) {
      ctx.fillText(`• ${c}`, px + 20, ty); ty += 15;
    }
    ty += 6;

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("Examples:", px + 15, ty); ty += 16;
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(kingdom.examples.join(", "), px + 20, ty);
  }

  function drawClassificationCriteria() {
    const cy = H - 50;
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";

    const criteria = [
      "Cell type: Prokaryotic → Eukaryotic",
      "Organization: Unicellular → Multicellular",
      "Nutrition: Autotrophic ↔ Heterotrophic",
    ];
    for (let i = 0; i < criteria.length; i++) {
      ctx.fillText(criteria[i], W / 2, cy + i * 15);
    }
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    selectedKingdom = Math.floor(params.selectedKingdom ?? 0);
    showDetails = params.showDetails ?? 1;
    animSpeed = params.animationSpeed ?? 1;
    time += dt;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e293b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Five Kingdom Classification", W / 2, 30);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Whittaker's system (1969)", W / 2, 48);

    // Root node (Life)
    const rootX = W / 2;
    const rootY = H * 0.22;
    ctx.beginPath();
    ctx.arc(rootX, rootY, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#334155";
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Life", rootX, rootY);

    // Kingdom nodes
    const nodeY = H * 0.45;
    const spacing = (W - 60) / 5;
    const startX = 30 + spacing / 2;

    for (let i = 0; i < KINGDOMS.length; i++) {
      const nx = startX + i * spacing;
      const isSelected = selectedKingdom === i + 1 || selectedKingdom === 0;
      drawBranch(rootX, rootY + 22, nx, nodeY, isSelected ? KINGDOMS[i].color : "#334155");
      drawKingdomNode(nx, nodeY, KINGDOMS[i], i, selectedKingdom === i + 1);
    }

    // Detail panels
    if (showDetails) {
      if (selectedKingdom >= 1 && selectedKingdom <= 5) {
        const k = KINGDOMS[selectedKingdom - 1];
        const nx = startX + (selectedKingdom - 1) * spacing;
        drawDetailPanel(k, nx, nodeY + 60);
      } else {
        // Show mini info for all
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        for (let i = 0; i < KINGDOMS.length; i++) {
          const nx = startX + i * spacing;
          ctx.fillStyle = "#64748b";
          ctx.fillText(KINGDOMS[i].cellType, nx, nodeY + 55);
          ctx.fillText(KINGDOMS[i].examples[0], nx, nodeY + 70);
        }
      }
    }

    drawClassificationCriteria();
  }

  function reset() {
    time = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    if (selectedKingdom >= 1 && selectedKingdom <= 5) {
      const k = KINGDOMS[selectedKingdom - 1];
      return `Five Kingdom Classification: Viewing ${k.name}. Cell type: ${k.cellType}. Nutrition: ${k.nutrition}. Examples: ${k.examples.join(", ")}. Characteristics: ${k.characteristics.join(", ")}.`;
    }
    return `Five Kingdom Classification overview: Monera (prokaryotes), Protista (unicellular eukaryotes), Fungi (saprophytes), Plantae (photosynthetic), Animalia (heterotrophs). Select a kingdom (1-5) to see details.`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FiveKingdomFactory;
