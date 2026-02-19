import * as THREE from 'three';

export class Platform {
  constructor(options = {}) {
    this.position = options.position || { x: 0, y: 0, z: 0 };
    this.size = options.size || { width: 10, height: 1, depth: 10 };
    this.color = options.color || 0x808080;

    this.mesh = this.createMesh();
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

  createMesh() {
    const geometry = new THREE.BoxGeometry(
      this.size.width,
      this.size.height,
      this.size.depth
    );

    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.8,
      metalness: 0.2
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
    // Override in subclasses for moving platforms
  }

  destroy() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}
