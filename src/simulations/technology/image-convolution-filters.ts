import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Convolution kernel ──────────────────────────────────────────
interface ConvolutionKernel {
  name: string;
  matrix: number[][];
  divisor: number;
  description: string;
}

// ─── Factory ────────────────────────────────────────────────────
const ImageConvolutionFiltersFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("image-convolution-filters") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // Image data
  let originalImage: ImageData | null = null;
  let filteredImage: ImageData | null = null;
  let currentPixelX = 0;
  let currentPixelY = 0;
  let isProcessing = false;
  let processingDelay = 0;

  // Parameters
  let filterType = 0; // Index into kernels array
  let showProcess = 1; // Show step-by-step processing
  let processingSpeed = 10;
  let imageSize = 32; // Size of the sample image

  // Convolution kernels
  const kernels: ConvolutionKernel[] = [
    {
      name: "Identity",
      matrix: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
      divisor: 1,
      description: "No change - original image"
    },
    {
      name: "Blur",
      matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
      divisor: 9,
      description: "Gaussian blur - softens edges"
    },
    {
      name: "Sharpen",
      matrix: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
      divisor: 1,
      description: "Sharpening - enhances edges"
    },
    {
      name: "Edge Detection",
      matrix: [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
      divisor: 1,
      description: "Laplacian edge detection"
    },
    {
      name: "Emboss",
      matrix: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
      divisor: 1,
      description: "3D emboss effect"
    },
    {
      name: "Outline",
      matrix: [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
      divisor: 1,
      description: "Edge outline detection"
    }
  ];

  const PIXEL_SIZE = 8;
  const KERNEL_SIZE = 3;

  function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    ctx = canvas.getContext("2d")!;
    resize(canvas.width, canvas.height);
    
    createSampleImage();
    startConvolution();
  }

  function resize(width: number, height: number): void {
    W = width;
    H = height;
  }

  function createSampleImage(): void {
    // Create a sample image with geometric patterns
    originalImage = ctx.createImageData(imageSize, imageSize);
    const data = originalImage.data;
    
    for (let y = 0; y < imageSize; y++) {
      for (let x = 0; x < imageSize; x++) {
        const i = (y * imageSize + x) * 4;
        
        // Create different patterns based on position
        let r = 0, g = 0, b = 0;
        
        // Checkerboard pattern
        if ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0) {
          r = g = b = 255;
        } else {
          r = g = b = 0;
        }
        
        // Add some geometric shapes
        const centerX = imageSize / 2;
        const centerY = imageSize / 2;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        // Circle
        if (distanceFromCenter < imageSize / 6) {
          r = 255; g = 0; b = 0;
        }
        
        // Diagonal lines
        if (Math.abs(x - y) < 2 || Math.abs(x + y - imageSize) < 2) {
          r = 0; g = 255; b = 0;
        }
        
        // Border
        if (x === 0 || x === imageSize - 1 || y === 0 || y === imageSize - 1) {
          r = 0; g = 0; b = 255;
        }
        
        data[i] = r;     // Red
        data[i + 1] = g; // Green
        data[i + 2] = b; // Blue
        data[i + 3] = 255; // Alpha
      }
    }
  }

  function startConvolution(): void {
    if (!originalImage) return;
    
    filteredImage = ctx.createImageData(imageSize, imageSize);
    currentPixelX = 0;
    currentPixelY = 0;
    isProcessing = true;
    
    // If not showing process, do it all at once
    if (!showProcess) {
      performFullConvolution();
      isProcessing = false;
    }
  }

  function performFullConvolution(): void {
    if (!originalImage || !filteredImage) return;
    
    const kernel = kernels[filterType];
    
    for (let y = 0; y < imageSize; y++) {
      for (let x = 0; x < imageSize; x++) {
        applyKernelToPixel(x, y, kernel);
      }
    }
  }

  function stepConvolution(): void {
    if (!originalImage || !filteredImage || !isProcessing) return;
    
    const kernel = kernels[filterType];
    applyKernelToPixel(currentPixelX, currentPixelY, kernel);
    
    // Move to next pixel
    currentPixelX++;
    if (currentPixelX >= imageSize) {
      currentPixelX = 0;
      currentPixelY++;
      if (currentPixelY >= imageSize) {
        isProcessing = false;
      }
    }
  }

  function applyKernelToPixel(x: number, y: number, kernel: ConvolutionKernel): void {
    if (!originalImage || !filteredImage) return;
    
    const originalData = originalImage.data;
    const filteredData = filteredImage.data;
    
    let r = 0, g = 0, b = 0;
    
    // Apply convolution kernel
    for (let ky = 0; ky < KERNEL_SIZE; ky++) {
      for (let kx = 0; kx < KERNEL_SIZE; kx++) {
        const px = x + kx - Math.floor(KERNEL_SIZE / 2);
        const py = y + ky - Math.floor(KERNEL_SIZE / 2);
        
        // Handle edge cases by clamping
        const clampedX = Math.max(0, Math.min(imageSize - 1, px));
        const clampedY = Math.max(0, Math.min(imageSize - 1, py));
        
        const pixelIndex = (clampedY * imageSize + clampedX) * 4;
        const kernelValue = kernel.matrix[ky][kx];
        
        r += originalData[pixelIndex] * kernelValue;
        g += originalData[pixelIndex + 1] * kernelValue;
        b += originalData[pixelIndex + 2] * kernelValue;
      }
    }
    
    // Apply divisor and clamp values
    r = Math.max(0, Math.min(255, r / kernel.divisor));
    g = Math.max(0, Math.min(255, g / kernel.divisor));
    b = Math.max(0, Math.min(255, b / kernel.divisor));
    
    // Set the result pixel
    const resultIndex = (y * imageSize + x) * 4;
    filteredData[resultIndex] = r;
    filteredData[resultIndex + 1] = g;
    filteredData[resultIndex + 2] = b;
    filteredData[resultIndex + 3] = 255;
  }

  function update(dt: number, params: Record<string, number>): void {
    const newFilterType = params.filterType ?? 0;
    const newShowProcess = params.showProcess ?? 1;
    const newProcessingSpeed = params.processingSpeed ?? 10;
    
    processingSpeed = newProcessingSpeed;
    
    if (newFilterType !== filterType || newShowProcess !== showProcess) {
      filterType = newFilterType;
      showProcess = newShowProcess;
      startConvolution();
    }

    // Step-by-step processing
    if (showProcess && isProcessing) {
      processingDelay += dt;
      if (processingDelay >= 1000 / processingSpeed) {
        stepConvolution();
        processingDelay = 0;
      }
    }
  }

  function render(): void {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, W, H);

    // Draw original image
    drawImage(originalImage, 50, 100, "Original Image");
    
    // Draw filtered image
    drawImage(filteredImage, 350, 100, "Filtered Image");
    
    // Draw kernel visualization
    drawKernel();
    
    // Draw process visualization
    if (showProcess && isProcessing) {
      drawProcessVisualization();
    }
    
    // Draw information
    drawInformation();
  }

  function drawImage(imageData: ImageData | null, x: number, y: number, label: string): void {
    if (!imageData) return;
    
    // Title
    ctx.fillStyle = "#2d3748";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + (imageSize * PIXEL_SIZE) / 2, y - 10);
    
    // Draw image as pixels
    const data = imageData.data;
    for (let py = 0; py < imageSize; py++) {
      for (let px = 0; px < imageSize; px++) {
        const i = (py * imageSize + px) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(
          x + px * PIXEL_SIZE, 
          y + py * PIXEL_SIZE, 
          PIXEL_SIZE, 
          PIXEL_SIZE
        );
        
        // Grid lines
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(
          x + px * PIXEL_SIZE, 
          y + py * PIXEL_SIZE, 
          PIXEL_SIZE, 
          PIXEL_SIZE
        );
      }
    }
    
    // Highlight current pixel during processing
    if (showProcess && isProcessing && label === "Filtered Image") {
      ctx.strokeStyle = "#f56565";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        x + currentPixelX * PIXEL_SIZE - 1,
        y + currentPixelY * PIXEL_SIZE - 1,
        PIXEL_SIZE + 2,
        PIXEL_SIZE + 2
      );
    }
  }

  function drawKernel(): void {
    const kernel = kernels[filterType];
    const kernelX = 50;
    const kernelY = 400;
    const cellSize = 40;
    
    // Title
    ctx.fillStyle = "#2d3748";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${kernel.name} Kernel`, kernelX, kernelY - 10);
    
    // Draw kernel matrix
    for (let y = 0; y < KERNEL_SIZE; y++) {
      for (let x = 0; x < KERNEL_SIZE; x++) {
        const value = kernel.matrix[y][x];
        const cellX = kernelX + x * cellSize;
        const cellY = kernelY + y * cellSize;
        
        // Cell background
        ctx.fillStyle = value > 0 ? "#e6fffa" : value < 0 ? "#fed7d7" : "#f7fafc";
        ctx.fillRect(cellX, cellY, cellSize, cellSize);
        
        // Cell border
        ctx.strokeStyle = "#cbd5e0";
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, cellSize, cellSize);
        
        // Cell value
        ctx.fillStyle = "#2d3748";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          value.toString(), 
          cellX + cellSize / 2, 
          cellY + cellSize / 2 + 5
        );
        
        // Highlight center cell
        if (x === 1 && y === 1) {
          ctx.strokeStyle = "#f56565";
          ctx.lineWidth = 2;
          ctx.strokeRect(cellX, cellY, cellSize, cellSize);
        }
      }
    }
    
    // Divisor
    ctx.fillStyle = "#4a5568";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Divisor: ${kernel.divisor}`, kernelX, kernelY + KERNEL_SIZE * cellSize + 20);
    ctx.fillText(kernel.description, kernelX, kernelY + KERNEL_SIZE * cellSize + 40);
  }

  function drawProcessVisualization(): void {
    if (!originalImage || !isProcessing) return;
    
    const processX = 400;
    const processY = 400;
    const scale = 12;
    const kernel = kernels[filterType];
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Current Operation:", processX, processY - 10);
    
    // Draw the 3x3 region being processed
    for (let ky = 0; ky < KERNEL_SIZE; ky++) {
      for (let kx = 0; kx < KERNEL_SIZE; kx++) {
        const px = currentPixelX + kx - Math.floor(KERNEL_SIZE / 2);
        const py = currentPixelY + ky - Math.floor(KERNEL_SIZE / 2);
        
        const clampedX = Math.max(0, Math.min(imageSize - 1, px));
        const clampedY = Math.max(0, Math.min(imageSize - 1, py));
        
        const pixelIndex = (clampedY * imageSize + clampedX) * 4;
        const originalData = originalImage.data;
        
        const r = originalData[pixelIndex];
        const g = originalData[pixelIndex + 1];
        const b = originalData[pixelIndex + 2];
        
        const cellX = processX + kx * scale * 4;
        const cellY = processY + ky * scale * 3;
        
        // Draw pixel
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(cellX, cellY, scale * 3, scale * 2);
        
        // Draw kernel value
        ctx.fillStyle = "#2d3748";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          kernel.matrix[ky][kx].toString(),
          cellX + scale * 1.5,
          cellY + scale * 3
        );
        
        // Highlight center
        if (kx === 1 && ky === 1) {
          ctx.strokeStyle = "#f56565";
          ctx.lineWidth = 2;
          ctx.strokeRect(cellX, cellY, scale * 3, scale * 2);
        }
      }
    }
    
    // Show progress
    const progress = ((currentPixelY * imageSize + currentPixelX) / (imageSize * imageSize)) * 100;
    ctx.fillStyle = "#4a5568";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Progress: ${progress.toFixed(1)}%`, processX, processY + 120);
    ctx.fillText(`Pixel: (${currentPixelX}, ${currentPixelY})`, processX, processY + 140);
  }

  function drawInformation(): void {
    const infoX = 550;
    const infoY = 400;
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Convolution Info:", infoX, infoY);
    
    ctx.font = "12px sans-serif";
    ctx.fillText("1. Place kernel over each pixel", infoX, infoY + 25);
    ctx.fillText("2. Multiply overlapping values", infoX, infoY + 45);
    ctx.fillText("3. Sum all products", infoX, infoY + 65);
    ctx.fillText("4. Divide by kernel divisor", infoX, infoY + 85);
    ctx.fillText("5. Clamp result to [0, 255]", infoX, infoY + 105);
    
    // Filter list
    ctx.fillStyle = "#4a5568";
    ctx.font = "12px sans-serif";
    ctx.fillText("Available Filters:", infoX, infoY + 140);
    
    for (let i = 0; i < kernels.length; i++) {
      const color = i === filterType ? "#f56565" : "#4a5568";
      ctx.fillStyle = color;
      ctx.fillText(`${i}: ${kernels[i].name}`, infoX, infoY + 160 + i * 15);
    }
    
    // Status
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    const status = isProcessing ? "Processing..." : "Complete";
    ctx.fillText(`Status: ${status}`, infoX, infoY + 260);
  }

  function getStateDescription(): string {
    const kernel = kernels[filterType];
    const progress = isProcessing ? 
      `Processing pixel (${currentPixelX}, ${currentPixelY}) - ${(((currentPixelY * imageSize + currentPixelX) / (imageSize * imageSize)) * 100).toFixed(1)}% complete` :
      "Processing complete";
    
    return `Image Convolution Filters: Applying ${kernel.name} filter to ${imageSize}×${imageSize} image. ` +
           `${kernel.description}. Kernel size: ${KERNEL_SIZE}×${KERNEL_SIZE}, divisor: ${kernel.divisor}. ` +
           `${progress}. Step-by-step visualization: ${showProcess ? 'enabled' : 'disabled'}.`;
  }

  function reset(): void {
    createSampleImage();
    startConvolution();
  }

  function destroy(): void {
    // Cleanup if needed
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

export default ImageConvolutionFiltersFactory;