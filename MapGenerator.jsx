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
    console.log('=== STARTING SEED & GROW MAP GENERATION ===');
    const newTiles = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null));

    /*
     * MAP LAYOUT ZONES (21x33 grid for 3v3 shooter):
     * The map is divided into strategic zones to ensure balanced gameplay.
     * - MID STRIP (rows 11-21, full width): Where main combat happens, includes center arena and side lanes
     * - BACKSIDE ZONES (rows 0-10 top, rows 22-32 bottom): Retreat/spawn areas for both teams
     * Cover must be balanced: too much mid = aggressive/spawn-trappy, too much backside = campy/passive
     *
     * SEED & GROW ALGORITHM:
     * 1. Place individual 1x1 seeds with OTG prevention
     * 2. Grow each seed with personality (LINEAR/BLOCKY/DIAGONAL/CURVY)
     * 3. Balance coverage between map sections
     * 4. Final validation and cleanup
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

    // Get structure dimensions
    const getStructureDimensions = (tiles) => {
      if (tiles.length === 0) return { width: 0, height: 0, length: 0, thickness: 0 };

      let minRow = CANVAS_HEIGHT, maxRow = 0;
      let minCol = CANVAS_WIDTH, maxCol = 0;

      tiles.forEach(([r, c]) => {
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

    // Check if placing a tile would create OTG (Only Touching Ground)
    const wouldCreateOTG = (row, col, type) => {
      // A tile is OTG if it has no orthogonal neighbors of the same type
      // Check current tile placement
      const neighbors4 = getNeighbors4(row, col);
      const sameTypeNeighbors = neighbors4.filter(([r, c]) => newTiles[r][c] === type);

      if (sameTypeNeighbors.length < 1) {
        // Would be isolated - this is OTG
        return true;
      }

      // Check if placing here would create squeeze between different terrains
      // If both north+south OR east+west are filled with different terrain, reject
      const north = isValid(row-1, col) ? newTiles[row-1][col] : undefined;
      const south = isValid(row+1, col) ? newTiles[row+1][col] : undefined;
      const east = isValid(row, col+1) ? newTiles[row][col+1] : undefined;
      const west = isValid(row, col-1) ? newTiles[row][col-1] : undefined;

      if (north !== null && north !== type && south !== null && south !== type) {
        return true; // Squeeze vertically
      }
      if (east !== null && east !== type && west !== null && west !== type) {
        return true; // Squeeze horizontally
      }

      // Check if any adjacent empty tile would become OTG
      const emptyNeighbors = neighbors4.filter(([r, c]) => newTiles[r][c] === null);
      for (const [nr, nc] of emptyNeighbors) {
        const neighborNeighbors = getNeighbors4(nr, nc);
        const filledNeighbors = neighborNeighbors.filter(([r, c]) => {
          if (r === row && c === col) return true; // Count our proposed tile
          return newTiles[r][c] !== null;
        });

        // If this empty neighbor would have 3+ filled neighbors of different types, it's a problem
        if (filledNeighbors.length >= 3) {
          const types = new Set();
          filledNeighbors.forEach(([r, c]) => {
            if (r === row && c === col) {
              types.add(type);
            } else {
              types.add(newTiles[r][c]);
            }
          });
          if (types.size > 1) {
            return true; // Would create potential OTG pocket
          }
        }
      }

      return false;
    };

    const centerRow = Math.floor(CANVAS_HEIGHT / 2);
    const centerCol = Math.floor(CANVAS_WIDTH / 2);
    const totalTiles = CANVAS_WIDTH * CANVAS_HEIGHT;

    // Map zone helpers
    const MID_STRIP_START = 11;
    const MID_STRIP_END = 21;
    const isInMidStrip = (row) => row >= MID_STRIP_START && row <= MID_STRIP_END;
    const isInBackside = (row) => row < MID_STRIP_START || row > MID_STRIP_END;

    // Track coverage by section
    const sectionCoverage = {
      mid: { wall: 0, water: 0, grass: 0, total: 0 },
      backside: { wall: 0, water: 0, grass: 0, total: 0 }
    };

    const updateSectionCoverage = (row, col, type) => {
      const section = isInMidStrip(row) ? 'mid' : 'backside';
      if (type === TERRAIN_TYPES.WALL) sectionCoverage[section].wall++;
      else if (type === TERRAIN_TYPES.WATER) sectionCoverage[section].water++;
      else if (type === TERRAIN_TYPES.GRASS) sectionCoverage[section].grass++;
      sectionCoverage[section].total++;
    };

    const getSectionDensity = (section) => {
      const sectionTiles = section === 'mid'
        ? (MID_STRIP_END - MID_STRIP_START + 1) * CANVAS_WIDTH
        : ((MID_STRIP_START) + (CANVAS_HEIGHT - MID_STRIP_END - 1)) * CANVAS_WIDTH;
      return (sectionCoverage[section].total / sectionTiles) * 100;
    };

    // ===== PHASE 1: SEED PLACEMENT =====
    console.log('\n--- PHASE 1: Seed Placement ---');

    // Calculate target tile counts from density sliders
    const terrainConfigs = [];
    if (wallDensity > 0) terrainConfigs.push({
      type: TERRAIN_TYPES.WALL,
      density: wallDensity,
      name: 'WALL',
      maxLength: 9 + Math.floor(Math.random() * 3), // 9-11
      maxThickness: 2 + Math.floor(Math.random() * 2) // 2-3
    });
    if (waterDensity > 0) terrainConfigs.push({
      type: TERRAIN_TYPES.WATER,
      density: waterDensity,
      name: 'WATER',
      maxLength: 9 + Math.floor(Math.random() * 3), // 9-11
      maxThickness: 2 + Math.floor(Math.random() * 2) // 2-3
    });
    if (grassDensity > 0) terrainConfigs.push({
      type: TERRAIN_TYPES.GRASS,
      density: grassDensity,
      name: 'GRASS',
      maxLength: 15,
      maxThickness: 4
    });

    // Store all seeds for Phase 2 growth
    const allSeeds = [];

    // Place seeds for each terrain type
    terrainConfigs.forEach(({ type, density, name, maxLength, maxThickness }) => {
      const targetCount = Math.floor((density / 100) * totalTiles);
      console.log(`  ${name}: target=${targetCount} tiles`);

      let attempts = 0;
      let placed = 0;
      const maxAttempts = targetCount * 5; // Try harder to place seeds

      while (placed < targetCount && attempts < maxAttempts) {
        attempts++;

        // Pick random location
        let row, col;

        // Adjust for mirror modes
        if (mirrorVertical && !mirrorHorizontal && !mirrorDiagonal) {
          row = Math.floor(Math.random() * CANVAS_HEIGHT);
          col = Math.floor(Math.random() * (CANVAS_WIDTH / 2));
        } else if (mirrorHorizontal && !mirrorVertical && !mirrorDiagonal) {
          row = Math.floor(Math.random() * (CANVAS_HEIGHT / 2));
          col = Math.floor(Math.random() * CANVAS_WIDTH);
        } else if (mirrorVertical && mirrorHorizontal) {
          row = Math.floor(Math.random() * (CANVAS_HEIGHT / 2));
          col = Math.floor(Math.random() * (CANVAS_WIDTH / 2));
        } else {
          row = Math.floor(Math.random() * CANVAS_HEIGHT);
          col = Math.floor(Math.random() * CANVAS_WIDTH);
        }

        // Check if location is already occupied
        if (newTiles[row][col] !== null) continue;

        // Check all 4 orthogonal neighbors - skip if ANY neighbor is different terrain
        const neighbors4 = getNeighbors4(row, col);
        let safe = true;
        for (const [nr, nc] of neighbors4) {
          if (newTiles[nr][nc] !== null && newTiles[nr][nc] !== type) {
            safe = false;
            break;
          }
        }

        if (!safe) continue;

        // Check section saturation (balance mid vs backside)
        const section = isInMidStrip(row) ? 'mid' : 'backside';
        const sectionDensity = getSectionDensity(section);
        if (sectionDensity > 50) continue; // Don't over-saturate any section

        // Place seed with mirrors
        const mirrored = applyMirrors(row, col, type);
        mirrored.forEach(([r, c]) => {
          updateSectionCoverage(r, c, type);
        });

        // Store seed for growth
        allSeeds.push({
          tiles: [[row, col]],
          type,
          maxLength,
          maxThickness,
          personality: null // Will be assigned in Phase 2
        });

        placed += mirrored.length;
      }

      console.log(`  ${name}: placed ${placed} seed tiles in ${allSeeds.filter(s => s.type === type).length} seeds`);
    });

    // ===== PHASE 2: CONTROLLED GROWTH =====
    console.log('\n--- PHASE 2: Controlled Growth with Personalities ---');

    // Shuffle seeds for random growth order
    for (let i = allSeeds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allSeeds[i], allSeeds[j]] = [allSeeds[j], allSeeds[i]];
    }

    // Assign personalities to seeds
    const personalities = ['LINEAR', 'LINEAR', 'LINEAR', 'BLOCKY', 'BLOCKY', 'DIAGONAL', 'DIAGONAL', 'CURVY', 'CURVY'];
    allSeeds.forEach(seed => {
      seed.personality = personalities[Math.floor(Math.random() * personalities.length)];
    });

    let structuresGrown = 0;
    let totalTilesGrown = 0;

    // Grow each seed
    allSeeds.forEach((seed, seedIndex) => {
      const { type, maxLength, maxThickness, personality } = seed;
      let currentTiles = [...seed.tiles];
      let grownThisSeed = 0;

      // Direction state for LINEAR and CURVY
      let direction = ['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)];
      let curvyStep = 0;

      // Growth loop - grow 1 tile at a time
      for (let growthAttempt = 0; growthAttempt < 50; growthAttempt++) {
        // Check current size
        const dims = getStructureDimensions(currentTiles);
        if (dims.length >= maxLength || dims.thickness >= maxThickness) {
          break; // Hit size limit
        }

        // Check section saturation
        const sampleTile = currentTiles[0];
        const section = isInMidStrip(sampleTile[0]) ? 'mid' : 'backside';
        const sectionDensity = getSectionDensity(section);
        if (sectionDensity > 50) {
          break; // Section too full
        }

        // Find candidate tiles based on personality
        let candidates = [];

        if (personality === 'LINEAR') {
          // Extend in one direction, 2 tiles thick max
          const directionMap = {
            north: [-1, 0],
            south: [1, 0],
            east: [0, 1],
            west: [0, -1]
          };
          const [dr, dc] = directionMap[direction];

          // Find edge tiles in growth direction
          currentTiles.forEach(([row, col]) => {
            const nextRow = row + dr;
            const nextCol = col + dc;
            if (isValid(nextRow, nextCol) && newTiles[nextRow][nextCol] === null) {
              candidates.push([nextRow, nextCol]);
            }
          });

          // Also allow perpendicular growth for thickness (up to 2)
          if (dims.thickness < 2) {
            const perpDirs = direction === 'north' || direction === 'south'
              ? [[0, -1], [0, 1]]
              : [[-1, 0], [1, 0]];

            currentTiles.forEach(([row, col]) => {
              perpDirs.forEach(([dr2, dc2]) => {
                const nextRow = row + dr2;
                const nextCol = col + dc2;
                if (isValid(nextRow, nextCol) && newTiles[nextRow][nextCol] === null) {
                  candidates.push([nextRow, nextCol]);
                }
              });
            });
          }
        } else if (personality === 'BLOCKY') {
          // Grow in a boxy shape - extend along one axis, then switch
          const growHorizontal = growthAttempt % 8 < 4;

          currentTiles.forEach(([row, col]) => {
            if (growHorizontal) {
              [[row, col - 1], [row, col + 1]].forEach(([r, c]) => {
                if (isValid(r, c) && newTiles[r][c] === null) {
                  candidates.push([r, c]);
                }
              });
            } else {
              [[row - 1, col], [row + 1, col]].forEach(([r, c]) => {
                if (isValid(r, c) && newTiles[r][c] === null) {
                  candidates.push([r, c]);
                }
              });
            }
          });
        } else if (personality === 'DIAGONAL') {
          // Expand NE/NW/SE/SW in stair-step
          const diagonalDir = [[1, 1], [1, -1], [-1, 1], [-1, -1]][Math.floor(Math.random() * 4)];
          const [dr, dc] = diagonalDir;

          currentTiles.forEach(([row, col]) => {
            // Diagonal step: place tile at diagonal, and one adjacent
            const diagRow = row + dr;
            const diagCol = col + dc;
            if (isValid(diagRow, diagCol) && newTiles[diagRow][diagCol] === null) {
              candidates.push([diagRow, diagCol]);
            }
            // Also adjacent in one axis
            if (Math.random() < 0.5) {
              if (isValid(row + dr, col) && newTiles[row + dr][col] === null) {
                candidates.push([row + dr, col]);
              }
            } else {
              if (isValid(row, col + dc) && newTiles[row][col + dc] === null) {
                candidates.push([row, col + dc]);
              }
            }
          });
        } else if (personality === 'CURVY') {
          // Gradually shift direction (N→NE→E)
          const curveSequence = [
            [-1, 0],  // N
            [-1, 1],  // NE
            [0, 1],   // E
            [1, 1],   // SE
            [1, 0],   // S
            [1, -1],  // SW
            [0, -1],  // W
            [-1, -1]  // NW
          ];
          const curveIndex = curvyStep % curveSequence.length;
          const [dr, dc] = curveSequence[curveIndex];
          curvyStep++;

          currentTiles.forEach(([row, col]) => {
            const nextRow = row + dr;
            const nextCol = col + dc;
            if (isValid(nextRow, nextCol) && newTiles[nextRow][nextCol] === null) {
              candidates.push([nextRow, nextCol]);
            }
          });
        }

        // Remove duplicates
        candidates = candidates.filter((c, i, arr) =>
          arr.findIndex(([r, c2]) => r === c[0] && c2 === c[1]) === i
        );

        // Validate candidates
        let placed = false;
        for (const [candRow, candCol] of candidates) {
          // A. OTG Prevention Check
          if (wouldCreateOTG(candRow, candCol, type)) {
            continue;
          }

          // B. Size Limit Check (already checked above, but verify after placement)
          const testTiles = [...currentTiles, [candRow, candCol]];
          const testDims = getStructureDimensions(testTiles);
          if (testDims.length > maxLength || testDims.thickness > maxThickness) {
            continue;
          }

          // C. All checks passed - place tile
          const mirrored = applyMirrors(candRow, candCol, type);
          mirrored.forEach(([r, c]) => {
            currentTiles.push([r, c]);
            updateSectionCoverage(r, c, type);
          });
          grownThisSeed += mirrored.length;
          placed = true;
          break;
        }

        if (!placed) {
          break; // Can't grow anymore
        }
      }

      if (grownThisSeed > 0) {
        structuresGrown++;
        totalTilesGrown += grownThisSeed;
      }
    });

    console.log(`  Structures grown: ${structuresGrown}`);
    console.log(`  Total tiles added: ${totalTilesGrown}`);

    // ===== PHASE 3: MAP SECTION BALANCING =====
    console.log('\n--- PHASE 3: Map Section Balancing ---');

    const midDensity = getSectionDensity('mid');
    const backsideDensity = getSectionDensity('backside');
    const densityDiff = Math.abs(midDensity - backsideDensity);

    console.log(`  Mid strip coverage: ${midDensity.toFixed(1)}%`);
    console.log(`  Backside coverage: ${backsideDensity.toFixed(1)}%`);
    console.log(`  Difference: ${densityDiff.toFixed(1)}%`);

    // Check if sections are balanced (35-45% each, < 15% difference)
    if (midDensity < 35 || midDensity > 45) {
      console.log(`  WARNING: Mid strip density ${midDensity.toFixed(1)}% is outside target range (35-45%)`);
    }
    if (backsideDensity < 35 || backsideDensity > 45) {
      console.log(`  WARNING: Backside density ${backsideDensity.toFixed(1)}% is outside target range (35-45%)`);
    }
    if (densityDiff > 15) {
      console.log(`  WARNING: Section density difference ${densityDiff.toFixed(1)}% exceeds 15%`);
    }

    // If imbalanced, remove excess from over-saturated section
    let balanceRemovals = 0;
    if (densityDiff > 15) {
      const overSaturatedSection = midDensity > backsideDensity ? 'mid' : 'backside';
      console.log(`  Removing excess from ${overSaturatedSection} section...`);

      // Find and remove edge tiles from oversaturated section
      for (let pass = 0; pass < 3; pass++) {
        for (let row = 0; row < CANVAS_HEIGHT; row++) {
          const inTargetSection = overSaturatedSection === 'mid'
            ? isInMidStrip(row)
            : isInBackside(row);

          if (!inTargetSection) continue;

          for (let col = 0; col < CANVAS_WIDTH; col++) {
            if (newTiles[row][col] !== null) {
              const type = newTiles[row][col];
              const neighbors = getNeighbors4(row, col);
              const sameTypeNeighbors = neighbors.filter(([r, c]) => newTiles[r][c] === type);

              // Remove edge tiles (only 1-2 neighbors)
              if (sameTypeNeighbors.length <= 2 && Math.random() < 0.3) {
                newTiles[row][col] = null;
                balanceRemovals++;

                // Stop if balanced
                const newDiff = Math.abs(getSectionDensity('mid') - getSectionDensity('backside'));
                if (newDiff <= 15) {
                  break;
                }
              }
            }
          }
        }
      }
      console.log(`  Removed ${balanceRemovals} tiles for balance`);
    }

    // ===== PHASE 4: FINAL VALIDATION AND CLEANUP =====
    console.log('\n--- PHASE 4: Final Validation and Cleanup ---');

    // Step 1: Scan for 1x1 gaps
    let gapsFilled = 0;
    let gapsRemoved = 0;

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (newTiles[row][col] === null) {
          const neighbors4 = getNeighbors4(row, col);
          const filledNeighbors = neighbors4.filter(([r, c]) => newTiles[r][c] !== null);

          if (filledNeighbors.length === 4) {
            // Surrounded by 4 tiles - check if all same type
            const types = new Set(filledNeighbors.map(([r, c]) => newTiles[r][c]));

            if (types.size === 1) {
              // All same type - fill gap
              const fillType = newTiles[filledNeighbors[0][0]][filledNeighbors[0][1]];
              newTiles[row][col] = fillType;
              gapsFilled++;
            } else {
              // Different types - remove one adjacent tile to prevent OTG
              const randomNeighbor = filledNeighbors[Math.floor(Math.random() * filledNeighbors.length)];
              newTiles[randomNeighbor[0]][randomNeighbor[1]] = null;
              gapsRemoved++;
            }
          }
        }
      }
    }
    console.log(`  1x1 gaps filled: ${gapsFilled}`);
    console.log(`  1x1 gaps cleared: ${gapsRemoved}`);

    // Step 2: Scan for 1x1 protrusions
    let protrusionsRemoved = 0;

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (newTiles[row][col] !== null) {
          const type = newTiles[row][col];
          const neighbors4 = getNeighbors4(row, col);
          const sameTypeNeighbors = neighbors4.filter(([r, c]) => newTiles[r][c] === type);

          // Remove if only 1 neighbor of same type (protrusion)
          if (sameTypeNeighbors.length === 1) {
            newTiles[row][col] = null;
            protrusionsRemoved++;
          }
        }
      }
    }
    console.log(`  1x1 protrusions removed: ${protrusionsRemoved}`);

    // Step 3: Verify mirror symmetry
    console.log('  Verifying mirror symmetry...');

    const exactCenterRow = (CANVAS_HEIGHT - 1) / 2;
    const exactCenterCol = (CANVAS_WIDTH - 1) / 2;

    if (mirrorDiagonal) {
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          const mirrorRow = Math.round(2 * exactCenterRow - row);
          const mirrorCol = Math.round(2 * exactCenterCol - col);

          if (isValid(mirrorRow, mirrorCol) && mirrorRow > row) {
            if (newTiles[row][col] !== null && newTiles[mirrorRow][mirrorCol] === null) {
              newTiles[mirrorRow][mirrorCol] = newTiles[row][col];
            } else if (newTiles[row][col] === null && newTiles[mirrorRow][mirrorCol] !== null) {
              newTiles[row][col] = newTiles[mirrorRow][mirrorCol];
            }
          }
        }
      }
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
    }
    console.log('  Mirror symmetry verified');

    // Step 4: Check section balance
    const finalMidDensity = getSectionDensity('mid');
    const finalBacksideDensity = getSectionDensity('backside');
    const finalDiff = Math.abs(finalMidDensity - finalBacksideDensity);

    console.log(`  Final mid strip: ${finalMidDensity.toFixed(1)}%`);
    console.log(`  Final backside: ${finalBacksideDensity.toFixed(1)}%`);
    console.log(`  Final difference: ${finalDiff.toFixed(1)}%`);

    if (finalDiff > 15) {
      console.log(`  WARNING: Sections remain imbalanced (diff=${finalDiff.toFixed(1)}%)`);
    }

    // Step 5: OTG Verification (scan for any remaining OTGs)
    let otgsFound = 0;

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (newTiles[row][col] !== null) {
          const type = newTiles[row][col];
          const neighbors4 = getNeighbors4(row, col);
          const sameTypeNeighbors = neighbors4.filter(([r, c]) => newTiles[r][c] === type);

          if (sameTypeNeighbors.length === 0) {
            console.log(`  OTG found at (${row}, ${col}) - removing`);
            newTiles[row][col] = null;
            otgsFound++;
          }
        }
      }
    }

    if (otgsFound === 0) {
      console.log('  ✓ No OTGs found!');
    } else {
      console.log(`  ✗ Found and removed ${otgsFound} OTGs`);
    }

    // ===== STRUCTURE ANALYSIS =====
    console.log('\n--- Structure Analysis ---');

    // Analyze all structures by terrain type
    const structureAnalysis = {
      [TERRAIN_TYPES.WALL]: [],
      [TERRAIN_TYPES.WATER]: [],
      [TERRAIN_TYPES.GRASS]: []
    };

    const analysisProcessed = new Set();

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const key = `${row},${col}`;
        const type = newTiles[row][col];

        if ((type === TERRAIN_TYPES.WALL || type === TERRAIN_TYPES.WATER || type === TERRAIN_TYPES.GRASS)
            && !analysisProcessed.has(key)) {
          const cluster = floodFill(row, col, type);
          cluster.forEach(([r, c]) => analysisProcessed.add(`${r},${c}`));

          const dims = getStructureDimensions(cluster);
          structureAnalysis[type].push({
            size: cluster.length,
            length: dims.length,
            thickness: dims.thickness
          });
        }
      }
    }

    // Log structure statistics
    Object.entries(structureAnalysis).forEach(([type, structures]) => {
      if (structures.length === 0) return;

      const typeName = type === TERRAIN_TYPES.WALL ? 'WALL'
                     : type === TERRAIN_TYPES.WATER ? 'WATER'
                     : 'GRASS';

      const avgSize = structures.reduce((sum, s) => sum + s.size, 0) / structures.length;
      const maxSize = Math.max(...structures.map(s => s.size));
      const avgLength = structures.reduce((sum, s) => sum + s.length, 0) / structures.length;
      const maxLength = Math.max(...structures.map(s => s.length));
      const maxThickness = Math.max(...structures.map(s => s.thickness));

      console.log(`  ${typeName}: ${structures.length} structures`);
      console.log(`    Avg size: ${avgSize.toFixed(1)} tiles, Max: ${maxSize} tiles`);
      console.log(`    Avg length: ${avgLength.toFixed(1)}, Max length: ${maxLength}`);
      console.log(`    Max thickness: ${maxThickness}`);
    });

    // ===== FINAL STATISTICS =====
    console.log('\n=== SEED & GROW GENERATION COMPLETE ===');
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
