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
    {
      type: "smartphone_charges",
      kgPerUnit: 1 / 80.8, // 1 kg CO2e ≈ 80.8 smartphones charged
      category: "small",
      render: (n) => `to charging ${n} smartphone${plural(n, "", "s")}.`,
    },
    {
      type: "miles_driven_gasoline_car",
      kgPerUnit: 1 / 2.5, // 1 kg CO2e ≈ 2.5 miles driven
      category: "small",
      render: (n) => `to driving an average gasoline-powered passenger vehicle for ${n} ${plural(n, "mile")}.`,
    },
    {
      type: "gallons_of_gasoline",
      kgPerUnit: 1 / 0.113, // 1 kg CO2e ≈ 0.113 gallons gasoline consumed
      category: "medium",
      render: (n) => `to consuming ${n} ${plural(n, "gallon")} of gasoline.`,
    },
    {
      type: "trash_bags_recycled",
      kgPerUnit: 1 / 0.085, // 1 kg CO2e ≈ 0.085 trash bags recycled instead of landfilled
      category: "medium",
      render: (n) => `to recycling ${n} trash ${plural(n, "bag")} of waste instead of landfilling it.`,
    },
    {
      type: "tree_seedlings_10_years",
      kgPerUnit: 1 / 0.017, // 1 kg CO2e ≈ 0.017 tree seedlings grown for 10 years
      category: "large",
      render: (n) => `to ${n} tree seedling${plural(n, "", "s")} grown for 10 years.`,
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
    eligible = FACTORS;
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
