#!/usr/bin/env node

/**
 * Procedural Level Generator for Level 1
 * Generates a long, relatively straight course with platforms spaced
 * approximately double the original spacing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Platform spacing
  minSpacing: 15,
  maxSpacing: 22,

  // Grid configuration
  gridWidth: 3,  // Number of platforms wide
  lateralSpacing: 10,  // Spacing between columns

  // Course length (rows of platforms)
  numberOfRows: 12,

  // Platform sizes - much more variation
  platformSizes: [
    { width: 3, height: 1, depth: 3 },
    { width: 4, height: 1, depth: 4 },
    { width: 4.5, height: 1, depth: 4.5 },
    { width: 5, height: 1, depth: 5 },
    { width: 5.5, height: 1, depth: 5.5 },
    { width: 6, height: 1, depth: 6 },
    { width: 7, height: 1, depth: 7 },
    { width: 8, height: 1, depth: 8 },
  ],

  // Color palette for the level
  colorPalette: [
    0xff6b6b,  // Red
    0x6bcf7f,  // Green
    0x4ecdc4,  // Cyan
    0xffe66d,  // Yellow
    0xa8dadc,  // Light blue
    0xf4a261,  // Orange
    0xe76f51,  // Dark orange
    0xff8fab,  // Pink
    0x95e1d3,  // Mint
  ],

  // BPM for the level
  bpm: 120,

  // Transformation ranges
  transforms: {
    translate: { x: [-5, 5], y: [-3, 3], z: [-4, 4] },
    scale: { x: [0.7, 1.3], y: [0.7, 1.3] },  // NO Z scaling
  },

  // Number of transitions per platform (min, max)
  transitionsRange: [2, 4],

  // Probability that a platform only changes color (standing still)
  colorOnlyChance: 0.35,  // ~1 in 3 platforms
};

/**
 * Generate a random number between min and max
 */
function random(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Pick a random element from an array
 */
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random value within a range
 */
function randomInRange(range) {
  return random(range[0], range[1]);
}

/**
 * Generate a single transformation (translate or scale)
 */
function generateTransform(type) {
  const transform = {};

  if (type === 'translate') {
    if (Math.random() > 0.5) transform.x = randomInRange(CONFIG.transforms.translate.x);
    if (Math.random() > 0.5) transform.y = randomInRange(CONFIG.transforms.translate.y);
    if (Math.random() > 0.5) transform.z = randomInRange(CONFIG.transforms.translate.z);
  } else if (type === 'scale') {
    if (Math.random() > 0.5) transform.x = randomInRange(CONFIG.transforms.scale.x);
    if (Math.random() > 0.5) transform.y = randomInRange(CONFIG.transforms.scale.y);
    // NO Z scaling as requested
  }

  return Object.keys(transform).length > 0 ? transform : null;
}

/**
 * Generate state transitions for a platform
 */
function generateStates(colorOnly = false) {
  const numTransitions = Math.floor(random(CONFIG.transitionsRange[0], CONFIG.transitionsRange[1] + 1));
  const transitions = [];

  // Pick one transformation type for this platform: either translate or scale (not both)
  const transformType = Math.random() > 0.5 ? 'translate' : 'scale';

  for (let i = 0; i < numTransitions; i++) {
    const transition = {
      beats: Math.floor(random(1, 5)),  // 1-4 beats
      transforms: {}
    };

    if (colorOnly) {
      // Only color changes
      transition.transforms.colorIndex = Math.floor(Math.random() * CONFIG.colorPalette.length);
    } else {
      // Use the selected transform type for this platform
      const transform = generateTransform(transformType);
      if (transform) {
        transition.transforms[transformType] = transform;
      }

      // Also change color sometimes
      if (Math.random() > 0.5) {
        transition.transforms.colorIndex = Math.floor(Math.random() * CONFIG.colorPalette.length);
      }
    }

    transitions.push(transition);
  }

  return {
    startState: {
      colorIndex: 0  // Start with first color in palette
    },
    transitions
  };
}

/**
 * Generate platforms in a 3-wide grid pattern
 */
function generatePlatforms() {
  const platforms = [];
  let currentZ = 0;

  // Starting platform (large and static)
  platforms.push({
    type: 'static',
    position: { x: 0, y: -2, z: 0 },
    size: { width: 20, height: 1, depth: 20 },
    color: '0x808080',
  });

  // Generate rows of platforms
  for (let row = 0; row < CONFIG.numberOfRows; row++) {
    // Move forward on z-axis
    currentZ -= random(CONFIG.minSpacing, CONFIG.maxSpacing);

    // Add curved path variation for this row
    const curveOffset = Math.sin(row * 0.5) * 15;

    // Base vertical variation for this row
    const baseHeightVariation = Math.sin(row * 0.3) * 2;

    // Calculate grid positions for this row (centered around curve offset)
    const gridPositions = [];
    for (let col = 0; col < CONFIG.gridWidth; col++) {
      const xOffset = (col - (CONFIG.gridWidth - 1) / 2) * CONFIG.lateralSpacing;
      gridPositions.push(curveOffset + xOffset);
    }

    // Create platforms for each column in this row
    for (let col = 0; col < CONFIG.gridWidth; col++) {
      const x = gridPositions[col];

      // Add much more randomness to position
      const xJitter = random(-2, 2);

      // Much more vertical variation - each platform can be significantly higher or lower
      const colHeightVariation = random(-4, 4);  // Large per-platform variation
      const yJitter = random(-1, 1);  // Additional small randomness
      const y = baseHeightVariation + colHeightVariation + yJitter;

      // Choose platform size
      const size = randomChoice(CONFIG.platformSizes);

      // Decide if platform should have transformations
      const colorOnly = Math.random() < CONFIG.colorOnlyChance;
      const isMoving = colorOnly || Math.random() < 0.8;  // Most platforms have some kind of state

      const platform = {
        type: isMoving ? 'moving' : 'static',
        position: {
          x: Math.round((x + xJitter) * 10) / 10,
          y: Math.round(y * 10) / 10,
          z: Math.round(currentZ * 10) / 10,
        },
        size: { ...size },
        color: `0x${CONFIG.colorPalette[0].toString(16).padStart(6, '0')}`,
      };

      // Add states if it's a moving platform
      if (isMoving) {
        platform.states = generateStates(colorOnly);
      }

      // Add turret to ~75% of static platforms and ~60% of color-only platforms
      const shouldHaveTurret = (!isMoving && Math.random() < 0.75) ||
                               (isMoving && colorOnly && Math.random() < 0.6);

      if (shouldHaveTurret) {
        platform.turret = {
          position: {
            x: 0,  // Relative to platform center
            y: size.height / 2 + 0.3,  // On top of platform
            z: 0
          },
          color: '0xff0000'
        };
      }

      platforms.push(platform);
    }
  }

  // Final destination platform (large and static)
  currentZ -= random(CONFIG.minSpacing, CONFIG.maxSpacing);
  platforms.push({
    type: 'static',
    position: { x: 0, y: -1, z: Math.round(currentZ * 10) / 10 },
    size: { width: 20, height: 1, depth: 20 },
    color: '0x808080',
  });

  return platforms;
}

/**
 * Generate complete level data
 */
function generateLevel() {
  return {
    name: 'Level 1 - Introduction',
    bpm: CONFIG.bpm,
    colorPalette: CONFIG.colorPalette.map(c => `0x${c.toString(16).padStart(6, '0')}`),
    background: {
      color: '0x87ceeb',
      fog: {
        color: '0x87ceeb',
        near: 50,
        far: 400,  // Increased for longer course
      },
    },
    playerSpawn: {
      x: 0,
      y: -0.6,
      z: 0,
    },
    platforms: generatePlatforms(),
  };
}

/**
 * Main function
 */
function main() {
  console.log('Generating Level 1...');

  const levelData = generateLevel();

  // Output path
  const outputPath = path.join(__dirname, '../public/levels/level1.json');

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(outputPath, JSON.stringify(levelData, null, 2));

  console.log(`✓ Level generated successfully!`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Platforms: ${levelData.platforms.length}`);
  console.log(`  Course length: ~${Math.abs(levelData.platforms[levelData.platforms.length - 1].position.z)} units`);
}

// Run the generator
main();
