import * as THREE from 'three';
import { Platform } from '../entities/Platform.js';
import { Player } from '../entities/Player.js';

export class Level1 {
  constructor(game) {
    this.game = game;
    this.platforms = [];
    this.player = null;

    // Camera control
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    this.mouseSensitivity = 0.002;

    this.init();
    this.setupEventListeners();
  }

  init() {
    // Hide level select UI
    const levelSelectInfo = document.getElementById('level-select-info');
    if (levelSelectInfo) {
      levelSelectInfo.style.display = 'none';
    }

    // Clear scene
    this.game.scene.clear();

    // Set background
    this.game.scene.background = new THREE.Color(0x87ceeb);

    // Add fog for depth
    this.game.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    // Lighting
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

    // Create platforms
    const platform1 = new Platform({
      position: { x: 0, y: -2, z: 0 },
      size: { width: 20, height: 1, depth: 20 },
      color: 0x808080
    });

    const platform2 = new Platform({
      position: { x: 0, y: -2, z: -30 },
      size: { width: 15, height: 1, depth: 15 },
      color: 0x606060
    });

    this.platforms.push(platform1, platform2);

    // Add platforms to scene
    this.platforms.forEach(platform => platform.addToScene(this.game.scene));

    // Create player
    this.player = new Player({
      position: { x: 0, y: 1, z: 0 },
      size: 1,
      color: 0x4ecca3
    });
    this.player.addToScene(this.game.scene);

    // Position camera for third-person view
    this.game.camera.position.set(0, 5, 10);
    this.game.camera.lookAt(0, 1, 0);

    // Store initial camera rotation
    this.cameraYaw = 0;
    this.cameraPitch = -Math.PI / 8; // Looking slightly down
  }

  setupEventListeners() {
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

    document.addEventListener('mousemove', this.onMouseMove);
  }

  update(delta) {
    // Update platforms
    this.platforms.forEach(platform => platform.update(delta));

    // Update player
    if (this.player) {
      this.player.update(delta);
    }

    // Update camera based on mouse movement
    if (this.player) {
      const cameraDistance = 10;
      const cameraHeight = 5;

      // Calculate camera position based on yaw and pitch
      const offsetX = cameraDistance * Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
      const offsetZ = cameraDistance * Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);
      const offsetY = cameraDistance * Math.sin(this.cameraPitch) + cameraHeight;

      this.game.camera.position.set(
        this.player.mesh.position.x + offsetX,
        this.player.mesh.position.y + offsetY,
        this.player.mesh.position.z + offsetZ
      );

      this.game.camera.lookAt(
        this.player.mesh.position.x,
        this.player.mesh.position.y + 1,
        this.player.mesh.position.z
      );
    }
  }

  destroy() {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.onMouseMove);

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
  }
}
