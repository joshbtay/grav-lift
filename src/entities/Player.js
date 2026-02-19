import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';

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
    this.moveSpeed = 5.0;

    // Movement state
    this.movement = { forward: 0, right: 0 };

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
    // Create a capsule collider for the player
    // The capsule is oriented vertically by default in Rapier
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(this.position.x, this.position.y, this.position.z)
      .setLinearDamping(0.5)
      .setAngularDamping(10.0) // Prevent spinning
      .lockRotations() // Lock rotations completely
      .setCcdEnabled(true); // Enable continuous collision detection

    this.rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);

    // Capsule collider (half-height, radius)
    // Half-height of 0.5 means total height of 1.0 + 2 hemispheres (radius each)
    // Total height = 1.0 + 0.3*2 = 1.6 units
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.3)
      .setFriction(0.5)
      .setRestitution(0.0)
      .setDensity(1.0);

    this.collider = this.physicsWorld.createCollider(colliderDesc, this.rigidBody);

    // Set initial gravity scale based on boots
    this.updateGravityScale();

    // Log initial physics state
    console.log('Player physics body created:', {
      position: this.rigidBody.translation(),
      capsuleHalfHeight: 0.5,
      capsuleRadius: 0.3,
      totalHeight: 1.6,
      bottomOffset: -0.8,
      colliderHandle: this.collider.handle
    });
  }

  updateGravityScale() {
    if (this.rigidBody) {
      // Boots active = 10x gravity, boots off = 1x gravity
      const gravityScale = this.gravityBootsActive ? 10.0 : 1.0;
      this.rigidBody.setGravityScale(gravityScale, true);
    }
  }

  toggleGravityBoots() {
    this.gravityBootsActive = !this.gravityBootsActive;
    this.updateGravityScale();
    this.updateBootColor();
    console.log('Gravity boots:', this.gravityBootsActive ? 'ON' : 'OFF');
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
      console.log('checkGrounded: missing components', {
        rigidBody: !!this.rigidBody,
        physicsWorld: !!this.physicsWorld,
        collider: !!this.collider
      });
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
    const hit = this.physicsWorld.castRay(ray, maxToi, true, undefined, undefined, this.collider);

    // Only trust the raycast - don't use velocity as a backup
    const grounded = hit !== null;

    // Log details every 600 frames (about once per 10 seconds)
    if (!this._debugFrameCount) this._debugFrameCount = 0;
    this._debugFrameCount++;
    if (this._debugFrameCount % 600 === 0) {
      console.log('Ground check:', {
        position: { x: position.x.toFixed(2), y: position.y.toFixed(2), z: position.z.toFixed(2) },
        capsuleBottom: capsuleBottom.toFixed(2),
        rayOrigin: { x: rayOrigin.x.toFixed(2), y: rayOrigin.y.toFixed(2), z: rayOrigin.z.toFixed(2) },
        hit: hit !== null,
        hitToi: hit ? hit.toi.toFixed(3) : 'N/A',
        velocityY: velocity.y.toFixed(2),
        grounded
      });
    }

    if (grounded !== this.wasGroundedLastFrame) {
      console.log(grounded ? 'LANDED' : 'LEFT GROUND', {
        hit: hit !== null,
        velocityY: velocity.y.toFixed(2),
        position: position.y.toFixed(2)
      });
    }
    this.wasGroundedLastFrame = grounded;

    return grounded;
  }

  jump() {
    if (!this.rigidBody) return;

    const canJump = this.isGrounded || this.timeSinceGrounded <= this.coyoteTime;

    console.log('JUMP ATTEMPT:', {
      canJump,
      isGrounded: this.isGrounded,
      timeSinceGrounded: this.timeSinceGrounded.toFixed(3),
      coyoteTime: this.coyoteTime
    });

    // Only allow jumping if grounded or within coyote time
    if (!canJump) {
      console.log('  -> BLOCKED (not grounded)');
      return;
    }

    console.log('  -> SUCCESS');

    // Jump force depends on gravity boots state
    // Boots ON (high gravity): smaller jump
    // Boots OFF (low gravity): much larger jump
    const jumpForce = this.gravityBootsActive ? 6.0 : 18.0;

    // Apply upward impulse
    this.rigidBody.applyImpulse({ x: 0, y: jumpForce, z: 0 }, true);

    // Reset grounded state to prevent double jumps
    this.isGrounded = false;
    this.timeSinceGrounded = this.coyoteTime + 1;
  }

  async loadModels() {
    const loader = new GLTFLoader();
    const modelParts = [
      'body',
      'canon',
      'eyes',
      'head',
      'left_boot',
      'left_leg',
      'right_boot',
      'right_leg'
    ];

    try {
      // Calculate leg color (50% darker than body)
      const bodyColor = new THREE.Color(this.color);
      const legColor = bodyColor.clone().multiplyScalar(0.5);

      const loadPromises = modelParts.map(part => {
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
                  if (part === 'body' || part === 'head') {
                    // Body and head use player's chosen color
                    child.material = new THREE.MeshStandardMaterial({
                      color: this.color,
                      roughness: 0.7,
                      metalness: 0.3
                    });
                  } else if (part === 'left_leg' || part === 'right_leg') {
                    // Legs are 50% darker than body
                    child.material = new THREE.MeshStandardMaterial({
                      color: legColor,
                      roughness: 0.7,
                      metalness: 0.3
                    });
                  } else if (part === 'canon') {
                    // Canon is dark gray #333
                    child.material = new THREE.MeshStandardMaterial({
                      color: 0x333333,
                      roughness: 0.6,
                      metalness: 0.5
                    });
                  } else if (part === 'left_boot' || part === 'right_boot') {
                    // Boots are gray when ON, pink when OFF
                    child.material = new THREE.MeshStandardMaterial({
                      color: 0x444444, // Start gray (boots start ON)
                      roughness: 0.8,
                      metalness: 0.2
                    });

                    // Store references to boot meshes for color updates
                    if (part === 'left_boot') {
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
            }
          );
        });
      });

      await Promise.all(loadPromises);
      this.isLoaded = true;
      console.log('Player model loaded successfully');

      if (this.onLoad) {
        this.onLoad();
      }
    } catch (error) {
      console.error('Error loading player models:', error);
    }
  }

  addToScene(scene) {
    console.log('Adding player mesh to scene:', {
      meshExists: !!this.mesh,
      meshPosition: this.mesh.position,
      meshVisible: this.mesh.visible,
      meshChildren: this.mesh.children.length
    });
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

    if (!this._visualLogCount) this._visualLogCount = 0;
    this._visualLogCount++;
    if (this._visualLogCount % 600 === 0) {
      console.log('Player visual update:', {
        position: position.y.toFixed(2),
        capsuleBottom: (position.y - 0.8).toFixed(2),
        meshVisible: this.mesh.visible,
        meshScale: this.mesh.scale,
        meshChildCount: this.mesh.children.length
      });
    }

    // Check if grounded
    const wasGrounded = this.isGrounded;
    this.isGrounded = this.checkGrounded();

    if (this.isGrounded) {
      this.timeSinceGrounded = 0;

      // Find which platform we're on and calculate relative position
      this.updatePlatformTracking(platforms);

      if (this.currentPlatform && !this._loggedPlatform) {
        console.log('Standing on platform:', {
          position: this.currentPlatform.position,
          size: this.currentPlatform.size,
          relativePos: this.platformRelativePos
        });
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
    if (this.movement.forward !== 0 || this.movement.right !== 0) {
      const velocity = this.rigidBody.linvel();

      // Calculate movement direction based on camera yaw
      const forwardX = -Math.sin(cameraYaw) * this.movement.forward;
      const forwardZ = -Math.cos(cameraYaw) * this.movement.forward;
      const rightX = Math.cos(cameraYaw) * this.movement.right;
      const rightZ = -Math.sin(cameraYaw) * this.movement.right;

      const moveX = (forwardX + rightX) * this.moveSpeed;
      const moveZ = (forwardZ + rightZ) * this.moveSpeed;

      // Apply forces (preserve Y velocity for gravity)
      this.rigidBody.setLinvel({ x: moveX, y: velocity.y, z: moveZ }, true);
    } else {
      // Dampen horizontal movement when no input
      const velocity = this.rigidBody.linvel();
      this.rigidBody.setLinvel({ x: velocity.x * 0.9, y: velocity.y, z: velocity.z * 0.9 }, true);
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
        if (distance < closestDistance && distance < this.groundCheckDistance * 2) {
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
      this.platformRelativePos.x = (dx / closestPlatform.size.width) + 0.5;
      this.platformRelativePos.z = (dz / closestPlatform.size.depth) + 0.5;

      // Store reference on platform for it to snap us if it changes
      if (closestPlatform.attachedPlayer !== this) {
        closestPlatform.attachedPlayer = this;
      }
    }
  }

  destroy() {
    // Remove rigid body from physics world
    if (this.rigidBody && this.physicsWorld) {
      this.physicsWorld.removeRigidBody(this.rigidBody);
      this.rigidBody = null;
    }

    // Dispose of all loaded models
    Object.values(this.parts).forEach(part => {
      part.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
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
