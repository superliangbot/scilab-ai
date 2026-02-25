import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Binary search tree node ──────────────────────────────────────────
interface BSTNode {
  value: number;
  left: BSTNode | null;
  right: BSTNode | null;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  highlighted: boolean;
  color: string;
  id: number;
}

// ─── Tree operation for animation ──────────────────────────────────────
interface TreeOperation {
  type: 'insert' | 'delete' | 'search';
  value: number;
  path: number[];
  currentStep: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const BinarySearchTreeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("binary-search-tree") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // Tree state
  let root: BSTNode | null = null;
  let nextNodeId = 1;
  let currentOperation: TreeOperation | null = null;
  let animationDelay = 0;
  let searchResult: BSTNode | null = null;

  // Parameters
  let autoInsert = 1;
  let operationSpeed = 2;
  let treeType = 0; // 0=balanced, 1=random, 2=custom

  const NODE_RADIUS = 20;
  const LEVEL_HEIGHT = 70;
  const MIN_HORIZONTAL_SPACING = 50;

  const COLORS = {
    normal: "#bee3f8",
    highlighted: "#fbbf24",
    found: "#48bb78",
    notFound: "#f56565",
    inserting: "#a78bfa"
  };

  function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    ctx = canvas.getContext("2d")!;
    resize(canvas.width, canvas.height);
    
    initializeTree();
  }

  function resize(width: number, height: number): void {
    W = width;
    H = height;
  }

  function initializeTree(): void {
    root = null;
    nextNodeId = 1;
    currentOperation = null;
    searchResult = null;
    
    if (treeType === 0) {
      // Balanced tree
      const values = [50, 30, 70, 20, 40, 60, 80, 15, 25, 35, 45];
      for (const value of values) {
        insert(value);
      }
    } else if (treeType === 1) {
      // Random tree
      const values: number[] = [];
      for (let i = 0; i < 10; i++) {
        let value;
        do {
          value = Math.floor(Math.random() * 100) + 1;
        } while (values.includes(value));
        values.push(value);
      }
      for (const value of values) {
        insert(value);
      }
    }
    
    updatePositions();
  }

  function createNode(value: number): BSTNode {
    return {
      value,
      left: null,
      right: null,
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      highlighted: false,
      color: COLORS.normal,
      id: nextNodeId++
    };
  }

  function insert(value: number): void {
    if (root === null) {
      root = createNode(value);
      return;
    }
    
    insertNode(root, value);
  }

  function insertNode(node: BSTNode, value: number): void {
    if (value < node.value) {
      if (node.left === null) {
        node.left = createNode(value);
      } else {
        insertNode(node.left, value);
      }
    } else if (value > node.value) {
      if (node.right === null) {
        node.right = createNode(value);
      } else {
        insertNode(node.right, value);
      }
    }
    // Ignore duplicates
  }

  function deleteNode(value: number): void {
    root = deleteNodeRecursive(root, value);
  }

  function deleteNodeRecursive(node: BSTNode | null, value: number): BSTNode | null {
    if (node === null) return null;
    
    if (value < node.value) {
      node.left = deleteNodeRecursive(node.left, value);
    } else if (value > node.value) {
      node.right = deleteNodeRecursive(node.right, value);
    } else {
      // Node to delete found
      if (node.left === null) return node.right;
      if (node.right === null) return node.left;
      
      // Node has two children
      const minRight = findMin(node.right);
      node.value = minRight.value;
      node.right = deleteNodeRecursive(node.right, minRight.value);
    }
    
    return node;
  }

  function findMin(node: BSTNode): BSTNode {
    while (node.left !== null) {
      node = node.left;
    }
    return node;
  }

  function search(value: number): BSTNode | null {
    return searchNode(root, value);
  }

  function searchNode(node: BSTNode | null, value: number): BSTNode | null {
    if (node === null || node.value === value) {
      return node;
    }
    
    if (value < node.value) {
      return searchNode(node.left, value);
    } else {
      return searchNode(node.right, value);
    }
  }

  function getSearchPath(value: number): number[] {
    const path: number[] = [];
    let current = root;
    
    while (current !== null) {
      path.push(current.value);
      if (value === current.value) {
        break;
      } else if (value < current.value) {
        current = current.left;
      } else {
        current = current.right;
      }
    }
    
    return path;
  }

  function updatePositions(): void {
    if (root === null) return;
    
    // Calculate tree width needed
    const treeWidth = calculateTreeWidth(root);
    const startX = W / 2;
    const startY = 80;
    
    positionNodes(root, startX, startY, treeWidth / 2, 0);
  }

  function calculateTreeWidth(node: BSTNode | null): number {
    if (node === null) return 0;
    
    const leftWidth = calculateTreeWidth(node.left);
    const rightWidth = calculateTreeWidth(node.right);
    
    return Math.max(MIN_HORIZONTAL_SPACING, leftWidth + rightWidth + NODE_RADIUS * 2);
  }

  function positionNodes(node: BSTNode, x: number, y: number, xSpacing: number, level: number): void {
    node.targetX = x;
    node.targetY = y;
    
    // Smooth animation to target position
    const dx = node.targetX - node.x;
    const dy = node.targetY - node.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      node.x += dx * 0.1;
      node.y += dy * 0.1;
    } else {
      node.x = node.targetX;
      node.y = node.targetY;
    }
    
    if (node.left !== null) {
      positionNodes(
        node.left, 
        x - xSpacing / 2, 
        y + LEVEL_HEIGHT, 
        xSpacing / 2, 
        level + 1
      );
    }
    
    if (node.right !== null) {
      positionNodes(
        node.right, 
        x + xSpacing / 2, 
        y + LEVEL_HEIGHT, 
        xSpacing / 2, 
        level + 1
      );
    }
  }

  function clearHighlights(): void {
    traverseAndApply(root, (node) => {
      node.highlighted = false;
      node.color = COLORS.normal;
    });
  }

  function traverseAndApply(node: BSTNode | null, fn: (node: BSTNode) => void): void {
    if (node === null) return;
    fn(node);
    traverseAndApply(node.left, fn);
    traverseAndApply(node.right, fn);
  }

  function startOperation(type: 'insert' | 'delete' | 'search', value: number): void {
    clearHighlights();
    
    currentOperation = {
      type,
      value,
      path: getSearchPath(value),
      currentStep: 0
    };
    
    if (type === 'insert') {
      insert(value);
      updatePositions();
    } else if (type === 'delete') {
      deleteNode(value);
      updatePositions();
    } else if (type === 'search') {
      searchResult = search(value);
    }
  }

  function stepOperation(): void {
    if (!currentOperation) return;
    
    const { type, path, currentStep } = currentOperation;
    
    if (currentStep < path.length) {
      // Highlight current node in path
      const nodeValue = path[currentStep];
      const node = findNodeByValue(root, nodeValue);
      
      if (node) {
        clearHighlights();
        node.highlighted = true;
        
        if (type === 'search') {
          if (currentStep === path.length - 1) {
            // Final step
            node.color = searchResult ? COLORS.found : COLORS.notFound;
          } else {
            node.color = COLORS.highlighted;
          }
        } else {
          node.color = COLORS.highlighted;
        }
      }
      
      currentOperation.currentStep++;
    } else {
      // Operation complete
      currentOperation = null;
    }
  }

  function findNodeByValue(node: BSTNode | null, value: number): BSTNode | null {
    if (node === null) return null;
    if (node.value === value) return node;
    
    const leftResult = findNodeByValue(node.left, value);
    if (leftResult) return leftResult;
    
    return findNodeByValue(node.right, value);
  }

  function generateRandomOperation(): void {
    const operations = ['insert', 'search'] as const;
    if (root !== null) {
      operations.push('delete');
    }
    
    const operation = operations[Math.floor(Math.random() * operations.length)];
    const value = Math.floor(Math.random() * 100) + 1;
    
    startOperation(operation, value);
  }

  function update(dt: number, params: Record<string, number>): void {
    const newAutoInsert = params.autoInsert ?? 1;
    const newOperationSpeed = params.operationSpeed ?? 2;
    const newTreeType = params.treeType ?? 0;
    
    autoInsert = newAutoInsert;
    operationSpeed = newOperationSpeed;
    
    if (newTreeType !== treeType) {
      treeType = newTreeType;
      initializeTree();
    }

    // Update positions
    updatePositions();
    
    // Step current operation
    if (currentOperation) {
      animationDelay += dt;
      if (animationDelay >= 1000 / operationSpeed) {
        stepOperation();
        animationDelay = 0;
      }
    }
    
    // Auto-generate operations
    if (autoInsert && !currentOperation) {
      animationDelay += dt;
      if (animationDelay >= 2000) { // 2 second delay between operations
        generateRandomOperation();
        animationDelay = 0;
      }
    }
  }

  function render(): void {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, W, H);

    if (root !== null) {
      // Draw edges first
      drawEdges(root);
      
      // Draw nodes
      drawNodes(root);
    }
    
    // Draw information panel
    drawInfoPanel();
    
    // Draw operation info
    drawOperationInfo();
    
    // Draw traversal examples
    drawTraversals();
  }

  function drawEdges(node: BSTNode): void {
    if (node.left !== null) {
      ctx.strokeStyle = "#cbd5e0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(node.left.x, node.left.y);
      ctx.stroke();
      
      drawEdges(node.left);
    }
    
    if (node.right !== null) {
      ctx.strokeStyle = "#cbd5e0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(node.right.x, node.right.y);
      ctx.stroke();
      
      drawEdges(node.right);
    }
  }

  function drawNodes(node: BSTNode): void {
    // Draw node circle
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    
    // Node border
    ctx.strokeStyle = node.highlighted ? "#2d3748" : "#4a5568";
    ctx.lineWidth = node.highlighted ? 3 : 2;
    ctx.stroke();
    
    // Node value
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(node.value.toString(), node.x, node.y + 5);
    
    // Draw children
    if (node.left !== null) {
      drawNodes(node.left);
    }
    if (node.right !== null) {
      drawNodes(node.right);
    }
  }

  function drawInfoPanel(): void {
    const panelX = 20;
    const panelY = 20;
    const panelW = 200;
    const panelH = 160;
    
    // Panel background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    // Title
    ctx.fillStyle = "#2d3748";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Binary Search Tree", panelX + 10, panelY + 20);
    
    // Properties
    const height = getTreeHeight(root);
    const nodeCount = getNodeCount(root);
    
    ctx.font = "12px sans-serif";
    ctx.fillText(`Nodes: ${nodeCount}`, panelX + 10, panelY + 45);
    ctx.fillText(`Height: ${height}`, panelX + 10, panelY + 65);
    ctx.fillText(`Balanced: ${isBalanced(root) ? 'Yes' : 'No'}`, panelX + 10, panelY + 85);
    
    const treeTypes = ["Balanced", "Random", "Custom"];
    ctx.fillText(`Type: ${treeTypes[treeType]}`, panelX + 10, panelY + 105);
    ctx.fillText(`Auto: ${autoInsert ? 'ON' : 'OFF'}`, panelX + 10, panelY + 125);
    ctx.fillText(`Speed: ${operationSpeed}×`, panelX + 10, panelY + 145);
  }

  function drawOperationInfo(): void {
    if (!currentOperation) return;
    
    const opX = 250;
    const opY = 20;
    const opW = 300;
    const opH = 80;
    
    // Panel background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(opX, opY, opW, opH);
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(opX, opY, opW, opH);
    
    // Operation info
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Operation: ${currentOperation.type.toUpperCase()}`, opX + 10, opY + 20);
    ctx.fillText(`Value: ${currentOperation.value}`, opX + 10, opY + 40);
    ctx.fillText(`Step: ${currentOperation.currentStep}/${currentOperation.path.length}`, opX + 10, opY + 60);
    
    // Path
    ctx.font = "12px sans-serif";
    const pathStr = currentOperation.path.slice(0, currentOperation.currentStep + 1).join(' → ');
    ctx.fillText(`Path: ${pathStr}`, opX + 120, opY + 20);
    
    // Result for search
    if (currentOperation.type === 'search' && currentOperation.currentStep >= currentOperation.path.length) {
      const result = searchResult ? 'Found!' : 'Not found';
      ctx.fillStyle = searchResult ? COLORS.found : COLORS.notFound;
      ctx.fillText(`Result: ${result}`, opX + 120, opY + 40);
    }
  }

  function drawTraversals(): void {
    const travX = W - 250;
    const travY = 20;
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Tree Traversals:", travX, travY);
    
    ctx.font = "12px sans-serif";
    
    // Inorder (sorted)
    const inorder = getInorderTraversal(root);
    ctx.fillText(`In-order: ${inorder.join(', ')}`, travX, travY + 25);
    
    // Preorder
    const preorder = getPreorderTraversal(root);
    ctx.fillText(`Pre-order: ${preorder.join(', ')}`, travX, travY + 45);
    
    // Postorder
    const postorder = getPostorderTraversal(root);
    ctx.fillText(`Post-order: ${postorder.join(', ')}`, travX, travY + 65);
    
    // Level order
    const levelorder = getLevelorderTraversal(root);
    ctx.fillText(`Level-order: ${levelorder.join(', ')}`, travX, travY + 85);
  }

  function getTreeHeight(node: BSTNode | null): number {
    if (node === null) return 0;
    return 1 + Math.max(getTreeHeight(node.left), getTreeHeight(node.right));
  }

  function getNodeCount(node: BSTNode | null): number {
    if (node === null) return 0;
    return 1 + getNodeCount(node.left) + getNodeCount(node.right);
  }

  function isBalanced(node: BSTNode | null): boolean {
    if (node === null) return true;
    
    const leftHeight = getTreeHeight(node.left);
    const rightHeight = getTreeHeight(node.right);
    
    return Math.abs(leftHeight - rightHeight) <= 1 && 
           isBalanced(node.left) && 
           isBalanced(node.right);
  }

  function getInorderTraversal(node: BSTNode | null): number[] {
    if (node === null) return [];
    return [
      ...getInorderTraversal(node.left),
      node.value,
      ...getInorderTraversal(node.right)
    ];
  }

  function getPreorderTraversal(node: BSTNode | null): number[] {
    if (node === null) return [];
    return [
      node.value,
      ...getPreorderTraversal(node.left),
      ...getPreorderTraversal(node.right)
    ];
  }

  function getPostorderTraversal(node: BSTNode | null): number[] {
    if (node === null) return [];
    return [
      ...getPostorderTraversal(node.left),
      ...getPostorderTraversal(node.right),
      node.value
    ];
  }

  function getLevelorderTraversal(node: BSTNode | null): number[] {
    if (node === null) return [];
    
    const result: number[] = [];
    const queue: BSTNode[] = [node];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current.value);
      
      if (current.left) queue.push(current.left);
      if (current.right) queue.push(current.right);
    }
    
    return result;
  }

  function getStateDescription(): string {
    const nodeCount = getNodeCount(root);
    const height = getTreeHeight(root);
    const balanced = isBalanced(root) ? 'balanced' : 'unbalanced';
    
    let operationDesc = '';
    if (currentOperation) {
      operationDesc = `Currently ${currentOperation.type}ing value ${currentOperation.value}, step ${currentOperation.currentStep}/${currentOperation.path.length}. `;
    }
    
    return `Binary Search Tree: ${nodeCount} nodes, height ${height}, ${balanced}. ` +
           `${operationDesc}Tree maintains BST property: left < root < right. ` +
           `In-order traversal produces sorted sequence. Average O(log n) operations. ` +
           `Auto-operations: ${autoInsert ? 'enabled' : 'disabled'}.`;
  }

  function reset(): void {
    initializeTree();
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

export default BinarySearchTreeFactory;