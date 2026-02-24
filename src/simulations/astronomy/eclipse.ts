import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EclipseFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("eclipse") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Starfield
  let stars: Array<{ x: number; y: number; brightness: number; size: number }> = [];

  // Parameters
  let moonOrbitSpeed = 1;
  let moonDistance = 1;
  let viewAngle = 15; // degrees
  let showShadows = 1;

  // Moon orbital state
  let moonAngle = 0; // radians, 0 = right side of Earth (away from Sun)

  // Layout constants (set in resize)
  let sunX = 0;
  let sunY = 0;
  let earthX = 0;
  let earthY = 0;
  let sunRadius = 0;
  let earthRadius = 0;
  let moonRadius = 0;
  let moonOrbitRadius = 0;

  function computeLayout(): void {
    // Sun on the left, Earth in the right area
    sunX = width * 0.18;
    sunY = height * 0.5;
    earthX = width * 0.75;
    earthY = height * 0.5;

    // Sizes: Sun is much larger than Earth which is much larger than Moon
    sunRadius = Math.min(width, height) * 0.1;
    earthRadius = Math.min(width, height) * 0.035;
    moonRadius = earthRadius * 0.27;
    moonOrbitRadius = earthRadius * 4.0 * moonDistance;
  }

  function generateStars(): void {
    stars = [];
    const count = Math.floor((width * height) / 600);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        brightness: 0.2 + Math.random() * 0.8,
        size: 0.4 + Math.random() * 1.2,
      });
    }
  }

  function getMoonPosition(): { x: number; y: number } {
    // The view angle tilts the orbit: 0 = side view (orbit is a line), 90 = top view (full circle)
    const viewRad = (viewAngle * Math.PI) / 180;
    // Moon orbit projected: x-axis shows full radius, y-axis is compressed by sin(viewAngle)
    const mx = earthX + moonOrbitRadius * Math.cos(moonAngle);
    const my = earthY - moonOrbitRadius * Math.sin(moonAngle) * Math.sin(viewRad);
    return { x: mx, y: my };
  }

  /** Determine eclipse type based on Moon angle relative to Sun-Earth line.
   *  Moon at angle ~PI (between Sun and Earth) -> solar eclipse
   *  Moon at angle ~0 or ~2PI (behind Earth from Sun) -> lunar eclipse
   */
  function getEclipseState(): { type: "solar" | "lunar" | "none"; intensity: number } {
    // Normalize angle to [0, 2PI)
    let a = moonAngle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;

    // For solar eclipse: moon is at angle PI (between earth and sun)
    const solarDist = Math.abs(a - Math.PI);
    // For lunar eclipse: moon is at angle 0/2PI (behind earth from sun)
    const lunarDist = Math.min(a, Math.PI * 2 - a);

    // The view angle affects how tight the alignment needs to be for an eclipse
    const viewRad = (viewAngle * Math.PI) / 180;
    // At side view (0 deg), alignment is just along x-axis, so wider tolerance
    // At top view (90 deg), must be more precisely aligned in both dimensions
    const tolerance = 0.25 + 0.15 * (1 - Math.sin(viewRad));

    if (solarDist < tolerance) {
      const intensity = 1 - solarDist / tolerance;
      return { type: "solar", intensity };
    }
    if (lunarDist < tolerance) {
      const intensity = 1 - lunarDist / tolerance;
      return { type: "lunar", intensity };
    }
    return { type: "none", intensity: 0 };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    moonAngle = Math.PI * 0.5; // start at top
    computeLayout();
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    moonOrbitSpeed = params.moonOrbitSpeed ?? 1;
    moonDistance = params.moonDistance ?? 1;
    viewAngle = params.viewAngle ?? 15;
    showShadows = params.showShadows ?? 1;

    // Recalculate orbit radius based on moonDistance
    moonOrbitRadius = earthRadius * 4.0 * moonDistance;

    // Moon orbits Earth: one full orbit ~ 2 seconds at speed 1
    moonAngle += dt * moonOrbitSpeed * Math.PI;
    time += dt;
  }

  function renderBackground(): void {
    // Deep space gradient
    const bgGrad = ctx.createRadialGradient(
      sunX, sunY, 0,
      sunX, sunY, width
    );
    bgGrad.addColorStop(0, "#0c0820");
    bgGrad.addColorStop(0.3, "#060412");
    bgGrad.addColorStop(1, "#010108");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function renderStars(): void {
    for (const star of stars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * 3 + star.x * 0.05 + star.y * 0.07);
      const alpha = star.brightness * twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  function renderSun(): void {
    // Outer corona layers
    for (let i = 5; i >= 0; i--) {
      const r = sunRadius * (1.5 + i * 0.6);
      const grad = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.5, sunX, sunY, r);
      grad.addColorStop(0, `rgba(255, 255, 200, ${0.05 - i * 0.007})`);
      grad.addColorStop(0.4, `rgba(255, 220, 100, ${0.035 - i * 0.005})`);
      grad.addColorStop(1, "rgba(255, 150, 50, 0)");
      ctx.beginPath();
      ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Corona rays
    ctx.save();
    ctx.translate(sunX, sunY);
    const rayCount = 24;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + time * 0.05;
      const rayLength = sunRadius * (1.3 + 0.4 * Math.sin(time * 2 + i * 1.3));
      const grad = ctx.createLinearGradient(0, 0,
        Math.cos(angle) * rayLength,
        Math.sin(angle) * rayLength
      );
      grad.addColorStop(0, "rgba(255, 240, 150, 0.12)");
      grad.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(
        Math.cos(angle - 0.04) * rayLength,
        Math.sin(angle - 0.04) * rayLength
      );
      ctx.lineTo(
        Math.cos(angle + 0.04) * rayLength,
        Math.sin(angle + 0.04) * rayLength
      );
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();

    // Sun body
    const sunGrad = ctx.createRadialGradient(
      sunX - sunRadius * 0.15, sunY - sunRadius * 0.15, 0,
      sunX, sunY, sunRadius
    );
    sunGrad.addColorStop(0, "#fffff0");
    sunGrad.addColorStop(0.2, "#ffee55");
    sunGrad.addColorStop(0.6, "#ffcc00");
    sunGrad.addColorStop(1, "#ff8800");
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Subtle surface detail
    for (let i = 0; i < 5; i++) {
      const spotAngle = time * 0.3 + i * 1.3;
      const spotR = sunRadius * (0.1 + 0.05 * Math.sin(i * 2.7));
      const sx = sunX + sunRadius * 0.5 * Math.cos(spotAngle + i);
      const sy = sunY + sunRadius * 0.4 * Math.sin(spotAngle * 0.7 + i);
      ctx.beginPath();
      ctx.arc(sx, sy, spotR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 180, 0, 0.15)";
      ctx.fill();
    }
  }

  function renderEarth(): void {
    // Earth shadow (away from sun)
    const earthGrad = ctx.createRadialGradient(
      earthX - earthRadius * 0.35, earthY - earthRadius * 0.25, 0,
      earthX, earthY, earthRadius
    );
    earthGrad.addColorStop(0, "#6699ff");
    earthGrad.addColorStop(0.5, "#3366cc");
    earthGrad.addColorStop(0.85, "#224488");
    earthGrad.addColorStop(1, "#112244");
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Atmosphere glow
    const atmoGrad = ctx.createRadialGradient(
      earthX, earthY, earthRadius * 0.85,
      earthX, earthY, earthRadius * 1.25
    );
    atmoGrad.addColorStop(0, "rgba(100, 150, 255, 0.15)");
    atmoGrad.addColorStop(1, "rgba(100, 150, 255, 0)");
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius * 1.25, 0, Math.PI * 2);
    ctx.fillStyle = atmoGrad;
    ctx.fill();

    // Tiny continent hints
    ctx.save();
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
    ctx.clip();
    const continentAngle = time * 0.2;
    for (let i = 0; i < 3; i++) {
      const cx = earthX + earthRadius * 0.3 * Math.cos(continentAngle + i * 2.1);
      const cy = earthY + earthRadius * 0.2 * Math.sin(continentAngle * 0.7 + i * 1.5);
      const cr = earthRadius * (0.2 + i * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(50, 160, 80, 0.2)";
      ctx.fill();
    }
    ctx.restore();
  }

  function renderMoonOrbit(): void {
    const viewRad = (viewAngle * Math.PI) / 180;
    ctx.beginPath();
    ctx.ellipse(
      earthX, earthY,
      moonOrbitRadius,
      moonOrbitRadius * Math.sin(viewRad),
      0, 0, Math.PI * 2
    );
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  function renderMoon(): void {
    const pos = getMoonPosition();

    // Moon body
    const moonGrad = ctx.createRadialGradient(
      pos.x - moonRadius * 0.3, pos.y - moonRadius * 0.3, 0,
      pos.x, pos.y, moonRadius
    );
    moonGrad.addColorStop(0, "#e8e8e8");
    moonGrad.addColorStop(0.5, "#cccccc");
    moonGrad.addColorStop(1, "#888888");
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, moonRadius, 0, Math.PI * 2);
    ctx.fillStyle = moonGrad;
    ctx.fill();

    // Subtle crater hints
    for (let i = 0; i < 3; i++) {
      const cx = pos.x + moonRadius * 0.3 * Math.cos(i * 2.2);
      const cy = pos.y + moonRadius * 0.25 * Math.sin(i * 1.7);
      ctx.beginPath();
      ctx.arc(cx, cy, moonRadius * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100, 100, 100, 0.3)";
      ctx.fill();
    }
  }

  function renderShadows(): void {
    if (showShadows < 0.5) return;

    const eclipse = getEclipseState();
    if (eclipse.type === "none") return;

    const moonPos = getMoonPosition();

    ctx.save();
    ctx.globalAlpha = eclipse.intensity * 0.6;

    if (eclipse.type === "solar") {
      // Shadow cone from Moon toward Earth (Moon blocks Sun light hitting Earth)
      // Draw an umbra cone from the Moon in the direction away from the Sun
      const dx = earthX - sunX;
      const dy = earthY - sunY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / dist;
      const ny = dy / dist;

      // Cone goes from Moon toward Earth surface
      const coneLength = moonOrbitRadius * 1.2;
      const coneStartWidth = moonRadius * 1.0;
      const coneEndWidth = moonRadius * 0.1;

      // Cone from moon toward Earth
      const tipX = moonPos.x + nx * coneLength;
      const tipY = moonPos.y + ny * coneLength;

      // Perpendicular direction
      const px = -ny;
      const py = nx;

      const grad = ctx.createLinearGradient(moonPos.x, moonPos.y, tipX, tipY);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.7)");
      grad.addColorStop(0.5, "rgba(0, 0, 0, 0.3)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.moveTo(moonPos.x + px * coneStartWidth, moonPos.y + py * coneStartWidth);
      ctx.lineTo(moonPos.x - px * coneStartWidth, moonPos.y - py * coneStartWidth);
      ctx.lineTo(tipX - px * coneEndWidth, tipY - py * coneEndWidth);
      ctx.lineTo(tipX + px * coneEndWidth, tipY + py * coneEndWidth);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Penumbra (wider, lighter)
      const penumbraWidth = coneStartWidth * 3;
      const penumbraGrad = ctx.createLinearGradient(moonPos.x, moonPos.y, tipX, tipY);
      penumbraGrad.addColorStop(0, "rgba(0, 0, 30, 0.2)");
      penumbraGrad.addColorStop(1, "rgba(0, 0, 30, 0)");

      ctx.beginPath();
      ctx.moveTo(moonPos.x + px * penumbraWidth, moonPos.y + py * penumbraWidth);
      ctx.lineTo(moonPos.x - px * penumbraWidth, moonPos.y - py * penumbraWidth);
      ctx.lineTo(tipX - px * coneEndWidth * 2, tipY - py * coneEndWidth * 2);
      ctx.lineTo(tipX + px * coneEndWidth * 2, tipY + py * coneEndWidth * 2);
      ctx.closePath();
      ctx.fillStyle = penumbraGrad;
      ctx.fill();

      // Darken Earth slightly during solar eclipse
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthRadius * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${eclipse.intensity * 0.4})`;
      ctx.fill();
    }

    if (eclipse.type === "lunar") {
      // Earth's shadow cone extending away from Sun, toward Moon
      const dx = earthX - sunX;
      const dy = earthY - sunY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / dist;
      const ny = dy / dist;

      const coneLength = moonOrbitRadius * 2.0;
      const coneStartWidth = earthRadius * 1.5;
      const coneEndWidth = earthRadius * 0.3;

      const startX = earthX;
      const startY = earthY;
      const endX = earthX + nx * coneLength;
      const endY = earthY + ny * coneLength;

      const px = -ny;
      const py = nx;

      // Umbra
      const grad = ctx.createLinearGradient(startX, startY, endX, endY);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.6)");
      grad.addColorStop(0.6, "rgba(0, 0, 0, 0.25)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.moveTo(startX + px * coneStartWidth, startY + py * coneStartWidth);
      ctx.lineTo(startX - px * coneStartWidth, startY - py * coneStartWidth);
      ctx.lineTo(endX - px * coneEndWidth, endY - py * coneEndWidth);
      ctx.lineTo(endX + px * coneEndWidth, endY + py * coneEndWidth);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Penumbra
      const penumbraWidth = coneStartWidth * 2.5;
      const penumbraGrad = ctx.createLinearGradient(startX, startY, endX, endY);
      penumbraGrad.addColorStop(0, "rgba(0, 0, 30, 0.15)");
      penumbraGrad.addColorStop(1, "rgba(0, 0, 30, 0)");

      ctx.beginPath();
      ctx.moveTo(startX + px * penumbraWidth, startY + py * penumbraWidth);
      ctx.lineTo(startX - px * penumbraWidth, startY - py * penumbraWidth);
      ctx.lineTo(endX - px * coneEndWidth * 3, endY - py * coneEndWidth * 3);
      ctx.lineTo(endX + px * coneEndWidth * 3, endY + py * coneEndWidth * 3);
      ctx.closePath();
      ctx.fillStyle = penumbraGrad;
      ctx.fill();

      // Darken Moon with reddish tint during lunar eclipse
      ctx.beginPath();
      ctx.arc(moonPos.x, moonPos.y, moonRadius * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80, 10, 0, ${eclipse.intensity * 0.6})`;
      ctx.fill();
    }

    ctx.restore();
  }

  function renderEclipseLabel(): void {
    const eclipse = getEclipseState();
    let label = "";
    let labelColor = "rgba(255, 255, 255, 0.7)";

    if (eclipse.type === "solar" && eclipse.intensity > 0.3) {
      label = "Solar Eclipse";
      labelColor = `rgba(255, 200, 100, ${0.5 + eclipse.intensity * 0.5})`;
    } else if (eclipse.type === "lunar" && eclipse.intensity > 0.3) {
      label = "Lunar Eclipse";
      labelColor = `rgba(255, 120, 100, ${0.5 + eclipse.intensity * 0.5})`;
    } else {
      // Show current phase
      let a = moonAngle % (Math.PI * 2);
      if (a < 0) a += Math.PI * 2;

      if (a >= Math.PI * 0.25 && a < Math.PI * 0.75) {
        label = "First Quarter";
      } else if (a >= Math.PI * 0.75 && a < Math.PI * 1.25) {
        label = "New Moon Phase";
      } else if (a >= Math.PI * 1.25 && a < Math.PI * 1.75) {
        label = "Third Quarter";
      } else {
        label = "Full Moon Phase";
      }
    }

    if (label) {
      ctx.font = `bold ${Math.max(14, Math.min(width, height) * 0.028)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = labelColor;
      ctx.fillText(label, width / 2, 20);
    }
  }

  function renderLabels(): void {
    const labelFont = `${Math.max(10, Math.min(width, height) * 0.018)}px system-ui, sans-serif`;
    ctx.font = labelFont;
    ctx.textAlign = "center";

    // Sun label
    ctx.fillStyle = "rgba(255, 240, 150, 0.7)";
    ctx.fillText("Sun", sunX, sunY + sunRadius + 16);

    // Earth label
    ctx.fillStyle = "rgba(100, 160, 255, 0.7)";
    ctx.fillText("Earth", earthX, earthY + earthRadius + 14);

    // Moon label
    const moonPos = getMoonPosition();
    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.fillText("Moon", moonPos.x, moonPos.y + moonRadius + 10);
  }

  function renderSunlight(): void {
    // Faint rays from Sun toward Earth
    const dx = earthX - sunX;
    const dy = earthY - sunY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const grad = ctx.createLinearGradient(sunX + sunRadius, sunY, earthX, earthY);
    grad.addColorStop(0, "rgba(255, 240, 180, 0.04)");
    grad.addColorStop(0.5, "rgba(255, 220, 100, 0.015)");
    grad.addColorStop(1, "rgba(255, 200, 50, 0)");

    const spread = sunRadius * 2;
    const nx = dx / dist;
    const ny = dy / dist;
    const px = -ny;
    const py = nx;

    ctx.beginPath();
    ctx.moveTo(sunX + nx * sunRadius + px * spread, sunY + ny * sunRadius + py * spread);
    ctx.lineTo(sunX + nx * sunRadius - px * spread, sunY + ny * sunRadius - py * spread);
    ctx.lineTo(earthX - px * earthRadius * 2, earthY - py * earthRadius * 2);
    ctx.lineTo(earthX + px * earthRadius * 2, earthY + py * earthRadius * 2);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function render(): void {
    renderBackground();
    renderStars();
    renderSunlight();
    renderSun();
    renderMoonOrbit();

    // Determine depth order for Moon vs Earth based on Moon's angle
    // Moon "in front" or "behind" relative to view
    const viewRad = (viewAngle * Math.PI) / 180;
    const moonZ = Math.cos(moonAngle) * Math.cos(viewRad);
    // Moon at angle ~0 -> moonZ positive -> behind Earth (further from viewer)
    // Moon at angle ~PI -> moonZ negative -> in front of Earth (closer to viewer)

    // We need to render back-to-front
    // We also render shadows between the bodies for correct layering
    if (moonZ > 0) {
      // Moon is "behind" Earth in our view
      renderMoon();
      renderShadows();
      renderEarth();
    } else {
      // Moon is "in front of" Earth
      renderEarth();
      renderShadows();
      renderMoon();
    }

    renderLabels();
    renderEclipseLabel();

    // HUD
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const orbits = (moonAngle / (Math.PI * 2)).toFixed(2);
    ctx.fillText(`Moon orbits: ${orbits}`, 10, height - 10);
  }

  function reset(): void {
    time = 0;
    moonAngle = Math.PI * 0.5;
  }

  function destroy(): void {
    stars = [];
  }

  function getStateDescription(): string {
    const eclipse = getEclipseState();
    let a = moonAngle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    const angleDeg = ((a * 180) / Math.PI).toFixed(1);
    const moonPos = getMoonPosition();

    let eclipseDesc = "No eclipse occurring";
    if (eclipse.type === "solar" && eclipse.intensity > 0.2) {
      eclipseDesc = `Solar eclipse in progress (intensity: ${(eclipse.intensity * 100).toFixed(0)}%)`;
    } else if (eclipse.type === "lunar" && eclipse.intensity > 0.2) {
      eclipseDesc = `Lunar eclipse in progress (intensity: ${(eclipse.intensity * 100).toFixed(0)}%)`;
    }

    let phase: string;
    if (a >= Math.PI * 0.25 && a < Math.PI * 0.75) {
      phase = "First Quarter";
    } else if (a >= Math.PI * 0.75 && a < Math.PI * 1.25) {
      phase = "New Moon (between Sun and Earth)";
    } else if (a >= Math.PI * 1.25 && a < Math.PI * 1.75) {
      phase = "Third Quarter";
    } else {
      phase = "Full Moon (opposite side from Sun)";
    }

    return (
      `Eclipse Simulation | Moon angle: ${angleDeg} deg | Phase: ${phase} | ` +
      `${eclipseDesc} | ` +
      `Moon orbit speed: ${moonOrbitSpeed}x | Moon distance: ${moonDistance}x | ` +
      `View angle: ${viewAngle} deg | Shadows: ${showShadows >= 0.5 ? "on" : "off"} | ` +
      `Moon position: (${moonPos.x.toFixed(0)}, ${moonPos.y.toFixed(0)})`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
    generateStars();
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

export default EclipseFactory;
