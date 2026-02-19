import { Platform } from './Platform.js';
import { getEasing } from '../utils/BezierEasing.js';

/**
 * A platform with state-based transformations synchronized to BPM.
 * Supports translate, scale, and rotate transformations with bezier easing.
 */
export class MovingPlatform extends Platform {
  constructor(options = {}) {
    super(options);

    // BPM configuration
    this.bpm = options.bpm || 120;
    this.secondsPerBeat = 60 / this.bpm;

    // Color palette (array of hex colors)
    this.colorPalette = options.colorPalette || [];

    // State configuration
    this.states = options.states || {};

    // Start state (merge with defaults for missing axes)
    this.startState = {
      translate: {
        x: this.states.startState?.translate?.x ?? 0,
        y: this.states.startState?.translate?.y ?? 0,
        z: this.states.startState?.translate?.z ?? 0
      },
      scale: {
        x: this.states.startState?.scale?.x ?? 1,
        y: this.states.startState?.scale?.y ?? 1,
        z: this.states.startState?.scale?.z ?? 1
      },
      rotate: {
        x: this.states.startState?.rotate?.x ?? 0,
        y: this.states.startState?.rotate?.y ?? 0,
        z: this.states.startState?.rotate?.z ?? 0
      },
      colorIndex: this.states.startState?.colorIndex ?? null
    };

    // Store initial mesh state
    this.basePosition = { ...this.position };
    this.baseScale = { x: 1, y: 1, z: 1 };
    this.baseRotation = { x: 0, y: 0, z: 0 };

    // Parse transitions
    this.transitions = this.parseTransitions(this.states.transitions || []);

    // State machine
    this.currentTransitionIndex = 0;
    this.transitionProgress = 0;
    this.elapsedTime = 0;

    // Current state (what we're animating from) - deep copy
    this.currentState = {
      translate: { ...this.startState.translate },
      scale: { ...this.startState.scale },
      rotate: { ...this.startState.rotate },
      colorIndex: this.startState.colorIndex
    };

    // Apply initial state
    this.applyState(this.startState);

    // Apply initial color if specified
    if (this.startState.colorIndex !== null && this.colorPalette.length > 0) {
      const color = this.getColorFromPalette(this.startState.colorIndex);
      if (color) {
        this.mesh.material.color.setRGB(color.r, color.g, color.b);
      }
    }
  }

  /**
   * Parse transition definitions into usable format
   */
  parseTransitions(transitionDefs) {
    let currentColorIndex = this.startState.colorIndex;

    return transitionDefs.map(def => {
      const duration = (def.beats || 1) * this.secondsPerBeat;

      // Update color index if specified in this transition
      if (def.transforms?.colorIndex !== undefined) {
        currentColorIndex = def.transforms.colorIndex;
      }

      // Get target state for this transition (relative to start state)
      const targetState = {
        translate: { ...this.startState.translate, ...def.transforms?.translate },
        scale: { ...this.startState.scale, ...def.transforms?.scale },
        rotate: { ...this.startState.rotate, ...def.transforms?.rotate },
        colorIndex: currentColorIndex
      };

      // Get easing functions for each transform type
      const easings = {
        translate: getEasing(def.easing?.translate || def.easing || 'easeOutQuart'),
        scale: getEasing(def.easing?.scale || def.easing || 'easeOutQuart'),
        rotate: getEasing(def.easing?.rotate || def.easing || 'easeOutQuart')
      };

      return {
        duration,
        targetState,
        easings
      };
    });
  }

  /**
   * Apply a state to the mesh
   */
  applyState(state) {
    // Apply translation
    this.mesh.position.x = this.basePosition.x + state.translate.x;
    this.mesh.position.y = this.basePosition.y + state.translate.y;
    this.mesh.position.z = this.basePosition.z + state.translate.z;

    // Apply scale
    this.mesh.scale.x = state.scale.x;
    this.mesh.scale.y = state.scale.y;
    this.mesh.scale.z = state.scale.z;

    // Apply rotation
    this.mesh.rotation.x = state.rotate.x;
    this.mesh.rotation.y = state.rotate.y;
    this.mesh.rotation.z = state.rotate.z;
  }

  /**
   * Interpolate between two states
   */
  interpolateStates(fromState, toState, progress, easings) {
    const result = {
      translate: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      rotate: { x: 0, y: 0, z: 0 }
    };

    // Interpolate translate
    const tEase = easings.translate(progress);
    result.translate.x = fromState.translate.x + (toState.translate.x - fromState.translate.x) * tEase;
    result.translate.y = fromState.translate.y + (toState.translate.y - fromState.translate.y) * tEase;
    result.translate.z = fromState.translate.z + (toState.translate.z - fromState.translate.z) * tEase;

    // Interpolate scale
    const sEase = easings.scale(progress);
    result.scale.x = fromState.scale.x + (toState.scale.x - fromState.scale.x) * sEase;
    result.scale.y = fromState.scale.y + (toState.scale.y - fromState.scale.y) * sEase;
    result.scale.z = fromState.scale.z + (toState.scale.z - fromState.scale.z) * sEase;

    // Interpolate rotation
    const rEase = easings.rotate(progress);
    result.rotate.x = fromState.rotate.x + (toState.rotate.x - fromState.rotate.x) * rEase;
    result.rotate.y = fromState.rotate.y + (toState.rotate.y - fromState.rotate.y) * rEase;
    result.rotate.z = fromState.rotate.z + (toState.rotate.z - fromState.rotate.z) * rEase;

    return result;
  }

  /**
   * Get RGB color from palette index
   */
  getColorFromPalette(index) {
    if (index === null || index < 0 || index >= this.colorPalette.length) {
      return null;
    }

    const hexColor = this.colorPalette[index];
    return {
      r: ((hexColor >> 16) & 255) / 255,
      g: ((hexColor >> 8) & 255) / 255,
      b: (hexColor & 255) / 255
    };
  }

  /**
   * Update platform transformations based on state machine
   */
  update(delta) {
    // No transitions = static platform
    if (this.transitions.length === 0) {
      return;
    }

    this.elapsedTime += delta;

    const currentTransition = this.transitions[this.currentTransitionIndex];
    this.transitionProgress += delta / currentTransition.duration;

    // Check if transition is complete
    if (this.transitionProgress >= 1) {
      this.transitionProgress = 0;
      this.currentTransitionIndex++;

      // Loop back to start after all transitions
      if (this.currentTransitionIndex >= this.transitions.length) {
        this.currentTransitionIndex = 0;
        this.currentState = {
          translate: { ...this.startState.translate },
          scale: { ...this.startState.scale },
          rotate: { ...this.startState.rotate },
          colorIndex: this.startState.colorIndex
        };
      } else {
        // Move to next transition - current target becomes new start
        this.currentState = {
          translate: { ...currentTransition.targetState.translate },
          scale: { ...currentTransition.targetState.scale },
          rotate: { ...currentTransition.targetState.rotate },
          colorIndex: currentTransition.targetState.colorIndex
        };
      }

      // Apply color instantly at the start of new transition
      const nextTransition = this.transitions[this.currentTransitionIndex];
      if (nextTransition.targetState.colorIndex !== null && this.colorPalette.length > 0) {
        const color = this.getColorFromPalette(nextTransition.targetState.colorIndex);
        if (color) {
          this.mesh.material.color.setRGB(color.r, color.g, color.b);
        }
      }
    }

    // Interpolate and apply current state
    const nextTransition = this.transitions[this.currentTransitionIndex];
    const interpolatedState = this.interpolateStates(
      this.currentState,
      nextTransition.targetState,
      this.transitionProgress,
      nextTransition.easings
    );

    this.applyState(interpolatedState);
  }

  /**
   * Get current beat in the animation cycle (for debugging)
   */
  getCurrentBeat() {
    return this.elapsedTime / this.secondsPerBeat;
  }
}
