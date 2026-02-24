// Scrape full JavaLab catalog
const categories = [
  'mechanics_en', 'electricity_en', 'chemistry_en', 'biology_en',
  'astronomy_en', 'mathematics_en', 'light_en', 'work_and_energy_en',
  'atoms_en', 'earth_en', 'technology_en', 'etc_en'
];

// Subcategories from their menu
const subcategories = [
  // Mechanics
  'force_en', 'inertia_en', 'movements_en', 'collision_en', 'oscillation_en',
  // Electricity
  'static_electricity_en', 'ohms_law_en', 'electric_circuit_en', 
  'alternating_current_en', 'semiconductor_en', 'magnetism_en',
  'electromagnetism_en', 'electromagnetic_wave_en',
  // Work & Energy
  'principle_of_work_en', 'energy_conversion_en',
  // Light & Wave
  'reflection_en', 'refraction_en', 'color_en', 'wave_en',
  'interference_en', 'standing_wave_en',
  // Atoms
  'atomic_model_en', 'atom_and_light_en', 'radioactivity_en',
  // Chemistry
  'gas_liquid_solid_en', 'heat_en', 'molecules_in_motion_en',
  'solution_en', 'chemical_reaction_en', 'chemical_bonds_en', 'electrochemistry_en',
  // Earth
  'atmosphere_en', 'geology_en',
  // Astronomy
  'celestial_observation_en', 'planet_earth_en', 'moon_en', 'sun_en',
  'solar_system_en', 'star_and_galaxy_en',
  // Math
  'math_graphics_en', 'fractal_en', 'chaos_en',
  // Technology
  'ai_en', 'microbit_en', '3d_printing_en', 'block_coding_en', 'puzzle_en',
  // Etc
  'lecture_material_en', 'augmented_reality_en', '3d_vr_en'
];

const allCats = [...new Set([...categories, ...subcategories])];

async function scrapePage(url: string): Promise<string[]> {
  try {
    const res = await fetch(url);
    const html = await res.text();
    // Extract simulation URLs
    const matches = html.matchAll(/href="(https:\/\/javalab\.org\/en\/[^"]+_en\/)"/g);
    return [...new Set([...matches].map(m => m[1]))];
  } catch { return []; }
}

async function scrapeCategory(cat: string): Promise<{cat: string, sims: string[]}> {
  const allSims: string[] = [];
  // Try pages 1-10
  for (let page = 1; page <= 10; page++) {
    const url = page === 1 
      ? `https://javalab.org/en/category/${cat}/`
      : `https://javalab.org/en/category/${cat}/page/${page}/`;
    const sims = await scrapePage(url);
    if (sims.length === 0) break;
    allSims.push(...sims);
  }
  return { cat, sims: [...new Set(allSims)] };
}

async function main() {
  const results: Record<string, string[]> = {};
  const allUrls = new Set<string>();
  
  for (const cat of allCats) {
    const { sims } = await scrapeCategory(cat);
    if (sims.length > 0) {
      results[cat] = sims;
      sims.forEach(s => allUrls.add(s));
    }
    process.stdout.write(`${cat}: ${sims.length} sims\n`);
  }
  
  // Write catalog
  const catalog = {
    scrapedAt: new Date().toISOString(),
    totalUnique: allUrls.size,
    categories: results,
    allSimulations: [...allUrls].sort().map(url => {
      const slug = url.replace('https://javalab.org/en/', '').replace('_en/', '');
      const name = slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { url, slug, name };
    })
  };
  
  await Bun.write('data/javalab-catalog.json', JSON.stringify(catalog, null, 2));
  console.log(`\nTotal unique simulations: ${allUrls.size}`);
}

main();
