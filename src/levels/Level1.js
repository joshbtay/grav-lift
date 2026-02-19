import { DataDrivenLevel } from './DataDrivenLevel.js';

/**
 * Level 1 - Introduction level
 * Loads platform configuration from assets/levels/level1.json
 */
export class Level1 extends DataDrivenLevel {
  constructor(game) {
    super(game, 1); // Pass level number to DataDrivenLevel
  }
}
