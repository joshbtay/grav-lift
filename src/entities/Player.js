import * as THREE from 'three';

export class Player {
  constructor(options = {}) {
    this.position = options.position || { x: 0, y: 2, z: 0 };
    this.size = options.size || 1;
    this.color = options.color || 0x4ecca3;

    this.mesh = this.createMesh();
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

  createMesh() {
    const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);

    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.6,
      metalness: 0.4
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  addToScene(scene) {
    scene.add(this.mesh);
  }

  removeFromScene(scene) {
    scene.remove(this.mesh);
  }

  update(delta) {
    // Will add movement logic later
  }

  destroy() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}
