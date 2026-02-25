import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Data structure element ──────────────────────────────────────────
interface DataElement {
  value: number;
  id: number;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  animating: boolean;
}

// ─── Operation for animation ──────────────────────────────────────────
interface Operation {
  type: 'push' | 'pop' | 'enqueue' | 'dequeue';
  element?: DataElement;
  timestamp: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const StackQueueVisualizationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stack-queue-visualization") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // Data structures
  let stack: DataElement[] = [];
  let queue: DataElement[] = [];
  let nextElementId = 1;
  let nextValue = 1;

  // Animation state
  let pendingOperations: Operation[] = [];
  let currentOperation: Operation | null = null;
  let animationProgress = 0;
  let stepDelay = 0;

  // Parameters
  let operationSpeed = 3;
  let autoMode = 1;
  let dataStructure = 0; // 0=both, 1=stack only, 2=queue only
  let showComparison = 1;

  const ELEMENT_WIDTH = 60;
  const ELEMENT_HEIGHT = 40;
  const ANIMATION_DURATION = 500; // ms
  const COLORS = [
    "#fbbf24", "#f87171", "#34d399", "#60a5fa", "#a78bfa",
    "#fb7185", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"
  ];

  function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    ctx = canvas.getContext("2d")!;
    resize(canvas.width, canvas.height);
    
    // Initialize with some sample data
    initializeSampleData();
  }

  function resize(width: number, height: number): void {
    W = width;
    H = height;
  }

  function initializeSampleData(): void {
    stack = [];
    queue = [];
    nextElementId = 1;
    nextValue = 1;
    pendingOperations = [];
    currentOperation = null;
    
    // Add initial elements
    for (let i = 0; i < 3; i++) {
      pushToStack(createNewElement());
      enqueueToQueue(createNewElement());
    }
  }

  function createNewElement(): DataElement {
    const element: DataElement = {
      value: nextValue++,
      id: nextElementId++,
      color: COLORS[(nextElementId - 2) % COLORS.length],
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      animating: false
    };
    return element;
  }

  function pushToStack(element: DataElement): void {
    stack.push(element);
    updateStackPositions();
  }

  function popFromStack(): DataElement | undefined {
    const element = stack.pop();
    updateStackPositions();
    return element;
  }

  function enqueueToQueue(element: DataElement): void {
    queue.push(element);
    updateQueuePositions();
  }

  function dequeueFromQueue(): DataElement | undefined {
    const element = queue.shift();
    updateQueuePositions();
    return element;
  }

  function updateStackPositions(): void {
    const stackX = dataStructure === 2 ? W / 2 - ELEMENT_WIDTH / 2 : 150;
    const stackBottomY = H - 150;
    
    for (let i = 0; i < stack.length; i++) {
      const element = stack[i];
      element.targetX = stackX;
      element.targetY = stackBottomY - (i * ELEMENT_HEIGHT) - ELEMENT_HEIGHT;
      
      // Set initial position for new elements
      if (element.x === 0 && element.y === 0) {
        element.x = element.targetX;
        element.y = element.targetY - 100; // Start above
      }
    }
  }

  function updateQueuePositions(): void {
    const queueX = dataStructure === 1 ? W / 2 - ((queue.length * ELEMENT_WIDTH) / 2) : W - 400;
    const queueY = H / 2;
    
    for (let i = 0; i < queue.length; i++) {
      const element = queue[i];
      element.targetX = queueX + (i * ELEMENT_WIDTH);
      element.targetY = queueY;
      
      // Set initial position for new elements
      if (element.x === 0 && element.y === 0) {
        element.x = element.targetX - 100; // Start from left
        element.y = element.targetY;
      }
    }
  }

  function addOperation(operation: Operation): void {
    pendingOperations.push(operation);
  }

  function processNextOperation(): void {
    if (pendingOperations.length === 0 || currentOperation !== null) return;
    
    currentOperation = pendingOperations.shift()!;
    animationProgress = 0;
    
    // Execute the operation
    switch (currentOperation.type) {
      case 'push':
        if (currentOperation.element) {
          pushToStack(currentOperation.element);
          currentOperation.element.animating = true;
        }
        break;
        
      case 'pop':
        const poppedElement = popFromStack();
        if (poppedElement) {
          currentOperation.element = poppedElement;
          poppedElement.animating = true;
          poppedElement.targetX = -100; // Animate off screen
        }
        break;
        
      case 'enqueue':
        if (currentOperation.element) {
          enqueueToQueue(currentOperation.element);
          currentOperation.element.animating = true;
        }
        break;
        
      case 'dequeue':
        const dequeuedElement = dequeueFromQueue();
        if (dequeuedElement) {
          currentOperation.element = dequeuedElement;
          dequeuedElement.animating = true;
          dequeuedElement.targetY = -100; // Animate off screen
        }
        break;
    }
  }

  function updateAnimations(dt: number): void {
    // Update element positions
    const allElements = [...stack, ...queue];
    for (const element of allElements) {
      const dx = element.targetX - element.x;
      const dy = element.targetY - element.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 2) {
        const speed = 5;
        element.x += (dx / distance) * speed;
        element.y += (dy / distance) * speed;
      } else {
        element.x = element.targetX;
        element.y = element.targetY;
        element.animating = false;
      }
    }
    
    // Update current operation animation
    if (currentOperation) {
      animationProgress += dt;
      if (animationProgress >= ANIMATION_DURATION) {
        currentOperation = null;
        animationProgress = 0;
      }
    }
  }

  function generateRandomOperations(): void {
    if (pendingOperations.length > 5) return; // Don't queue too many
    
    const operations: Array<'push' | 'pop' | 'enqueue' | 'dequeue'> = [];
    
    if (dataStructure === 0 || dataStructure === 1) {
      // Stack operations
      operations.push('push');
      if (stack.length > 0) operations.push('pop');
    }
    
    if (dataStructure === 0 || dataStructure === 2) {
      // Queue operations
      operations.push('enqueue');
      if (queue.length > 0) operations.push('dequeue');
    }
    
    if (operations.length === 0) return;
    
    const randomOp = operations[Math.floor(Math.random() * operations.length)];
    const operation: Operation = {
      type: randomOp,
      timestamp: Date.now()
    };
    
    if (randomOp === 'push' || randomOp === 'enqueue') {
      operation.element = createNewElement();
    }
    
    addOperation(operation);
  }

  function update(dt: number, params: Record<string, number>): void {
    operationSpeed = params.operationSpeed ?? 3;
    autoMode = params.autoMode ?? 1;
    dataStructure = params.dataStructure ?? 0;
    showComparison = params.showComparison ?? 1;

    // Update positions when data structure view changes
    updateStackPositions();
    updateQueuePositions();

    // Update animations
    updateAnimations(dt);
    
    // Process operations
    processNextOperation();
    
    // Auto-generate operations
    if (autoMode) {
      stepDelay += dt;
      if (stepDelay >= 1000 / operationSpeed) {
        generateRandomOperations();
        stepDelay = 0;
      }
    }
  }

  function render(): void {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, W, H);

    // Draw based on selected data structure
    if (dataStructure === 0) {
      // Both structures
      drawStack(150);
      drawQueue(W - 400);
      if (showComparison) {
        drawComparison();
      }
    } else if (dataStructure === 1) {
      // Stack only
      drawStack(W / 2 - ELEMENT_WIDTH / 2);
      drawStackInfo();
    } else {
      // Queue only
      drawQueue(W / 2 - ((queue.length * ELEMENT_WIDTH) / 2));
      drawQueueInfo();
    }
    
    // Draw operation info
    drawOperationInfo();
  }

  function drawStack(baseX: number): void {
    // Stack container
    const containerX = baseX - 10;
    const containerY = H - 150 - (Math.max(6, stack.length + 1) * ELEMENT_HEIGHT) - 10;
    const containerW = ELEMENT_WIDTH + 20;
    const containerH = (Math.max(6, stack.length + 1) * ELEMENT_HEIGHT) + 20;
    
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 2;
    ctx.strokeRect(containerX, containerY, containerW, containerH);
    
    // Stack label
    ctx.fillStyle = "#2d3748";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STACK", baseX + ELEMENT_WIDTH/2, containerY - 10);
    ctx.font = "12px sans-serif";
    ctx.fillText("(LIFO - Last In First Out)", baseX + ELEMENT_WIDTH/2, containerY + containerH + 20);
    
    // Draw stack elements
    for (let i = 0; i < stack.length; i++) {
      const element = stack[i];
      drawElement(element, i === stack.length - 1 ? "TOP" : null);
    }
    
    // Stack pointer
    if (stack.length > 0) {
      const topElement = stack[stack.length - 1];
      ctx.strokeStyle = "#f56565";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(topElement.x + ELEMENT_WIDTH + 15, topElement.y + ELEMENT_HEIGHT/2);
      ctx.lineTo(topElement.x + ELEMENT_WIDTH + 35, topElement.y + ELEMENT_HEIGHT/2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "#f56565";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("← TOP", topElement.x + ELEMENT_WIDTH + 40, topElement.y + ELEMENT_HEIGHT/2 + 4);
    }
  }

  function drawQueue(baseX: number): void {
    // Queue container
    const containerX = baseX - 10;
    const containerY = H/2 - ELEMENT_HEIGHT/2 - 10;
    const containerW = Math.max(300, queue.length * ELEMENT_WIDTH) + 20;
    const containerH = ELEMENT_HEIGHT + 20;
    
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 2;
    ctx.strokeRect(containerX, containerY, containerW, containerH);
    
    // Queue label
    ctx.fillStyle = "#2d3748";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("QUEUE", containerX + containerW/2, containerY - 10);
    ctx.font = "12px sans-serif";
    ctx.fillText("(FIFO - First In First Out)", containerX + containerW/2, containerY + containerH + 20);
    
    // Draw queue elements
    for (let i = 0; i < queue.length; i++) {
      const element = queue[i];
      drawElement(element, null);
    }
    
    // Queue pointers
    if (queue.length > 0) {
      // Front pointer
      const frontElement = queue[0];
      ctx.strokeStyle = "#48bb78";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(frontElement.x + ELEMENT_WIDTH/2, frontElement.y - 15);
      ctx.lineTo(frontElement.x + ELEMENT_WIDTH/2, frontElement.y - 35);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "#48bb78";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FRONT", frontElement.x + ELEMENT_WIDTH/2, frontElement.y - 40);
      
      // Rear pointer
      const rearElement = queue[queue.length - 1];
      ctx.strokeStyle = "#f56565";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(rearElement.x + ELEMENT_WIDTH/2, rearElement.y + ELEMENT_HEIGHT + 15);
      ctx.lineTo(rearElement.x + ELEMENT_WIDTH/2, rearElement.y + ELEMENT_HEIGHT + 35);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "#f56565";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("REAR", rearElement.x + ELEMENT_WIDTH/2, rearElement.y + ELEMENT_HEIGHT + 50);
    }
  }

  function drawElement(element: DataElement, label: string | null): void {
    // Element box
    ctx.fillStyle = element.color;
    ctx.fillRect(element.x, element.y, ELEMENT_WIDTH, ELEMENT_HEIGHT);
    
    ctx.strokeStyle = element.animating ? "#2d3748" : "#4a5568";
    ctx.lineWidth = element.animating ? 3 : 1;
    ctx.strokeRect(element.x, element.y, ELEMENT_WIDTH, ELEMENT_HEIGHT);
    
    // Element value
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(element.value.toString(), element.x + ELEMENT_WIDTH/2, element.y + ELEMENT_HEIGHT/2 + 5);
    
    // Label
    if (label) {
      ctx.fillStyle = "#f56565";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, element.x + ELEMENT_WIDTH/2, element.y - 5);
    }
  }

  function drawStackInfo(): void {
    const infoX = 50;
    const infoY = 50;
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    
    ctx.fillText("Stack Operations:", infoX, infoY);
    ctx.font = "12px sans-serif";
    ctx.fillText("• PUSH: Add element to top", infoX, infoY + 25);
    ctx.fillText("• POP: Remove element from top", infoX, infoY + 45);
    ctx.fillText(`• Size: ${stack.length} elements`, infoX, infoY + 65);
    ctx.fillText("• Used in: Function calls, undo operations", infoX, infoY + 85);
  }

  function drawQueueInfo(): void {
    const infoX = 50;
    const infoY = 50;
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    
    ctx.fillText("Queue Operations:", infoX, infoY);
    ctx.font = "12px sans-serif";
    ctx.fillText("• ENQUEUE: Add element to rear", infoX, infoY + 25);
    ctx.fillText("• DEQUEUE: Remove element from front", infoX, infoY + 45);
    ctx.fillText(`• Size: ${queue.length} elements`, infoX, infoY + 65);
    ctx.fillText("• Used in: Task scheduling, breadth-first search", infoX, infoY + 85);
  }

  function drawComparison(): void {
    const compX = W / 2 - 100;
    const compY = 50;
    const compW = 200;
    const compH = 120;
    
    // Comparison box
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(compX, compY, compW, compH);
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(compX, compY, compW, compH);
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Comparison", compX + compW/2, compY + 20);
    
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#2563eb";
    ctx.fillText("Stack (LIFO):", compX + 10, compY + 40);
    ctx.fillStyle = "#2d3748";
    ctx.fillText("• Push/Pop at same end", compX + 15, compY + 55);
    ctx.fillText("• Last added = first removed", compX + 15, compY + 70);
    
    ctx.fillStyle = "#dc2626";
    ctx.fillText("Queue (FIFO):", compX + 10, compY + 90);
    ctx.fillStyle = "#2d3748";
    ctx.fillText("• Add rear, remove front", compX + 15, compY + 105);
  }

  function drawOperationInfo(): void {
    const opX = 20;
    const opY = H - 80;
    
    // Current operation
    if (currentOperation) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Current: ${currentOperation.type.toUpperCase()}`, opX, opY);
      
      if (currentOperation.element) {
        ctx.font = "12px sans-serif";
        ctx.fillText(`Value: ${currentOperation.element.value}`, opX, opY + 20);
      }
    }
    
    // Pending operations
    if (pendingOperations.length > 0) {
      ctx.fillStyle = "#4a5568";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Pending: ${pendingOperations.length} operations`, opX + 150, opY);
    }
    
    // Controls info
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px sans-serif";
    ctx.fillText(`Auto Mode: ${autoMode ? 'ON' : 'OFF'}`, opX + 300, opY);
    ctx.fillText(`Speed: ${operationSpeed}`, opX + 300, opY + 15);
  }

  function getStateDescription(): string {
    const structures = ["both stack and queue", "stack only", "queue only"];
    const current = currentOperation ? `Currently ${currentOperation.type}ing. ` : '';
    
    return `Data Structure Visualization: Showing ${structures[dataStructure]}. ` +
           `Stack has ${stack.length} elements (LIFO), Queue has ${queue.length} elements (FIFO). ` +
           `${current}${pendingOperations.length} operations pending. ` +
           `Auto-mode: ${autoMode ? 'enabled' : 'disabled'} at speed ${operationSpeed}.`;
  }

  function reset(): void {
    initializeSampleData();
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

export default StackQueueVisualizationFactory;