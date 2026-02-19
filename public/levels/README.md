# Level Data Format

This directory contains JSON configuration files for each level in the game.

**Note:** Level JSON files must be copied to the `public/levels/` directory to be accessible by the game. Files in the public directory are served by Vite from the root path.

## File Naming Convention

Each level should have a corresponding JSON file named `level{number}.json`, where `{number}` is the level number.

Examples:
- `level1.json` - Level 1 configuration
- `level2.json` - Level 2 configuration
- etc.

## JSON Structure

```json
{
  "name": "Level Name",
  "bpm": 90,
  "background": {
    "color": "0xHEXCOLOR",
    "fog": {
      "color": "0xHEXCOLOR",
      "near": 50,
      "far": 200
    }
  },
  "playerSpawn": {
    "x": 0,
    "y": 1,
    "z": 0
  },
  "platforms": [
    {
      "type": "static",
      "position": { "x": 0, "y": -2, "z": 0 },
      "size": { "width": 20, "height": 1, "depth": 20 },
      "color": "0x808080"
    },
    {
      "type": "moving",
      "position": { "x": 10, "y": 0, "z": -15 },
      "size": { "width": 5, "height": 1, "depth": 5 },
      "color": "0xff6b6b",
      "states": {
        "startState": {
          "translate": { "x": 0, "y": 0, "z": 0 },
          "scale": { "x": 1, "y": 1, "z": 1 },
          "rotate": { "x": 0, "y": 0, "z": 0 }
        },
        "transitions": [
          {
            "beats": 2,
            "easing": "easeOut",
            "transforms": {
              "translate": { "y": 3 }
            }
          },
          {
            "beats": 2,
            "easing": "easeIn",
            "transforms": {
              "translate": { "y": 0 }
            }
          }
        ]
      }
    }
  ]
}
```

## Root Level Properties

- **name** (string): Display name for the level
- **bpm** (number): Beats per minute - controls the tempo of all moving platforms (default: 120)
- **background** (object): Background and fog configuration
- **playerSpawn** (object): Starting position for the player
- **platforms** (array): List of all platforms in the level

## Background Configuration

- **color** (string): Hex color code with "0x" prefix (e.g., "0x87ceeb" for sky blue)
- **fog** (object, optional): Fog settings for atmospheric depth
  - **color** (string): Fog color as hex
  - **near** (number): Distance where fog starts (in units)
  - **far** (number): Distance where fog is fully opaque (in units)

## Player Spawn

- **x**, **y**, **z** (numbers): 3D coordinates for player starting position

## Platform Types

### Static Platforms

Static platforms don't move or transform.

```json
{
  "type": "static",
  "position": { "x": 0, "y": -2, "z": 0 },
  "size": { "width": 20, "height": 1, "depth": 20 },
  "color": "0x808080"
}
```

### Moving Platforms

Moving platforms use a state-based transformation system synchronized to BPM.

## State-Based Transformation System

Moving platforms are defined by:
1. **Start State** - Initial transformations (position, scale, rotation)
2. **Transitions** - A list of state changes over time

After all transitions complete, the platform returns to the start state, creating a loop.

### Start State

The `startState` defines the initial transformation values:

```json
"startState": {
  "translate": { "x": 0, "y": 0, "z": 0 },
  "scale": { "x": 1, "y": 1, "z": 1 },
  "rotate": { "x": 0, "y": 0, "z": 0 }
}
```

- **translate**: Offset from platform's base position (in units)
- **scale**: Size multiplier (1 = normal size, 2 = double size, 0.5 = half size)
- **rotate**: Rotation angles (in radians, π ≈ 3.14159)

**Note:** You only need to specify the values you want to change. Omitted values default to:
- translate: `{ x: 0, y: 0, z: 0 }`
- scale: `{ x: 1, y: 1, z: 1 }`
- rotate: `{ x: 0, y: 0, z: 0 }`

### Transitions

Each transition defines:
- **beats**: Duration in beats (can be any positive number)
- **easing**: Interpolation curve (see Easing section)
- **transforms**: Target values for translate/scale/rotate

```json
{
  "beats": 2,
  "easing": "easeOut",
  "transforms": {
    "translate": { "y": 3 },
    "scale": { "x": 1.2 },
    "rotate": { "y": 1.57 }
  }
}
```

**Transform Rules:**
- Only specify transforms you want to change
- Transforms interpolate from current state to target state
- After transition completes, the target becomes the new current state
- Unspecified axes retain their current value

## Easing Curves

Easing controls how values interpolate between states. The system uses cubic bezier curves for smooth, natural motion.

### Predefined Easings

- **linear**: Constant speed (no easing)
- **easeIn**: Slow start, fast end
- **easeOut**: Fast start, slow end (default)
- **easeInOut**: Slow start and end, fast middle

**Extended Easings:**
- **easeInQuad** / **easeOutQuad** / **easeInOutQuad**: Quadratic curves
- **easeInCubic** / **easeOutCubic** / **easeInOutCubic**: Cubic curves
- **easeInQuart** / **easeOutQuart** / **easeInOutQuart**: Quartic curves
- **easeInBack** / **easeOutBack** / **easeInOutBack**: Overshoot curves

### Custom Bezier Curves

Define custom curves using cubic bezier control points:

```json
"easing": [0.42, 0, 0.58, 1]
```

Format: `[x1, y1, x2, y2]` where:
- `x1, x2` must be between 0-1
- `y1, y2` can be < 0 or > 1 (for overshoot effects)

### Per-Transform Easing

Apply different easings to different transform types:

```json
{
  "beats": 2,
  "easing": {
    "translate": "easeOut",
    "scale": "easeInOut",
    "rotate": "easeInBack"
  },
  "transforms": {
    "translate": { "y": 3 },
    "scale": { "x": 1.2 },
    "rotate": { "y": 1.57 }
  }
}
```

## Example Patterns

### Simple Vertical Oscillator

Platform moves up 3 units and back down:

```json
{
  "type": "moving",
  "position": { "x": 0, "y": 0, "z": 0 },
  "size": { "width": 5, "height": 1, "depth": 5 },
  "color": "0xff6b6b",
  "states": {
    "startState": {
      "translate": { "y": 0 }
    },
    "transitions": [
      {
        "beats": 2,
        "easing": "easeOut",
        "transforms": { "translate": { "y": 3 } }
      },
      {
        "beats": 2,
        "easing": "easeIn",
        "transforms": { "translate": { "y": 0 } }
      }
    ]
  }
}
```

### Horizontal Slider with Scale Pulse

Platform slides left/right while growing and shrinking:

```json
{
  "states": {
    "transitions": [
      {
        "beats": 2,
        "easing": "easeOut",
        "transforms": {
          "translate": { "x": 5 },
          "scale": { "x": 1.3, "z": 1.3 }
        }
      },
      {
        "beats": 2,
        "easing": "easeIn",
        "transforms": {
          "translate": { "x": 0 },
          "scale": { "x": 1, "z": 1 }
        }
      }
    ]
  }
}
```

### Rotating Platform

Platform rotates 90 degrees (π/2 radians) back and forth:

```json
{
  "states": {
    "transitions": [
      {
        "beats": 4,
        "easing": "easeInOut",
        "transforms": { "rotate": { "y": 1.5708 } }
      },
      {
        "beats": 4,
        "easing": "easeInOut",
        "transforms": { "rotate": { "y": 0 } }
      }
    ]
  }
}
```

### Multi-State Sequence

Platform performs a complex sequence before looping:

```json
{
  "states": {
    "transitions": [
      {
        "beats": 2,
        "transforms": { "translate": { "y": 3 } }
      },
      {
        "beats": 1,
        "transforms": { "scale": { "x": 1.5, "z": 1.5 } }
      },
      {
        "beats": 2,
        "transforms": { "translate": { "x": 5 } }
      },
      {
        "beats": 1,
        "transforms": { "scale": { "x": 1, "z": 1 } }
      },
      {
        "beats": 2,
        "transforms": { "translate": { "y": 0 } }
      },
      {
        "beats": 2,
        "transforms": { "translate": { "x": 0 } }
      }
    ]
  }
}
```

## Tips and Best Practices

### BPM Selection

Choose BPM based on desired gameplay feel:
- **60-80 BPM**: Slow, puzzle-focused
- **90-120 BPM**: Moderate, standard gameplay (Level 1 uses 90)
- **130-160 BPM**: Fast, action-oriented

### Transition Timing

- Use **even beat counts** (2, 4, 8) for symmetrical patterns
- Use **odd beat counts** (1, 3, 5) for syncopated rhythms
- Longer transitions (4-8 beats) give players more time to react
- Shorter transitions (1-2 beats) create urgency

### Transform Combinations

- **Translate only**: Simple, clear movement - best for jumping challenges
- **Translate + Scale**: Creates "breathing" platforms
- **Translate + Rotate**: Complex spatial puzzles
- **All three**: Advanced challenges, use sparingly

### Rotation Values

Common angles in radians:
- 45° = 0.785 radians
- 90° = 1.571 radians (π/2)
- 180° = 3.142 radians (π)
- 360° = 6.283 radians (2π)

### Easing Guidelines

- **easeOut**: Natural deceleration, good for "landing" movements
- **easeIn**: Building momentum, good for "launching" movements
- **easeInOut**: Smooth, organic motion - safest default
- **easeInBack / easeOutBack**: Use for bouncy, playful platforms

### Color Coding

Use colors to indicate platform behavior:
- **Red/Orange**: Fast or dangerous platforms
- **Green/Blue**: Moderate, safe platforms
- **Yellow**: Attention platforms (complex behavior)
- **Purple/Pink**: Special mechanics

## Workflow

1. Set level **bpm** (typically 90-120)
2. Place static platforms for base structure
3. Add moving platforms one at a time
4. For each moving platform:
   - Define **startState** (where it begins)
   - Add **transitions** (how it moves)
   - Test in-game and adjust timing/easing
5. Use consistent beat divisions across related platforms
6. Test the full level flow

## Creating a New Level

1. Create `public/levels/level{N}.json`
2. Set BPM and basic structure
3. Design platform layout and behaviors
4. Create corresponding class in `src/levels/`:

```javascript
import { DataDrivenLevel } from './DataDrivenLevel.js';

export class Level3 extends DataDrivenLevel {
  constructor(game) {
    super(game, 3);
  }
}
```

5. Register in `src/levels/LevelRegistry.js`
