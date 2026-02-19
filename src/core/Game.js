import * as THREE from 'three';
import { LevelSelectMenu } from '../ui/LevelSelectMenu.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { Level1 } from '../levels/Level1.js';

export const GameState = {
  LEVEL_SELECT: 'LEVEL_SELECT',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
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
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    // Clock for delta time
    this.clock = new THREE.Clock();

    // Current menu/level instance
    this.currentScreen = null;

    // Store paused level to resume later
    this.pausedLevel = null;

    // Handle window resize
    window.addEventListener('resize', () => this.onResize());

    // Centralized pause/unpause handling
    this.setupPauseHandling();

    // Initialize first state
    this.changeState(GameState.LEVEL_SELECT);
  }

  setupPauseHandling() {
    // Listen for pointer lock changes (ESC exits pointer lock)
    document.addEventListener('pointerlockchange', () => {
      // If we lost pointer lock while playing, pause the game
      if (this.currentState === GameState.PLAYING && !document.pointerLockElement) {
        this.changeState(GameState.PAUSED);
      }
    });

    // Listen for Tab key to pause
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && this.currentState === GameState.PLAYING) {
        event.preventDefault();
        this.changeState(GameState.PAUSED);
      } else if (event.key === 'Escape' && this.currentState === GameState.PAUSED) {
        // ESC to resume from pause menu
        this.changeState(GameState.PLAYING);
      }
    });
  }

  loadSaveData() {
    const saved = localStorage.getItem('gameProgress');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default: only level 1 unlocked
    return {
      unlockedLevels: 1,
      completedLevels: []
    };
  }

  saveSaveData() {
    localStorage.setItem('gameProgress', JSON.stringify(this.saveData));
  }

  unlockLevel(levelNumber) {
    if (levelNumber > this.saveData.unlockedLevels) {
      this.saveData.unlockedLevels = levelNumber;
      this.saveSaveData();
    }
  }

  changeState(newState, data = {}) {
    console.log(`State change: ${this.currentState} -> ${newState}`);

    // Special handling for pause/resume
    if (this.currentState === GameState.PLAYING && newState === GameState.PAUSED) {
      // Store the level without destroying it
      this.pausedLevel = this.currentScreen;
      this.currentScreen = new PauseMenu(this);
      this.previousState = this.currentState;
      this.currentState = newState;
      return;
    }

    if (this.currentState === GameState.PAUSED && newState === GameState.PLAYING) {
      // Resume from pause - destroy pause menu and restore level
      if (this.currentScreen && this.currentScreen.destroy) {
        this.currentScreen.destroy();
      }
      this.currentScreen = this.pausedLevel;
      this.pausedLevel = null;
      this.previousState = this.currentState;
      this.currentState = newState;

      // Re-request pointer lock
      this.canvas.requestPointerLock();
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
        break;

      case GameState.PLAYING:
        console.log('Starting level:', data.levelNumber);
        // Load the appropriate level based on levelNumber
        switch (data.levelNumber) {
          case 1:
            this.currentScreen = new Level1(this);
            break;
          default:
            console.warn(`Level ${data.levelNumber} not implemented yet`);
            // Fall back to level select
            this.changeState(GameState.LEVEL_SELECT);
            break;
        }

        // Request pointer lock for gameplay
        this.canvas.requestPointerLock();
        break;

      case GameState.PAUSED:
        // Should not reach here with new pause logic
        this.currentScreen = new PauseMenu(this);
        break;

      case GameState.GAME_OVER:
        // TODO: Show game over screen
        break;
    }
  }

  start() {
    console.log('Game started');
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
