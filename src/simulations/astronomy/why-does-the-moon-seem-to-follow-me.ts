import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MoonFollowsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("why-does-the-moon-seem-to-follow-me") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let walkSpeed = 1;
  let showParallax = 1;
  let moonDistance = 0.9; // 0-1 scale

  let personX = 0;

  // Scenery objects at various distances
  interface SceneryObj {
    x: number;
    dist: number; // 0 = near, 1 = far
    type: "tree" | "house" | "pole";
    height: number;
  }

  let scenery: SceneryObj[] = [];

  function initScenery(): void {
    scenery = [];
    for (let i = 0; i < 8; i++) {
      scenery.push({
        x: i * width * 0.15 - width * 0.1,
        dist: 0.1 + Math.random() * 0.3,
        type: ["tree", "house", "pole"][Math.floor(Math.random() * 3)] as SceneryObj["type"],
        height: 30 + Math.random() * 40,
      });
    }
    // Mid-distance objects
    for (let i = 0; i < 5; i++) {
      scenery.push({
        x: i * width * 0.25,
        dist: 0.4 + Math.random() * 0.2,
        type: "tree",
        height: 20 + Math.random() * 20,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    personX = width * 0.3;
    initScenery();
  }

  function update(dt: number, params: Record<string, number>): void {
    walkSpeed = params.walkSpeed ?? 1;
    showParallax = Math.round(params.showParallax ?? 1);
    moonDistance = params.moonDistance ?? 0.9;

    personX += walkSpeed * 50 * dt;
    if (personX > width * 0.8) personX = width * 0.2;

    time += dt;
  }

  function getParallaxX(objX: number, objDist: number): number {
    // Objects appear to move opposite to person, inversely with distance
    const parallax = (personX - width * 0.5) * (1 - objDist);
    return objX - parallax;
  }

  function drawTree(x: number, y: number, h: number, dist: number): void {
    const alpha = 0.3 + dist * 0.7;
    const scale = 0.5 + dist * 0.5;

    // Trunk
    ctx.fillStyle = `rgba(101,67,33,${alpha})`;
    ctx.fillRect(x - 3 * scale, y - h * scale, 6 * scale, h * scale);

    // Foliage
    ctx.beginPath();
    ctx.arc(x, y - h * scale - 10 * scale, 15 * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(34,139,34,${alpha})`;
    ctx.fill();
  }

  function drawHouse(x: number, y: number, h: number, dist: number): void {
    const alpha = 0.3 + dist * 0.7;
    const scale = 0.5 + dist * 0.5;
    const w = 30 * scale;

    ctx.fillStyle = `rgba(180,120,80,${alpha})`;
    ctx.fillRect(x - w / 2, y - h * scale, w, h * scale);

    // Roof
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 5, y - h * scale);
    ctx.lineTo(x, y - h * scale - 15 * scale);
    ctx.lineTo(x + w / 2 + 5, y - h * scale);
    ctx.closePath();
    ctx.fillStyle = `rgba(139,69,19,${alpha})`;
    ctx.fill();
  }

  function drawPole(x: number, y: number, h: number, dist: number): void {
    const alpha = 0.3 + dist * 0.7;
    const scale = 0.5 + dist * 0.5;

    ctx.strokeStyle = `rgba(100,100,100,${alpha})`;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h * scale);
    ctx.stroke();

    // Cross bar
    ctx.beginPath();
    ctx.moveTo(x - 10 * scale, y - h * scale + 5);
    ctx.lineTo(x + 10 * scale, y - h * scale + 5);
    ctx.stroke();
  }

  function drawPerson(x: number, y: number): void {
    // Head
    ctx.beginPath();
    ctx.arc(x, y - 35, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#f1c40f";
    ctx.fill();

    // Body
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 29);
    ctx.lineTo(x, y - 12);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 22);
    ctx.lineTo(x + 8, y - 22);
    ctx.stroke();

    // Legs (walking animation)
    const legPhase = Math.sin(time * walkSpeed * 5) * 6;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x - legPhase, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + legPhase, y);
    ctx.stroke();
  }

  function render(): void {
    // Night sky
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    sky.addColorStop(0, "#0a0a2e");
    sky.addColorStop(1, "#1a2a4a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.7);

    // Ground
    ctx.fillStyle = "#2d4a2d";
    ctx.fillRect(0, height * 0.7, width, height * 0.3);

    // Road
    ctx.fillStyle = "#444";
    ctx.fillRect(0, height * 0.7, width, height * 0.08);
    // Dashed center line
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.74);
    ctx.lineTo(width, height * 0.74);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stars
    const seed = 42;
    let rng = seed;
    function prng(): number {
      rng = (rng * 16807) % 2147483647;
      return rng / 2147483647;
    }
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.arc(prng() * width, prng() * height * 0.5, prng(), 0, Math.PI * 2);
      ctx.fill();
    }

    // Moon (almost no parallax due to extreme distance)
    const moonBaseX = width * 0.6;
    const moonParallaxX = getParallaxX(moonBaseX, moonDistance);
    const moonY = height * 0.15;
    const moonR = 25;

    const moonGlow = ctx.createRadialGradient(moonParallaxX, moonY, moonR * 0.5, moonParallaxX, moonY, moonR * 3);
    moonGlow.addColorStop(0, "rgba(255,255,230,0.2)");
    moonGlow.addColorStop(1, "rgba(255,255,230,0)");
    ctx.beginPath();
    ctx.arc(moonParallaxX, moonY, moonR * 3, 0, Math.PI * 2);
    ctx.fillStyle = moonGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(moonParallaxX, moonY, moonR, 0, Math.PI * 2);
    const mGrad = ctx.createRadialGradient(moonParallaxX - 5, moonY - 5, 0, moonParallaxX, moonY, moonR);
    mGrad.addColorStop(0, "#fffff0");
    mGrad.addColorStop(1, "#ccc");
    ctx.fillStyle = mGrad;
    ctx.fill();

    // Draw scenery with parallax
    const groundY = height * 0.7;
    scenery.sort((a, b) => a.dist - b.dist);
    for (const obj of scenery) {
      const px = getParallaxX(obj.x, obj.dist);
      if (px < -50 || px > width + 50) continue;

      if (obj.type === "tree") drawTree(px, groundY, obj.height, obj.dist);
      else if (obj.type === "house") drawHouse(px, groundY, obj.height, obj.dist);
      else drawPole(px, groundY, obj.height, obj.dist);
    }

    // Person
    drawPerson(personX, groundY);

    // Sight line from person to moon
    if (showParallax) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(255,255,100,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(personX, groundY - 35);
      ctx.lineTo(moonParallaxX, moonY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Why Does the Moon Seem to Follow Me?", width / 2, 22);

    // Info
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, height - 70, width - 20, 60, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Parallax: Nearby objects shift quickly as you move; distant ones barely shift.", 22, height - 52);
    ctx.fillText("The Moon is ~384,400 km away — your movement is negligible relative to that distance.", 22, height - 36);
    ctx.fillText("Trees and houses shift backward, but the Moon stays in nearly the same direction.", 22, height - 20);
  }

  function reset(): void {
    time = 0;
    personX = width * 0.3;
  }

  function destroy(): void {
    scenery = [];
  }

  function getStateDescription(): string {
    return (
      `Moon Follows Me: Person at x=${personX.toFixed(0)}, walking at speed ${walkSpeed}×. ` +
      `Demonstrating parallax: nearby objects shift relative to observer, ` +
      `but Moon (384,400km away) barely changes direction. Moon distance scale: ${moonDistance}.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initScenery();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MoonFollowsFactory;
