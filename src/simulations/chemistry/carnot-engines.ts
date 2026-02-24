import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Factory ────────────────────────────────────────────────────────
const CarnotEnginesFactory: SimulationFactory = () => {
  const config = getSimConfig("carnot-engines") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let hotTemp = 600; // K
  let coldTemp = 300; // K
  let realEfficiency = 40; // % for real engine
  let speed = 1;

  // Carnot cycle state
  let cyclePhase = 0; // 0..4 continuous
  let cycleCount = 0;

  // Thermodynamic constants
  const n = 1; // mol
  const R = 8.314;
  const gamma = 1.4;

  // PV diagram state points
  const VA = 1.0;
  let VB = 2.0;
  let VC = 4.0;
  let VD = 2.0;
  let PA = 0, PB = 0, PC = 0, PD = 0;
  let pvCurvePoints: Array<{ P: number; V: number; phase: number }> = [];

  function computeCyclePoints() {
    PA = (n * R * hotTemp) / VA;
    VB = 2.0 * VA;
    PB = (n * R * hotTemp) / VB;
    VC = VB * Math.pow(hotTemp / coldTemp, 1 / (gamma - 1));
    PC = (n * R * coldTemp) / VC;
    VD = VA * Math.pow(hotTemp / coldTemp, 1 / (gamma - 1));
    PD = (n * R * coldTemp) / VD;

    pvCurvePoints = [];
    const steps = 50;

    // Phase 0: Isothermal expansion A -> B
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const V = VA + t * (VB - VA);
      const P = (n * R * hotTemp) / V;
      pvCurvePoints.push({ P, V, phase: 0 });
    }
    // Phase 1: Adiabatic expansion B -> C
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const V = VB + t * (VC - VB);
      const P = PB * Math.pow(VB / V, gamma);
      pvCurvePoints.push({ P, V, phase: 1 });
    }
    // Phase 2: Isothermal compression C -> D
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const V = VC + t * (VD - VC);
      const P = (n * R * coldTemp) / V;
      pvCurvePoints.push({ P, V, phase: 2 });
    }
    // Phase 3: Adiabatic compression D -> A
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const V = VD + t * (VA - VD);
      const P = PD * Math.pow(VD / V, gamma);
      pvCurvePoints.push({ P, V, phase: 3 });
    }
  }

  function getCurrentPV(): { P: number; V: number; T: number } {
    const phase = Math.floor(cyclePhase) % 4;
    const t = cyclePhase - Math.floor(cyclePhase);
    let V: number, P: number, T: number;

    switch (phase) {
      case 0:
        V = VA + t * (VB - VA);
        P = (n * R * hotTemp) / V;
        T = hotTemp;
        break;
      case 1:
        V = VB + t * (VC - VB);
        P = PB * Math.pow(VB / V, gamma);
        T = hotTemp * Math.pow(VB / V, gamma - 1);
        break;
      case 2:
        V = VC + t * (VD - VC);
        P = (n * R * coldTemp) / V;
        T = coldTemp;
        break;
      case 3:
        V = VD + t * (VA - VD);
        P = PD * Math.pow(VD / V, gamma);
        T = coldTemp * Math.pow(VD / V, gamma - 1);
        break;
      default:
        V = VA; P = PA; T = hotTemp;
    }
    return { P, V, T };
  }

  function phaseColor(phase: number): string {
    switch (phase % 4) {
      case 0: return "#ef4444";
      case 1: return "#f97316";
      case 2: return "#3b82f6";
      case 3: return "#8b5cf6";
      default: return "#fff";
    }
  }

  // ── Drawing helpers ───────────────────────────────────────────────

  function drawEnergyFlowDiagram(
    x: number, y: number, w: number, h: number,
    label: string, eff: number, isIdeal: boolean
  ) {
    const QH = 100; // Normalized heat input
    const Wout = QH * eff;
    const QC = QH - Wout;

    // Title
    ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y - 8);

    // Engine box
    const boxH = h * 0.3;
    const boxY = y + h * 0.35;
    ctx.fillStyle = isIdeal ? "rgba(139, 92, 246, 0.15)" : "rgba(249, 115, 22, 0.15)";
    ctx.fillRect(x + w * 0.15, boxY, w * 0.7, boxH);
    ctx.strokeStyle = isIdeal ? "#8b5cf6" : "#f97316";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + w * 0.15, boxY, w * 0.7, boxH);

    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = isIdeal ? "#c084fc" : "#fb923c";
    ctx.textAlign = "center";
    ctx.fillText(isIdeal ? "CARNOT" : "REAL", x + w / 2, boxY + boxH / 2 + 4);

    const cx = x + w / 2;

    // QH arrow (hot reservoir -> engine)
    const qhArrowW = Math.max(4, (QH / 100) * 18);
    drawHeatArrow(cx, y + 8, cx, boxY - 2, qhArrowW, "#ef4444");
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Q_H`, cx + qhArrowW + 4, y + (boxY - y) / 2 + 4);

    // Hot reservoir box
    ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
    ctx.fillRect(x + w * 0.2, y, w * 0.6, 18);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w * 0.2, y, w * 0.6, 18);
    ctx.fillStyle = "#ef4444";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`T_H = ${hotTemp} K`, cx, y + 13);

    // Work arrow (engine -> right)
    const wArrowW = Math.max(3, (Wout / 100) * 16);
    const wArrowY = boxY + boxH / 2;
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = wArrowW;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.85 + 2, wArrowY);
    ctx.lineTo(x + w + 6, wArrowY);
    ctx.stroke();
    // Arrowhead
    ctx.fillStyle = "#34d399";
    ctx.beginPath();
    ctx.moveTo(x + w + 10, wArrowY);
    ctx.lineTo(x + w + 2, wArrowY - 5);
    ctx.lineTo(x + w + 2, wArrowY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`W = ${Wout.toFixed(1)}`, x + w + 14, wArrowY + 4);

    // QC arrow (engine -> cold reservoir)
    const qcArrowW = Math.max(3, (QC / 100) * 16);
    const coldBoxY = boxY + boxH + (h - boxY - boxH + y) * 0.55;
    drawHeatArrow(cx, boxY + boxH + 2, cx, coldBoxY - 2, qcArrowW, "#3b82f6");
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Q_C`, cx + qcArrowW + 4, boxY + boxH + (coldBoxY - boxY - boxH) / 2 + 4);

    // Cold reservoir box
    ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
    ctx.fillRect(x + w * 0.2, coldBoxY, w * 0.6, 18);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w * 0.2, coldBoxY, w * 0.6, 18);
    ctx.fillStyle = "#3b82f6";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`T_C = ${coldTemp} K`, cx, coldBoxY + 13);

    // Efficiency label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`\u03B7 = ${(eff * 100).toFixed(1)}%`, cx, coldBoxY + 36);
  }

  function drawHeatArrow(x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (0.8 + 0.4 * pulse);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // Arrowhead
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 5, y2 - 8);
    ctx.lineTo(x2 + 5, y2 - 8);
    ctx.closePath();
    ctx.fill();
  }

  function drawEfficiencyBars(x: number, y: number, w: number, h: number) {
    const carnotEff = 1 - coldTemp / hotTemp;
    const realEff = realEfficiency / 100;

    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Efficiency Comparison", x + w / 2, y - 6);

    const barW = w * 0.25;
    const maxBarH = h - 30;
    const gap = w * 0.15;

    // Carnot bar
    const carnotH = carnotEff * maxBarH;
    const carnotX = x + w / 2 - barW - gap / 2;
    const carnotBarGrad = ctx.createLinearGradient(0, y + maxBarH - carnotH, 0, y + maxBarH);
    carnotBarGrad.addColorStop(0, "#8b5cf6");
    carnotBarGrad.addColorStop(1, "#6d28d9");
    ctx.fillStyle = carnotBarGrad;
    ctx.fillRect(carnotX, y + maxBarH - carnotH, barW, carnotH);
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 1;
    ctx.strokeRect(carnotX, y + maxBarH - carnotH, barW, carnotH);

    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${(carnotEff * 100).toFixed(1)}%`, carnotX + barW / 2, y + maxBarH - carnotH - 8);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillText("Carnot", carnotX + barW / 2, y + maxBarH + 14);

    // Real bar
    const realH = realEff * maxBarH;
    const realX = x + w / 2 + gap / 2;
    const realBarGrad = ctx.createLinearGradient(0, y + maxBarH - realH, 0, y + maxBarH);
    realBarGrad.addColorStop(0, "#f97316");
    realBarGrad.addColorStop(1, "#c2410c");
    ctx.fillStyle = realBarGrad;
    ctx.fillRect(realX, y + maxBarH - realH, barW, realH);
    ctx.strokeStyle = "#fb923c";
    ctx.lineWidth = 1;
    ctx.strokeRect(realX, y + maxBarH - realH, barW, realH);

    ctx.fillStyle = "#fb923c";
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${(realEff * 100).toFixed(1)}%`, realX + barW / 2, y + maxBarH - realH - 8);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillText("Real", realX + barW / 2, y + maxBarH + 14);

    // Base line
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + maxBarH);
    ctx.lineTo(x + w, y + maxBarH);
    ctx.stroke();

    // Warning if real > carnot
    if (realEff > carnotEff) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Real > Carnot: impossible!", x + w / 2, y + maxBarH + 28);
    }
  }

  function drawPVDiagram(x: number, y: number, w: number, h: number) {
    // Background
    ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText("Carnot PV Diagram", x + w / 2, y - 6);

    // Axis labels
    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("V", x + w / 2, y + h + 12);

    ctx.save();
    ctx.translate(x - 8, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("P", 0, 0);
    ctx.restore();

    // PV range
    const allP = pvCurvePoints.map((p) => p.P);
    const allV = pvCurvePoints.map((p) => p.V);
    const Pmin = Math.min(...allP) * 0.85;
    const Pmax = Math.max(...allP) * 1.1;
    const Vmin = Math.min(...allV) * 0.85;
    const Vmax = Math.max(...allV) * 1.1;

    function toSX(V: number): number { return x + ((V - Vmin) / (Vmax - Vmin)) * w; }
    function toSY(P: number): number { return y + h - ((P - Pmin) / (Pmax - Pmin)) * h; }

    // Fill enclosed area
    ctx.beginPath();
    for (let i = 0; i < pvCurvePoints.length; i++) {
      const pt = pvCurvePoints[i];
      if (i === 0) ctx.moveTo(toSX(pt.V), toSY(pt.P));
      else ctx.lineTo(toSX(pt.V), toSY(pt.P));
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(139, 92, 246, 0.12)";
    ctx.fill();

    // Draw curves by phase
    for (let phase = 0; phase < 4; phase++) {
      ctx.beginPath();
      ctx.strokeStyle = phaseColor(phase);
      ctx.lineWidth = 2;
      let started = false;
      for (const pt of pvCurvePoints) {
        if (pt.phase === phase) {
          const sx = toSX(pt.V);
          const sy = toSY(pt.P);
          if (!started) { ctx.moveTo(sx, sy); started = true; }
          else ctx.lineTo(sx, sy);
        }
      }
      ctx.stroke();
    }

    // Close cycle
    const last = pvCurvePoints[pvCurvePoints.length - 1];
    const first = pvCurvePoints[0];
    ctx.beginPath();
    ctx.moveTo(toSX(last.V), toSY(last.P));
    ctx.lineTo(toSX(first.V), toSY(first.P));
    ctx.strokeStyle = phaseColor(3);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Corner labels
    const corners = [
      { V: VA, P: PA, label: "A" },
      { V: VB, P: PB, label: "B" },
      { V: VC, P: PC, label: "C" },
      { V: VD, P: PD, label: "D" },
    ];
    for (const c of corners) {
      const sx = toSX(c.V);
      const sy = toSY(c.P);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(c.label, sx, sy - 6);
    }

    // Current position
    const cur = getCurrentPV();
    const curPhase = Math.floor(cyclePhase) % 4;
    const curSX = toSX(cur.V);
    const curSY = toSY(cur.P);

    const glow = ctx.createRadialGradient(curSX, curSY, 0, curSX, curSY, 10);
    glow.addColorStop(0, phaseColor(curPhase) + "80");
    glow.addColorStop(1, phaseColor(curPhase) + "00");
    ctx.beginPath();
    ctx.arc(curSX, curSY, 10, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(curSX, curSY, 4, 0, Math.PI * 2);
    ctx.fillStyle = phaseColor(curPhase);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawPiston(x: number, y: number, w: number, h: number, label: string, isIdeal: boolean) {
    const curPV = getCurrentPV();

    const vMin = Math.min(VA, VD) * 0.8;
    const vMax = Math.max(VB, VC) * 1.1;
    const volFrac = (curPV.V - vMin) / (vMax - vMin);
    const pistonY = y + (1 - volFrac) * (h * 0.7);

    // Cylinder walls
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    // Gas
    const tempFrac = (curPV.T - coldTemp) / Math.max(hotTemp - coldTemp, 1);
    const gasGrad = ctx.createLinearGradient(0, pistonY, 0, y + h);
    gasGrad.addColorStop(0, `rgba(${30 + 60 * tempFrac}, 20, ${60 - 30 * tempFrac}, 0.5)`);
    gasGrad.addColorStop(1, `rgba(${20 + 50 * tempFrac}, 15, ${40 - 20 * tempFrac}, 0.3)`);
    ctx.fillStyle = gasGrad;
    ctx.fillRect(x + 1, pistonY, w - 2, y + h - pistonY - 1);

    // Animated molecules
    const molCount = 8;
    const molSpeed = Math.sqrt(curPV.T / 300) * 2;
    for (let i = 0; i < molCount; i++) {
      const p = time * molSpeed * (1 + i * 0.1) + i * 2.5;
      const mx = x + 4 + ((Math.sin(p * 1.3 + i) * 0.5 + 0.5) * (w - 8));
      const my = pistonY + 4 + ((Math.cos(p * 0.9 + i * 0.7) * 0.5 + 0.5) * (y + h - pistonY - 8));
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${150 + 105 * tempFrac}, ${100 + 100 * (1 - tempFrac)}, ${200 - 150 * tempFrac}, 0.7)`;
      ctx.fill();
    }

    // Piston head
    const headH = 10;
    const pistonGrad = ctx.createLinearGradient(0, pistonY - headH, 0, pistonY);
    pistonGrad.addColorStop(0, "#475569");
    pistonGrad.addColorStop(0.5, "#94a3b8");
    pistonGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = pistonGrad;
    ctx.fillRect(x, pistonY - headH, w, headH);

    // Rod
    ctx.fillStyle = "#64748b";
    ctx.fillRect(x + w / 2 - 3, pistonY - headH - 20, 6, 20);

    // Label
    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = isIdeal ? "#c084fc" : "#fb923c";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y - 6);
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      computeCyclePoints();
      time = 0;
      cyclePhase = 0;
      cycleCount = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newHot = params.hotTemp ?? hotTemp;
      const newCold = params.coldTemp ?? coldTemp;
      realEfficiency = params.realEfficiency ?? realEfficiency;
      speed = params.speed ?? speed;

      if (newHot !== hotTemp || newCold !== coldTemp) {
        hotTemp = newHot;
        coldTemp = Math.min(newCold, hotTemp - 1);
        computeCyclePoints();
      }

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      cyclePhase += dtClamped * speed * 0.5;
      if (cyclePhase >= 4) {
        cyclePhase -= 4;
        cycleCount++;
      }
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Carnot Engine vs Real Engine", W / 2, 24);

      const carnotEff = 1 - coldTemp / hotTemp;
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        `Carnot \u03B7 = 1 - T_C/T_H = 1 - ${coldTemp}/${hotTemp} = ${(carnotEff * 100).toFixed(1)}%  |  No real engine can exceed Carnot efficiency`,
        W / 2, 42
      );

      // Layout: side-by-side energy flow diagrams, piston, PV diagram, efficiency bars
      const topSection = 54;
      const midH = H * 0.48;

      // Left: Carnot energy flow
      const flowW = W * 0.22;
      drawEnergyFlowDiagram(12, topSection, flowW, midH, "Ideal Carnot Engine", carnotEff, true);

      // Second: Real engine energy flow
      drawEnergyFlowDiagram(12 + flowW + 20, topSection, flowW, midH, "Real Engine", realEfficiency / 100, false);

      // Pistons side-by-side
      const pistonW = 55;
      const pistonH = midH * 0.6;
      const pistonX = 12 + 2 * flowW + 48;
      const pistonTopY = topSection + 20;
      drawPiston(pistonX, pistonTopY, pistonW, pistonH, "Carnot", true);
      drawPiston(pistonX + pistonW + 16, pistonTopY, pistonW, pistonH, "Real", false);

      // PV Diagram
      const pvX = pistonX + 2 * pistonW + 42;
      const pvW = W - pvX - 16;
      const pvH = midH * 0.75;
      drawPVDiagram(pvX, topSection + 14, pvW, pvH);

      // Efficiency comparison bars
      const barsY = topSection + midH + 8;
      const barsH = H - barsY - 100;
      drawEfficiencyBars(pvX, barsY, pvW, barsH);

      // Info panel
      const panelY = H - 90;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(12, panelY, W - 24, 80);
      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(12, panelY, W - 24, 80);

      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#ef4444";
      ctx.fillText(`T_hot = ${hotTemp} K`, 24, panelY + 16);
      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`T_cold = ${coldTemp} K`, 180, panelY + 16);

      const QH = n * R * hotTemp * Math.log(VB / VA);
      const QC = n * R * coldTemp * Math.log(VC / VD);
      const Wnet = QH - Math.abs(QC);

      ctx.fillStyle = "#c084fc";
      ctx.fillText(`Carnot: \u03B7 = ${(carnotEff * 100).toFixed(1)}%`, 24, panelY + 34);
      ctx.fillStyle = "#fb923c";
      ctx.fillText(`Real: \u03B7 = ${realEfficiency.toFixed(1)}%`, 180, panelY + 34);

      ctx.fillStyle = "#34d399";
      ctx.fillText(`Q_H = ${QH.toFixed(0)} J  |  W = ${Wnet.toFixed(0)} J  |  Q_C = ${Math.abs(QC).toFixed(0)} J`, 24, panelY + 52);

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(
        `Second Law: No engine operating between T_H and T_C can exceed \u03B7_Carnot = ${(carnotEff * 100).toFixed(1)}%`,
        24, panelY + 70
      );

      // Cycle count
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`Cycle #${cycleCount}`, W - 24, panelY + 16);

      // Time
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 4);
    },

    reset() {
      hotTemp = config.parameters.find((p) => p.key === "hotTemp")!.defaultValue;
      coldTemp = config.parameters.find((p) => p.key === "coldTemp")!.defaultValue;
      realEfficiency = config.parameters.find((p) => p.key === "realEfficiency")!.defaultValue;
      speed = config.parameters.find((p) => p.key === "speed")!.defaultValue;
      computeCyclePoints();
      cyclePhase = 0;
      cycleCount = 0;
      time = 0;
    },

    destroy() {
      pvCurvePoints = [];
    },

    getStateDescription(): string {
      const carnotEff = 1 - coldTemp / hotTemp;
      const realEff = realEfficiency / 100;
      const QH = n * R * hotTemp * Math.log(VB / VA);
      const QC = n * R * coldTemp * Math.log(VC / VD);
      const Wnet = QH - Math.abs(QC);

      return (
        `Carnot Engines comparison: T_hot=${hotTemp} K, T_cold=${coldTemp} K. ` +
        `Carnot efficiency \u03B7 = 1 - T_C/T_H = ${(carnotEff * 100).toFixed(1)}%. ` +
        `Real engine efficiency = ${realEfficiency.toFixed(1)}%. ` +
        `Q_H = ${QH.toFixed(0)} J, W_net = ${Wnet.toFixed(0)} J, Q_C = ${Math.abs(QC).toFixed(0)} J. ` +
        `The Carnot efficiency is the theoretical maximum — no real engine can exceed it ` +
        `(Second Law of Thermodynamics). ` +
        `Real engines have irreversibilities: friction, non-quasi-static processes, and heat losses. ` +
        (realEff > carnotEff
          ? "WARNING: The set real efficiency exceeds the Carnot limit, which is thermodynamically impossible."
          : `This real engine achieves ${((realEff / carnotEff) * 100).toFixed(1)}% of the Carnot limit.`)
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default CarnotEnginesFactory;
