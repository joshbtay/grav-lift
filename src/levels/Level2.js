import { DataDrivenLevel } from './DataDrivenLevel.js';

/**
 * Level 2 - Jump Challenge
 * Loads platform configuration from assets/levels/level2.json
 */
export class Level2 extends DataDrivenLevel {
  constructor(game) {
    super(game, 2); // Pass level number to DataDrivenLevel
  }
}
