import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

/**
 * Stationary turret that fires projectiles at the player
 */
export class Turret {
	constructor(options = {}) {
		this.position = options.position || { x: 0, y: 0, z: 0 };
		this.physicsWorld = options.physicsWorld || null;
		this.color = options.color || 0xff0000; // Red

		// Shooting parameters
		this.range = 30; // Detection/firing range
		this.shotCooldown = 1.5; // Time between shots in seconds
		this.lastShotTime = 0;
		this.projectileSpeed = 40; // Projectile velocity

		// Health
		this.isDestroyed = false;

		// Visual
		this.mesh = null;
		this.barrelMesh = null;
		this.createMesh();

		// Physics
		this.rigidBody = null;
		this.collider = null;
		if (this.physicsWorld) {
			this.createPhysicsBody();
		}
	}

	createMesh() {
		// Create turret group
		this.mesh = new THREE.Group();
		this.mesh.position.set(this.position.x, this.position.y, this.position.z);

		// Base (pyramid shape)
		const baseGeometry = new THREE.ConeGeometry(0.5, 0.6, 4);
		const baseMaterial = new THREE.MeshStandardMaterial({
			color: this.color,
			roughness: 0.7,
			metalness: 0.3,
		});
		const base = new THREE.Mesh(baseGeometry, baseMaterial);
		base.rotation.y = Math.PI / 4; // Rotate to make it square
		base.castShadow = true;
		base.receiveShadow = true;
		this.mesh.add(base);

		// Barrel
		const barrelGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
		const barrelMaterial = new THREE.MeshStandardMaterial({
			color: 0x333333,
			roughness: 0.8,
			metalness: 0.5,
		});
		this.barrelMesh = new THREE.Mesh(barrelGeometry, barrelMaterial);
		this.barrelMesh.position.y = 0.3;
		this.barrelMesh.rotation.z = Math.PI / 2; // Point horizontally
		this.barrelMesh.castShadow = true;
		this.mesh.add(this.barrelMesh);
	}

	createPhysicsBody() {
		// Dynamic body (affected by gravity and forces)
		const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(this.position.x, this.position.y, this.position.z)
			.setLinearDamping(5.0) // Heavy damping to resist sliding
			.setAngularDamping(10.0) // Prevent spinning
			.setCcdEnabled(true);

		this.rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

		// Sphere collider for turret body
		const colliderDesc = RAPIER.ColliderDesc.ball(0.5)
			.setRestitution(0.3) // Less bouncy so it doesn't bounce off platforms
			.setFriction(0.9) // High friction to stay on platform
			.setDensity(2.0); // Heavy so it's harder to knock off

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

	/**
	 * Check if player is in range
	 */
	isPlayerInRange(playerPosition) {
		if (!playerPosition) return false;

		const dx = playerPosition.x - this.position.x;
		const dy = playerPosition.y - this.position.y;
		const dz = playerPosition.z - this.position.z;
		const distanceSq = dx * dx + dy * dy + dz * dz;

		return distanceSq <= this.range * this.range;
	}

	/**
	 * Calculate the angle needed to hit a target with projectile physics
	 * Returns the pitch angle accounting for gravity
	 */
	calculateBallisticAngle(targetPosition) {
		const dx = targetPosition.x - this.position.x;
		const dy = targetPosition.y - this.position.y;
		const dz = targetPosition.z - this.position.z;
		const horizontalDist = Math.sqrt(dx * dx + dz * dz);

		// Projectile physics:
		// World gravity = 1.625, projectile gravity scale = 12.0 (from Projectile.js line 47)
		// Effective gravity = 1.625 * 12.0 = 19.5
		const gravity = 19.5;
		const velocity = this.projectileSpeed;

		// Calculate angle using ballistic trajectory formula
		// tan(θ) = (v²±√(v⁴-g(gx²+2yv²))) / (gx)
		const v2 = velocity * velocity;
		const v4 = v2 * v2;
		const gx = gravity * horizontalDist;
		const discriminant =
			v4 - gravity * (gravity * horizontalDist * horizontalDist + 2 * dy * v2);

		if (discriminant < 0) {
			// Target is out of range, aim high
			return Math.atan2(dy, horizontalDist) + Math.PI / 3;
		}

		// Use the higher angle solution (lob shot)
		const angle = Math.atan((v2 + Math.sqrt(discriminant)) / gx);
		return angle;
	}

	/**
	 * Aim barrel at target with ballistic compensation
	 */
	aimAt(targetPosition) {
		if (!this.barrelMesh || !targetPosition) return;

		// Calculate direction to target
		const dx = targetPosition.x - this.position.x;
		const dz = targetPosition.z - this.position.z;

		// Calculate yaw (horizontal rotation)
		const yaw = Math.atan2(dx, dz);
		this.mesh.rotation.y = yaw;

		// Calculate pitch with ballistic compensation
		const pitch = this.calculateBallisticAngle(targetPosition);
		this.barrelMesh.rotation.y = -pitch; // Negative because of barrel orientation
	}

	/**
	 * Try to shoot at the player
	 */
	shoot(playerPosition, onShoot) {
		const currentTime = performance.now() / 1000;

		// Check cooldown
		if (currentTime - this.lastShotTime < this.shotCooldown) {
			return false;
		}

		// Check if player is in range
		if (!this.isPlayerInRange(playerPosition)) {
			return false;
		}

		// Update last shot time
		this.lastShotTime = currentTime;

		// Calculate direction to player
		const dx = playerPosition.x - this.position.x;
		const dy = playerPosition.y - this.position.y;
		const dz = playerPosition.z - this.position.z;
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

		// Normalize direction
		const direction = {
			x: dx / distance,
			y: dy / distance,
			z: dz / distance,
		};

		// Calculate spawn position (at end of barrel)
		const spawnDistance = 0.8;
		const spawnPosition = {
			x: this.position.x + direction.x * spawnDistance,
			y: this.position.y + direction.y * spawnDistance,
			z: this.position.z + direction.z * spawnDistance,
		};

		// Calculate velocity
		const velocity = {
			x: direction.x * this.projectileSpeed,
			y: direction.y * this.projectileSpeed,
			z: direction.z * this.projectileSpeed,
		};

		// Call the callback to create projectile
		if (onShoot) {
			onShoot({
				position: spawnPosition,
				velocity: velocity,
				color: 0xff0000, // Red projectile for turrets
			});
		}

		return true;
	}

	update(delta, playerPosition) {
		if (this.isDestroyed) return;

		// Sync mesh with physics body
		if (this.rigidBody) {
			const position = this.rigidBody.translation();
			this.position.x = position.x;
			this.position.y = position.y;
			this.position.z = position.z;
			this.mesh.position.set(position.x, position.y, position.z);

			// Sync rotation too (in case it tips over)
			const rotation = this.rigidBody.rotation();
			this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

			// Check if fallen off map
			if (position.y < -50) {
				this.isDestroyed = true;
			}
		}

		// Aim at player if in range
		if (playerPosition && this.isPlayerInRange(playerPosition)) {
			this.aimAt(playerPosition);
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
			this.mesh.traverse((child) => {
				if (child.geometry) child.geometry.dispose();
				if (child.material) child.material.dispose();
			});
		}

		this.isDestroyed = true;
	}
}
