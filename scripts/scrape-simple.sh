#!/bin/bash
mkdir -p data
URLS=""
CATS="mechanics_en electricity_en chemistry_en biology_en astronomy_en mathematics_en light_en work_and_energy_en atoms_en earth_en technology_en force_en inertia_en movements_en collision_en oscillation_en static_electricity_en ohms_law_en electric_circuit_en magnetism_en electromagnetism_en reflection_en refraction_en color_en wave_en interference_en standing_wave_en atomic_model_en radioactivity_en gas_liquid_solid_en heat_en molecules_in_motion_en solution_en chemical_reaction_en chemical_bonds_en electrochemistry_en atmosphere_en geology_en moon_en sun_en solar_system_en fractal_en chaos_en"

for cat in $CATS; do
  for page in 1 2 3 4 5 6 7 8 9 10; do
    if [ "$page" -eq 1 ]; then
      url="https://javalab.org/en/category/${cat}/"
    else
      url="https://javalab.org/en/category/${cat}/page/${page}/"
    fi
    content=$(curl -s --max-time 5 "$url")
    [ $? -ne 0 ] && break
    echo "$content" | grep -oP 'href="https://javalab\.org/en/[^"]*_en/"' | sed 's/href="//;s/"$//' >> data/all-urls.txt
    # If page returned 404 or no sim links, stop
    echo "$content" | grep -q "page can" && break
  done
  echo "$cat done"
done

sort -u data/all-urls.txt > data/unique-urls.txt
echo "Total unique simulations: $(wc -l < data/unique-urls.txt)"
