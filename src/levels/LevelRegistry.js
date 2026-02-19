import { Level1 } from './Level1.js';
import { Level2 } from './Level2.js';

/**
 * Central registry for all game levels.
 * Maps level numbers to their corresponding level classes.
 *
 * To add a new level:
 * 1. Create a new level class extending BaseLevel
 * 2. Import it at the top of this file
 * 3. Add it to the LEVELS object below
 */
export const LevelRegistry = {
  /**
   * Map of level number to level class constructor
   */
  LEVELS: {
    1: Level1,
    2: Level2,
    // Add more levels here as you implement them:
    // 3: Level3,
    // 4: Level4,
    // etc.
  },

  /**
   * Get a level class by number
   * @param {number} levelNumber - The level number to get
   * @returns {Class|null} The level class constructor, or null if not found
   */
  getLevel(levelNumber) {
    return this.LEVELS[levelNumber] || null;
  },

  /**
   * Check if a level is implemented
   * @param {number} levelNumber - The level number to check
   * @returns {boolean} True if the level exists
   */
  hasLevel(levelNumber) {
    return levelNumber in this.LEVELS;
  },

  /**
   * Get all implemented level numbers
   * @returns {number[]} Array of level numbers
   */
  getImplementedLevels() {
    return Object.keys(this.LEVELS).map(Number).sort((a, b) => a - b);
  },

  /**
   * Create a level instance
   * @param {number} levelNumber - The level number to create
   * @param {Game} game - The game instance
   * @returns {BaseLevel|null} The level instance, or null if not found
   */
  createLevel(levelNumber, game) {
    const LevelClass = this.getLevel(levelNumber);
    if (!LevelClass) {
      return null;
    }
    return new LevelClass(game);
  }
};
