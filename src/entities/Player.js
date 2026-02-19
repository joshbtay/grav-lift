import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class Player {
	constructor(options = {}) {
		this.position = options.position || { x: 0, y: 2, z: 0 };
		this.color = options.color || 0xfa8072; // Default salmon color
		this.onLoad = options.onLoad || null;
		this.physicsWorld = options.physicsWorld || null;

		// Create a group to hold all player parts
		this.mesh = new THREE.Group();
		this.mesh.position.set(this.position.x, this.position.y, this.position.z);
		this.mesh.scale.set(0.25, 0.25, 0.25); // Scale down to 1/4 size

		// Track loaded parts
		this.parts = {};
		this.isLoaded = false;

		// Store boot meshes for color updates
		this.leftBootMesh = null;
		this.rightBootMesh = null;

		// Physics
		this.rigidBody = null;
		this.collider = null;
		this.gravityBootsActive = true; // Boots start enabled

		// Movement parameters (velocity-based)
		this.maxSpeed = 25; // Maximum horizontal speed
		this.acceleration = 40.0; // How fast we accelerate to max speed
		this.deceleration = 30.0; // How fast we decelerate when stopping
		this.airControl = 0.3; // Reduced control in air (30% of ground control)

		// Movement state
		this.movement = { forward: 0, right: 0 };

		// Shooting
		this.lastShotTime = 0;
		this.shotCooldown = 0.4; // 100ms = 10 shots per second

		// Ground detection
		this.isGrounded = false;
		this.wasGroundedLastFrame = false;
		this.timeSinceGrounded = 0;
		this.coyoteTime = 0.15; // 150ms of coyote time
		this.groundCheckDistance = 0.6; // Distance to check for ground

		// Platform tracking for snapping
		this.currentPlatform = null;
		this.platformRelativePos = { x: 0, z: 0 }; // Position as percentage (0-1) on platform

		// Load all player model parts
		this.loadModels();

		// Create physics body if physics world is provided
		if (this.physicsWorld) {
			this.createPhysicsBody();
		}
	}

	createPhysicsBody() {
		const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(this.position.x, this.position.y, this.position.z)
			.setLinearDamping(0.0) // No damping, we handle it manually
			.setAngularDamping(10.0) // Prevent spinning
			.lockRotations() // Lock rotations completely
			.setCcdEnabled(true); // Enable continuous collision detection

		this.rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

		const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.3)
			.setFriction(0.0) // No friction, we handle stopping manually
			.setRestitution(0.0)
			.setDensity(1.0);

		this.collider = this.physicsWorld.createCollider(
			colliderDesc,
			this.rigidBody,
		);

		// Set initial gravity scale based on boots
		this.updateGravityScale();
	}

	updateGravityScale() {
		if (this.rigidBody) {
			// Boots active = 25x gravity (grounded), boots off = 6x gravity (floaty)
			const gravityScale = this.gravityBootsActive ? 15.0 : 5.0;
			this.rigidBody.setGravityScale(gravityScale, true);
		}
	}

	toggleGravityBoots() {
		this.gravityBootsActive = !this.gravityBootsActive;
		this.updateGravityScale();
		this.updateBootColor();
	}

	updateBootColor() {
		// Boots ON = gray (#444), Boots OFF = pink (#ff69b4)
		const color = this.gravityBootsActive ? 0x444444 : 0xff69b4;

		if (this.leftBootMesh && this.leftBootMesh.material) {
			this.leftBootMesh.material.color.setHex(color);
		}
		if (this.rightBootMesh && this.rightBootMesh.material) {
			this.rightBootMesh.material.color.setHex(color);
		}
	}

	checkGrounded() {
		if (!this.rigidBody || !this.physicsWorld || !this.collider) {
			return false;
		}

		const position = this.rigidBody.translation();
		const velocity = this.rigidBody.linvel();

		// Cast ray downward from bottom of capsule
		// Capsule bottom is at position.y - half_height - radius
		const capsuleBottom = position.y - 0.5 - 0.3; // half-height - radius
		const rayOrigin = { x: position.x, y: capsuleBottom + 0.1, z: position.z };
		const rayDir = { x: 0, y: -1, z: 0 };
		const maxToi = 0.2; // Check just below feet

		const ray = new RAPIER.Ray(rayOrigin, rayDir);
		const hit = this.physicsWorld.castRay(
			ray,
			maxToi,
			true,
			undefined,
			undefined,
			this.collider,
		);

		// Only trust the raycast - don't use velocity as a backup
		const grounded = hit !== null;

		this.wasGroundedLastFrame = grounded;

		return grounded;
	}

	jump() {
		if (!this.rigidBody) return;

		const canJump =
			this.isGrounded || this.timeSinceGrounded <= this.coyoteTime;

		// Only jump if grounded or within coyote time
		if (!canJump) return;

		const jumpForce = 8.0;

		// Apply upward impulse
		this.rigidBody.applyImpulse({ x: 0, y: jumpForce, z: 0 }, true);

		// Reset grounded state to prevent double jumps
		this.isGrounded = false;
		this.timeSinceGrounded = this.coyoteTime + 1;
	}

	async loadModels() {
		const loader = new GLTFLoader();
		const modelParts = [
			"body",
			"canon",
			"eyes",
			"head",
			"left_boot",
			"left_leg",
			"right_boot",
			"right_leg",
		];

		try {
			// Calculate leg color (50% darker than body)
			const bodyColor = new THREE.Color(this.color);
			const legColor = bodyColor.clone().multiplyScalar(0.5);

			const loadPromises = modelParts.map((part) => {
				return new Promise((resolve, reject) => {
					loader.load(
						`/assets/player/${part}.glb`,
						(gltf) => {
							this.parts[part] = gltf.scene;

							// Enable shadows and apply colors based on part
							gltf.scene.traverse((child) => {
								if (child.isMesh) {
									child.castShadow = true;
									child.receiveShadow = true;

									// Apply custom colors to different parts
									if (part === "body" || part === "head") {
										// Body and head use player's chosen color
										child.material = new THREE.MeshStandardMaterial({
											color: this.color,
											roughness: 0.7,
											metalness: 0.3,
										});
									} else if (part === "left_leg" || part === "right_leg") {
										// Legs are 50% darker than body
										child.material = new THREE.MeshStandardMaterial({
											color: legColor,
											roughness: 0.7,
											metalness: 0.3,
										});
									} else if (part === "canon") {
										// Canon is dark gray #333
										child.material = new THREE.MeshStandardMaterial({
											color: 0x333333,
											roughness: 0.6,
											metalness: 0.5,
										});
									} else if (part === "left_boot" || part === "right_boot") {
										// Boots are gray when ON, pink when OFF
										child.material = new THREE.MeshStandardMaterial({
											color: 0x444444, // Start gray (boots start ON)
											roughness: 0.8,
											metalness: 0.2,
										});

										// Store references to boot meshes for color updates
										if (part === "left_boot") {
											this.leftBootMesh = child;
										} else {
											this.rightBootMesh = child;
										}
									}
								}
							});

							this.mesh.add(gltf.scene);
							resolve();
						},
						undefined,
						(error) => {
							console.error(`Error loading ${part}.glb:`, error);
							reject(error);
						},
					);
				});
			});

			await Promise.all(loadPromises);
			this.isLoaded = true;

			if (this.onLoad) {
				this.onLoad();
			}
		} catch (error) {
			console.error("Error loading player models:", error);
		}
	}

	addToScene(scene) {
		scene.add(this.mesh);
	}

	removeFromScene(scene) {
		scene.remove(this.mesh);
	}

	update(delta, cameraYaw, platforms = []) {
		if (!this.rigidBody) return;

		// Sync mesh position with physics body
		const position = this.rigidBody.translation();

		// The mesh should be positioned so the player model's feet align with the capsule bottom
		// The capsule center is at position.y, and the bottom is at position.y - 0.8
		// We need to figure out where the model's origin is relative to the feet
		// For now, let's try no offset and see where the model appears
		this.mesh.position.set(position.x, position.y, position.z);

		// Rotate player mesh to face camera direction (third-person shooter style)
		this.mesh.rotation.y = cameraYaw;

		// Check if grounded
		const wasGrounded = this.isGrounded;
		this.isGrounded = this.checkGrounded();

		if (this.isGrounded) {
			this.timeSinceGrounded = 0;

			// Find which platform we're on and calculate relative position
			this.updatePlatformTracking(platforms);

			if (this.currentPlatform && !this._loggedPlatform) {
				this._loggedPlatform = true;
			}
		} else {
			this.timeSinceGrounded += delta;
			this._loggedPlatform = false;
			// If we left the ground, keep tracking platform for a bit (for coyote time)
			if (this.timeSinceGrounded > this.coyoteTime) {
				this.currentPlatform = null;
			}
		}

		// Apply movement forces based on camera direction
		const velocity = this.rigidBody.linvel();

		// Debug logging every 10 frames (~6 times per second)
		if (!this._movementLogCount) this._movementLogCount = 0;
		this._movementLogCount++;

		// Calculate control factor (less control in air)
		const controlFactor = this.isGrounded ? 1.0 : this.airControl;

		// Track state changes
		const hasInput = this.movement.forward !== 0 || this.movement.right !== 0;
		if (this._lastInputState === undefined) this._lastInputState = false;
		if (hasInput !== this._lastInputState) {
			this._lastInputState = hasInput;
		}

		// Calculate desired velocity based on input
		let targetVelX = 0;
		let targetVelZ = 0;

		if (this.movement.forward !== 0 || this.movement.right !== 0) {
			// Calculate desired movement direction based on camera yaw
			const forwardX = -Math.sin(cameraYaw) * this.movement.forward;
			const forwardZ = -Math.cos(cameraYaw) * this.movement.forward;
			const rightX = Math.cos(cameraYaw) * this.movement.right;
			const rightZ = -Math.sin(cameraYaw) * this.movement.right;

			// Normalized direction
			const dirX = forwardX + rightX;
			const dirZ = forwardZ + rightZ;
			const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
			const normDirX = length > 0 ? dirX / length : 0;
			const normDirZ = length > 0 ? dirZ / length : 0;

			// Target velocity in desired direction
			targetVelX = normDirX * this.maxSpeed;
			targetVelZ = normDirZ * this.maxSpeed;
		}

		// Interpolate current velocity towards target velocity
		const accelRate =
			this.movement.forward === 0 && this.movement.right === 0
				? this.deceleration
				: this.acceleration;
		const maxSpeedChange = accelRate * delta * controlFactor;

		// Calculate velocity change needed
		const deltaVelX = targetVelX - velocity.x;
		const deltaVelZ = targetVelZ - velocity.z;

		// Clamp the change to max speed change
		const deltaVelMag = Math.sqrt(
			deltaVelX * deltaVelX + deltaVelZ * deltaVelZ,
		);
		const clampedDeltaMag = Math.min(deltaVelMag, maxSpeedChange);

		let newVelX = velocity.x;
		let newVelZ = velocity.z;

		if (deltaVelMag > 0.001) {
			const scale = clampedDeltaMag / deltaVelMag;
			newVelX = velocity.x + deltaVelX * scale;
			newVelZ = velocity.z + deltaVelZ * scale;
		}

		// Set the new velocity
		this.rigidBody.setLinvel(
			{
				x: newVelX,
				y: velocity.y, // Preserve vertical velocity (gravity)
				z: newVelZ,
			},
			true,
		);

		// Clamp to max speed (safety check)
		const hSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
		if (hSpeed > this.maxSpeed) {
			const scale = this.maxSpeed / hSpeed;
			this.rigidBody.setLinvel(
				{
					x: velocity.x * scale,
					y: velocity.y,
					z: velocity.z * scale,
				},
				true,
			);
		}
	}

	updatePlatformTracking(platforms) {
		if (!this.rigidBody) return;

		const position = this.rigidBody.translation();

		// Find the platform directly below us
		let closestPlatform = null;
		let closestDistance = Infinity;

		for (const platform of platforms) {
			if (!platform.rigidBody) continue;

			const platformPos = platform.rigidBody.translation();
			const dx = position.x - platformPos.x;
			const dz = position.z - platformPos.z;
			const dy = position.y - platformPos.y;

			// Check if we're horizontally within the platform bounds
			const halfWidth = platform.size.width / 2;
			const halfDepth = platform.size.depth / 2;

			if (Math.abs(dx) <= halfWidth && Math.abs(dz) <= halfDepth) {
				// We're above this platform, check vertical distance
				const distance = Math.abs(dy);
				if (
					distance < closestDistance &&
					distance < this.groundCheckDistance * 2
				) {
					closestDistance = distance;
					closestPlatform = platform;
				}
			}
		}

		if (closestPlatform) {
			this.currentPlatform = closestPlatform;

			// Calculate relative position on platform (0-1 range)
			const platformPos = closestPlatform.rigidBody.translation();
			const dx = position.x - platformPos.x;
			const dz = position.z - platformPos.z;

			// Convert to percentage (0 = center, normalized to 0-1 range)
			this.platformRelativePos.x = dx / closestPlatform.size.width + 0.5;
			this.platformRelativePos.z = dz / closestPlatform.size.depth + 0.5;

			// Store reference on platform for it to snap us if it changes
			if (closestPlatform.attachedPlayer !== this) {
				closestPlatform.attachedPlayer = this;
			}
		}
	}

	/**
	 * Shoot a projectile from the player's cannon
	 * @param {Object} direction - Normalized direction vector {x, y, z}
	 * @param {Function} onShoot - Callback function that receives the projectile
	 * @returns {boolean} - True if shot was fired, false if on cooldown
	 */
	shoot(direction, onShoot) {
		const currentTime = performance.now() / 1000; // Convert to seconds

		// Check cooldown
		if (currentTime - this.lastShotTime < this.shotCooldown) {
			return false;
		}

		if (!this.rigidBody) {
			return false;
		}

		// Update last shot time
		this.lastShotTime = currentTime;

		// Get player position
		const position = this.rigidBody.translation();

		// Spawn projectile slightly in front of the player/cannon
		// The cannon is part of the player mesh, so we use the player's forward direction
		const spawnDistance = 1.0; // Spawn 1 unit in front
		const spawnPosition = {
			x: position.x + direction.x * spawnDistance,
			y: position.y + direction.y * spawnDistance,
			z: position.z + direction.z * spawnDistance,
		};

		// Calculate projectile velocity
		const projectileSpeed = 40.0; // Units per second
		const velocity = {
			x: direction.x * projectileSpeed,
			y: direction.y * projectileSpeed,
			z: direction.z * projectileSpeed,
		};

		// Apply recoil impulse to player (Newton's third law)
		const recoilStrength = 3.0; // Adjust this to tune recoil amount
		const recoilImpulse = {
			x: -direction.x * recoilStrength,
			y: -direction.y * recoilStrength,
			z: -direction.z * recoilStrength,
		};
		this.rigidBody.applyImpulse(recoilImpulse, true);

		// Call the callback with spawn data
		if (onShoot) {
			onShoot({
				position: spawnPosition,
				velocity: velocity,
			});
		}

		return true;
	}

	destroy() {
		// Remove rigid body from physics world
		if (this.rigidBody && this.physicsWorld) {
			this.physicsWorld.removeRigidBody(this.rigidBody);
			this.rigidBody = null;
		}

		// Dispose of all loaded models
		Object.values(this.parts).forEach((part) => {
			part.traverse((child) => {
				if (child.isMesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach((mat) => mat.dispose());
						} else {
							child.material.dispose();
						}
					}
				}
			});
		});
		this.parts = {};
	}
}
