import { GameState, Language, Patch } from '../types/index';

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  EN: {
    save: "Save", load: "Load", info: "Info", new: "New Game",
    lives: "LIVES", time: "TIME", totalTime: "TOTAL TIME",
    best: "BEST", maxLvl: "MAX LVL", start: "Start Game",
    next: "Next Level", try: "Try Again", level: "Level", reset: "Reset",
    dark: "Dark", light: "Light", infoTitle: "Instructions",
    inst: "Divide the grid into rectangular patches. Each patch must contain exactly one number, which equals its area.",
    instVars: "<b>Algebraic Variables:</b> On higher levels, letters X and Y obscure the patch target areas! Use field geometry to calculate their missing values.",
    generating: "Building level…",
    vsBtn: "🏆 VS Mode", vsTitle: "Rivalry Mode",
    vsDesc: "Share your code to compete with a friend's shadow record!",
    yourCode: "Your record code:", copy: "📋 Copy Code",
    paste: "Paste rival code below:", submit: "Challenge",
    active: "Racing against record:", endVs: "❌ End Rivalry",
    pastePlaceholder: "paste rival code here..."
  },
  PL: {
    save: "Zapisz", load: "Wczytaj", info: "Info", new: "Nowa Gra",
    lives: "ŻYCIA", time: "CZAS", totalTime: "CZAS GRY",
    best: "REKORD", maxLvl: "MAX LVL", start: "Start",
    next: "Następny", try: "Od nowa", level: "Poziom", reset: "Reset",
    dark: "Ciemny", light: "Jasny", infoTitle: "Instrukcja",
    inst: "Podziel planszę na prostokątne łatki. Każda łatka musi zawierać dokładnie jedną liczbę, odpowiadającą jej polu powierzchni.",
    instVars: "<b>Zmienne X i Y:</b> Na wyższych etapach zamiast cyfr pojawiają się niewiadome! Dedukuj brakujące rozmiary z ogólnego bilansu wolnych kratek na planszy.",
    generating: "Generuję poziom…",
    vsBtn: "🏆 Rywalizacja", vsTitle: "Tryb Rywalizacji",
    vsDesc: "Wyślij kod znajomemu, aby ścigać się z jego duchem!",
    yourCode: "Kod Twojego rekordu:", copy: "📋 Kopiuj kod",
    paste: "Wklej / wpisz kod rywala poniżej:", submit: "Zatwierdź",
    active: "Ścigasz się z wynikiem:", endVs: "❌ Zakończ rywalizację",
    pastePlaceholder: "wklej kod rywala..."
  },
  DE: {
    save: "Speichern", load: "Laden", info: "Info", new: "Neues Spiel",
    lives: "LEBEN", time: "ZEIT", totalTime: "GESAMTZEIT",
    best: "REKORD", maxLvl: "MAX LVL", start: "Starten",
    next: "Nächstes", try: "Nochmal", level: "Level", reset: "Reset",
    dark: "Dunkel", light: "Hell", infoTitle: "Anleitung",
    inst: "Zerlegen Sie das Gitter in rechteckige Bereiche. Jeder Bereich muss genau eine Zahl enthalten, die seiner Fläche entspricht.",
    instVars: "<b>Algebraische Variablen:</b> In höheren Leveln verdecken X und Y die Zielgrößen! Berechne ihren wahren Wert durch das Zählen freier Felder.",
    generating: "Level wird erstellt…",
    vsBtn: "🏆 VS Modus", vsTitle: "Wettkampfmodus",
    vsDesc: "Teile deinen Code, um gegen den Rekord eines Freundes anzutreten!",
    yourCode: "Dein Rekord-Code:", copy: "📋 Code kopieren",
    paste: "Gegner-Code hier einfügen:", submit: "Herausfordern",
    active: "Rennen gegen Rekord:", endVs: "❌ Wettkampf beenden",
    pastePlaceholder: "Gegner-Code hier einfügen..."
  }
};

// Globalna paleta nasyconych barw klocków wykorzystywana w mechanice progresywnego kolorowania kontrolki Start
const PATCH_PALETTE = [
  '#5856D6', '#FF9F0A', '#FF375F', '#30B0C7', '#AF52DE',
  '#34C759', '#FF7F50', '#32ADE6', '#D55DA1', '#A2845E'
];

export class UIController {
  private appContainer: HTMLElement;
  private scoreElement: HTMLElement | null = null;
  public onAction: ((actionId: string) => void) | null = null;

  private isDragging: boolean = false;
  private dragStartCell: number | null = null;
  private dragCurrentCell: number | null = null;
  private lastCols: number = 4;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);
    this.appContainer = container;
  }

  public init(): void {
    this.appContainer.innerHTML = `
      <div class="game-wrapper" translate="no">
        <nav class="top-nav-row">
          <button id="btn-new" class="btn-micro"></button>
          <button id="btn-lang" class="btn-micro"></button>
          <button id="btn-dark" class="btn-micro"></button>
        </nav>
        <nav class="top-nav-row">
          <button id="btn-save" class="btn-micro"></button>
          <button id="btn-info" class="btn-micro"></button>
          <button id="btn-load" class="btn-micro"></button>
        </nav>

        <header class="game-header">
          <div class="stats-group" id="lives-display-wrapper" style="cursor:pointer">
            <div class="stat-item"><span id="lbl-lives"></span> <span id="lives-val">♥♥♥</span></div>
            <div class="stat-item"><span id="lbl-time"></span> <span id="timer-val">0 s</span></div>
            <div class="stat-item"><span id="lbl-total-time"></span> <span id="total-timer-val">0 s</span></div>
          </div>
          <div class="score-display" id="score-display-wrapper" style="cursor:pointer">
            <div id="score-val">0</div>
            <div class="stat-item justify-right"><span id="lbl-best"></span> <span id="best-val">0</span></div>
            <div class="stat-item justify-right"><span id="lbl-max-lvl"></span> <span id="max-lvl-val">1</span></div>
          </div>
        </header>

        <div class="board-container">
          <div id="game-board" class="game-grid"></div>
          <svg id="path-overlay" class="path-svg"></svg>

          <div id="loading-overlay" class="loading-overlay hidden">
            <div class="loading-spinner"></div>
            <div id="loading-text" class="loading-text"></div>
          </div>
        </div>

        <footer class="game-controls">
          <button id="btn-start" class="btn-primary"></button>
          <button id="btn-reset" class="btn-outline" disabled></button>
        </footer>

        <div class="footer-link-row">
          <button id="btn-open-vs" class="btn-link"></button>
        </div>

        <div id="info-modal" class="modal-overlay hidden">
          <div class="modal-content">
            <div id="dynamic-info-wrapper"></div>
            <button id="btn-close-info" class="btn-close">OK</button>
          </div>
        </div>

        <div id="vs-modal" class="modal-overlay hidden">
          <div class="modal-content">
            <div id="dynamic-vs-wrapper"></div>
            <button id="btn-close-vs" class="btn-close">OK</button>
          </div>
        </div>
      </div>
    `;

    this.scoreElement = document.getElementById('score-val');
    this.bindEvents();
  }

  public updateTimer(time: number, totalTime?: number): void {
    const timerEl = document.getElementById('timer-val');
    if (timerEl) timerEl.textContent = `${time} s`;

    if (totalTime !== undefined) {
      const totalTimerEl = document.getElementById('total-timer-val');
      if (totalTimerEl) totalTimerEl.textContent = `${totalTime} s`;
    }
  }

  public showLoading(lang: Language): void {
    const t = TRANSLATIONS[lang];
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (text) text.textContent = t.generating;
    if (overlay) overlay.classList.remove('hidden');
  }

  private hideLoading(): void {
    document.getElementById('loading-overlay')?.classList.add('hidden');
  }

  private bindEvents(): void {
    const trigger = (id: string, action: string) => {
      document.getElementById(id)?.addEventListener('click', () => {
        if (this.onAction) this.onAction(action);
      });
    };

    trigger('btn-start', 'START_GAME');
    trigger('btn-reset', 'RESET_PATH');
    trigger('btn-save', 'TACTICAL_SAVE');
    trigger('btn-load', 'TACTICAL_LOAD');
    trigger('btn-new', 'NEW_GAME');
    trigger('btn-lang', 'CHANGE_LANG');

    document.getElementById('btn-dark')?.addEventListener('click', () => {
      if (this.onAction) this.onAction('TOGGLE_DARK_MODE');
    });

    document.getElementById('btn-info')?.addEventListener('click', () => {
      document.getElementById('info-modal')?.classList.remove('hidden');
    });

    document.getElementById('btn-close-info')?.addEventListener('click', () => {
      document.getElementById('info-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-open-vs')?.addEventListener('click', () => {
      document.getElementById('vs-modal')?.classList.remove('hidden');
    });

    document.getElementById('btn-close-vs')?.addEventListener('click', () => {
      document.getElementById('vs-modal')?.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'btn-copy-code') {
        const codeEl = document.getElementById('my-rival-code');
        if (codeEl && navigator.clipboard) {
          navigator.clipboard.writeText(codeEl.textContent || '');
          const originalTxt = target.textContent;
          target.textContent = '✔ Copied!';
          setTimeout(() => { target.textContent = originalTxt; }, 1200);
        }
      } else if (target.id === 'btn-share-code') {
        const codeEl = document.getElementById('my-rival-code');
        if (codeEl && navigator.share) {
          navigator.share({
            title: 'Patches VS Mode',
            text: `Can you beat my Patches record? Enter my shadow code in Rivalry Mode: ${codeEl.textContent}`
          }).catch(() => {});
        }
      } else if (target.id === 'btn-submit-rival') {
        const input = document.getElementById('input-rival-code') as HTMLInputElement;
        if (input && input.value && this.onAction) {
          this.onAction(`RIVAL_SUBMIT:${input.value}`);
          input.value = '';
        }
      } else if (target.id === 'btn-end-vs') {
        if (this.onAction) this.onAction('RIVAL_END');
      }
    });

    let scoreTaps = 0;
    let scoreTapTimer: ReturnType<typeof setTimeout> | null = null;
    document.getElementById('score-display-wrapper')?.addEventListener('click', () => {
      scoreTaps++;
      if (scoreTaps === 2) {
        scoreTaps = 0;
        if (scoreTapTimer) clearTimeout(scoreTapTimer);
        if (this.onAction) this.onAction('DEV_NEXT_LEVEL');
      } else {
        if (scoreTapTimer) clearTimeout(scoreTapTimer);
        scoreTapTimer = setTimeout(() => { scoreTaps = 0; }, 400);
      }
    });

    let livesTaps = 0;
    let livesTapTimer: ReturnType<typeof setTimeout> | null = null;
    document.getElementById('lives-display-wrapper')?.addEventListener('click', () => {
      livesTaps++;
      if (livesTaps === 2) {
        livesTaps = 0;
        if (livesTapTimer) clearTimeout(livesTapTimer);
        if (this.onAction) this.onAction('DEV_RESET_BEST');
      } else {
        if (livesTapTimer) clearTimeout(livesTapTimer);
        livesTapTimer = setTimeout(() => { livesTaps = 0; }, 400);
      }
    });

    const board = document.getElementById('game-board');
    if (!board) return;

    board.addEventListener('pointerdown', (e) => {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      if (target && target.matches('.grid-cell')) {
        this.isDragging = true;
        const cellId = parseInt(target.dataset.id || '0', 10);
        this.dragStartCell = cellId;
        this.dragCurrentCell = cellId;
        this.updateSelectionPreview();
        board.setPointerCapture(e.pointerId);
      }
    });

    board.addEventListener('pointermove', (e) => {
      if (!this.isDragging || this.dragStartCell === null) return;
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      if (target && target.matches('.grid-cell')) {
        const cellId = parseInt(target.dataset.id || '0', 10);
        if (cellId !== this.dragCurrentCell) {
          this.dragCurrentCell = cellId;
          this.updateSelectionPreview();
        }
      }
    });

    const stopDragging = (e: PointerEvent) => {
      if (this.isDragging && this.dragStartCell !== null && this.dragCurrentCell !== null) {
        const selectedCells = this.getBoundingBoxCells(this.dragStartCell, this.dragCurrentCell, this.lastCols);
        this.isDragging = false;
        this.dragStartCell = null;
        this.dragCurrentCell = null;
        this.clearSelectionPreview();
        board.releasePointerCapture(e.pointerId);
        
        if (this.onAction) {
          this.onAction(`PATCH_ATTEMPT:${selectedCells.join(',')}`);
        }
      } else {
        this.isDragging = false;
        this.dragStartCell = null;
        this.dragCurrentCell = null;
        this.clearSelectionPreview();
      }
    };

    board.addEventListener('pointerup', stopDragging);
    board.addEventListener('pointercancel', stopDragging);
  }

  private getBoundingBoxCells(start: number, end: number, cols: number): number[] {
    const r1 = Math.floor(start / cols);
    const c1 = start % cols;
    const r2 = Math.floor(end / cols);
    const c2 = end % cols;

    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);

    const cells: number[] = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        cells.push(r * cols + c);
      }
    }
    return cells;
  }

  private updateSelectionPreview(): void {
    if (this.dragStartCell === null || this.dragCurrentCell === null) return;
    const previewCells = this.getBoundingBoxCells(this.dragStartCell, this.dragCurrentCell, this.lastCols);
    
    const board = document.getElementById('game-board');
    if (!board) return;
    
    Array.from(board.children).forEach((cellEl) => {
      const id = parseInt((cellEl as HTMLElement).dataset.id || '0', 10);
      if (previewCells.includes(id)) {
        cellEl.classList.add('preview-patch');
        (cellEl as HTMLElement).style.outline = '3px dashed var(--primary-color)';
        (cellEl as HTMLElement).style.transform = 'scale(0.95)';
      } else {
        cellEl.classList.remove('preview-patch');
        (cellEl as HTMLElement).style.outline = '';
        (cellEl as HTMLElement).style.transform = '';
      }
    });
  }

  private clearSelectionPreview(): void {
    const board = document.getElementById('game-board');
    if (!board) return;
    Array.from(board.children).forEach((cellEl) => {
      cellEl.classList.remove('preview-patch');
      (cellEl as HTMLElement).style.outline = '';
      (cellEl as HTMLElement).style.transform = '';
    });
  }

  private renderVsContent(state: Readonly<GameState>): string {
    const t = TRANSLATIONS[state.lang];
    const canShare = typeof navigator !== 'undefined' && !!navigator.share;
    
    const bScore = state.bestScore;
    const bLvl = state.bestLevel || 1;
    const checkSum = bScore + bLvl + 73;
    const rawCode = `PTC-${bScore}-${bLvl}-${checkSum}`;
    const myCode = typeof btoa !== 'undefined' ? btoa(rawCode) : rawCode;

    let html = `
      <div class="info-content">
        <h2>${t.vsTitle}</h2>
        <p style="text-align:center; margin-bottom:16px;">${t.vsDesc}</p>
        
        <div><strong>${t.yourCode}</strong></div>
        <div class="code-box" id="my-rival-code">${myCode}</div>
        <div style="display:flex; gap:8px; margin-bottom:20px;">
          <button id="btn-copy-code" class="btn-micro" style="flex:1; padding:10px;">${t.copy}</button>
          ${canShare ? `<button id="btn-share-code" class="btn-micro" style="flex:1; padding:10px;">📲 Share</button>` : ''}
        </div>

        <hr style="border:0; border-top:1px solid var(--cell-checkpoint); margin:16px 0;">

        <div><strong>${t.paste}</strong></div>
        <input type="text" id="input-rival-code" class="input-rival" placeholder="${t.pastePlaceholder}" autocomplete="off" spellcheck="false" />
        <button id="btn-submit-rival" class="btn-primary" style="width:100%; padding:10px; border-radius:8px;">${t.submit}</button>
    `;

    if (state.rivalScore !== null) {
      html += `
        <div style="margin-top:20px; padding-top:12px; border-top:1px solid var(--cell-checkpoint); text-align:center;">
          <div style="font-size:0.85rem; color:var(--text-muted);">${t.active}</div>
          <div style="font-size:1.2rem; font-weight:bold; color:var(--primary-color);">
            ${state.rivalScore} pkt (Lvl ${state.rivalLevel})
          </div>
          <button id="btn-end-vs" class="btn-danger">${t.endVs}</button>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  private renderInfoContent(lang: string): string {
    const t = TRANSLATIONS[lang as Language] || TRANSLATIONS.EN;
    const isStandalone = typeof window !== 'undefined' && 
      (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

    const isPL = lang === 'PL';
    const isDE = lang === 'DE';

    const steps = [
      `🖱️ ${t.inst}`,
      `❤️ <b>Roguelike:</b> ${isPL ? 'Błędna łatka lub nachodzenie na inną natychmiast kosztuje życie!' : isDE ? 'Ein falscher Bereich kostet sofort ein Leben!' : 'Any invalid patch instantly costs you a life. No undo!'}`,
      `⭐ <b>${isPL ? 'Zapisy' : isDE ? 'Speichern' : 'Saves'}:</b> ${isPL ? 'Używaj gwiazdek do zapisu stanu w krytycznych momentach.' : isDE ? 'Taktische Speicherungen weise nutzen.' : 'Use tactical save/load charges wisely.'}`,
      `🔢 ${t.instVars}`
    ];

    const btnInstall = isPL ? "Zainstaluj Aplikację" : isDE ? "App installieren" : "Install Application";
    const ver = `v1.3.1 © ${isDE ? '13.05.2026' : '2026-05-13'}`;

    return `
      <div class="info-content">
        <h2>${t.infoTitle}</h2>
        <ul>${steps.map(step => `<li>${step}</li>`).join('')}</ul>
        ${!isStandalone ? `<button id="btn-modal-install" class="btn-primary" onclick="window.__patchesInstall && window.__patchesInstall()">📲 ${btnInstall}</button>` : ''}
        <div class="author-info"><span class="author-name">ade Patches game by Adrian Ulbrych</span><span class="author-meta">${ver}</span></div>
      </div>
    `;
  }

  public render(state: Readonly<GameState>): void {
    this.hideLoading();
    const t = TRANSLATIONS[state.lang];

    if (state.isDarkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');

    const setTxt = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    const darkBtn = document.getElementById('btn-dark');
    if (darkBtn) darkBtn.textContent = state.isDarkMode ? `🌙 ${t.dark}` : `☀️ ${t.light}`;

    setTxt('lbl-lives', t.lives); setTxt('lbl-time', t.time); setTxt('lbl-total-time', t.totalTime);
    setTxt('lbl-best', t.best); setTxt('lbl-max-lvl', t.maxLvl);
    setTxt('btn-new', t.new); setTxt('btn-info', `ℹ️ ${t.info}`); setTxt('btn-lang', `🌐 ${state.lang}`);
    setTxt('btn-open-vs', t.vsBtn);

    const dynamicInfoEl = document.getElementById('dynamic-info-wrapper');
    if (dynamicInfoEl) dynamicInfoEl.innerHTML = this.renderInfoContent(state.lang);

    const dynamicVsEl = document.getElementById('dynamic-vs-wrapper');
    if (dynamicVsEl) dynamicVsEl.innerHTML = this.renderVsContent(state);

    if (this.scoreElement) this.scoreElement.textContent = state.score.toString();
    
    const bestTxt = state.rivalScore !== null ? `${state.bestScore} / ${state.rivalScore}` : state.bestScore.toString();
    const lvlTxt = state.rivalLevel !== null ? `${state.bestLevel || 1} / ${state.rivalLevel}` : (state.bestLevel || 1).toString();
    
    setTxt('best-val', bestTxt);
    setTxt('max-lvl-val', lvlTxt); 
    setTxt('timer-val', `${state.time} s`);
    setTxt('total-timer-val', `${state.totalTime || 0} s`);

    const livesEl = document.getElementById('lives-val');
    if (livesEl) livesEl.textContent = state.status === 'GAME_OVER' ? '☠️' : '♥'.repeat(state.lives);

    const saveBtn = document.getElementById('btn-save') as HTMLButtonElement;
    const loadBtn = document.getElementById('btn-load') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.textContent = `${t.save} ${'★'.repeat(state.savesLeft) + '☆'.repeat(3 - state.savesLeft)}`;
      saveBtn.disabled = state.status !== 'PLAYING' || state.savesLeft <= 0;
    }
    if (loadBtn) {
      loadBtn.textContent = `${t.load} ${'★'.repeat(state.loadsLeft) + '☆'.repeat(3 - state.loadsLeft)}`;
      loadBtn.disabled = state.status !== 'PLAYING' || !state.savedSnapshot || state.loadsLeft <= 0;
    }

    const boardElement = document.getElementById('game-board');
    if (!boardElement) return;

    const cols = Math.sqrt(state.puzzle.length);
    this.lastCols = cols;

    if (boardElement.children.length !== state.puzzle.length) {
      boardElement.innerHTML = '';
      boardElement.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      for (let i = 0; i < state.puzzle.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.id = i.toString();
        boardElement.appendChild(cell);
      }
    }

    const cellToPatchColor = new Map<number, string>();
    const colorHistory: string[] = [];
    const targetPatchesInfo: Patch[] = (state as any).targetPatchesInfo || [];

    state.patches.forEach((p) => {
      const recentColors = colorHistory.slice(-2);
      const availableColors = PATCH_PALETTE.filter(c => !recentColors.includes(c));
      const color = availableColors[p.clueIndex % availableColors.length];
      
      colorHistory.push(color);
      p.cells.forEach(c => cellToPatchColor.set(c, color));
    });

    const cells = boardElement.children;
    state.puzzle.forEach((cellValue, index) => {
      const cell = cells[index] as HTMLElement;
      cell.textContent = '';
      cell.classList.remove('checkpoint', 'active', 'win');
      cell.style.outline = '';
      cell.style.transform = '';
      cell.style.removeProperty('--patch-bg');

      // Obsługa ukrywania podpowiedzi: ujemna wartość oznacza algebraiczną zmienną (X lub Y)
      if (cellValue !== 0) {
        if (cellValue < 0) {
          // Odczytujemy zapamiętaną literę zmiennej powiązaną z podpowiedzią z ewidencji mapy klocków
          const tPatch = targetPatchesInfo.find(p => p.clueIndex === index);
          cell.textContent = tPatch?.variable || 'X';
        } else {
          cell.textContent = cellValue.toString();
        }
        cell.classList.add('checkpoint');
      }

      if (cellToPatchColor.has(index)) {
        cell.classList.add('active');
        cell.style.setProperty('--patch-bg', cellToPatchColor.get(index)!);
      }
    });

    if (state.status === 'WIN') boardElement.classList.add('win');
    else boardElement.classList.remove('win');

    const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
    const resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
    
    if (startBtn) {
      // Mechanika zmiany koloru przycisku Start/Poziom co 5 leveli
      // Prosty algorytm dzielenia wyznacza przypisany slot w palecie na podstawie ewidencji lvl
      const colorTierIndex = Math.floor((state.level - 1) / 5) % PATCH_PALETTE.length;
      const progressiveColor = PATCH_PALETTE[colorTierIndex];
      startBtn.style.backgroundColor = progressiveColor;

      if (state.status === 'WIN') { startBtn.textContent = t.next; startBtn.disabled = false; }
      else if (state.status === 'GAME_OVER') { startBtn.textContent = t.try; startBtn.disabled = false; }
      else {
        startBtn.textContent = state.status === 'PLAYING' ? `${t.level} ${state.level}` : t.start;
        startBtn.disabled = state.status === 'PLAYING';
      }
    }
    
    if (resetBtn) {
      resetBtn.textContent = t.reset;
      resetBtn.disabled = state.status !== 'PLAYING';
    }
  }
}