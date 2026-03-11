// src/utils/string.utils.js

function capitalizeFirstLetter(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

module.exports = {
  capitalizeFirstLetter,
};
