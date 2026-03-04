// src/utils/date.utils.js

function startOfMonthUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function addMonthsUTC(date, diffMonths) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + diffMonths, 1, 0, 0, 0));
}

module.exports = {
  startOfMonthUTC,
  addMonthsUTC,
};
