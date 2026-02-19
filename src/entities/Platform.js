import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class Platform {
  constructor(options = {}) {
    this.position = options.position || { x: 0, y: 0, z: 0 };
    this.size = options.size || { width: 10, height: 1, depth: 10 };
    this.color = options.color || 0x808080;
    this.physicsWorld = options.physicsWorld || null;

    this.mesh = this.createMesh();
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    this.rigidBody = null;

    // Track if a player is standing on this platform
    this.attachedPlayer = null;

    // Create physics body if physics world is provided
    if (this.physicsWorld) {
      this.createPhysicsBody();
    }
  }

  createPhysicsBody() {
    // Create a fixed (static) rigid body for the platform
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(this.position.x, this.position.y, this.position.z);

    this.rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

    // Create a cuboid collider matching the platform size
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      this.size.width / 2,
      this.size.height / 2,
      this.size.depth / 2
    ).setFriction(0.7);

    const collider = this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
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

  /**
   * Update the platform size and snap any attached player proportionally.
   * Call this when a platform changes size dynamically.
   */
  updateSize(newSize) {
    if (!this.rigidBody) return;

    const oldSize = { ...this.size };
    this.size = { ...newSize };

    // Update mesh geometry
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.BoxGeometry(
      this.size.width,
      this.size.height,
      this.size.depth
    );

    // Remove old collider and create new one
    if (this.physicsWorld) {
      // Get current colliders
      const numColliders = this.rigidBody.numColliders();
      for (let i = numColliders - 1; i >= 0; i--) {
        const collider = this.rigidBody.collider(i);
        this.physicsWorld.removeCollider(collider, false);
      }

      // Create new collider with updated size
      const colliderDesc = RAPIER.ColliderDesc.cuboid(
        this.size.width / 2,
        this.size.height / 2,
        this.size.depth / 2
      ).setFriction(0.7);

      this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
    }

    // Snap player proportionally if they're on this platform
    if (this.attachedPlayer && this.attachedPlayer.currentPlatform === this) {
      const relPos = this.attachedPlayer.platformRelativePos;
      const platformPos = this.rigidBody.translation();

      // Calculate new absolute position based on percentage
      const newX = platformPos.x + (relPos.x - 0.5) * this.size.width;
      const newZ = platformPos.z + (relPos.z - 0.5) * this.size.depth;
      const newY = this.attachedPlayer.rigidBody.translation().y; // Keep same Y

      // Teleport player to new position
      this.attachedPlayer.rigidBody.setTranslation({ x: newX, y: newY, z: newZ }, true);
    }
  }

  destroy() {
    // Remove rigid body from physics world
    if (this.rigidBody && this.physicsWorld) {
      this.physicsWorld.removeRigidBody(this.rigidBody);
      this.rigidBody = null;
    }

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}
