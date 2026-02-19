import * as THREE from 'three';

/**
 * Manages all audio in the game
 * Handles loading, caching, and playing sounds with 3D positional audio
 */
export class SoundManager {
  constructor(audioListener) {
    this.audioListener = audioListener;
    this.audioLoader = new THREE.AudioLoader();
    this.soundBuffers = new Map(); // Cache loaded sound buffers
    this.activeSounds = []; // Track active positional audio sources
    this.backgroundMusic = null; // Background music instance
  }

  /**
   * Load a sound file and cache it
   * @param {string} name - Name to reference this sound by
   * @param {string} path - Path to the audio file
   * @returns {Promise<AudioBuffer>}
   */
  async loadSound(name, path) {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        (buffer) => {
          this.soundBuffers.set(name, buffer);
          console.log(`Sound loaded: ${name}`);
          resolve(buffer);
        },
        undefined,
        (error) => {
          console.error(`Error loading sound ${name}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Play a sound (non-positional)
   * @param {string} name - Name of the sound to play
   * @param {number} volume - Volume (0-1)
   * @returns {THREE.Audio|null}
   */
  playSound(name, volume = 1.0) {
    const buffer = this.soundBuffers.get(name);
    if (!buffer) {
      console.warn(`Sound not loaded: ${name}`);
      return null;
    }

    // Create non-positional audio
    const sound = new THREE.Audio(this.audioListener);
    sound.setBuffer(buffer);
    sound.setVolume(volume);
    sound.play();

    // Track active sound
    this.activeSounds.push({ sound });

    // Remove from tracking when done
    sound.onEnded = () => {
      const index = this.activeSounds.findIndex(s => s.sound === sound);
      if (index !== -1) {
        this.activeSounds.splice(index, 1);
      }
    };

    return sound;
  }

  /**
   * Play background music (non-positional)
   * @param {string} name - Name of the sound to play as music
   * @param {number} volume - Volume (0-1)
   * @param {boolean} loop - Whether to loop the music
   */
  playBackgroundMusic(name, volume = 0.5, loop = true) {
    const buffer = this.soundBuffers.get(name);
    if (!buffer) {
      console.warn(`Sound not loaded for background music: ${name}`);
      return;
    }

    // Stop existing background music if playing
    this.stopBackgroundMusic();

    // Create non-positional audio
    this.backgroundMusic = new THREE.Audio(this.audioListener);
    this.backgroundMusic.setBuffer(buffer);
    this.backgroundMusic.setLoop(loop);
    this.backgroundMusic.setVolume(volume);
    this.backgroundMusic.play();

    console.log(`Background music started: ${name}`);
  }

  /**
   * Pause background music
   */
  pauseBackgroundMusic() {
    if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
      this.backgroundMusic.pause();
    }
  }

  /**
   * Resume background music
   */
  resumeBackgroundMusic() {
    if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
      this.backgroundMusic.play();
    }
  }

  /**
   * Stop background music
   */
  stopBackgroundMusic() {
    if (this.backgroundMusic) {
      if (this.backgroundMusic.isPlaying) {
        this.backgroundMusic.stop();
      }
      this.backgroundMusic = null;
    }
  }

  /**
   * Get current playback time of background music in seconds
   * @returns {number} Current playback time in seconds, or 0 if no music playing
   */
  getMusicTime() {
    if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
      return this.backgroundMusic.context.currentTime - this.backgroundMusic._startedAt + this.backgroundMusic._progress;
    }
    return 0;
  }

  /**
   * Update method - can be called each frame if needed
   * Currently just for cleanup
   */
  update() {
    // Clean up any finished sounds
    this.activeSounds = this.activeSounds.filter(({ sound }) => sound.isPlaying);
  }

  /**
   * Stop all sounds
   */
  stopAll() {
    this.activeSounds.forEach(({ sound }) => {
      if (sound.isPlaying) {
        sound.stop();
      }
    });
    this.activeSounds = [];
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stopAll();
    this.stopBackgroundMusic();
    this.soundBuffers.clear();
  }
}
