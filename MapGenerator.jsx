const React = window.React;
const { useState, useRef, useEffect } = React;

// Map size configurations
const MAP_SIZES = {
  '3v3': { width: 21, height: 33, tileSize: 16, name: '3v3 (21x33)' },
  'showdown': { width: 60, height: 60, tileSize: 12, name: 'Showdown (60x60)' }
};

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
  const [mapSize, setMapSize] = useState('3v3');
  const CANVAS_WIDTH = MAP_SIZES[mapSize].width;
  const CANVAS_HEIGHT = MAP_SIZES[mapSize].height;
  const CURRENT_TILE_SIZE = MAP_SIZES[mapSize].tileSize;

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [mapCode, setMapCode] = useState('');
  const [showOTGDebug, setShowOTGDebug] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
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

  // Map Code conversion functions
  const tilesToMapCode = (tiles) => {
    let code = '';
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const tile = tiles[row][col];
        if (tile === TERRAIN_TYPES.WALL) {
          code += 'w';
        } else if (tile === TERRAIN_TYPES.WATER) {
          code += 'a';
        } else if (tile === TERRAIN_TYPES.GRASS) {
          code += 'b';
        } else {
          code += '.';
        }
      }
      code += '\n';
    }
    // Remove trailing newline
    return code.trimEnd();
  };

  const mapCodeToTiles = (code) => {
    // Remove markdown code block backticks if present
    let cleanedCode = code.trim();
    if (cleanedCode.startsWith('```')) {
      cleanedCode = cleanedCode.replace(/^```\n?/, '').replace(/```$/, '').trim();
    }

    const lines = cleanedCode.split('\n');
    if (lines.length !== CANVAS_HEIGHT) {
      alert(`Invalid map code: Expected ${CANVAS_HEIGHT} rows, got ${lines.length}`);
      return null;
    }

    const newTiles = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null));

    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      const line = lines[row];
      const chars = line.split('');

      if (chars.length !== CANVAS_WIDTH) {
        alert(`Invalid map code: Row ${row + 1} has ${chars.length} characters, expected ${CANVAS_WIDTH}`);
        return null;
      }

      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const char = chars[col];
        if (char === 'w') {
          newTiles[row][col] = TERRAIN_TYPES.WALL;
        } else if (char === 'a') {
          newTiles[row][col] = TERRAIN_TYPES.WATER;
        } else if (char === 'b') {
          newTiles[row][col] = TERRAIN_TYPES.GRASS;
        } else if (char === '.') {
          newTiles[row][col] = null;
        } else {
          alert(`Invalid character "${char}" at row ${row + 1}, col ${col + 1}`);
          return null;
        }
      }
    }

    return newTiles;
  };

  const copyMapCode = () => {
    if (!mapCode) {
      alert('No map code to copy. Generate a map first!');
      return;
    }
    navigator.clipboard.writeText(mapCode).then(() => {
      alert('Map code copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy map code. Please copy manually.');
    });
  };

  const importMapCode = () => {
    const code = document.getElementById('map-code-textarea').value;
    if (!code.trim()) {
      alert('Please paste a map code first!');
      return;
    }

    const newTiles = mapCodeToTiles(code);
    if (newTiles) {
      setTiles(newTiles);
      setMapCode(code.trim());
      alert('Map imported successfully!');
    }
  };

  // Update map code whenever tiles change
  useEffect(() => {
    const code = tilesToMapCode(tiles);
    setMapCode(code);
  }, [tiles]);

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

    // Map zone helpers - scaled based on map size
    const isShowdown = mapSize === 'showdown';
    const MID_STRIP_START = isShowdown ? Math.floor(CANVAS_HEIGHT * 0.33) : 11;
    const MID_STRIP_END = isShowdown ? Math.floor(CANVAS_HEIGHT * 0.67) : 21;
    const isInMidStrip = (row) => row >= MID_STRIP_START && row <= MID_STRIP_END;

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

      // T-shapes (reduced weight to make rarer)
      T_med1: { pattern: [[1,1,1],[0,1,0]], weight: 0.5 },
      T_med2: { pattern: [[1,0],[1,1],[1,0]], weight: 0.5 },
      T_med3: { pattern: [[0,1,0],[1,1,1]], weight: 0.5 },
      T_med4: { pattern: [[0,1],[1,1],[0,1]], weight: 0.5 },

      // Diagonal and S-shapes
      diag1: { pattern: [[1,0],[1,1],[0,1]], weight: 3 },
      diag2: { pattern: [[0,1],[1,1],[1,0]], weight: 3 },
      S_shape1: { pattern: [[1,1,0],[0,1,1]], weight: 3 },
      S_shape2: { pattern: [[0,1,1],[1,1,0]], weight: 3 },

      // Zig-zag walls (reduced weight to make rarer)
      zigzag1: { pattern: [[1,0,0],[1,1,0],[0,1,1]], weight: 0.5 },
      zigzag2: { pattern: [[0,0,1],[0,1,1],[1,1,0]], weight: 0.5 },

      // Plus-shapes (reduced weight to make rarer)
      plus_med: { pattern: [[0,1,0],[1,1,1],[0,1,0]], weight: 0.5 },

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
      T_large: { pattern: [[1,1,1,1,1],[0,0,1,0,0]], weight: 0.5 },

      // Showdown-specific large templates (10x10, 8x8, etc.) - low base weight, boosted by size in Showdown
      showdown_wall_10x10: { pattern: [
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1]
      ], weight: 0.1 },
      showdown_L_8x8: { pattern: [
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0],
        [1,1,1,1,0,0,0,0]
      ], weight: 0.1 },
      showdown_wall_6x6: { pattern: [
        [1,1,1,1,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1]
      ], weight: 0.2 },
      showdown_wall_8x4: { pattern: [
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1]
      ], weight: 0.2 }
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
      rect_3x4: { pattern: [[1,1,1],[1,1,1],[1,1,1],[1,1,1]], weight: 1 },

      // Showdown-specific large bush templates (8x8, 6x6, etc.) - low base weight, boosted by size
      showdown_bush_8x8: { pattern: [
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1]
      ], weight: 0.1 },
      showdown_bush_6x6: { pattern: [
        [1,1,1,1,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1],
        [1,1,1,1,1,1]
      ], weight: 0.2 },
      showdown_bush_5x5: { pattern: [
        [1,1,1,1,1],
        [1,1,1,1,1],
        [1,1,1,1,1],
        [1,1,1,1,1],
        [1,1,1,1,1]
      ], weight: 0.3 }
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
    const targetWater = Math.floor((waterDensity / 100) * totalTiles); // No cap - respect slider value

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

    // FIX 3: CHECK INTERNAL CORNERS FOR L/T-SHAPES
    const checkLShapeInternalCorners = (template, row, col, tiles) => {
      const templateHeight = template.length;
      const templateWidth = template[0].length;

      // Create test grid with template virtually placed
      const testGrid = tiles.map(r => [...r]);
      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] === 1) {
            testGrid[row + i][col + j] = TERRAIN_TYPES.WALL; // Placeholder terrain type
          }
        }
      }

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
          if (testGrid[adjRow][adjCol] !== null) continue; // Already filled

          // Count how many orthogonal sides are blocked by filled tiles (using test grid)
          const blockedSides = [
            [adjRow-1, adjCol], [adjRow+1, adjCol],
            [adjRow, adjCol-1], [adjRow, adjCol+1]
          ].filter(([r, c]) => {
            if (!isValid(r, c)) return true; // Edge counts as blocked
            return testGrid[r][c] !== null; // Filled tile counts as blocked
          }).length;

          // Only reject if truly trapped (3+ sides blocked)
          if (blockedSides >= 3) {
            return false; // Would create OTG at internal corner
          }
        }
      }

      return true;
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

      // FIX 4: PREVENT CORNER-ONLY TOUCHES - Reject placements that would touch only at corners
      for (let i = 0; i < templateHeight; i++) {
        for (let j = 0; j < templateWidth; j++) {
          if (template[i][j] !== 1) continue;

          const tileRow = row + i;
          const tileCol = col + j;

          // Get all 8 neighbors
          const N  = isValid(tileRow-1, tileCol) ? tiles[tileRow-1][tileCol] : null;
          const S  = isValid(tileRow+1, tileCol) ? tiles[tileRow+1][tileCol] : null;
          const E  = isValid(tileRow, tileCol+1) ? tiles[tileRow][tileCol+1] : null;
          const W  = isValid(tileRow, tileCol-1) ? tiles[tileRow][tileCol-1] : null;
          const NE = isValid(tileRow-1, tileCol+1) ? tiles[tileRow-1][tileCol+1] : null;
          const NW = isValid(tileRow-1, tileCol-1) ? tiles[tileRow-1][tileCol-1] : null;
          const SE = isValid(tileRow+1, tileCol+1) ? tiles[tileRow+1][tileCol+1] : null;
          const SW = isValid(tileRow+1, tileCol-1) ? tiles[tileRow+1][tileCol-1] : null;

          const orthogonalNeighbors = [N, S, E, W].filter(n => n !== null && n === terrainType);
          const diagonalNeighbors = [NE, NW, SE, SW].filter(n => n !== null && n === terrainType);

          // If has diagonal neighbors but NO orthogonal neighbors: REJECT
          // This means structure would touch only at corner
          if (diagonalNeighbors.length > 0 && orthogonalNeighbors.length === 0) {
            return false; // Would create corner-only touch
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

        // STRICT size limits - scale up for Showdown maps
        let maxTotalSize, maxLength, maxThickness, minThickness;
        const sizeMultiplier = isShowdown ? 2.5 : 1;

        if (terrainType === TERRAIN_TYPES.WALL) {
          maxTotalSize = Math.floor(20 * sizeMultiplier);
          maxLength = Math.floor(8 * sizeMultiplier);
          maxThickness = Math.floor(3 * sizeMultiplier);
          minThickness = 1;
        } else if (terrainType === TERRAIN_TYPES.GRASS) {
          maxTotalSize = Math.floor(25 * sizeMultiplier);
          maxLength = Math.floor(10 * sizeMultiplier);
          maxThickness = Math.floor(4 * sizeMultiplier);
          minThickness = 1;
        } else { // WATER
          maxTotalSize = Math.floor(25 * sizeMultiplier);
          maxLength = Math.floor(12 * sizeMultiplier);
          maxThickness = Math.floor(5 * sizeMultiplier);  // Max 5 tiles thick (12 for Showdown)
          minThickness = 2;  // Min 2 tiles thick - no single-tile protrusions
        }

        if (dims.totalSize > maxTotalSize || dims.maxLength > maxLength ||
            dims.maxThickness > maxThickness || dims.maxThickness < minThickness) {
          return false; // Would exceed size limits or be too thin
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

    // Helper: Fill gaps between mirrored structures
    const fillMirrorGaps = (template, positions, terrainType, tiles) => {
      const templateHeight = template.length;
      const templateWidth = template[0].length;
      let gapsFilled = 0;

      // Check vertical mirror gaps (left-right symmetry)
      if (mirrorVertical && positions.length >= 2) {
        const leftPos = positions.find(p => p.col < CANVAS_WIDTH / 2) || positions[0];
        const rightPos = positions.find(p => p.col >= CANVAS_WIDTH / 2 && p.row === leftPos.row);

        if (rightPos) {
          const leftEnd = leftPos.col + templateWidth;
          const rightStart = rightPos.col;
          const gap = rightStart - leftEnd;

          // If exactly 1 tile gap between mirrored structures, fill it
          if (gap === 1) {
            const gapCol = leftEnd;
            for (let r = leftPos.row; r < leftPos.row + templateHeight; r++) {
              if (r >= 0 && r < CANVAS_HEIGHT && gapCol >= 0 && gapCol < CANVAS_WIDTH) {
                if (tiles[r][gapCol] === null) {
                  tiles[r][gapCol] = terrainType;
                  gapsFilled++;
                }
              }
            }
          }
        }
      }

      // Check horizontal mirror gaps (top-bottom symmetry)
      if (mirrorHorizontal && positions.length >= 2) {
        const topPos = positions.find(p => p.row < CANVAS_HEIGHT / 2) || positions[0];
        const bottomPos = positions.find(p => p.row >= CANVAS_HEIGHT / 2 && p.col === topPos.col);

        if (bottomPos) {
          const topEnd = topPos.row + templateHeight;
          const bottomStart = bottomPos.row;
          const gap = bottomStart - topEnd;

          // If exactly 1 tile gap between mirrored structures, fill it
          if (gap === 1) {
            const gapRow = topEnd;
            for (let c = topPos.col; c < topPos.col + templateWidth; c++) {
              if (gapRow >= 0 && gapRow < CANVAS_HEIGHT && c >= 0 && c < CANVAS_WIDTH) {
                if (tiles[gapRow][c] === null) {
                  tiles[gapRow][c] = terrainType;
                  gapsFilled++;
                }
              }
            }
          }
        }
      }

      return gapsFilled;
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

      // Fill gaps between mirrored structures if they're exactly 1 tile apart
      const mirrorGapsFilled = fillMirrorGaps(template, positions, terrainType, tiles);
      totalTilesPlaced += mirrorGapsFilled;

      return totalTilesPlaced;
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
    console.log(`Using region-based variety: ${NUM_REGIONS} regions (${isShowdown ? '3x3 grid for Showdown' : '3 vertical strips for 3v3'})`);

    // Region-based template tracking for better variety distribution
    // For 3v3: 3 regions (backside top, mid strip, backside bottom)
    // For Showdown: 9 regions (3x3 grid of 20x20 areas)
    const TEMPLATE_HISTORY_SIZE = 5;
    const RECENT_TEMPLATE_WEIGHT_PENALTY = 0.3;
    const NUM_REGIONS = isShowdown ? 9 : 3;

    // Initialize template history for each region
    const regionTemplateHistory = {};
    for (let i = 0; i < NUM_REGIONS; i++) {
      regionTemplateHistory[i] = [];
    }

    // Helper: Get region ID based on position
    const getRegion = (row, col) => {
      if (isShowdown) {
        // 3x3 grid: divide 60x60 into 9 regions of 20x20
        const regionRow = Math.floor(row / 20);
        const regionCol = Math.floor(col / 20);
        return regionRow * 3 + regionCol; // 0-8
      } else {
        // 3v3: 3 vertical regions
        if (row < 11) return 0; // Backside top (rows 0-10)
        if (row <= 21) return 1; // Mid strip (rows 11-21)
        return 2; // Backside bottom (rows 22-32)
      }
    };

    // Helper: Choose weighted random template with region-based variety enforcement
    const chooseTemplate = (templates, row, col) => {
      const region = getRegion(row, col);
      const regionHistory = regionTemplateHistory[region];

      // Calculate adjusted weights based on region history and Showdown bonuses
      const adjustedWeights = {};

      for (const [name, template] of Object.entries(templates)) {
        let weight = template.weight;

        // Apply penalty for recently used templates IN THIS REGION (for variety)
        if (regionHistory.includes(name)) {
          weight *= RECENT_TEMPLATE_WEIGHT_PENALTY;
        }

        // For Showdown: multiply weight by structure size (larger = higher weight)
        if (isShowdown) {
          const templateSize = countTilesInTemplate(template.pattern);
          const sizeBonus = Math.sqrt(templateSize); // Scale bonus by square root to avoid extreme skew
          weight *= sizeBonus;
        }

        adjustedWeights[name] = weight;
      }

      const totalWeight = Object.values(adjustedWeights).reduce((sum, w) => sum + w, 0);
      let random = Math.random() * totalWeight;

      for (const [name, weight] of Object.entries(adjustedWeights)) {
        random -= weight;
        if (random <= 0) {
          // Track this template in region history
          regionHistory.push(name);
          if (regionHistory.length > TEMPLATE_HISTORY_SIZE) {
            regionHistory.shift();
          }
          return templates[name].pattern;
        }
      }

      // Fallback
      const fallbackName = Object.keys(templates)[0];
      regionHistory.push(fallbackName);
      if (regionHistory.length > TEMPLATE_HISTORY_SIZE) {
        regionHistory.shift();
      }
      return templates[fallbackName].pattern;
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

    // FIX 2: ENHANCED OTG FIXING WITH MULTIPLE PASSES (10-15 iterations with detailed logging)
    const fixAllRemainingOTGs = (tiles) => {
      // Use more iterations for Showdown maps due to larger size
      const maxIterations = isShowdown ? 15 : 10;
      console.log(`\n--- Enhanced OTG Fixing (up to ${maxIterations} iterations) ---`);
      let totalOTGsFixed = 0;

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const otgs = detectAllOTGs(tiles);
        const criticalOTGs = otgs.filter(o => o.severity === 'critical' || o.severity === 'high');

        if (criticalOTGs.length === 0) {
          console.log(`✓ OTG Fix Pass ${iteration + 1}: No OTGs found - map is clean!`);
          break;
        }

        console.log(`⚠ OTG Fix Pass ${iteration + 1}: Found ${criticalOTGs.length} OTGs`);
        let iterationFixes = 0;

        for (const otg of criticalOTGs) {
          console.log(`  - Fixing ${otg.type} OTG at (${otg.row},${otg.col})`);

          // Find adjacent filled tiles to remove (including diagonals for all OTGs)
          const neighbors = [
            {pos: [otg.row-1, otg.col], exists: otg.row > 0},
            {pos: [otg.row+1, otg.col], exists: otg.row < CANVAS_HEIGHT-1},
            {pos: [otg.row, otg.col-1], exists: otg.col > 0},
            {pos: [otg.row, otg.col+1], exists: otg.col < CANVAS_WIDTH-1},
            {pos: [otg.row-1, otg.col-1], exists: otg.row > 0 && otg.col > 0},
            {pos: [otg.row-1, otg.col+1], exists: otg.row > 0 && otg.col < CANVAS_WIDTH-1},
            {pos: [otg.row+1, otg.col-1], exists: otg.row < CANVAS_HEIGHT-1 && otg.col > 0},
            {pos: [otg.row+1, otg.col+1], exists: otg.row < CANVAS_HEIGHT-1 && otg.col < CANVAS_WIDTH-1}
          ];

          // Find filled neighbors
          const filledNeighbors = neighbors.filter(n =>
            n.exists && tiles[n.pos[0]][n.pos[1]] !== null
          );

          if (filledNeighbors.length === 0) {
            console.log('    ⚠ No neighbors to remove - skipping');
            continue;
          }

          // Find smallest adjacent structure
          let smallestNeighbor = null;
          let smallestSize = Infinity;

          for (const neighbor of filledNeighbors) {
            const [nRow, nCol] = neighbor.pos;
            const structureSize = floodFillSize(tiles, nRow, nCol, tiles[nRow][nCol]);
            if (structureSize < smallestSize) {
              smallestSize = structureSize;
              smallestNeighbor = neighbor.pos;
            }
          }

          // Remove that tile
          if (smallestNeighbor) {
            const [nRow, nCol] = smallestNeighbor;
            tiles[nRow][nCol] = null;
            iterationFixes++;
            totalOTGsFixed++;
            console.log(`    ✓ Removed tile from structure at (${nRow},${nCol})`);
          }
        }

        console.log(`  Pass ${iteration + 1}: Fixed ${iterationFixes} OTGs`);

        if (iteration === maxIterations - 1 && criticalOTGs.length > 0) {
          console.error('⚠ WARNING: Max OTG iterations reached - some OTGs may remain');
        }
      }

      if (totalOTGsFixed > 0) {
        console.log(`✓ All OTGs fixed successfully! Total fixes: ${totalOTGsFixed}`);
      } else {
        console.log('✓ No OTGs needed fixing');
      }
      return totalOTGsFixed;
    };

    // AGGRESSIVE OTG CLEANUP - Targeted removal of stubborn OTGs
    const aggressiveOTGCleanup = (tiles) => {
      // Use more iterations for Showdown maps due to larger size
      const maxIterations = isShowdown ? 5 : 3;
      console.log(`\n--- Aggressive OTG Cleanup (${maxIterations} iterations) ---`);
      let totalRemoved = 0;

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const otgs = detectAllOTGs(tiles);

        // Focus on 1-tile gaps surrounded by terrain on 3-4 orthogonal sides
        const targetOTGs = otgs.filter(otg => {
          const row = otg.row;
          const col = otg.col;

          // Count orthogonal neighbors that are filled (wall/water)
          const neighbors = [
            {pos: [row-1, col], exists: row > 0},           // North
            {pos: [row+1, col], exists: row < CANVAS_HEIGHT-1}, // South
            {pos: [row, col-1], exists: col > 0},           // West
            {pos: [row, col+1], exists: col < CANVAS_WIDTH-1}   // East
          ];

          const filledOrthogonal = neighbors.filter(n =>
            n.exists && tiles[n.pos[0]][n.pos[1]] !== null
          ).length;

          // Target OTGs with 3-4 orthogonal neighbors filled
          return filledOrthogonal >= 3;
        });

        if (targetOTGs.length === 0) {
          console.log(`✓ Aggressive Cleanup Pass ${iteration + 1}: No target OTGs found`);
          break;
        }

        console.log(`⚠ Aggressive Cleanup Pass ${iteration + 1}: Found ${targetOTGs.length} target OTGs`);
        let iterationRemoved = 0;

        // Sort OTGs: edge-adjacent first, then interior
        const sortedOTGs = targetOTGs.sort((a, b) => {
          const aIsEdge = a.row === 0 || a.row === CANVAS_HEIGHT-1 || a.col === 0 || a.col === CANVAS_WIDTH-1;
          const bIsEdge = b.row === 0 || b.row === CANVAS_HEIGHT-1 || b.col === 0 || b.col === CANVAS_WIDTH-1;

          if (aIsEdge && !bIsEdge) return -1;
          if (!aIsEdge && bIsEdge) return 1;
          return 0;
        });

        for (const otg of sortedOTGs) {
          console.log(`  - Processing OTG at (${otg.row},${otg.col})`);

          // Find adjacent wall/water tiles (orthogonal only)
          const neighbors = [
            {pos: [otg.row-1, otg.col], exists: otg.row > 0, isEdge: otg.row === 1},
            {pos: [otg.row+1, otg.col], exists: otg.row < CANVAS_HEIGHT-1, isEdge: otg.row === CANVAS_HEIGHT-2},
            {pos: [otg.row, otg.col-1], exists: otg.col > 0, isEdge: otg.col === 1},
            {pos: [otg.row, otg.col+1], exists: otg.col < CANVAS_WIDTH-1, isEdge: otg.col === CANVAS_WIDTH-2}
          ];

          // Find filled neighbors (wall or water only, not grass)
          const filledNeighbors = neighbors.filter(n =>
            n.exists && tiles[n.pos[0]][n.pos[1]] !== null && tiles[n.pos[0]][n.pos[1]] !== TERRAIN_TYPES.GRASS
          );

          if (filledNeighbors.length === 0) {
            console.log('    ⚠ No wall/water neighbors to remove - skipping');
            continue;
          }

          // Prioritize edge-adjacent tiles if this is an edge OTG
          const edgeNeighbors = filledNeighbors.filter(n => n.isEdge);
          const candidateNeighbors = edgeNeighbors.length > 0 ? edgeNeighbors : filledNeighbors;

          // Find the smallest connected structure among candidates
          let smallestNeighbor = null;
          let smallestSize = Infinity;

          for (const neighbor of candidateNeighbors) {
            const [nRow, nCol] = neighbor.pos;
            const terrainType = tiles[nRow][nCol];
            const structureSize = floodFillSize(tiles, nRow, nCol, terrainType);

            if (structureSize < smallestSize) {
              smallestSize = structureSize;
              smallestNeighbor = neighbor.pos;
            }
          }

          // Remove the chosen tile
          if (smallestNeighbor) {
            const [nRow, nCol] = smallestNeighbor;
            const terrainType = tiles[nRow][nCol];
            tiles[nRow][nCol] = null;
            iterationRemoved++;
            totalRemoved++;
            console.log(`    ✓ Removed ${terrainType === TERRAIN_TYPES.WALL ? 'wall' : 'water'} tile at (${nRow},${nCol}) (structure size: ${smallestSize})`);
          }
        }

        console.log(`  Pass ${iteration + 1}: Removed ${iterationRemoved} tiles`);

        // Re-run symmetry enforcement after this cleanup iteration if mirroring is enabled
        if ((mirrorVertical || mirrorHorizontal || mirrorDiagonal) && iterationRemoved > 0) {
          console.log('  → Re-enforcing symmetry after cleanup...');
          enforceSymmetry(tiles);
        }

        // Break early if no tiles were removed this iteration
        if (iterationRemoved === 0) {
          console.log('✓ No more tiles removed - cleanup complete');
          break;
        }
      }

      if (totalRemoved > 0) {
        console.log(`✓ Aggressive cleanup complete! Total tiles removed: ${totalRemoved}`);
      } else {
        console.log('✓ No aggressive cleanup needed');
      }
      return totalRemoved;
    };

    // FIX 3: EDGE BUFFER ENFORCEMENT - Prevent structures from creating traps along map edges
    const cleanMapEdges = (tiles) => {
      console.log('\n--- Cleaning Map Edges ---');
      let edgeTilesRemoved = 0;

      // Top and bottom edges
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        // Top edge (row 0)
        if (tiles[0][col] !== null && tiles[1][col] !== null) {
          // Check if creates 1-tile corridor along edge (different structures)
          if (tiles[0][col] !== tiles[1][col]) {
            tiles[0][col] = null;
            edgeTilesRemoved++;
          }
        }

        // Bottom edge (row CANVAS_HEIGHT-1)
        const bottomRow = CANVAS_HEIGHT - 1;
        if (tiles[bottomRow][col] !== null && tiles[bottomRow - 1][col] !== null) {
          if (tiles[bottomRow][col] !== tiles[bottomRow - 1][col]) {
            tiles[bottomRow][col] = null;
            edgeTilesRemoved++;
          }
        }
      }

      // Left and right edges
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        // Left edge (col 0)
        if (tiles[row][0] !== null && tiles[row][1] !== null) {
          if (tiles[row][0] !== tiles[row][1]) {
            tiles[row][0] = null;
            edgeTilesRemoved++;
          }
        }

        // Right edge (col CANVAS_WIDTH-1)
        const rightCol = CANVAS_WIDTH - 1;
        if (tiles[row][rightCol] !== null && tiles[row][rightCol - 1] !== null) {
          if (tiles[row][rightCol] !== tiles[row][rightCol - 1]) {
            tiles[row][rightCol] = null;
            edgeTilesRemoved++;
          }
        }
      }

      // Special extra cleanup for Showdown maps - more aggressive edge OTG detection
      if (isShowdown) {
        console.log('  Showdown mode: Extra edge cleanup pass...');

        // Check for any remaining single-tile gaps along edges
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          // Top edge - check for OTGs created by structures
          if (tiles[0][col] === null) {
            const neighbors = [
              [0, col-1], [0, col+1], [1, col]
            ].filter(([r, c]) => r >= 0 && r < CANVAS_HEIGHT && c >= 0 && c < CANVAS_WIDTH);

            const filledNeighbors = neighbors.filter(([r, c]) => tiles[r][c] !== null).length;
            if (filledNeighbors >= 2) {
              // Check if this creates a 1-tile gap
              const leftFilled = col > 0 && tiles[0][col-1] !== null;
              const rightFilled = col < CANVAS_WIDTH-1 && tiles[0][col+1] !== null;
              if (leftFilled && rightFilled) {
                tiles[0][col-1] = null;
                edgeTilesRemoved++;
              }
            }
          }

          // Bottom edge
          const bottomRow = CANVAS_HEIGHT - 1;
          if (tiles[bottomRow][col] === null) {
            const neighbors = [
              [bottomRow, col-1], [bottomRow, col+1], [bottomRow-1, col]
            ].filter(([r, c]) => r >= 0 && r < CANVAS_HEIGHT && c >= 0 && c < CANVAS_WIDTH);

            const filledNeighbors = neighbors.filter(([r, c]) => tiles[r][c] !== null).length;
            if (filledNeighbors >= 2) {
              const leftFilled = col > 0 && tiles[bottomRow][col-1] !== null;
              const rightFilled = col < CANVAS_WIDTH-1 && tiles[bottomRow][col+1] !== null;
              if (leftFilled && rightFilled) {
                tiles[bottomRow][col-1] = null;
                edgeTilesRemoved++;
              }
            }
          }
        }

        // Check left and right edges
        for (let row = 0; row < CANVAS_HEIGHT; row++) {
          // Left edge
          if (tiles[row][0] === null) {
            const neighbors = [
              [row-1, 0], [row+1, 0], [row, 1]
            ].filter(([r, c]) => r >= 0 && r < CANVAS_HEIGHT && c >= 0 && c < CANVAS_WIDTH);

            const filledNeighbors = neighbors.filter(([r, c]) => tiles[r][c] !== null).length;
            if (filledNeighbors >= 2) {
              const topFilled = row > 0 && tiles[row-1][0] !== null;
              const bottomFilled = row < CANVAS_HEIGHT-1 && tiles[row+1][0] !== null;
              if (topFilled && bottomFilled) {
                tiles[row-1][0] = null;
                edgeTilesRemoved++;
              }
            }
          }

          // Right edge
          const rightCol = CANVAS_WIDTH - 1;
          if (tiles[row][rightCol] === null) {
            const neighbors = [
              [row-1, rightCol], [row+1, rightCol], [row, rightCol-1]
            ].filter(([r, c]) => r >= 0 && r < CANVAS_HEIGHT && c >= 0 && c < CANVAS_WIDTH);

            const filledNeighbors = neighbors.filter(([r, c]) => tiles[r][c] !== null).length;
            if (filledNeighbors >= 2) {
              const topFilled = row > 0 && tiles[row-1][rightCol] !== null;
              const bottomFilled = row < CANVAS_HEIGHT-1 && tiles[row+1][rightCol] !== null;
              if (topFilled && bottomFilled) {
                tiles[row-1][rightCol] = null;
                edgeTilesRemoved++;
              }
            }
          }
        }
      }

      console.log(`  Removed ${edgeTilesRemoved} edge tiles`);
      return edgeTilesRemoved;
    };

    // FIX 6: FILL EDGE GAPS - Fill single-tile empty gaps adjacent to terrain on edges
    const fillEdgeGaps = (tiles) => {
      console.log('\n--- Filling Edge Gaps ---');
      let gapsFilled = 0;

      // Top edge (row 0)
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (tiles[0][col] === null && tiles[1][col] !== null) {
          // Empty edge tile with filled tile 1 inward - copy terrain type
          tiles[0][col] = tiles[1][col];
          gapsFilled++;
        }
      }

      // Bottom edge (row CANVAS_HEIGHT-1 = row 32)
      const bottomRow = CANVAS_HEIGHT - 1;
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        if (tiles[bottomRow][col] === null && tiles[bottomRow - 1][col] !== null) {
          tiles[bottomRow][col] = tiles[bottomRow - 1][col];
          gapsFilled++;
        }
      }

      // Left edge (col 0)
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        if (tiles[row][0] === null && tiles[row][1] !== null) {
          tiles[row][0] = tiles[row][1];
          gapsFilled++;
        }
      }

      // Right edge (col CANVAS_WIDTH-1 = col 20)
      const rightCol = CANVAS_WIDTH - 1;
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        if (tiles[row][rightCol] === null && tiles[row][rightCol - 1] !== null) {
          tiles[row][rightCol] = tiles[row][rightCol - 1];
          gapsFilled++;
        }
      }

      console.log(`  Filled ${gapsFilled} edge gaps`);
      return gapsFilled;
    };

    // FIX 5: ENFORCE SYMMETRY AS FINAL STEP - Force-correct any asymmetries
    const enforceSymmetry = (tiles) => {
      if (!mirrorVertical && !mirrorHorizontal && !mirrorDiagonal) {
        return 0; // No mirroring enabled
      }

      console.log('\n--- Enforcing Symmetry ---');
      let asymmetriesFixed = 0;

      if (mirrorVertical) {
        for (let row = 0; row < CANVAS_HEIGHT; row++) {
          for (let col = 0; col < Math.floor(CANVAS_WIDTH / 2); col++) {
            const mirrorCol = CANVAS_WIDTH - 1 - col;
            const sourceTile = tiles[row][col];
            if (tiles[row][mirrorCol] !== sourceTile) {
              tiles[row][mirrorCol] = sourceTile;
              asymmetriesFixed++;
            }
          }
        }
      }

      if (mirrorHorizontal) {
        for (let row = 0; row < Math.floor(CANVAS_HEIGHT / 2); row++) {
          for (let col = 0; col < CANVAS_WIDTH; col++) {
            const mirrorRow = CANVAS_HEIGHT - 1 - row;
            const sourceTile = tiles[row][col];
            if (tiles[mirrorRow][col] !== sourceTile) {
              tiles[mirrorRow][col] = sourceTile;
              asymmetriesFixed++;
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
              if (row <= mirrorRow || (row === mirrorRow && col <= mirrorCol)) {
                const sourceTile = tiles[row][col];
                if (tiles[mirrorRow][mirrorCol] !== sourceTile) {
                  tiles[mirrorRow][mirrorCol] = sourceTile;
                  asymmetriesFixed++;
                }
              }
            }
          }
        }
      }

      console.log(`  Fixed ${asymmetriesFixed} asymmetries`);
      return asymmetriesFixed;
    };

    // ENCLOSED SPACE DETECTION AND FILLING - Fill trapped empty spaces
    const detectAndFillEnclosedSpaces = (tiles) => {
      console.log('\n--- Enclosed Space Detection ---');

      // Create a map to track accessible (reachable from edges) empty tiles
      const accessible = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(false));

      // Flood fill from all 4 edges to mark accessible empty tiles
      const floodFillFromEdge = (startRow, startCol) => {
        if (startRow < 0 || startRow >= CANVAS_HEIGHT || startCol < 0 || startCol >= CANVAS_WIDTH) {
          return;
        }

        // Only flood fill through empty tiles
        if (tiles[startRow][startCol] !== null) {
          return;
        }

        // Already visited
        if (accessible[startRow][startCol]) {
          return;
        }

        // Mark as accessible
        accessible[startRow][startCol] = true;

        // Recursively flood fill to orthogonal neighbors
        floodFillFromEdge(startRow - 1, startCol); // North
        floodFillFromEdge(startRow + 1, startCol); // South
        floodFillFromEdge(startRow, startCol - 1); // West
        floodFillFromEdge(startRow, startCol + 1); // East
      };

      // Start flood fill from all edge tiles
      console.log('  Starting flood fill from edges...');

      // Top and bottom edges
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        floodFillFromEdge(0, col); // Top edge
        floodFillFromEdge(CANVAS_HEIGHT - 1, col); // Bottom edge
      }

      // Left and right edges (skip corners already processed)
      for (let row = 1; row < CANVAS_HEIGHT - 1; row++) {
        floodFillFromEdge(row, 0); // Left edge
        floodFillFromEdge(row, CANVAS_WIDTH - 1); // Right edge
      }

      // Find all enclosed empty tiles (empty but not accessible)
      const enclosedTiles = [];
      for (let row = 0; row < CANVAS_HEIGHT; row++) {
        for (let col = 0; col < CANVAS_WIDTH; col++) {
          if (tiles[row][col] === null && !accessible[row][col]) {
            enclosedTiles.push({row, col});
          }
        }
      }

      if (enclosedTiles.length === 0) {
        console.log('  ✓ No enclosed spaces found');
        return 0;
      }

      console.log(`  Found ${enclosedTiles.length} enclosed empty tiles`);

      // Fill each enclosed tile with most common terrain type among neighbors
      let filledCount = 0;
      for (const {row, col} of enclosedTiles) {
        // Get orthogonal neighbors
        const neighbors = [];
        if (row > 0) neighbors.push(tiles[row - 1][col]); // North
        if (row < CANVAS_HEIGHT - 1) neighbors.push(tiles[row + 1][col]); // South
        if (col > 0) neighbors.push(tiles[row][col - 1]); // West
        if (col < CANVAS_WIDTH - 1) neighbors.push(tiles[row][col + 1]); // East

        // Count terrain types (ignore null/empty neighbors)
        const terrainCounts = {};
        for (const terrain of neighbors) {
          if (terrain !== null) {
            terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
          }
        }

        // Find most common terrain type
        let mostCommonTerrain = TERRAIN_TYPES.WALL; // Default to wall
        let maxCount = 0;

        for (const [terrain, count] of Object.entries(terrainCounts)) {
          if (count > maxCount) {
            maxCount = count;
            mostCommonTerrain = terrain;
          }
        }

        // Fill the enclosed tile
        tiles[row][col] = mostCommonTerrain;
        filledCount++;
      }

      console.log(`  ✓ Filled ${filledCount} enclosed empty tiles`);
      return filledCount;
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

      // FIX 3: WATER PLACEMENT DIAGNOSTICS
      if (type === TERRAIN_TYPES.WATER) {
        console.log('=== Water Placement Debug ===');
        console.log(`Water density setting: ${waterDensity}%`);
        console.log(`Target water tiles: ${targetCount}`);

        if (targetCount < 6) {
          console.warn('⚠ Water density too low - minimum 6 tiles needed for placement');
          console.warn('Suggestion: Increase water slider to at least 4%');
        }

        const waterTemplatesList = Object.keys(templates);
        console.log(`Available water templates: ${waterTemplatesList.length}`);
        console.log(`Template names: ${waterTemplatesList.join(', ')}`);
      }

      let currentTileCount = 0;
      let attemptCount = 0;
      // Water placement: 1000 attempts max (fail gracefully), others: 5000
      const maxAttempts = (type === TERRAIN_TYPES.WATER) ? 1000 : 5000;

      // Special handling for water: limit to 2 structures max, mid strip only
      let waterStructureCount = 0;
      const maxWaterStructures = 2;

      while (currentTileCount < targetCount && attemptCount < maxAttempts) {
        attemptCount++;

        // Step 1: Choose initial position (rough) to determine region
        let row, col;

        if (type === TERRAIN_TYPES.WATER) {
          // STRATEGIC WATER PLACEMENT: Only in mid strip
          if (waterStructureCount >= maxWaterStructures) {
            break; // Stop placing water
          }

          // Choose position in mid strip
          const midStripHeight = MID_STRIP_END - MID_STRIP_START + 1;
          row = MID_STRIP_START + Math.floor(Math.random() * midStripHeight);
          col = 5 + Math.floor(Math.random() * (CANVAS_WIDTH - 10));
        } else {
          // Random position for walls and bushes
          row = Math.floor(Math.random() * CANVAS_HEIGHT);
          col = Math.floor(Math.random() * CANVAS_WIDTH);
        }

        // Step 2: Choose template based on region for variety
        const template = chooseTemplate(templates, row, col);
        const templateSize = countTilesInTemplate(template);

        // Step 3: Adjust position to fit template (boundary check)
        if (type === TERRAIN_TYPES.WATER) {
          // Ensure template fits in mid strip
          const midStripHeight = MID_STRIP_END - MID_STRIP_START + 1;
          row = MID_STRIP_START + Math.floor(Math.random() * Math.max(1, midStripHeight - template.length + 1));
          col = 5 + Math.floor(Math.random() * Math.max(1, CANVAS_WIDTH - 10 - template[0].length + 1));

          // Skip small water templates
          if (templateSize < 6) {
            continue;
          }
        } else {
          // Ensure template fits in map bounds
          row = Math.min(row, CANVAS_HEIGHT - template.length);
          col = Math.min(col, CANVAS_WIDTH - template[0].length);
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

        // COMPOSITE WALLS: 15% chance to add 1-2 overlapping wall templates to create merged structures
        if (type === TERRAIN_TYPES.WALL && Math.random() < 0.15) {
          const compositeCount = 1 + Math.floor(Math.random() * 2); // 1-2 additional templates
          const compositePlacements = []; // Track composite placements for potential undo

          for (let c = 0; c < compositeCount; c++) {
            // Choose a nearby position (within 1-3 tiles of original)
            const offsetRow = Math.floor(Math.random() * 7) - 3; // -3 to +3
            const offsetCol = Math.floor(Math.random() * 7) - 3;
            let compRow = row + offsetRow;
            let compCol = col + offsetCol;

            // Choose a different template for variety
            const compTemplate = chooseTemplate(templates, compRow, compCol);

            // Ensure template fits in map bounds
            compRow = Math.max(0, Math.min(compRow, CANVAS_HEIGHT - compTemplate.length));
            compCol = Math.max(0, Math.min(compCol, CANVAS_WIDTH - compTemplate[0].length));

            // Get zone and mirror positions
            const compZone = getZone(compRow, compCol);
            const compMirrorPositions = calculateMirrorPositions(compTemplate, compRow, compCol);

            // Validate all mirror positions
            let compValid = true;
            for (const pos of compMirrorPositions) {
              const posZone = getZone(pos.row, pos.col);
              if (!checkPlacementValid(compTemplate, pos.row, pos.col, placedTiles, posZone, type)) {
                compValid = false;
                break;
              }
            }

            if (compValid) {
              // Place composite template
              const compTilesPlaced = placeTemplate(compTemplate, compRow, compCol, type, placedTiles);

              // Verify no OTGs created
              const compOtgs = detectAllOTGs(placedTiles);
              const compCriticalOTGs = compOtgs.filter(o => o.severity === 'critical' || o.severity === 'high');

              if (compCriticalOTGs.length > 0) {
                // Undo composite placement
                undoTemplatePlacement(compTemplate, compRow, compCol, type, placedTiles);
              } else {
                // Composite successful
                currentTileCount += compTilesPlaced;
                compositePlacements.push({ template: compTemplate, row: compRow, col: compCol, tiles: compTilesPlaced });
              }
            }
          }

          if (compositePlacements.length > 0) {
            console.log(`  ✨ Created composite wall: ${compositePlacements.length + 1} merged templates at (${row},${col})`);
          }
        }

        // Track water structure count
        if (type === TERRAIN_TYPES.WATER) {
          waterStructureCount++;
          console.log(`✓ Placed water structure #${waterStructureCount} at (${row},${col}) - ${tilesPlaced} tiles`);
        }
      }

      console.log(`  ${name}: placed ${currentTileCount}/${targetCount} tiles in ${attemptCount} attempts`);
      if (type === TERRAIN_TYPES.WATER) {
        console.log(`Final water placement: ${currentTileCount} tiles in ${waterStructureCount} structures`);
        console.log(`Placement attempts: ${attemptCount}`);

        if (waterStructureCount === 0) {
          console.warn('⚠ WARNING: No water structures placed! Check validation rules.');
        }
      }

      // FIX 2: After bush placement, merge nearby bushes
      if (type === TERRAIN_TYPES.GRASS) {
        mergeNearbyBushes(placedTiles);
      }
    }

    // ===== PHASE 6: POST-PLACEMENT CLEANUP =====
    console.log('\n--- PHASE 6: Post-Placement Cleanup ---');

    // Step 1: Clean map edges to prevent edge traps
    const edgeTilesRemoved = cleanMapEdges(placedTiles);

    // Step 2: Fix all remaining OTGs with 5 iterations
    const totalOTGsFixed = fixAllRemainingOTGs(placedTiles);

    // Step 2.5: Aggressive OTG cleanup for stubborn gaps
    const aggressiveRemoved = aggressiveOTGCleanup(placedTiles);

    // Step 3: Fill edge gaps (after OTG fixes, before enclosed space detection)
    const edgeGapsFilled = fillEdgeGaps(placedTiles);

    // Step 3.5: Detect and fill enclosed spaces (after OTG fixes, before symmetry)
    const enclosedSpacesFilled = detectAndFillEnclosedSpaces(placedTiles);

    // Step 4: Enforce symmetry as final step (force-correct any asymmetries)
    const asymmetriesFixed = enforceSymmetry(placedTiles);

    // Step 4.5: Fix any OTGs created by symmetry enforcement
    // Mirroring can create new OTGs at the mirror boundaries, so we need one final cleanup
    if (asymmetriesFixed > 0) {
      console.log('\n--- Post-Symmetry OTG Cleanup ---');
      const postSymmetryOTGs = detectAllOTGs(placedTiles);
      if (postSymmetryOTGs.length > 0) {
        console.log(`  Found ${postSymmetryOTGs.length} OTGs after symmetry enforcement`);
        const postSymmetryFixes = fixAllRemainingOTGs(placedTiles);
        console.log(`  Fixed ${postSymmetryFixes} OTGs created by mirroring`);

        // Re-enforce symmetry after OTG fixes to maintain symmetry
        if (postSymmetryFixes > 0) {
          console.log('  Re-enforcing symmetry after OTG fixes...');
          enforceSymmetry(placedTiles);
        }
      } else {
        console.log('✓ No OTGs created by symmetry enforcement');
      }
    }

    // FIX 4: COMPREHENSIVE FINAL VALIDATION
    const finalValidation = (tiles) => {
      console.log('\n=== Final Validation ===');

      // Check for OTGs using enhanced detection
      const finalOTGs = detectAllOTGs(tiles);
      const criticalOTGs = finalOTGs.filter(o => o.severity === 'critical' || o.severity === 'high');

      if (criticalOTGs.length > 0) {
        console.error(`❌ CRITICAL: ${criticalOTGs.length} OTGs remain after fixes!`);
        criticalOTGs.forEach(otg => {
          console.error(`  - ${otg.type} at (${otg.row},${otg.col})`);
        });
      } else {
        console.log('✓ OTG Check: PASSED (0 found)');
      }

      // Check symmetry
      let asymmetries = 0;
      if (mirrorVertical) {
        for (let row = 0; row < CANVAS_HEIGHT; row++) {
          for (let col = 0; col < Math.floor(CANVAS_WIDTH / 2); col++) {
            const mirrorCol = CANVAS_WIDTH - 1 - col;
            if (tiles[row][col] !== tiles[row][mirrorCol]) {
              asymmetries++;
            }
          }
        }
      }

      if (mirrorHorizontal) {
        for (let row = 0; row < Math.floor(CANVAS_HEIGHT / 2); row++) {
          for (let col = 0; col < CANVAS_WIDTH; col++) {
            const mirrorRow = CANVAS_HEIGHT - 1 - row;
            if (tiles[row][col] !== tiles[mirrorRow][col]) {
              asymmetries++;
            }
          }
        }
      }

      if (asymmetries > 0) {
        console.error(`❌ Symmetry Check: FAILED (${asymmetries} asymmetries)`);
      } else if (mirrorVertical || mirrorHorizontal) {
        console.log('✓ Symmetry Check: PASSED');
      } else {
        console.log('✓ Symmetry Check: N/A (no mirroring enabled)');
      }

      // Count structures by type
      const wallTiles = tiles.flat().filter(t => t === TERRAIN_TYPES.WALL).length;
      const bushTiles = tiles.flat().filter(t => t === TERRAIN_TYPES.GRASS).length;
      const waterTiles = tiles.flat().filter(t => t === TERRAIN_TYPES.WATER).length;
      const wallStructures = placedStructures.filter(s => s.type === 'WALL').length;
      const bushStructures = placedStructures.filter(s => s.type === 'BUSH').length;
      const waterStructures = placedStructures.filter(s => s.type === 'WATER').length;

      console.log('Structure counts:');
      console.log(`  - Walls: ${wallStructures} structures (${wallTiles} tiles)`);
      console.log(`  - Bushes: ${bushStructures} structures (${bushTiles} tiles)`);
      console.log(`  - Water: ${waterStructures} structures (${waterTiles} tiles)`);

      if (waterStructures === 0 && targetWater > 0) {
        console.warn('⚠ No water structures on map - check water placement logic');
      }

      console.log('=== Validation Complete ===');

      return {
        otgsFound: criticalOTGs.length,
        asymmetries: asymmetries,
        passed: (criticalOTGs.length === 0 && asymmetries === 0)
      };
    };

    // Run final validation
    const validationResult = finalValidation(placedTiles);

    // ===== PHASE 7: FINAL STATISTICS =====
    console.log('\n--- PHASE 7: Final Statistics ---');

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

    console.log('\nPost-Processing Results:');
    console.log(`  Edge tiles removed: ${edgeTilesRemoved}`);
    console.log(`  OTGs fixed: ${totalOTGsFixed}`);
    console.log(`  Enclosed spaces filled: ${enclosedSpacesFilled}`);
    console.log(`  Asymmetries corrected: ${asymmetriesFixed}`);
    console.log(`  Final OTGs found: ${validationResult.otgsFound} (should be 0)`);
    console.log(`  Final validation: ${validationResult.passed ? '✓ PASSED' : '❌ CHECK NEEDED'}`);

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

        // Check size limits - scale up for Showdown maps
        let maxSize, maxLength, maxThickness, minThickness, typeName;
        const sizeMultiplier = isShowdown ? 2.5 : 1;

        if (tile === TERRAIN_TYPES.WALL) {
          maxSize = Math.floor(20 * sizeMultiplier);
          maxLength = Math.floor(8 * sizeMultiplier);
          maxThickness = Math.floor(3 * sizeMultiplier);
          minThickness = 1;
          typeName = 'WALL';
        } else if (tile === TERRAIN_TYPES.GRASS) {
          maxSize = Math.floor(25 * sizeMultiplier);
          maxLength = Math.floor(10 * sizeMultiplier);
          maxThickness = Math.floor(4 * sizeMultiplier);
          minThickness = 1;
          typeName = 'BUSH';
        } else if (tile === TERRAIN_TYPES.WATER) {
          maxSize = Math.floor(25 * sizeMultiplier);
          maxLength = Math.floor(12 * sizeMultiplier);
          maxThickness = Math.floor(5 * sizeMultiplier);  // Max 5 tiles thick (12 for Showdown)
          minThickness = 2;  // Min 2 tiles thick - no single-tile protrusions
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
        if (dims.maxThickness < minThickness) {
          console.log(`  ERROR: ${typeName} at (${row}, ${col}) thickness ${dims.maxThickness} below min ${minThickness}`);
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

    // Region-based variety statistics
    console.log('\nRegion-based template variety:');
    for (let i = 0; i < NUM_REGIONS; i++) {
      const regionHistory = regionTemplateHistory[i];
      const uniqueTemplates = new Set(regionHistory).size;
      if (isShowdown) {
        const regionRow = Math.floor(i / 3);
        const regionCol = i % 3;
        console.log(`  Region ${i} (grid ${regionRow},${regionCol}): ${uniqueTemplates} unique templates used`);
      } else {
        const regionName = i === 0 ? 'Backside Top' : (i === 1 ? 'Mid Strip' : 'Backside Bottom');
        console.log(`  Region ${i} (${regionName}): ${uniqueTemplates} unique templates used`);
      }
    }

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

  // Helper function to check if coordinates are within map bounds
  const isValid = (row, col) => row >= 0 && row < CANVAS_HEIGHT && col >= 0 && col < CANVAS_WIDTH;

  // COMPLETE OTG DETECTION ALGORITHM
  // OTG = One Tile Gap - passages that are only 1 tile wide create movement problems
  // In shooter games, player and bullet hitboxes are typically larger than 1 tile (1.2-1.5 tiles wide)
  // This means passages that are only 1 tile wide cause players to get stuck or can't pass through
  const detectAllOTGs = (tiles) => {
    const otgs = [];

    // Helper: Check if a tile is a wall or water (blocking terrain)
    const isBlocking = (row, col) => {
      if (row < 0 || row >= CANVAS_HEIGHT || col < 0 || col >= CANVAS_WIDTH) {
        return true; // Map edges act as blocking walls for OTG detection
      }
      return tiles[row][col] === TERRAIN_TYPES.WALL || tiles[row][col] === TERRAIN_TYPES.WATER;
    };

    // Scan every walkable tile (empty tiles and bushes)
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        // Skip walls and water (only check walkable tiles: empty and bushes)
        const tile = tiles[row][col];
        if (tile === TERRAIN_TYPES.WALL || tile === TERRAIN_TYPES.WATER) continue;

        // Get all 8 neighbors
        const N  = isBlocking(row - 1, col);
        const S  = isBlocking(row + 1, col);
        const E  = isBlocking(row, col + 1);
        const W  = isBlocking(row, col - 1);
        const NE = isBlocking(row - 1, col + 1);
        const NW = isBlocking(row - 1, col - 1);
        const SE = isBlocking(row + 1, col + 1);
        const SW = isBlocking(row + 1, col - 1);

        let isOTG = false;
        let otgType = '';

        // === TYPE 1: Orthogonal Corridor (Classic OTG) ===
        // Pattern: [wall][empty][wall] horizontally or vertically
        if (N && S) {
          isOTG = true;
          otgType = 'vertical-corridor';
        }
        else if (E && W) {
          isOTG = true;
          otgType = 'horizontal-corridor';
        }

        // === TYPE 2: Diagonal OTG ===
        // Pattern: Walls positioned diagonally create narrow diagonal passages
        // This includes ALL 10 possible diagonal wall combinations:
        // - Opposite diagonal corners: NW&&SE, NE&&SW
        // - Orthogonal + diagonal: N&&SE, S&&NW, E&&SW, W&&NE, N&&SW, S&&NE, E&&NW, W&&SE
        //
        // Key insight: Diagonal passages are too narrow for player hitboxes even if
        // orthogonal directions are open. The diagonal squeeze makes movement impossible.
        //
        // IMPORTANT: Exclude L-shaped corners where two adjacent orthogonal walls exist
        // (e.g., N&&W, N&&E, S&&W, S&&E) as these don't create OTGs.
        else if ((NW && SE) || (NE && SW) ||
                 (N && SE) || (S && NW) || (E && SW) || (W && NE) ||
                 (N && SW) || (S && NE) || (E && NW) || (W && SE)) {
          // Check if this is an L-shaped corner (two adjacent orthogonal walls)
          // L-corners have walls on adjacent sides like N&&W, and don't create OTGs
          const isLCorner = (N && W) || (N && E) || (S && W) || (S && E);

          if (!isLCorner) {
            isOTG = true;
            // Determine specific type for debugging
            if (NW && SE) otgType = 'diagonal-nw-se';
            else if (NE && SW) otgType = 'diagonal-ne-sw';
            else if (N && SE) otgType = 'diagonal-n-se';
            else if (S && NW) otgType = 'diagonal-s-nw';
            else if (E && SW) otgType = 'diagonal-e-sw';
            else if (W && NE) otgType = 'diagonal-w-ne';
            else if (N && SW) otgType = 'diagonal-n-sw';
            else if (S && NE) otgType = 'diagonal-s-ne';
            else if (E && NW) otgType = 'diagonal-e-nw';
            else if (W && SE) otgType = 'diagonal-w-se';
          }
        }

        // === TYPE 3: Three-Sided Trap ===
        // Three orthogonal sides blocked creates a dead-end 1-tile passage
        else if ((N && E && W) || (N && E && S) || (N && W && S) || (E && W && S)) {
          isOTG = true;
          otgType = '3-sided-trap';
        }

        if (isOTG) {
          otgs.push({
            row,
            col,
            type: otgType,
            severity: 'critical'
          });
        }
      }
    }

    // === TYPE 4: Corner-Touch 2×2 Pattern ===
    // Special case: Two walls touching only at diagonal corner
    // Creates two 1-tile passages in the other corners
    for (let row = 0; row < CANVAS_HEIGHT - 1; row++) {
      for (let col = 0; col < CANVAS_WIDTH - 1; col++) {
        const TL = tiles[row][col];
        const TR = tiles[row][col + 1];
        const BL = tiles[row + 1][col];
        const BR = tiles[row + 1][col + 1];

        const isTLWall = TL === TERRAIN_TYPES.WALL || TL === TERRAIN_TYPES.WATER;
        const isTRWall = TR === TERRAIN_TYPES.WALL || TR === TERRAIN_TYPES.WATER;
        const isBLWall = BL === TERRAIN_TYPES.WALL || BL === TERRAIN_TYPES.WATER;
        const isBRWall = BR === TERRAIN_TYPES.WALL || BR === TERRAIN_TYPES.WATER;

        // Pattern 1: TL and BR are walls, TR and BL are empty
        if (isTLWall && isBRWall && !isTRWall && !isBLWall && TR === null && BL === null) {
          // The two empty tiles form 1-tile passages
          otgs.push({row: row, col: col + 1, type: '2x2-corner-touch', severity: 'critical'});
          otgs.push({row: row + 1, col: col, type: '2x2-corner-touch', severity: 'critical'});
        }

        // Pattern 2: TR and BL are walls, TL and BR are empty
        if (isTRWall && isBLWall && !isTLWall && !isBRWall && TL === null && BR === null) {
          otgs.push({row: row, col: col, type: '2x2-corner-touch', severity: 'critical'});
          otgs.push({row: row + 1, col: col + 1, type: '2x2-corner-touch', severity: 'critical'});
        }
      }
    }

    return otgs;
  };

  // FIX 6: Loading modal wrapper to prevent button spam with minimum display time
  const handleGenerateMap = async () => {
    // Set loading state BEFORE any generation logic starts
    setIsGenerating(true);
    const startTime = Date.now();
    const minDisplayTime = 900; // 900ms minimum display time

    try {
      // Small delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 50));

      // Run the actual generation
      generateRandomMap();

      // Calculate remaining time to meet minimum display duration
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);

      // Wait for remaining time to ensure modal is visible for minimum duration
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
    } catch (error) {
      console.error("Map generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearCanvas = () => {
    setTiles(Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null)));
  };

  const downloadMap = () => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH * CURRENT_TILE_SIZE;
    canvas.height = CANVAS_HEIGHT * CURRENT_TILE_SIZE;
    const ctx = canvas.getContext('2d');
    
    for (let row = 0; row < CANVAS_HEIGHT; row++) {
      for (let col = 0; col < CANVAS_WIDTH; col++) {
        const isEvenRow = row % 2 === 0;
        const isEvenCol = col % 2 === 0;
        const isLightSquare = (isEvenRow && isEvenCol) || (!isEvenRow && !isEvenCol);
        ctx.fillStyle = isLightSquare ? '#FFE4B3' : '#FFDAA3';
        ctx.fillRect(col * CURRENT_TILE_SIZE, row * CURRENT_TILE_SIZE, CURRENT_TILE_SIZE, CURRENT_TILE_SIZE);
        
        if (tiles[row][col]) {
          ctx.fillStyle = tiles[row][col];
          ctx.fillRect(col * CURRENT_TILE_SIZE, row * CURRENT_TILE_SIZE, CURRENT_TILE_SIZE, CURRENT_TILE_SIZE);
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
        {/* Left Sidebar */}
        <div className="flex flex-col gap-4 w-64">
          {/* Map Size */}
          <div className="bg-black bg-opacity-40 border border-cyan-400 border-opacity-50 rounded-lg p-4 backdrop-blur-sm">
            <label className="text-white font-semibold text-sm mb-2 block">Map Size</label>
            <select
              value={mapSize}
              onChange={(e) => {
                setMapSize(e.target.value);
                const newWidth = MAP_SIZES[e.target.value].width;
                const newHeight = MAP_SIZES[e.target.value].height;
                setTiles(Array(newHeight).fill(null).map(() => Array(newWidth).fill(null)));
              }}
              className="w-full bg-gray-800 text-white border border-cyan-400 border-opacity-30 rounded px-3 py-2 focus:outline-none focus:border-cyan-400"
            >
              {Object.entries(MAP_SIZES).map(([key, value]) => (
                <option key={key} value={key}>{value.name}</option>
              ))}
            </select>
          </div>

          {/* Clear Map Button */}
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the map? This cannot be undone.')) {
                setTiles(Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill(null)));
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <span style={{ fontSize: '18px' }}>🗑️</span>
            Clear Map
          </button>

          {/* Download Map Button */}
          <button
            onClick={downloadMap}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <span style={{ fontSize: '18px' }}>⬇️</span>
            Download Map
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 flex-1">
          <div className="relative inline-block">
            <div
              ref={canvasRef}
              className="inline-block border-4 border-purple-400 border-opacity-50 shadow-2xl touch-none"
              style={{
                background: '#FFE4B3',
                userSelect: 'none',
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease'
              }}
            >
              {(() => {
                // Calculate OTGs once if debug mode is enabled
                const otgSet = showOTGDebug ? new Set(
                  detectAllOTGs(tiles).map(otg => `${otg.row},${otg.col}`)
                ) : new Set();

                return tiles.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex">
                    {row.map((tile, colIndex) => {
                      const isEvenRow = rowIndex % 2 === 0;
                      const isEvenCol = colIndex % 2 === 0;
                      const isLightSquare = (isEvenRow && isEvenCol) || (!isEvenRow && !isEvenCol);
                      const isOTG = showOTGDebug && otgSet.has(`${rowIndex},${colIndex}`);

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
                            width: CURRENT_TILE_SIZE + 'px',
                            height: CURRENT_TILE_SIZE + 'px',
                            backgroundColor: tile || (isLightSquare ? '#FFE4B3' : '#FFDAA3'),
                            border: '0.5px solid rgba(0,0,0,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            position: 'relative'
                          }}
                        >
                          {isOTG && <span style={{ position: 'absolute', zIndex: 10 }}>❌</span>}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-3 w-full max-w-md bg-black bg-opacity-40 border border-purple-400 border-opacity-50 rounded-lg p-3 backdrop-blur-sm">
            <button
              onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg transition-colors"
            >
              -
            </button>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.25"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-purple-500"
            />
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg transition-colors"
            >
              +
            </button>
            <span className="text-white font-semibold min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Generate and Settings Buttons */}
          <div className="flex gap-2 w-full max-w-md">
            <button
              onClick={handleGenerateMap}
              disabled={isGenerating}
              className={`flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                isGenerating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span style={{ fontSize: '20px' }}>🪄</span>
              {isGenerating ? 'Generating...' : 'Generate Map'}
            </button>
            <button
              onClick={() => setSlidersOpen(!slidersOpen)}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
              title="Settings"
            >
              <span style={{ fontSize: '20px' }}>⚙️</span>
            </button>
          </div>

          {/* Density Settings (Collapsible) */}
          {slidersOpen && (
            <div className="bg-black bg-opacity-40 border border-purple-400 border-opacity-50 rounded-lg w-full max-w-md backdrop-blur-sm p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <span style={{ fontSize: '18px' }}>⚙️</span>
                Tile Density Settings
              </h3>
              <div className="space-y-3">
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
            </div>
          )}

          {/* Map Code Export Section */}
          <div className="bg-black bg-opacity-40 border border-purple-400 border-opacity-50 rounded-lg w-full max-w-md backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: '20px' }}>📋</span>
              <h3 className="text-white font-semibold">Map Code (for sharing)</h3>
            </div>

            <textarea
              id="map-code-textarea"
              value={mapCode}
              readOnly
              rows={35}
              className="w-full p-2 rounded bg-gray-900 text-white border border-purple-400 border-opacity-30 resize-none overflow-auto"
              style={{ fontFamily: "'Courier New', 'Courier', monospace", fontSize: '8px', lineHeight: '1.2', whiteSpace: 'pre' }}
              placeholder="Map code will appear here after generation..."
            />

            <button
              onClick={copyMapCode}
              className="w-full mt-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <span style={{ fontSize: '16px' }}>📋</span>
              Copy Map Code
            </button>
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
                className={`w-10 h-10 rounded-lg border-2 transition-all relative ${
                  selectedTool === TERRAIN_TYPES.WALL
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:border-gray-400'
                }`}
                style={{ backgroundColor: TERRAIN_TYPES.WALL }}
                title="Wall"
              >
                <span className="absolute bottom-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1 rounded-tl">
                  {tileCounts.wallCount}
                </span>
              </button>
              <button
                onClick={() => setSelectedTool(TERRAIN_TYPES.WATER)}
                className={`w-10 h-10 rounded-lg border-2 transition-all relative ${
                  selectedTool === TERRAIN_TYPES.WATER
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:border-gray-400'
                }`}
                style={{ backgroundColor: TERRAIN_TYPES.WATER }}
                title="Water"
              >
                <span className="absolute bottom-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1 rounded-tl">
                  {tileCounts.waterCount}
                </span>
              </button>
              <button
                onClick={() => setSelectedTool(TERRAIN_TYPES.GRASS)}
                className={`w-10 h-10 rounded-lg border-2 transition-all relative ${
                  selectedTool === TERRAIN_TYPES.GRASS
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:border-gray-400'
                }`}
                style={{ backgroundColor: TERRAIN_TYPES.GRASS }}
                title="Grass"
              >
                <span className="absolute bottom-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1 rounded-tl">
                  {tileCounts.grassCount}
                </span>
              </button>
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
                onClick={() => setShowOTGDebug(!showOTGDebug)}
                className={`w-10 h-10 rounded-lg transition-all flex items-center justify-center text-xs font-bold ${
                  showOTGDebug
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title="Show OTGs (Debug Mode)"
              >
                OTG
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* FIX 6: Loading Modal */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-purple-900 border-2 border-purple-400 rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-400 border-t-transparent"></div>
            <p className="text-white text-xl font-semibold">Generating Map...</p>
            <p className="text-purple-300 text-sm">Please wait</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Make component available globally for browser usage
window.MapGenerator = MapGenerator;
