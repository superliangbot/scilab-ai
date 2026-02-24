import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Gas particle ───────────────────────────────────────────────────
interface GasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// ─── PV data point ──────────────────────────────────────────────────
interface PVPoint {
  P: number;
  V: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const BoylesJTubeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("boyles-j-tube") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters (cached)
  let mercuryAdded = 0; // mmHg of extra mercury
  let showParticles = 1;
  let showPVGraph = 1;
  let units = 0; // 0=atm, 1=kPa, 2=mmHg

  // Physics constants
  const P_ATM = 760; // mmHg (1 atm)
  const INITIAL_GAS_HEIGHT = 120; // px: initial gas column height at 1 atm
  const TUBE_INNER_WIDTH = 36; // px
  const TUBE_WALL = 4;

  // Gas state
  let gasHeight = INITIAL_GAS_HEIGHT; // current gas column height in px
  let gasPressure = P_ATM; // mmHg

  // PV reference: at P_ATM, V = INITIAL_GAS_HEIGHT (proportional to height since uniform cross-section)
  const PV_CONSTANT = P_ATM * INITIAL_GAS_HEIGHT;

  // Gas particles
  let particles: GasParticle[] = [];
  const NUM_PARTICLES = 25;

  // PV graph data
  let pvPoints: PVPoint[] = [];
  const MAX_PV_POINTS = 60;

  // ── Helpers ───────────────────────────────────────────────────────
  function computeGasState(): void {
    // P_gas = P_atm + mercuryAdded (the added mercury creates extra pressure in mmHg)
    gasPressure = P_ATM + mercuryAdded;
    // PV = const -> V = PV_const / P
    gasHeight = PV_CONSTANT / gasPressure;
  }

  function pressureInUnits(p_mmHg: number): { value: number; unit: string } {
    if (units === 0) return { value: p_mmHg / 760, unit: "atm" };
    if (units === 1) return { value: p_mmHg * 0.133322, unit: "kPa" };
    return { value: p_mmHg, unit: "mmHg" };
  }

  function formatPressure(p_mmHg: number): string {
    const { value, unit } = pressureInUnits(p_mmHg);
    if (unit === "atm") return `${value.toFixed(3)} ${unit}`;
    if (unit === "kPa") return `${value.toFixed(1)} ${unit}`;
    return `${value.toFixed(0)} ${unit}`;
  }

  // J-tube geometry
  function tubeGeometry() {
    const centerX = W * 0.35;
    const bottomY = H * 0.78;
    const sealedArmX = centerX - 60; // left arm (sealed)
    const openArmX = centerX + 60;   // right arm (open)
    const uBendTop = bottomY;        // U-bend at the bottom (top of bend curve)
    const uBendBottom = bottomY + 40; // bottom of U-bend
    const sealedArmTop = bottomY - INITIAL_GAS_HEIGHT - 100; // top of sealed arm
    const openArmTop = bottomY - 260; // top of open arm (taller)

    return {
      sealedArmX,
      openArmX,
      uBendTop: bottomY,
      uBendBottom,
      sealedArmTop,
      openArmTop,
      centerX,
      bottomY,
    };
  }

  function spawnParticles(): void {
    particles = [];
    const geo = tubeGeometry();
    const gasTop = geo.uBendTop - gasHeight;
    const gasBottom = geo.uBendTop;
    const gasLeft = geo.sealedArmX - TUBE_INNER_WIDTH / 2;
    const gasRight = geo.sealedArmX + TUBE_INNER_WIDTH / 2;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const r = 2.5;
      particles.push({
        x: gasLeft + r + Math.random() * (gasRight - gasLeft - 2 * r),
        y: gasTop + r + Math.random() * (gasBottom - gasTop - 2 * r),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: r,
      });
    }
  }

  function updateParticles(dt: number): void {
    const geo = tubeGeometry();
    const gasTop = geo.uBendTop - gasHeight;
    const gasBottom = geo.uBendTop;
    const gasLeft = geo.sealedArmX - TUBE_INNER_WIDTH / 2;
    const gasRight = geo.sealedArmX + TUBE_INNER_WIDTH / 2;

    // Speed scales with pressure (higher pressure = more collisions = faster)
    const speedScale = Math.sqrt(gasPressure / P_ATM);

    for (const p of particles) {
      p.x += p.vx * speedScale * dt * 60;
      p.y += p.vy * speedScale * dt * 60;

      // Bounce off walls
      if (p.x - p.radius < gasLeft) {
        p.x = gasLeft + p.radius;
        p.vx = Math.abs(p.vx);
      }
      if (p.x + p.radius > gasRight) {
        p.x = gasRight - p.radius;
        p.vx = -Math.abs(p.vx);
      }
      if (p.y - p.radius < gasTop) {
        p.y = gasTop + p.radius;
        p.vy = Math.abs(p.vy);
      }
      if (p.y + p.radius > gasBottom) {
        p.y = gasBottom - p.radius;
        p.vy = -Math.abs(p.vy);
      }

      // Clamp
      p.x = Math.max(gasLeft + p.radius, Math.min(gasRight - p.radius, p.x));
      p.y = Math.max(gasTop + p.radius, Math.min(gasBottom - p.radius, p.y));
    }
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      computeGasState();
      spawnParticles();
      pvPoints = [];
    },

    update(dt: number, params: Record<string, number>) {
      const newHg = params.mercuryAdded ?? mercuryAdded;
      const newShowP = params.showParticles ?? showParticles;
      const newShowPV = params.showPVGraph ?? showPVGraph;
      const newUnits = Math.round(params.units ?? units);

      if (newHg !== mercuryAdded) {
        mercuryAdded = newHg;
        computeGasState();
        spawnParticles();
      }

      showParticles = newShowP;
      showPVGraph = newShowPV;
      units = newUnits;

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      // Update gas particles
      if (showParticles) {
        updateParticles(dtClamped);
      }

      // Record PV point
      if (
        pvPoints.length === 0 ||
        Math.abs(pvPoints[pvPoints.length - 1].P - gasPressure) > 5
      ) {
        pvPoints.push({ P: gasPressure, V: gasHeight });
        if (pvPoints.length > MAX_PV_POINTS) pvPoints.shift();
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
      ctx.fillText("Boyle's J-Tube Experiment", W / 2, 24);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "P_gas = P_atm + \u03C1gh  |  PV = constant  |  Boyle's Law (1662)",
        W / 2,
        42
      );

      const geo = tubeGeometry();
      const tw = TUBE_INNER_WIDTH;
      const wallW = TUBE_WALL;
      const halfTube = tw / 2;

      // Mercury level calculations
      // Sealed arm: mercury sits below the gas, from gas bottom to u-bend
      const sealedMercTop = geo.uBendTop; // mercury in sealed arm starts where gas ends
      // The mercury in the sealed arm pushes down to fill the U-bend
      // Open arm: mercury goes higher by mercuryAdded (scaled to pixels)
      const hgScale = 0.6; // pixels per mmHg
      const openMercHeight = 100 + mercuryAdded * hgScale; // base mercury + added
      const sealedMercHeight = 100; // base mercury height in sealed arm stays constant in visual
      // The height difference represents the pressure difference
      const heightDiffPx = mercuryAdded * hgScale;

      // ── Draw J-tube ───────────────────────────────────

      // Tube glass (outer walls)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = wallW;

      // Sealed arm (left) - has a sealed top
      const sealedTop = geo.uBendTop - INITIAL_GAS_HEIGHT - 20;
      ctx.beginPath();
      // Left wall of sealed arm
      ctx.moveTo(geo.sealedArmX - halfTube - wallW / 2, sealedTop);
      ctx.lineTo(geo.sealedArmX - halfTube - wallW / 2, geo.uBendBottom);
      ctx.stroke();
      ctx.beginPath();
      // Right wall of sealed arm
      ctx.moveTo(geo.sealedArmX + halfTube + wallW / 2, sealedTop);
      ctx.lineTo(geo.sealedArmX + halfTube + wallW / 2, geo.uBendBottom);
      ctx.stroke();
      // Sealed top cap
      ctx.beginPath();
      ctx.moveTo(geo.sealedArmX - halfTube - wallW / 2, sealedTop);
      ctx.lineTo(geo.sealedArmX + halfTube + wallW / 2, sealedTop);
      ctx.stroke();

      // "SEALED" label
      ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("SEALED", geo.sealedArmX, sealedTop - 6);

      // U-bend bottom
      ctx.beginPath();
      ctx.moveTo(geo.sealedArmX - halfTube - wallW / 2, geo.uBendBottom);
      ctx.lineTo(geo.openArmX + halfTube + wallW / 2, geo.uBendBottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(geo.sealedArmX + halfTube + wallW / 2, geo.uBendBottom);
      ctx.lineTo(geo.openArmX - halfTube - wallW / 2, geo.uBendBottom);
      // Inner bottom wall - this forms the U bottom
      ctx.stroke();

      // Inner U-bend top wall
      const innerUTop = geo.uBendBottom - tw;
      ctx.beginPath();
      ctx.moveTo(geo.sealedArmX + halfTube + wallW / 2, geo.uBendTop);
      ctx.lineTo(geo.openArmX - halfTube - wallW / 2, geo.uBendTop);
      ctx.stroke();

      // Open arm (right) - open top
      const openTop = geo.uBendTop - openMercHeight - 40;
      ctx.beginPath();
      ctx.moveTo(geo.openArmX - halfTube - wallW / 2, Math.min(openTop, geo.openArmTop));
      ctx.lineTo(geo.openArmX - halfTube - wallW / 2, geo.uBendBottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(geo.openArmX + halfTube + wallW / 2, Math.min(openTop, geo.openArmTop));
      ctx.lineTo(geo.openArmX + halfTube + wallW / 2, geo.uBendBottom);
      ctx.stroke();

      // "OPEN" label
      ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#22c55e";
      ctx.textAlign = "center";
      ctx.fillText("OPEN", geo.openArmX, Math.min(openTop, geo.openArmTop) - 6);

      // ── Fill mercury ──────────────────────────────────

      // Mercury color (silver/gray gradient)
      const mercGrad = ctx.createLinearGradient(0, 0, tw, 0);
      mercGrad.addColorStop(0, "#8e99a4");
      mercGrad.addColorStop(0.3, "#c4cdd5");
      mercGrad.addColorStop(0.5, "#d4dce4");
      mercGrad.addColorStop(0.7, "#c4cdd5");
      mercGrad.addColorStop(1, "#8e99a4");

      // Mercury in U-bend bottom (always full)
      ctx.fillStyle = mercGrad;
      ctx.fillRect(
        geo.sealedArmX - halfTube,
        geo.uBendTop,
        geo.openArmX - geo.sealedArmX + tw,
        geo.uBendBottom - geo.uBendTop
      );

      // Mercury in sealed arm (below gas)
      const sealedMercTopY = geo.uBendTop - sealedMercHeight;
      ctx.fillStyle = mercGrad;
      ctx.fillRect(
        geo.sealedArmX - halfTube,
        sealedMercTopY,
        tw,
        sealedMercHeight
      );

      // Mercury in open arm
      const openMercTopY = geo.uBendTop - openMercHeight;
      ctx.fillStyle = mercGrad;
      ctx.fillRect(
        geo.openArmX - halfTube,
        openMercTopY,
        tw,
        openMercHeight
      );

      // Mercury surface highlights (meniscus effect)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      // Sealed arm mercury top
      ctx.beginPath();
      ctx.moveTo(geo.sealedArmX - halfTube, sealedMercTopY);
      ctx.quadraticCurveTo(geo.sealedArmX, sealedMercTopY + 3, geo.sealedArmX + halfTube, sealedMercTopY);
      ctx.stroke();
      // Open arm mercury top
      ctx.beginPath();
      ctx.moveTo(geo.openArmX - halfTube, openMercTopY);
      ctx.quadraticCurveTo(geo.openArmX, openMercTopY + 3, geo.openArmX + halfTube, openMercTopY);
      ctx.stroke();

      // ── Trapped gas (blue tint) ───────────────────────
      const gasTopY = sealedMercTopY - gasHeight;
      const gasBottomY = sealedMercTopY;

      const gasGrad = ctx.createLinearGradient(0, gasTopY, 0, gasBottomY);
      gasGrad.addColorStop(0, "rgba(56, 189, 248, 0.15)");
      gasGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.08)");
      gasGrad.addColorStop(1, "rgba(56, 189, 248, 0.12)");
      ctx.fillStyle = gasGrad;
      ctx.fillRect(geo.sealedArmX - halfTube, gasTopY, tw, gasHeight);

      // Gas label
      ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(56, 189, 248, 0.8)";
      ctx.textAlign = "center";
      ctx.fillText("GAS", geo.sealedArmX, gasTopY + gasHeight / 2 + 3);

      // ── Gas particles ─────────────────────────────────
      if (showParticles) {
        for (const p of particles) {
          // Remap particle positions to current gas bounds
          const remappedY = gasTopY + ((p.y - (geo.uBendTop - gasHeight)) / gasHeight) * gasHeight;
          const remappedX = geo.sealedArmX - halfTube + ((p.x - (geo.sealedArmX - halfTube)) / tw) * tw;

          ctx.beginPath();
          ctx.arc(remappedX, remappedY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(96, 165, 250, 0.8)";
          ctx.fill();

          // Glow
          ctx.beginPath();
          ctx.arc(remappedX, remappedY, p.radius + 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(96, 165, 250, 0.3)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ── Height difference arrows ──────────────────────
      if (mercuryAdded > 0) {
        const diffMidX = (geo.sealedArmX + geo.openArmX) / 2;

        // Arrow from sealed arm mercury level to open arm mercury level
        ctx.setLineDash([3, 3]);
        // Horizontal line from sealed merc top
        ctx.beginPath();
        ctx.moveTo(geo.sealedArmX + halfTube + 4, sealedMercTopY);
        ctx.lineTo(geo.openArmX - halfTube - 4, sealedMercTopY);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // Vertical arrow showing height difference
        if (heightDiffPx > 5) {
          const arrowX = geo.openArmX + halfTube + 14;
          ctx.beginPath();
          ctx.moveTo(arrowX, sealedMercTopY);
          ctx.lineTo(arrowX, openMercTopY);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Arrowheads
          ctx.beginPath();
          ctx.moveTo(arrowX, sealedMercTopY);
          ctx.lineTo(arrowX - 4, sealedMercTopY - 6);
          ctx.lineTo(arrowX + 4, sealedMercTopY - 6);
          ctx.closePath();
          ctx.fillStyle = "#fbbf24";
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(arrowX, openMercTopY);
          ctx.lineTo(arrowX - 4, openMercTopY + 6);
          ctx.lineTo(arrowX + 4, openMercTopY + 6);
          ctx.closePath();
          ctx.fill();

          // Label
          ctx.font = "10px 'Inter', system-ui, sans-serif";
          ctx.fillStyle = "#fbbf24";
          ctx.textAlign = "left";
          ctx.fillText(`\u0394h = ${mercuryAdded} mmHg`, arrowX + 6, (sealedMercTopY + openMercTopY) / 2 + 3);
        }
      }

      // ── Gas column height arrow ───────────────────────
      if (gasHeight > 10) {
        const ghArrowX = geo.sealedArmX - halfTube - 14;
        ctx.beginPath();
        ctx.moveTo(ghArrowX, gasTopY);
        ctx.lineTo(ghArrowX, gasBottomY);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrowheads
        ctx.beginPath();
        ctx.moveTo(ghArrowX, gasTopY);
        ctx.lineTo(ghArrowX - 3, gasTopY + 5);
        ctx.lineTo(ghArrowX + 3, gasTopY + 5);
        ctx.closePath();
        ctx.fillStyle = "#38bdf8";
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(ghArrowX, gasBottomY);
        ctx.lineTo(ghArrowX - 3, gasBottomY - 5);
        ctx.lineTo(ghArrowX + 3, gasBottomY - 5);
        ctx.closePath();
        ctx.fill();

        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#38bdf8";
        ctx.textAlign = "right";
        ctx.save();
        ctx.translate(ghArrowX - 4, (gasTopY + gasBottomY) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillText("Gas Vol \u221D h", 0, 0);
        ctx.restore();
      }

      // ── PV Graph ──────────────────────────────────────
      if (showPVGraph) {
        const gLeft = W * 0.62;
        const gRight = W - 25;
        const gTop = 65;
        const gBottom = H * 0.55;
        const gWidth = gRight - gLeft;
        const gHeight = gBottom - gTop;

        // Graph background
        ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
        ctx.fillRect(gLeft, gTop, gWidth, gHeight);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.strokeRect(gLeft, gTop, gWidth, gHeight);

        // Title
        ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.textAlign = "center";
        ctx.fillText("PV Diagram (Boyle's Law)", (gLeft + gRight) / 2, gTop - 8);

        // Axes labels
        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText("Volume (gas height, px)", (gLeft + gRight) / 2, gBottom + 16);

        ctx.save();
        ctx.translate(gLeft - 14, (gTop + gBottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        const { unit: pUnit } = pressureInUnits(P_ATM);
        ctx.fillText(`Pressure (${pUnit})`, 0, 0);
        ctx.restore();

        // Axis ranges
        const PminMmHg = P_ATM * 0.8;
        const PmaxMmHg = P_ATM + 220;
        const VminPx = PV_CONSTANT / PmaxMmHg;
        const VmaxPx = PV_CONSTANT / PminMmHg;

        // Theoretical hyperbola (dashed)
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 100; i++) {
          const v = VminPx + (i / 100) * (VmaxPx - VminPx);
          const p = PV_CONSTANT / v;
          const px = gLeft + ((v - VminPx) / (VmaxPx - VminPx)) * gWidth;
          const py = gBottom - ((p - PminMmHg) / (PmaxMmHg - PminMmHg)) * gHeight;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // "PV = const" label on curve
        ctx.font = "italic 9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "left";
        const labelV = (VminPx + VmaxPx) * 0.65;
        const labelP = PV_CONSTANT / labelV;
        const labelPx = gLeft + ((labelV - VminPx) / (VmaxPx - VminPx)) * gWidth;
        const labelPy = gBottom - ((labelP - PminMmHg) / (PmaxMmHg - PminMmHg)) * gHeight;
        ctx.fillText("PV = const", labelPx + 4, labelPy - 6);

        // Plot recorded PV points
        for (let i = 0; i < pvPoints.length; i++) {
          const pt = pvPoints[i];
          const px = gLeft + ((pt.V - VminPx) / (VmaxPx - VminPx)) * gWidth;
          const py = gBottom - ((pt.P - PminMmHg) / (PmaxMmHg - PminMmHg)) * gHeight;

          if (px >= gLeft && px <= gRight && py >= gTop && py <= gBottom) {
            const alpha = 0.3 + 0.7 * (i / pvPoints.length);
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
            ctx.fill();
          }
        }

        // Current point (highlighted)
        {
          const cpx = gLeft + ((gasHeight - VminPx) / (VmaxPx - VminPx)) * gWidth;
          const cpy = gBottom - ((gasPressure - PminMmHg) / (PmaxMmHg - PminMmHg)) * gHeight;
          if (cpx >= gLeft && cpx <= gRight && cpy >= gTop && cpy <= gBottom) {
            const glow = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, 12);
            glow.addColorStop(0, "rgba(56, 189, 248, 0.5)");
            glow.addColorStop(1, "rgba(56, 189, 248, 0)");
            ctx.beginPath();
            ctx.arc(cpx, cpy, 12, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cpx, cpy, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#38bdf8";
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        // Axis ticks
        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";

        const vTicks = 5;
        for (let i = 0; i <= vTicks; i++) {
          const v = VminPx + (i / vTicks) * (VmaxPx - VminPx);
          const px = gLeft + (i / vTicks) * gWidth;
          ctx.beginPath();
          ctx.moveTo(px, gBottom);
          ctx.lineTo(px, gBottom + 4);
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillText(v.toFixed(0), px, gBottom + 14);
        }

        ctx.textAlign = "right";
        const pTicks = 5;
        for (let i = 0; i <= pTicks; i++) {
          const p = PminMmHg + (i / pTicks) * (PmaxMmHg - PminMmHg);
          const py = gBottom - (i / pTicks) * gHeight;
          ctx.beginPath();
          ctx.moveTo(gLeft, py);
          ctx.lineTo(gLeft - 4, py);
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1;
          ctx.stroke();
          const { value } = pressureInUnits(p);
          ctx.fillText(units === 0 ? value.toFixed(2) : value.toFixed(0), gLeft - 6, py + 3);
        }
      }

      // ── Data panel ────────────────────────────────────
      const dpX = W * 0.62;
      const dpY = H * 0.60;
      const dpW = W - dpX - 15;
      const dpH = H - dpY - 15;

      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.roundRect(dpX, dpY, dpW, dpH, 8);
      ctx.fill();

      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Boyle's J-Tube Data", dpX + 12, dpY + 20);

      ctx.font = "12px 'Inter', system-ui, sans-serif";
      const row1 = dpY + 40;
      const row2 = dpY + 58;
      const row3 = dpY + 76;
      const row4 = dpY + 94;
      const row5 = dpY + 112;
      const row6 = dpY + 130;
      const row7 = dpY + 148;

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`P_atm = ${formatPressure(P_ATM)}`, dpX + 12, row1);

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`\u0394h (Hg added) = ${mercuryAdded} mmHg`, dpX + 12, row2);

      ctx.fillStyle = "#f472b6";
      ctx.fillText(`P_gas = P_atm + \u0394h = ${formatPressure(gasPressure)}`, dpX + 12, row3);

      ctx.fillStyle = "#34d399";
      const volumeRatio = gasHeight / INITIAL_GAS_HEIGHT;
      ctx.fillText(`V/V\u2080 = ${volumeRatio.toFixed(3)}`, dpX + 12, row4);

      ctx.fillStyle = "#c084fc";
      const pvProduct = gasPressure * gasHeight;
      ctx.fillText(`PV = ${pvProduct.toFixed(0)} (const = ${PV_CONSTANT})`, dpX + 12, row5);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillText(`Gas compressed to ${(volumeRatio * 100).toFixed(1)}% of original`, dpX + 12, row6);

      ctx.fillStyle = "#64748b";
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillText("Add mercury to open arm \u2192 increases pressure", dpX + 12, row7);
      ctx.fillText("\u2192 gas in sealed arm compresses (PV = const)", dpX + 12, row7 + 14);

      // ── Time ──────────────────────────────────────────
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 6);
    },

    reset() {
      time = 0;
      mercuryAdded = config.parameters.find((p) => p.key === "mercuryAdded")!.defaultValue;
      computeGasState();
      spawnParticles();
      pvPoints = [];
    },

    destroy() {
      particles = [];
      pvPoints = [];
    },

    getStateDescription(): string {
      const volumeRatio = gasHeight / INITIAL_GAS_HEIGHT;
      return (
        `Boyle's J-Tube Experiment: Mercury added = ${mercuryAdded} mmHg. ` +
        `P_atm = ${formatPressure(P_ATM)}. ` +
        `P_gas = P_atm + \u0394h = ${formatPressure(gasPressure)}. ` +
        `Gas compressed to ${(volumeRatio * 100).toFixed(1)}% of original volume. ` +
        `PV = ${(gasPressure * gasHeight).toFixed(0)} (constant = ${PV_CONSTANT}). ` +
        `Boyle's Law: at constant temperature, PV = constant. ` +
        `The J-tube demonstrates this by adding mercury to the open arm, ` +
        `increasing pressure on the trapped gas in the sealed arm and compressing it.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default BoylesJTubeFactory;
