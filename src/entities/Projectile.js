import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

export class Projectile {
	constructor(options = {}) {
		this.position = options.position || { x: 0, y: 0, z: 0 };
		this.velocity = options.velocity || { x: 0, y: 0, z: 0 };
		this.physicsWorld = options.physicsWorld || null;
		this.lifetime = options.lifetime || 10.0; // Seconds before auto-destroy
		this.radius = options.radius || 0.3; // Basketball size
		this.color = options.color || 0xff6600; // Orange basketball color

		// Create visual mesh (basketball)
		const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
		const material = new THREE.MeshStandardMaterial({
			color: this.color,
			roughness: 0.8,
			metalness: 0.1,
		});
		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.position.set(this.position.x, this.position.y, this.position.z);
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;

		// Physics
		this.rigidBody = null;
		this.collider = null;
		this.isDestroyed = false;
		this.age = 0;

		// Create physics body if physics world is provided
		if (this.physicsWorld) {
			this.createPhysicsBody();
		}
	}

	createPhysicsBody() {
		const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(this.position.x, this.position.y, this.position.z)
			.setLinvel(this.velocity.x, this.velocity.y, this.velocity.z)
			.setLinearDamping(0.1) // Slight air resistance
			.setAngularDamping(0.3)
			.setCcdEnabled(true); // Enable continuous collision detection for fast projectiles

		this.rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

		this.rigidBody.setGravityScale(8.0, true);

		const colliderDesc = RAPIER.ColliderDesc.ball(this.radius)
			.setFriction(0.5)
			.setRestitution(0.6) // Bouncy like a basketball
			.setDensity(0.5); // Light like a basketball

		this.collider = this.physicsWorld.createCollider(
			colliderDesc,
			this.rigidBody,
		);
	}

	addToScene(scene) {
		scene.add(this.mesh);
	}

	removeFromScene(scene) {
		scene.remove(this.mesh);
	}

	update(delta) {
		if (this.isDestroyed) return;

		// Update age and check lifetime
		this.age += delta;
		if (this.age >= this.lifetime) {
			this.isDestroyed = true;
			return;
		}

		// Sync mesh position with physics body
		if (this.rigidBody) {
			const position = this.rigidBody.translation();
			this.mesh.position.set(position.x, position.y, position.z);

			const rotation = this.rigidBody.rotation();
			this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

			// Mark for destruction if it falls too far (out of bounds)
			if (position.y < -50) {
				this.isDestroyed = true;
			}
		}
	}

	destroy() {
		// Remove rigid body from physics world
		if (this.rigidBody && this.physicsWorld) {
			this.physicsWorld.removeRigidBody(this.rigidBody);
			this.rigidBody = null;
		}

		// Dispose of mesh
		if (this.mesh) {
			if (this.mesh.geometry) this.mesh.geometry.dispose();
			if (this.mesh.material) this.mesh.material.dispose();
		}

		this.isDestroyed = true;
	}
}
