import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const RSAEncryption: SimulationFactory = () => {
  const config = getSimConfig("rsa-encryption")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // RSA parameters
  let p = 17; // Prime 1
  let q = 19; // Prime 2
  let message = 65; // ASCII 'A'
  let time = 0;
  let animationSpeed = 1.0;
  let showSteps = 1;

  // Calculated RSA values
  let n = 0; // p * q
  let phi = 0; // (p-1) * (q-1)
  let e = 0; // Public exponent
  let d = 0; // Private exponent
  let encrypted = 0; // Encrypted message
  let decrypted = 0; // Decrypted message

  // Animation state
  let currentStep = 0;
  let stepProgress = 0;

  // Colors
  const BG = "#0f172a";
  const PRIME_COLOR = "#10b981";
  const PUBLIC_COLOR = "#3b82f6";
  const PRIVATE_COLOR = "#ef4444";
  const MESSAGE_COLOR = "#f59e0b";
  const MATH_COLOR = "#a855f7";
  const HIGHLIGHT_COLOR = "#fbbf24";
  const TEXT_COLOR = "#e2e8f0";
  const PANEL_BG = "rgba(30, 41, 59, 0.9)";
  const STEP_BG = "rgba(59, 130, 246, 0.1)";

  // Utility functions
  function isPrime(num: number): boolean {
    if (num < 2) return false;
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) return false;
    }
    return true;
  }

  function gcd(a: number, b: number): number {
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  function extendedGcd(a: number, b: number): { gcd: number; x: number; y: number } {
    if (b === 0) {
      return { gcd: a, x: 1, y: 0 };
    }
    const result = extendedGcd(b, a % b);
    const x = result.y;
    const y = result.x - Math.floor(a / b) * result.y;
    return { gcd: result.gcd, x, y };
  }

  function modInverse(a: number, m: number): number {
    const result = extendedGcd(a, m);
    if (result.gcd !== 1) return -1; // No inverse exists
    return ((result.x % m) + m) % m;
  }

  function modPow(base: number, exp: number, mod: number): number {
    let result = 1;
    base = base % mod;
    while (exp > 0) {
      if (exp % 2 === 1) {
        result = (result * base) % mod;
      }
      exp = Math.floor(exp / 2);
      base = (base * base) % mod;
    }
    return result;
  }

  function findValidE(phi: number): number {
    // Common choices for e are 3, 65537, etc.
    // Find smallest e > 1 such that gcd(e, phi) = 1
    for (let e = 3; e < phi; e += 2) {
      if (gcd(e, phi) === 1) {
        return e;
      }
    }
    return 65537; // Fallback
  }

  function computePhysics(dt: number, params: Record<string, number>) {
    // Update parameters (simplified - real implementation would validate primes)
    const primeOptions = [7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
    const pIndex = Math.floor((params.primeP ?? 0.5) * primeOptions.length) % primeOptions.length;
    const qIndex = Math.floor((params.primeQ ?? 0.6) * primeOptions.length) % primeOptions.length;
    
    p = primeOptions[pIndex];
    q = primeOptions[qIndex];
    
    // Ensure p ≠ q
    if (p === q) {
      q = primeOptions[(qIndex + 1) % primeOptions.length];
    }

    message = Math.floor((params.message ?? 0.5) * 26) + 65; // A-Z
    animationSpeed = params.animationSpeed ?? animationSpeed;
    showSteps = params.showSteps ?? showSteps;

    time += dt * animationSpeed;

    // Calculate RSA values
    calculateRSA();
    
    // Animation
    if (showSteps) {
      const stepsPerSecond = 0.5;
      stepProgress = (time * stepsPerSecond) % 6;
      currentStep = Math.floor(stepProgress);
    }
  }

  function calculateRSA() {
    // Step 1: Calculate n = p * q
    n = p * q;
    
    // Step 2: Calculate φ(n) = (p-1)(q-1)
    phi = (p - 1) * (q - 1);
    
    // Step 3: Choose e such that 1 < e < φ(n) and gcd(e, φ(n)) = 1
    e = findValidE(phi);
    
    // Step 4: Calculate d = e^(-1) mod φ(n)
    d = modInverse(e, phi);
    if (d < 0) d = 1; // Fallback
    
    // Step 5: Encrypt message
    encrypted = modPow(message, e, n);
    
    // Step 6: Decrypt ciphertext
    decrypted = modPow(encrypted, d, n);
  }

  function drawRSAOverview() {
    const overviewX = width * 0.02;
    const overviewY = height * 0.02;
    const overviewW = width * 0.96;
    const overviewH = height * 0.15;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(overviewX, overviewY, overviewW, overviewH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(overviewX, overviewY, overviewW, overviewH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("RSA Public Key Cryptography", overviewX + overviewW / 2, overviewY + 25);

    // Key information in three columns
    const col1X = overviewX + 20;
    const col2X = overviewX + overviewW / 3;
    const col3X = overviewX + 2 * overviewW / 3;
    const infoY = overviewY + 50;

    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    // Column 1: Primes
    ctx.fillStyle = PRIME_COLOR;
    ctx.fillText("Prime Numbers:", col1X, infoY);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`p = ${p}`, col1X, infoY + 20);
    ctx.fillText(`q = ${q}`, col1X, infoY + 35);
    ctx.fillText(`n = p×q = ${n}`, col1X, infoY + 50);

    // Column 2: Keys
    ctx.fillStyle = PUBLIC_COLOR;
    ctx.fillText("Public Key:", col2X, infoY);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`(e, n) = (${e}, ${n})`, col2X, infoY + 20);
    
    ctx.fillStyle = PRIVATE_COLOR;
    ctx.fillText("Private Key:", col2X, infoY + 35);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`(d, n) = (${d}, ${n})`, col2X, infoY + 50);

    // Column 3: Message
    ctx.fillStyle = MESSAGE_COLOR;
    ctx.fillText("Message:", col3X, infoY);
    ctx.fillStyle = TEXT_COLOR;
    const messageChar = String.fromCharCode(message);
    ctx.fillText(`'${messageChar}' → ${message}`, col3X, infoY + 20);
    ctx.fillText(`Encrypted: ${encrypted}`, col3X, infoY + 35);
    ctx.fillText(`Decrypted: ${decrypted}`, col3X, infoY + 50);
  }

  function drawAlgorithmSteps() {
    const stepsX = width * 0.02;
    const stepsY = height * 0.2;
    const stepsW = width * 0.48;
    const stepsH = height * 0.75;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(stepsX, stepsY, stepsW, stepsH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(stepsX, stepsY, stepsW, stepsH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("RSA Algorithm Steps", stepsX + stepsW / 2, stepsY + 25);

    const steps = [
      {
        title: "1. Choose Two Prime Numbers",
        description: `Select large primes p and q`,
        calculation: `p = ${p}, q = ${q}`,
        color: PRIME_COLOR
      },
      {
        title: "2. Compute n = p × q",
        description: "This will be part of both keys",
        calculation: `n = ${p} × ${q} = ${n}`,
        color: MATH_COLOR
      },
      {
        title: "3. Compute φ(n) = (p-1)(q-1)",
        description: "Euler's totient function",
        calculation: `φ(n) = (${p}-1)(${q}-1) = ${phi}`,
        color: MATH_COLOR
      },
      {
        title: "4. Choose Public Exponent e",
        description: "1 < e < φ(n), gcd(e, φ(n)) = 1",
        calculation: `e = ${e}, gcd(${e}, ${phi}) = ${gcd(e, phi)}`,
        color: PUBLIC_COLOR
      },
      {
        title: "5. Compute Private Exponent d",
        description: "d ≡ e⁻¹ (mod φ(n))",
        calculation: `d = ${d}, verify: ${e}×${d} ≡ ${(e * d) % phi} (mod ${phi})`,
        color: PRIVATE_COLOR
      },
      {
        title: "6. Encryption & Decryption",
        description: "C ≡ M^e (mod n), M ≡ C^d (mod n)",
        calculation: `${message}^${e} ≡ ${encrypted} (mod ${n})`,
        color: MESSAGE_COLOR
      }
    ];

    let y = stepsY + 50;
    const stepHeight = 100;

    steps.forEach((step, index) => {
      // Highlight current step
      const isCurrentStep = showSteps && currentStep === index;
      if (isCurrentStep) {
        ctx.fillStyle = STEP_BG;
        ctx.fillRect(stepsX + 5, y - 15, stepsW - 10, stepHeight - 5);
      }

      // Step title
      ctx.fillStyle = isCurrentStep ? HIGHLIGHT_COLOR : step.color;
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(step.title, stepsX + 15, y);

      // Step description
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "11px monospace";
      ctx.fillText(step.description, stepsX + 15, y + 18);

      // Calculation
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px monospace";
      ctx.fillText(step.calculation, stepsX + 15, y + 35);

      // Show work for current step
      if (isCurrentStep) {
        drawStepDetails(step, index, stepsX + 15, y + 50);
      }

      y += stepHeight;
    });
  }

  function drawStepDetails(step: any, stepIndex: number, x: number, y: number) {
    ctx.fillStyle = "#64748b";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";

    switch (stepIndex) {
      case 0: // Prime selection
        ctx.fillText(`Prime verification: ${p} and ${q} are both prime`, x, y);
        ctx.fillText(`Security note: Real RSA uses 1024+ bit primes`, x, y + 12);
        break;

      case 1: // n calculation
        ctx.fillText(`Modulus n determines key size`, x, y);
        ctx.fillText(`All operations will be mod ${n}`, x, y + 12);
        break;

      case 2: // phi calculation
        ctx.fillText(`φ(n) counts integers < n that are coprime to n`, x, y);
        ctx.fillText(`For n = p×q: φ(n) = (p-1)(q-1)`, x, y + 12);
        break;

      case 3: // e selection
        ctx.fillText(`Common choices: e = 3, 65537 (2^16 + 1)`, x, y);
        ctx.fillText(`gcd(${e}, ${phi}) = 1 ensures e has mod inverse`, x, y + 12);
        break;

      case 4: // d calculation
        ctx.fillText(`Extended Euclidean Algorithm finds d`, x, y);
        ctx.fillText(`Verify: (${e} × ${d}) mod ${phi} = ${(e * d) % phi}`, x, y + 12);
        break;

      case 5: // Encryption/Decryption
        ctx.fillText(`Encrypt: ${message}^${e} mod ${n} = ${encrypted}`, x, y);
        ctx.fillText(`Decrypt: ${encrypted}^${d} mod ${n} = ${decrypted}`, x, y + 12);
        break;
    }
  }

  function drawModularArithmetic() {
    const mathX = width * 0.52;
    const mathY = height * 0.2;
    const mathW = width * 0.46;
    const mathH = height * 0.35;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(mathX, mathY, mathW, mathH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(mathX, mathY, mathW, mathH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Modular Arithmetic", mathX + mathW / 2, mathY + 25);

    // Show step-by-step modular exponentiation for encryption
    let y = mathY + 50;
    const lineHeight = 16;

    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    ctx.fillStyle = MESSAGE_COLOR;
    ctx.fillText("Encryption: M^e mod n", mathX + 10, y);
    y += lineHeight + 5;

    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`${message}^${e} mod ${n}`, mathX + 10, y);
    y += lineHeight;

    // Show binary exponentiation steps for e
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    const eBinary = e.toString(2);
    ctx.fillText(`e = ${e} = ${eBinary}₂`, mathX + 10, y);
    y += lineHeight + 10;

    // Show modular exponentiation process
    if (e <= 16) { // Only show for small exponents
      let base = message;
      let exp = e;
      let result = 1;
      let step = 1;

      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "10px monospace";
      ctx.fillText("Fast modular exponentiation:", mathX + 10, y);
      y += 15;

      while (exp > 0) {
        if (exp % 2 === 1) {
          const oldResult = result;
          result = (result * base) % n;
          ctx.fillStyle = "#10b981";
          ctx.fillText(`Step ${step}: result = (${oldResult} × ${base}) mod ${n} = ${result}`, mathX + 15, y);
          y += 12;
        }
        if (exp > 1) {
          const oldBase = base;
          base = (base * base) % n;
          ctx.fillStyle = "#64748b";
          ctx.fillText(`       base = (${oldBase}²) mod ${n} = ${base}`, mathX + 15, y);
          y += 12;
        }
        exp = Math.floor(exp / 2);
        step++;
        if (y > mathY + mathH - 40) break; // Don't overflow
      }

      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.font = "11px monospace";
      ctx.fillText(`Final result: ${encrypted}`, mathX + 10, y + 5);
    }
  }

  function drawSecurityAnalysis() {
    const secX = width * 0.52;
    const secY = height * 0.57;
    const secW = width * 0.46;
    const secH = height * 0.38;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(secX, secY, secW, secH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(secX, secY, secW, secH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Security Analysis", secX + secW / 2, secY + 25);

    let y = secY + 50;
    const lineHeight = 14;

    ctx.font = "11px monospace";
    ctx.textAlign = "left";

    // Key strength
    const keyBits = Math.floor(Math.log2(n));
    ctx.fillStyle = keyBits >= 10 ? "#10b981" : "#ef4444";
    ctx.fillText(`Key size: ${keyBits} bits (n = ${n})`, secX + 10, y);
    y += lineHeight + 5;

    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    if (keyBits < 10) {
      ctx.fillText("⚠️ Toy example - real RSA uses 2048+ bit keys", secX + 10, y);
    } else {
      ctx.fillText("Real RSA requires much larger primes", secX + 10, y);
    }
    y += lineHeight + 10;

    // Security assumptions
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.fillText("Security Assumptions:", secX + 10, y);
    y += lineHeight + 5;

    const assumptions = [
      "• Factoring large integers is hard",
      "• Computing discrete logs is hard",  
      "• Primes p, q kept secret",
      "• Private key d never exposed"
    ];

    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    assumptions.forEach(assumption => {
      ctx.fillText(assumption, secX + 10, y);
      y += 12;
    });

    y += 10;

    // Attacks
    ctx.fillStyle = PRIVATE_COLOR;
    ctx.font = "11px monospace";
    ctx.fillText("Potential Attacks:", secX + 10, y);
    y += lineHeight + 5;

    const attacks = [
      "• Factor n to recover p, q",
      "• Timing attacks on implementation",
      "• Side-channel attacks",
      "• Quantum computers (Shor's algorithm)"
    ];

    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    attacks.forEach(attack => {
      ctx.fillText(attack, secX + 10, y);
      y += 12;
    });

    // Factorization difficulty
    y += 10;
    ctx.fillStyle = MESSAGE_COLOR;
    ctx.font = "11px monospace";
    ctx.fillText("Factorization Challenge:", secX + 10, y);
    y += lineHeight + 3;

    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px monospace";
    ctx.fillText(`To break this RSA: factor ${n} = ${p} × ${q}`, secX + 10, y);
    y += 12;
    
    const trialDivSteps = Math.ceil(Math.sqrt(n));
    ctx.fillText(`Trial division: ~${trialDivSteps} operations`, secX + 10, y);
    y += 12;
    ctx.fillText("Real RSA: ~2^128 operations needed", secX + 10, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      currentStep = 0;
      stepProgress = 0;
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawRSAOverview();
      drawAlgorithmSteps();
      drawModularArithmetic();
      drawSecurityAnalysis();
    },

    reset() {
      time = 0;
      currentStep = 0;
      stepProgress = 0;
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const keyBits = Math.floor(Math.log2(n));
      const messageChar = String.fromCharCode(message);
      
      return (
        `RSA encryption with primes p = ${p}, q = ${q}: Key size ${keyBits} bits. ` +
        `Public key (e,n) = (${e}, ${n}), private key (d,n) = (${d}, ${n}). ` +
        `Message '${messageChar}' (${message}) encrypts to ${encrypted}, decrypts back to ${decrypted}. ` +
        `Security relies on difficulty of factoring n = ${n} = ${p} × ${q}. ` +
        `RSA enables secure communication without prior shared secrets by using mathematical trapdoor functions.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default RSAEncryption;