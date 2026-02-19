import * as THREE from 'three';

/**
 * Goal indicator that marks the final platform
 * Visible red beacon that pulses to draw player attention
 */
export default class GoalIndicator {
  constructor(scene, position) {
    this.scene = scene;
    this.time = 0;

    // Create the main indicator pillar/beacon
    const pillarHeight = 8;
    const pillarRadius = 0.5;
    const pillarGeometry = new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 16);

    // Bright red emissive material
    this.pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 2.0,
      roughness: 0.3,
      metalness: 0.5,
      fog: false // Always visible
    });

    this.pillar = new THREE.Mesh(pillarGeometry, this.pillarMaterial);
    this.pillar.position.set(position.x, position.y + pillarHeight / 2, position.z);
    this.pillar.castShadow = false;
    this.pillar.receiveShadow = false;

    // Create a glowing ring at the top
    const ringGeometry = new THREE.TorusGeometry(1.5, 0.2, 16, 32);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      fog: false
    });

    this.ring = new THREE.Mesh(ringGeometry, this.ringMaterial);
    this.ring.position.set(position.x, position.y + pillarHeight, position.z);
    this.ring.rotation.x = Math.PI / 2; // Horizontal ring
    this.ring.castShadow = false;
    this.ring.receiveShadow = false;

    // Add a bright point light for glow
    this.light = new THREE.PointLight(0xff0000, 20, 50);
    this.light.position.set(position.x, position.y + pillarHeight, position.z);

    scene.add(this.pillar);
    scene.add(this.ring);
    scene.add(this.light);

    console.log('Goal indicator created at:', position);
  }

  /**
   * Update indicator animation
   * @param {number} delta - Time delta in seconds
   */
  update(delta) {
    this.time += delta;

    // Pulse the emissive intensity
    const pulse = Math.sin(this.time * 3) * 0.5;
    this.pillarMaterial.emissiveIntensity = 2.0 + pulse;

    // Rotate the ring
    this.ring.rotation.z = this.time;

    // Pulse the light
    this.light.intensity = 20 + Math.sin(this.time * 3) * 8;

    // Bob the ring up and down slightly
    const originalY = this.pillar.position.y + 4; // Half pillar height (8) + ring offset
    this.ring.position.y = originalY + Math.sin(this.time * 2) * 0.3;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.pillar.geometry.dispose();
    this.pillarMaterial.dispose();
    this.ring.geometry.dispose();
    this.ringMaterial.dispose();
    this.scene.remove(this.pillar);
    this.scene.remove(this.ring);
    this.scene.remove(this.light);
  }
}
