import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Factory ────────────────────────────────────────────────────────
const CircumferenceOfACircleFactory: SimulationFactory = () => {
  const config = getSimConfig("circumference-of-a-circle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let numSides = 6;
  let radius = 100;
  let showValues = 1;
  let animate = 0;

  // Animation state
  let animSides = 6;
  let animTimer = 0;
  const ANIM_INTERVAL = 1.2; // seconds between side increments

  // ── Polygon helpers ─────────────────────────────────────────────
  function inscribedPerimeter(n: number, r: number): number {
    return 2 * n * r * Math.sin(Math.PI / n);
  }

  function circumscribedPerimeter(n: number, r: number): number {
    return 2 * n * r * Math.tan(Math.PI / n);
  }

  function actualCircumference(r: number): number {
    return 2 * Math.PI * r;
  }

  // Draw a regular polygon inscribed in or circumscribed about a circle
  function drawPolygon(
    cx: number,
    cy: number,
    r: number,
    n: number,
    type: "inscribed" | "circumscribed",
    color: string,
    fillAlpha: number
  ): void {
    const effectiveR = type === "circumscribed" ? r / Math.cos(Math.PI / n) : r;

    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      const px = cx + effectiveR * Math.cos(angle);
      const py = cy + effectiveR * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Fill
    ctx.fillStyle = color.replace("1)", `${fillAlpha})`).replace("rgb", "rgba");
    ctx.fill();

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw a circle
  function drawCircle(
    cx: number,
    cy: number,
    r: number,
    strokeColor: string,
    lineWidth: number,
    dashed: boolean = false
  ): void {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (dashed) {
      ctx.setLineDash([4, 3]);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      animTimer = 0;
      animSides = 6;
    },

    update(dt: number, params: Record<string, number>) {
      numSides = Math.round(params.numSides ?? 6);
      radius = params.radius ?? 100;
      showValues = Math.round(params.showValues ?? 1);
      animate = Math.round(params.animate ?? 0);

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      if (animate) {
        animTimer += dtClamped;
        if (animTimer >= ANIM_INTERVAL) {
          animTimer = 0;
          animSides++;
          if (animSides > 64) animSides = 3;
        }
      } else {
        animSides = numSides;
        animTimer = 0;
      }
    },

    render() {
      if (!ctx) return;

      const n = animate ? animSides : numSides;

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
      ctx.fillText("Circumference of a Circle: Polygon Approximation", W / 2, 28);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "Inscribed perimeter < 2\u03C0r < Circumscribed perimeter \u2014 both converge as n \u2192 \u221E",
        W / 2,
        46
      );

      // ── Compute values ──────────────────────────────
      const inPerim = inscribedPerimeter(n, radius);
      const circPerim = actualCircumference(radius);
      const outPerim = circumscribedPerimeter(n, radius);

      // ── Layout: 3 diagrams side by side ─────────────
      const diagramY = H * 0.42;
      const spacing = W / 4;
      const cx1 = spacing;       // inscribed
      const cx2 = spacing * 2;   // circle
      const cx3 = spacing * 3;   // circumscribed

      // Scale radius if needed to fit
      const maxR = Math.min(radius, spacing * 0.7, (H * 0.35));
      const displayR = Math.min(radius, maxR);
      const scale = displayR / radius;
      const scaledR = displayR;

      // ── LEFT: Inscribed polygon ─────────────────────
      // Draw the circle (reference) as dashed
      drawCircle(cx1, diagramY, scaledR, "rgba(100, 150, 200, 0.3)", 1, true);

      // Draw inscribed polygon
      drawPolygon(cx1, diagramY, scaledR, n, "inscribed", "rgba(59, 130, 246, 0.9)", 0.1);

      // Center dot
      ctx.beginPath();
      ctx.arc(cx1, diagramY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();

      // Label
      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "center";
      ctx.fillText("Inscribed", cx1, diagramY - scaledR - 18);
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${n}-gon`, cx1, diagramY - scaledR - 4);

      // ── CENTER: Circle ──────────────────────────────
      // Filled circle
      ctx.beginPath();
      ctx.arc(cx2, diagramY, scaledR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(168, 85, 247, 0.12)";
      ctx.fill();

      drawCircle(cx2, diagramY, scaledR, "#a855f7", 2.5);

      // Center dot
      ctx.beginPath();
      ctx.arc(cx2, diagramY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#a855f7";
      ctx.fill();

      // Radius line
      ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx2, diagramY);
      ctx.lineTo(cx2 + scaledR, diagramY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#a855f7";
      ctx.textAlign = "center";
      ctx.fillText("r", cx2 + scaledR / 2, diagramY - 8);

      // Label
      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#a855f7";
      ctx.fillText("Circle", cx2, diagramY - scaledR - 18);
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("C = 2\u03C0r", cx2, diagramY - scaledR - 4);

      // ── RIGHT: Circumscribed polygon ────────────────
      // Draw the circle (reference) as dashed
      drawCircle(cx3, diagramY, scaledR, "rgba(100, 150, 200, 0.3)", 1, true);

      // Draw circumscribed polygon
      drawPolygon(cx3, diagramY, scaledR, n, "circumscribed", "rgba(16, 185, 129, 0.9)", 0.08);

      // Center dot
      ctx.beginPath();
      ctx.arc(cx3, diagramY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.fill();

      // Label
      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "center";
      ctx.fillText("Circumscribed", cx3, diagramY - scaledR - 18);
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${n}-gon`, cx3, diagramY - scaledR - 4);

      // ── Comparison arrows ───────────────────────────
      const arrowY = diagramY + scaledR + 25;
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";

      ctx.fillStyle = "rgba(100, 150, 200, 0.6)";
      ctx.fillText("<", (cx1 + cx2) / 2, arrowY + 5);
      ctx.fillText("<", (cx2 + cx3) / 2, arrowY + 5);

      // ── Values panel ────────────────────────────────
      if (showValues) {
        const panelTop = H * 0.72;
        const panelH = H * 0.22;
        const panelLeft = W * 0.05;
        const panelRight = W * 0.95;
        const panelW = panelRight - panelLeft;

        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.roundRect(panelLeft, panelTop, panelW, panelH, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const col1 = panelLeft + panelW * 0.02;
        const col2 = panelLeft + panelW * 0.35;
        const col3 = panelLeft + panelW * 0.68;
        let row = panelTop + 22;
        const rowH = 18;

        // Headers
        ctx.font = "bold 12px 'SF Mono', 'Fira Code', monospace";
        ctx.textAlign = "left";

        ctx.fillStyle = "#3b82f6";
        ctx.fillText("Inscribed Polygon", col1, row);
        ctx.fillStyle = "#a855f7";
        ctx.fillText("Circle (exact)", col2, row);
        ctx.fillStyle = "#10b981";
        ctx.fillText("Circumscribed Polygon", col3, row);

        row += rowH + 4;

        // Formulas
        ctx.font = "11px 'SF Mono', 'Fira Code', monospace";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`P = 2n\u00B7r\u00B7sin(\u03C0/n)`, col1, row);
        ctx.fillText(`C = 2\u03C0r`, col2, row);
        ctx.fillText(`P = 2n\u00B7r\u00B7tan(\u03C0/n)`, col3, row);

        row += rowH;

        // Numerical values
        ctx.font = "bold 13px 'SF Mono', 'Fira Code', monospace";
        ctx.fillStyle = "#3b82f6";
        ctx.fillText(`P = ${inPerim.toFixed(4)}`, col1, row);
        ctx.fillStyle = "#a855f7";
        ctx.fillText(`C = ${circPerim.toFixed(4)}`, col2, row);
        ctx.fillStyle = "#10b981";
        ctx.fillText(`P = ${outPerim.toFixed(4)}`, col3, row);

        row += rowH;

        // Errors
        const inError = ((circPerim - inPerim) / circPerim) * 100;
        const outError = ((outPerim - circPerim) / circPerim) * 100;
        ctx.font = "11px 'SF Mono', 'Fira Code', monospace";
        ctx.fillStyle = "#64748b";
        ctx.fillText(`Error: \u2212${inError.toFixed(4)}%`, col1, row);
        ctx.fillText(`(exact)`, col2, row);
        ctx.fillText(`Error: +${outError.toFixed(4)}%`, col3, row);

        row += rowH + 2;

        // Summary
        ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText(
          `n = ${n}: ${inPerim.toFixed(4)} < ${circPerim.toFixed(4)} < ${outPerim.toFixed(4)}`,
          W / 2,
          row
        );

        if (n >= 50) {
          ctx.font = "11px 'Inter', system-ui, sans-serif";
          ctx.fillStyle = "#10b981";
          ctx.fillText(
            "Both perimeters are converging to 2\u03C0r \u2014 the true circumference!",
            W / 2,
            row + 16
          );
        }
      }

      // ── Convergence indicator (n value) ─────────────
      ctx.font = "bold 14px 'SF Mono', 'Fira Code', monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText(`Sides: n = ${n}`, W / 2, 68);

      // ── For unit circle reference ───────────────────
      if (radius > 0) {
        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        const unitCirc = 2 * Math.PI;
        ctx.fillText(
          `For unit circle (r=1): 2\u03C0 \u2248 ${unitCirc.toFixed(6)}  |  r = ${radius}px`,
          W / 2,
          84
        );
      }

      // Time
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 8);
    },

    reset() {
      time = 0;
      animTimer = 0;
      animSides = numSides;
    },

    destroy() {},

    getStateDescription(): string {
      const n = animate ? animSides : numSides;
      const inP = inscribedPerimeter(n, radius);
      const cP = actualCircumference(radius);
      const outP = circumscribedPerimeter(n, radius);
      const inErr = (((cP - inP) / cP) * 100).toFixed(4);
      const outErr = (((outP - cP) / cP) * 100).toFixed(4);
      return (
        `Circumference of a Circle simulation. ` +
        `Approximating 2\u03C0r using inscribed and circumscribed ${n}-gons with r = ${radius}px. ` +
        `Inscribed perimeter = 2n\u00B7r\u00B7sin(\u03C0/n) = ${inP.toFixed(4)} (${inErr}% below). ` +
        `True circumference = 2\u03C0r = ${cP.toFixed(4)}. ` +
        `Circumscribed perimeter = 2n\u00B7r\u00B7tan(\u03C0/n) = ${outP.toFixed(4)} (${outErr}% above). ` +
        `As n\u2192\u221E, both converge to 2\u03C0r. ` +
        `${animate ? "Auto-animating sides." : "Manual side count."} ` +
        `Time: ${time.toFixed(1)}s.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default CircumferenceOfACircleFactory;
