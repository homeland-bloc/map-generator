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
    console.log('=== STARTING MAP GENERATION ===');
    const newTiles = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null));

    /*
     * MAP LAYOUT ZONES (21x33 grid for 3v3 shooter):
     * The map is divided into strategic zones to ensure balanced gameplay.
     * - MID STRIP (rows 11-21, full width): Where main combat happens, includes center arena and side lanes
     * - BACKSIDE ZONES (rows 0-10 top, rows 22-32 bottom): Retreat/spawn areas for both teams
     * Cover must be balanced: too much mid = aggressive/spawn-trappy, too much backside = campy/passive
     * Structure variety is key: mix of small walls, blocky cover, and diagonal/linear elements
     */

    // ===== HELPER FUNCTIONS =====
    const isValid = (row, col) => row >= 0 && row < CANVAS_HEIGHT && col >= 0 && col < CANVAS_WIDTH;

    const getNeighbors4 = (row, col) => {
      return [
        [row-1, col], [row+1, col], [row, col-1], [row, col+1]
      ].filter(([r, c]) => isValid(r, c));
    };

    const getNeighbors8 = (row, col) => {
      return [
        [row-1, col], [row+1, col], [row, col-1], [row, col+1],
        [row-1, col-1], [row-1, col+1], [row+1, col-1], [row+1, col+1]
      ].filter(([r, c]) => isValid(r, c));
    };

    const floodFill = (startRow, startCol, targetType) => {
      const queue = [[startRow, startCol]];
      const visited = new Set();
      const cluster = [];

      while (queue.length > 0) {
        const [row, col] = queue.shift();
        const key = `${row},${col}`;

        if (!isValid(row, col) || visited.has(key) || newTiles[row][col] !== targetType) continue;

        visited.add(key);
        cluster.push([row, col]);

        getNeighbors4(row, col).forEach(([r, c]) => {
          if (!visited.has(`${r},${c}`)) queue.push([r, c]);
        });
      }

      return cluster;
    };

    const applyMirrors = (row, col, type) => {
      const mirrored = [[row, col]];
      const applied = new Set([`${row},${col}`]);

      // Calculate accurate center points for odd dimensions
      const centerRow = (CANVAS_HEIGHT - 1) / 2;  // 16.0 for height 33
      const centerCol = (CANVAS_WIDTH - 1) / 2;   // 10.0 for width 21

      if (mirrorVertical) {
        const mirrorCol = CANVAS_WIDTH - 1 - col;
        const key = `${row},${mirrorCol}`;
        if (isValid(row, mirrorCol) && !applied.has(key)) {
          mirrored.push([row, mirrorCol]);
          applied.add(key);
        }
      }
      if (mirrorHorizontal) {
        const mirrorRow = CANVAS_HEIGHT - 1 - row;
        const key = `${mirrorRow},${col}`;
        if (isValid(mirrorRow, col) && !applied.has(key)) {
          mirrored.push([mirrorRow, col]);
          applied.add(key);
        }
      }
      if (mirrorDiagonal) {
        // 180° rotation around center point
        const mirrorRow = Math.round(2 * centerRow - row);
        const mirrorCol = Math.round(2 * centerCol - col);
        const key = `${mirrorRow},${mirrorCol}`;
        if (isValid(mirrorRow, mirrorCol) && !applied.has(key)) {
          mirrored.push([mirrorRow, mirrorCol]);
          applied.add(key);
        }
      }
      if (mirrorVertical && mirrorHorizontal) {
        const mirrorRow = CANVAS_HEIGHT - 1 - row;
        const mirrorCol = CANVAS_WIDTH - 1 - col;
        const key = `${mirrorRow},${mirrorCol}`;
        if (isValid(mirrorRow, mirrorCol) && !applied.has(key)) {
          mirrored.push([mirrorRow, mirrorCol]);
          applied.add(key);
        }
      }

      mirrored.forEach(([r, c]) => {
        if (isValid(r, c)) newTiles[r][c] = type;
      });

      return mirrored;
    };

    const centerRow = Math.floor(CANVAS_HEIGHT / 2);
    const centerCol = Math.floor(CANVAS_WIDTH / 2);
    const totalTiles = CANVAS_WIDTH * CANVAS_HEIGHT;

    // Map zone helpers
    const MID_STRIP_START = 11;
    const MID_STRIP_END = 21;
    const isInMidStrip = (row) => row >= MID_STRIP_START && row <= MID_STRIP_END;
    const isInBackside = (row) => row < MID_STRIP_START || row > MID_STRIP_END;

    // Structure generation helpers
    const placeLinearWall = (startRow, startCol, length, direction, type) => {
      let placed = [];
      const directions = {
        'horizontal': [0, 1],
        'vertical': [1, 0],
        'diagonal-ne': [-1, 1],
        'diagonal-se': [1, 1]
      };
      const [dr, dc] = directions[direction] || [0, 1];

      for (let i = 0; i < length; i++) {
        const row = startRow + (dr * i);
        const col = startCol + (dc * i);
        if (isValid(row, col) && newTiles[row][col] === null) {
          const mirrored = applyMirrors(row, col, type);
          placed.push(...mirrored);
        }
      }
      return placed;
    };

    const placeBlockyStructure = (startRow, startCol, width, height, type) => {
      let placed = [];
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const row = startRow + r;
          const col = startCol + c;
          if (isValid(row, col) && newTiles[row][col] === null) {
            const mirrored = applyMirrors(row, col, type);
            placed.push(...mirrored);
          }
        }
      }
      return placed;
    };

    const placeCurvyBlob = (startRow, startCol, size, spreadChance, type) => {
      const queue = [[startRow, startCol]];
      const visited = new Set();
      let placed = [];
      let currentSize = 0;

      while (queue.length > 0 && currentSize < size) {
        const [row, col] = queue.shift();
        const key = `${row},${col}`;

        if (!isValid(row, col) || visited.has(key) || newTiles[row][col] !== null) continue;

        visited.add(key);
        const mirrored = applyMirrors(row, col, type);
        placed.push(...mirrored);
        currentSize++;

        const neighbors = getNeighbors4(row, col);
        neighbors.forEach(([r, c]) => {
          if (Math.random() < spreadChance && newTiles[r][c] === null && !visited.has(`${r},${c}`)) {
            queue.push([r, c]);
          }
        });
      }
      return placed;
    };

    // ===== PHASE 1: VARIED STRUCTURE GENERATION =====
    console.log('\n--- PHASE 1: Varied Structure Generation ---');

    const terrainConfigs = [];
    if (wallDensity > 0) terrainConfigs.push({
      type: TERRAIN_TYPES.WALL,
      density: wallDensity,
      name: 'WALL'
    });
    if (waterDensity > 0) terrainConfigs.push({
      type: TERRAIN_TYPES.WATER,
      density: waterDensity,
      name: 'WATER'
    });
    if (grassDensity > 0) terrainConfigs.push({
      type: TERRAIN_TYPES.GRASS,
      density: grassDensity,
      name: 'GRASS'
    });

    terrainConfigs.forEach(({ type, density, name }) => {
      const targetCount = Math.floor((density / 100) * totalTiles);
      let placedCount = 0;

      // Calculate zone-specific allocations (balance mid and backside)
      const midTargetRatio = 0.55;  // 55% in mid strip
      const backsideTargetRatio = 0.45;  // 45% in backside
      let midTarget = Math.floor(targetCount * midTargetRatio);
      let backsideTarget = Math.floor(targetCount * backsideTargetRatio);

      console.log(`  ${name}: target=${targetCount} (mid=${midTarget}, backside=${backsideTarget})`);

      // Structure types distribution for walls (more variety)
      const structureTypes = name === 'WALL'
        ? ['linear', 'linear', 'linear', 'blocky', 'blocky', 'curvy', 'curvy']  // More linear for walls
        : ['curvy', 'curvy', 'blocky', 'linear'];  // Grass/water more organic

      const numStructures = 10 + Math.floor(Math.random() * 15);  // 10-25 structures

      for (let i = 0; i < numStructures && placedCount < targetCount; i++) {
        const structureType = structureTypes[Math.floor(Math.random() * structureTypes.length)];

        // Decide zone based on current balance
        const currentMidRatio = placedCount > 0 ? (midTarget - placedCount) / targetCount : midTargetRatio;
        const placeInMid = Math.random() < currentMidRatio || backsideTarget <= 0;

        let startRow, startCol;
        if (placeInMid) {
          startRow = MID_STRIP_START + Math.floor(Math.random() * (MID_STRIP_END - MID_STRIP_START + 1));
        } else {
          // Place in backside (top or bottom)
          if (Math.random() < 0.5) {
            startRow = Math.floor(Math.random() * MID_STRIP_START);
          } else {
            startRow = MID_STRIP_END + 1 + Math.floor(Math.random() * (CANVAS_HEIGHT - MID_STRIP_END - 1));
          }
        }

        // Adjust for mirror modes
        if (mirrorVertical && !mirrorHorizontal && !mirrorDiagonal) {
          startCol = Math.floor(Math.random() * (CANVAS_WIDTH / 2));
        } else if (mirrorHorizontal && !mirrorVertical && !mirrorDiagonal) {
          if (startRow >= CANVAS_HEIGHT / 2) continue;  // Only generate in top half
        } else if (mirrorVertical && mirrorHorizontal) {
          startCol = Math.floor(Math.random() * (CANVAS_WIDTH / 2));
          if (startRow >= CANVAS_HEIGHT / 2) continue;
        } else {
          startCol = Math.floor(Math.random() * CANVAS_WIDTH);
        }

        if (newTiles[startRow][startCol] !== null) continue;

        let placed = [];

        if (structureType === 'linear') {
          // Linear structures with size limits based on terrain
          let length;
          if (name === 'GRASS') {
            length = 3 + Math.floor(Math.random() * 9); // 3-11 tiles for grass
          } else {
            length = 3 + Math.floor(Math.random() * 7); // 3-9 tiles for walls/water
          }
          const direction = ['horizontal', 'vertical', 'diagonal-ne', 'diagonal-se'][Math.floor(Math.random() * 4)];
          placed = placeLinearWall(startRow, startCol, length, direction, type);
        }
        else if (structureType === 'blocky') {
          // Blocky structures with size limits based on terrain
          let width, height;
          if (name === 'GRASS') {
            width = 2 + Math.floor(Math.random() * 3);  // 2-4 wide for grass
            height = 2 + Math.floor(Math.random() * 3); // 2-4 tall for grass
          } else {
            width = 2 + Math.floor(Math.random() * 2);  // 2-3 wide for walls/water
            height = 2 + Math.floor(Math.random() * 2); // 2-3 tall for walls/water
          }
          placed = placeBlockyStructure(startRow, startCol, width, height, type);
        }
        else {  // curvy
          // Curvy blobs with size limits based on terrain
          let size, spreadChance;
          if (name === 'GRASS') {
            size = 4 + Math.floor(Math.random() * 12);  // 4-15 tiles for grass
            spreadChance = 0.35 + Math.random() * 0.25; // 35-60% spread for grass
          } else {
            size = 4 + Math.floor(Math.random() * 6);   // 4-9 tiles for walls/water
            spreadChance = 0.3 + Math.random() * 0.2;   // 30-50% spread for walls/water (less blobby)
          }
          placed = placeCurvyBlob(startRow, startCol, size, spreadChance, type);
        }

        const actualPlaced = placed.length;
        placedCount += actualPlaced;

        if (placeInMid) {
          midTarget -= actualPlaced;
        } else {
          backsideTarget -= actualPlaced;
        }
      }
      console.log(`  ${name}: placed=${placedCount}`);
    });

    // ===== PHASE 2: GENTLE PROTRUSION CLEANUP =====
    console.log('\n--- PHASE 2: Gentle Protrusion Cleanup ---');
    let protrusionsRemoved = 0;

    // Only remove obvious single-tile protrusions, keep linear structures intact
    for (let pass = 0; pass < 2; pass++) {
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (newTiles[row][col] !== null) {
            const type = newTiles[row][col];
            const neighbors = getNeighbors4(row, col);
            const sameTypeNeighbors = neighbors.filter(([r, c]) => newTiles[r][c] === type);

            // Only remove if tile has exactly 0 neighbors (truly isolated)
            if (sameTypeNeighbors.length === 0) {
              newTiles[row][col] = null;
              protrusionsRemoved++;
            }
          }
        }
      }
    }
    console.log(`  Protrusions removed: ${protrusionsRemoved}`);

    // ===== PHASE 3: MINIMAL GAP FILLING =====
    console.log('\n--- PHASE 3: Minimal Gap Filling ---');
    let gapsFilled = 0;

    // Only 1 pass with strict requirements to avoid over-filling
    for (let pass = 0; pass < 1; pass++) {
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (newTiles[row][col] === null) {
            const neighbors4 = getNeighbors4(row, col);
            const filledNeighbors4 = neighbors4.filter(([r, c]) => newTiles[r][c] !== null);

            // Only fill if ALL 4 orthogonal neighbors are filled AND they're all the same type
            if (filledNeighbors4.length === 4) {
              const terrainCounts = {};
              filledNeighbors4.forEach(([r, c]) => {
                const terrain = newTiles[r][c];
                terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
              });

              // Only fill if there's a clear majority (3+ of same type)
              let mostCommon = null;
              let maxCount = 0;
              Object.entries(terrainCounts).forEach(([terrain, count]) => {
                if (count > maxCount) {
                  maxCount = count;
                  mostCommon = terrain;
                }
              });

              // Only fill if majority is strong (3+ neighbors of same type)
              if (maxCount >= 3) {
                newTiles[row][col] = mostCommon;
                gapsFilled++;
              }
            }
          }
        }
      }
    }
    console.log(`  Gaps filled: ${gapsFilled}`);

    // ===== PHASE 4: MINIMUM FEATURE SIZE ENFORCEMENT =====
    console.log('\n--- PHASE 4: Minimum Feature Size Enforcement ---');
    let clustersRemoved = 0;
    const processed = new Set();

    // Reduced minimum size to allow small linear walls (3+ tiles OK)
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const key = `${row},${col}`;
        if (newTiles[row][col] !== null && !processed.has(key)) {
          const type = newTiles[row][col];
          const cluster = floodFill(row, col, type);

          cluster.forEach(([r, c]) => processed.add(`${r},${c}`));

          // Only remove truly tiny clusters (1-2 tiles)
          if (cluster.length < 3) {
            cluster.forEach(([r, c]) => {
              newTiles[r][c] = null;
            });
            clustersRemoved++;
          }
        }
      }
    }
    console.log(`  Small clusters removed: ${clustersRemoved}`);

    // ===== PHASE 5: TERRAIN-SPECIFIC CLEANUP =====
    console.log('\n--- PHASE 5: Terrain-Specific Cleanup ---');

    // Water thinning
    for (let pass = 0; pass < 2; pass++) {
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (newTiles[row][col] === TERRAIN_TYPES.WATER) {
            const neighbors = getNeighbors4(row, col);
            const waterNeighbors = neighbors.filter(([r, c]) => newTiles[r][c] === TERRAIN_TYPES.WATER);

            if (waterNeighbors.length <= 1) {
              newTiles[row][col] = null;
            }
          }
        }
      }
    }

    // Isolated grass removal
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (newTiles[row][col] === TERRAIN_TYPES.GRASS) {
          const neighbors = getNeighbors4(row, col);
          const grassNeighbors = neighbors.filter(([r, c]) => newTiles[r][c] === TERRAIN_TYPES.GRASS);

          if (grassNeighbors.length === 0) {
            newTiles[row][col] = null;
          }
        }
      }
    }
    console.log('  Terrain-specific cleanup complete');

    // ===== PHASE 6: CONNECTIVITY VERIFICATION (NEW) =====
    console.log('\n--- PHASE 6: Connectivity Verification ---');

    // Find all empty regions
    const emptyRegions = [];
    const emptyProcessed = new Set();

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const key = `${row},${col}`;
        if (newTiles[row][col] === null && !emptyProcessed.has(key)) {
          const region = floodFill(row, col, null);
          region.forEach(([r, c]) => emptyProcessed.add(`${r},${c}`));
          emptyRegions.push(region);
        }
      }
    }

    if (emptyRegions.length > 1) {
      console.log(`  Found ${emptyRegions.length} disconnected regions, connecting...`);
      // Keep the largest region, remove barriers to others
      emptyRegions.sort((a, b) => b.length - a.length);
      const mainRegion = new Set(emptyRegions[0].map(([r, c]) => `${r},${c}`));

      // Simple approach: remove some terrain tiles between regions
      for (let i = 1; i < emptyRegions.length; i++) {
        const region = emptyRegions[i];
        // Find a tile in this region closest to main region
        for (const [row, col] of region) {
          const neighbors = getNeighbors4(row, col);
          for (const [nr, nc] of neighbors) {
            if (newTiles[nr][nc] !== null) {
              newTiles[nr][nc] = null; // Remove barrier
              break;
            }
          }
        }
      }
    } else {
      console.log('  All empty spaces are connected');
    }

    // ===== PHASE 7: SMOOTHING PASS (NEW) =====
    console.log('\n--- PHASE 7: Smoothing Pass ---');
    let smoothingChanges = 0;

    for (let row = 1; row < CANVAS_HEIGHT - 1; row++) {
      for (let col = 1; col < CANVAS_WIDTH - 1; col++) {
        if (newTiles[row][col] !== null) {
          const type = newTiles[row][col];

          // Check for jaggy diagonal-only connections
          const top = newTiles[row - 1][col];
          const bottom = newTiles[row + 1][col];
          const left = newTiles[row][col - 1];
          const right = newTiles[row][col + 1];

          const orthogonalSame = [top, bottom, left, right].filter(t => t === type).length;

          // If no orthogonal neighbors of same type, but has diagonal neighbors, it's jaggy
          if (orthogonalSame === 0) {
            const diagonals = [
              newTiles[row - 1][col - 1],
              newTiles[row - 1][col + 1],
              newTiles[row + 1][col - 1],
              newTiles[row + 1][col + 1]
            ];
            const diagonalSame = diagonals.filter(t => t === type).length;

            if (diagonalSame > 0) {
              newTiles[row][col] = null;
              smoothingChanges++;
            }
          }
        }
      }
    }
    console.log(`  Smoothing changes: ${smoothingChanges}`);

    // ===== PHASE 8: EDGE CLEANUP =====
    console.log('\n--- PHASE 8: Edge Cleanup ---');
    const edgeMargin = 1;
    let edgeCleanups = 0;

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const isNearEdge = row < edgeMargin || row >= CANVAS_HEIGHT - edgeMargin ||
                          col < edgeMargin || col >= CANVAS_WIDTH - edgeMargin;

        if (isNearEdge && newTiles[row][col] !== null) {
          const neighbors = getNeighbors4(row, col);
          const sameTypeNeighbors = neighbors.filter(([r, c]) => newTiles[r][c] === newTiles[row][col]);

          // Remove if not part of 3+ tile structure
          if (sameTypeNeighbors.length < 2) {
            newTiles[row][col] = null;
            edgeCleanups++;
          }
        }
      }
    }
    console.log(`  Edge cleanups: ${edgeCleanups}`);

    // ===== PHASE 9: MIRROR SYNCHRONIZATION (CORRECTED) =====
    console.log('\n--- PHASE 9: Mirror Synchronization ---');

    // Calculate accurate center points for odd dimensions
    const exactCenterRow = (CANVAS_HEIGHT - 1) / 2;  // 16.0 for height 33
    const exactCenterCol = (CANVAS_WIDTH - 1) / 2;   // 10.0 for width 21

    if (mirrorDiagonal) {
      // 180° rotation around exact center point
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const mirrorRow = Math.round(2 * exactCenterRow - row);
          const mirrorCol = Math.round(2 * exactCenterCol - col);

          if (isValid(mirrorRow, mirrorCol) && mirrorRow > row) {
            // Only process each pair once
            if (newTiles[row][col] !== null && newTiles[mirrorRow][mirrorCol] === null) {
              newTiles[mirrorRow][mirrorCol] = newTiles[row][col];
            } else if (newTiles[row][col] === null && newTiles[mirrorRow][mirrorCol] !== null) {
              newTiles[row][col] = newTiles[mirrorRow][mirrorCol];
            }
          }
        }
      }
      console.log('  Diagonal mirror synchronized');
    }

    if (mirrorVertical) {
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < Math.ceil(CANVAS_WIDTH / 2); col++) {
          const mirrorCol = CANVAS_WIDTH - 1 - col;
          if (newTiles[row][col] !== newTiles[row][mirrorCol]) {
            newTiles[row][mirrorCol] = newTiles[row][col];
          }
        }
      }
      console.log('  Vertical mirror synchronized');
    }

    if (mirrorHorizontal) {
      for (let row = 0; row < Math.ceil(CANVAS_HEIGHT / 2); row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const mirrorRow = CANVAS_HEIGHT - 1 - row;
          if (newTiles[row][col] !== newTiles[mirrorRow][col]) {
            newTiles[mirrorRow][col] = newTiles[row][col];
          }
        }
      }
      console.log('  Horizontal mirror synchronized');
    }

    // ===== PHASE 9.5: OTG MARKING & ZONE BALANCE CHECK =====
    console.log('\n--- PHASE 9.5: OTG Marking & Zone Balance ---');

    // Mark OTG areas (example: extreme corners or specific zones)
    // You can customize this based on your map design
    const markOTG = (row, col) => {
      if (isValid(row, col)) {
        newTiles[row][col] = TERRAIN_TYPES.OTG;
      }
    };

    // Example: Mark some corner areas as OTG (customize as needed)
    // For now, we'll leave this minimal - OTG can be added manually via the UI

    // Check if 7x7 mid center (rows 13-19, cols 7-13) is mostly empty
    let midCenterFilled = 0;
    const midCenterArea = 7 * 7;
    for (let row = 13; row <= 19; row++) {
      for (let col = 7; col <= 13; col++) {
        if (newTiles[row][col] !== null && newTiles[row][col] !== TERRAIN_TYPES.OTG) {
          midCenterFilled++;
        }
      }
    }

    const midCenterDensity = midCenterFilled / midCenterArea;
    console.log(`  Mid center (7x7) density: ${(midCenterDensity * 100).toFixed(1)}%`);

    // DISABLED: Phase 9.5 auto-fill has been disabled to prevent oversized structures
    // Users can manually add cover if needed
    console.log('  Zone balance check complete (auto-fill disabled)');

    // ===== PHASE 9.7: STRUCTURE SIZE VALIDATION =====
    console.log('\n--- PHASE 9.7: Structure Size Validation ---');

    // Size limits based on terrain type
    const getSizeLimits = (terrainType) => {
      if (terrainType === TERRAIN_TYPES.GRASS) {
        return { maxLength: 15, maxThickness: 4 };
      } else {
        // Walls and Water
        return { maxLength: 11, maxThickness: 3 };
      }
    };

    // Calculate bounding box dimensions for a cluster
    const getClusterDimensions = (cluster) => {
      let minRow = CANVAS_HEIGHT, maxRow = 0;
      let minCol = CANVAS_WIDTH, maxCol = 0;

      cluster.forEach(([r, c]) => {
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      });

      const width = maxCol - minCol + 1;
      const height = maxRow - minRow + 1;
      const maxDimension = Math.max(width, height);
      const minDimension = Math.min(width, height);

      return { width, height, maxDimension, minDimension, minRow, maxRow, minCol, maxCol };
    };

    // Trim oversized structures by removing edge tiles
    const trimStructure = (cluster, terrainType, limits) => {
      let trimmed = [...cluster];
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const dims = getClusterDimensions(trimmed);

        // Check if within limits
        if (dims.maxDimension <= limits.maxLength && dims.minDimension <= limits.maxThickness) {
          break;
        }

        // Find edge tiles (tiles with fewer neighbors) to remove
        const edgeTiles = trimmed.filter(([row, col]) => {
          const neighbors = getNeighbors4(row, col);
          const sameTypeNeighbors = neighbors.filter(([r, c]) => {
            return trimmed.some(([tr, tc]) => tr === r && tc === c);
          });
          return sameTypeNeighbors.length <= 2; // Edge tiles have 2 or fewer neighbors
        });

        if (edgeTiles.length === 0) break;

        // Remove 20% of edge tiles each iteration
        const toRemove = Math.max(1, Math.floor(edgeTiles.length * 0.2));
        for (let i = 0; i < toRemove && edgeTiles.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * edgeTiles.length);
          const [row, col] = edgeTiles.splice(randomIndex, 1)[0];
          trimmed = trimmed.filter(([r, c]) => !(r === row && c === col));
          newTiles[row][col] = null;
        }

        attempts++;
      }

      return trimmed;
    };

    // Validate all structures
    let oversizedRemoved = 0;
    let oversizedTrimmed = 0;
    const terrainTypes = [TERRAIN_TYPES.WALL, TERRAIN_TYPES.WATER, TERRAIN_TYPES.GRASS];

    for (const terrainType of terrainTypes) {
      const limits = getSizeLimits(terrainType);
      const processedValidation = new Set();

      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const key = `${row},${col}`;
          if (newTiles[row][col] === terrainType && !processedValidation.has(key)) {
            const cluster = floodFill(row, col, terrainType);
            cluster.forEach(([r, c]) => processedValidation.add(`${r},${c}`));

            const dims = getClusterDimensions(cluster);

            // Check if structure exceeds size limits
            if (dims.maxDimension > limits.maxLength || dims.minDimension > limits.maxThickness) {
              console.log(`  Found oversized structure: ${cluster.length} tiles, ` +
                         `${dims.width}x${dims.height} (max=${dims.maxDimension}, thick=${dims.minDimension})`);

              // Try to trim it
              const trimmed = trimStructure(cluster, terrainType, limits);
              const newDims = getClusterDimensions(trimmed);

              // If still too large, remove entirely
              if (newDims.maxDimension > limits.maxLength || newDims.minDimension > limits.maxThickness) {
                console.log(`    Removing oversized structure entirely`);
                cluster.forEach(([r, c]) => {
                  newTiles[r][c] = null;
                });
                oversizedRemoved++;
              } else {
                console.log(`    Trimmed to ${trimmed.length} tiles, ${newDims.width}x${newDims.height}`);
                oversizedTrimmed++;
              }
            }
          }
        }
      }
    }

    console.log(`  Oversized structures trimmed: ${oversizedTrimmed}`);
    console.log(`  Oversized structures removed: ${oversizedRemoved}`);

    // ===== PHASE 10: FINAL VALIDATION =====
    console.log('\n--- PHASE 10: Final Validation ---');

    // Final comprehensive passes to catch any remaining issues
    for (let pass = 0; pass < 2; pass++) {
      let fixedInPass = 0;

      // Check for one-tile gaps
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (newTiles[row][col] === null) {
            const neighbors4 = getNeighbors4(row, col);
            const filledNeighbors = neighbors4.filter(([r, c]) => newTiles[r][c] !== null);

            if (filledNeighbors.length >= 3) {
              const terrainCounts = {};
              filledNeighbors.forEach(([r, c]) => {
                const terrain = newTiles[r][c];
                terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
              });

              let mostCommon = null;
              let maxCount = 0;
              Object.entries(terrainCounts).forEach(([terrain, count]) => {
                if (count > maxCount) {
                  maxCount = count;
                  mostCommon = terrain;
                }
              });

              newTiles[row][col] = mostCommon;
              fixedInPass++;
            }
          }
        }
      }

      // Check for one-tile protrusions
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (newTiles[row][col] !== null) {
            const type = newTiles[row][col];
            const neighbors = getNeighbors4(row, col);
            const sameTypeNeighbors = neighbors.filter(([r, c]) => newTiles[r][c] === type);

            if (sameTypeNeighbors.length === 0) {
              newTiles[row][col] = null;
              fixedInPass++;
            }
          }
        }
      }

      if (fixedInPass > 0) {
        console.log(`  Final validation pass ${pass + 1}: fixed ${fixedInPass} issues`);
      }
    }

    // ===== FINAL STATISTICS =====
    console.log('\n=== GENERATION COMPLETE ===');
    let wallCount = 0, waterCount = 0, grassCount = 0, otgCount = 0, emptyCount = 0;

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const tile = newTiles[row][col];
        if (tile === TERRAIN_TYPES.WALL) wallCount++;
        else if (tile === TERRAIN_TYPES.WATER) waterCount++;
        else if (tile === TERRAIN_TYPES.GRASS) grassCount++;
        else if (tile === TERRAIN_TYPES.OTG) otgCount++;
        else emptyCount++;
      }
    }

    const wallPercent = ((wallCount / totalTiles) * 100).toFixed(1);
    const waterPercent = ((waterCount / totalTiles) * 100).toFixed(1);
    const grassPercent = ((grassCount / totalTiles) * 100).toFixed(1);
    const otgPercent = ((otgCount / totalTiles) * 100).toFixed(1);
    const emptyPercent = ((emptyCount / totalTiles) * 100).toFixed(1);

    console.log(`Final terrain distribution:`);
    console.log(`  WALL: ${wallCount} tiles (${wallPercent}% - target was ${wallDensity}%)`);
    console.log(`  WATER: ${waterCount} tiles (${waterPercent}% - target was ${waterDensity}%)`);
    console.log(`  GRASS: ${grassCount} tiles (${grassPercent}% - target was ${grassDensity}%)`);
    console.log(`  OTG: ${otgCount} tiles (${otgPercent}%)`);
    console.log(`  EMPTY: ${emptyCount} tiles (${emptyPercent}%)`);
    console.log('==========================================\n');

    setTiles(newTiles);
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
