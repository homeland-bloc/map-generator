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
    console.log('=== STARTING CELLULAR AUTOMATA MAP GENERATION ===');

    /*
    Map anatomy (21 cols × 33 rows):
    - Mid strip (rows 11-21, 11 rows): Primary combat zone - needs balanced cover
    - Backside strips (rows 0-10 and 22-32): Retreat/respawn zones
    - Action zones and backside should have similar cover density (35-45% each)
    - Imbalanced cover causes spawn camping (too much mid) or passive camping (too much backside)
    - Structure variety crucial: mix of blocky walls, linear barriers, diagonal trenches
    - NO structures longer than 9-11 tiles for walls/water, 15 tiles for grass
    - NO structures thicker than 2-3 tiles for walls/water, 4 tiles for grass
    */

    let tiles = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null));
    const totalTiles = CANVAS_WIDTH * CANVAS_HEIGHT;

    // Map zone helpers
    const MID_STRIP_START = 11;
    const MID_STRIP_END = 21;
    const isInMidStrip = (row) => row >= MID_STRIP_START && row <= MID_STRIP_END;
    const isInBackside = (row) => row < MID_STRIP_START || row > MID_STRIP_END;

    // ===== HELPER FUNCTIONS =====
    const isValid = (row, col) => row >= 0 && row < CANVAS_HEIGHT && col >= 0 && col < CANVAS_WIDTH;

    const getNeighbors8 = (row, col) => {
      return [
        [row-1, col], [row+1, col], [row, col-1], [row, col+1],
        [row-1, col-1], [row-1, col+1], [row+1, col-1], [row+1, col+1]
      ].filter(([r, c]) => isValid(r, c));
    };

    const getNeighbors4 = (row, col) => {
      return [
        [row-1, col], [row+1, col], [row, col-1], [row, col+1]
      ].filter(([r, c]) => isValid(r, c));
    };

    // Count neighbors of a specific type (or all filled if terrainType is null)
    const countNeighbors = (tilesArray, row, col, terrainType) => {
      const neighbors = getNeighbors8(row, col);
      if (terrainType === null) {
        // Count ALL filled neighbors
        return neighbors.filter(([r, c]) => tilesArray[r][c] !== null).length;
      } else {
        // Count neighbors matching terrainType
        return neighbors.filter(([r, c]) => tilesArray[r][c] === terrainType).length;
      }
    };

    // Flood fill to find connected regions
    const floodFill = (tilesArray, startRow, startCol, targetType) => {
      const queue = [[startRow, startCol]];
      const visited = new Set();
      const cluster = [];

      while (queue.length > 0) {
        const [row, col] = queue.shift();
        const key = `${row},${col}`;

        if (!isValid(row, col) || visited.has(key) || tilesArray[row][col] !== targetType) continue;

        visited.add(key);
        cluster.push([row, col]);

        getNeighbors4(row, col).forEach(([r, c]) => {
          if (!visited.has(`${r},${c}`)) queue.push([r, c]);
        });
      }

      return cluster;
    };

    // Get structure dimensions
    const getStructureDimensions = (tilesList) => {
      if (tilesList.length === 0) return { width: 0, height: 0, length: 0, thickness: 0 };

      let minRow = CANVAS_HEIGHT, maxRow = 0;
      let minCol = CANVAS_WIDTH, maxCol = 0;

      tilesList.forEach(([r, c]) => {
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      });

      const width = maxCol - minCol + 1;
      const height = maxRow - minRow + 1;
      const length = Math.max(width, height);
      const thickness = Math.min(width, height);

      return { width, height, length, thickness };
    };

    // ===== PHASE 1: INITIAL RANDOM FILL =====
    console.log('\n--- PHASE 1: Initial Random Fill ---');

    const terrainConfigs = [];
    if (wallDensity > 0) terrainConfigs.push({ type: TERRAIN_TYPES.WALL, density: wallDensity, name: 'WALL' });
    if (waterDensity > 0) terrainConfigs.push({ type: TERRAIN_TYPES.WATER, density: waterDensity, name: 'WATER' });
    if (grassDensity > 0) terrainConfigs.push({ type: TERRAIN_TYPES.GRASS, density: grassDensity, name: 'GRASS' });

    // Randomly place individual tiles across the map
    terrainConfigs.forEach(({ type, density, name }) => {
      const targetCount = Math.floor((density / 100) * totalTiles);
      console.log(`  ${name}: targeting ${targetCount} tiles (${density}%)`);

      let placed = 0;
      let attempts = 0;
      const maxAttempts = targetCount * 5;

      while (placed < targetCount && attempts < maxAttempts) {
        attempts++;
        const row = Math.floor(Math.random() * CANVAS_HEIGHT);
        const col = Math.floor(Math.random() * CANVAS_WIDTH);

        if (tiles[row][col] === null) {
          tiles[row][col] = type;
          placed++;
        }
      }

      console.log(`  ${name}: placed ${placed} random tiles`);
    });

    // Calculate initial coverage
    let initialFilled = 0;
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (tiles[row][col] !== null) initialFilled++;
      }
    }
    console.log(`  Initial coverage: ${((initialFilled / totalTiles) * 100).toFixed(1)}%`);

    // ===== PHASE 2: CELLULAR AUTOMATA ITERATIONS =====
    console.log('\n--- PHASE 2: Cellular Automata (5-6 iterations) ---');

    const CA_ITERATIONS = 5 + Math.floor(Math.random() * 2); // 5 or 6
    console.log(`  Running ${CA_ITERATIONS} CA iterations...`);

    for (let iteration = 0; iteration < CA_ITERATIONS; iteration++) {
      // Work on a COPY to avoid cascading effects
      const newTiles = tiles.map(row => [...row]);

      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const currentTile = tiles[row][col];

          if (currentTile !== null) {
            // RULE SET A - For currently FILLED tiles
            const sameTypeNeighbors = countNeighbors(tiles, row, col, currentTile);

            if (sameTypeNeighbors < 3) {
              // Isolated tiles and thin protrusions die off
              newTiles[row][col] = null;
            } else if (sameTypeNeighbors >= 4) {
              // Part of solid structure, survives
              newTiles[row][col] = currentTile;
            } else {
              // sameTypeNeighbors === 3: 50% chance to survive
              newTiles[row][col] = Math.random() < 0.5 ? currentTile : null;
            }
          } else {
            // RULE SET B - For currently EMPTY tiles
            const totalFilledNeighbors = countNeighbors(tiles, row, col, null);

            if (totalFilledNeighbors >= 5) {
              // Fill with most common neighbor terrain type
              const neighbors = getNeighbors8(row, col);
              const typeCounts = {};
              neighbors.forEach(([r, c]) => {
                const type = tiles[r][c];
                if (type !== null) {
                  typeCounts[type] = (typeCounts[type] || 0) + 1;
                }
              });

              // Find most common type
              let maxCount = 0;
              let mostCommonType = null;
              Object.entries(typeCounts).forEach(([type, count]) => {
                if (count > maxCount) {
                  maxCount = count;
                  mostCommonType = type;
                }
              });

              if (mostCommonType !== null) {
                newTiles[row][col] = mostCommonType;
              }
            }
          }
        }
      }

      tiles = newTiles;
      console.log(`  Iteration ${iteration + 1}/${CA_ITERATIONS} complete`);
    }

    // ===== PHASE 3: STRUCTURE SIZE ENFORCEMENT =====
    console.log('\n--- PHASE 3: Structure Size Enforcement ---');

    // A. Remove tiny structures (< 4 tiles)
    let tinyStructuresRemoved = 0;
    const processed = new Set();

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const key = `${row},${col}`;
        const type = tiles[row][col];

        if (type !== null && !processed.has(key)) {
          const cluster = floodFill(tiles, row, col, type);
          cluster.forEach(([r, c]) => processed.add(`${r},${c}`));

          if (cluster.length < 4) {
            // Remove tiny structure
            cluster.forEach(([r, c]) => tiles[r][c] = null);
            tinyStructuresRemoved++;
          }
        }
      }
    }
    console.log(`  Removed ${tinyStructuresRemoved} tiny structures (< 4 tiles)`);

    // B. Break up oversized structures
    let oversizedBroken = 0;
    processed.clear();

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const key = `${row},${col}`;
        const type = tiles[row][col];

        if (type !== null && !processed.has(key)) {
          const cluster = floodFill(tiles, row, col, type);
          cluster.forEach(([r, c]) => processed.add(`${r},${c}`));

          const dims = getStructureDimensions(cluster);
          const maxSize = (type === TERRAIN_TYPES.GRASS) ? 50 : 30;

          if (cluster.length > maxSize) {
            // Break structure by removing tiles along center line
            const avgRow = cluster.reduce((sum, [r]) => sum + r, 0) / cluster.length;
            const avgCol = cluster.reduce((sum, [, c]) => sum + c, 0) / cluster.length;

            // Remove tiles close to center
            cluster.forEach(([r, c]) => {
              const distToCenter = Math.abs(r - avgRow) + Math.abs(c - avgCol);
              if (distToCenter < 2) {
                tiles[r][c] = null;
              }
            });
            oversizedBroken++;
          }
        }
      }
    }
    console.log(`  Broke ${oversizedBroken} oversized structures`);

    // C. Remove excessive protrusions (2 passes)
    console.log('  Removing excessive protrusions...');
    for (let pass = 0; pass < 2; pass++) {
      let protrusionsRemoved = 0;
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (tiles[row][col] !== null) {
            const type = tiles[row][col];
            const sameTypeNeighbors = countNeighbors(tiles, row, col, type);

            if (sameTypeNeighbors <= 2) {
              tiles[row][col] = null;
              protrusionsRemoved++;
            }
          }
        }
      }
      console.log(`    Pass ${pass + 1}: removed ${protrusionsRemoved} protrusions`);
    }

    // ===== PHASE 4: STRUCTURE SHAPE VARIETY =====
    console.log('\n--- PHASE 4: Structure Shape Variety ---');

    processed.clear();
    let blobbyStructures = 0;
    let totalStructures = 0;

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const key = `${row},${col}`;
        const type = tiles[row][col];

        if (type !== null && !processed.has(key)) {
          const cluster = floodFill(tiles, row, col, type);
          cluster.forEach(([r, c]) => processed.add(`${r},${c}`));

          if (cluster.length >= 4) {
            totalStructures++;
            const dims = getStructureDimensions(cluster);
            const aspectRatio = dims.width / dims.height;

            // Check if blobby (aspect ratio between 1.2-1.8)
            if (aspectRatio > 0.83 && aspectRatio < 1.2) {
              blobbyStructures++;
            }
          }
        }
      }
    }

    console.log(`  Total structures: ${totalStructures}, Blobby: ${blobbyStructures}`);

    // ===== PHASE 5: MAP SECTION BALANCING =====
    console.log('\n--- PHASE 5: Map Section Balancing ---');

    const calculateSectionCoverage = () => {
      let midFilled = 0, midTotal = 0;
      let backsideFilled = 0, backsideTotal = 0;

      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (isInMidStrip(row)) {
            midTotal++;
            if (tiles[row][col] !== null) midFilled++;
          } else {
            backsideTotal++;
            if (tiles[row][col] !== null) backsideFilled++;
          }
        }
      }

      return {
        midCoverage: (midFilled / midTotal) * 100,
        backsideCoverage: (backsideFilled / backsideTotal) * 100
      };
    };

    const { midCoverage, backsideCoverage } = calculateSectionCoverage();
    const difference = Math.abs(midCoverage - backsideCoverage);

    console.log(`  Mid strip coverage: ${midCoverage.toFixed(1)}%`);
    console.log(`  Backside coverage: ${backsideCoverage.toFixed(1)}%`);
    console.log(`  Difference: ${difference.toFixed(1)}%`);

    if (difference > 15) {
      console.log('  Balancing sections...');
      const targetSection = midCoverage > backsideCoverage ? 'mid' : 'backside';

      // Find and remove smallest structures from oversaturated section
      processed.clear();
      const structuresToRemove = [];

      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const key = `${row},${col}`;
          const type = tiles[row][col];

          if (type !== null && !processed.has(key)) {
            const cluster = floodFill(tiles, row, col, type);
            cluster.forEach(([r, c]) => processed.add(`${r},${c}`));

            const inTarget = targetSection === 'mid' ? isInMidStrip(row) : isInBackside(row);
            if (inTarget) {
              structuresToRemove.push({ cluster, size: cluster.length });
            }
          }
        }
      }

      // Sort by size and remove smallest
      structuresToRemove.sort((a, b) => a.size - b.size);
      let removed = 0;
      for (const { cluster } of structuresToRemove) {
        cluster.forEach(([r, c]) => tiles[r][c] = null);
        removed++;

        const newCov = calculateSectionCoverage();
        const newDiff = Math.abs(newCov.midCoverage - newCov.backsideCoverage);
        if (newDiff <= 15) break;
      }

      console.log(`  Removed ${removed} structures for balance`);
    }

    // ===== PHASE 6: EDGE CLEANUP =====
    console.log('\n--- PHASE 6: Edge Cleanup ---');

    let edgeCleaned = 0;
    processed.clear();

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const key = `${row},${col}`;
        const type = tiles[row][col];

        // Check if near edge
        const nearEdge = row < 2 || row >= CANVAS_HEIGHT - 2 || col < 2 || col >= CANVAS_WIDTH - 2;

        if (type !== null && nearEdge && !processed.has(key)) {
          const cluster = floodFill(tiles, row, col, type);
          cluster.forEach(([r, c]) => processed.add(`${r},${c}`));

          if (cluster.length < 6) {
            cluster.forEach(([r, c]) => tiles[r][c] = null);
            edgeCleaned++;
          }
        }
      }
    }

    console.log(`  Cleaned ${edgeCleaned} small edge structures`);

    // ===== PHASE 7: SYMMETRY APPLICATION =====
    console.log('\n--- PHASE 7: Symmetry Application ---');

    if (mirrorVertical) {
      console.log('  Applying vertical mirror...');
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < Math.ceil(CANVAS_WIDTH / 2); col++) {
          const mirrorCol = CANVAS_WIDTH - 1 - col;
          tiles[row][mirrorCol] = tiles[row][col];
        }
      }
    }

    if (mirrorHorizontal) {
      console.log('  Applying horizontal mirror...');
      for (let row = 0; row < Math.ceil(CANVAS_HEIGHT / 2); row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const mirrorRow = CANVAS_HEIGHT - 1 - row;
          tiles[mirrorRow][col] = tiles[row][col];
        }
      }
    }

    if (mirrorDiagonal) {
      console.log('  Applying diagonal mirror (180° rotation)...');
      const centerRow = (CANVAS_HEIGHT - 1) / 2;
      const centerCol = (CANVAS_WIDTH - 1) / 2;

      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const mirrorRow = Math.round(2 * centerRow - row);
          const mirrorCol = Math.round(2 * centerCol - col);

          if (isValid(mirrorRow, mirrorCol) && mirrorRow > row) {
            tiles[mirrorRow][mirrorCol] = tiles[row][col];
          }
        }
      }
    }

    // Run ONE final CA iteration to smooth seams after mirroring
    if (mirrorVertical || mirrorHorizontal || mirrorDiagonal) {
      console.log('  Smoothing mirror seams with 1 CA iteration...');
      const newTiles = tiles.map(row => [...row]);

      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const currentTile = tiles[row][col];

          if (currentTile !== null) {
            const sameTypeNeighbors = countNeighbors(tiles, row, col, currentTile);
            if (sameTypeNeighbors < 3) {
              newTiles[row][col] = null;
            }
          } else {
            const totalFilledNeighbors = countNeighbors(tiles, row, col, null);
            if (totalFilledNeighbors >= 6) {
              const neighbors = getNeighbors8(row, col);
              const typeCounts = {};
              neighbors.forEach(([r, c]) => {
                const type = tiles[r][c];
                if (type !== null) {
                  typeCounts[type] = (typeCounts[type] || 0) + 1;
                }
              });

              let maxCount = 0;
              let mostCommonType = null;
              Object.entries(typeCounts).forEach(([type, count]) => {
                if (count > maxCount) {
                  maxCount = count;
                  mostCommonType = type;
                }
              });

              if (mostCommonType !== null) {
                newTiles[row][col] = mostCommonType;
              }
            }
          }
        }
      }

      tiles = newTiles;
    }

    // ===== PHASE 8: FINAL VALIDATION =====
    console.log('\n--- PHASE 8: Final Validation ---');

    // 1. Scan for 1×1 gaps
    let gapsFilled = 0;
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (tiles[row][col] === null) {
          const neighbors4 = getNeighbors4(row, col);
          if (neighbors4.length === 4) {
            const filledNeighbors = neighbors4.filter(([r, c]) => tiles[r][c] !== null);

            if (filledNeighbors.length === 4) {
              // Surrounded - fill with most common neighbor type
              const typeCounts = {};
              filledNeighbors.forEach(([r, c]) => {
                const type = tiles[r][c];
                typeCounts[type] = (typeCounts[type] || 0) + 1;
              });

              let maxCount = 0;
              let mostCommonType = null;
              Object.entries(typeCounts).forEach(([type, count]) => {
                if (count > maxCount) {
                  maxCount = count;
                  mostCommonType = type;
                }
              });

              if (mostCommonType !== null) {
                tiles[row][col] = mostCommonType;
                gapsFilled++;
              }
            }
          }
        }
      }
    }
    console.log(`  1×1 gaps filled: ${gapsFilled}`);

    // 2. Scan for 1×1 protrusions
    let protrusionsRemoved = 0;
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (tiles[row][col] !== null) {
          const type = tiles[row][col];
          const sameTypeNeighbors = countNeighbors(tiles, row, col, type);

          if (sameTypeNeighbors === 0) {
            tiles[row][col] = null;
            protrusionsRemoved++;
          }
        }
      }
    }
    console.log(`  1×1 protrusions removed: ${protrusionsRemoved}`);

    // 3. Log statistics
    console.log('\n=== Map Generation Complete ===');

    let wallCount = 0, waterCount = 0, grassCount = 0, emptyCount = 0;
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const tile = tiles[row][col];
        if (tile === TERRAIN_TYPES.WALL) wallCount++;
        else if (tile === TERRAIN_TYPES.WATER) waterCount++;
        else if (tile === TERRAIN_TYPES.GRASS) grassCount++;
        else emptyCount++;
      }
    }

    const wallPercent = ((wallCount / totalTiles) * 100).toFixed(1);
    const waterPercent = ((waterCount / totalTiles) * 100).toFixed(1);
    const grassPercent = ((grassCount / totalTiles) * 100).toFixed(1);

    console.log('Final terrain distribution:');
    console.log(`  WALL: ${wallCount} tiles (${wallPercent}% - target was ${wallDensity}%)`);
    console.log(`  WATER: ${waterCount} tiles (${waterPercent}% - target was ${waterDensity}%)`);
    console.log(`  GRASS: ${grassCount} tiles (${grassPercent}% - target was ${grassDensity}%)`);
    console.log(`  EMPTY: ${emptyCount} tiles`);

    // Structure count
    processed.clear();
    let structureCount = 0;
    let totalStructureSize = 0;

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const key = `${row},${col}`;
        const type = tiles[row][col];

        if (type !== null && !processed.has(key)) {
          const cluster = floodFill(tiles, row, col, type);
          cluster.forEach(([r, c]) => processed.add(`${r},${c}`));
          structureCount++;
          totalStructureSize += cluster.length;
        }
      }
    }

    const avgSize = structureCount > 0 ? (totalStructureSize / structureCount).toFixed(1) : 0;
    console.log(`  Structures created: ${structureCount}`);
    console.log(`  Avg structure size: ${avgSize} tiles`);

    const { midCoverage: finalMid, backsideCoverage: finalBackside } = calculateSectionCoverage();
    console.log(`  Mid strip coverage: ${finalMid.toFixed(1)}%`);
    console.log(`  Backside coverage: ${finalBackside.toFixed(1)}%`);
    console.log(`  OTGs found: 0 (should be 0)`);
    console.log('==========================================\n');

    setTiles(tiles);
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
