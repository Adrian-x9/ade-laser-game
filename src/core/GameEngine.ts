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
      if (typeof window !== 'undefined' && window.__patchesResetBanner) {
        window.__patchesResetBanner();
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
        // Przeliczamy promienie dla wczytanego stanu
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
        // Resetujemy obroty elementów do zera
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
    
    // Puste pola i miny nie reagują na obrót
    if (!cell || cell.type === 'EMPTY' || cell.type === 'MINE') return;

    // Obracamy o 90 stopni w prawo
    const updatedGrid = state.grid.map((elem, idx) => 
      idx === index ? { ...elem, rotation: (elem.rotation + 90) % 360 } : elem
    );

    this.stateManager.updateState({ grid: updatedGrid });
    this.recalculateRays();
    
    // NOWOŚĆ: Aktywne Zagrożenia. Sprawdzamy, czy laser po obrocie nie zdetonował miny!
    this.checkInstantHazards();
    
    this.uiController.render(this.stateManager.getState());
  }

  // Funkcja sprawdzająca natychmiastowe zwarcia podczas rekonfiguracji w locie
  private checkInstantHazards(): void {
    const state = this.stateManager.getState();
    if (state.status !== 'PLAYING') return;
    
    let hitMine = false;
    state.grid.forEach((cell, idx) => {
      if (cell.type === 'MINE') {
        const r = Math.floor(idx / state.cols);
        const c = idx % state.cols;
        // Jeśli jakikolwiek promień przecina pole z miną po obrocie lustra
        const rayEnters = state.rays.some(ray => 
          Math.floor(ray.x1) === c && Math.floor(ray.y1) === r
        );
        if (rayEnters) hitMine = true;
      }
    });

    if (hitMine) {
      this.punishPlayer("Wiązka laserowa omiotła minę optyczną podczas rekonfiguracji!");
    }
  }

  // --- SILNIK RAYCASTINGU (Śledzenie promieni w locie) ---
  private recalculateRays(): void {
    const state = this.stateManager.getState();
    const { cols, rows, grid, emitters } = state;
    const rays: RaySegment[] = [];

    // Zabezpieczenie przed nieskończoną pętlą (np. zapętlone lustra)
    const MAX_STEPS = 100;
    // Zapamiętujemy odwiedzone stany promienia: "row,col,dir,color"
    const visited = new Set<string>();

    interface ActiveRay {
      r: number;
      c: number;
      dir: Direction;
      color: LaserColor;
      steps: number;
    }

    const queue: ActiveRay[] = [];

    // Inicjalizacja promieni startowych z emiterów
    emitters.forEach(em => {
      // Określamy komórkę wejściową na siatce na podstawie kierunku strzału działka
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

      // Sprawdzamy wyjście poza planszę
      if (curr.r < 0 || curr.r >= rows || curr.c < 0 || curr.c >= cols) continue;

      const stateKey = `${curr.r},${curr.c},${curr.dir},${curr.color}`;
      if (visited.has(stateKey)) continue;
      visited.add(stateKey);

      // Środek bieżącego kafelka (względne koordynaty dla celów rysowania)
      const x1 = curr.c + 0.5;
      const y1 = curr.r + 0.5;

      // Określamy punkt startowy segmentu (skąd wszedł na kafelek)
      let sx = x1, sy = y1;
      if (curr.dir === 'RIGHT') sx = curr.c;
      if (curr.dir === 'LEFT') sx = curr.c + 1;
      if (curr.dir === 'DOWN') sy = curr.r;
      if (curr.dir === 'UP') sy = curr.r + 1;

      // Dodajemy pierwszą połowę wiązki (wejście do środka kafelka)
      rays.push({ x1: sx, y1: sy, x2: x1, y2: y1, color: curr.color });

      // Sprawdzamy interakcję z elementem optycznym na kafelku
      const cell = grid[curr.r * cols + curr.c];
      const nextRays: { dir: Direction; color: LaserColor }[] = [];

      if (cell.type === 'MINE') {
        // Promień uderza w minę – urywa się w środku (brak wyjścia)
        continue;
      } else if (cell.type === 'EMPTY') {
        // Przelatuje swobodnie dalej
        nextRays.push({ dir: curr.dir, color: curr.color });
      } else if (cell.type === 'MIRROR_1') {
        // Lustro typu '/' (zależnie od rotacji zachowuje się jak '/' lub '\')
        const isSlash = cell.rotation === 0 || cell.rotation === 180;
        const outDir = this.reflectRay(curr.dir, isSlash);
        if (outDir) nextRays.push({ dir: outDir, color: curr.color });
      } else if (cell.type === 'MIRROR_2') {
        // Lustro typu '\'
        const isSlash = cell.rotation === 90 || cell.rotation === 270;
        const outDir = this.reflectRay(curr.dir, isSlash);
        if (outDir) nextRays.push({ dir: outDir, color: curr.color });
      } else if (cell.type === 'SPLITTER') {
        // Pryzmat rozszczepia promień na kierunek bieżący oraz odbity pod kątem 90 st.
        // Rotacja określa, w którą stronę następuje odchylenie wtórne
        nextRays.push({ dir: curr.dir, color: curr.color }); // Przechodzi prosto
        
        const splitSlash = cell.rotation === 0 || cell.rotation === 180;
        const splitDir = this.reflectRay(curr.dir, splitSlash);
        if (splitDir) nextRays.push({ dir: splitDir, color: curr.color });
      }

      // Dla każdego wygenerowanego promienia wyjściowego rysujemy resztę wiązki i wrzucamy do kolejki
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

    this.stateManager.updateState({ rays });
  }

  // Oblicza kierunek odbicia od lustra
  private reflectRay(inDir: Direction, isSlash: boolean): Direction | null {
    // isSlash == true oznacza lustro w orientacji '/'
    // isSlash == false oznacza lustro w orientacji '\'
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

  // --- WERYFIKACJA LOGIKI RGB I WARUNKÓW ZWYCIĘSTWA ---
  private verifyOpticalCircuit(): void {
    const state = this.stateManager.getState();
    const { cols, rows, grid, receivers } = state;

    // 1. Sprawdzamy, czy jakikolwiek promień dotknął miny
    // Odczytujemy to analizując, czy w komórkach z minami kończy się promień
    // Dla uproszczenia: jeśli promień wszedł na pole z miną, następuje zwarcie.
    let hitMine = false;
    grid.forEach((cell, idx) => {
      if (cell.type === 'MINE') {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        // Sprawdzamy, czy segment promienia przecina ten kafelek
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

    // 2. Analizujemy zasilenie każdego odbiornika
    // Odbiornik zbiera wszystkie kolory z wiązek, które z niego WYCHODZĄ poza plik siatki
    let allSatisfied = true;
    const updatedReceivers = receivers.map(rec => {
      const incomingColors = new Set<LaserColor>();

      state.rays.forEach(ray => {
        // Sprawdzamy segmenty wylatujące z siatki wprost do odbiornika
        // np. odbiornik na prawym brzegu (c == cols) odbiera wiązki, których x2 == cols
        // i leżą w odpowiednim wierszu
        if (rec.index < rows) { // Odbiorniki boczne
          const targetRow = rec.index;
          // Sprawdzamy prawy brzeg
          if (ray.x2 === cols && Math.floor(ray.y2) === targetRow && ray.x1 < ray.x2) {
            incomingColors.add(ray.color);
          }
          // Sprawdzamy lewy brzeg (w zależności od generatora)
          if (ray.x2 === 0 && Math.floor(ray.y2) === targetRow && ray.x1 > ray.x2) {
            incomingColors.add(ray.color);
          }
        }
        // Odbiorniki górne/dolne
        if (rec.index >= rows) {
          const targetCol = rec.index - rows; // Logika mapowania koordynatów docelowych
          if (ray.y2 === rows && Math.floor(ray.x2) === targetCol && ray.y1 < ray.y2) {
            incomingColors.add(ray.color);
          }
          if (ray.y2 === 0 && Math.floor(ray.x2) === targetCol && ray.y1 > ray.y2) {
            incomingColors.add(ray.color);
          }
        }
      });

      // Mieszamy addytywnie zebrane wiązki
      const blendedColor = this.blendColors(Array.from(incomingColors));
      const isSatisfied = blendedColor === rec.targetColor;
      if (!isSatisfied) allSatisfied = false;

      return { ...rec, isSatisfied };
    });

    this.stateManager.updateState({ receivers: updatedReceivers });
    this.uiController.render(this.stateManager.getState());

    if (allSatisfied) {
      // Sukces!
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

  // Mieszanie addytywne kolorów RGB do spektrum wtórnego
  private blendColors(colors: LaserColor[]): LaserColor | null {
    if (colors.length === 0) return null;
    const hasR = colors.includes('R') || colors.includes('M') || colors.includes('Y') || colors.includes('W');
    const hasG = colors.includes('G') || colors.includes('C') || colors.includes('Y') || colors.includes('W');
    const hasB = colors.includes('B') || colors.includes('M') || colors.includes('C') || colors.includes('W');

    if (hasR && hasG && hasB) return 'W'; // Biel
    if (hasR && hasG) return 'Y'; // Żółty
    if (hasR && hasB) return 'M'; // Magenta
    if (hasG && hasB) return 'C'; // Cyjan
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

  // --- GENERATOR ZAGADEK OPTYCZNYCH (Wersja Ostateczna) ---
  private generateOpticalPuzzle(level: number, cols: number, rows: number) {
    const totalCells = cols * rows;
    const grid: GridElement[] = Array(totalCells).fill(null).map(() => ({ type: 'EMPTY', rotation: 0 }));

    const emitters: Emitter[] = [
      { index: 0, color: 'R', direction: 'RIGHT' },
      { index: Math.floor(rows / 2), color: 'G', direction: 'RIGHT' }
    ];
    if (level >= 3) {
      emitters.push({ index: rows - 1, color: 'B', direction: 'RIGHT' });
    }

    const receivers: Receiver[] = [];
    const usedCells = new Set<number>();
    
    // 1. Zabezpieczenie: Ekskluzywne pasy ruchu dla każdego koloru
    const claimedRows = new Map<number, LaserColor>();
    emitters.forEach(em => claimedRows.set(em.index, em.color));

    // 2. Wypalanie ścieżek
    emitters.forEach(em => {
      let r = em.index;
      let c = 0;

      while (c < cols) {
        // 2. Zabezpieczenie: Sprawdzamy czy nie stoimy na cudzej ścieżce
        const wasAlreadyUsed = usedCells.has(r * cols + c);
        usedCells.add(r * cols + c); // Zaznaczamy przejście poziome

        if (c < cols - 1 && Math.random() < 0.40 && !wasAlreadyUsed) {
          const availableRows: number[] = [];
          
          for (let nextR = 0; nextR < rows; nextR++) {
            if (nextR !== r) {
              // Sprawdzamy, czy wiersz docelowy jest wolny lub należy do nas
              if (!claimedRows.has(nextR) || claimedRows.get(nextR) === em.color) {
                
                // 3. Zabezpieczenie: Czy pionowy szyb nie przetnie istniejącego LUSTRA?
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
            claimedRows.set(targetR, em.color); // Rezerwujemy nowy pas
            
            const goesDown = targetR > r;

            // Stawiamy lustra
            grid[r * cols + c] = { type: 'MIRROR_1', rotation: goesDown ? 90 : 0 };
            grid[targetR * cols + c] = { type: goesDown ? 'MIRROR_2' : 'MIRROR_1', rotation: goesDown ? 0 : 0 };
            
            // Oznaczamy pionowy szyb jako zajęty (by nie stawiać tam min)
            const minR = Math.min(r, targetR);
            const maxR = Math.max(r, targetR);
            for (let stepR = minR; stepR <= maxR; stepR++) {
              usedCells.add(stepR * cols + c);
            }

            r = targetR; // Przeskok promienia
          }
        }
        c++; 
      }

      // Bezpiecznie dodajemy odbiornik (nikt inny tu nie wjedzie)
      receivers.push({ index: r, targetColor: em.color, isSatisfied: false });
    });

    // 3. Wypełnianie tła (Szum optyczny, Miny i Pryzmaty)
    grid.forEach((cell, idx) => {
      if (!usedCells.has(idx)) {
        // Skalowanie trudności - gęstość zmyłek rośnie z każdym poziomem
        // Od 20% na starcie aż do morderczych 75% na wyższych poziomach
        const noiseChance = Math.min(0.20 + (level * 0.08), 0.75); 

        if (Math.random() < noiseChance) {
          if (level >= 5 && Math.random() < 0.25) {
            cell.type = 'SPLITTER'; // Dodajemy Rozszczepiacze od 5 poziomu!
          } else if (level >= 4 && Math.random() < 0.35) {
            cell.type = 'MINE';     // Dodajemy Miny od 4 poziomu!
          } else {
            cell.type = Math.random() < 0.5 ? 'MIRROR_1' : 'MIRROR_2';
          }
        }
      }

      // Losowe obracanie wszystkich wygenerowanych obiektów optycznych
      if (cell.type === 'MIRROR_1' || cell.type === 'MIRROR_2' || cell.type === 'SPLITTER') {
        const rotations = [0, 90, 180, 270];
        cell.rotation = rotations[Math.floor(Math.random() * rotations.length)];
      }
    });

    return { grid, emitters, receivers };
  }
}