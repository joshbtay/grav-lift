import * as THREE from "three";

/**
 * Lava plane entity that creates a deadly visual barrier
 * Features animated glow effect and emissive material
 */
export default class Lava {
	constructor(scene, width = 200, depth = 200, yPosition = -20) {
		this.scene = scene;
		this.yPosition = yPosition;
		this.time = 0;

		// Create lava as a thick horizontal slab (box) instead of plane for better visibility
		const height = 2; // 2 units thick
		const geometry = new THREE.BoxGeometry(width, height, depth, 32, 1, 32);

		// Use MeshStandardMaterial with emissive for glowing effect
		this.material = new THREE.MeshStandardMaterial({
			color: 0xff4500, // Orange-red lava color
			emissive: 0xff3300, // Bright glowing emissive
			emissiveIntensity: 3.0, // Very strong glow
			roughness: 0.3,
			metalness: 0.1,
			side: THREE.DoubleSide,
			fog: false, // Don't let fog hide the lava
		});

		// Create mesh
		this.mesh = new THREE.Mesh(geometry, this.material);
		// No rotation needed for box - it's already oriented correctly
		this.mesh.position.set(0, yPosition, 0);
		this.mesh.receiveShadow = false;
		this.mesh.castShadow = false;

		scene.add(this.mesh);

		// Create grid of point lights for uniform glow coverage
		this.lights = [];
		const gridSize = 8; // 8x8 grid of lights for better coverage
		const spacing = Math.max(width, depth) / gridSize;
		const lightHeight = yPosition + height / 2 + 15; // Higher above lava surface

		for (let x = 0; x < gridSize; x++) {
			for (let z = 0; z < gridSize; z++) {
				const lightX = (x - gridSize / 2 + 0.5) * spacing;
				const lightZ = (z - gridSize / 2 + 0.5) * spacing;

				const light = new THREE.PointLight(0xff4500, 10000, 300); // Much brighter and longer range
				light.position.set(lightX, lightHeight, lightZ);
				scene.add(light);
				this.lights.push(light);
			}
		}

		console.log("Lava mesh added to scene:", {
			position: {
				x: this.mesh.position.x,
				y: this.mesh.position.y,
				z: this.mesh.position.z,
			},
			visible: this.mesh.visible,
			geometry: `${width}x${height}x${depth}`,
			numLights: this.lights.length,
		});
	}

	/**
	 * Update lava animation
	 * @param {number} delta - Time delta in seconds
	 */
	update(delta) {
		this.time += delta;

		// Animate emissive intensity for pulsing glow effect
		const pulse = Math.sin(this.time * 2) * 0.5;
		this.material.emissiveIntensity = 3.0 + pulse;

		// Animate all light intensities with slight variations for organic feel
		this.lights.forEach((light, index) => {
			const offset = index * 0.1; // Slight phase offset for each light
			light.intensity = 50 + Math.sin(this.time * 2 + offset) * 10;
		});
	}

	/**
	 * Check if a position is below the lava surface (deadly)
	 * @param {number} y - Y position to check
	 * @returns {boolean} True if below lava
	 */
	isDeadly(y) {
		return y < this.yPosition + 1; // Give 1 unit buffer above lava surface
	}

	/**
	 * Clean up resources
	 */
	dispose() {
		this.mesh.geometry.dispose();
		this.material.dispose();
		this.scene.remove(this.mesh);

		// Remove all lights
		this.lights.forEach((light) => {
			this.scene.remove(light);
		});
		this.lights = [];
	}
}
