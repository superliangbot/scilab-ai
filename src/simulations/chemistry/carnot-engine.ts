import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Factory ────────────────────────────────────────────────────────
const CarnotEngineFactory: SimulationFactory = () => {
  const config = getSimConfig("carnot-engine") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let hotTemp = 600; // K
  let coldTemp = 300; // K
  let speed = 1;
  let gamma = 1.4; // heat capacity ratio (Cp/Cv)

  // Cycle state
  let cyclePhase = 0; // 0..4 continuous (0-1: iso expansion, 1-2: adi expansion, 2-3: iso compression, 3-4: adi compression)
  let cycleCount = 0;

  // n moles of ideal gas, R = 8.314
  const n = 1; // 1 mol
  const R = 8.314;

  // Carnot cycle computed points (P, V) at each corner
  // State A: start of isothermal expansion (hot, min volume)
  // State B: end of isothermal expansion (hot, larger volume)
  // State C: end of adiabatic expansion (cold, max volume)
  // State D: start of adiabatic compression (cold, smaller volume)

  // We choose VA as our reference volume
  const VA = 1.0; // m^3 (arbitrary for visualization)
  let VB = 2.0;
  let VC = 4.0;
  let VD = 2.0;
  let PA = 0, PB = 0, PC = 0, PD = 0;

  // PV curve points for drawing
  let pvCurvePoints: Array<{ P: number; V: number; phase: number }> = [];

  function computeCyclePoints() {
    // State A: (VA, PA) on hot isotherm
    PA = (n * R * hotTemp) / VA;

    // State B: isothermal expansion at hotTemp
    // Choose VB = 2 * VA (expansion ratio)
    VB = 2.0 * VA;
    PB = (n * R * hotTemp) / VB;

    // State B -> C: adiabatic expansion (PV^gamma = const)
    // T_B * V_B^(gamma-1) = T_C * V_C^(gamma-1)
    // V_C = V_B * (T_hot / T_cold)^(1/(gamma-1))
    VC = VB * Math.pow(hotTemp / coldTemp, 1 / (gamma - 1));
    PC = (n * R * coldTemp) / VC;

    // State D: on cold isotherm, adiabatic to A
    // T_A * V_A^(gamma-1) = T_D * V_D^(gamma-1)
    // V_D = V_A * (T_hot / T_cold)^(1/(gamma-1))
    VD = VA * Math.pow(hotTemp / coldTemp, 1 / (gamma - 1));
    PD = (n * R * coldTemp) / VD;

    // Build PV curve points
    pvCurvePoints = [];
    const steps = 60;

    // Phase 0: Isothermal expansion A -> B (hot)
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
      // PV^gamma = PB * VB^gamma
      const P = PB * Math.pow(VB / V, gamma);
      pvCurvePoints.push({ P, V, phase: 1 });
    }

    // Phase 2: Isothermal compression C -> D (cold)
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
      // PV^gamma = PD * VD^gamma
      const P = PD * Math.pow(VD / V, gamma);
      pvCurvePoints.push({ P, V, phase: 3 });
    }
  }

  // Get current P, V at cycle phase
  function getCurrentPV(): { P: number; V: number; T: number } {
    const phase = Math.floor(cyclePhase) % 4;
    const t = cyclePhase - Math.floor(cyclePhase);

    let V: number, P: number, T: number;

    switch (phase) {
      case 0: // Isothermal expansion A -> B
        V = VA + t * (VB - VA);
        P = (n * R * hotTemp) / V;
        T = hotTemp;
        break;
      case 1: // Adiabatic expansion B -> C
        V = VB + t * (VC - VB);
        P = PB * Math.pow(VB / V, gamma);
        T = hotTemp * Math.pow(VB / V, gamma - 1);
        break;
      case 2: // Isothermal compression C -> D
        V = VC + t * (VD - VC);
        P = (n * R * coldTemp) / V;
        T = coldTemp;
        break;
      case 3: // Adiabatic compression D -> A
        V = VD + t * (VA - VD);
        P = PD * Math.pow(VD / V, gamma);
        T = coldTemp * Math.pow(VD / V, gamma - 1);
        break;
      default:
        V = VA;
        P = PA;
        T = hotTemp;
    }

    return { P, V, T };
  }

  function phaseLabel(phase: number): string {
    switch (phase % 4) {
      case 0: return "Isothermal Expansion (absorbing heat from hot reservoir)";
      case 1: return "Adiabatic Expansion (no heat exchange, gas cools)";
      case 2: return "Isothermal Compression (releasing heat to cold reservoir)";
      case 3: return "Adiabatic Compression (no heat exchange, gas heats)";
      default: return "";
    }
  }

  function phaseColor(phase: number): string {
    switch (phase % 4) {
      case 0: return "#ef4444"; // hot red
      case 1: return "#f97316"; // orange
      case 2: return "#3b82f6"; // cold blue
      case 3: return "#8b5cf6"; // purple
      default: return "#fff";
    }
  }

  // PV diagram bounds
  function pvBounds() {
    const left = W * 0.52;
    const right = W - 25;
    const top = 55;
    const bottom = H - 140;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  // Piston drawing bounds
  function pistonBounds() {
    return { left: 30, right: W * 0.46, top: 55, bottom: H - 140 };
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
      const newGamma = params.gamma ?? gamma;
      speed = params.speed ?? speed;

      if (newHot !== hotTemp || newCold !== coldTemp || newGamma !== gamma) {
        hotTemp = newHot;
        coldTemp = Math.min(newCold, hotTemp - 1); // ensure cold < hot
        gamma = newGamma;
        computeCyclePoints();
      }

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      // Advance cycle phase
      cyclePhase += dtClamped * speed * 0.5;
      if (cyclePhase >= 4) {
        cyclePhase -= 4;
        cycleCount++;
      }
    },

    render() {
      if (!ctx) return;

      // ── Background ──────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Carnot Engine Cycle", W / 2, 28);

      const efficiency = 1 - coldTemp / hotTemp;
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        `\u03B7 = 1 - T_cold/T_hot = 1 - ${coldTemp}/${hotTemp} = ${(efficiency * 100).toFixed(1)}%  |  \u03B3 = ${gamma.toFixed(2)}`,
        W / 2,
        46
      );

      const currentPV = getCurrentPV();
      const currentPhase = Math.floor(cyclePhase) % 4;
      const pb = pistonBounds();
      const pv = pvBounds();

      // ── Piston / Cylinder visualization ─────────────
      const cylLeft = pb.left + 30;
      const cylRight = pb.right - 30;
      const cylTop = pb.top + 20;
      const cylBottom = pb.bottom - 10;
      const cylWidth = cylRight - cylLeft;
      const cylHeight = cylBottom - cylTop;

      // Piston position depends on current volume
      const vMin = Math.min(VA, VD) * 0.8;
      const vMax = Math.max(VB, VC) * 1.1;
      const volFrac = (currentPV.V - vMin) / (vMax - vMin);
      const pistonY = cylTop + (1 - volFrac) * (cylHeight * 0.7);

      // Cylinder walls
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cylLeft, cylTop);
      ctx.lineTo(cylLeft, cylBottom);
      ctx.lineTo(cylRight, cylBottom);
      ctx.lineTo(cylRight, cylTop);
      ctx.stroke();

      // Gas region (between piston and bottom)
      const tempFrac = (currentPV.T - coldTemp) / Math.max(hotTemp - coldTemp, 1);
      const gasR = Math.round(30 + 60 * tempFrac);
      const gasG = Math.round(20 + 10 * tempFrac);
      const gasB = Math.round(60 - 30 * tempFrac);
      const gasGrad = ctx.createLinearGradient(0, pistonY, 0, cylBottom);
      gasGrad.addColorStop(0, `rgba(${gasR + 20}, ${gasG + 10}, ${gasB + 20}, 0.6)`);
      gasGrad.addColorStop(1, `rgba(${gasR}, ${gasG}, ${gasB}, 0.4)`);
      ctx.fillStyle = gasGrad;
      ctx.fillRect(cylLeft + 1, pistonY, cylWidth - 2, cylBottom - pistonY - 1);

      // Animated gas molecules
      const numMolecules = 15;
      const moleculeSpeed = Math.sqrt(currentPV.T / 300) * 2;
      for (let i = 0; i < numMolecules; i++) {
        const phase = time * moleculeSpeed * (1 + i * 0.1) + i * 2.5;
        const mx = cylLeft + 8 + ((Math.sin(phase * 1.3 + i) * 0.5 + 0.5) * (cylWidth - 16));
        const my = pistonY + 8 + ((Math.cos(phase * 0.9 + i * 0.7) * 0.5 + 0.5) * (cylBottom - pistonY - 16));

        ctx.beginPath();
        ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
        const mColor = `rgba(${150 + Math.round(105 * tempFrac)}, ${100 + Math.round(100 * (1 - tempFrac))}, ${200 - Math.round(150 * tempFrac)}, 0.8)`;
        ctx.fillStyle = mColor;
        ctx.fill();
      }

      // Piston head
      const pistonHeadH = 14;
      const pistonGrad = ctx.createLinearGradient(0, pistonY - pistonHeadH, 0, pistonY);
      pistonGrad.addColorStop(0, "#475569");
      pistonGrad.addColorStop(0.5, "#94a3b8");
      pistonGrad.addColorStop(1, "#64748b");
      ctx.fillStyle = pistonGrad;
      ctx.fillRect(cylLeft, pistonY - pistonHeadH, cylWidth, pistonHeadH);

      // Piston rod
      const rodCx = (cylLeft + cylRight) / 2;
      ctx.fillStyle = "#64748b";
      ctx.fillRect(rodCx - 4, pistonY - pistonHeadH - 30, 8, 30);

      // Heat reservoirs
      // Hot reservoir (top, when phase 0 or 3 involves hot)
      const hotActive = currentPhase === 0;
      const coldActive = currentPhase === 2;

      // Hot reservoir box
      const hotBoxY = cylBottom + 8;
      ctx.fillStyle = hotActive ? "#ef444480" : "#ef444430";
      ctx.fillRect(cylLeft, hotBoxY, cylWidth / 2 - 5, 30);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = hotActive ? 2 : 1;
      ctx.strokeRect(cylLeft, hotBoxY, cylWidth / 2 - 5, 30);

      ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText(`HOT: ${hotTemp} K`, cylLeft + cylWidth / 4 - 2, hotBoxY + 18);

      // Cold reservoir box
      ctx.fillStyle = coldActive ? "#3b82f680" : "#3b82f630";
      ctx.fillRect(cylLeft + cylWidth / 2 + 5, hotBoxY, cylWidth / 2 - 5, 30);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = coldActive ? 2 : 1;
      ctx.strokeRect(cylLeft + cylWidth / 2 + 5, hotBoxY, cylWidth / 2 - 5, 30);

      ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "center";
      ctx.fillText(`COLD: ${coldTemp} K`, cylLeft + (3 * cylWidth) / 4 + 3, hotBoxY + 18);

      // Heat flow arrows
      if (hotActive) {
        const arrowY = hotBoxY - 2;
        ctx.beginPath();
        ctx.moveTo(cylLeft + cylWidth / 4, hotBoxY);
        ctx.lineTo(cylLeft + cylWidth / 4, arrowY - 8);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ef4444";
        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Q_H \u2191", cylLeft + cylWidth / 4 - 20, arrowY - 2);
      }
      if (coldActive) {
        const arrowY = hotBoxY - 2;
        ctx.beginPath();
        ctx.moveTo(cylLeft + (3 * cylWidth) / 4, arrowY - 8);
        ctx.lineTo(cylLeft + (3 * cylWidth) / 4, hotBoxY);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#3b82f6";
        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Q_C \u2193", cylLeft + (3 * cylWidth) / 4 + 22, arrowY - 2);
      }

      // Phase label
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = phaseColor(currentPhase);
      ctx.textAlign = "center";
      ctx.fillText(phaseLabel(currentPhase), (pb.left + pb.right) / 2, pb.top + 8);

      // ── PV Diagram ──────────────────────────────────
      ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
      ctx.fillRect(pv.left, pv.top, pv.width, pv.height);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(pv.left, pv.top, pv.width, pv.height);

      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      ctx.fillText("PV Diagram", (pv.left + pv.right) / 2, pv.top - 8);

      // Axis labels
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Volume (V)", (pv.left + pv.right) / 2, pv.bottom + 16);

      ctx.save();
      ctx.translate(pv.left - 12, (pv.top + pv.bottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Pressure (P)", 0, 0);
      ctx.restore();

      // PV range
      const allP = pvCurvePoints.map((p) => p.P);
      const allV = pvCurvePoints.map((p) => p.V);
      const Pmin = Math.min(...allP) * 0.85;
      const Pmax = Math.max(...allP) * 1.1;
      const Vmin = Math.min(...allV) * 0.85;
      const Vmax = Math.max(...allV) * 1.1;

      function toScreenX(V: number): number {
        return pv.left + ((V - Vmin) / (Vmax - Vmin)) * pv.width;
      }
      function toScreenY(P: number): number {
        return pv.bottom - ((P - Pmin) / (Pmax - Pmin)) * pv.height;
      }

      // Draw the four curves with phase colors
      // Fill the enclosed area first (work done)
      ctx.beginPath();
      for (let i = 0; i < pvCurvePoints.length; i++) {
        const pt = pvCurvePoints[i];
        const sx = toScreenX(pt.V);
        const sy = toScreenY(pt.P);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(139, 92, 246, 0.15)";
      ctx.fill();

      // Draw curves by phase
      for (let phase = 0; phase < 4; phase++) {
        ctx.beginPath();
        ctx.strokeStyle = phaseColor(phase);
        ctx.lineWidth = 2;
        let started = false;

        for (const pt of pvCurvePoints) {
          if (pt.phase === phase) {
            const sx = toScreenX(pt.V);
            const sy = toScreenY(pt.P);
            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
        }
        ctx.stroke();
      }

      // Close the cycle (phase 3 back to phase 0 start)
      ctx.beginPath();
      const lastPt = pvCurvePoints[pvCurvePoints.length - 1];
      const firstPt = pvCurvePoints[0];
      ctx.moveTo(toScreenX(lastPt.V), toScreenY(lastPt.P));
      ctx.lineTo(toScreenX(firstPt.V), toScreenY(firstPt.P));
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
        const sx = toScreenX(c.V);
        const sy = toScreenY(c.P);
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#e2e8f0";
        ctx.fill();

        ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.fillText(c.label, sx, sy - 8);
      }

      // Current position on PV diagram
      {
        const sx = toScreenX(currentPV.V);
        const sy = toScreenY(currentPV.P);

        // Glow
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
        glow.addColorStop(0, phaseColor(currentPhase) + "80");
        glow.addColorStop(1, phaseColor(currentPhase) + "00");
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, 6, 0, Math.PI * 2);
        ctx.fillStyle = phaseColor(currentPhase);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Direction arrows on curves
      const arrowPhases = [0, 1, 2, 3];
      for (const ap of arrowPhases) {
        const phasePoints = pvCurvePoints.filter((p) => p.phase === ap);
        if (phasePoints.length > 2) {
          const mid = Math.floor(phasePoints.length / 2);
          const p1 = phasePoints[mid - 1];
          const p2 = phasePoints[mid + 1];
          const sx1 = toScreenX(p1.V);
          const sy1 = toScreenY(p1.P);
          const sx2 = toScreenX(p2.V);
          const sy2 = toScreenY(p2.P);
          const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
          const mx = (sx1 + sx2) / 2;
          const my = (sy1 + sy2) / 2;

          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(-3, -4);
          ctx.lineTo(-3, 4);
          ctx.closePath();
          ctx.fillStyle = phaseColor(ap);
          ctx.fill();
          ctx.restore();
        }
      }

      // Phase legend
      const legendY = pv.bottom + 28;
      const legends = [
        { label: "A\u2192B: Isothermal exp.", color: phaseColor(0) },
        { label: "B\u2192C: Adiabatic exp.", color: phaseColor(1) },
        { label: "C\u2192D: Isothermal comp.", color: phaseColor(2) },
        { label: "D\u2192A: Adiabatic comp.", color: phaseColor(3) },
      ];

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      const legendSpacing = pv.width / 4;
      for (let i = 0; i < legends.length; i++) {
        const lx = pv.left + i * legendSpacing;

        // Color dot
        ctx.beginPath();
        ctx.arc(lx + 5, legendY - 3, 4, 0, Math.PI * 2);
        ctx.fillStyle = legends[i].color;
        ctx.fill();

        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "left";
        ctx.fillText(legends[i].label, lx + 12, legendY);
      }

      // ── Data panel ──────────────────────────────────
      const dpY = H - 105;
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#ef4444";
      ctx.fillText(`T_hot = ${hotTemp} K`, 20, dpY);

      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`T_cold = ${coldTemp} K`, 20, dpY + 18);

      ctx.fillStyle = "#34d399";
      ctx.fillText(`Carnot efficiency \u03B7 = ${(efficiency * 100).toFixed(1)}%`, 20, dpY + 36);

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Current: P = ${currentPV.P.toFixed(0)} Pa, V = ${currentPV.V.toFixed(3)} m\u00B3`, 20, dpY + 54);

      ctx.fillStyle = "#c084fc";
      ctx.fillText(`T = ${currentPV.T.toFixed(0)} K  |  \u03B3 = ${gamma.toFixed(2)}  |  Cycle #${cycleCount}`, 20, dpY + 72);

      // Work done
      const QH = n * R * hotTemp * Math.log(VB / VA);
      const QC = n * R * coldTemp * Math.log(VC / VD);
      const Wnet = QH - Math.abs(QC);

      ctx.fillStyle = "#f472b6";
      ctx.fillText(`Q_H = ${QH.toFixed(0)} J  |  Q_C = ${Math.abs(QC).toFixed(0)} J  |  W_net = ${Wnet.toFixed(0)} J`, 350, dpY);

      ctx.fillStyle = "#64748b";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillText(
        "Work = area enclosed in PV diagram  |  Most efficient heat engine between two temperatures",
        350,
        dpY + 18
      );

      // Formulas
      ctx.fillStyle = "#475569";
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillText("Isothermal: PV = nRT = const  |  Adiabatic: PV\u1D5E = const", 350, dpY + 36);

      // Time
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 6);
    },

    reset() {
      hotTemp = config.parameters.find((p) => p.key === "hotTemp")!.defaultValue;
      coldTemp = config.parameters.find((p) => p.key === "coldTemp")!.defaultValue;
      speed = config.parameters.find((p) => p.key === "speed")!.defaultValue;
      gamma = config.parameters.find((p) => p.key === "gamma")!.defaultValue;
      computeCyclePoints();
      cyclePhase = 0;
      cycleCount = 0;
      time = 0;
    },

    destroy() {
      pvCurvePoints = [];
    },

    getStateDescription(): string {
      const efficiency = 1 - coldTemp / hotTemp;
      const currentPV = getCurrentPV();
      const currentPhase = Math.floor(cyclePhase) % 4;
      const QH = n * R * hotTemp * Math.log(VB / VA);
      const QC = n * R * coldTemp * Math.log(VC / VD);
      const Wnet = QH - Math.abs(QC);

      return (
        `Carnot Engine simulation: T_hot=${hotTemp} K, T_cold=${coldTemp} K, \u03B3=${gamma.toFixed(2)}. ` +
        `Carnot efficiency \u03B7 = 1 - T_cold/T_hot = ${(efficiency * 100).toFixed(1)}%. ` +
        `Currently in phase: ${phaseLabel(currentPhase)}. ` +
        `Current state: P=${currentPV.P.toFixed(0)} Pa, V=${currentPV.V.toFixed(3)} m\u00B3, T=${currentPV.T.toFixed(0)} K. ` +
        `Q_H = ${QH.toFixed(0)} J, Q_C = ${Math.abs(QC).toFixed(0)} J, W_net = ${Wnet.toFixed(0)} J. ` +
        `Cycle count: ${cycleCount}. ` +
        `The Carnot cycle is the most efficient possible heat engine operating between two temperatures.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default CarnotEngineFactory;
