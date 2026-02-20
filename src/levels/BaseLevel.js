import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import GoalIndicator from "../entities/GoalIndicator.js";
import Lava from "../entities/Lava.js";
import { Player } from "../entities/Player.js";
import { Projectile } from "../entities/Projectile.js";

/**
 * Base class for all levels in the game.
 * Handles common functionality like scene setup, camera control, and player management.
 * Subclasses should override setupPlatforms() to define level-specific geometry.
 */
export class BaseLevel {
	constructor(game) {
		this.game = game;
		this.platforms = [];

		// Clean up turrets
		if (this.turrets) {
			this.turrets.forEach((turret) => {
				turret.removeFromScene(this.game.scene);
				turret.destroy();
			});
			this.turrets = [];
		}
		this.turrets = []; // Track all turrets
		this.player = null;
		this.physicsWorld = null;
		this.projectiles = [];

		// Clean up turret projectiles
		if (this.turretProjectiles) {
			this.turretProjectiles.forEach((projectile) => {
				projectile.removeFromScene(this.game.scene);
				projectile.destroy();
			});
			this.turretProjectiles = [];
		} // Track all active projectiles
		this.turretProjectiles = []; // Track turret projectiles separately
		this.lava = null; // Lava plane entity
		this.starfield = null; // Starfield for night sky
		this.goalIndicator = null; // Goal indicator for win condition
		this.goalPlatform = null; // The platform that triggers win

		// Camera control
		this.cameraYaw = 0;
		this.cameraPitch = 0;
		this.mouseSensitivity = 0.002;

		// Camera settings (can be overridden by subclasses)
		this.cameraDistance = 10;
		this.cameraHeight = 5;
		this.aimHeight = 1.5; // Height offset for aim point above player (camera framing)
		this.shootingAimHeight = 3; // Height offset for shooting direction (keeps shooting straight)

		// Initialize keyboard state immediately (before async setup)
		this.keys = { w: false, a: false, s: false, d: false };

		// Mouse button state for shooting
		this.mouseButtons = { left: false };

		this.initAsync();
	}

	async initAsync() {
		// Initialize Rapier physics
		await RAPIER.init();
		this.physicsWorld = new RAPIER.World({ x: 0.0, y: -9.8, z: 0.0 }); // Earth-like gravity

		this.init();
		this.setupEventListeners();
	}

	init() {
		console.trace("init() call stack");

		// Hide level select UI
		const levelSelectInfo = document.getElementById("level-select-info");
		if (levelSelectInfo) {
			levelSelectInfo.style.display = "none";
		}

		// Show crosshair during gameplay
		const crosshair = document.getElementById("crosshair");
		if (crosshair) {
			crosshair.style.display = "block";
		}

		// Clear scene - THIS REMOVES EVERYTHING INCLUDING THE PLAYER!
		this.game.scene.clear();

		// Set background and fog (can be overridden via getBackgroundColor/getFogSettings)
		this.setupBackground();

		// Lighting (can be overridden via setupLighting)
		this.setupLighting();

		// Add starfield for night sky
		this.setupStarfield();

		// Create lava plane
		this.setupLava();

		// Create platforms (defined by subclass)
		this.setupPlatforms();

		// Add physics to platforms and add to scene
		if (this.platforms.length > 0) {
			this.platforms.forEach((platform) => {
				// If platform doesn't have physics yet, add it
				if (!platform.physicsWorld && this.physicsWorld) {
					platform.physicsWorld = this.physicsWorld;
					platform.createPhysicsBody();
				}
				platform.addToScene(this.game.scene);
			});
		}

		// Add turrets to scene
		if (this.turrets && this.turrets.length > 0) {
			this.turrets.forEach((turret) => {
				turret.addToScene(this.game.scene);
			});
		}

		// Setup goal indicator on furthest platform
		this.setupGoalIndicator();

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
				fogSettings.far,
			);
		}
	}

	/**
	 * Get background color for this level.
	 * Override in subclasses to customize.
	 */
	getBackgroundColor() {
		return 0x1a0a2e; // Dark purple night sky
	}

	/**
	 * Get fog settings for this level.
	 * Override in subclasses to customize or return null to disable fog.
	 */
	getFogSettings() {
		return {
			color: 0x1a0a2e, // Match purple night sky
			near: 50,
			far: 300,
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
	 * Setup starfield for night sky background.
	 */
	setupStarfield() {
		const geometry = new THREE.BufferGeometry();
		const vertices = [];

		// Create 2000 stars spread across the sky
		for (let i = 0; i < 2000; i++) {
			vertices.push(
				THREE.MathUtils.randFloatSpread(400), // X spread
				THREE.MathUtils.randFloatSpread(400), // Y spread
				THREE.MathUtils.randFloatSpread(400) - 100, // Z spread (behind player)
			);
		}

		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(vertices, 3),
		);

		const material = new THREE.PointsMaterial({
			color: 0xffffff,
			size: 0.15,
			transparent: true,
			opacity: 0.8,
		});

		this.starfield = new THREE.Points(geometry, material);
		this.game.scene.add(this.starfield);
	}

	/**
	 * Setup lava plane beneath the level.
	 * Override getLavaYPosition() in subclasses to customize lava depth.
	 */
	setupLava() {
		const lavaY = this.getLavaYPosition();
		this.lava = new Lava(this.game.scene, 800, 800, lavaY); // Much larger lava area
		console.log("Lava created at Y position:", lavaY);
	}

	/**
	 * Get Y position for lava plane.
	 * Override in subclasses to customize lava depth.
	 */
	getLavaYPosition() {
		return -15; // Default: 15 units below origin
	}

	/**
	 * Setup goal indicator on the furthest platform
	 */
	setupGoalIndicator() {
		if (this.platforms.length === 0) return;

		// Find the platform furthest from player spawn
		const spawnPos = this.getPlayerSpawnPosition();
		let furthestPlatform = null;
		let maxDistance = 0;

		this.platforms.forEach((platform) => {
			const platformPos = platform.mesh.position;
			const dx = platformPos.x - spawnPos.x;
			const dy = platformPos.y - spawnPos.y;
			const dz = platformPos.z - spawnPos.z;
			const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

			if (distance > maxDistance) {
				maxDistance = distance;
				furthestPlatform = platform;
			}
		});

		if (furthestPlatform) {
			this.goalPlatform = furthestPlatform;
			const pos = furthestPlatform.mesh.position;
			const indicatorY = pos.y + furthestPlatform.size.height / 2; // On top of platform

			this.goalIndicator = new GoalIndicator(this.game.scene, {
				x: pos.x,
				y: indicatorY,
				z: pos.z,
			});

			console.log("Goal platform set:", {
				position: pos,
				distance: maxDistance,
			});
		}
	}

	/**
	 * Setup platforms for this level.
	 * MUST be overridden by subclasses to add platforms to this.platforms array.
	 */
	setupPlatforms() {
		throw new Error("setupPlatforms() must be implemented by subclass");
	}

	/**
	 * Setup player.
	 * Override in subclasses to customize player spawn position.
	 */
	setupPlayer() {
		if (this.player) {
			console.warn("setupPlayer() called but player already exists! Skipping.");
			return;
		}

		const spawnPosition = this.getPlayerSpawnPosition();

		// Convert hex color string to integer
		const colorHex = this.game.saveData.playerColor || "#fa8072";
		const colorInt = parseInt(colorHex.replace("#", ""), 16);

		this.player = new Player({
			position: spawnPosition,
			color: colorInt,
			physicsWorld: this.physicsWorld,
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
				this.cameraPitch += event.movementY * this.mouseSensitivity; // Inverted Y axis

				// Clamp pitch to prevent flipping
				const maxPitch = Math.PI / 2 - 0.1;
				this.cameraPitch = Math.max(
					-maxPitch,
					Math.min(maxPitch, this.cameraPitch),
				);
			}
		};

		// Keyboard movement (WASD)
		this.onKeyDown = (event) => {
			const key = event.key.toLowerCase();

			if (key === "w" || key === "a" || key === "s" || key === "d") {
				this.keys[key] = true;
				event.preventDefault();
			} else if (key === "tab") {
				// Toggle gravity boots
				event.preventDefault();
				if (this.player) {
					this.player.toggleGravityBoots();
				}
			} else if (key === " ") {
				// Jump
				event.preventDefault();
				if (this.player) {
					this.player.jump();
				}
			}
		};

		this.onKeyUp = (event) => {
			const key = event.key.toLowerCase();

			if (key === "w" || key === "a" || key === "s" || key === "d") {
				this.keys[key] = false;
				event.preventDefault();
			}
		};

		// Mouse button for shooting
		this.onMouseDown = (event) => {
			if (document.pointerLockElement === this.game.canvas) {
				if (event.button === 0) {
					// Left mouse button
					this.mouseButtons.left = true;
					event.preventDefault();
				}
			}
		};

		this.onMouseUp = (event) => {
			if (event.button === 0) {
				this.mouseButtons.left = false;
				event.preventDefault();
			}
		};

		document.addEventListener("mousemove", this.onMouseMove);
		document.addEventListener("keydown", this.onKeyDown);
		document.addEventListener("keyup", this.onKeyUp);
		document.addEventListener("mousedown", this.onMouseDown);
		document.addEventListener("mouseup", this.onMouseUp);
	}

	update(delta) {
		// Update player movement based on WASD input BEFORE physics step
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

			// Handle shooting
			if (this.mouseButtons.left) {
				this.handleShooting();
			}
		}

		// Update one-way platform collisions before physics step
		this.updateOneWayPlatforms();

		// Step physics simulation AFTER player update
		if (this.physicsWorld) {
			this.physicsWorld.step();
		}

		// Update platforms (only after 20 seconds of music)
		const musicTime = this.game.soundManager
			? this.game.soundManager.getMusicTime()
			: 0;
		if (musicTime >= 21) {
			this.platforms.forEach((platform) => platform.update(delta));
		}

		// Update turrets
		this.updateTurrets(delta);

		// Update projectiles
		this.updateProjectiles(delta);

		// Check collisions
		this.checkProjectileCollisions();

		// Update lava
		if (this.lava) {
			this.lava.update(delta);

			// Check if player has fallen into lava
			if (this.player && this.lava.isDeadly(this.player.mesh.position.y)) {
				this.handlePlayerDeath();
			}
		}

		// Update goal indicator
		if (this.goalIndicator) {
			this.goalIndicator.update(delta);

			// Check if player has reached the goal platform
			if (this.player && this.goalPlatform && !this._playerWon) {
				this.checkWinCondition();
			}
		}

		// Update camera based on mouse movement
		this.updateCamera();
	}

	/**
	 * Handle player death (e.g., falling into lava)
	 * Triggers game over state
	 */
	handlePlayerDeath() {
		// Only trigger death once
		if (this._playerDead) return;
		this._playerDead = true;

		// Exit pointer lock
		if (document.pointerLockElement) {
			document.exitPointerLock();
		}

		// Trigger game over state in game
		this.game.gameOver();
	}

	/**
	 * Check if player has reached the goal platform
	 */
	checkWinCondition() {
		if (!this.player || !this.goalPlatform) return;

		const playerPos = this.player.rigidBody.translation();
		const platformPos = this.goalPlatform.mesh.position;

		// Check if player is horizontally within platform bounds
		const halfWidth = this.goalPlatform.size.width / 2;
		const halfDepth = this.goalPlatform.size.depth / 2;
		const dx = Math.abs(playerPos.x - platformPos.x);
		const dz = Math.abs(playerPos.z - platformPos.z);

		// Check if player is at correct height (on top of platform)
		const platformTop = platformPos.y + this.goalPlatform.size.height / 2;
		const playerBottom = playerPos.y - 0.8; // Bottom of player capsule

		const isOnPlatform =
			dx <= halfWidth &&
			dz <= halfDepth &&
			Math.abs(playerBottom - platformTop) < 0.5;

		if (isOnPlatform) {
			this.handlePlayerWin();
		}
	}

	/**
	 * Handle player winning (reaching goal)
	 * Triggers win state
	 */
	handlePlayerWin() {
		// Only trigger win once
		if (this._playerWon) return;
		this._playerWon = true;

		// Exit pointer lock
		if (document.pointerLockElement) {
			document.exitPointerLock();
		}

		console.log("Player won!");

		// Trigger win state in game
		this.game.playerWin();
	}

	/**
	 * Handle shooting mechanics - called when mouse button is held
	 */
	handleShooting() {
		if (!this.player) return;

		// Calculate shooting direction based on camera orientation
		// The camera looks at (player.x, player.y + aimHeight, player.z)
		// So the shooting direction is from the camera to the aim point
		const shootDirection = this.getShootingDirection();

		// Try to shoot (player handles cooldown)
		this.player.shoot(shootDirection, (projectileData) => {
			// Create and add projectile to the scene
			const projectile = new Projectile({
				position: projectileData.position,
				velocity: projectileData.velocity,
				physicsWorld: this.physicsWorld,
			});
			projectile.addToScene(this.game.scene);
			this.projectiles.push(projectile);

			// Play shoot sound (player shooting - full volume)
			if (this.game.soundManager) {
				this.game.soundManager.playSound("projectile", 0.5);
			}
		});
	}

	/**
	 * Calculate the shooting direction based on camera orientation
	 * Uses a separate aim height for shooting to keep shots straight
	 * @returns {Object} Normalized direction vector {x, y, z}
	 */
	getShootingDirection() {
		if (!this.player) return { x: 0, y: 0, z: -1 };

		// Calculate direction from camera to shooting aim point
		const cameraPos = this.game.camera.position;
		const aimPoint = {
			x: this.player.mesh.position.x,
			y: this.player.mesh.position.y + this.shootingAimHeight,
			z: this.player.mesh.position.z,
		};

		const direction = {
			x: aimPoint.x - cameraPos.x,
			y: aimPoint.y - cameraPos.y,
			z: aimPoint.z - cameraPos.z,
		};

		// Normalize
		const length = Math.sqrt(
			direction.x * direction.x +
				direction.y * direction.y +
				direction.z * direction.z,
		);
		if (length > 0) {
			direction.x /= length;
			direction.y /= length;
			direction.z /= length;
		}

		return direction;
	}

	/**
	 * Update all projectiles and clean up destroyed ones
	 */
	updateProjectiles(delta) {
		// Update all projectiles
		for (let i = this.projectiles.length - 1; i >= 0; i--) {
			const projectile = this.projectiles[i];
			projectile.update(delta);

			// Remove destroyed projectiles
			if (projectile.isDestroyed) {
				projectile.removeFromScene(this.game.scene);
				projectile.destroy();
				this.projectiles.splice(i, 1);
			}
		}
	}

	/**
	 * Update one-way platform collisions by converting them to sensors when player shouldn't collide.
	 * Sensors don't generate collision responses but can still be detected.
	 */
	updateOneWayPlatforms() {
		if (!this.player || !this.player.rigidBody) return;

		const playerPos = this.player.rigidBody.translation();
		const playerVel = this.player.rigidBody.linvel();

		// Player capsule: half-height = 0.5, radius = 0.3
		// Bottom of player capsule is at playerPos.y - 0.5 - 0.3 = playerPos.y - 0.8
		const playerBottom = playerPos.y - 0.8;
		const playerRadius = 0.3;

		// Debug logging
		if (!this._platformDebugCounter) this._platformDebugCounter = 0;
		this._platformDebugCounter++;

		this.platforms.forEach((platform, idx) => {
			if (!platform.collider) return;

			const platformPos = platform.rigidBody.translation();
			// Top of platform is at platformPos.y + size.height / 2
			const platformTop = platformPos.y + platform.size.height / 2;

			// Check if player is horizontally within the platform bounds (with margin for player radius)
			const halfWidth = platform.size.width / 2;
			const halfDepth = platform.size.depth / 2;
			const dx = Math.abs(playerPos.x - platformPos.x);
			const dz = Math.abs(playerPos.z - platformPos.z);
			const isWithinBounds =
				dx <= halfWidth + playerRadius && dz <= halfDepth + playerRadius;

			// Only disable collision (make sensor) if:
			// 1. Player is clearly BELOW the platform, OR
			// 2. Player is moving UP through it
			const isClearlyBelow = playerBottom < platformTop - 0.5;
			const isMovingUp = playerVel.y > 0.5;
			const shouldPassThrough =
				isWithinBounds && (isClearlyBelow || isMovingUp);

			// Default to solid (safer for preventing tunneling)
			const shouldBeSensor = shouldPassThrough;

			platform.collider.setSensor(shouldBeSensor);
		});
	}

	/**
	 * Update camera position based on player position and mouse input.
	 */
	updateCamera() {
		if (this.player) {
			// Calculate camera offset based on yaw and pitch
			const offsetX =
				this.cameraDistance *
				Math.sin(this.cameraYaw) *
				Math.cos(this.cameraPitch);
			const offsetZ =
				this.cameraDistance *
				Math.cos(this.cameraYaw) *
				Math.cos(this.cameraPitch);
			const offsetY =
				this.cameraDistance * Math.sin(this.cameraPitch) + this.cameraHeight;

			// Camera pivot point (slightly above player center)
			const pivotX = this.player.mesh.position.x;
			const pivotY = this.player.mesh.position.y + this.cameraHeight;
			const pivotZ = this.player.mesh.position.z;

			// Desired camera position
			const desiredCameraX = pivotX + offsetX;
			const desiredCameraY =
				pivotY + this.cameraDistance * Math.sin(this.cameraPitch);
			const desiredCameraZ = pivotZ + offsetZ;

			// Raycast from pivot point toward camera to detect obstacles
			const dirX = desiredCameraX - pivotX;
			const dirY = desiredCameraY - pivotY;
			const dirZ = desiredCameraZ - pivotZ;
			const distance = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

			// Normalize direction
			const rayDirection = {
				x: dirX / distance,
				y: dirY / distance,
				z: dirZ / distance,
			};

			const rayOrigin = { x: pivotX, y: pivotY, z: pivotZ };
			const ray = new RAPIER.Ray(rayOrigin, rayDirection);

			// Cast ray to check for obstacles, excluding the player
			const hit = this.physicsWorld.castRay(ray, distance, true);

			let finalCameraX = desiredCameraX;
			let finalCameraY = desiredCameraY;
			let finalCameraZ = desiredCameraZ;

			if (hit && hit.collider !== this.player.collider) {
				// Obstacle found - place camera just before the hit point
				const safeDistance = hit.toi - 0.2; // 0.2 unit buffer
				if (safeDistance > 0) {
					finalCameraX = pivotX + rayDirection.x * safeDistance;
					finalCameraY = pivotY + rayDirection.y * safeDistance;
					finalCameraZ = pivotZ + rayDirection.z * safeDistance;
				} else {
					// Very close to obstacle, place camera at pivot
					finalCameraX = pivotX;
					finalCameraY = pivotY;
					finalCameraZ = pivotZ;
				}
			}

			this.game.camera.position.set(finalCameraX, finalCameraY, finalCameraZ);

			// Look at a point above the player
			this.game.camera.lookAt(
				this.player.mesh.position.x,
				this.player.mesh.position.y + this.aimHeight,
				this.player.mesh.position.z,
			);
		}
	}

	destroy() {
		// Hide crosshair when leaving gameplay
		const crosshair = document.getElementById("crosshair");
		if (crosshair) {
			crosshair.style.display = "none";
		}

		// Clean up event listeners
		document.removeEventListener("mousemove", this.onMouseMove);
		document.removeEventListener("keydown", this.onKeyDown);
		document.removeEventListener("keyup", this.onKeyUp);
		document.removeEventListener("mousedown", this.onMouseDown);
		document.removeEventListener("mouseup", this.onMouseUp);
		this._listenersSetup = false;

		// Exit pointer lock
		if (document.pointerLockElement) {
			document.exitPointerLock();
		}

		// Clean up platforms
		this.platforms.forEach((platform) => {
			platform.removeFromScene(this.game.scene);
			platform.destroy();
		});
		this.platforms = [];

		// Clean up turrets
		if (this.turrets) {
			this.turrets.forEach((turret) => {
				turret.removeFromScene(this.game.scene);
				turret.destroy();
			});
			this.turrets = [];
		}

		// Clean up player
		if (this.player) {
			this.player.removeFromScene(this.game.scene);
			this.player.destroy();
			this.player = null;
		}

		// Clean up projectiles
		this.projectiles.forEach((projectile) => {
			projectile.removeFromScene(this.game.scene);
			projectile.destroy();
		});
		this.projectiles = [];

		// Clean up turret projectiles
		if (this.turretProjectiles) {
			this.turretProjectiles.forEach((projectile) => {
				projectile.removeFromScene(this.game.scene);
				projectile.destroy();
			});
			this.turretProjectiles = [];
		}

		// Clean up lava
		if (this.lava) {
			this.lava.dispose();
			this.lava = null;
		}

		// Clean up goal indicator
		if (this.goalIndicator) {
			this.goalIndicator.dispose();
			this.goalIndicator = null;
		}

		// Clean up starfield
		if (this.starfield) {
			this.starfield.geometry.dispose();
			this.starfield.material.dispose();
			this.game.scene.remove(this.starfield);
			this.starfield = null;
		}

		// Clean up physics world
		if (this.physicsWorld) {
			this.physicsWorld.free();
			this.physicsWorld = null;
		}
	}

	/**
	 * Update all turrets and handle their shooting
	 */
	updateTurrets(delta) {
		if (!this.turrets || this.turrets.length === 0) return;

		const playerPos = this.player?.rigidBody?.translation();

		for (let i = this.turrets.length - 1; i >= 0; i--) {
			const turret = this.turrets[i];
			turret.update(delta, playerPos);

			// Try to shoot at player
			if (playerPos) {
				turret.shoot(playerPos, (projectileData) => {
					const projectile = new Projectile({
						position: projectileData.position,
						velocity: projectileData.velocity,
						color: projectileData.color,
						physicsWorld: this.physicsWorld,
					});
					projectile.addToScene(this.game.scene);
					this.turretProjectiles.push(projectile);

					// Play shoot sound (turret shooting - 50% quieter)
					if (this.game.soundManager) {
						this.game.soundManager.playSound("projectile", 0.25);
					}
				});
			}

			// Remove destroyed turrets
			if (turret.isDestroyed) {
				turret.removeFromScene(this.game.scene);
				turret.destroy();
				this.turrets.splice(i, 1);
			}
		}

		// Update turret projectiles
		for (let i = this.turretProjectiles.length - 1; i >= 0; i--) {
			const projectile = this.turretProjectiles[i];
			projectile.update(delta);

			if (projectile.isDestroyed) {
				projectile.removeFromScene(this.game.scene);
				projectile.destroy();
				this.turretProjectiles.splice(i, 1);
			}
		}
	}

	/**
	 * Check collisions between projectiles and entities
	 */
	checkProjectileCollisions() {
		if (!this.physicsWorld) return;

		// Check player projectiles hitting turrets using Rapier's collision detection
		this.projectiles.forEach((projectile) => {
			if (
				!projectile.rigidBody ||
				projectile.isDestroyed ||
				!projectile.collider
			)
				return;

			// Check collision with each turret using Rapier
			this.turrets.forEach((turret) => {
				if (turret.isDestroyed || !turret.collider) return;

				// Use Rapier's intersection test
				const intersecting = this.physicsWorld.intersectionPair(
					projectile.collider,
					turret.collider,
				);

				if (intersecting) {
					// Hit! Get projectile's velocity direction for knockback
					const projectileVel = projectile.rigidBody.linvel();

					// Calculate horizontal direction only
					const velMag = Math.sqrt(
						projectileVel.x * projectileVel.x +
							projectileVel.z * projectileVel.z,
					);

					if (velMag > 0.1) {
						// Apply horizontal impulse only
						const knockbackForce = 800;
						turret.rigidBody.applyImpulse(
							{
								x: (projectileVel.x / velMag) * knockbackForce,
								y: -(projectileVel.y / velMag) * knockbackForce, // No upward force
								z: (projectileVel.z / velMag) * knockbackForce,
							},
							true,
						);
					}

					// Play collision sound (projectile hit - 50% quieter)
					if (this.game.soundManager) {
						this.game.soundManager.playSound("projectile", 0.3);
					}

					// Destroy projectile
					projectile.isDestroyed = true;
				}
			});
		});

		// Check turret projectiles hitting player
		this.turretProjectiles.forEach((projectile) => {
			if (
				!projectile.rigidBody ||
				projectile.isDestroyed ||
				!this.player?.rigidBody
			)
				return;

			const projectilePos = projectile.rigidBody.translation();
			const playerPos = this.player.rigidBody.translation();

			const dx = projectilePos.x - playerPos.x;
			const dy = projectilePos.y - playerPos.y;
			const dz = projectilePos.z - playerPos.z;
			const distSq = dx * dx + dy * dy + dz * dz;

			// Check if projectile is within player's collision radius
			if (distSq < 1.5) {
				// Hit! Apply knockback to player
				const distance = Math.sqrt(distSq);
				const direction = {
					x: dx / distance,
					y: dy / distance,
					z: dz / distance,
				};

				// Apply impulse to player
				const knockbackForce = 10;
				this.player.rigidBody.applyImpulse(
					{
						x: -direction.x * knockbackForce,
						y: -direction.y * knockbackForce,
						z: -direction.z * knockbackForce,
					},
					true,
				);

				// Play collision sound (projectile hit - 50% quieter)
				if (this.game.soundManager) {
					this.game.soundManager.playSound("projectile", 0.3);
				}

				// Destroy projectile
				projectile.isDestroyed = true;
			}
		});
	}
}
