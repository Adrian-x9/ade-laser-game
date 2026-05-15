import { StateManager } from '../state/StateManager';
import { UIController } from '../ui/UIController';
import { 
  Direction, 
  Emitter, 
  GridElement, 
  LaserColor, 
  RaySegment, 
  Receiver 
} from '../types/index';

export class GameEngine {
  private stateManager: StateManager;
  private uiController: UIController;
  private timerInterval: number | null = null;

  constructor(stateManager: StateManager, uiController: UIController) {
    this.stateManager = stateManager;
    this.uiController = uiController;
    this.uiController.onAction = this.handleUIAction.bind(this);
  }

  public boot(): void {
    this.uiController.init();
    this.uiController.render(this.stateManager.getState());
  }

  private handleUIAction(action: string): void {
    const currentState = this.stateManager.getState();

    if (action === 'TOGGLE_DARK_MODE') {
      this.stateManager.updateState({ isDarkMode: !currentState.isDarkMode });
      this.uiController.render(this.stateManager.getState());
      return;
    }

    if (action === 'NEW_GAME' || action === 'START_GAME') {
      this.startGame();
      return;
    }

    if (action === 'CHANGE_LANG') {
      const langs: ('EN' | 'PL' | 'DE')[] = ['EN', 'PL', 'DE'];
      const nextIndex = (langs.indexOf(currentState.lang) + 1) % langs.length;
      this.stateManager.updateState({ lang: langs[nextIndex] });
      this.uiController.render(this.stateManager.getState());
      return;
    }

    // --- KLIKNIĘCIE W KAFELEK -> OBRÓT ELEMENTU ---
    if (action.startsWith('ROTATE_CELL:') && currentState.status === 'PLAYING') {
      const cellIndex = parseInt(action.split(':')[1], 10);
      this.rotateCell(cellIndex);
      return;
    }

    // --- STRZAŁ TESTOWY / WERYFIKACJA / KONTYNUACJA ---
    if (action === 'TEST_FIRE') {
      if (currentState.status === 'PLAYING') {
        this.verifyOpticalCircuit();
      } else if (currentState.status === 'WIN' || currentState.status === 'GAME_OVER') {
        this.startGame();
      }
      return;
    }

    // --- RIVAL MODE ---
    if (action.startsWith('RIVAL_SUBMIT:')) {
      const rivalCode = action.substring('RIVAL_SUBMIT:'.length).trim();
      this.decodeAndApplyRivalCode(rivalCode);
      return;
    }

    if (action === 'RIVAL_END') {
      this.stateManager.updateState({ rivalScore: null, rivalLevel: null });
      this.uiController.render(currentState);
      return;
    }

    // --- CHEATS & DEV ---
    if (action === 'DEV_NEXT_LEVEL' && currentState.status === 'PLAYING') {
      if (this.timerInterval) clearInterval(this.timerInterval);
      const nextLvl = currentState.level + 1;
      this.stateManager.updateState({
        status: 'WIN',
        level: nextLvl,
        bestLevel: Math.max(currentState.bestLevel || 1, nextLvl)
      });
      this.uiController.render(this.stateManager.getState());
      return;
    }

    if (action === 'DEV_RESET_BEST') {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.stateManager.factoryReset();
      if (typeof window !== 'undefined' && (window as any).__beamsResetBanner) {
        (window as any).__beamsResetBanner();
      }
      this.startGame();
      return;
    }

    // --- TAKTYCZNY ZAPIS / ODCZYT ---
    if (action === 'TACTICAL_SAVE' && currentState.status === 'PLAYING' && currentState.savesLeft > 0) {
      const snapshot = JSON.stringify({
        grid: currentState.grid.map(g => ({ ...g })),
        time: currentState.time,
        totalTime: currentState.totalTime,
        level: currentState.level,
        savesLeft: currentState.savesLeft,
        loadsLeft: currentState.loadsLeft
      });
      this.stateManager.updateState({ savedSnapshot: snapshot, savesLeft: currentState.savesLeft - 1 });
      this.uiController.render(this.stateManager.getState());
      return;
    }

    if (action === 'TACTICAL_LOAD' && currentState.status === 'PLAYING' && currentState.loadsLeft > 0 && currentState.savedSnapshot) {
      try {
        const parsed = JSON.parse(currentState.savedSnapshot);
        this.stateManager.updateState({
          grid: parsed.grid,
          time: parsed.time,
          totalTime: parsed.totalTime ?? currentState.totalTime,
          level: parsed.level,
          savesLeft: parsed.savesLeft ?? currentState.savesLeft,
          loadsLeft: currentState.loadsLeft - 1
        });
        this.recalculateRays();
        this.uiController.render(this.stateManager.getState());
      } catch (e) {
        console.error("Tactical Load Error:", e);
      }
      return;
    }

    // --- SURVIVAL RESET ---
    if (action === 'RESET_PATH' && currentState.status === 'PLAYING') {
      const remainingLives = currentState.lives - 1;
      if (remainingLives <= 0) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.stateManager.updateState({ status: 'GAME_OVER', lives: 0 });
      } else {
        const resGrid = currentState.grid.map(g => ({ ...g, rotation: 0 }));
        this.stateManager.updateState({ grid: resGrid, lives: remainingLives, time: 0 });
        this.recalculateRays();
        this.startTimer();
      }
      this.uiController.render(this.stateManager.getState());
      return;
    }
  }

  private startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const state = this.stateManager.getState();
      if (state.status === 'PLAYING') {
        const newTime = state.time + 1;
        const newTotalTime = state.totalTime + 1;
        this.stateManager.updateState({ time: newTime, totalTime: newTotalTime });
        this.uiController.updateTimer(newTime, newTotalTime);
      } else {
        if (this.timerInterval) clearInterval(this.timerInterval);
      }
    }, 1000) as unknown as number;
  }

  private startGame(): void {
    const state = this.stateManager.getState();
    const isNewGame = state.status === 'IDLE' || state.status === 'GAME_OVER';
    const currentLevel = isNewGame ? 1 : state.level;

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.uiController.showLoading(state.lang);

    setTimeout(() => {
      // Skalowanie trudności i rozmiaru siatki
      const cols = currentLevel <= 3 ? 5 : (currentLevel <= 8 ? 6 : 7);
      const rows = cols;

      const { grid, emitters, receivers } = this.generateOpticalPuzzle(currentLevel, cols, rows);

      this.stateManager.updateState({
        status: 'PLAYING',
        cols,
        rows,
        grid,
        emitters,
        receivers,
        score: isNewGame ? 0 : state.score,
        level: currentLevel,
        time: 0,
        ...(isNewGame ? { lives: 3, savesLeft: 3, loadsLeft: 3, totalTime: 0 } : {})
      });

      this.recalculateRays();
      this.uiController.render(this.stateManager.getState());
      this.startTimer();
    }, 50);
  }

  private rotateCell(index: number): void {
    const state = this.stateManager.getState();
    const cell = state.grid[index];
    if (!cell || cell.type === 'EMPTY' || cell.type === 'MINE') return;

    const updatedGrid = state.grid.map((elem, idx) => 
      idx === index ? { ...elem, rotation: (elem.rotation + 90) % 360 } : elem
    );

    this.stateManager.updateState({ grid: updatedGrid });
    this.recalculateRays();
    
    // 1. Sprawdzanie min optycznych (natychmiastowa śmierć)
    if (this.checkInstantHazards()) return; 

    const newState = this.stateManager.getState();
    const { cols, rows, receivers, rays } = newState;

    // 2. NOWOŚĆ: BEZLITOSNE ŚCIANY (Wall Penalty)
    let rayHitEmptyWall = false;

    // Analizujemy wszystkie promienie z nowego stanu
    rays.forEach(ray => {
      let hitWall = false;
      let hitRow = -1;
      let hitCol = -1;

      // Sprawdzamy czy promień wypadł POZA siatkę na którejś z 4 krawędzi
      if (ray.x2 >= cols && ray.x1 < ray.x2) { hitWall = true; hitRow = Math.floor(ray.y2); } // Prawa krawędź
      else if (ray.x2 <= 0 && ray.x1 > ray.x2) { hitWall = true; hitRow = Math.floor(ray.y2); } // Lewa krawędź
      else if (ray.y2 >= rows && ray.y1 < ray.y2) { hitWall = true; hitCol = Math.floor(ray.x2); } // Dolna krawędź
      else if (ray.y2 <= 0 && ray.y1 > ray.y2) { hitWall = true; hitCol = Math.floor(ray.x2); } // Górna krawędź

      if (hitWall) {
        // Sprawdzamy czy w tym miejscu JEST jakiś odbiornik
        const hasReceiver = receivers.some(rec => {
          if (rec.index < rows) {
            // Odbiorniki na wierszach (lewo/prawo)
            return rec.index === hitRow;
          } else {
            // Odbiorniki na kolumnach (góra/dół)
            return (rec.index - rows) === hitCol;
          }
        });

        if (!hasReceiver) {
          rayHitEmptyWall = true;
        }
      }
    });

    if (rayHitEmptyWall) {
      this.punishPlayer("Wiązka laserowa trafiła w pustą ścianę i uległa rozproszeniu!");
      return; 
    }

    // 3. Automatyczne sprawdzanie wygranej (jeśli przeżył miny i ściany)
    const allSatisfied = newState.receivers.every(r => r.isSatisfied);
    
    if (allSatisfied) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      const timeBonus = Math.max(0, 150 - newState.time * 2); 
      const nextLvl = newState.level + 1;

      this.stateManager.updateState({
        status: 'WIN',
        score: newState.score + 150 + (newState.level * 30) + timeBonus,
        level: nextLvl,
        bestLevel: Math.max(newState.bestLevel, nextLvl)
      });
    }

    this.uiController.render(this.stateManager.getState());
  }

  // Lekka korekta checkInstantHazards aby zwracała boolean
  private checkInstantHazards(): boolean {
    const state = this.stateManager.getState();
    let hitMine = false;
    state.grid.forEach((cell, idx) => {
      if (cell.type === 'MINE') {
        const r = Math.floor(idx / state.cols);
        const c = idx % state.cols;
        if (state.rays.some(ray => Math.floor(ray.x1) === c && Math.floor(ray.y1) === r)) hitMine = true;
      }
    });

    if (hitMine) {
      this.punishPlayer("Wiązka laserowa omiotła minę optyczną!");
      return true;
    }
    return false;
  }

  // --- SILNIK RAYCASTINGU (Dwusegmentowy) ---
  private simulateRays(grid: GridElement[], emitters: Emitter[], cols: number, rows: number): RaySegment[] {
    const rays: RaySegment[] = [];
    const MAX_STEPS = 100;
    const visited = new Set<string>();
    interface ActiveRay { r: number; c: number; dir: Direction; color: LaserColor; steps: number; }
    const queue: ActiveRay[] = [];

    emitters.forEach(em => {
      let startR = 0, startC = 0;
      if (em.direction === 'RIGHT') { startR = em.index; startC = 0; }
      else if (em.direction === 'LEFT') { startR = em.index; startC = cols - 1; }
      else if (em.direction === 'DOWN') { startR = 0; startC = em.index; }
      else if (em.direction === 'UP') { startR = rows - 1; startC = em.index; }
      queue.push({ r: startR, c: startC, dir: em.direction, color: em.color, steps: 0 });
    });

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.steps > MAX_STEPS) continue;
      if (curr.r < 0 || curr.r >= rows || curr.c < 0 || curr.c >= cols) continue;

      const stateKey = `${curr.r},${curr.c},${curr.dir},${curr.color}`;
      if (visited.has(stateKey)) continue;
      visited.add(stateKey);

      const x1 = curr.c + 0.5;
      const y1 = curr.r + 0.5;

      let sx = x1, sy = y1;
      if (curr.dir === 'RIGHT') sx = curr.c;
      if (curr.dir === 'LEFT') sx = curr.c + 1;
      if (curr.dir === 'DOWN') sy = curr.r;
      if (curr.dir === 'UP') sy = curr.r + 1;

      rays.push({ x1: sx, y1: sy, x2: x1, y2: y1, color: curr.color });

      const cell = grid[curr.r * cols + curr.c];
      const nextRays: { dir: Direction; color: LaserColor }[] = [];

      if (cell.type === 'EMPTY') {
        nextRays.push({ dir: curr.dir, color: curr.color });
      } else if (cell.type === 'MIRROR_1') {
        const outDir = this.reflectRay(curr.dir, cell.rotation === 0 || cell.rotation === 180);
        if (outDir) nextRays.push({ dir: outDir, color: curr.color });
      } else if (cell.type === 'MIRROR_2') {
        const outDir = this.reflectRay(curr.dir, cell.rotation === 90 || cell.rotation === 270);
        if (outDir) nextRays.push({ dir: outDir, color: curr.color });
      } else if (cell.type === 'SPLITTER') {
        nextRays.push({ dir: curr.dir, color: curr.color });
        const splitDir = this.reflectRay(curr.dir, cell.rotation === 0 || cell.rotation === 180);
        if (splitDir) nextRays.push({ dir: splitDir, color: curr.color });
      }

      nextRays.forEach(nr => {
        let ex = x1, ey = y1;
        let nextR = curr.r, nextC = curr.c;
        if (nr.dir === 'RIGHT') { ex = curr.c + 1; nextC++; }
        else if (nr.dir === 'LEFT') { ex = curr.c; nextC--; }
        else if (nr.dir === 'DOWN') { ey = curr.r + 1; nextR++; }
        else if (nr.dir === 'UP') { ey = curr.r; nextR--; }

        rays.push({ x1, y1, x2: ex, y2: ey, color: nr.color });
        queue.push({ r: nextR, c: nextC, dir: nr.dir, color: nr.color, steps: curr.steps + 1 });
      });
    }
    return rays;
  }

  // --- ZMIENIONE PRZELICZANIE (Automatycznie sprawdza cele!) ---
  private recalculateRays(): void {
    const state = this.stateManager.getState();
    const rays = this.simulateRays(state.grid, state.emitters, state.cols, state.rows);
    
    // Sprawdzamy satysfakcję odbiorników w locie!
    const updatedReceivers = state.receivers.map(rec => {
      const isSatisfied = this.checkReceiverSatisfied(rec, rays, state.cols, state.rows);
      return { ...rec, isSatisfied };
    });

    this.stateManager.updateState({ rays, receivers: updatedReceivers });
  }

  // Helper do sprawdzania pojedynczego odbiornika
  private checkReceiverSatisfied(rec: Receiver, rays: RaySegment[], cols: number, rows: number): boolean {
    const incomingColors = new Set<LaserColor>();
    rays.forEach(ray => {
      if (rec.index < rows) {
        if (ray.x2 === cols && Math.floor(ray.y2) === rec.index && ray.x1 < ray.x2) incomingColors.add(ray.color);
        if (ray.x2 === 0 && Math.floor(ray.y2) === rec.index && ray.x1 > ray.x2) incomingColors.add(ray.color);
      } else {
        const targetCol = rec.index - rows;
        if (ray.y2 === rows && Math.floor(ray.x2) === targetCol && ray.y1 < ray.y2) incomingColors.add(ray.color);
        if (ray.y2 === 0 && Math.floor(ray.x2) === targetCol && ray.y1 > ray.y2) incomingColors.add(ray.color);
      }
    });
    return this.blendColors(Array.from(incomingColors)) === rec.targetColor;
  }

  // Precyzyjna fizyka luster (zastępuje Twoje traceRay)
  private reflectRay(inDir: Direction, isSlash: boolean): Direction | null {
    if (isSlash) {
      if (inDir === 'RIGHT') return 'UP';
      if (inDir === 'DOWN') return 'LEFT';
      if (inDir === 'LEFT') return 'DOWN';
      if (inDir === 'UP') return 'RIGHT';
    } else {
      if (inDir === 'RIGHT') return 'DOWN';
      if (inDir === 'UP') return 'LEFT';
      if (inDir === 'LEFT') return 'UP';
      if (inDir === 'DOWN') return 'RIGHT';
    }
    return null;
  }

  // --- WERYFIKACJA LOGIKI ZWYCIĘSTWA I MIESZANIA RGB ---
  private verifyOpticalCircuit(): void {
    const state = this.stateManager.getState();
    if (state.status !== 'PLAYING') return;

    const { cols, rows, grid, receivers } = state;

    // Najpierw sprawdzamy miny (detonacja przy wciśnięciu TEST FIRE)
    let hitMine = false;
    grid.forEach((cell, idx) => {
      if (cell.type === 'MINE') {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const rayEnters = state.rays.some(ray => 
          Math.floor(ray.x1) === c && Math.floor(ray.y1) === r
        );
        if (rayEnters) hitMine = true;
      }
    });

    if (hitMine) {
      this.punishPlayer("Promień lasera zdestabilizował minę optyczną!");
      return;
    }

    let allSatisfied = true;
    const updatedReceivers = receivers.map(rec => {
      const incomingColors = new Set<LaserColor>();

      state.rays.forEach(ray => {
        if (rec.index < rows) { // Odbiorniki na lewej/prawej flance
          const targetRow = rec.index;
          if (ray.x2 === cols && Math.floor(ray.y2) === targetRow && ray.x1 < ray.x2) {
            incomingColors.add(ray.color);
          }
          if (ray.x2 === 0 && Math.floor(ray.y2) === targetRow && ray.x1 > ray.x2) {
            incomingColors.add(ray.color);
          }
        }
        if (rec.index >= rows) { // Odbiorniki góra/dół
          const targetCol = rec.index - rows;
          if (ray.y2 === rows && Math.floor(ray.x2) === targetCol && ray.y1 < ray.y2) {
            incomingColors.add(ray.color);
          }
          if (ray.y2 === 0 && Math.floor(ray.x2) === targetCol && ray.y1 > ray.y2) {
            incomingColors.add(ray.color);
          }
        }
      });

      const blendedColor = this.blendColors(Array.from(incomingColors));
      const isSatisfied = blendedColor === rec.targetColor;
      if (!isSatisfied) allSatisfied = false;

      return { ...rec, isSatisfied };
    });

    this.stateManager.updateState({ receivers: updatedReceivers });
    this.uiController.render(this.stateManager.getState());

    if (allSatisfied) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      const timeBonus = Math.max(0, 100 - state.time);
      const nextLvl = state.level + 1;

      this.stateManager.updateState({
        status: 'WIN',
        score: state.score + 150 + (state.level * 20) + timeBonus,
        level: nextLvl,
        bestLevel: Math.max(state.bestLevel, nextLvl)
      });
      this.uiController.render(this.stateManager.getState());
    } else {
      this.punishPlayer("Układ optyczny nie dostarcza prawidłowych długości fali do celów!");
    }
  }

  private blendColors(colors: LaserColor[]): LaserColor | null {
    if (colors.length === 0) return null;
    const hasR = colors.includes('R') || colors.includes('M') || colors.includes('Y') || colors.includes('W');
    const hasG = colors.includes('G') || colors.includes('C') || colors.includes('Y') || colors.includes('W');
    const hasB = colors.includes('B') || colors.includes('M') || colors.includes('C') || colors.includes('W');

    if (hasR && hasG && hasB) return 'W';
    if (hasR && hasG) return 'Y';
    if (hasR && hasB) return 'M';
    if (hasG && hasB) return 'C';
    if (hasR) return 'R';
    if (hasG) return 'G';
    if (hasB) return 'B';
    return null;
  }

  private punishPlayer(reason: string): void {
    const state = this.stateManager.getState();
    console.log(`Błąd optyczny: ${reason}`);
    
    const remainingLives = state.lives - 1;
    if (remainingLives <= 0) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.stateManager.updateState({ status: 'GAME_OVER', lives: 0 });
    } else {
      this.stateManager.updateState({ lives: remainingLives });
    }
    this.uiController.render(this.stateManager.getState());
  }

 private generateOpticalPuzzle(level: number, cols: number, rows: number) {
    const totalCells = cols * rows;
    const grid: GridElement[] = Array(totalCells).fill(null).map(() => ({ type: 'EMPTY', rotation: 0 }));

    const emitters: Emitter[] = [{ index: 0, color: 'R', direction: 'RIGHT' }];
    if (level >= 2) emitters.push({ index: Math.floor(rows / 2), color: 'G', direction: 'RIGHT' });
    if (level >= 4) emitters.push({ index: rows - 1, color: 'B', direction: 'RIGHT' });

    const receivers: Receiver[] = [];
    const usedCells = new Set<number>();
    const claimedRows = new Map<number, LaserColor>();
    
    emitters.forEach(em => claimedRows.set(em.index, em.color));

    emitters.forEach(em => {
      let r = em.index;
      let c = 0;

      while (c < cols) {
        const wasAlreadyUsed = usedCells.has(r * cols + c);
        usedCells.add(r * cols + c);

        // Zwiększona szansa zmiany wiersza (60% zamiast 40%) - trudniejsza gra
        if (c < cols - 1 && Math.random() < 0.60 && !wasAlreadyUsed) {
          const availableRows: number[] = [];
          
          for (let nextR = 0; nextR < rows; nextR++) {
            if (nextR !== r) {
              if (!claimedRows.has(nextR) || claimedRows.get(nextR) === em.color) {
                let shaftClear = true;
                const minR = Math.min(r, nextR);
                const maxR = Math.max(r, nextR);
                
                for (let stepR = minR; stepR <= maxR; stepR++) {
                  if (grid[stepR * cols + c].type !== 'EMPTY') {
                    shaftClear = false;
                    break;
                  }
                }
                
                if (shaftClear) {
                  availableRows.push(nextR);
                }
              }
            }
          }

          if (availableRows.length > 0) {
            const targetR = availableRows[Math.floor(Math.random() * availableRows.length)];
            claimedRows.set(targetR, em.color);
            
            const goesDown = targetR > r;

            grid[r * cols + c] = { type: 'MIRROR_1', rotation: goesDown ? 90 : 0 };
            grid[targetR * cols + c] = { type: goesDown ? 'MIRROR_2' : 'MIRROR_1', rotation: goesDown ? 0 : 0 };
            
            const minR = Math.min(r, targetR);
            const maxR = Math.max(r, targetR);
            for (let stepR = minR; stepR <= maxR; stepR++) {
              usedCells.add(stepR * cols + c);
            }

            r = targetR;
          }
        }
        c++; 
      }

      receivers.push({ index: r, targetColor: em.color, isSatisfied: false });
    });

    // Zwiększona gęstość przeszkód - grą jest trudniejsza
    grid.forEach((cell, idx) => {
      if (!usedCells.has(idx)) {
        const noiseChance = Math.min(0.40 + (level * 0.08), 0.90);
        if (Math.random() < noiseChance) {
          if (level >= 4 && Math.random() < 0.35) cell.type = 'SPLITTER';
          else if (level >= 3 && Math.random() < 0.45) cell.type = 'MINE';
          else cell.type = Math.random() < 0.5 ? 'MIRROR_1' : 'MIRROR_2';
        }
      }
    });

    // ZABEZPIECZENIE PRZED AUTO-WIN:
    let isSolved = true;
    let safetyNet = 0;
    while (isSolved && safetyNet < 20) {
      grid.forEach(cell => {
        if (cell.type === 'MIRROR_1' || cell.type === 'MIRROR_2' || cell.type === 'SPLITTER') {
          const rotations = [0, 90, 180, 270];
          cell.rotation = rotations[Math.floor(Math.random() * rotations.length)];
        }
      });
      // Testujemy promienie "na sucho" bez zmiany stanu
      const testRays = this.simulateRays(grid, emitters, cols, rows);
      // Szukamy, czy CHOĆ JEDEN odbiornik jest przypadkiem trafiony na start
      isSolved = receivers.some(rec => this.checkReceiverSatisfied(rec, testRays, cols, rows));
      safetyNet++;
    }

    return { grid, emitters, receivers };
  }

  // Kodowanie rekordu do stringa (dla rywalizacji)
 public encodeRivalCode(bestScore: number, bestLevel: number): string {
    return btoa(`LASER:${bestScore}:${bestLevel}:${Date.now()}`); // <--- Było BEAMS
  }

  // Dekodowanie i weryfikacja kodu rywala
  private decodeAndApplyRivalCode(code: string): void {
    try {
      const decoded = atob(code);
      const parts = decoded.split(':');
      if (parts[0] !== 'LASER' || parts.length < 3) throw new Error('Invalid code'); // <--- Było BEAMS
      
      const rivalScore = parseInt(parts[1], 10);
      const rivalLevel = parseInt(parts[2], 10);
      
      if (isNaN(rivalScore) || isNaN(rivalLevel)) throw new Error('Invalid numbers');
      
      this.stateManager.updateState({
        rivalScore,
        rivalLevel
      });
      
      this.uiController.render(this.stateManager.getState());
    } catch (e) {
      console.error('Failed to decode rival code:', e);
      alert('❌ Invalid code format!');
    }
  }

  public getRivalCode(): string {
    const state = this.stateManager.getState();
    return this.encodeRivalCode(state.bestScore, state.bestLevel);
  }
}
