const React = window.React;
const { useState, useRef, useEffect } = React;

const CANVAS_WIDTH = 21;
const CANVAS_HEIGHT = 33;
const TILE_SIZE = 16;

// Terrain types and their gameplay properties:
// WALL (🧱): Blocks movement AND shooting - solid cover
// WATER (🌊): Blocks movement but NOT shooting - can shoot through
// GRASS (🥬): Blocks neither - players can hide/walk/shoot through
// OTG (⛔): Out of the game - blocks everything, not playable area
// EMPTY: Open space - no restrictions

const TERRAIN_TYPES = {
  WALL: '#A0522D',
  WATER: '#5DADE2',
  GRASS: '#2ECC71',
  OTG: '#1a1a1a',
  EMPTY: null
};

const MapGenerator = () => {
  const [tiles, setTiles] = useState(() => 
    Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null))
  );
  const [selectedTool, setSelectedTool] = useState(TERRAIN_TYPES.WALL);
  const [isDrawing, setIsDrawing] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [wallDensity, setWallDensity] = useState(10);
  const [waterDensity, setWaterDensity] = useState(5);
  const [grassDensity, setGrassDensity] = useState(10);
  const [mirrorVertical, setMirrorVertical] = useState(false);
  const [mirrorHorizontal, setMirrorHorizontal] = useState(false);
  const [mirrorDiagonal, setMirrorDiagonal] = useState(false);
  const [slidersOpen, setSlidersOpen] = useState(false);
  const canvasRef = useRef(null);

  const handleTileClick = (row, col) => {
    const newTiles = [...tiles.map(r => [...r])];
    newTiles[row][col] = selectedTool;
    
    const centerRow = Math.floor(CANVAS_HEIGHT / 2);
    const centerCol = Math.floor(CANVAS_WIDTH / 2);
    
    if (mirrorVertical) {
      const mirrorCol = CANVAS_WIDTH - 1 - col;
      newTiles[row][mirrorCol] = selectedTool;
    }
    if (mirrorHorizontal) {
      const mirrorRow = CANVAS_HEIGHT - 1 - row;
      newTiles[mirrorRow][col] = selectedTool;
    }
    if (mirrorDiagonal) {
      const offsetRow = row - centerRow;
      const offsetCol = col - centerCol;
      const mirrorRow = centerRow - offsetRow;
      const mirrorCol = centerCol - offsetCol;
      if (mirrorRow >= 0 && mirrorRow < CANVAS_HEIGHT && mirrorCol >= 0 && mirrorCol < CANVAS_WIDTH) {
        newTiles[mirrorRow][mirrorCol] = selectedTool;
      }
    }
    if (mirrorVertical && mirrorHorizontal) {
      const mirrorRow = CANVAS_HEIGHT - 1 - row;
      const mirrorCol = CANVAS_WIDTH - 1 - col;
      newTiles[mirrorRow][mirrorCol] = selectedTool;
    }
    
    setTiles(newTiles);
  };

  const handleMouseDown = (row, col) => {
    setIsDrawing(true);
    handleTileClick(row, col);
  };

  const handleMouseEnter = (row, col) => {
    if (isDrawing) {
      handleTileClick(row, col);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const generateRandomMap = () => {
    console.log('=== STARTING TEMPLATE-BASED MAP GENERATION ===');

    /*
    Map anatomy (21 cols × 33 rows):
    - Mid strip (rows 11-21): Primary combat zone
    - Backside strips (rows 0-10 and 22-32): Retreat/respawn zones
    - Balance: Both zones should have similar cover density (35-45%)

    Tactical shooter map principles (from reference game analysis):
    - Maps use DISCRETE STRUCTURES, not organic blobs
    - Small structures dominate: 1×1, 1×2, 1×3, 2×2 walls are very common
    - L-shaped walls and clusters create tactical complexity
    - Large structures are RARE and moderate-sized
    - Bushes are typically 2 tiles wide (can be 1-tile wide only when attached to walls)
    - Water is minimal: 1-2 features per map maximum
    - Structure variety comes from: size range (small to big) AND density range (open areas vs tight chokepoints)
    - Some areas should be open (4+ tile gaps), some should be tight (2-3 tile chokepoints with packed walls)
    - NO OTGs allowed anywhere - gaps must be 0 tiles (touching) or 2+ tiles (tactical spacing)
    */

    let placedTiles = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null));
    const placedStructures = [];
    const totalTiles = CANVAS_WIDTH * CANVAS_HEIGHT;

    // Map zone helpers
    const MID_STRIP_START = 11;
    const MID_STRIP_END = 21;
    const isInMidStrip = (row) => row >= MID_STRIP_START && row <= MID_STRIP_END;
    const isValid = (row, col) => row >= 0 && row < CANVAS_HEIGHT && col >= 0 && col < CANVAS_WIDTH;

    // ===== PHASE 1: DEFINE STRUCTURE TEMPLATES =====
    console.log('\n--- PHASE 1: Structure Templates ---');

    const WALL_TEMPLATES = {
      // Small (20% probability total) - Reduced from 50%
      single: { pattern: [[1]], weight: 2 },
      bar_v2: { pattern: [[1],[1]], weight: 2 },
      bar_h2: { pattern: [[1,1]], weight: 2 },
      bar_v3: { pattern: [[1],[1],[1]], weight: 2 },
      bar_h3: { pattern: [[1,1,1]], weight: 2 },
      block_2x2: { pattern: [[1,1],[1,1]], weight: 3 },
      L_small1: { pattern: [[1,1],[1,0]], weight: 2 },
      L_small2: { pattern: [[1,1],[0,1]], weight: 2 },
      L_small3: { pattern: [[1,0],[1,1]], weight: 2 },
      L_small4: { pattern: [[0,1],[1,1]], weight: 2 },

      // Medium (50% probability total) - Increased from 30%
      // 2x3 and 3x3 blocks
      block_2x3: { pattern: [[1,1],[1,1],[1,1]], weight: 5 },
      block_3x2: { pattern: [[1,1,1],[1,1,1]], weight: 5 },
      block_3x3: { pattern: [[1,1,1],[1,1,1],[1,1,1]], weight: 4 },

      // L-shapes (30% of medium = 15% of total)
      L_med1: { pattern: [[1,1,1],[1,0,0]], weight: 4 },
      L_med2: { pattern: [[1,1,1],[0,0,1]], weight: 4 },
      L_med3: { pattern: [[1,0,0],[1,1,1]], weight: 4 },
      L_med4: { pattern: [[0,0,1],[1,1,1]], weight: 4 },
      L_med5: { pattern: [[1,1,0],[1,0,0],[1,0,0]], weight: 3 },
      L_med6: { pattern: [[0,1,1],[0,0,1],[0,0,1]], weight: 3 },

      // T-shapes
      T_med1: { pattern: [[1,1,1],[0,1,0]], weight: 3 },
      T_med2: { pattern: [[1,0],[1,1],[1,0]], weight: 3 },
      T_med3: { pattern: [[0,1,0],[1,1,1]], weight: 3 },
      T_med4: { pattern: [[0,1],[1,1],[0,1]], weight: 3 },

      // Diagonal and S-shapes
      diag1: { pattern: [[1,0],[1,1],[0,1]], weight: 3 },
      diag2: { pattern: [[0,1],[1,1],[1,0]], weight: 3 },
      S_shape1: { pattern: [[1,1,0],[0,1,1]], weight: 3 },
      S_shape2: { pattern: [[0,1,1],[1,1,0]], weight: 3 },

      // Zig-zag walls
      zigzag1: { pattern: [[1,0,0],[1,1,0],[0,1,1]], weight: 2 },
      zigzag2: { pattern: [[0,0,1],[0,1,1],[1,1,0]], weight: 2 },

      // Plus-shapes
      plus_med: { pattern: [[0,1,0],[1,1,1],[0,1,0]], weight: 3 },

      // U-shapes
      U_med1: { pattern: [[1,0,1],[1,1,1]], weight: 3 },
      U_med2: { pattern: [[1,1],[1,0],[1,1]], weight: 3 },

      // Large (30% probability total) - Increased from 20%
      bar_v4: { pattern: [[1],[1],[1],[1]], weight: 3 },
      bar_h4: { pattern: [[1,1,1,1]], weight: 3 },
      bar_v5: { pattern: [[1],[1],[1],[1],[1]], weight: 3 },
      bar_h5: { pattern: [[1,1,1,1,1]], weight: 3 },
      bar_v6: { pattern: [[1],[1],[1],[1],[1],[1]], weight: 2 },
      bar_h6: { pattern: [[1,1,1,1,1,1]], weight: 2 },
      block_2x4: { pattern: [[1,1],[1,1],[1,1],[1,1]], weight: 3 },
      block_3x4: { pattern: [[1,1,1],[1,1,1],[1,1,1],[1,1,1]], weight: 2 },

      // Large L-shapes
      L_big1: { pattern: [[1,1,1,1],[1,0,0,0]], weight: 2 },
      L_big2: { pattern: [[1,1,1,1],[0,0,0,1]], weight: 2 },
      L_big3: { pattern: [[1,0,0],[1,0,0],[1,1,1]], weight: 2 },
      L_big4: { pattern: [[0,0,1],[0,0,1],[1,1,1]], weight: 2 },

      // Large complex shapes
      box_hollow: { pattern: [[1,1,1],[1,0,1],[1,1,1]], weight: 2 },
      C_shape1: { pattern: [[1,1,1],[1,0,0],[1,1,1]], weight: 2 },
      C_shape2: { pattern: [[1,1,1],[0,0,1],[1,1,1]], weight: 2 },
      T_large: { pattern: [[1,1,1,1,1],[0,0,1,0,0]], weight: 2 }
    };

    const BUSH_TEMPLATES = {
      // All bushes must be 2+ tiles wide, minimum 2x3 (6 tiles)
      // Reduced 2x2 probability from weight 1 to 0.3 (10%)
      square_2x2: { pattern: [[1,1],[1,1]], weight: 0.3 },

      // Preferred sizes: 2x3, 2x4, 3x3 with higher weights
      rect_2x3: { pattern: [[1,1],[1,1],[1,1]], weight: 2 },
      rect_3x2: { pattern: [[1,1,1],[1,1,1]], weight: 2 },
      rect_2x4: { pattern: [[1,1],[1,1],[1,1],[1,1]], weight: 2 },
      rect_4x2: { pattern: [[1,1,1,1],[1,1,1,1]], weight: 2 },
      rect_3x3: { pattern: [[1,1,1],[1,1,1],[1,1,1]], weight: 1.5 },

      // L-shapes with 8-12 tiles
      L_wide1: { pattern: [[1,1,0],[1,1,0],[1,1,1]], weight: 1.5 },
      L_wide2: { pattern: [[0,1,1],[0,1,1],[1,1,1]], weight: 1.5 },
      L_wide3: { pattern: [[1,1,1],[1,1,0],[1,1,0]], weight: 1.5 },
      L_wide4: { pattern: [[1,1,1],[0,1,1],[0,1,1]], weight: 1.5 },

      // Larger bush clusters
      T_bush: { pattern: [[0,1,1,0],[1,1,1,1],[0,1,1,0]], weight: 1 },
      rect_2x5: { pattern: [[1,1],[1,1],[1,1],[1,1],[1,1]], weight: 1 },
      rect_3x4: { pattern: [[1,1,1],[1,1,1],[1,1,1],[1,1,1]], weight: 1 }
    };

    const WATER_TEMPLATES = {
      // Strategic water features - minimum 8+ tiles, for mid strip placement
      pool_2x4: { pattern: [[1,1],[1,1],[1,1],[1,1]], weight: 1 },
      pool_3x3: { pattern: [[1,1,1],[1,1,1],[1,1,1]], weight: 1 },
      pool_4x2: { pattern: [[1,1,1,1],[1,1,1,1]], weight: 1 },
      river_2x5: { pattern: [[1,1],[1,1],[1,1],[1,1],[1,1]], weight: 1 },
      river_3x4: { pattern: [[1,1,1],[1,1,1],[1,1,1],[1,1,1]], weight: 0.8 },
      L_water: { pattern: [[1,1,1],[1,1,0],[1,1,0]], weight: 0.5 }
    };

    console.log(`  Wall templates: ${Object.keys(WALL_TEMPLATES).length}`);
    console.log(`  Bush templates: ${Object.keys(BUSH_TEMPLATES).length}`);
    console.log(`  Water templates: ${Object.keys(WATER_TEMPLATES).length}`);

    // ===== PHASE 2: CALCULATE PLACEMENT TARGETS =====
    console.log('\n--- PHASE 2: Placement Targets ---');

    const targetWalls = Math.floor((wallDensity / 100) * totalTiles);
    const targetBushes = Math.floor((grassDensity / 100) * totalTiles);
    const targetWater = Math.min(Math.floor((waterDensity / 100) * totalTiles), totalTiles * 0.1); // Cap at 10%

    console.log(`  Target walls: ${targetWalls} tiles (${wallDensity}%)`);
    console.log(`  Target bushes: ${targetBushes} tiles (${grassDensity}%)`);
    console.log(`  Target water: ${targetWater} tiles (${waterDensity}%)`);

    // ===== PHASE 3: STRATEGIC AREA PLANNING =====
    console.log('\n--- PHASE 3: Zone Planning ---');

    const zones = [];

    // Create OPEN zones (30% of map area)
    for (let i = 0; i < 3; i++) {
      const width = 5 + Math.floor(Math.random() * 4); // 5-8
      const height = 7 + Math.floor(Math.random() * 4); // 7-10
      const startRow = Math.floor(Math.random() * (CANVAS_HEIGHT - height));
      const startCol = Math.floor(Math.random() * (CANVAS_WIDTH - width));

      zones.push({
        type: 'OPEN',
        startRow, endRow: startRow + height - 1,
        startCol, endCol: startCol + width - 1,
        targetCoverage: 0.15 + Math.random() * 0.1, // 15-25%
        minGap: 4
      });
    }

    // Create TIGHT zones (20% of map area)
    for (let i = 0; i < 2; i++) {
      const width = 4 + Math.floor(Math.random() * 3); // 4-6
      const height = 5 + Math.floor(Math.random() * 4); // 5-8
      const startRow = Math.floor(Math.random() * (CANVAS_HEIGHT - height));
      const startCol = Math.floor(Math.random() * (CANVAS_WIDTH - width));

      zones.push({
        type: 'TIGHT',
        startRow, endRow: startRow + height - 1,
        startCol, endCol: startCol + width - 1,
        targetCoverage: 0.55 + Math.random() * 0.15, // 55-70%
        minGap: 2
      });
    }

    // Rest of map is NORMAL zone (implicit)
    const normalZone = {
      type: 'NORMAL',
      targetCoverage: 0.35 + Math.random() * 0.1, // 35-45%
      minGap: 2
    };

    console.log(`  Open zones: ${zones.filter(z => z.type === 'OPEN').length}`);
    console.log(`  Tight zones: ${zones.filter(z => z.type === 'TIGHT').length}`);
    console.log(`  Normal zone: rest of map`);

    // Helper to determine which zone a position is in
    const getZone = (row, col) => {
      for (const zone of zones) {
        if (row >= zone.startRow && row <= zone.endRow &&
            col >= zone.startCol && col <= zone.endCol) {
          return zone;
        }
      }
      return normalZone;
    };

    // Helper to calculate zone coverage
    const calculateZoneCoverage = (zone, tiles) => {
      if (zone.type === 'NORMAL') {
        // For normal zone, calculate coverage of all tiles NOT in other zones
        let filled = 0, total = 0;
        for (let row = 0; row < CANVAS_HEIGHT; row++) {
          for (let col = 0; col < CANVAS_WIDTH; col++) {
            const tileZone = getZone(row, col);
            if (tileZone.type === 'NORMAL') {
              total++;
              if (tiles[row][col] !== null) filled++;
            }
          }
        }
        return total > 0 ? filled / total : 0;
      } else {
        // For specific zones, calculate coverage within bounds
        let filled = 0, total = 0;
        for (let row = zone.startRow; row <= zone.endRow; row++) {
          for (let col = zone.startCol; col <= zone.endCol; col++) {
            total++;
            if (tiles[row][col] !== null) filled++;
          }
        }
        return total > 0 ? filled / total : 0;
      }
    };

    // ===== PHASE 3.5: PATTERN PLACEMENT MODES =====
    console.log('\n--- PHASE 3.5: Pattern Placement ---');

    // 30% of the time, use pattern placement instead of pure random
    const usePatternPlacement = Math.random() < 0.30;

    if (usePatternPlacement) {
      console.log('  Using PATTERN placement mode');

      // Helper: Try to place a wall template at a position
      const tryPlaceWallPattern = (template, row, col) => {
        // Check if placement is valid
        const zone = getZone(row, col);
        const mirrorPositions = calculateMirrorPositions(template, row, col);

        let allValid = true;
        for (const pos of mirrorPositions) {
          const posZone = getZone(pos.row, pos.col);
          if (!checkPlacementValid(template, pos.row, pos.col, placedTiles, posZone, TERRAIN_TYPES.WALL)) {
            allValid = false;
            break;
          }
        }

        if (allValid) {
          placeTemplate(template, row, col, TERRAIN_TYPES.WALL, placedTiles);
          return true;
        }
        return false;
      };

      // Pattern 1: CORRIDOR (3-5 walls in a line with 3-tile gaps)
      if (Math.random() < 0.5) {
        console.log('  Creating CORRIDOR pattern');
        const isVertical = Math.random() < 0.5;
        const wallCount = 3 + Math.floor(Math.random() * 3); // 3-5 walls
        const template = [[1,1],[1,1],[1,1]]; // 2x3 vertical wall

        if (isVertical) {
          // Vertical corridor in mid strip
          const startRow = MID_STRIP_START;
          const col = 5 + Math.floor(Math.random() * 11); // Random column in middle area

          for (let i = 0; i < wallCount; i++) {
            const row = startRow + i * 4; // 3-tile gap + 1-tile wall
            if (row + template.length <= MID_STRIP_END) {
              tryPlaceWallPattern(template, row, col);
            }
          }
        } else {
          // Horizontal corridor
          const row = MID_STRIP_START + Math.floor(Math.random() * 7);
          const startCol = 2;

          for (let i = 0; i < wallCount; i++) {
            const col = startCol + i * 4; // 3-tile gap + 1-tile wall
            if (col + 2 < CANVAS_WIDTH) {
              tryPlaceWallPattern([[1,1],[1,1]], row, col);
            }
          }
        }
      }

      // Pattern 2: FORTIFICATION (4-6 structures in 5x7 cluster)
      if (Math.random() < 0.5) {
        console.log('  Creating FORTIFICATION pattern');
        const structureCount = 4 + Math.floor(Math.random() * 3); // 4-6 structures

        // Place in backside zone for defensive positioning
        const fortRow = Math.random() < 0.5 ? 2 : 24; // Top or bottom backside
        const fortCol = 5 + Math.floor(Math.random() * 7); // Center area

        const templates = [
          [[1,1],[1,1],[1,1]], // 2x3
          [[1,1,1],[1,1,1]], // 3x2
          [[1,1,1],[1,0,0]], // L-shape
          [[0,1,1],[1,1,0]]  // S-shape
        ];

        for (let i = 0; i < structureCount; i++) {
          const template = templates[Math.floor(Math.random() * templates.length)];
          const offsetRow = fortRow + Math.floor(Math.random() * 5);
          const offsetCol = fortCol + Math.floor(Math.random() * 5);

          if (offsetRow >= 0 && offsetRow + template.length < CANVAS_HEIGHT &&
              offsetCol >= 0 && offsetCol + template[0].length < CANVAS_WIDTH) {
            tryPlaceWallPattern(template, offsetRow, offsetCol);
          }
        }
      }

      // Pattern 3: CHOKEPOINT (2 large walls with 2-3 tile gap)
      if (Math.random() < 0.5) {
        console.log('  Creating CHOKEPOINT pattern');
        const gapSize = 2 + Math.floor(Math.random() * 2); // 2-3 tile gap
        const template = [[1,1],[1,1],[1,1],[1,1]]; // 2x4 large wall

        // Place in mid strip for strategic control
        const row = MID_STRIP_START + Math.floor(Math.random() * 5);
        const leftCol = 3;
        const rightCol = leftCol + 2 + gapSize + 2; // left wall + gap + right wall

        if (rightCol + 2 <= CANVAS_WIDTH) {
          tryPlaceWallPattern(template, row, leftCol);
          tryPlaceWallPattern(template, row, rightCol);
        }
      }

      // Pattern 4: MIRROR CORRIDOR (matching walls on left/right creating a lane)
      if (Math.random() < 0.5 && mirrorVertical) {
        console.log('  Creating MIRROR CORRIDOR pattern');
        const wallCount = 3 + Math.floor(Math.random() * 2); // 3-4 walls per side
        const template = [[1,1],[1,1],[1,1]]; // 2x3 wall

        for (let i = 0; i < wallCount; i++) {
          const row = MID_STRIP_START + i * 3;
          const col = 2; // Left side - mirror will create right side automatically

          if (row + template.length <= MID_STRIP_END) {
            tryPlaceWallPattern(template, row, col);
          }
        }
      }

      console.log('  Pattern placement complete');
    } else {
      console.log('  Using RANDOM placement mode');
    }

    // ===== PHASE 4 & 5: TEMPLATE PLACEMENT WITH VALIDATION =====
    console.log('\n--- PHASE 4: Template Placement ---');

    // Helper: Choose weighted random template
    const chooseTemplate = (templates) => {
      const totalWeight = Object.values(templates).reduce((sum, t) => sum + t.weight, 0);
      let random = Math.random() * totalWeight;

      for (const [name, template] of Object.entries(templates)) {
        random -= template.weight;
        if (random <= 0) return template.pattern;
      }

      return Object.values(templates)[0].pattern;
    };

    // Helper: Count tiles in template
    const countTilesInTemplate = (template) => {
      let count = 0;
      for (const row of template) {
        for (const cell of row) {
          if (cell === 1) count++;
        }
      }
      return count;
    };

    // Helper: Flood fill to find connected component size
    const floodFillSize = (tiles, startRow, startCol, targetType) => {
      const visited = new Set();
      const queue = [[startRow, startCol]];
      let size = 0;

      while (queue.length > 0) {
        const [row, col] = queue.shift();
        const key = `${row},${col}`;

        if (!isValid(row, col) || visited.has(key) || tiles[row][col] !== targetType) continue;

        visited.add(key);
        size++;

        [[row-1,col], [row+1,col], [row,col-1], [row,col+1]].forEach(([r, c]) => {
          if (!visited.has(`${r},${c}`)) queue.push([r, c]);
        });
      }

      return size;
    };

    // Helper: Get dimensions of a structure (length, thickness, total size)
    const getStructureDimensions = (tiles, startRow, startCol, targetType) => {
      const visited = new Set();
      const queue = [[startRow, startCol]];
      const positions = [];

      while (queue.length > 0) {
        const [row, col] = queue.shift();
        const key = `${row},${col}`;

        if (!isValid(row, col) || visited.has(key) || tiles[row][col] !== targetType) continue;

        visited.add(key);
        positions.push([row, col]);

        [[row-1,col], [row+1,col], [row,col-1], [row,col+1]].forEach(([r, c]) => {
          if (!visited.has(`${r},${c}`)) queue.push([r, c]);
        });
      }

      if (positions.length === 0) return { totalSize: 0, maxLength: 0, maxThickness: 0 };

      // Calculate bounding box
      const minRow = Math.min(...positions.map(p => p[0]));
      const maxRow = Math.max(...positions.map(p => p[0]));
      const minCol = Math.min(...positions.map(p => p[1]));
      const maxCol = Math.max(...positions.map(p => p[1]));

      const height = maxRow - minRow + 1;
      const width = maxCol - minCol + 1;

      return {
        totalSize: positions.length,
        maxLength: Math.max(height, width),
        maxThickness: Math.min(height, width)
      };
    };

    // CRITICAL: Placement validation function (prevents OTGs and enforces size limits)
    const checkPlacementValid = (template, row, col, tiles, zone, terrainType) => {
      const templateHeight = template.length;
      const templateWidth = template[0].length;

      // Check 1: Does template fit in bounds?
      if (row < 0 || col < 0 || row + templateHeight > CANVAS_HEIGHT || col + templateWidth > CANVAS_WIDTH) {
        return false;
      }

      // Check 2: Does template overlap existing structure?
      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] === 1 && tiles[row + i][col + j] !== null) {
            return false;
          }
        }
      }

      // Check 3: Create test grid with template virtually placed
      const testGrid = tiles.map(r => [...r]);
      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] === 1) {
            testGrid[row + i][col + j] = terrainType;
          }
        }
      }

      // Check 4: CRITICAL OTG PREVENTION - Check for trapped empty space
      // Get perimeter of template (1-tile around)
      const perimeterCells = new Set();
      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] === 1) {
            const tileRow = row + i;
            const tileCol = col + j;

            // Add all adjacent empty cells to perimeter
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;

                const neighborRow = tileRow + dr;
                const neighborCol = tileCol + dc;

                if (!isValid(neighborRow, neighborCol)) continue;
                if (testGrid[neighborRow][neighborCol] === null) {
                  perimeterCells.add(`${neighborRow},${neighborCol}`);
                }
              }
            }
          }
        }
      }

      // Check each perimeter empty cell for trapping
      for (const cellKey of perimeterCells) {
        const [cellRow, cellCol] = cellKey.split(',').map(Number);

        // Count empty orthogonal neighbors
        const orthogonalNeighbors = [
          [cellRow - 1, cellCol],
          [cellRow + 1, cellCol],
          [cellRow, cellCol - 1],
          [cellRow, cellCol + 1]
        ];

        let emptyNeighbors = 0;
        let filledN = false, filledS = false, filledE = false, filledW = false;

        for (let i = 0; i < orthogonalNeighbors.length; i++) {
          const [nr, nc] = orthogonalNeighbors[i];
          if (!isValid(nr, nc)) continue;

          if (testGrid[nr][nc] === null) {
            emptyNeighbors++;
          } else {
            // Track which directions are filled
            if (i === 0) filledN = true;
            if (i === 1) filledS = true;
            if (i === 2) filledW = true;
            if (i === 3) filledE = true;
          }
        }

        // Check 1: Empty tile must have 2+ empty orthogonal neighbors
        if (emptyNeighbors < 2) {
          return false; // Would create trapped empty space
        }

        // Check 2: Check for 1-tile corridors (filled on opposite sides)
        if ((filledN && filledS) || (filledE && filledW)) {
          return false; // Would create 1-tile corridor
        }
      }

      // Check 5: Check for different terrain adjacency (creates OTG)
      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] !== 1) continue;

          const tileRow = row + i;
          const tileCol = col + j;

          // Check 8-directional neighbors for different terrain
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;

              const neighborRow = tileRow + dr;
              const neighborCol = tileCol + dc;

              if (!isValid(neighborRow, neighborCol)) continue;

              const neighborTile = tiles[neighborRow][neighborCol];
              if (neighborTile === null) continue;

              // Check if neighbor is different terrain type
              if (neighborTile !== terrainType) {
                // Would create OTG with different terrain - reject
                return false;
              }
            }
          }
        }
      }

      // Check 6: STRICT size limits when structures connect
      // Check if template would connect to existing same-terrain structure
      const connectedStructures = new Set();
      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] !== 1) continue;

          const tileRow = row + i;
          const tileCol = col + j;

          // Check orthogonal neighbors
          [[tileRow-1, tileCol], [tileRow+1, tileCol], [tileRow, tileCol-1], [tileRow, tileCol+1]].forEach(([nr, nc]) => {
            if (!isValid(nr, nc)) return;
            if (tiles[nr][nc] === terrainType) {
              connectedStructures.add(`${nr},${nc}`);
            }
          });
        }
      }

      // If connecting to existing structure, check combined size limits
      if (connectedStructures.size > 0) {
        // Get any connected structure position
        const connectedPos = Array.from(connectedStructures)[0].split(',').map(Number);

        // Calculate combined structure dimensions using testGrid
        const dims = getStructureDimensions(testGrid, connectedPos[0], connectedPos[1], terrainType);

        // STRICT size limits
        let maxTotalSize, maxLength, maxThickness;
        if (terrainType === TERRAIN_TYPES.WALL) {
          maxTotalSize = 20;
          maxLength = 8;
          maxThickness = 3;
        } else if (terrainType === TERRAIN_TYPES.GRASS) {
          maxTotalSize = 25;
          maxLength = 10;
          maxThickness = 4;
        } else { // WATER
          maxTotalSize = 15;
          maxLength = 8;
          maxThickness = 3;
        }

        if (dims.totalSize > maxTotalSize || dims.maxLength > maxLength || dims.maxThickness > maxThickness) {
          return false; // Would exceed size limits
        }
      }

      // Check 7: Section balance
      // Count how many tiles would go in mid vs backside
      let midTiles = 0, backsideTiles = 0;
      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] === 1) {
            if (isInMidStrip(row + i)) midTiles++;
            else backsideTiles++;
          }
        }
      }

      // Calculate current coverage
      let currentMidFilled = 0, currentMidTotal = 0;
      let currentBacksideFilled = 0, currentBacksideTotal = 0;

      for (let r = 0; r < CANVAS_HEIGHT; r++) {
        for (let c = 0; c < CANVAS_WIDTH; c++) {
          if (isInMidStrip(r)) {
            currentMidTotal++;
            if (tiles[r][c] !== null) currentMidFilled++;
          } else {
            currentBacksideTotal++;
            if (tiles[r][c] !== null) currentBacksideFilled++;
          }
        }
      }

      const currentMidCoverage = currentMidFilled / currentMidTotal;
      const currentBacksideCoverage = currentBacksideFilled / currentBacksideTotal;

      const newMidCoverage = (currentMidFilled + midTiles) / currentMidTotal;
      const newBacksideCoverage = (currentBacksideFilled + backsideTiles) / currentBacksideTotal;

      // Don't allow any section to exceed 50% coverage
      if (newMidCoverage > 0.50 || newBacksideCoverage > 0.50) {
        return false;
      }

      // Check 8: Internal corners check for L/T-shapes (FIX 3)
      if (terrainType === TERRAIN_TYPES.WALL) {
        if (!checkLShapeInternalCorners(template, row, col, tiles)) {
          return false; // Would create OTG at internal corner
        }
      }

      // Check 9: Section-based distribution (FIX 5)
      const sectionCov = getSectionCoverage(row, col, testGrid);
      if (sectionCov > 0.60) {
        return false; // Section too dense
      }

      return true; // Placement is valid!
    };

    // Helper: Detect OTGs in a radius around a position
    const detectOTGsInRadius = (tiles, centerRow, centerCol, radius) => {
      const otgs = [];

      for (let row = Math.max(0, centerRow - radius); row < Math.min(CANVAS_HEIGHT, centerRow + radius + 1); row++) {
        for (let col = Math.max(0, centerCol - radius); col < Math.min(CANVAS_WIDTH, centerCol + radius + 1); col++) {
          // Check for 1-tile empty gaps surrounded by filled
          if (tiles[row][col] === null) {
            const neighbors4 = [[row-1,col], [row+1,col], [row,col-1], [row,col+1]]
              .filter(([r, c]) => isValid(r, c));

            if (neighbors4.length === 4) {
              const filledNeighbors = neighbors4.filter(([r, c]) => tiles[r][c] !== null);
              if (filledNeighbors.length === 4) {
                otgs.push({row, col, type: '1-tile gap'});
              }
            }

            // Check for 1-tile corridors
            const N = isValid(row-1, col) ? tiles[row-1][col] : null;
            const S = isValid(row+1, col) ? tiles[row+1][col] : null;
            const E = isValid(row, col+1) ? tiles[row][col+1] : null;
            const W = isValid(row, col-1) ? tiles[row][col-1] : null;

            if ((N !== null && S !== null) || (E !== null && W !== null)) {
              otgs.push({row, col, type: '1-tile corridor'});
            }
          }

          // Check for 1-tile protrusions of different terrain
          const tile = tiles[row][col];
          if (tile !== null) {
            const neighbors8 = [
              [row-1,col], [row+1,col], [row,col-1], [row,col+1],
              [row-1,col-1], [row-1,col+1], [row+1,col-1], [row+1,col+1]
            ].filter(([r, c]) => isValid(r, c));

            const sameTypeNeighbors = neighbors8.filter(([r, c]) => tiles[r][c] === tile);
            const differentTypeNeighbors = neighbors8.filter(([r, c]) =>
              tiles[r][c] !== null && tiles[r][c] !== tile
            );

            if (sameTypeNeighbors.length === 0 && differentTypeNeighbors.length > 0) {
              otgs.push({row, col, type: '1-tile protrusion'});
            }
          }
        }
      }

      return otgs;
    };

    // BRUTE-FORCE: Detect ALL OTGs across entire map
    const detectAllOTGs = (tiles) => {
      const otgs = [];

      // Scan every tile on the map
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          // Type 1: Empty tile with 4 filled orthogonal neighbors (completely trapped)
          if (tiles[row][col] === null) {
            const neighbors4 = [
              [row-1, col],  // North
              [row+1, col],  // South
              [row, col-1],  // West
              [row, col+1]   // East
            ];

            let filledCount = 0;
            let filledN = false, filledS = false, filledW = false, filledE = false;

            for (let i = 0; i < neighbors4.length; i++) {
              const [r, c] = neighbors4[i];
              if (isValid(r, c) && tiles[r][c] !== null) {
                filledCount++;
                if (i === 0) filledN = true;
                if (i === 1) filledS = true;
                if (i === 2) filledW = true;
                if (i === 3) filledE = true;
              }
            }

            // CRITICAL OTG: 4 filled neighbors
            if (filledCount === 4) {
              otgs.push({row, col, type: 'CRITICAL: 4-way trapped', severity: 'critical'});
            }
            // LIKELY OTG: 3 filled neighbors (check diagonal for 4th)
            else if (filledCount === 3) {
              // Check if there's a diagonal fill making it effectively trapped
              const diagonals = [
                [row-1, col-1], [row-1, col+1], [row+1, col-1], [row+1, col+1]
              ];
              const filledDiagonals = diagonals.filter(([r, c]) => isValid(r, c) && tiles[r][c] !== null).length;

              if (filledDiagonals >= 1) {
                otgs.push({row, col, type: 'LIKELY: 3-way + diagonal', severity: 'high'});
              }
            }
            // Check for 1-tile corridors (filled on opposite sides)
            else if ((filledN && filledS) || (filledE && filledW)) {
              otgs.push({row, col, type: '1-tile corridor', severity: 'medium'});
            }
          }

          // Type 2: 1-tile protrusions of different terrain
          const tile = tiles[row][col];
          if (tile !== null) {
            const neighbors8 = [
              [row-1,col], [row+1,col], [row,col-1], [row,col+1],
              [row-1,col-1], [row-1,col+1], [row+1,col-1], [row+1,col+1]
            ].filter(([r, c]) => isValid(r, c));

            const sameTypeNeighbors = neighbors8.filter(([r, c]) => tiles[r][c] === tile);
            const differentTypeNeighbors = neighbors8.filter(([r, c]) =>
              tiles[r][c] !== null && tiles[r][c] !== tile
            );

            if (sameTypeNeighbors.length === 0 && differentTypeNeighbors.length > 0) {
              otgs.push({row, col, type: '1-tile protrusion', severity: 'low'});
            }
          }
        }
      }

      return otgs;
    };

    // Helper: Undo template placement
    const undoTemplatePlacement = (template, row, col, terrainType, tiles) => {
      const positions = calculateMirrorPositions(template, row, col);

      for (const pos of positions) {
        const templateHeight = template.length;
        const templateWidth = template[0].length;

        for (let i = 0; i < templateHeight; i++) {
          for (let j = 0; j < templateWidth; j++) {
            if (template[i][j] === 1) {
              if (isValid(pos.row + i, pos.col + j)) {
                tiles[pos.row + i][pos.col + j] = null;
              }
            }
          }
        }
      }
    };

    // Helper: Calculate mirror positions for a template placement
    const calculateMirrorPositions = (template, row, col) => {
      const positions = [{row, col}]; // Original position always included
      const templateHeight = template.length;
      const templateWidth = template[0].length;

      if (mirrorVertical) {
        const mirrorCol = CANVAS_WIDTH - col - templateWidth;
        if (mirrorCol >= 0 && mirrorCol + templateWidth <= CANVAS_WIDTH) {
          positions.push({row, col: mirrorCol});
        }
      }

      if (mirrorHorizontal) {
        const mirrorRow = CANVAS_HEIGHT - row - templateHeight;
        if (mirrorRow >= 0 && mirrorRow + templateHeight <= CANVAS_HEIGHT) {
          positions.push({row: mirrorRow, col});
        }
      }

      if (mirrorDiagonal) {
        const centerRow = (CANVAS_HEIGHT - 1) / 2;
        const centerCol = (CANVAS_WIDTH - 1) / 2;
        const mirrorRow = Math.round(2 * centerRow - row - templateHeight + 1);
        const mirrorCol = Math.round(2 * centerCol - col - templateWidth + 1);
        if (mirrorRow >= 0 && mirrorRow + templateHeight <= CANVAS_HEIGHT &&
            mirrorCol >= 0 && mirrorCol + templateWidth <= CANVAS_WIDTH) {
          positions.push({row: mirrorRow, col: mirrorCol});
        }
      }

      if (mirrorVertical && mirrorHorizontal) {
        const mirrorRow = CANVAS_HEIGHT - row - templateHeight;
        const mirrorCol = CANVAS_WIDTH - col - templateWidth;
        if (mirrorRow >= 0 && mirrorRow + templateHeight <= CANVAS_HEIGHT &&
            mirrorCol >= 0 && mirrorCol + templateWidth <= CANVAS_WIDTH) {
          positions.push({row: mirrorRow, col: mirrorCol});
        }
      }

      // Remove duplicates
      const uniquePositions = [];
      const seen = new Set();
      for (const pos of positions) {
        const key = `${pos.row},${pos.col}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniquePositions.push(pos);
        }
      }

      return uniquePositions;
    };

    // Helper: Place template at position
    const placeTemplateAtPosition = (template, row, col, terrainType, tiles) => {
      const templateHeight = template.length;
      const templateWidth = template[0].length;
      let tilesPlaced = 0;

      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] === 1) {
            tiles[row + i][col + j] = terrainType;
            tilesPlaced++;
          }
        }
      }

      return tilesPlaced;
    };

    // Helper: Place template with all mirror positions atomically
    const placeTemplate = (template, row, col, terrainType, tiles) => {
      let totalTilesPlaced = 0;

      // Calculate all mirror positions
      const positions = calculateMirrorPositions(template, row, col);

      // Place at each position
      for (const pos of positions) {
        totalTilesPlaced += placeTemplateAtPosition(template, pos.row, pos.col, terrainType, tiles);
      }

      return totalTilesPlaced;
    };

    // Helper: Identify all structures of a given terrain type
    const identifyAllStructures = (tiles, terrainType) => {
      const structures = [];
      const visited = new Set();

      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const key = `${row},${col}`;
          if (tiles[row][col] === terrainType && !visited.has(key)) {
            // Found new structure - flood fill to get all positions
            const positions = [];
            const queue = [[row, col]];

            while (queue.length > 0) {
              const [r, c] = queue.shift();
              const k = `${r},${c}`;

              if (!isValid(r, c) || visited.has(k) || tiles[r][c] !== terrainType) continue;

              visited.add(k);
              positions.push([r, c]);

              [[r-1,c], [r+1,c], [r,c-1], [r,c+1]].forEach(([nr, nc]) => {
                if (!visited.has(`${nr},${nc}`)) queue.push([nr, nc]);
              });
            }

            if (positions.length > 0) {
              structures.push(positions);
            }
          }
        }
      }

      return structures;
    };

    // Helper: Calculate minimum distance between two structures
    const minimumDistanceBetweenStructures = (struct1, struct2) => {
      let minDist = Infinity;
      for (const [r1, c1] of struct1) {
        for (const [r2, c2] of struct2) {
          const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2); // Manhattan distance
          minDist = Math.min(minDist, dist);
        }
      }
      return minDist;
    };

    // Helper: Get bounding box and dimensions of a structure
    const getStructureBounds = (structure) => {
      const rows = structure.map(p => p[0]);
      const cols = structure.map(p => p[1]);
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      const minCol = Math.min(...cols);
      const maxCol = Math.max(...cols);

      return {
        minRow, maxRow, minCol, maxCol,
        width: maxCol - minCol + 1,
        height: maxRow - minRow + 1,
        size: structure.length
      };
    };

    // Helper: Fill gap between two structures
    const fillGapBetweenStructures = (struct1, struct2, terrainType, tiles) => {
      // Find shortest path between structures
      const bounds1 = getStructureBounds(struct1);
      const bounds2 = getStructureBounds(struct2);

      // Get all tiles between the structures
      const minRow = Math.min(bounds1.minRow, bounds2.minRow);
      const maxRow = Math.max(bounds1.maxRow, bounds2.maxRow);
      const minCol = Math.min(bounds1.minCol, bounds2.minCol);
      const maxCol = Math.max(bounds1.maxCol, bounds2.maxCol);

      let tilesAdded = 0;

      // Fill connecting tiles using flood-fill approach
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          if (!isValid(row, col) || tiles[row][col] !== null) continue;

          // Check if this tile is adjacent to either structure
          const neighbors = [[row-1,col], [row+1,col], [row,col-1], [row,col+1]];
          const hasStruct1Neighbor = neighbors.some(([r,c]) =>
            struct1.some(([sr, sc]) => sr === r && sc === c)
          );
          const hasStruct2Neighbor = neighbors.some(([r,c]) =>
            struct2.some(([sr, sc]) => sr === r && sc === c)
          );

          // If adjacent to either structure and in gap area, fill it
          if (hasStruct1Neighbor || hasStruct2Neighbor) {
            tiles[row][col] = terrainType;
            tilesAdded++;
          }
        }
      }

      return tilesAdded;
    };

    // FIX 2: SMART BUSH MERGING
    const mergeNearbyBushes = (tiles) => {
      console.log('\n--- Smart Bush Merging ---');
      let mergeCount = 0;

      // Identify all bush structures
      const bushStructures = identifyAllStructures(tiles, TERRAIN_TYPES.GRASS);
      console.log(`  Found ${bushStructures.length} bush structures`);

      // Try to merge nearby bushes
      for (let i = 0; i < bushStructures.length; i++) {
        for (let j = i + 1; j < bushStructures.length; j++) {
          const bush1 = bushStructures[i];
          const bush2 = bushStructures[j];

          const distance = minimumDistanceBetweenStructures(bush1, bush2);

          if (distance <= 2 && distance > 0) {
            // Check if merge would be valid
            const bounds1 = getStructureBounds(bush1);
            const bounds2 = getStructureBounds(bush2);

            // Calculate merged bounds
            const mergedMinRow = Math.min(bounds1.minRow, bounds2.minRow);
            const mergedMaxRow = Math.max(bounds1.maxRow, bounds2.maxRow);
            const mergedMinCol = Math.min(bounds1.minCol, bounds2.minCol);
            const mergedMaxCol = Math.max(bounds1.maxCol, bounds2.maxCol);

            const mergedWidth = mergedMaxCol - mergedMinCol + 1;
            const mergedHeight = mergedMaxRow - mergedMinRow + 1;
            const mergedSize = bounds1.size + bounds2.size + distance; // Approximate

            const maxDimension = Math.max(mergedWidth, mergedHeight);
            const minDimension = Math.min(mergedWidth, mergedHeight);

            // Check merge criteria
            if (mergedSize <= 35 && minDimension >= 2 && maxDimension <= 12) {
              // Merge is valid - fill gap
              const tilesAdded = fillGapBetweenStructures(bush1, bush2, TERRAIN_TYPES.GRASS, tiles);

              if (tilesAdded > 0) {
                console.log(`  Merged bushes at (${bounds1.minRow},${bounds1.minCol}) and (${bounds2.minRow},${bounds2.minCol}) - added ${tilesAdded} tiles`);
                mergeCount++;

                // Update bush2 to include merged tiles for further merging
                for (let row = mergedMinRow; row <= mergedMaxRow; row++) {
                  for (let col = mergedMinCol; col <= mergedMaxCol; col++) {
                    if (isValid(row, col) && tiles[row][col] === TERRAIN_TYPES.GRASS) {
                      const alreadyInBush2 = bush2.some(([r, c]) => r === row && c === col);
                      if (!alreadyInBush2) {
                        bush2.push([row, col]);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      console.log(`  Merged ${mergeCount} bush pairs`);
      return mergeCount;
    };

    // FIX 3: CHECK INTERNAL CORNERS FOR L/T-SHAPES
    const checkLShapeInternalCorners = (template, row, col, tiles) => {
      const templateHeight = template.length;
      const templateWidth = template[0].length;

      // Identify internal corners (tiles with 1 in template that have empty space in template)
      const internalCorners = [];

      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] === 1) {
            // Check if this is an internal corner by looking at template neighbors
            const hasEmptyInTemplate = [
              [i-1, j], [i+1, j], [i, j-1], [i, j+1]
            ].some(([ti, tj]) => {
              if (ti >= 0 && ti < templateHeight && tj >= 0 && tj < templateWidth) {
                return template[ti][tj] === 0;
              }
              return false;
            });

            if (hasEmptyInTemplate) {
              internalCorners.push([i, j]);
            }
          }
        }
      }

      // Check each internal corner
      for (const [ti, tj] of internalCorners) {
        const cornerRow = row + ti;
        const cornerCol = col + tj;

        // Check tiles adjacent to this corner position
        const adjacentChecks = [
          [cornerRow-1, cornerCol], [cornerRow+1, cornerCol],
          [cornerRow, cornerCol-1], [cornerRow, cornerCol+1]
        ];

        for (const [adjRow, adjCol] of adjacentChecks) {
          if (!isValid(adjRow, adjCol)) continue;
          if (tiles[adjRow][adjCol] !== null) continue; // Already filled

          // Check if this empty tile would become trapped
          const emptyNeighbors = [
            [adjRow-1, adjCol], [adjRow+1, adjCol],
            [adjRow, adjCol-1], [adjRow, adjCol+1]
          ].filter(([r, c]) => isValid(r, c) && tiles[r][c] === null).length;

          if (emptyNeighbors <= 1) {
            return false; // Would create OTG at internal corner
          }
        }
      }

      return true;
    };

    // FIX 4: FINAL COMPREHENSIVE OTG FIXING SCAN
    const fixAllRemainingOTGs = (tiles) => {
      console.log('\n--- Final OTG Fixing Scan ---');
      let otgsFixed = 0;

      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (tiles[row][col] === null) { // Empty tile
            const neighbors = [
              {tile: row-1 >= 0 ? tiles[row-1][col] : null, pos: [row-1, col], dir: 'N'},
              {tile: row+1 < CANVAS_HEIGHT ? tiles[row+1][col] : null, pos: [row+1, col], dir: 'S'},
              {tile: tiles[row][col-1], pos: [row, col-1], dir: 'W'},
              {tile: tiles[row][col+1], pos: [row, col+1], dir: 'E'}
            ];

            const filledNeighbors = neighbors.filter(n => n.tile !== null && n.tile !== undefined);

            if (filledNeighbors.length === 4) {
              // CRITICAL OTG - completely surrounded
              console.log(`  OTG detected at (${row},${col}) - fixing...`);

              // Find weakest neighbor structure to remove from
              let smallestStructure = null;
              let smallestSize = Infinity;

              for (const neighbor of filledNeighbors) {
                const [nRow, nCol] = neighbor.pos;
                if (!isValid(nRow, nCol)) continue;

                const structureSize = floodFillSize(tiles, nRow, nCol, neighbor.tile);

                if (structureSize < smallestSize) {
                  smallestSize = structureSize;
                  smallestStructure = neighbor;
                }
              }

              // Remove the neighbor tile to open the OTG
              if (smallestStructure) {
                const [nRow, nCol] = smallestStructure.pos;
                if (isValid(nRow, nCol)) {
                  tiles[nRow][nCol] = null;
                  otgsFixed++;
                  console.log(`  Fixed by removing tile at (${nRow},${nCol})`);
                }
              }
            }
          }
        }
      }

      console.log(`  Fixed ${otgsFixed} remaining OTGs`);
      return otgsFixed;
    };

    // FIX 5: SECTION-BASED DISTRIBUTION TRACKING
    const SECTIONS_GRID = 3; // 3x3 grid
    const sectionCoverage = Array(SECTIONS_GRID).fill(null).map(() => Array(SECTIONS_GRID).fill(0));
    const sectionTotal = Array(SECTIONS_GRID).fill(null).map(() => Array(SECTIONS_GRID).fill(0));

    // Calculate section totals
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const sectionRow = Math.floor(row / (CANVAS_HEIGHT / SECTIONS_GRID));
        const sectionCol = Math.floor(col / (CANVAS_WIDTH / SECTIONS_GRID));
        sectionTotal[Math.min(sectionRow, SECTIONS_GRID-1)][Math.min(sectionCol, SECTIONS_GRID-1)]++;
      }
    }

    const getSectionCoverage = (row, col, tiles) => {
      const sectionRow = Math.floor(row / (CANVAS_HEIGHT / SECTIONS_GRID));
      const sectionCol = Math.floor(col / (CANVAS_WIDTH / SECTIONS_GRID));
      const sr = Math.min(sectionRow, SECTIONS_GRID-1);
      const sc = Math.min(sectionCol, SECTIONS_GRID-1);

      // Count filled tiles in this section
      let filled = 0;
      const rowStart = sr * Math.floor(CANVAS_HEIGHT / SECTIONS_GRID);
      const rowEnd = Math.min(rowStart + Math.floor(CANVAS_HEIGHT / SECTIONS_GRID), CANVAS_HEIGHT);
      const colStart = sc * Math.floor(CANVAS_WIDTH / SECTIONS_GRID);
      const colEnd = Math.min(colStart + Math.floor(CANVAS_WIDTH / SECTIONS_GRID), CANVAS_WIDTH);

      for (let r = rowStart; r < rowEnd; r++) {
        for (let c = colStart; c < colEnd; c++) {
          if (tiles[r][c] !== null) filled++;
        }
      }

      return sectionTotal[sr][sc] > 0 ? filled / sectionTotal[sr][sc] : 0;
    };

    // Place each terrain type
    const terrainConfigs = [
      { type: TERRAIN_TYPES.WALL, targetCount: targetWalls, templates: WALL_TEMPLATES, name: 'WALL' },
      { type: TERRAIN_TYPES.GRASS, targetCount: targetBushes, templates: BUSH_TEMPLATES, name: 'BUSH' },
      { type: TERRAIN_TYPES.WATER, targetCount: targetWater, templates: WATER_TEMPLATES, name: 'WATER' }
    ];

    for (const { type, targetCount, templates, name } of terrainConfigs) {
      if (targetCount === 0) continue;

      console.log(`\n  Placing ${name}...`);
      let currentTileCount = 0;
      let attemptCount = 0;
      const maxAttempts = 5000;

      // Special handling for water: limit to 2 structures max, mid strip only
      let waterStructureCount = 0;
      const maxWaterStructures = 2;

      while (currentTileCount < targetCount && attemptCount < maxAttempts) {
        attemptCount++;

        // Step 1: Choose template
        const template = chooseTemplate(templates);
        const templateSize = countTilesInTemplate(template);

        // Step 2: Choose position - STRATEGIC placement for water
        let row, col;

        if (type === TERRAIN_TYPES.WATER) {
          // STRATEGIC WATER PLACEMENT: Only in mid strip (rows 11-21)
          // Skip water if we've placed max structures or density too low for strategic placement
          if (waterStructureCount >= maxWaterStructures) {
            break; // Stop placing water
          }

          // Only place water if template is 8+ tiles
          if (templateSize < 8) {
            continue; // Skip small water templates
          }

          // Place in mid strip with strategic positioning
          const midStripHeight = MID_STRIP_END - MID_STRIP_START + 1;
          row = MID_STRIP_START + Math.floor(Math.random() * (midStripHeight - template.length + 1));
          col = 5 + Math.floor(Math.random() * (CANVAS_WIDTH - 10 - template[0].length + 1)); // Center area
        } else {
          // Random placement for walls and bushes
          row = Math.floor(Math.random() * (CANVAS_HEIGHT - template.length + 1));
          col = Math.floor(Math.random() * (CANVAS_WIDTH - template[0].length + 1));
        }

        // Step 3: Determine zone
        const zone = getZone(row, col);

        // Step 4: Check if zone is over-saturated
        const zoneCurrentCoverage = calculateZoneCoverage(zone, placedTiles);
        if (zoneCurrentCoverage >= zone.targetCoverage) {
          continue; // Zone is full
        }

        // Step 5: Calculate all mirror positions
        const mirrorPositions = calculateMirrorPositions(template, row, col);

        // Step 6: Validate ALL mirror positions (atomic validation)
        let allPositionsValid = true;
        for (const pos of mirrorPositions) {
          const posZone = getZone(pos.row, pos.col);
          const isValidPlacement = checkPlacementValid(template, pos.row, pos.col, placedTiles, posZone, type);
          if (!isValidPlacement) {
            allPositionsValid = false;
            break;
          }
        }

        if (!allPositionsValid) {
          continue; // If ANY position invalid, reject entire placement
        }

        // Step 7: Place template at all mirror positions atomically
        const tilesPlaced = placeTemplate(template, row, col, type, placedTiles);

        // Step 8: POST-PLACEMENT VERIFICATION - BRUTE-FORCE scan ENTIRE MAP for OTGs
        const otgs = detectAllOTGs(placedTiles);

        if (otgs.length > 0) {
          // Found OTGs - UNDO the placement immediately
          const criticalOTGs = otgs.filter(o => o.severity === 'critical');
          const highOTGs = otgs.filter(o => o.severity === 'high');

          if (criticalOTGs.length > 0 || highOTGs.length > 0) {
            // Only reject for critical and high severity OTGs
            undoTemplatePlacement(template, row, col, type, placedTiles);
            continue; // Try another position
          }
          // Medium and low severity OTGs are acceptable (1-tile corridors, protrusions)
        }

        // Placement successful
        currentTileCount += tilesPlaced;
        placedStructures.push({ type: name, position: [row, col], size: tilesPlaced });

        // Track water structure count
        if (type === TERRAIN_TYPES.WATER) {
          waterStructureCount++;
        }
      }

      console.log(`  ${name}: placed ${currentTileCount}/${targetCount} tiles in ${attemptCount} attempts`);
      if (type === TERRAIN_TYPES.WATER) {
        console.log(`  Water structures placed: ${waterStructureCount} (max: ${maxWaterStructures})`);
      }

      // FIX 2: After bush placement, merge nearby bushes
      if (type === TERRAIN_TYPES.GRASS) {
        mergeNearbyBushes(placedTiles);
      }
    }

    // ===== PHASE 6: SYMMETRY APPLICATION =====
    // NOTE: Symmetry is now applied during placement (atomic validation and placement)
    console.log('\n--- PHASE 6: Symmetry Application ---');
    console.log('  Symmetry applied during placement (atomic)');

    // ===== PHASE 7: FINAL VALIDATION =====
    console.log('\n--- PHASE 7: Final Validation ---');

    // FIX 4: Final comprehensive OTG fixing scan (NUCLEAR OPTION)
    fixAllRemainingOTGs(placedTiles);

    // 0. STRICT SYMMETRY VALIDATION AND CORRECTION
    let symmetryErrors = 0;
    const symmetryViolations = [];

    if (mirrorVertical || mirrorHorizontal || mirrorDiagonal) {
      console.log('  Checking symmetry...');

      if (mirrorVertical) {
        for (let row = 0; row < CANVAS_HEIGHT; row++) {
          for (let col = 0; col < Math.floor(CANVAS_WIDTH / 2); col++) {
            const mirrorCol = CANVAS_WIDTH - 1 - col;
            if (placedTiles[row][col] !== placedTiles[row][mirrorCol]) {
              symmetryErrors++;
              symmetryViolations.push({
                type: 'vertical',
                pos1: [row, col],
                pos2: [row, mirrorCol],
                val1: placedTiles[row][col],
                val2: placedTiles[row][mirrorCol]
              });

              // FORCE CORRECTION: Set both to null (remove asymmetry)
              placedTiles[row][col] = null;
              placedTiles[row][mirrorCol] = null;
            }
          }
        }
      }

      if (mirrorHorizontal) {
        for (let row = 0; row < Math.floor(CANVAS_HEIGHT / 2); row++) {
          for (let col = 0; col < CANVAS_WIDTH; col++) {
            const mirrorRow = CANVAS_HEIGHT - 1 - row;
            if (placedTiles[row][col] !== placedTiles[mirrorRow][col]) {
              symmetryErrors++;
              symmetryViolations.push({
                type: 'horizontal',
                pos1: [row, col],
                pos2: [mirrorRow, col],
                val1: placedTiles[row][col],
                val2: placedTiles[mirrorRow][col]
              });

              // FORCE CORRECTION: Set both to null (remove asymmetry)
              placedTiles[row][col] = null;
              placedTiles[mirrorRow][col] = null;
            }
          }
        }
      }

      if (mirrorDiagonal) {
        const centerRow = Math.floor(CANVAS_HEIGHT / 2);
        const centerCol = Math.floor(CANVAS_WIDTH / 2);

        for (let row = 0; row < CANVAS_HEIGHT; row++) {
          for (let col = 0; col < CANVAS_WIDTH; col++) {
            const offsetRow = row - centerRow;
            const offsetCol = col - centerCol;
            const mirrorRow = centerRow - offsetRow;
            const mirrorCol = centerCol - offsetCol;

            if (mirrorRow >= 0 && mirrorRow < CANVAS_HEIGHT && mirrorCol >= 0 && mirrorCol < CANVAS_WIDTH) {
              if (row <= mirrorRow && col <= mirrorCol) { // Check only once per pair
                if (placedTiles[row][col] !== placedTiles[mirrorRow][mirrorCol]) {
                  symmetryErrors++;
                  symmetryViolations.push({
                    type: 'diagonal',
                    pos1: [row, col],
                    pos2: [mirrorRow, mirrorCol],
                    val1: placedTiles[row][col],
                    val2: placedTiles[mirrorRow][mirrorCol]
                  });

                  // FORCE CORRECTION: Set both to null (remove asymmetry)
                  placedTiles[row][col] = null;
                  placedTiles[mirrorRow][mirrorCol] = null;
                }
              }
            }
          }
        }
      }

      if (symmetryErrors > 0) {
        console.log(`  ERROR: Found ${symmetryErrors} symmetry violations - CORRECTED by removing mismatched tiles`);
        for (const violation of symmetryViolations.slice(0, 5)) { // Log first 5
          console.log(`    ${violation.type}: (${violation.pos1}) vs (${violation.pos2})`);
        }
      } else {
        console.log(`  Symmetry verification: PERFECT (0 errors)`);
      }
    }

    // 1. Scan for OTGs (should be 0)
    let otgCount = 0;

    // Check for 1-tile gaps surrounded by filled
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (placedTiles[row][col] === null) {
          const neighbors4 = [[row-1,col], [row+1,col], [row,col-1], [row,col+1]]
            .filter(([r, c]) => isValid(r, c));

          if (neighbors4.length === 4) {
            const filledNeighbors = neighbors4.filter(([r, c]) => placedTiles[r][c] !== null);
            if (filledNeighbors.length === 4) {
              console.log(`  ERROR: 1-tile gap at (${row}, ${col})`);
              otgCount++;
            }
          }
        }
      }
    }

    // Check for 1-tile protrusions of different terrain
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const tile = placedTiles[row][col];
        if (tile !== null) {
          const neighbors8 = [
            [row-1,col], [row+1,col], [row,col-1], [row,col+1],
            [row-1,col-1], [row-1,col+1], [row+1,col-1], [row+1,col+1]
          ].filter(([r, c]) => isValid(r, c));

          const sameTypeNeighbors = neighbors8.filter(([r, c]) => placedTiles[r][c] === tile);
          const differentTypeNeighbors = neighbors8.filter(([r, c]) =>
            placedTiles[r][c] !== null && placedTiles[r][c] !== tile
          );

          if (sameTypeNeighbors.length === 0 && differentTypeNeighbors.length > 0) {
            console.log(`  ERROR: 1-tile protrusion at (${row}, ${col})`);
            otgCount++;
          }
        }
      }
    }

    // 2. Log statistics
    console.log('\n=== Map Generation Complete ===');
    console.log(`Structures placed: ${placedStructures.length}`);

    const byType = {
      WALL: placedStructures.filter(s => s.type === 'WALL').length,
      BUSH: placedStructures.filter(s => s.type === 'BUSH').length,
      WATER: placedStructures.filter(s => s.type === 'WATER').length
    };
    console.log('By type:', byType);

    const avgSize = placedStructures.length > 0 ?
      (placedStructures.reduce((sum, s) => sum + s.size, 0) / placedStructures.length).toFixed(1) : 0;
    console.log(`Average structure size: ${avgSize} tiles`);

    // Size distribution (CRITICAL FOR PROBLEM 1 FIX)
    const tinyStructures = placedStructures.filter(s => s.size < 4).length; // 1-3 tiles
    const small = placedStructures.filter(s => s.size >= 4 && s.size <= 8).length; // 4-8 tiles (20% target)
    const medium = placedStructures.filter(s => s.size > 8 && s.size <= 20).length; // 9-20 tiles (50% target)
    const large = placedStructures.filter(s => s.size > 20).length; // 21+ tiles (30% target)

    console.log(`Size distribution:`);
    console.log(`  Tiny (<4 tiles): ${tinyStructures} (target: <5, ${((tinyStructures / placedStructures.length) * 100).toFixed(1)}%)`);
    console.log(`  Small (4-8 tiles): ${small} (target: 20%, actual: ${((small / placedStructures.length) * 100).toFixed(1)}%)`);
    console.log(`  Medium (9-20 tiles): ${medium} (target: 50%, actual: ${((medium / placedStructures.length) * 100).toFixed(1)}%)`);
    console.log(`  Large (21+ tiles): ${large} (target: 30%, actual: ${((large / placedStructures.length) * 100).toFixed(1)}%)`);

    // Zone coverage
    for (const zone of zones) {
      const coverage = (calculateZoneCoverage(zone, placedTiles) * 100).toFixed(1);
      console.log(`${zone.type} zone coverage: ${coverage}%`);
    }
    const normalCoverage = (calculateZoneCoverage(normalZone, placedTiles) * 100).toFixed(1);
    console.log(`NORMAL zone coverage: ${normalCoverage}%`);

    // Section coverage
    let midFilled = 0, midTotal = 0, backsideFilled = 0, backsideTotal = 0;
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (isInMidStrip(row)) {
          midTotal++;
          if (placedTiles[row][col] !== null) midFilled++;
        } else {
          backsideTotal++;
          if (placedTiles[row][col] !== null) backsideFilled++;
        }
      }
    }
    console.log(`Mid strip coverage: ${((midFilled / midTotal) * 100).toFixed(1)}%`);
    console.log(`Backside coverage: ${((backsideFilled / backsideTotal) * 100).toFixed(1)}%`);

    console.log(`OTGs found: ${otgCount} (should be 0)`);
    console.log(`Symmetry errors after correction: ${symmetryErrors > 0 ? 'CORRECTED' : '0'} (should be 0)`);

    // CRITICAL VALIDATION: Check structure sizes
    let structureSizeViolations = 0;
    const checkedStructures = new Set();

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const tile = placedTiles[row][col];
        if (tile === null) continue;

        const key = `${row},${col}`;
        if (checkedStructures.has(key)) continue;

        const dims = getStructureDimensions(placedTiles, row, col, tile);

        // Mark all positions in this structure as checked
        const visited = new Set();
        const queue = [[row, col]];
        while (queue.length > 0) {
          const [r, c] = queue.shift();
          const k = `${r},${c}`;
          if (!isValid(r, c) || visited.has(k) || placedTiles[r][c] !== tile) continue;
          visited.add(k);
          checkedStructures.add(k);
          [[r-1,c], [r+1,c], [r,c-1], [r,c+1]].forEach(([nr, nc]) => {
            if (!visited.has(`${nr},${nc}`)) queue.push([nr, nc]);
          });
        }

        // Check size limits
        let maxSize, maxLength, maxThickness, typeName;
        if (tile === TERRAIN_TYPES.WALL) {
          maxSize = 20;
          maxLength = 8;
          maxThickness = 3;
          typeName = 'WALL';
        } else if (tile === TERRAIN_TYPES.GRASS) {
          maxSize = 25;
          maxLength = 10;
          maxThickness = 4;
          typeName = 'BUSH';
        } else if (tile === TERRAIN_TYPES.WATER) {
          maxSize = 15;
          maxLength = 8;
          maxThickness = 3;
          typeName = 'WATER';
        }

        if (dims.totalSize > maxSize) {
          console.log(`  ERROR: ${typeName} at (${row}, ${col}) size ${dims.totalSize} exceeds max ${maxSize}`);
          structureSizeViolations++;
        }
        if (dims.maxLength > maxLength) {
          console.log(`  ERROR: ${typeName} at (${row}, ${col}) length ${dims.maxLength} exceeds max ${maxLength}`);
          structureSizeViolations++;
        }
        if (dims.maxThickness > maxThickness) {
          console.log(`  ERROR: ${typeName} at (${row}, ${col}) thickness ${dims.maxThickness} exceeds max ${maxThickness}`);
          structureSizeViolations++;
        }
      }
    }

    console.log(`Structure size violations: ${structureSizeViolations} (should be 0)`);

    // Bush size statistics after merging
    const bushStructuresAfterMerge = identifyAllStructures(placedTiles, TERRAIN_TYPES.GRASS);
    const bushSizes = bushStructuresAfterMerge.map(s => s.length);
    const avgBushSize = bushSizes.length > 0 ? (bushSizes.reduce((sum, s) => sum + s, 0) / bushSizes.length).toFixed(1) : 0;
    const largeBushes = bushSizes.filter(s => s > 20).length;
    const mediumBushes = bushSizes.filter(s => s >= 12 && s <= 20).length;
    const smallBushes = bushSizes.filter(s => s < 12).length;
    const tinyBushes = bushSizes.filter(s => s < 6).length;

    console.log('\nBush statistics after merging:');
    console.log(`  Total bush structures: ${bushStructuresAfterMerge.length}`);
    console.log(`  Average bush size: ${avgBushSize} tiles`);
    console.log(`  Large bushes (>20 tiles): ${largeBushes}`);
    console.log(`  Medium bushes (12-20 tiles): ${mediumBushes}`);
    console.log(`  Small bushes (6-11 tiles): ${smallBushes}`);
    console.log(`  Tiny bushes (<6 tiles): ${tinyBushes} (should be low)`);

    // Final terrain distribution
    let wallCount = 0, waterCount = 0, grassCount = 0, emptyCount = 0;
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const tile = placedTiles[row][col];
        if (tile === TERRAIN_TYPES.WALL) wallCount++;
        else if (tile === TERRAIN_TYPES.WATER) waterCount++;
        else if (tile === TERRAIN_TYPES.GRASS) grassCount++;
        else emptyCount++;
      }
    }

    const wallPercent = ((wallCount / totalTiles) * 100).toFixed(1);
    const waterPercent = ((waterCount / totalTiles) * 100).toFixed(1);
    const grassPercent = ((grassCount / totalTiles) * 100).toFixed(1);

    console.log('\nFinal terrain distribution:');
    console.log(`  WALL: ${wallCount} tiles (${wallPercent}%)`);
    console.log(`  WATER: ${waterCount} tiles (${waterPercent}%)`);
    console.log(`  GRASS: ${grassCount} tiles (${grassPercent}%)`);
    console.log(`  EMPTY: ${emptyCount} tiles`);
    console.log('==========================================\n');

    setTiles(placedTiles);
  };

  const clearCanvas = () => {
    setTiles(Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null)));
  };

  const downloadMap = () => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH * TILE_SIZE;
    canvas.height = CANVAS_HEIGHT * TILE_SIZE;
    const ctx = canvas.getContext('2d');
    
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const isEvenRow = row % 2 === 0;
        const isEvenCol = col % 2 === 0;
        const isLightSquare = (isEvenRow && isEvenCol) || (!isEvenRow && !isEvenCol);
        ctx.fillStyle = isLightSquare ? '#FFE4B3' : '#FFDAA3';
        ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        
        if (tiles[row][col]) {
          ctx.fillStyle = tiles[row][col];
          ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'blink-map.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const countTiles = () => {
    let wallCount = 0, waterCount = 0, grassCount = 0, otgCount = 0, emptyCount = 0;
    tiles.forEach(row => {
      row.forEach(tile => {
        if (tile === TERRAIN_TYPES.WALL) wallCount++;
        else if (tile === TERRAIN_TYPES.WATER) waterCount++;
        else if (tile === TERRAIN_TYPES.GRASS) grassCount++;
        else if (tile === TERRAIN_TYPES.OTG) otgCount++;
        else emptyCount++;
      });
    });
    return { wallCount, waterCount, grassCount, otgCount, emptyCount };
  };

  const tileCounts = countTiles();

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #0a1128 0%, #1a2332 50%, #2d1b4e 100%)'
    }}>
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(100)].map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute bg-white rounded-full"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              opacity: Math.random() * 0.5 + 0.3
            }}
          />
        ))}
      </div>

      <div className="relative z-10 bg-black bg-opacity-30 border-b border-purple-500 border-opacity-30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">💫</span>
          <h1 className="text-2xl font-bold text-white">Blink</h1>
        </div>
      </div>

      <div className="relative z-10 flex items-start justify-center gap-4 p-4 max-w-7xl mx-auto">
        <div className="flex flex-col items-center gap-4 flex-1">
          <div
            ref={canvasRef}
            className="inline-block border-4 border-purple-400 border-opacity-50 shadow-2xl touch-none"
            style={{
              background: '#FFE4B3',
              userSelect: 'none'
            }}
          >
            {tiles.map((row, rowIndex) => (
              <div key={rowIndex} className="flex">
                {row.map((tile, colIndex) => {
                  const isEvenRow = rowIndex % 2 === 0;
                  const isEvenCol = colIndex % 2 === 0;
                  const isLightSquare = (isEvenRow && isEvenCol) || (!isEvenRow && !isEvenCol);

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                      onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        handleMouseDown(rowIndex, colIndex);
                      }}
                      className="cursor-pointer touch-none"
                      style={{
                        width: TILE_SIZE + 'px',
                        height: TILE_SIZE + 'px',
                        backgroundColor: tile || (isLightSquare ? '#FFE4B3' : '#FFDAA3'),
                        border: '0.5px solid rgba(0,0,0,0.05)'
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <button
            onClick={generateRandomMap}
            className="w-full max-w-md bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <span style={{ fontSize: '20px' }}>🪄</span>
            Generate Map
          </button>

          <div className="bg-black bg-opacity-40 border border-cyan-400 border-opacity-50 rounded-lg p-2 w-full max-w-md backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center justify-center px-3 py-2 rounded" style={{ backgroundColor: TERRAIN_TYPES.WALL, minWidth: '60px' }}>
                <span className="text-white text-sm font-bold">{tileCounts.wallCount}</span>
              </div>
              <div className="flex items-center justify-center px-3 py-2 rounded" style={{ backgroundColor: TERRAIN_TYPES.WATER, minWidth: '60px' }}>
                <span className="text-white text-sm font-bold">{tileCounts.waterCount}</span>
              </div>
              <div className="flex items-center justify-center px-3 py-2 rounded" style={{ backgroundColor: TERRAIN_TYPES.GRASS, minWidth: '60px' }}>
                <span className="text-white text-sm font-bold">{tileCounts.grassCount}</span>
              </div>
              <div className="flex items-center justify-center px-3 py-2 rounded bg-orange-200" style={{ minWidth: '60px' }}>
                <span className="text-gray-700 text-sm font-bold">{tileCounts.emptyCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-black bg-opacity-40 border border-purple-400 border-opacity-50 rounded-lg w-full max-w-md backdrop-blur-sm overflow-hidden">
            <button
              onClick={() => setSlidersOpen(!slidersOpen)}
              className="w-full px-4 py-3 text-white font-semibold flex items-center justify-between hover:bg-white hover:bg-opacity-5 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span style={{ fontSize: '20px' }}>⚙️</span>
                Tile Density Settings
              </span>
              <span className="text-xl">{slidersOpen ? '▼' : '▶'}</span>
            </button>

            {slidersOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white text-sm flex-1">🧱 Walls</span>
                    <span className="text-white text-sm">{wallDensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={wallDensity}
                    onChange={(e) => setWallDensity(Number(e.target.value))}
                    className="w-full accent-amber-700"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white text-sm flex-1">🌊 Water</span>
                    <span className="text-white text-sm">{waterDensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={waterDensity}
                    onChange={(e) => setWaterDensity(Number(e.target.value))}
                    className="w-full accent-blue-400"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white text-sm flex-1">🥬 Grass</span>
                    <span className="text-white text-sm">{grassDensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={grassDensity}
                    onChange={(e) => setGrassDensity(Number(e.target.value))}
                    className="w-full accent-green-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="fixed right-0 top-20 z-20 flex items-center">
          <button
            onClick={() => setToolbarOpen(!toolbarOpen)}
            className={`bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-l-lg transition-all ${!toolbarOpen ? 'translate-x-0' : ''}`}
            style={{
              position: toolbarOpen ? 'relative' : 'absolute',
              right: toolbarOpen ? 0 : 0
            }}
          >
            {toolbarOpen ? '→' : '←'}
          </button>
          
          <div className={`bg-black bg-opacity-40 border-l border-t border-b border-purple-400 border-opacity-50 rounded-l-lg p-2 backdrop-blur-sm transition-transform duration-300 ${toolbarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={() => setSelectedTool(TERRAIN_TYPES.WALL)}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  selectedTool === TERRAIN_TYPES.WALL 
                    ? 'border-white scale-110 shadow-lg' 
                    : 'border-transparent hover:border-gray-400'
                }`}
                style={{ backgroundColor: TERRAIN_TYPES.WALL }}
                title="Wall"
              />
              <button
                onClick={() => setSelectedTool(TERRAIN_TYPES.WATER)}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  selectedTool === TERRAIN_TYPES.WATER 
                    ? 'border-white scale-110 shadow-lg' 
                    : 'border-transparent hover:border-gray-400'
                }`}
                style={{ backgroundColor: TERRAIN_TYPES.WATER }}
                title="Water"
              />
              <button
                onClick={() => setSelectedTool(TERRAIN_TYPES.GRASS)}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  selectedTool === TERRAIN_TYPES.GRASS
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:border-gray-400'
                }`}
                style={{ backgroundColor: TERRAIN_TYPES.GRASS }}
                title="Grass"
              />
              <button
                onClick={() => setSelectedTool(null)}
                className={`w-10 h-10 rounded-lg border-2 bg-gray-700 hover:bg-gray-600 transition-all flex items-center justify-center text-lg ${
                  selectedTool === null
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent'
                }`}
                title="Eraser"
              >
                🧹
              </button>
              
              <div className="w-full border-t border-purple-400 border-opacity-30 my-1" />
              
              <button
                onClick={() => setMirrorVertical(!mirrorVertical)}
                className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center text-lg ${
                  mirrorVertical 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title="Mirror Vertical"
              >
                ↔️
              </button>
              <button
                onClick={() => setMirrorHorizontal(!mirrorHorizontal)}
                className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center text-lg ${
                  mirrorHorizontal 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title="Mirror Horizontal"
              >
                ↕️
              </button>
              <button
                onClick={() => setMirrorDiagonal(!mirrorDiagonal)}
                className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center text-lg ${
                  mirrorDiagonal 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title="Mirror Central"
              >
                🔄
              </button>
              
              <div className="w-full border-t border-purple-400 border-opacity-30 my-1" />
              
              <button
                onClick={clearCanvas}
                className="w-10 h-10 rounded-lg bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
                title="Clear All"
              >
                <span className="text-white" style={{ fontSize: '18px' }}>🗑️</span>
              </button>
              <button
                onClick={downloadMap}
                className="w-10 h-10 rounded-lg bg-green-600 hover:bg-green-700 flex items-center justify-center transition-colors"
                title="Download PNG"
              >
                <span className="text-white" style={{ fontSize: '18px' }}>⬇️</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Make component available globally for browser usage
window.MapGenerator = MapGenerator;
