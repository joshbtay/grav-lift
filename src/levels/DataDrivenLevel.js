import { BaseLevel } from "./BaseLevel.js";
import { LevelDataLoader } from "./LevelDataLoader.js";

/**
 * A level that loads its configuration from a JSON file.
 * Subclasses only need to specify the level number.
 */
export class DataDrivenLevel extends BaseLevel {
	constructor(game, levelNumber) {
		// Store level number before calling super
		// We'll defer initialization until after data is loaded

		// Temporarily override initAsync to prevent BaseLevel from calling it
		const originalInitAsync = BaseLevel.prototype.initAsync;
		BaseLevel.prototype.initAsync = () => {};

		super(game);

		// Restore original initAsync
		BaseLevel.prototype.initAsync = originalInitAsync;

		this.levelNumber = levelNumber;
		this.levelData = null;
		this.isReady = false;

		// Start async initialization (only once)
		this.initAsync();
	}

	async initAsync() {
		// Prevent double initialization
		if (this._initAsyncCalled) {
			return;
		}
		this._initAsyncCalled = true;

		try {
			// First, initialize physics world (from BaseLevel)
			const RAPIER = await import("@dimforge/rapier3d-compat");
			await RAPIER.default.init();
			this.physicsWorld = new RAPIER.default.World({
				x: 0.0,
				y: -1.625,
				z: 0.0,
			});

			// Load level data
			this.levelData = await LevelDataLoader.loadLevelData(this.levelNumber);

			// Now run the standard initialization
			this.init();
			this.setupEventListeners();

			this.isReady = true;
		} catch (error) {
			console.error('Error loading level:', error);
			console.error('Stack:', error.stack);
			// Fallback to empty level
			this.init();
		}
	}

	/**
	 * Setup platforms from loaded level data.
	 */
	setupPlatforms() {
		if (!this.levelData) {
			return;
		}

		const result = LevelDataLoader.createPlatformsFromData(this.levelData, this.physicsWorld);
		this.platforms = result.platforms;
		this.turrets = result.turrets;
	}

	/**
	 * Get background color from level data.
	 */
	getBackgroundColor() {
		if (this.levelData) {
			return LevelDataLoader.getBackgroundColor(this.levelData);
		}
		return super.getBackgroundColor();
	}

	/**
	 * Get fog settings from level data.
	 */
	getFogSettings() {
		if (this.levelData) {
			return LevelDataLoader.getFogSettings(this.levelData);
		}
		return super.getFogSettings();
	}

	/**
	 * Get player spawn position from level data.
	 */
	getPlayerSpawnPosition() {
		const position = this.levelData
			? LevelDataLoader.getPlayerSpawnPosition(this.levelData)
			: super.getPlayerSpawnPosition();

		return position;
	}

	/**
	 * Override update to prevent issues before data is loaded.
	 */
	update(delta) {
		if (this.isReady) {
			super.update(delta);
		}
	}
}
