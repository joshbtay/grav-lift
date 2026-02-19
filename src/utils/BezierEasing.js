/**
 * Bezier easing utility for smooth interpolation.
 * Implements cubic bezier curves for timing functions.
 */

/**
 * Cubic bezier implementation based on WebKit's UnitBezier
 * @param {number} x1 - First control point X (0-1)
 * @param {number} y1 - First control point Y (can be < 0 or > 1)
 * @param {number} x2 - Second control point X (0-1)
 * @param {number} y2 - Second control point Y (can be < 0 or > 1)
 * @returns {function} Easing function that takes t (0-1) and returns interpolated value
 */
export function cubicBezier(x1, y1, x2, y2) {
  // Validate control points
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    console.warn('Bezier x values must be between 0 and 1');
    x1 = Math.max(0, Math.min(1, x1));
    x2 = Math.max(0, Math.min(1, x2));
  }

  // Pre-calculate coefficients
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  /**
   * Calculate bezier value at time t
   * @param {number} t - Time (0-1)
   * @param {number} a - Coefficient a
   * @param {number} b - Coefficient b
   * @param {number} c - Coefficient c
   * @returns {number} Bezier value
   */
  function calcBezier(t, a, b, c) {
    return ((a * t + b) * t + c) * t;
  }

  /**
   * Calculate derivative at time t
   * @param {number} t - Time (0-1)
   * @param {number} a - Coefficient a
   * @param {number} b - Coefficient b
   * @param {number} c - Coefficient c
   * @returns {number} Derivative value
   */
  function getSlope(t, a, b, c) {
    return 3 * a * t * t + 2 * b * t + c;
  }

  /**
   * Find t for given x using Newton-Raphson method
   * @param {number} x - X value (0-1)
   * @returns {number} Corresponding t value
   */
  function getTForX(x) {
    // Newton-Raphson iteration
    let t = x;
    for (let i = 0; i < 8; i++) {
      const slope = getSlope(t, ax, bx, cx);
      if (slope === 0) break;
      const currentX = calcBezier(t, ax, bx, cx) - x;
      t -= currentX / slope;
    }
    return t;
  }

  // Return easing function
  return function (t) {
    // Handle edge cases
    if (t === 0) return 0;
    if (t === 1) return 1;

    // Find t for x, then calculate y
    const xForT = getTForX(t);
    return calcBezier(xForT, ay, by, cy);
  };
}

/**
 * Predefined easing functions
 */
export const Easings = {
  linear: cubicBezier(0, 0, 1, 1),
  easeIn: cubicBezier(0.42, 0, 1, 1),
  easeOut: cubicBezier(0, 0, 0.58, 1), // Default
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
  easeInQuad: cubicBezier(0.55, 0.085, 0.68, 0.53),
  easeOutQuad: cubicBezier(0.25, 0.46, 0.45, 0.94),
  easeInOutQuad: cubicBezier(0.455, 0.03, 0.515, 0.955),
  easeInCubic: cubicBezier(0.55, 0.055, 0.675, 0.19),
  easeOutCubic: cubicBezier(0.215, 0.61, 0.355, 1),
  easeInOutCubic: cubicBezier(0.645, 0.045, 0.355, 1),
  easeInQuart: cubicBezier(0.895, 0.03, 0.685, 0.22),
  easeOutQuart: cubicBezier(0.165, 0.84, 0.44, 1),
  easeInOutQuart: cubicBezier(0.77, 0, 0.175, 1),
  easeInBack: cubicBezier(0.6, -0.28, 0.735, 0.045),
  easeOutBack: cubicBezier(0.175, 0.885, 0.32, 1.275),
  easeInOutBack: cubicBezier(0.68, -0.55, 0.265, 1.55),
};

/**
 * Get easing function by name or custom bezier array
 * @param {string|Array} easing - Easing name or [x1, y1, x2, y2] array
 * @returns {function} Easing function
 */
export function getEasing(easing) {
  if (!easing) {
    return Easings.easeOutQuart; // Default
  }

  if (typeof easing === 'string') {
    if (Easings[easing]) {
      return Easings[easing];
    }
    console.warn(`Unknown easing "${easing}", using easeOutQuart`);
    return Easings.easeOutQuart;
  }

  if (Array.isArray(easing) && easing.length === 4) {
    return cubicBezier(easing[0], easing[1], easing[2], easing[3]);
  }

  console.warn('Invalid easing format, using easeOutQuart');
  return Easings.easeOutQuart;
}
