import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const AreaOfLungFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("area-of-lung") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let branchDepth = 5;
  let unfoldAmount = 0;
  let alveoliSize = 4;

  // Precomputed branch tree
  interface Branch {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    depth: number;
    angle: number;
    length: number;
    isTerminal: boolean;
  }

  let branches: Branch[] = [];
  let totalAlveoli = 0;
  let totalSurfaceArea = 0;
  let lastBuildKey = "";

  // Breathing animation state
  let breathPhase = 0;

  // Real lung data constants
  // Human lungs: ~23 generations of branching
  // Total surface area: ~70 m^2
  // Each alveolus: ~0.2mm diameter, ~200 um
  // Total alveoli: ~480 million
  const REAL_ALVEOLI_COUNT = 480e6;
  const REAL_SURFACE_AREA = 70; // m^2
  const TENNIS_COURT_AREA = 260.87; // m^2

  function buildTree(
    x: number,
    y: number,
    angle: number,
    length: number,
    depth: number,
    maxDepth: number,
    spread: number
  ): void {
    if (depth > maxDepth) return;

    const x2 = x + Math.cos(angle) * length;
    const y2 = y + Math.sin(angle) * length;
    const isTerminal = depth === maxDepth;

    branches.push({ x1: x, y1: y, x2, y2, depth, angle, length, isTerminal });

    if (!isTerminal) {
      const nextLength = length * 0.7;
      const spreadAngle = 0.4 + spread * 0.3; // Branch spread angle in radians

      // Left branch
      buildTree(x2, y2, angle - spreadAngle, nextLength, depth + 1, maxDepth, spread);
      // Right branch
      buildTree(x2, y2, angle + spreadAngle, nextLength, depth + 1, maxDepth, spread);
    }
  }

  function rebuildTree(): void {
    const buildKey = `${branchDepth}|${unfoldAmount}|${width}|${height}`;
    if (buildKey === lastBuildKey) return;
    lastBuildKey = buildKey;

    branches = [];
    const spread = unfoldAmount / 100;

    // Start from bottom center, growing upward
    const startX = width * 0.5;
    const startY = height * 0.85;
    const initialLength = Math.min(width, height) * 0.18;
    const startAngle = -Math.PI / 2; // pointing up

    buildTree(startX, startY, startAngle, initialLength, 0, branchDepth, spread);

    // Count terminal branches (alveoli)
    totalAlveoli = branches.filter((b) => b.isTerminal).length;

    // Calculate simulated surface area
    // Each alveolus contributes surface area proportional to its size
    // Scale to real units: at max depth 8 with default size, approximate real values
    const alveolusArea = 4 * Math.PI * (alveoliSize * 0.0001) ** 2; // m^2 per alveolus (scaled)
    // Scale factor to make the simulation representative
    const scaleFactor = REAL_SURFACE_AREA / (Math.pow(2, 8) * alveolusArea * 1e6);
    totalSurfaceArea = totalAlveoli * alveolusArea * scaleFactor;

    // Simpler approach: map branchDepth to approximate real surface area
    // At depth 8 (max): ~70 m^2; at depth 1: ~0.27 m^2
    totalSurfaceArea = REAL_SURFACE_AREA * (Math.pow(2, branchDepth) / Math.pow(2, 8));
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    breathPhase = 0;
    lastBuildKey = "";
    branches = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    branchDepth = Math.round(params.branchDepth ?? 5);
    unfoldAmount = params.unfoldAmount ?? 0;
    alveoliSize = params.alveoliSize ?? 4;

    time += dt;
    breathPhase = Math.sin(time * 1.2) * 0.5 + 0.5; // 0 to 1 breathing cycle

    rebuildTree();
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw body cavity outline (subtle lung shape)
    drawLungOutline();

    // Draw bronchial tree
    drawBranches();

    // Draw alveoli at terminal branches
    drawAlveoli();

    // Draw info panel
    drawInfoPanel();

    // Draw title
    drawTitle();

    // Time display
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function drawLungOutline(): void {
    const cx = width * 0.5;
    const topY = height * 0.12;
    const bottomY = height * 0.88;
    const lungWidth = width * 0.35;

    // Subtle lung silhouette
    ctx.save();
    ctx.globalAlpha = 0.08;

    // Left lung
    ctx.beginPath();
    ctx.moveTo(cx - 10, topY + 30);
    ctx.quadraticCurveTo(cx - lungWidth, topY + 20, cx - lungWidth * 0.9, bottomY * 0.5);
    ctx.quadraticCurveTo(cx - lungWidth * 0.8, bottomY * 0.85, cx - 15, bottomY * 0.75);
    ctx.closePath();
    const leftGrad = ctx.createRadialGradient(cx - lungWidth * 0.4, height * 0.45, 10, cx - lungWidth * 0.4, height * 0.45, lungWidth);
    leftGrad.addColorStop(0, "#ff6688");
    leftGrad.addColorStop(1, "transparent");
    ctx.fillStyle = leftGrad;
    ctx.fill();

    // Right lung
    ctx.beginPath();
    ctx.moveTo(cx + 10, topY + 30);
    ctx.quadraticCurveTo(cx + lungWidth, topY + 20, cx + lungWidth * 0.9, bottomY * 0.5);
    ctx.quadraticCurveTo(cx + lungWidth * 0.8, bottomY * 0.85, cx + 15, bottomY * 0.75);
    ctx.closePath();
    const rightGrad = ctx.createRadialGradient(cx + lungWidth * 0.4, height * 0.45, 10, cx + lungWidth * 0.4, height * 0.45, lungWidth);
    rightGrad.addColorStop(0, "#ff6688");
    rightGrad.addColorStop(1, "transparent");
    ctx.fillStyle = rightGrad;
    ctx.fill();

    ctx.restore();
  }

  function drawBranches(): void {
    for (const branch of branches) {
      if (branch.isTerminal) continue; // terminals drawn as alveoli

      const depthRatio = branch.depth / branchDepth;

      // Branch thickness decreases with depth
      const thickness = Math.max(1, 6 - branch.depth * 0.7);

      // Color: transitions from brownish trachea to pink bronchioles
      const r = Math.round(180 + depthRatio * 60);
      const g = Math.round(100 + depthRatio * 40);
      const b = Math.round(110 + depthRatio * 50);
      const alpha = 0.6 + (1 - depthRatio) * 0.4;

      // Breathing animation: slight expansion/contraction
      const breathScale = 1 + breathPhase * 0.02 * (1 + depthRatio);
      const midX = (branch.x1 + branch.x2) / 2;
      const midY = (branch.y1 + branch.y2) / 2;

      const x1 = midX + (branch.x1 - midX) * breathScale;
      const y1 = midY + (branch.y1 - midY) * breathScale;
      const x2 = midX + (branch.x2 - midX) * breathScale;
      const y2 = midY + (branch.y2 - midY) * breathScale;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.stroke();

      // Inner highlight for thicker branches
      if (thickness > 2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(255, 200, 200, ${alpha * 0.2})`;
        ctx.lineWidth = thickness * 0.4;
        ctx.stroke();
      }
    }
  }

  function drawAlveoli(): void {
    const terminalBranches = branches.filter((b) => b.isTerminal);

    for (const branch of terminalBranches) {
      const breathScale = 1 + breathPhase * 0.05;
      const x = branch.x2;
      const y = branch.y2;
      const size = alveoliSize * breathScale;

      // Cluster of small circles around the endpoint
      const numInCluster = 3 + Math.floor(alveoliSize / 2);
      for (let i = 0; i < numInCluster; i++) {
        const angle = (i / numInCluster) * Math.PI * 2 + branch.angle;
        const dist = size * 1.2;
        const ax = x + Math.cos(angle) * dist;
        const ay = y + Math.sin(angle) * dist;
        const aRadius = size * (0.6 + Math.sin(time * 2 + i) * 0.1);

        // Alveolus glow
        const glow = ctx.createRadialGradient(ax, ay, 0, ax, ay, aRadius * 2.5);
        glow.addColorStop(0, "rgba(255, 120, 150, 0.3)");
        glow.addColorStop(1, "rgba(255, 80, 120, 0)");
        ctx.beginPath();
        ctx.arc(ax, ay, aRadius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Alveolus body
        const alvGrad = ctx.createRadialGradient(
          ax - aRadius * 0.3,
          ay - aRadius * 0.3,
          0,
          ax,
          ay,
          aRadius
        );
        alvGrad.addColorStop(0, "rgba(255, 180, 190, 0.9)");
        alvGrad.addColorStop(0.5, "rgba(230, 100, 130, 0.8)");
        alvGrad.addColorStop(1, "rgba(180, 60, 90, 0.6)");

        ctx.beginPath();
        ctx.arc(ax, ay, aRadius, 0, Math.PI * 2);
        ctx.fillStyle = alvGrad;
        ctx.fill();
        ctx.strokeStyle = "rgba(200, 100, 130, 0.4)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Central connection dot
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200, 100, 120, 0.8)";
      ctx.fill();
    }
  }

  function drawInfoPanel(): void {
    const panelX = width * 0.03;
    const panelY = height * 0.02;
    const panelW = width * 0.26;
    const panelH = height * 0.36;

    // Semi-transparent panel on the left
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 120, 150, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const lineHeight = 18;
    let y = panelY + 22;
    const x = panelX + 12;

    ctx.textAlign = "left";

    // Title
    ctx.fillStyle = "rgba(255, 180, 190, 0.95)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("Lung Surface Area", x, y);
    y += lineHeight + 4;

    // Branch info
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "11px 'SF Mono', 'Fira Code', monospace";
    ctx.fillText(`Branch depth: ${branchDepth}`, x, y);
    y += lineHeight;

    ctx.fillText(`Branches: ${branches.length}`, x, y);
    y += lineHeight;

    ctx.fillText(`Terminal nodes: ${totalAlveoli}`, x, y);
    y += lineHeight;

    ctx.fillText(`Alveoli size: ${alveoliSize}`, x, y);
    y += lineHeight + 6;

    // Surface area
    ctx.fillStyle = "rgba(255, 200, 100, 0.95)";
    ctx.font = "bold 12px 'SF Mono', 'Fira Code', monospace";
    ctx.fillText(`Total area: ${totalSurfaceArea.toFixed(1)} m\u00B2`, x, y);
    y += lineHeight;

    // Comparisons
    ctx.fillStyle = "rgba(100, 255, 200, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    const courtFraction = totalSurfaceArea / TENNIS_COURT_AREA;
    ctx.fillText(`Tennis court: ${TENNIS_COURT_AREA} m\u00B2`, x, y);
    y += lineHeight;
    ctx.fillText(`= ${(courtFraction * 100).toFixed(1)}% of a court`, x, y);
    y += lineHeight;

    // Full lung fact
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "italic 10px system-ui, sans-serif";
    ctx.fillText(`Real lungs: ~70 m\u00B2 (23 gen.)`, x, y);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Lung Alveoli: Maximizing Surface Area", width * 0.63, height * 0.05);

    ctx.fillStyle = "rgba(255, 180, 200, 0.65)";
    ctx.font = "italic 12px system-ui, sans-serif";
    ctx.fillText(
      "Branching structure packs ~70 m\u00B2 of surface into your chest",
      width * 0.63,
      height * 0.05 + 20
    );

    // Breathing indicator
    const breathLabel = breathPhase > 0.5 ? "Inhaling..." : "Exhaling...";
    const breathAlpha = 0.3 + Math.abs(breathPhase - 0.5) * 0.6;
    ctx.fillStyle = `rgba(100, 200, 255, ${breathAlpha})`;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(breathLabel, width - 15, height * 0.05);

    // Formula annotation
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `Branches = 2^depth = 2^${branchDepth} = ${Math.pow(2, branchDepth)} terminal nodes`,
      width * 0.63,
      height * 0.05 + 38
    );
  }

  function reset(): void {
    time = 0;
    breathPhase = 0;
    lastBuildKey = "";
    branches = [];
  }

  function destroy(): void {
    branches = [];
  }

  function getStateDescription(): string {
    return (
      `Lung Alveoli Surface Area Simulation. ` +
      `Branch depth: ${branchDepth} generations (each branch splits into 2). ` +
      `Total branches: ${branches.length}, terminal nodes (alveoli sites): ${totalAlveoli}. ` +
      `Alveoli size: ${alveoliSize}. Unfold amount: ${unfoldAmount}%. ` +
      `Estimated total surface area: ${totalSurfaceArea.toFixed(1)} m\u00B2. ` +
      `Real human lungs have ~480 million alveoli with ~70 m\u00B2 total surface area ` +
      `(about 27% of a tennis court at ${TENNIS_COURT_AREA} m\u00B2). ` +
      `The branching fractal-like structure allows enormous surface area to fit inside the chest cavity. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    lastBuildKey = ""; // force rebuild
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default AreaOfLungFactory;
