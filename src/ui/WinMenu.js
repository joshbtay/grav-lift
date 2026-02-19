import * as THREE from 'three';
import { GameState } from '../core/Game.js';

export class WinMenu {
  constructor(game) {
    this.game = game;
    this.buttons = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredButton = null;

    this.init();
    this.setupEventListeners();
  }

  init() {
    // Don't clear the scene - we want to show the level in the background
    // Just add menu elements on top

    // Store and disable fog temporarily so menu is always visible
    this.previousFog = this.game.scene.fog;
    this.game.scene.fog = null;

    // Get camera direction
    const cameraDirection = new THREE.Vector3();
    this.game.camera.getWorldDirection(cameraDirection);

    // Create semi-transparent green overlay plane for victory
    const overlayGeometry = new THREE.PlaneGeometry(20, 20);
    const overlayMaterial = new THREE.MeshBasicMaterial({
      color: 0x003300,  // Dark green tint for victory
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    this.overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
    this.overlay.renderOrder = 999;

    // Position overlay in front of camera
    this.overlay.position.copy(this.game.camera.position).add(cameraDirection.clone().multiplyScalar(8));
    this.overlay.quaternion.copy(this.game.camera.quaternion);
    this.game.scene.add(this.overlay);

    // Create menu container group
    this.menuGroup = new THREE.Group();

    // Position menu in front of camera (closer than overlay)
    this.menuGroup.position.copy(this.game.camera.position).add(cameraDirection.multiplyScalar(5));
    this.menuGroup.quaternion.copy(this.game.camera.quaternion);

    // Add light to illuminate menu
    const menuLight = new THREE.PointLight(0xffffff, 2, 20);
    menuLight.position.set(0, 0, 2);
    this.menuGroup.add(menuLight);

    // Create title
    this.createTitle();

    // Create buttons
    this.createButton('Next Level', 0, { action: 'nextLevel' });
    this.createButton('Back to Level Select', -1.5, { action: 'levelSelect' });

    this.game.scene.add(this.menuGroup);
  }

  createTitle() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Draw "VICTORY!" text with golden glow
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20;
    ctx.fillText('VICTORY!', 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(4, 1, 1);
    sprite.position.y = 2;
    sprite.renderOrder = 1000;
    this.menuGroup.add(sprite);
  }

  createButton(text, yOffset, userData) {
    const group = new THREE.Group();
    group.userData = userData;

    // Create beveled box geometry
    const width = 3;
    const height = 0.8;
    const depth = 0.3;
    const bevel = 0.05;

    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;

    shape.moveTo(x + bevel, y);
    shape.lineTo(x + width - bevel, y);
    shape.lineTo(x + width, y + bevel);
    shape.lineTo(x + width, y + height - bevel);
    shape.lineTo(x + width - bevel, y + height);
    shape.lineTo(x + bevel, y + height);
    shape.lineTo(x, y + height - bevel);
    shape.lineTo(x, y + bevel);
    shape.lineTo(x + bevel, y);

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const material = new THREE.MeshStandardMaterial({
      color: 0x44cc44,      // Green button color for victory
      emissive: 0x228822,   // Green emissive
      emissiveIntensity: 0.3,
      metalness: 0.6,
      roughness: 0.4,
      depthTest: false,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1000;
    group.add(mesh);

    // Add text label
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2.8, 0.7, 1);
    sprite.position.z = depth + 0.1;
    sprite.renderOrder = 1001;
    group.add(sprite);

    group.position.y = yOffset;
    this.menuGroup.add(group);
    this.buttons.push(group);

    return group;
  }

  setupEventListeners() {
    this.onMouseMove = (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    this.onClick = () => {
      if (this.hoveredButton) {
        const action = this.hoveredButton.userData.action;

        if (action === 'nextLevel') {
          // Try to load next level
          const nextLevelNumber = this.game.currentLevelNumber + 1;

          // Check if next level exists and is unlocked
          if (nextLevelNumber <= this.game.saveData.unlockedLevels) {
            this.game.changeState(GameState.PLAYING, { levelNumber: nextLevelNumber });
          } else {
            // No more levels or locked, go to level select
            this.game.changeState(GameState.LEVEL_SELECT);
          }
        } else if (action === 'levelSelect') {
          this.game.changeState(GameState.LEVEL_SELECT);
        }
      }
    };

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('click', this.onClick);
  }

  update(delta) {
    // Keep menu in front of camera
    const cameraDirection = new THREE.Vector3();
    this.game.camera.getWorldDirection(cameraDirection);

    this.menuGroup.position.copy(this.game.camera.position).add(cameraDirection.clone().multiplyScalar(5));
    this.menuGroup.quaternion.copy(this.game.camera.quaternion);

    this.overlay.position.copy(this.game.camera.position).add(cameraDirection.clone().multiplyScalar(8));
    this.overlay.quaternion.copy(this.game.camera.quaternion);

    // Subtle button animation
    this.buttons.forEach((button, index) => {
      const mesh = button.children[0];
      mesh.rotation.z = Math.sin(Date.now() * 0.001 + index) * 0.02;
    });

    // Raycast for hover detection
    this.raycaster.setFromCamera(this.mouse, this.game.camera);
    const intersects = this.raycaster.intersectObjects(this.buttons, true);

    // Reset previous hover
    if (this.hoveredButton) {
      const mesh = this.hoveredButton.children[0];
      mesh.scale.set(1, 1, 1);
      mesh.material.emissiveIntensity = 0.3;
      this.hoveredButton = null;
      document.body.style.cursor = 'default';
    }

    // Set new hover
    if (intersects.length > 0) {
      const parent = intersects[0].object.parent;
      if (parent.userData.action) {
        this.hoveredButton = parent;
        const mesh = this.hoveredButton.children[0];
        mesh.scale.set(1.05, 1.05, 1.05);
        mesh.material.emissiveIntensity = 0.6;
        document.body.style.cursor = 'pointer';
      }
    }
  }

  destroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    document.body.style.cursor = 'default';

    // Restore fog
    if (this.previousFog !== undefined) {
      this.game.scene.fog = this.previousFog;
    }

    // Remove menu elements from scene
    if (this.overlay) {
      this.game.scene.remove(this.overlay);
    }
    if (this.menuGroup) {
      this.game.scene.remove(this.menuGroup);
    }

    // Exit pointer lock if active
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
}
