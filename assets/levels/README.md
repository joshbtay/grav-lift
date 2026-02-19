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
      "movement": {
        "axis": "y",
        "distance": 3,
        "speed": 1.5,
        "startDelay": 0
      }
    }
  ]
}
```

## Field Descriptions

### Root Level Properties

- **name** (string): Display name for the level (currently not used in-game)
- **background** (object): Background and fog configuration
- **playerSpawn** (object): Starting position for the player
- **platforms** (array): List of all platforms in the level

### Background Configuration

- **color** (string): Hex color code with "0x" prefix (e.g., "0x87ceeb" for sky blue)
- **fog** (object, optional): Fog settings for atmospheric depth
  - **color** (string): Fog color as hex
  - **near** (number): Distance where fog starts (in units)
  - **far** (number): Distance where fog is fully opaque (in units)

### Player Spawn

- **x**, **y**, **z** (numbers): 3D coordinates for player starting position

### Platform Configuration

Each platform in the `platforms` array can have:

#### Common Properties (all platforms)

- **type** (string): Either "static" or "moving"
- **position** (object): Starting position
  - **x**, **y**, **z** (numbers): 3D coordinates
- **size** (object): Platform dimensions
  - **width** (number): X-axis size
  - **height** (number): Y-axis size (typically 1 for floors)
  - **depth** (number): Z-axis size
- **color** (string): Hex color code with "0x" prefix

#### Moving Platform Properties

Only required when `type` is "moving":

- **movement** (object): Movement configuration
  - **axis** (string): Axis to move along - "x", "y", or "z"
  - **distance** (number): How far to move from starting position (in both directions)
  - **speed** (number): Movement speed in units per second
  - **startDelay** (number): Delay in seconds before movement begins (useful for staggered timing)

## Movement Patterns

Moving platforms oscillate back and forth along the specified axis:
- Start at their defined position
- Move in positive direction for `distance` units
- Reverse and move in negative direction for `distance` units
- Continue oscillating

## Color Guidelines

Use hex colors with the "0x" prefix. Some suggested colors:

- **0x808080** - Gray (default)
- **0xff6b6b** - Red
- **0x6bcf7f** - Green
- **0x4ecdc4** - Cyan
- **0xffe66d** - Yellow
- **0xa8dadc** - Light blue
- **0x87ceeb** - Sky blue

## Tips

1. **Platform Spacing**: Leave enough space between platforms for the player to jump
2. **Moving Platforms**: Use `startDelay` to create patterns and avoid all platforms moving in sync
3. **Color Coding**: Use different colors to indicate different platform behaviors or difficulty
4. **Testing**: Start with static platforms, then add moving elements gradually

## Creating a New Level

1. Create a new JSON file in this directory (e.g., `level3.json`)
2. Copy the structure from an existing level as a template
3. Modify platforms, colors, and movement patterns
4. Create a corresponding Level class in `src/levels/`:

```javascript
import { DataDrivenLevel } from './DataDrivenLevel.js';

export class Level3 extends DataDrivenLevel {
  constructor(game) {
    super(game, 3);
  }
}
```

5. Register the level in `src/levels/LevelRegistry.js`
