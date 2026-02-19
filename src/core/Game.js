import * as THREE from "three";
import { LevelRegistry } from "../levels/LevelRegistry.js";
import { LevelSelectMenu } from "../ui/LevelSelectMenu.js";
import { PauseMenu } from "../ui/PauseMenu.js";
import { GameOverMenu } from "../ui/GameOverMenu.js";
import { WinMenu } from "../ui/WinMenu.js";
import { SoundManager } from "../audio/SoundManager.js";

export const GameState = {
	LEVEL_SELECT: "LEVEL_SELECT",
	PLAYING: "PLAYING",
	PAUSED: "PAUSED",
	GAME_OVER: "GAME_OVER",
	WIN: "WIN",
};

export class Game {
	constructor(canvas) {
		this.canvas = canvas;
		this.currentState = GameState.LEVEL_SELECT;
		this.previousState = null;

		// Save system - track unlocked levels
		this.saveData = this.loadSaveData();

		// Three.js setup
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			1000,
		);

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
		});
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.shadowMap.enabled = true;

		// Audio setup
		this.audioListener = new THREE.AudioListener();
		this.camera.add(this.audioListener);
		this.soundManager = new SoundManager(this.audioListener);

		// Load sounds
		this.loadSounds();

		// Clock for delta time
		this.clock = new THREE.Clock();

		// Current menu/level instance
		this.currentScreen = null;

		// Store paused level to resume later
		this.pausedLevel = null;

		// Track current level number for retry
		this.currentLevelNumber = null;

		// Handle window resize
		window.addEventListener("resize", () => this.onResize());

		// Centralized pause/unpause handling
		this.setupPauseHandling();

		// Initialize first state
		this.changeState(GameState.LEVEL_SELECT);
	}

	setupPauseHandling() {
		// Listen for pointer lock changes (ESC exits pointer lock)
		document.addEventListener("pointerlockchange", () => {
			const isLocked = !!document.pointerLockElement;

			// Only react to losing pointer lock while actively playing
			if (this.currentState === GameState.PLAYING && !isLocked) {
				this.changeState(GameState.PAUSED);
			}
		});

		// Listen for ESC in pause menu to resume
		window.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && this.currentState === GameState.PAUSED) {
				// ESC to resume from pause menu
				this.changeState(GameState.PLAYING);
			}
		});
	}

	async loadSounds() {
		try {
			await this.soundManager.loadSound('projectile', '/assets/projectile.mp3');
			await this.soundManager.loadSound('music', '/assets/song.mp3');
		} catch (error) {
			console.error('Error loading sounds:', error);
		}
	}

	loadSaveData() {
		const saved = localStorage.getItem("gameProgress");
		if (saved) {
			return JSON.parse(saved);
		}
		// Default: only level 1 unlocked
		return {
			unlockedLevels: 1,
			completedLevels: [],
			playerName: "",
			playerColor: "#fa8072", // Salmon default
		};
	}

	saveSaveData() {
		localStorage.setItem("gameProgress", JSON.stringify(this.saveData));
	}

	unlockLevel(levelNumber) {
		if (levelNumber > this.saveData.unlockedLevels) {
			this.saveData.unlockedLevels = levelNumber;
			this.saveSaveData();
		}
	}

	updatePlayerName(name) {
		this.saveData.playerName = name;
		this.saveSaveData();
	}

	updatePlayerColor(color) {
		this.saveData.playerColor = color;
		this.saveSaveData();
	}

	changeState(newState, data = {}) {
		// Special handling for pause/resume
		if (
			this.currentState === GameState.PLAYING &&
			newState === GameState.PAUSED
		) {
			// Store the level without destroying it
			this.pausedLevel = this.currentScreen;
			this.currentScreen = new PauseMenu(this);
			this.previousState = this.currentState;
			this.currentState = newState;

			// Pause background music
			if (this.soundManager) {
				this.soundManager.pauseBackgroundMusic();
			}
			return;
		}

		if (
			this.currentState === GameState.PAUSED &&
			newState === GameState.PLAYING
		) {
			// Resume from pause - destroy pause menu and restore level
			if (this.currentScreen && this.currentScreen.destroy) {
				this.currentScreen.destroy();
			}
			this.currentScreen = this.pausedLevel;
			this.pausedLevel = null;
			this.previousState = this.currentState;
			this.currentState = newState;

			// Resume background music
			if (this.soundManager) {
				this.soundManager.resumeBackgroundMusic();
			}

			// Re-request pointer lock after a brief delay to avoid race condition
			// with pointerlockchange event
			setTimeout(() => {
				if (this.currentState === GameState.PLAYING) {
					this.canvas.requestPointerLock();
				}
			}, 100);
			return;
		}

		// Cleanup current screen (normal transitions)
		if (this.currentScreen && this.currentScreen.destroy) {
			this.currentScreen.destroy();
		}

		// Clear any paused level if we're leaving
		if (this.pausedLevel) {
			if (this.pausedLevel.destroy) {
				this.pausedLevel.destroy();
			}
			this.pausedLevel = null;
		}

		this.previousState = this.currentState;
		this.currentState = newState;

		// Initialize new state
		switch (newState) {
			case GameState.LEVEL_SELECT:
				this.currentScreen = new LevelSelectMenu(this);
				this.currentLevelNumber = null;

				// Stop any music when returning to level select
				if (this.soundManager) {
					this.soundManager.stopBackgroundMusic();
				}
				break;

			case GameState.PLAYING:
				// If we have a level number in data, use it (starting new level)
				// Otherwise use currentLevelNumber (retrying after game over)
				const levelNumber = data.levelNumber || this.currentLevelNumber;
				console.log("Starting level:", levelNumber);

				// Store level number for retry
				this.currentLevelNumber = levelNumber;

				// Load the appropriate level based on levelNumber using the registry
				this.currentScreen = LevelRegistry.createLevel(levelNumber, this);

				if (!this.currentScreen) {
					console.warn(`Level ${levelNumber} not implemented yet`);
					// Fall back to level select
					this.changeState(GameState.LEVEL_SELECT);
					return;
				}

				// Request pointer lock for gameplay
				this.canvas.requestPointerLock();

				// Handle music based on previous state
				if (this.soundManager) {
					if (this.previousState === GameState.GAME_OVER) {
						// Resume music if retrying after game over
						this.soundManager.resumeBackgroundMusic();
					} else {
						// Start fresh music for new level
						this.soundManager.playBackgroundMusic('music', 0.3, true);
					}
				}
				break;

			case GameState.PAUSED:
				// Should not reach here with new pause logic
				this.currentScreen = new PauseMenu(this);

				// Pause background music
				if (this.soundManager) {
					this.soundManager.pauseBackgroundMusic();
				}
				break;

			case GameState.GAME_OVER:
				// Show game over screen
				this.currentScreen = new GameOverMenu(this);

				// Pause background music (so it can resume on retry)
				if (this.soundManager) {
					this.soundManager.pauseBackgroundMusic();
				}
				break;

			case GameState.WIN:
				// Show win screen and unlock next level
				const nextLevel = this.currentLevelNumber + 1;
				this.unlockLevel(nextLevel);
				this.currentScreen = new WinMenu(this);

				// Stop background music
				if (this.soundManager) {
					this.soundManager.stopBackgroundMusic();
				}
				break;
		}
	}

	/**
	 * Trigger game over state - called when player dies
	 */
	gameOver() {
		this.changeState(GameState.GAME_OVER);
	}

	/**
	 * Trigger win state - called when player reaches goal
	 */
	playerWin() {
		this.changeState(GameState.WIN);
	}

	start() {
		console.log("Game started");
		this.animate();
	}

	animate() {
		requestAnimationFrame(() => this.animate());

		const delta = this.clock.getDelta();

		// Update current screen/level
		if (this.currentScreen && this.currentScreen.update) {
			this.currentScreen.update(delta);
		}

		// Render
		this.renderer.render(this.scene, this.camera);
	}

	onResize() {
		const width = window.innerWidth;
		const height = window.innerHeight;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize(width, height);
	}
}
