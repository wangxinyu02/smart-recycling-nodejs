// src/utils/number.utils.js

function toNum(v) {
  return Number(v ?? 0);
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round0(n) {
  return Math.round(n);
}

function round1(n) {
  return Number(n.toFixed(1));
}

module.exports = {
  toNum,
  toNumberOrNull,
  round0,
  round1,
};
