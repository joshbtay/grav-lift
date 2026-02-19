import { Platform } from '../entities/Platform.js';
import { MovingPlatform } from '../entities/MovingPlatform.js';

/**
 * Utility class for loading and parsing level data from JSON files.
 */
export class LevelDataLoader {
  /**
   * Load level data from a JSON file.
   * Files are served from the public directory.
   * @param {number} levelNumber - The level number to load
   * @returns {Promise<Object>} The parsed level data
   */
  static async loadLevelData(levelNumber) {
    try {
      const response = await fetch(`/levels/level${levelNumber}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load level ${levelNumber}: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error loading level ${levelNumber}:`, error);
      throw error;
    }
  }

  /**
   * Parse hex color string to integer.
   * @param {string} colorString - Color string (e.g., "0xff6b6b" or "0xFF6B6B")
   * @returns {number} Color as integer
   */
  static parseColor(colorString) {
    if (typeof colorString === 'number') {
      return colorString;
    }
    if (typeof colorString === 'string') {
      // Remove '0x' prefix if present and parse as hex
      return parseInt(colorString.replace(/^0x/i, ''), 16);
    }
    return 0x808080; // Default gray
  }

  /**
   * Create a platform instance from platform data.
   * @param {Object} platformData - Platform configuration from JSON
   * @param {number} bpm - Beats per minute for the level
   * @param {Array<number>} colorPalette - Array of hex colors for the level
   * @returns {Platform|MovingPlatform} Platform instance
   */
  static createPlatform(platformData, bpm = 120, colorPalette = []) {
    const config = {
      position: platformData.position,
      size: platformData.size,
      color: this.parseColor(platformData.color)
    };

    if (platformData.type === 'moving') {
      config.bpm = bpm;
      config.colorPalette = colorPalette;

      // Support both old movement format and new states format
      if (platformData.states) {
        config.states = platformData.states;
      } else if (platformData.movement) {
        // Legacy support - convert old format to new format
        console.warn('Old movement format detected, please update to states format');
        config.movement = platformData.movement;
      }

      return new MovingPlatform(config);
    }

    return new Platform(config);
  }

  /**
   * Create all platforms from level data.
   * @param {Object} levelData - The level data object
   * @returns {Array<Platform>} Array of platform instances
   */
  static createPlatformsFromData(levelData) {
    if (!levelData.platforms || !Array.isArray(levelData.platforms)) {
      console.warn('Level data has no platforms array');
      return [];
    }

    const bpm = this.getBPM(levelData);
    const colorPalette = this.getColorPalette(levelData);

    return levelData.platforms.map(platformData =>
      this.createPlatform(platformData, bpm, colorPalette)
    );
  }

  /**
   * Get background color from level data.
   * @param {Object} levelData - The level data object
   * @returns {number} Background color as integer
   */
  static getBackgroundColor(levelData) {
    if (levelData.background && levelData.background.color) {
      return this.parseColor(levelData.background.color);
    }
    return 0x87ceeb; // Default sky blue
  }

  /**
   * Get fog settings from level data.
   * @param {Object} levelData - The level data object
   * @returns {Object|null} Fog settings or null if no fog
   */
  static getFogSettings(levelData) {
    if (levelData.background && levelData.background.fog) {
      const fog = levelData.background.fog;
      return {
        color: this.parseColor(fog.color),
        near: fog.near || 50,
        far: fog.far || 200
      };
    }
    return null;
  }

  /**
   * Get player spawn position from level data.
   * @param {Object} levelData - The level data object
   * @returns {Object} Player spawn position {x, y, z}
   */
  static getPlayerSpawnPosition(levelData) {
    if (levelData.playerSpawn) {
      return levelData.playerSpawn;
    }
    return { x: 0, y: 1, z: 0 }; // Default spawn
  }

  /**
   * Get BPM (beats per minute) from level data.
   * @param {Object} levelData - The level data object
   * @returns {number} BPM value
   */
  static getBPM(levelData) {
    return levelData.bpm || 120; // Default 120 BPM
  }

  /**
   * Get color palette from level data.
   * @param {Object} levelData - The level data object
   * @returns {Array<number>} Array of hex color integers
   */
  static getColorPalette(levelData) {
    if (!levelData.colorPalette || !Array.isArray(levelData.colorPalette)) {
      return [];
    }

    return levelData.colorPalette.map(colorString => this.parseColor(colorString));
  }
}
