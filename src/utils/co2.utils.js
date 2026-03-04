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