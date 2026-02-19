import * as THREE from 'three';
import { GameState } from '../core/Game.js';

export class LevelSelectMenu {
  constructor(game) {
    this.game = game;
    this.levelBoxes = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredBox = null;

    this.init();
    this.setupEventListeners();
  }

  init() {
    // Show level select UI
    const levelSelectInfo = document.getElementById('level-select-info');
    if (levelSelectInfo) {
      levelSelectInfo.style.display = 'block';
    }

    // Clear scene
    this.game.scene.clear();

    // Setup camera position for menu
    this.game.camera.position.set(0, 2, 10);
    this.game.camera.lookAt(0, 0, 0);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.game.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    this.game.scene.add(directionalLight);

    // Create level select boxes
    const numLevels = 5;
    const spacing = 2.5;
    const startX = -(numLevels - 1) * spacing / 2;

    for (let i = 0; i < numLevels; i++) {
      const levelNumber = i + 1;
      const isUnlocked = levelNumber <= this.game.saveData.unlockedLevels;

      const box = this.createLevelBox(levelNumber, isUnlocked);
      box.position.x = startX + i * spacing;
      box.position.y = 0;
      box.userData = { levelNumber, isUnlocked };

      this.game.scene.add(box);
      this.levelBoxes.push(box);
    }

    // Add background
    this.game.scene.background = new THREE.Color(0x1a1a2e);

    // Add some particles/stars in background
    this.addStarfield();
  }

  createLevelBox(levelNumber, isUnlocked) {
    const group = new THREE.Group();

    // Create texture for each face
    const createFaceTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = isUnlocked ? '#4ecca3' : '#393e46';
      ctx.fillRect(0, 0, 256, 256);

      // Level number
      ctx.fillStyle = isUnlocked ? '#ffffff' : '#666666';
      ctx.font = 'bold 120px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(levelNumber.toString(), 128, 128);

      if (!isUnlocked) {
        // Draw lock icon
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 60px Arial';
        ctx.fillText('🔒', 128, 200);
      }

      return new THREE.CanvasTexture(canvas);
    };

    // Create 6 materials, one for each face
    const materials = [];
    for (let i = 0; i < 6; i++) {
      const texture = createFaceTexture();
      materials.push(new THREE.MeshStandardMaterial({
        map: texture,
        emissive: isUnlocked ? 0x2a7a5e : 0x1a1d23,
        emissiveIntensity: 0.2,
        metalness: 0.3,
        roughness: 0.4
      }));
    }

    // Main box with array of materials
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return group;
  }

  addStarfield() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i < 1000; i++) {
      vertices.push(
        THREE.MathUtils.randFloatSpread(100),
        THREE.MathUtils.randFloatSpread(100),
        THREE.MathUtils.randFloatSpread(100) - 50
      );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1
    });

    const stars = new THREE.Points(geometry, material);
    this.game.scene.add(stars);
  }

  setupEventListeners() {
    this.onMouseMove = (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    this.onClick = () => {
      if (this.hoveredBox && this.hoveredBox.userData.isUnlocked) {
        const levelNumber = this.hoveredBox.userData.levelNumber;
        this.game.changeState(GameState.PLAYING, { levelNumber });
      }
    };

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('click', this.onClick);
  }

  update(delta) {
    // Rotate boxes slightly
    this.levelBoxes.forEach((box, index) => {
      box.rotation.y += delta * 0.5;
      box.rotation.x = Math.sin(Date.now() * 0.001 + index) * 0.1;
    });

    // Raycast for hover detection
    this.raycaster.setFromCamera(this.mouse, this.game.camera);
    const intersects = this.raycaster.intersectObjects(this.levelBoxes, true);

    // Reset previous hover
    if (this.hoveredBox) {
      const mesh = this.hoveredBox.children[0];
      mesh.scale.set(1, 1, 1);
      this.hoveredBox = null;
      document.body.style.cursor = 'default';
    }

    // Set new hover
    if (intersects.length > 0) {
      const parent = intersects[0].object.parent;
      if (parent.userData.levelNumber) {
        this.hoveredBox = parent;
        const mesh = this.hoveredBox.children[0];
        mesh.scale.set(1.1, 1.1, 1.1);

        if (this.hoveredBox.userData.isUnlocked) {
          document.body.style.cursor = 'pointer';
        }
      }
    }
  }

  destroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    document.body.style.cursor = 'default';
  }
}
