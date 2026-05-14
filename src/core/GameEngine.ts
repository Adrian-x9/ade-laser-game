import { StateManager } from '../state/StateManager';
import { UIController } from '../ui/UIController';
import { Patch } from '../types/index';

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

    if (action === 'RIVAL_END') {
      this.stateManager.updateState({ rivalScore: null, rivalLevel: null });
      this.uiController.render(this.stateManager.getState());
      return;
    }

    if (action.startsWith('RIVAL_SUBMIT:')) {
      const code = action.split(':')[1]?.trim() || '';
      try {
        const decoded = atob(code);
        const parts = decoded.split('-');
        if (parts[0] === 'PTC' && parts.length === 4) {
          const rScore = parseInt(parts[1], 10);
          const rLvl = parseInt(parts[2], 10);
          const checkSum = parseInt(parts[3], 10);
          
          if (rScore + rLvl + 73 === checkSum) {
            this.stateManager.updateState({ rivalScore: rScore, rivalLevel: rLvl });
            this.uiController.render(this.stateManager.getState());
            alert(currentState.lang === 'PL' ? 'Kod przyjęty! Rywalizacja aktywna.' : 'Rival code accepted!');
            return;
          }
        }
        alert(currentState.lang === 'PL' ? 'Błędny lub uszkodzony kod rywala!' : 'Invalid rival code!');
      } catch (e) {
        alert(currentState.lang === 'PL' ? 'Niepoprawny format kodu!' : 'Malformed code format!');
      }
      return;
    }

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

    if (action === 'TACTICAL_SAVE' && currentState.status === 'PLAYING' && currentState.savesLeft > 0) {
      const snapshot = JSON.stringify({
        patches: currentState.patches.map(p => ({ ...p, cells: [...p.cells], variable: p.variable })),
        time: currentState.time,
        totalTime: currentState.totalTime,
        puzzle: [...currentState.puzzle],
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
          patches: parsed.patches,
          time: parsed.time,
          totalTime: parsed.totalTime ?? currentState.totalTime,
          puzzle: parsed.puzzle,
          level: parsed.level,
          savesLeft: parsed.savesLeft ?? currentState.savesLeft,
          loadsLeft: currentState.loadsLeft - 1
        });
        this.uiController.render(this.stateManager.getState());
      } catch (e) {
        console.error("Tactical Load Error:", e);
      }
      return;
    }

    if (action === 'RESET_PATH' && currentState.status === 'PLAYING') {
      const remainingLives = currentState.lives - 1;
      if (remainingLives <= 0) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.stateManager.updateState({ status: 'GAME_OVER', lives: 0 });
      } else {
        this.stateManager.updateState({ patches: [], lives: remainingLives, time: 0 });
        this.startTimer();
      }
      this.uiController.render(this.stateManager.getState());
      return;
    }

    if (action.startsWith('PATCH_ATTEMPT:') && currentState.status === 'PLAYING') {
      const rawCells = action.split(':')[1];
      if (!rawCells) return;
      const selectedCells = rawCells.split(',').map(Number);
      this.processPatchAttempt(selectedCells);
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
      // Pobieramy wygenerowaną docelową planszę wraz ze strukturą wbudowanych klocków
      const { grid, generatedPatches } = this.generateShikakuPuzzle(currentLevel);

      this.stateManager.updateState({
        status: 'PLAYING',
        patches: [],
        puzzle: grid,
        // Zachowujemy w stanie gry informację o ewentualnie przypisanych zmiennych do łatek
        ...(generatedPatches ? { targetPatchesInfo: generatedPatches } : {}),
        score: isNewGame ? 0 : state.score,
        level: currentLevel,
        time: 0,
        ...(isNewGame ? { lives: 3, savesLeft: 3, loadsLeft: 3, totalTime: 0 } : {})
      });

      this.uiController.render(this.stateManager.getState());
      this.startTimer();
    }, 50);
  }

  private processPatchAttempt(selectedCells: number[]): void {
    const state = this.stateManager.getState() as any;
    const { puzzle, patches, cols } = this.getGridConfig(state);

    if (selectedCells.length === 0) return;

    if (!this.isValidRectangle(selectedCells, cols)) {
      this.punishPlayer("Not a valid rectangle");
      return;
    }

    const isOverlapping = patches.some((patch: Patch) => 
      patch.cells.some((cell: number) => selectedCells.includes(cell))
    );
    if (isOverlapping) {
      this.punishPlayer("Overlap with existing patch");
      return;
    }

    const cluesInside: { index: number; value: number; isVariable?: boolean; varLetter?: 'X' | 'Y' }[] = [];
    const targetPatchesInfo: Patch[] = state.targetPatchesInfo || [];

    selectedCells.forEach(cellIdx => {
      // Analizujemy, czy pole na siatce posiada przypisaną wskazówkę
      if (puzzle[cellIdx] !== 0) {
        // Negatywna wartość w tablicy puzzle sygnalizuje ukrytą zmienną
        if (puzzle[cellIdx] < 0) {
          const targetPatch = targetPatchesInfo.find(p => p.clueIndex === cellIdx);
          cluesInside.push({ 
            index: cellIdx, 
            value: Math.abs(puzzle[cellIdx]), 
            isVariable: true, 
            varLetter: targetPatch?.variable 
          });
        } else {
          cluesInside.push({ index: cellIdx, value: puzzle[cellIdx] });
        }
      }
    });

    if (cluesInside.length === 0) {
      this.punishPlayer("No clue inside patch");
      return;
    }
    if (cluesInside.length > 1) {
      this.punishPlayer("Too many clues inside patch");
      return;
    }

    const targetClue = cluesInside[0];

    // Walidacja sprawdzająca, czy zarysowany obszar odpowiada fizycznej wielkości klocka
    if (selectedCells.length !== targetClue.value) {
      this.punishPlayer("Patch size does not match clue");
      return;
    }

    const newPatch: Patch = {
      clueIndex: targetClue.index,
      cells: [...selectedCells],
      ...(targetClue.isVariable ? { variable: targetClue.varLetter } : {})
    };
    const updatedPatches = [...patches, newPatch];
    this.stateManager.updateState({ patches: updatedPatches });

    const totalCellsCovered = updatedPatches.reduce((sum, p) => sum + p.cells.length, 0);
    if (totalCellsCovered === puzzle.length) {
      this.triggerWin();
    } else {
      this.uiController.render(this.stateManager.getState());
    }
  }

  private punishPlayer(reason: string): void {
    const state = this.stateManager.getState();
    console.log(`Punishment triggered: ${reason}`);
    
    const remainingLives = state.lives - 1;
    if (remainingLives <= 0) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.stateManager.updateState({ status: 'GAME_OVER', lives: 0 });
    } else {
      this.stateManager.updateState({ lives: remainingLives });
    }
    this.uiController.render(this.stateManager.getState());
  }

  private triggerWin(): void {
    const state = this.stateManager.getState();
    if (this.timerInterval) clearInterval(this.timerInterval);

    const timeBonus = Math.max(0, 100 - state.time);
    const nextLvl = state.level + 1;

    this.stateManager.updateState({
      status: 'WIN',
      score: state.score + 100 + (state.level * 10) + timeBonus,
      level: nextLvl,
      bestLevel: Math.max(state.bestLevel || 1, nextLvl)
    });
    this.uiController.render(this.stateManager.getState());
  }

  private getGridConfig(state: any) {
    const cols = Math.sqrt(state.puzzle.length);
    return { puzzle: state.puzzle, patches: state.patches, lives: state.lives, cols };
  }

  private isValidRectangle(cells: number[], cols: number): boolean {
    if (cells.length === 0) return false;
    
    const rows = cells.map(c => Math.floor(c / cols));
    const cls = cells.map(c => c % cols);
    
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cls);
    const maxCol = Math.max(...cls);

    const expectedSize = (maxRow - minRow + 1) * (maxCol - minCol + 1);
    if (cells.length !== expectedSize) return false;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!cells.includes(r * cols + c)) return false;
      }
    }
    return true;
  }

  private generateShikakuPuzzle(level: number): { grid: number[]; generatedPatches: Patch[] } {
    const cols = level <= 2 ? 4 : (level <= 5 ? 5 : (level <= 10 ? 6 : (level <= 14 ? 7 : 8)));
    const totalCells = cols * cols;
    const grid = Array(totalCells).fill(0);
    const generatedPatches: Patch[] = [];
    
    // Licznik jedynek wygenerowanych przez algorytm (staramy się unikać powstawania drobnicy)
    let onesCount = 0;
    // Maksymalna dozwolona całkowita pula jedynek dla danej układanki (twardy limit do max 2)
    const maxOnesAllowed = 2;

    const isPrime = (n: number) => {
      if (n <= 3) return n > 1;
      if (n % 2 === 0 || n % 3 === 0) return false;
      for (let i = 5; i * i <= n; i += 6) {
        if (n % i === 0 || n % (i + 2) === 0) return false;
      }
      return true;
    };

    // Podstawowa wielkość minimalna odrzucająca pojedyncze bloki od wczesnych faz
    const baseMinArea = level >= 8 ? 2 : 1;  
    const maxArea = level <= 3 ? 6 : 12;

    const divide = (r1: number, c1: number, r2: number, c2: number) => {
      const h = r2 - r1 + 1;
      const w = c2 - c1 + 1;
      const area = h * w;

      // Jeżeli wycinka dotknęła najmniejszego klocka (powierzchnia równa 1), ewidencjonujemy użycie
      if (area === 1) {
        onesCount++;
        assignPatch(r1, c1, r2, c2);
        return;
      }

      // Jeżeli zredukowano blok do aktualnie optymalnej minimalnej wielkości docelowej
      if (area <= baseMinArea) {
        assignPatch(r1, c1, r2, c2);
        return;
      }

      let canKeep = area <= maxArea;
      if (area > 5 && isPrime(area)) canKeep = false;
      if ((h === cols || w === cols) && area > 3) canKeep = false;
      if (Math.max(h, w) / Math.min(h, w) > 2.5 && area > 4) canKeep = false;

      const minTarget = level <= 3 ? 2 : 4;
      if (canKeep && area >= minTarget) {
        if (Math.random() < 0.60) {
          assignPatch(r1, c1, r2, c2);
          return;
        }
      }

      interface SplitOption { axis: 'H' | 'V'; index: number; }
      const validSplits: SplitOption[] = [];

      // Symulacja bezpiecznego cięcia poziomego
      if (h > 1) {
        for (let i = 0; i < h - 1; i++) {
          const topArea = (i + 1) * w;
          const bottomArea = (h - (i + 1)) * w;
          
          // Upewniamy się, czy symulowane cięcie nie narusza twardego limitu generowania jedynek
          const generatesOne = topArea === 1 || bottomArea === 1;
          if (!generatesOne || onesCount < maxOnesAllowed) {
            if (topArea >= baseMinArea && bottomArea >= baseMinArea) {
              if (h >= w) validSplits.push({ axis: 'H', index: r1 + i }, { axis: 'H', index: r1 + i });
              else validSplits.push({ axis: 'H', index: r1 + i });
            } else if (baseMinArea > 1 && (topArea >= 1 && bottomArea >= 1)) {
              // Zezwalamy na warunkowy awaryjny podział z wygenerowaniem jedynki w razie zablokowania planszy
              validSplits.push({ axis: 'H', index: r1 + i });
            }
          }
        }
      }

      // Symulacja bezpiecznego cięcia pionowego
      if (w > 1) {
        for (let i = 0; i < w - 1; i++) {
          const leftArea = h * (i + 1);
          const rightArea = h * (w - (i + 1));
          
          const generatesOne = leftArea === 1 || rightArea === 1;
          if (!generatesOne || onesCount < maxOnesAllowed) {
            if (leftArea >= baseMinArea && rightArea >= baseMinArea) {
              if (w >= h) validSplits.push({ axis: 'V', index: c1 + i }, { axis: 'V', index: c1 + i });
              else validSplits.push({ axis: 'V', index: c1 + i });
            } else if (baseMinArea > 1 && (leftArea >= 1 && rightArea >= 1)) {
              validSplits.push({ axis: 'V', index: c1 + i });
            }
          }
        }
      }

      // Jeżeli nie znaleziono dopuszczalnej ścieżki dekompozycji, zachowujemy element docelowy jako monolit
      if (validSplits.length === 0) {
        assignPatch(r1, c1, r2, c2);
        return;
      }

      const split = validSplits[Math.floor(Math.random() * validSplits.length)];
      if (split.axis === 'H') {
        divide(r1, c1, split.index, c2);
        divide(split.index + 1, c1, r2, c2);
      } else {
        divide(r1, c1, r2, split.index);
        divide(r1, split.index + 1, r2, c2);
      }
    };

    const assignPatch = (r1: number, c1: number, r2: number, c2: number) => {
      const patchCells: number[] = [];
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          patchCells.push(r * cols + c);
        }
      }
      const clueCell = patchCells[Math.floor(Math.random() * patchCells.length)];
      grid[clueCell] = patchCells.length;
      generatedPatches.push({ clueIndex: clueCell, cells: patchCells });
    };

    // Budujemy bazowy zarys mapy i wypełniamy przestrzeń klockami
    divide(0, 0, cols - 1, cols - 1);

    // --- ALGEBRAICZNE ZMIENNE (X oraz Y) ---
    // Filtrujemy wygenerowane łatki odrzucając banalne bloki o polu 1
    const candidatePatches = generatedPatches.filter(p => p.cells.length > 1);

    if (level >= 11 && candidatePatches.length > 0) {
      // Przydzielamy pierwszą zmienną (X) do losowego klocka na planszy
      const patchX = candidatePatches[Math.floor(Math.random() * candidatePatches.length)];
      patchX.variable = 'X';
      // Implementujemy ujemny kod pola powierzchni (-area), który jednoznacznie wywoła renderowanie tekstu X
      grid[patchX.clueIndex] = -patchX.cells.length;

      // Mechanika dodająca zmienną Y na najwyższych poziomach trudności (od levelu 13)
      if (level >= 13 && candidatePatches.length > 1) {
        // Logika matematyczna wymaga, by łatki oznaczone różnymi zmiennymi (X i Y) miały odmienne powierzchnie
        const availableY = candidatePatches.filter(p => p.cells.length !== patchX.cells.length && p.variable !== 'X');
        if (availableY.length > 0) {
          const patchY = availableY[Math.floor(Math.random() * availableY.length)];
          patchY.variable = 'Y';
          grid[patchY.clueIndex] = -patchY.cells.length;
        }
      }
    }

    return { grid, generatedPatches };
  }
}