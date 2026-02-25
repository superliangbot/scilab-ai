import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const GeneticsPunnettSquareFactory: SimulationFactory = () => {
  const config = getSimConfig("genetics-punnett-square")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let traitType = 0;        // 0=eye color, 1=flower color, 2=height, 3=blood type
  let dominancePattern = 0; // 0=complete, 1=incomplete, 2=codominance
  let parentA_allele1 = 0;  // 0=dominant, 1=recessive
  let parentA_allele2 = 0;

  // Genetic traits database
  const traits = [
    {
      name: "Eye Color",
      dominantSymbol: "B", recessiveSymbol: "b",
      dominantName: "Brown", recessiveName: "Blue",
      dominantColor: "#8B4513", recessiveColor: "#4169E1",
      intermediateColor: "#696969"
    },
    {
      name: "Flower Color",
      dominantSymbol: "R", recessiveSymbol: "r", 
      dominantName: "Red", recessiveName: "White",
      dominantColor: "#DC143C", recessiveColor: "#FFFFFF",
      intermediateColor: "#FFB6C1"
    },
    {
      name: "Plant Height",
      dominantSymbol: "T", recessiveSymbol: "t",
      dominantName: "Tall", recessiveName: "Short", 
      dominantColor: "#228B22", recessiveColor: "#90EE90",
      intermediateColor: "#9ACD32"
    },
    {
      name: "Blood Type",
      dominantSymbol: "A", recessiveSymbol: "O",
      dominantName: "Type A", recessiveName: "Type O",
      dominantColor: "#CD5C5C", recessiveColor: "#F0E68C",
      intermediateColor: "#DDA0DD"
    }
  ];

  // Offspring visualization
  let offspring: Array<{
    genotype: string;
    phenotype: string;
    color: string;
    x: number;
    y: number;
    age: number;
  }> = [];

  let animatedCross = false;
  let crossingAnimation = { phase: 0, active: false };

  function getCurrentTrait() {
    return traits[Math.floor(traitType) % traits.length];
  }

  function getAlleleSymbol(alleleIndex: number, isSecond: boolean = false): string {
    const trait = getCurrentTrait();
    
    if (traitType === 3 && dominancePattern === 2) {
      // Blood type codominance special case
      const symbols = ['A', 'B', 'O'];
      return symbols[alleleIndex % 3];
    }
    
    return alleleIndex === 0 ? trait.dominantSymbol : trait.recessiveSymbol;
  }

  function getGenotypeColor(genotype: string): string {
    const trait = getCurrentTrait();
    
    if (dominancePattern === 0) {
      // Complete dominance
      if (genotype.includes(trait.dominantSymbol)) {
        return trait.dominantColor;
      } else {
        return trait.recessiveColor;
      }
    } else if (dominancePattern === 1) {
      // Incomplete dominance
      const dominantCount = (genotype.match(new RegExp(trait.dominantSymbol, 'g')) || []).length;
      const recessiveCount = (genotype.match(new RegExp(trait.recessiveSymbol, 'g')) || []).length;
      
      if (dominantCount === 2) return trait.dominantColor;
      if (recessiveCount === 2) return trait.recessiveColor;
      return trait.intermediateColor; // Heterozygote
    } else if (dominancePattern === 2) {
      // Codominance (blood type example)
      if (genotype === 'AA') return trait.dominantColor;
      if (genotype === 'BB') return '#4169E1'; // Type B blue
      if (genotype === 'AB') return trait.intermediateColor; // Type AB purple
      if (genotype === 'AO') return trait.dominantColor; // Type A
      if (genotype === 'BO') return '#4169E1'; // Type B
      return trait.recessiveColor; // Type O
    }
    
    return trait.dominantColor;
  }

  function getPhenotypeName(genotype: string): string {
    const trait = getCurrentTrait();
    
    if (dominancePattern === 0) {
      // Complete dominance
      if (genotype.includes(trait.dominantSymbol)) {
        return trait.dominantName;
      } else {
        return trait.recessiveName;
      }
    } else if (dominancePattern === 1) {
      // Incomplete dominance
      const dominantCount = (genotype.match(new RegExp(trait.dominantSymbol, 'g')) || []).length;
      const recessiveCount = (genotype.match(new RegExp(trait.recessiveSymbol, 'g')) || []).length;
      
      if (dominantCount === 2) return trait.dominantName;
      if (recessiveCount === 2) return trait.recessiveName;
      return `${trait.dominantName}-${trait.recessiveName}`; // Intermediate
    } else if (dominancePattern === 2) {
      // Codominance blood types
      if (genotype === 'AA' || genotype === 'AO') return 'Type A';
      if (genotype === 'BB' || genotype === 'BO') return 'Type B';
      if (genotype === 'AB') return 'Type AB';
      return 'Type O';
    }
    
    return trait.dominantName;
  }

  function performCross() {
    offspring = [];
    
    // Get parent genotypes
    const parentA_symbol1 = getAlleleSymbol(parentA_allele1);
    const parentA_symbol2 = getAlleleSymbol(parentA_allele2);
    const parentB_symbol1 = getAlleleSymbol(Math.floor(Math.random() * 2)); // Random for demo
    const parentB_symbol2 = getAlleleSymbol(Math.floor(Math.random() * 2));
    
    // Create all possible offspring combinations
    const gametes_A = [parentA_symbol1, parentA_symbol2];
    const gametes_B = [parentB_symbol1, parentB_symbol2];
    
    let offspringIndex = 0;
    for (const gameteA of gametes_A) {
      for (const gameteB of gametes_B) {
        const genotype = gameteA + gameteB;
        const sortedGenotype = genotype.split('').sort().join(''); // Sort for consistency
        
        offspring.push({
          genotype: sortedGenotype,
          phenotype: getPhenotypeName(sortedGenotype),
          color: getGenotypeColor(sortedGenotype),
          x: 450 + (offspringIndex % 2) * 120,
          y: 250 + Math.floor(offspringIndex / 2) * 80,
          age: 0
        });
        
        offspringIndex++;
      }
    }
    
    // Start animation
    crossingAnimation = { phase: 0, active: true };
  }

  function updateAnimation(dt: number) {
    if (crossingAnimation.active) {
      crossingAnimation.phase += dt * 2;
      
      if (crossingAnimation.phase > 2) {
        crossingAnimation.active = false;
        crossingAnimation.phase = 0;
      }
    }
    
    // Age offspring for entrance animation
    for (const child of offspring) {
      child.age = Math.min(child.age + dt, 1);
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      performCross();
    },

    update(dt: number, params: Record<string, number>) {
      const newTraitType = Math.floor(params.traitType ?? traitType);
      const newDominancePattern = Math.floor(params.dominancePattern ?? dominancePattern);
      const newParentA_allele1 = Math.floor(params.parentA_allele1 ?? parentA_allele1);
      const newParentA_allele2 = Math.floor(params.parentA_allele2 ?? parentA_allele2);

      // Trigger new cross if parameters changed
      if (newTraitType !== traitType || newDominancePattern !== dominancePattern ||
          newParentA_allele1 !== parentA_allele1 || newParentA_allele2 !== parentA_allele2) {
        
        traitType = newTraitType;
        dominancePattern = newDominancePattern;
        parentA_allele1 = newParentA_allele1;
        parentA_allele2 = newParentA_allele2;
        
        performCross();
      }

      time += dt;
      updateAnimation(dt);
    },

    render() {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#f8fafc");
      gradient.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      const trait = getCurrentTrait();

      // Title
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "center";
      ctx.fillText(`Genetics: ${trait.name} Inheritance`, W / 2, 30);

      // Dominance pattern subtitle
      const patterns = ["Complete Dominance", "Incomplete Dominance", "Codominance"];
      ctx.font = "14px Arial";
      ctx.fillStyle = "#64748b";
      ctx.fillText(patterns[dominancePattern] || patterns[0], W / 2, 50);

      // Parent A
      const parentA_x = 100;
      const parentA_y = 150;
      
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(parentA_x - 40, parentA_y - 40, 80, 80);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.strokeRect(parentA_x - 40, parentA_y - 40, 80, 80);
      
      ctx.font = "bold 16px Arial";
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "center";
      ctx.fillText("Parent A", parentA_x, parentA_y - 50);
      
      const parentA_genotype = getAlleleSymbol(parentA_allele1) + getAlleleSymbol(parentA_allele2);
      ctx.font = "18px Arial";
      ctx.fillStyle = "#dc2626";
      ctx.fillText(parentA_genotype, parentA_x, parentA_y);

      // Parent B (fixed for demo)
      const parentB_x = 100;
      const parentB_y = 300;
      
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(parentB_x - 40, parentB_y - 40, 80, 80);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.strokeRect(parentB_x - 40, parentB_y - 40, 80, 80);
      
      ctx.font = "bold 16px Arial";
      ctx.fillStyle = "#1e293b";
      ctx.fillText("Parent B", parentB_x, parentB_y - 50);
      
      const parentB_genotype = trait.dominantSymbol + trait.recessiveSymbol; // Heterozygous
      ctx.font = "18px Arial";
      ctx.fillStyle = "#2563eb";
      ctx.fillText(parentB_genotype, parentB_x, parentB_y);

      // Punnett Square
      const squareX = 250;
      const squareY = 200;
      const squareSize = 120;
      
      // Square border
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(squareX, squareY, squareSize, squareSize);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 3;
      ctx.strokeRect(squareX, squareY, squareSize, squareSize);
      
      // Grid lines
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(squareX + squareSize/2, squareY);
      ctx.lineTo(squareX + squareSize/2, squareY + squareSize);
      ctx.moveTo(squareX, squareY + squareSize/2);
      ctx.lineTo(squareX + squareSize, squareY + squareSize/2);
      ctx.stroke();
      
      // Gamete labels
      ctx.font = "14px Arial";
      ctx.fillStyle = "#dc2626";
      ctx.textAlign = "center";
      
      const parentA_gametes = [getAlleleSymbol(parentA_allele1), getAlleleSymbol(parentA_allele2)];
      ctx.fillText(parentA_gametes[0], squareX + squareSize/4, squareY - 10);
      ctx.fillText(parentA_gametes[1], squareX + 3*squareSize/4, squareY - 10);
      
      ctx.fillStyle = "#2563eb";
      ctx.save();
      ctx.translate(squareX - 15, squareY + squareSize/4);
      ctx.rotate(-Math.PI/2);
      ctx.fillText(trait.dominantSymbol, 0, 0);
      ctx.restore();
      
      ctx.save();
      ctx.translate(squareX - 15, squareY + 3*squareSize/4);
      ctx.rotate(-Math.PI/2);
      ctx.fillText(trait.recessiveSymbol, 0, 0);
      ctx.restore();

      // Fill Punnett square cells
      ctx.font = "16px Arial";
      ctx.fillStyle = "#1e293b";
      
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const cellX = squareX + j * squareSize/2 + squareSize/4;
          const cellY = squareY + i * squareSize/2 + squareSize/4;
          
          const gameteA = parentA_gametes[j];
          const gameteB = i === 0 ? trait.dominantSymbol : trait.recessiveSymbol;
          const genotype = (gameteA + gameteB).split('').sort().join('');
          
          const alpha = crossingAnimation.active ? 
            Math.max(0, Math.min(1, crossingAnimation.phase - (i * 2 + j) * 0.2)) : 1;
          
          ctx.globalAlpha = alpha;
          ctx.fillText(genotype, cellX, cellY + 5);
          ctx.globalAlpha = 1;
        }
      }

      // Offspring display
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "center";
      ctx.fillText("F1 Offspring", 550, 180);

      for (const child of offspring) {
        const scale = child.age * 0.8 + 0.2; // Entrance animation
        const alpha = child.age;
        
        ctx.save();
        ctx.translate(child.x, child.y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        
        // Offspring visualization
        if (trait.name === "Eye Color") {
          // Draw eye
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.arc(0, 0, 25, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#1e293b";
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Iris
          ctx.fillStyle = child.color;
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          
          // Pupil
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          
        } else if (trait.name === "Flower Color") {
          // Draw flower
          for (let petal = 0; petal < 5; petal++) {
            const angle = (petal / 5) * Math.PI * 2;
            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = child.color;
            ctx.beginPath();
            ctx.ellipse(0, -15, 8, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          
          // Center
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          
        } else if (trait.name === "Plant Height") {
          // Draw plant
          const height = child.color === trait.dominantColor ? 30 : 15;
          
          // Stem
          ctx.fillStyle = "#22c55e";
          ctx.fillRect(-2, 0, 4, height);
          
          // Leaves
          for (let leaf = 1; leaf <= 3; leaf++) {
            const leafY = (leaf / 4) * height;
            ctx.fillStyle = child.color;
            ctx.beginPath();
            ctx.ellipse(-8, leafY, 6, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(8, leafY, 6, 3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          
        } else {
          // Blood type - draw blood drop
          ctx.fillStyle = child.color;
          ctx.beginPath();
          ctx.arc(0, -5, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, 7);
          ctx.lineTo(-8, -5);
          ctx.lineTo(8, -5);
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.restore();
        
        // Labels
        ctx.font = "12px Arial";
        ctx.fillStyle = "#1e293b";
        ctx.textAlign = "center";
        ctx.globalAlpha = alpha;
        ctx.fillText(child.genotype, child.x, child.y + 45);
        ctx.font = "10px Arial";
        ctx.fillStyle = "#64748b";
        ctx.fillText(child.phenotype, child.x, child.y + 60);
        ctx.globalAlpha = 1;
      }

      // Results summary
      const resultsX = 420;
      const resultsY = 380;
      const resultsW = 300;
      const resultsH = 160;
      
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(resultsX, resultsY, resultsW, resultsH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(resultsX, resultsY, resultsW, resultsH);
      
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "left";
      ctx.fillText("Phenotypic Ratios", resultsX + 10, resultsY + 20);
      
      // Calculate ratios
      const phenotypeCounts = {};
      offspring.forEach(child => {
        phenotypeCounts[child.phenotype] = (phenotypeCounts[child.phenotype] || 0) + 1;
      });
      
      let ratioY = resultsY + 40;
      ctx.font = "12px Arial";
      ctx.fillStyle = "#374151";
      
      Object.entries(phenotypeCounts).forEach(([phenotype, count]) => {
        const ratio = ((count / offspring.length) * 100).toFixed(0);
        ctx.fillText(`${phenotype}: ${count}/4 (${ratio}%)`, resultsX + 10, ratioY);
        ratioY += 18;
      });
      
      // Genotypic ratios
      ratioY += 10;
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#1e293b";
      ctx.fillText("Genotypic Ratios", resultsX + 10, ratioY);
      ratioY += 20;
      
      const genotypeCounts = {};
      offspring.forEach(child => {
        genotypeCounts[child.genotype] = (genotypeCounts[child.genotype] || 0) + 1;
      });
      
      ctx.font = "12px Arial";
      ctx.fillStyle = "#374151";
      
      Object.entries(genotypeCounts).forEach(([genotype, count]) => {
        const ratio = ((count / offspring.length) * 100).toFixed(0);
        ctx.fillText(`${genotype}: ${count}/4 (${ratio}%)`, resultsX + 10, ratioY);
        ratioY += 18;
      });

      // Key concepts panel
      const keyX = 30;
      const keyY = 380;
      const keyW = 280;
      const keyH = 160;
      
      ctx.fillStyle = "rgba(15, 23, 42, 0.05)";
      ctx.fillRect(keyX, keyY, keyW, keyH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(keyX, keyY, keyW, keyH);
      
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "left";
      ctx.fillText("Key Concepts", keyX + 10, keyY + 20);
      
      let conceptY = keyY + 40;
      ctx.font = "11px Arial";
      ctx.fillStyle = "#4b5563";
      
      const concepts = [
        "• Genotype: genetic makeup (alleles)",
        "• Phenotype: observable traits",
        "• Dominant alleles mask recessive",
        "• Punnett square shows all outcomes",
        "• 1:2:1 genotypic ratio (typical)",
        "• 3:1 phenotypic ratio (complete dom.)"
      ];
      
      concepts.forEach(concept => {
        ctx.fillText(concept, keyX + 10, conceptY);
        conceptY += 16;
      });

      // Parameter indicators
      ctx.font = "12px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText(`Trait: ${trait.name}`, 20, H - 40);
      ctx.fillText(`Pattern: ${patterns[dominancePattern]}`, 20, H - 20);
    },

    reset() {
      time = 0;
      offspring = [];
      crossingAnimation = { phase: 0, active: false };
      performCross();
    },

    destroy() {
      offspring = [];
    },

    getStateDescription(): string {
      const trait = getCurrentTrait();
      const patterns = ["complete dominance", "incomplete dominance", "codominance"];
      const pattern = patterns[dominancePattern] || patterns[0];
      
      const parentA_genotype = getAlleleSymbol(parentA_allele1) + getAlleleSymbol(parentA_allele2);
      const parentB_genotype = trait.dominantSymbol + trait.recessiveSymbol;
      
      // Calculate phenotype ratios
      const phenotypeCounts = {};
      offspring.forEach(child => {
        phenotypeCounts[child.phenotype] = (phenotypeCounts[child.phenotype] || 0) + 1;
      });
      
      const ratioText = Object.entries(phenotypeCounts)
        .map(([phenotype, count]) => `${count} ${phenotype}`)
        .join(', ');

      return (
        `Genetics simulation showing ${trait.name.toLowerCase()} inheritance using ${pattern}. ` +
        `Cross: Parent A (${parentA_genotype}) × Parent B (${parentB_genotype}). ` +
        `F1 offspring ratios: ${ratioText}. ` +
        `Punnett square demonstrates Mendelian inheritance patterns, showing all possible ` +
        `genotype and phenotype combinations from parental gametes.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    }
  };

  return engine;
};

export default GeneticsPunnettSquareFactory;