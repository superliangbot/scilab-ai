import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const AreaOfCircleFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("area-of-circle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let numSectors = 8;
  let radius = 120;
  let animationPhase = 0;

  function hslColor(index: number, total: number, alpha: number = 1): string {
    const hue = (index / total) * 360;
    return `hsla(${hue}, 80%, 55%, ${alpha})`;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    numSectors = Math.round(params.numSectors ?? 8);
    // Ensure even number of sectors
    if (numSectors % 2 !== 0) numSectors = Math.max(2, numSectors - 1);
    radius = params.radius ?? 120;
    animationPhase = params.animationPhase ?? 0;

    time += dt;
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const phase = animationPhase / 100; // 0 to 1

    // Layout: circle on left, rearranged on right
    const leftCenterX = width * 0.25;
    const rightCenterX = width * 0.72;
    const centerY = height * 0.48;

    // Draw the original circle with sector lines (fading as phase increases)
    drawCircleWithSectors(leftCenterX, centerY, radius, numSectors, 1 - phase * 0.5);

    // Draw the rearranged sectors forming approximate rectangle
    drawRearrangedSectors(rightCenterX, centerY, radius, numSectors, phase);

    // Draw labels and formulas
    drawLabels(leftCenterX, rightCenterX, centerY, radius, numSectors, phase);

    // Draw title
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Area of a Circle: Sector Rearrangement Proof", width / 2, height * 0.06);

    ctx.fillStyle = "rgba(180, 220, 255, 0.7)";
    ctx.font = "italic 14px system-ui, sans-serif";
    ctx.fillText("Cut into sectors, rearrange into a rectangle", width / 2, height * 0.06 + 22);

    // Time display
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function drawCircleWithSectors(cx: number, cy: number, r: number, n: number, alpha: number): void {
    const sectorAngle = (2 * Math.PI) / n;

    for (let i = 0; i < n; i++) {
      const startAngle = i * sectorAngle - Math.PI / 2;
      const endAngle = startAngle + sectorAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = hslColor(i, n, alpha * 0.8);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw circle outline
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.fill();

    // Radius label
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("r", cx + r / 2, cy - 8);
  }

  function drawRearrangedSectors(cx: number, cy: number, r: number, n: number, phase: number): void {
    if (phase <= 0) return;

    const sectorAngle = (2 * Math.PI) / n;
    const halfN = n / 2;

    // The rearranged shape: sectors alternate pointing up and down
    // Width of the approximate rectangle = pi * r
    // Height = r
    // Each sector's base (arc) width at the rectangle = (2 * pi * r) / n
    const sectorArcWidth = (2 * Math.PI * r) / n;
    const totalWidth = halfN * sectorArcWidth;

    // Position: center the rectangle arrangement
    const startX = cx - totalWidth / 2;
    const topY = cy - r / 2;

    for (let i = 0; i < n; i++) {
      const originalAngle = i * sectorAngle - Math.PI / 2;

      // In the rearranged form, sectors alternate up/down
      // Even sectors point up, odd sectors point down
      const isUp = i % 2 === 0;
      const pairIndex = Math.floor(i / 2);

      // Target position in the rectangle arrangement
      let targetX: number;
      if (isUp) {
        targetX = startX + pairIndex * sectorArcWidth;
      } else {
        targetX = startX + pairIndex * sectorArcWidth + sectorArcWidth / 2;
      }

      // Interpolate between circle position and rectangle position
      const origCx = cx - (cx - (cx)); // just cx for circle
      const origCy = cy;

      // For circle arrangement, the sector is at original position
      // For rectangle arrangement, we draw it at the target
      const interpX = cx + (targetX - cx) * phase;
      const interpY = cy;

      ctx.save();
      ctx.translate(interpX, interpY);

      // Rotation: in circle, each sector points outward from center
      // In rectangle, sectors point straight up or down
      const circleRotation = originalAngle + sectorAngle / 2 + Math.PI / 2;
      const rectRotation = isUp ? 0 : Math.PI;
      const rotation = circleRotation + (rectRotation - circleRotation) * phase;

      ctx.rotate(rotation);

      // Draw the sector as a triangle/wedge
      ctx.beginPath();
      ctx.moveTo(0, 0);
      // The sector spans sectorAngle, draw it centered
      ctx.arc(0, 0, r, -sectorAngle / 2, sectorAngle / 2);
      ctx.closePath();

      ctx.fillStyle = hslColor(i, n, 0.8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.restore();
    }

    // Draw bounding rectangle outline when phase > 0.5
    if (phase > 0.3) {
      const rectAlpha = Math.min(1, (phase - 0.3) / 0.4);
      ctx.strokeStyle = `rgba(255, 255, 100, ${rectAlpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(startX - 2, topY - 2, totalWidth + 4, r + 4);
      ctx.setLineDash([]);
    }

    // Dimension labels when phase is high
    if (phase > 0.5) {
      const labelAlpha = Math.min(1, (phase - 0.5) / 0.3);

      // Width label (pi * r)
      ctx.fillStyle = `rgba(255, 255, 100, ${labelAlpha * 0.9})`;
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("\u03C0r", cx, topY + r + 25);

      // Width arrow
      ctx.strokeStyle = `rgba(255, 255, 100, ${labelAlpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, topY + r + 15);
      ctx.lineTo(startX + totalWidth, topY + r + 15);
      ctx.stroke();
      // Arrow ends
      for (const dir of [-1, 1]) {
        const x = dir === -1 ? startX : startX + totalWidth;
        ctx.beginPath();
        ctx.moveTo(x, topY + r + 15);
        ctx.lineTo(x + dir * 6, topY + r + 11);
        ctx.moveTo(x, topY + r + 15);
        ctx.lineTo(x + dir * 6, topY + r + 19);
        ctx.stroke();
      }

      // Height label (r)
      ctx.fillStyle = `rgba(100, 255, 200, ${labelAlpha * 0.9})`;
      ctx.textAlign = "left";
      ctx.fillText("r", startX + totalWidth + 18, cy);

      // Height arrow
      ctx.strokeStyle = `rgba(100, 255, 200, ${labelAlpha * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(startX + totalWidth + 10, topY);
      ctx.lineTo(startX + totalWidth + 10, topY + r);
      ctx.stroke();
      for (const dir of [-1, 1]) {
        const y = dir === -1 ? topY : topY + r;
        ctx.beginPath();
        ctx.moveTo(startX + totalWidth + 10, y);
        ctx.lineTo(startX + totalWidth + 6, y + dir * 6);
        ctx.moveTo(startX + totalWidth + 10, y);
        ctx.lineTo(startX + totalWidth + 14, y + dir * 6);
        ctx.stroke();
      }
    }
  }

  function drawLabels(leftCx: number, rightCx: number, cy: number, r: number, n: number, phase: number): void {
    const bottomY = height * 0.88;

    // Info panel background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, bottomY - 10, width * 0.9, height * 0.1 + 5, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    const lineHeight = 16;
    let y = bottomY + 6;

    // Number of sectors
    ctx.fillStyle = "rgba(180, 220, 255, 0.9)";
    ctx.font = "12px 'SF Mono', 'Fira Code', monospace";
    ctx.fillText(`Sectors: ${n}`, width * 0.07, y);

    // Arc length of each sector
    const arcLength = (2 * Math.PI * r) / n;
    ctx.fillText(`Sector arc \u2248 ${arcLength.toFixed(1)}px`, width * 0.07, y + lineHeight);

    // Rectangle dimensions
    ctx.fillStyle = "rgba(255, 255, 100, 0.9)";
    ctx.fillText(`Width = \u03C0r = ${(Math.PI * r).toFixed(1)}px`, width * 0.35, y);
    ctx.fillStyle = "rgba(100, 255, 200, 0.9)";
    ctx.fillText(`Height = r = ${r.toFixed(0)}px`, width * 0.35, y + lineHeight);

    // Area formula
    ctx.fillStyle = "rgba(255, 200, 100, 0.95)";
    ctx.font = "bold 14px 'SF Mono', 'Fira Code', monospace";
    ctx.fillText(`Area = \u03C0r \u00D7 r = \u03C0r\u00B2 = ${(Math.PI * r * r).toFixed(0)}px\u00B2`, width * 0.62, y);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`As N \u2192 \u221E, the shape \u2192 perfect rectangle`, width * 0.62, y + lineHeight);

    // Arrow between circle and rectangle
    if (phase > 0) {
      const arrowY = cy;
      const arrowStartX = leftCx + r + 20;
      const arrowEndX = rightCx - r - 40;
      const arrowMidX = (arrowStartX + arrowEndX) / 2;

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + phase * 0.4})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(arrowStartX, arrowY);
      ctx.lineTo(arrowEndX, arrowY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + phase * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(arrowEndX + 8, arrowY);
      ctx.lineTo(arrowEndX - 2, arrowY - 6);
      ctx.lineTo(arrowEndX - 2, arrowY + 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + phase * 0.3})`;
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("rearrange", arrowMidX, arrowY - 12);
    }
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const area = Math.PI * radius * radius;
    const rectWidth = Math.PI * radius;
    return (
      `Area of Circle proof by sector rearrangement. ` +
      `Circle with radius ${radius}px divided into ${numSectors} equal sectors. ` +
      `Animation phase: ${animationPhase}% (0=circle, 100=rectangle). ` +
      `When rearranged, sectors form an approximate rectangle of width \u03C0r=${rectWidth.toFixed(1)} and height r=${radius}. ` +
      `Area = \u03C0r\u00B2 = ${area.toFixed(1)} px\u00B2. ` +
      `As the number of sectors increases, the rearranged shape approaches a perfect rectangle, ` +
      `proving that the area of a circle equals \u03C0r\u00B2. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
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

export default AreaOfCircleFactory;
