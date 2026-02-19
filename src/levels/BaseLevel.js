import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Player } from '../entities/Player.js';

/**
 * Base class for all levels in the game.
 * Handles common functionality like scene setup, camera control, and player management.
 * Subclasses should override setupPlatforms() to define level-specific geometry.
 */
export class BaseLevel {
  constructor(game) {
    this.game = game;
    this.platforms = [];
    this.player = null;
    this.physicsWorld = null;

    // Camera control
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    this.mouseSensitivity = 0.002;

    // Camera settings (can be overridden by subclasses)
    this.cameraDistance = 10;
    this.cameraHeight = 5;
    this.aimHeight = 3; // Height offset for aim point above player

    // Initialize keyboard state immediately (before async setup)
    this.keys = { w: false, a: false, s: false, d: false };

    this.initAsync();
  }

  async initAsync() {
    // Initialize Rapier physics
    await RAPIER.init();
    this.physicsWorld = new RAPIER.World({ x: 0.0, y: -1.625, z: 0.0 }); // Low gravity (moon-like)

    this.init();
    this.setupEventListeners();
  }

  init() {
    console.log('BaseLevel.init() called');
    console.trace('init() call stack');

    // Hide level select UI
    const levelSelectInfo = document.getElementById('level-select-info');
    if (levelSelectInfo) {
      levelSelectInfo.style.display = 'none';
    }

    // Clear scene - THIS REMOVES EVERYTHING INCLUDING THE PLAYER!
    console.log('Clearing scene - this will remove all meshes');
    this.game.scene.clear();

    // Set background and fog (can be overridden via getBackgroundColor/getFogSettings)
    this.setupBackground();

    // Lighting (can be overridden via setupLighting)
    this.setupLighting();

    // Create platforms (defined by subclass)
    this.setupPlatforms();

    // Add physics to platforms and add to scene
    if (this.platforms.length > 0) {
      console.log('Processing', this.platforms.length, 'platforms');
      this.platforms.forEach(platform => {
        // If platform doesn't have physics yet, add it
        if (!platform.physicsWorld && this.physicsWorld) {
          platform.physicsWorld = this.physicsWorld;
          platform.createPhysicsBody();
        }
        platform.addToScene(this.game.scene);
      });
    }

    // Create player
    this.setupPlayer();

    // Position camera for third-person view
    this.setupCamera();
  }

  /**
   * Setup background color and fog.
   * Subclasses can override getBackgroundColor() and getFogSettings() to customize.
   */
  setupBackground() {
    const bgColor = this.getBackgroundColor();
    this.game.scene.background = new THREE.Color(bgColor);

    const fogSettings = this.getFogSettings();
    if (fogSettings) {
      this.game.scene.fog = new THREE.Fog(
        fogSettings.color,
        fogSettings.near,
        fogSettings.far
      );
    }
  }

  /**
   * Get background color for this level.
   * Override in subclasses to customize.
   */
  getBackgroundColor() {
    return 0x87ceeb; // Sky blue
  }

  /**
   * Get fog settings for this level.
   * Override in subclasses to customize or return null to disable fog.
   */
  getFogSettings() {
    return {
      color: 0x87ceeb,
      near: 50,
      far: 200
    };
  }

  /**
   * Setup lighting for the level.
   * Override in subclasses to customize lighting.
   */
  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.game.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.game.scene.add(directionalLight);
  }

  /**
   * Setup platforms for this level.
   * MUST be overridden by subclasses to add platforms to this.platforms array.
   */
  setupPlatforms() {
    throw new Error('setupPlatforms() must be implemented by subclass');
  }

  /**
   * Setup player.
   * Override in subclasses to customize player spawn position.
   */
  setupPlayer() {
    if (this.player) {
      console.warn('setupPlayer() called but player already exists! Skipping.');
      return;
    }

    const spawnPosition = this.getPlayerSpawnPosition();

    // Convert hex color string to integer
    const colorHex = this.game.saveData.playerColor || '#fa8072';
    const colorInt = parseInt(colorHex.replace('#', ''), 16);

    this.player = new Player({
      position: spawnPosition,
      color: colorInt,
      physicsWorld: this.physicsWorld
    });
    this.player.addToScene(this.game.scene);
  }

  /**
   * Get player spawn position for this level.
   * Override in subclasses to customize.
   * Note: This is the position of the capsule collider center.
   * The capsule has total height of 1.6, so bottom is 0.8 below this point.
   */
  getPlayerSpawnPosition() {
    return { x: 0, y: 1, z: 0 }; // Default spawn
  }

  /**
   * Setup initial camera position and rotation.
   */
  setupCamera() {
    this.game.camera.position.set(0, 5, 10);
    this.game.camera.lookAt(0, 4, 0);

    // Store initial camera rotation
    this.cameraYaw = 0;
    this.cameraPitch = -Math.PI / 8; // Looking slightly down
  }

  setupEventListeners() {
    // Prevent duplicate event listener registration
    if (this._listenersSetup) {
      return;
    }
    this._listenersSetup = true;

    // Mouse movement for camera control
    this.onMouseMove = (event) => {
      if (document.pointerLockElement === this.game.canvas) {
        this.cameraYaw -= event.movementX * this.mouseSensitivity;
        this.cameraPitch -= event.movementY * this.mouseSensitivity;

        // Clamp pitch to prevent flipping
        const maxPitch = Math.PI / 2 - 0.1;
        this.cameraPitch = Math.max(-maxPitch, Math.min(maxPitch, this.cameraPitch));
      }
    };

    // Keyboard movement (WASD)
    this.onKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        this.keys[key] = true;
        event.preventDefault();
      } else if (key === 'tab') {
        // Toggle gravity boots
        event.preventDefault();
        if (this.player) {
          this.player.toggleGravityBoots();
        }
      } else if (key === ' ') {
        // Jump
        event.preventDefault();
        if (this.player) {
          this.player.jump();
        }
      }
    };

    this.onKeyUp = (event) => {
      const key = event.key.toLowerCase();

      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        this.keys[key] = false;
        event.preventDefault();
      }
    };

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  }

  update(delta) {
    // Step physics simulation
    if (this.physicsWorld) {
      this.physicsWorld.step();
    }

    // Update platforms
    this.platforms.forEach(platform => platform.update(delta));

    // Update player movement based on WASD input
    if (this.player) {
      // Convert WASD to movement vector
      let forward = 0;
      let right = 0;

      if (this.keys.w) forward += 1;
      if (this.keys.s) forward -= 1;
      if (this.keys.d) right += 1;
      if (this.keys.a) right -= 1;

      // Normalize diagonal movement
      if (forward !== 0 && right !== 0) {
        const length = Math.sqrt(forward * forward + right * right);
        forward /= length;
        right /= length;
      }

      this.player.movement = { forward, right };
      this.player.update(delta, this.cameraYaw, this.platforms);
    }

    // Update camera based on mouse movement
    this.updateCamera();
  }

  /**
   * Update camera position based on player position and mouse input.
   */
  updateCamera() {
    if (this.player) {
      // Calculate camera position based on yaw and pitch
      const offsetX = this.cameraDistance * Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
      const offsetZ = this.cameraDistance * Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
      const offsetY = this.cameraDistance * Math.sin(this.cameraPitch) + this.cameraHeight;

      this.game.camera.position.set(
        this.player.mesh.position.x + offsetX,
        this.player.mesh.position.y + offsetY,
        this.player.mesh.position.z + offsetZ
      );

      // Look at a point above the player to position player at bottom 20% of screen
      // The center of the screen (crosshair) is where the cannon aims
      this.game.camera.lookAt(
        this.player.mesh.position.x,
        this.player.mesh.position.y + this.aimHeight,
        this.player.mesh.position.z
      );
    }
  }

  destroy() {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this._listenersSetup = false;

    // Exit pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Clean up platforms
    this.platforms.forEach(platform => {
      platform.removeFromScene(this.game.scene);
      platform.destroy();
    });
    this.platforms = [];

    // Clean up player
    if (this.player) {
      this.player.removeFromScene(this.game.scene);
      this.player.destroy();
      this.player = null;
    }

    // Clean up physics world
    if (this.physicsWorld) {
      this.physicsWorld.free();
      this.physicsWorld = null;
    }
  }
}
