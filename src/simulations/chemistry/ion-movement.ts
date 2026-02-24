import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  charge: number; // +1, -1, 0
  type: "water" | "KMnO4" | "CuSO4_Cu" | "CuSO4_SO4";
  color: string;
  label: string;
  radius: number;
}

const IonMovementFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ion-movement") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 5;
  let numWater = 20;
  let polarity = 0; // 0 = normal (+)(−), 1 = reversed

  const particles: Particle[] = [];

  function initWater() {
    particles.length = 0;
    const chamberLeft = width * 0.15;
    const chamberRight = width * 0.85;
    const chamberTop = height * 0.2;
    const chamberBot = height * 0.7;

    for (let i = 0; i < numWater; i++) {
      particles.push({
        x: chamberLeft + Math.random() * (chamberRight - chamberLeft),
        y: chamberTop + Math.random() * (chamberBot - chamberTop),
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        charge: 0,
        type: "water",
        color: "rgba(173, 216, 230, 0.5)",
        label: "H₂O",
        radius: 6,
      });
    }
  }

  function addKMnO4() {
    const chamberTop = height * 0.2;
    const chamberBot = height * 0.7;
    const midX = width * 0.5;
    const midY = (chamberTop + chamberBot) / 2;

    for (let i = 0; i < 5; i++) {
      // K+ (positive)
      particles.push({
        x: midX + (Math.random() - 0.5) * 30,
        y: midY + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        charge: 1,
        type: "KMnO4",
        color: "#ce93d8",
        label: "K⁺",
        radius: 5,
      });
      // MnO4- (negative)
      particles.push({
        x: midX + (Math.random() - 0.5) * 30,
        y: midY + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        charge: -1,
        type: "KMnO4",
        color: "#7b1fa2",
        label: "MnO₄⁻",
        radius: 7,
      });
    }
  }

  function addCuSO4() {
    const chamberTop = height * 0.2;
    const chamberBot = height * 0.7;
    const midX = width * 0.5;
    const midY = (chamberTop + chamberBot) / 2;

    for (let i = 0; i < 5; i++) {
      // Cu2+ (positive)
      particles.push({
        x: midX + (Math.random() - 0.5) * 30,
        y: midY + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        charge: 2,
        type: "CuSO4_Cu",
        color: "#42a5f5",
        label: "Cu²⁺",
        radius: 6,
      });
      // SO4 2- (negative)
      particles.push({
        x: midX + (Math.random() - 0.5) * 30,
        y: midY + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        charge: -2,
        type: "CuSO4_SO4",
        color: "#ff7043",
        label: "SO₄²⁻",
        radius: 7,
      });
    }
  }

  // Track addIon cooldowns
  let lastKMnO4 = -10;
  let lastCuSO4 = -10;

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      engine.reset();
    },
    update(dt: number, params: Record<string, number>) {
      voltage = params.voltage ?? 5;
      polarity = params.polarity ?? 0;

      const addKMnO4Flag = params.addKMnO4 ?? 0;
      const addCuSO4Flag = params.addCuSO4 ?? 0;

      if (addKMnO4Flag > 0.5 && time - lastKMnO4 > 1) {
        addKMnO4();
        lastKMnO4 = time;
      }
      if (addCuSO4Flag > 0.5 && time - lastCuSO4 > 1) {
        addCuSO4();
        lastCuSO4 = time;
      }

      time += dt;

      const chamberLeft = width * 0.15;
      const chamberRight = width * 0.85;
      const chamberTop = height * 0.2;
      const chamberBot = height * 0.7;

      // Electric field direction
      const fieldDir = polarity < 0.5 ? 1 : -1; // positive = left electrode is +

      for (const p of particles) {
        // Electric force on charged particles
        if (p.charge !== 0) {
          const force = p.charge * voltage * 8 * fieldDir;
          p.vx += force * dt;
        }

        // Random thermal motion
        p.vx += (Math.random() - 0.5) * 40 * dt;
        p.vy += (Math.random() - 0.5) * 40 * dt;

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Bounce off walls
        if (p.x < chamberLeft + p.radius) { p.x = chamberLeft + p.radius; p.vx = Math.abs(p.vx) * 0.5; }
        if (p.x > chamberRight - p.radius) { p.x = chamberRight - p.radius; p.vx = -Math.abs(p.vx) * 0.5; }
        if (p.y < chamberTop + p.radius) { p.y = chamberTop + p.radius; p.vy = Math.abs(p.vy) * 0.5; }
        if (p.y > chamberBot - p.radius) { p.y = chamberBot - p.radius; p.vy = -Math.abs(p.vy) * 0.5; }
      }
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Ion Movement in Electric Field", width / 2, 22);

      const chamberLeft = width * 0.15;
      const chamberRight = width * 0.85;
      const chamberTop = height * 0.2;
      const chamberBot = height * 0.7;
      const chamberW = chamberRight - chamberLeft;
      const chamberH = chamberBot - chamberTop;

      // Chamber (solution)
      ctx.fillStyle = "rgba(200, 230, 255, 0.06)";
      ctx.fillRect(chamberLeft, chamberTop, chamberW, chamberH);
      ctx.strokeStyle = "#546e7a";
      ctx.lineWidth = 2;
      ctx.strokeRect(chamberLeft, chamberTop, chamberW, chamberH);

      // Electrodes
      const isNormal = polarity < 0.5;
      const leftSign = isNormal ? "+" : "−";
      const rightSign = isNormal ? "−" : "+";
      const leftColor = isNormal ? "#f44336" : "#2196f3";
      const rightColor = isNormal ? "#2196f3" : "#f44336";

      // Left electrode
      ctx.fillStyle = leftColor;
      ctx.fillRect(chamberLeft - 8, chamberTop + 10, 8, chamberH - 20);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(leftSign, chamberLeft - 4, chamberTop - 5);

      // Right electrode
      ctx.fillStyle = rightColor;
      ctx.fillRect(chamberRight, chamberTop + 10, 8, chamberH - 20);
      ctx.fillStyle = "#fff";
      ctx.fillText(rightSign, chamberRight + 4, chamberTop - 5);

      // Electric field arrows
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      const fieldDir = isNormal ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const ay = chamberTop + chamberH * (0.3 + i * 0.2);
        const ax1 = chamberLeft + 20;
        const ax2 = chamberRight - 20;
        ctx.beginPath();
        ctx.moveTo(ax1, ay);
        ctx.lineTo(ax2, ay);
        ctx.stroke();
        // Arrow head
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        const tipX = fieldDir > 0 ? ax2 : ax1;
        const dir = fieldDir > 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(tipX, ay);
        ctx.lineTo(tipX + dir * 8, ay - 4);
        ctx.lineTo(tipX + dir * 8, ay + 4);
        ctx.fill();
      }

      // Draw particles
      for (const p of particles) {
        ctx.save();
        // Glow for charged particles
        if (p.charge !== 0) {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2.5);
          glow.addColorStop(0, p.color + "60");
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 7px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.label, p.x, p.y);
        ctx.textBaseline = "alphabetic";
        ctx.restore();
      }

      // Info
      const infoY = chamberBot + 20;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.05, infoY, width * 0.9, 65);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Voltage: ${voltage.toFixed(1)}V | Polarity: ${isNormal ? "(+) left, (−) right" : "(−) left, (+) right"}`, width / 2, infoY + 16);
      ctx.fillStyle = "#aaa";
      ctx.fillText("Cations (+) migrate toward cathode (−) | Anions (−) migrate toward anode (+)", width / 2, infoY + 35);
      ctx.fillText("Purple: MnO₄⁻ | Blue: Cu²⁺ | Orange: SO₄²⁻ | Light blue: H₂O (neutral)", width / 2, infoY + 52);
    },
    reset() {
      time = 0;
      lastKMnO4 = -10;
      lastCuSO4 = -10;
      initWater();
    },
    destroy() {},
    getStateDescription(): string {
      const posIons = particles.filter((p) => p.charge > 0).length;
      const negIons = particles.filter((p) => p.charge < 0).length;
      return `Ion movement simulation with ${voltage}V applied. ${posIons} cations moving toward cathode, ${negIons} anions toward anode. Positive ions (K⁺, Cu²⁺) migrate toward the negative electrode. Negative ions (MnO₄⁻, SO₄²⁻) migrate toward the positive electrode.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      initWater();
    },
  };

  return engine;
};

export default IonMovementFactory;
