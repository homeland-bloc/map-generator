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
  const [wallDensity, setWallDensity] = useState(15);
  const [waterDensity, setWaterDensity] = useState(10);
  const [grassDensity, setGrassDensity] = useState(15);
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
      // Small (50% probability total)
      single: { pattern: [[1]], weight: 15 },
      bar_v2: { pattern: [[1],[1]], weight: 10 },
      bar_h2: { pattern: [[1,1]], weight: 10 },
      bar_v3: { pattern: [[1],[1],[1]], weight: 8 },
      bar_h3: { pattern: [[1,1,1]], weight: 8 },
      block_2x2: { pattern: [[1,1],[1,1]], weight: 10 },
      L1: { pattern: [[1,1],[1,0]], weight: 7 },
      L2: { pattern: [[1,1],[0,1]], weight: 7 },
      L3: { pattern: [[1,0],[1,1]], weight: 7 },
      L4: { pattern: [[0,1],[1,1]], weight: 7 },
      T1: { pattern: [[1,1,1],[0,1,0]], weight: 6 },
      T2: { pattern: [[1,0],[1,1],[1,0]], weight: 6 },
      T3: { pattern: [[0,1,0],[1,1,1]], weight: 6 },
      T4: { pattern: [[0,1],[1,1],[0,1]], weight: 6 },

      // Medium (30% probability total)
      bar_v4: { pattern: [[1],[1],[1],[1]], weight: 5 },
      bar_h4: { pattern: [[1,1,1,1]], weight: 5 },
      bar_v5: { pattern: [[1],[1],[1],[1],[1]], weight: 4 },
      bar_h5: { pattern: [[1,1,1,1,1]], weight: 4 },
      block_2x3: { pattern: [[1,1],[1,1],[1,1]], weight: 5 },
      block_3x2: { pattern: [[1,1,1],[1,1,1]], weight: 5 },
      L_big1: { pattern: [[1,1,1],[1,0,0]], weight: 4 },
      L_big2: { pattern: [[1,1,1],[0,0,1]], weight: 4 },
      L_big3: { pattern: [[1,0,0],[1,1,1]], weight: 4 },
      L_big4: { pattern: [[0,0,1],[1,1,1]], weight: 4 },
      U1: { pattern: [[1,0,1],[1,1,1]], weight: 4 },
      U2: { pattern: [[1,1],[1,0],[1,1]], weight: 4 },

      // Large (20% probability total)
      bar_v6: { pattern: [[1],[1],[1],[1],[1],[1]], weight: 3 },
      bar_h6: { pattern: [[1,1,1,1,1,1]], weight: 3 },
      bar_v7: { pattern: [[1],[1],[1],[1],[1],[1],[1]], weight: 2 },
      bar_h7: { pattern: [[1,1,1,1,1,1,1]], weight: 2 },
      block_2x4: { pattern: [[1,1],[1,1],[1,1],[1,1]], weight: 3 },
      block_2x5: { pattern: [[1,1],[1,1],[1,1],[1,1],[1,1]], weight: 2 },
      box_3x3: { pattern: [[1,1,1],[1,0,1],[1,1,1]], weight: 3 },
      plus: { pattern: [[0,1,0],[1,1,1],[0,1,0]], weight: 2 }
    };

    const BUSH_TEMPLATES = {
      // All bushes must be 2+ tiles wide
      square_2x2: { pattern: [[1,1],[1,1]], weight: 1 },
      rect_2x3: { pattern: [[1,1],[1,1],[1,1]], weight: 1 },
      rect_3x2: { pattern: [[1,1,1],[1,1,1]], weight: 1 },
      rect_2x4: { pattern: [[1,1],[1,1],[1,1],[1,1]], weight: 1 },
      rect_4x2: { pattern: [[1,1,1,1],[1,1,1,1]], weight: 1 },
      L_wide1: { pattern: [[1,1],[1,1],[1,1,0,0]], weight: 0.5 },
      L_wide2: { pattern: [[1,1,0,0],[1,1],[1,1]], weight: 0.5 }
    };

    const WATER_TEMPLATES = {
      // Minimal water features
      pool_2x3: { pattern: [[1,1],[1,1],[1,1]], weight: 1 },
      pool_3x3: { pattern: [[0,1,0],[1,1,1],[0,1,0]], weight: 1 },
      pool_3x2: { pattern: [[1,1,1],[1,1,1]], weight: 1 },
      river_2x5: { pattern: [[1,1],[1,1],[1,1],[1,1],[1,1]], weight: 0.5 }
    };

    console.log(`  Wall templates: ${Object.keys(WALL_TEMPLATES).length}`);
    console.log(`  Bush templates: ${Object.keys(BUSH_TEMPLATES).length}`);
    console.log(`  Water templates: ${Object.keys(WATER_TEMPLATES).length}`);

    // ===== PHASE 2: CALCULATE PLACEMENT TARGETS =====
    console.log('\n--- PHASE 2: Placement Targets ---');

    // Use better defaults if user hasn't changed them
    const effectiveWallDensity = wallDensity === 15 ? 25 : wallDensity;
    const effectiveGrassDensity = grassDensity === 15 ? 20 : grassDensity;
    const effectiveWaterDensity = waterDensity === 10 ? 8 : waterDensity;

    const targetWalls = Math.floor((effectiveWallDensity / 100) * totalTiles);
    const targetBushes = Math.floor((effectiveGrassDensity / 100) * totalTiles);
    const targetWater = Math.min(Math.floor((effectiveWaterDensity / 100) * totalTiles), totalTiles * 0.1); // Cap at 10%

    console.log(`  Target walls: ${targetWalls} tiles (${effectiveWallDensity}%)`);
    console.log(`  Target bushes: ${targetBushes} tiles (${effectiveGrassDensity}%)`);
    console.log(`  Target water: ${targetWater} tiles (${effectiveWaterDensity}%)`);

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

      while (currentTileCount < targetCount && attemptCount < maxAttempts) {
        attemptCount++;

        // Step 1: Choose template
        const template = chooseTemplate(templates);
        const templateSize = countTilesInTemplate(template);

        // Step 2: Choose random position
        const row = Math.floor(Math.random() * (CANVAS_HEIGHT - template.length + 1));
        const col = Math.floor(Math.random() * (CANVAS_WIDTH - template[0].length + 1));

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

        // Step 8: POST-PLACEMENT VERIFICATION - Scan for OTGs in 3-tile radius
        let otgsDetected = false;
        const mirrorPositions = calculateMirrorPositions(template, row, col);
        for (const pos of mirrorPositions) {
          const otgs = detectOTGsInRadius(placedTiles, pos.row, pos.col, 3);
          if (otgs.length > 0) {
            otgsDetected = true;
            console.log(`  WARNING: OTG detected after placement at (${pos.row}, ${pos.col}), undoing...`);
            break;
          }
        }

        if (otgsDetected) {
          // UNDO the placement immediately
          undoTemplatePlacement(template, row, col, type, placedTiles);
          continue; // Try another position
        }

        // Placement successful
        currentTileCount += tilesPlaced;
        placedStructures.push({ type: name, position: [row, col], size: tilesPlaced });
      }

      console.log(`  ${name}: placed ${currentTileCount}/${targetCount} tiles in ${attemptCount} attempts`);
    }

    // ===== PHASE 6: SYMMETRY APPLICATION =====
    // NOTE: Symmetry is now applied during placement (atomic validation and placement)
    console.log('\n--- PHASE 6: Symmetry Application ---');
    console.log('  Symmetry applied during placement (atomic)');

    // ===== PHASE 7: FINAL VALIDATION =====
    console.log('\n--- PHASE 7: Final Validation ---');

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

    // 2. Verify symmetry
    let symmetryErrors = 0;

    if (mirrorVertical) {
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH / 2; col++) {
          const mirrorCol = CANVAS_WIDTH - 1 - col;
          if (placedTiles[row][col] !== placedTiles[row][mirrorCol]) {
            symmetryErrors++;
          }
        }
      }
    }

    if (mirrorHorizontal) {
      for (let row = 0; row < CANVAS_HEIGHT / 2; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const mirrorRow = CANVAS_HEIGHT - 1 - row;
          if (placedTiles[row][col] !== placedTiles[mirrorRow][col]) {
            symmetryErrors++;
          }
        }
      }
    }

    // 3. Log statistics
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

    // Size distribution
    const small = placedStructures.filter(s => s.size <= 4).length;
    const medium = placedStructures.filter(s => s.size > 4 && s.size <= 10).length;
    const large = placedStructures.filter(s => s.size > 10).length;
    console.log(`Size distribution: small=${small}, medium=${medium}, large=${large}`);

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
    console.log(`Symmetry errors: ${symmetryErrors} (should be 0)`);

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
