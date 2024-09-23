// import * as THREE from 'three';

// /**
//  * Generates a unique color for a given patch ID.
//  * Uses the golden angle to distribute colors evenly.
//  * @param {number} patchID - The unique identifier for the patch.
//  * @returns {THREE.Color} - The generated color.
//  */
// export const getColorForPatchID = (patchID) => {
//   const goldenAngle = 137.508; // Degrees
//   const hue = (patchID * goldenAngle) % 360;
//   return new THREE.Color(`hsl(${hue}, 100%, 50%)`);
// };

// src/utils/colorUtils.js

import * as THREE from 'three';

const predefinedColors = [
  '#FF5733', // Patch ID 0
  '#33FF57', // Patch ID 1
  '#3357FF', // Patch ID 2
  '#F333FF', // Patch ID 3
  '#FF33A8', // Patch ID 4
  '#33FFF3', // Patch ID 5
  '#F3FF33', // Patch ID 6
  '#FF8C33', // Patch ID 7
  // Add more colors as needed
];

/**
 * Generates a unique color for a given patch ID.
 * Uses a predefined palette and cycles through if necessary.
 * @param {number} patchID - The unique identifier for the patch.
 * @returns {THREE.Color} - The generated color.
 */
export const getColorForPatchID = (patchID) => {
  const colorHex = predefinedColors[patchID % predefinedColors.length];
  return new THREE.Color(colorHex);
};