import { SimulationEngine } from '../types';

interface RSAState {
  primeP: number;
  primeQ: number;
  n: number;
  phi: number;
  e: number;
  d: number;
  message: number;
  encrypted: number;
  decrypted: number;
  step: number;
  animationTime: number;
  steps: string[];
  currentStep: number;
}

export default class RSAEncryptionSimulation implements SimulationEngine<RSAState> {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId?: number;
  private state!: RSAState;

  // Small primes for educational demo
  private primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.reset();
  }

  reset(): void {
    this.state = {
      primeP: 7,
      primeQ: 11,
      n: 0,
      phi: 0,
      e: 3,
      d: 0,
      message: 5,
      encrypted: 0,
      decrypted: 0,
      step: 0,
      animationTime: 0,
      steps: [
        '1. Choose two prime numbers p and q',
        '2. Calculate n = p × q',
        '3. Calculate φ(n) = (p-1) × (q-1)',
        '4. Choose e coprime to φ(n)',
        '5. Calculate d: e × d ≡ 1 (mod φ(n))',
        '6. Public key: (e, n)',
        '7. Private key: (d, n)',
        '8. Encrypt: C = M^e mod n',
        '9. Decrypt: M = C^d mod n'
      ],
      currentStep: 0
    };
    this.calculateRSAValues();
  }

  private calculateRSAValues(): void {
    this.state.n = this.state.primeP * this.state.primeQ;
    this.state.phi = (this.state.primeP - 1) * (this.state.primeQ - 1);
    
    // Find valid e (coprime to phi)
    this.state.e = this.findValidE();
    
    // Calculate d (modular multiplicative inverse)
    this.state.d = this.modInverse(this.state.e, this.state.phi);
    
    // Encrypt and decrypt
    this.state.encrypted = this.modPow(this.state.message, this.state.e, this.state.n);
    this.state.decrypted = this.modPow(this.state.encrypted, this.state.d, this.state.n);
  }

  private findValidE(): number {
    for (let e = 3; e < this.state.phi; e += 2) {
      if (this.gcd(e, this.state.phi) === 1) {
        return e;
      }
    }
    return 3;
  }

  private gcd(a: number, b: number): number {
    while (b !== 0) {
      [a, b] = [b, a % b];
    }
    return a;
  }

  private modInverse(a: number, m: number): number {
    // Extended Euclidean Algorithm
    let [oldR, r] = [a, m];
    let [oldS, s] = [1, 0];
    
    while (r !== 0) {
      const quotient = Math.floor(oldR / r);
      [oldR, r] = [r, oldR - quotient * r];
      [oldS, s] = [s, oldS - quotient * s];
    }
    
    return oldS > 0 ? oldS : oldS + m;
  }

  private modPow(base: number, exp: number, mod: number): number {
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

  update(deltaTime: number, parameters: Record<string, number>): void {
    const pIndex = Math.floor(parameters.primeP * this.primes.length);
    const qIndex = Math.floor(parameters.primeQ * this.primes.length);
    const messageParam = Math.floor(parameters.message * 25) + 1;
    
    this.state.primeP = this.primes[Math.min(pIndex, this.primes.length - 1)];
    this.state.primeQ = this.primes[Math.min(qIndex, this.primes.length - 1)];
    
    if (this.state.primeP !== this.state.primeQ) {
      this.state.message = Math.min(messageParam, this.state.primeP * this.state.primeQ - 1);
      this.calculateRSAValues();
    }
    
    this.state.animationTime += deltaTime * (parameters.animationSpeed || 1.0);
    
    // Cycle through steps
    this.state.currentStep = Math.floor((this.state.animationTime / 2000) % this.state.steps.length);
  }

  render(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    // Draw background
    this.ctx.fillStyle = '#0a0f1a';
    this.ctx.fillRect(0, 0, width, height);

    // Draw title
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillText('RSA Encryption Algorithm', 20, 40);

    // Draw RSA steps
    this.drawRSASteps();

    // Draw key generation process
    this.drawKeyGeneration();

    // Draw encryption/decryption process
    this.drawEncryption();

    // Draw visual representation
    this.drawVisualRSA();
  }

  private drawRSASteps(): void {
    const startY = 80;
    this.ctx.font = '16px Arial';
    
    this.state.steps.forEach((step, i) => {
      if (i === this.state.currentStep) {
        this.ctx.fillStyle = '#ffeb3b';
        this.ctx.fillRect(15, startY + i * 25 - 2, this.canvas.width - 30, 20);
      }
      
      this.ctx.fillStyle = i === this.state.currentStep ? '#000000' : '#ffffff';
      this.ctx.fillText(step, 20, startY + i * 25 + 12);
    });
  }

  private drawKeyGeneration(): void {
    const { width } = this.canvas;
    const startX = width - 350;
    const startY = 80;
    
    // Background for key generation
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(startX - 10, startY - 10, 340, 200);
    this.ctx.strokeStyle = '#4a4a6a';
    this.ctx.strokeRect(startX - 10, startY - 10, 340, 200);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.fillText('Key Generation:', startX, startY + 15);
    
    this.ctx.font = '14px Arial';
    const keySteps = [
      `p = ${this.state.primeP} (prime)`,
      `q = ${this.state.primeQ} (prime)`,
      `n = p × q = ${this.state.n}`,
      `φ(n) = (p-1)(q-1) = ${this.state.phi}`,
      `e = ${this.state.e} (coprime to φ(n))`,
      `d = ${this.state.d} (e⁻¹ mod φ(n))`,
      '',
      `Public Key: (${this.state.e}, ${this.state.n})`,
      `Private Key: (${this.state.d}, ${this.state.n})`
    ];
    
    keySteps.forEach((step, i) => {
      if (i === 7) this.ctx.fillStyle = '#00ff88'; // Public key in green
      else if (i === 8) this.ctx.fillStyle = '#ff6b6b'; // Private key in red
      else this.ctx.fillStyle = '#ffffff';
      
      this.ctx.fillText(step, startX, startY + 35 + i * 18);
    });
  }

  private drawEncryption(): void {
    const { width, height } = this.canvas;
    const startX = width - 350;
    const startY = height - 150;
    
    // Background for encryption
    this.ctx.fillStyle = '#1a2e1a';
    this.ctx.fillRect(startX - 10, startY - 10, 340, 140);
    this.ctx.strokeStyle = '#4a6a4a';
    this.ctx.strokeRect(startX - 10, startY - 10, 340, 140);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.fillText('Encryption/Decryption:', startX, startY + 15);
    
    this.ctx.font = '14px Arial';
    const encSteps = [
      `Message (M): ${this.state.message}`,
      `Encrypt: C = M^e mod n`,
      `C = ${this.state.message}^${this.state.e} mod ${this.state.n} = ${this.state.encrypted}`,
      '',
      `Decrypt: M = C^d mod n`,
      `M = ${this.state.encrypted}^${this.state.d} mod ${this.state.n} = ${this.state.decrypted}`,
      '',
      `✓ Original message recovered!`
    ];
    
    encSteps.forEach((step, i) => {
      if (i === 7 && this.state.message === this.state.decrypted) {
        this.ctx.fillStyle = '#00ff88';
      } else if (i === 2) {
        this.ctx.fillStyle = '#ffeb3b';
      } else if (i === 5) {
        this.ctx.fillStyle = '#ff9800';
      } else {
        this.ctx.fillStyle = '#ffffff';
      }
      
      this.ctx.fillText(step, startX, startY + 35 + i * 16);
    });
  }

  private drawVisualRSA(): void {
    const centerX = 200;
    const centerY = 350;
    
    // Draw message flow
    this.drawMessageFlow(centerX, centerY);
    
    // Draw key boxes
    this.drawKeyBox(50, 450, 'Public Key', `(${this.state.e}, ${this.state.n})`, '#00ff88');
    this.drawKeyBox(250, 450, 'Private Key', `(${this.state.d}, ${this.state.n})`, '#ff6b6b');
  }

  private drawMessageFlow(centerX: number, centerY: number): void {
    const boxWidth = 80;
    const boxHeight = 50;
    
    // Message box
    this.drawBox(centerX - 150, centerY, boxWidth, boxHeight, `M = ${this.state.message}`, '#4fc3f7');
    
    // Encrypted box
    this.drawBox(centerX, centerY, boxWidth, boxHeight, `C = ${this.state.encrypted}`, '#ffeb3b');
    
    // Decrypted box
    this.drawBox(centerX + 150, centerY, boxWidth, boxHeight, `M = ${this.state.decrypted}`, '#4fc3f7');
    
    // Arrows
    this.drawArrow(centerX - 110, centerY + 25, centerX - 40, centerY + 25, 'Encrypt');
    this.drawArrow(centerX + 40, centerY + 25, centerX + 110, centerY + 25, 'Decrypt');
  }

  private drawBox(x: number, y: number, w: number, h: number, text: string, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.strokeRect(x, y, w, h);
    
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, x + w/2, y + h/2 + 4);
    this.ctx.textAlign = 'start';
  }

  private drawKeyBox(x: number, y: number, title: string, key: string, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, 140, 60);
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.strokeRect(x, y, 140, 60);
    
    this.ctx.fillStyle = '#000000';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(title, x + 70, y + 20);
    this.ctx.font = '11px Arial';
    this.ctx.fillText(key, x + 70, y + 40);
    this.ctx.textAlign = 'start';
  }

  private drawArrow(x1: number, y1: number, x2: number, y2: number, label: string): void {
    // Arrow line
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    
    // Arrow head
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headlen = 10;
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI/6), y2 - headlen * Math.sin(angle - Math.PI/6));
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI/6), y2 - headlen * Math.sin(angle + Math.PI/6));
    this.ctx.stroke();
    
    // Label
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - 5);
    this.ctx.textAlign = 'start';
  }

  getStateDescription(): string {
    return `RSA encryption with primes p=${this.state.primeP}, q=${this.state.primeQ}. Message ${this.state.message} encrypts to ${this.state.encrypted} with public key (${this.state.e}, ${this.state.n}), then decrypts back to ${this.state.decrypted} with private key (${this.state.d}, ${this.state.n}). Security relies on the difficulty of factoring n=${this.state.n}.`;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}