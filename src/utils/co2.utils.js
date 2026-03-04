// src/utils/co2.utils.js

const CO2_FACTOR = {
  plastic: 1.7,
  paper: 1.1,
  metal: 9.0,
  glass: 0.3,
  ewaste: 12.0,
  other: 0.5,
};

// weightKg * factor = co2SavedKg
exports.calcCo2Saved = (material, weightKg) => {
  const m = String(material);
  const w = Number(weightKg);

  if (!CO2_FACTOR[m]) throw new Error("Invalid material for CO2 factor");
  if (!Number.isFinite(w) || w <= 0) throw new Error("Invalid weight");

  const co2 = w * CO2_FACTOR[m];
  // keep 2dp
  return Number(co2.toFixed(2));
};

exports.buildCo2ImpactMessage = (co2Kg, userId) => {
  const co2 = Math.max(0, Number(co2Kg ?? 0));

  const plural = (n, one, many = one + "s") => (n === 1 ? one : many);

  const FACTORS = [
    // ---- Small impacts (daily activities) ----
    {
      type: "smartphone_charges",
      kgPerUnit: 0.015,
      category: "small",
      render: (n) => `to charge your smartphone ${n} time${plural(n, "", "s")}.`,
    },
    {
      type: "ceiling_fan_hours",
      kgPerUnit: 0.036,
      category: "small",
      render: (n) => `to run a ceiling fan for ${n} ${plural(n, "hour")}.`,
    },
    {
      type: "green_leaves",
      kgPerUnit: 0.05,
      category: "small",
      render: (n) => `to the carbon absorbed by ${n} green leaf${plural(n, "", "s")} during photosynthesis.`,
    },
    {
      type: "streaming_hours_hd",
      kgPerUnit: 0.055,
      category: "small",
      render: (n) => `to stream ${n} ${plural(n, "hour")} of high-definition video.`,
    },

    // ---- Medium impacts (lifestyle / energy) ----
    {
      type: "coffee_pots",
      kgPerUnit: 0.12,
      category: "medium",
      render: (n) => `to brew ${n} ${plural(n, "pot")} of coffee.`,
    },
    {
      type: "ev_miles",
      kgPerUnit: 0.12,
      category: "medium",
      render: (n) => `to drive an electric car for ${n} ${plural(n, "mile")}.`,
    },
    {
      type: "renewable_energy",
      kgPerUnit: 0.475,
      category: "medium",
      render: (n) => `to generating ${n} kWh of clean renewable energy.`,
    },
    {
      type: "bee_habitat_days",
      kgPerUnit: 0.5,
      category: "medium",
      render: (n) => `to suppport pollinator habitats for about ${n} ${plural(n, "day")}.`,
    },
    {
      type: "tablet_months",
      kgPerUnit: 0.9,
      category: "medium",
      render: (n) => `to keep a tablet running for ${n} ${plural(n, "month")}.`,
    },
    {
      type: "garden_plants",
      kgPerUnit: 2,
      category: "medium",
      render: (n) => `to ${n} garden plant${plural(n, "", "s")} absorbing carbon for a year.`,
    },

    // ---- Large impacts (environmental) ----
    {
      type: "forest_area",
      kgPerUnit: 1.5,
      category: "large",
      render: (n) => `to preserving about ${n}m² of forest.`,
    },
    {
      type: "seedlings_planted",
      kgPerUnit: 8,
      category: "large",
      render: (n) => `to planting ${n} young tree seedling${plural(n, "", "s")}.`,
    },
    {
      type: "tree_seedling_years",
      kgPerUnit: 10,
      category: "large",
      render: (n) => `to a tree seedling growing for ${n} ${plural(n, "year")}.`,
    },
    {
      type: "urban_tree_cooling",
      kgPerUnit: 15,
      category: "large",
      render: (n) => `to ${n} urban tree${plural(n, "", "s")} helping cool city buildings.`,
    },
    {
      type: "trees_planted",
      kgPerUnit: 22,
      category: "large",
      render: (n) => `to planting ${n} tree${plural(n, "", "s")} and letting them grow for a year.`,
    },
  ];

  if (co2 <= 0) {
    return {
      type: "none",
      n: 0,
      text: "Start recycling to see your CO₂-equivalent impact here.",
    };
  }

  // ---- Determine impact scale ----
  let category;

  if (co2 < 5) category = "small";
  else if (co2 < 50) category = "medium";
  else category = "large";

  // ---- Filter by category ----
  let eligible = FACTORS.filter((f) => f.category === category);

  // ---- Ensure realistic comparison ----
  eligible = eligible.filter((f) => co2 >= f.kgPerUnit);

  if (eligible.length === 0) {
    eligible = FACTORS.filter((f) => f.category === category);
  }

  // ---- Pick message ----
  let picked;

  if (Number.isInteger(userId) && userId > 0) {
    picked = eligible[userId % eligible.length];
  } else {
    picked = eligible[Math.floor(Math.random() * eligible.length)];
  }

  const n = Math.max(1, Math.ceil(co2 / picked.kgPerUnit));

  return {
    type: picked.type,
    n,
    text: `Equivalent ${picked.render(n)}`,
  };
};
