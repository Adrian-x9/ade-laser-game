import { GameState, Language, RaySegment, LaserColor } from '../types/index';

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  EN: {
    save: "Save", load: "Load", info: "Info", new: "New Game",
    lives: "LIVES", time: "TIME", totalTime: "TOTAL TIME",
    best: "BEST", maxLvl: "MAX LVL", start: "Start",
    next: "Next Level", try: "Try Again", level: "Level", reset: "Reset",
    dark: "Dark", light: "Light", infoTitle: "Optical Manual",
    inst: "Rotate mirrors and prisms to direct laser beams into the receivers.",
    instVars: "<b>RGB Mixing:</b> Red + Green = Yellow, Red + Blue = Magenta, Green + Blue = Cyan. Combine all to get White!",
    generating: "Calibrating optics…",
    vsBtn: "🏆 VS Mode", vsTitle: "Rivalry Mode",
    vsDesc: "Share your code to compete with a friend's shadow record!",
    yourCode: "Your record code:", copy: "📋 Copy Code",
    paste: "Paste rival code below:", submit: "Challenge",
    active: "Racing against record:", endVs: "❌ End Rivalry",
    fire: "⚡ TEST FIRE",
    hitMine: "SYSTEM ERROR: Optical Mine Detonated!",
    wrongColor: "SYSTEM ERROR: Incorrect wavelength detected!"
  },
  PL: {
    save: "Zapisz", load: "Wczytaj", info: "Info", new: "Nowa Gra",
    lives: "ŻYCIA", time: "CZAS", totalTime: "CZAS GRY",
    best: "REKORD", maxLvl: "MAX LVL", start: "Start",
    next: "Następny", try: "Od nowa", level: "Poziom", reset: "Reset",
    dark: "Ciemny", light: "Jasny", infoTitle: "Instrukcja Optyczna",
    inst: "Obracaj lustra i pryzmaty, aby skierować wiązki laserów do odbiorników.",
    instVars: "<b>Mieszanie RGB:</b> Czerwony + Zielony = Żółty, Czerwony + Niebieski = Magenta, Zielony + Niebieski = Cyjan. Połącz wszystkie dla Bieli!",
    generating: "Kalibruję optykę…",
    vsBtn: "🏆 Rywalizacja", vsTitle: "Tryb Rywalizacji",
    vsDesc: "Wyślij kod znajomemu, aby ścigać się z jego duchem!",
    yourCode: "Kod Twojego rekordu:", copy: "📋 Kopiuj kod",
    paste: "Wklej / wpisz kod rywala poniżej:", submit: "Zatwierdź",
    active: "Ścigasz się z wynikiem:", endVs: "❌ Zakończ rywalizację",
    fire: "⚡ ODPAL LASER",
    hitMine: "BŁĄD: Mina optyczna zdetonowana!",
    wrongColor: "BŁĄD: Nieprawidłowa długość fali!"
  },
  DE: {
    save: "Speichern", load: "Laden", info: "Info", new: "Neues Spiel",
    lives: "LEBEN", time: "ZEIT", totalTime: "GESAMTZEIT",
    best: "REKORD", maxLvl: "MAX LVL", start: "Start",
    next: "Nächstes", try: "Nochmal", level: "Level", reset: "Reset",
    dark: "Dunkel", light: "Hell", infoTitle: "Optisches Handbuch",
    inst: "Drehen Sie Spiegel und Prismen, um Laserstrahlen in die Empfänger zu leiten.",
    instVars: "<b>RGB-Mischung:</b> Rot + Grün = Gelb, Rot + Blau = Magenta, Grün + Blau = Cyan. Kombinieren Sie alles für Weiß!",
    generating: "Optik wird kalibriert…",
    vsBtn: "🏆 VS Modus", vsTitle: "Wettkampfmodus",
    vsDesc: "Teile deinen Code, um gegen den Rekord eines Freundes anzutreten!",
    yourCode: "Dein Rekord-Code:", copy: "📋 Code kopieren",
    paste: "Gegner-Code hier einfügen:", submit: "Herausfordern",
    active: "Rennen gegen Rekord:", endVs: "❌ Wettkampf beenden",
    fire: "⚡ TESTFEUER",
    hitMine: "FEHLER: Optische Mine detoniert!",
    wrongColor: "FEHLER: Falsche Wellenlänge erkannt!"
  }
};

// Mapowanie kolorów laserów na kody HEX z efektem neonu
const COLOR_MAP: Record<LaserColor, string> = {
  'R': '#FF3B30', // Red
  'G': '#34C759', // Green
  'B': '#007AFF', // Blue
  'C': '#00FFFF', // Cyan
  'M': '#FF00FF', // Magenta
  'Y': '#FFFF00', // Yellow
  'W': '#FFFFFF'  // White
};

export class UIController {
  private appContainer: HTMLElement;
  private scoreElement: HTMLElement | null = null;
  public onAction: ((actionId: string) => void) | null = null;

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
          <div class="stats-group">
            <div class="stat-item"><span id="lbl-lives"></span> <span id="lives-val">♥♥♥</span></div>
            <div class="stat-item"><span id="lbl-time"></span> <span id="timer-val">0 s</span></div>
            <div class="stat-item"><span id="lbl-total-time"></span> <span id="total-timer-val">0 s</span></div>
          </div>
          <div class="score-display">
            <div id="score-val">0</div>
            <div class="stat-item justify-right"><span id="lbl-best"></span> <span id="best-val">0</span></div>
            <div class="stat-item justify-right"><span id="lbl-max-lvl"></span> <span id="max-lvl-val">1</span></div>
          </div>
        </header>

        <div class="board-container">
          <div id="peripheral-layer" class="peripheral-layer"></div>
          
          <div id="game-board" class="game-grid"></div>
          
          <svg id="ray-layer" class="ray-svg" preserveAspectRatio="none"></svg>

          <div id="loading-overlay" class="loading-overlay hidden">
            <div class="loading-spinner"></div>
            <div id="loading-text" class="loading-text"></div>
          </div>
        </div>

        <footer class="game-controls">
          <button id="btn-fire" class="btn-primary"></button>
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
    const totalTimerEl = document.getElementById('total-timer-val');
    if (totalTimerEl && totalTime !== undefined) totalTimerEl.textContent = `${totalTime} s`;
  }

  public showLoading(lang: Language): void {
    const t = TRANSLATIONS[lang];
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
    const text = document.getElementById('loading-text');
    if (text) text.textContent = t.generating;
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

    trigger('btn-fire', 'TEST_FIRE');
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

    // Delegacja kliknięć w kafelki siatki
    document.getElementById('game-board')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('.grid-cell') as HTMLElement;
      if (cell && cell.dataset.id && this.onAction) {
        this.onAction(`ROTATE_CELL:${cell.dataset.id}`);
      }
    });

    // Delegacja akcji w modalach (Kopiowanie, VS submit)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'btn-copy-code') {
        const codeEl = document.getElementById('my-rival-code');
        if (codeEl && navigator.clipboard) {
          navigator.clipboard.writeText(codeEl.textContent || '');
          target.textContent = '✔ Copied!';
          setTimeout(() => { target.textContent = '📋 Copy Code'; }, 1200);
        }
      } else if (target.id === 'btn-submit-rival') {
        const input = document.getElementById('input-rival-code') as HTMLInputElement;
        if (input && input.value && this.onAction) {
          this.onAction(`RIVAL_SUBMIT:${input.value}`);
        }
      } else if (target.id === 'btn-end-vs') {
        if (this.onAction) this.onAction('RIVAL_END');
      }
    });
  }

  private renderRays(rays: RaySegment[], cols: number, rows: number): void {
    const svg = document.getElementById('ray-layer') as unknown as SVGSVGElement;
    if (!svg) return;
    svg.innerHTML = '';
    
    // Ustawiamy viewBox na wymiary siatki, by koordynaty (0.5, 0.5) działały idealnie
    svg.setAttribute('viewBox', `0 0 ${cols} ${rows}`);

    rays.forEach(ray => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const colorHex = COLOR_MAP[ray.color];
      
      line.setAttribute('x1', ray.x1.toString());
      line.setAttribute('y1', ray.y1.toString());
      line.setAttribute('x2', ray.x2.toString());
      line.setAttribute('y2', ray.y2.toString());
      line.setAttribute('stroke', colorHex);
      line.setAttribute('stroke-width', '0.08');
      line.setAttribute('stroke-linecap', 'butt');
      line.style.filter = `drop-shadow(0 0 0.03 ${colorHex})`;
      
      svg.appendChild(line);
    });
  }

  private renderPeripherals(state: Readonly<GameState>): void {
    const container = document.getElementById('peripheral-layer');
    if (!container) return;
    container.innerHTML = '';

    const { rows, emitters, receivers } = state;

    // Render emiterów (lewy brzeg)
    emitters.forEach(em => {
      const el = document.createElement('div');
      el.className = `emitter em-${em.color.toLowerCase()}`;
      el.style.top = `${(em.index / rows) * 100 + (50/rows)}%`;
      el.style.left = `-10px`;
      container.appendChild(el);
    });

    // Render odbiorników (prawy brzeg)
    receivers.forEach(rec => {
      const el = document.createElement('div');
      el.className = `receiver rec-${rec.targetColor.toLowerCase()} ${rec.isSatisfied ? 'satisfied' : ''}`;
      el.style.top = `${(rec.index / rows) * 100 + (50/rows)}%`;
      el.style.right = `-10px`;
      el.textContent = rec.targetColor;
      container.appendChild(el);
    });
  }

  public render(state: Readonly<GameState>): void {
    this.hideLoading();
    const t = TRANSLATIONS[state.lang];

    if (state.isDarkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');

    // Teksty i Przyciski
    const setTxt = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setTxt('lbl-lives', t.lives); setTxt('lbl-time', t.time); setTxt('lbl-total-time', t.totalTime);
    setTxt('lbl-best', t.best); setTxt('lbl-max-lvl', t.maxLvl);
    setTxt('btn-new', t.new); setTxt('btn-info', `ℹ️ ${t.info}`); setTxt('btn-lang', `🌐 ${state.lang}`);
    setTxt('btn-save', `💾 ${t.save}`); 
    setTxt('btn-load', `📂 ${t.load}`);
    // --------------------------------------------------
    setTxt('btn-open-vs', t.vsBtn);

    const darkBtn = document.getElementById('btn-dark');
    if (darkBtn) darkBtn.textContent = state.isDarkMode ? `🌙 ${t.dark}` : `☀️ ${t.light}`;

    if (this.scoreElement) this.scoreElement.textContent = state.score.toString();
    setTxt('best-val', state.rivalScore !== null ? `${state.bestScore} / ${state.rivalScore}` : state.bestScore.toString());
    setTxt('max-lvl-val', state.rivalLevel !== null ? `${state.bestLevel} / ${state.rivalLevel}` : state.bestLevel.toString());

    const livesEl = document.getElementById('lives-val');
    if (livesEl) livesEl.textContent = state.status === 'GAME_OVER' ? '☠️' : '♥'.repeat(state.lives);

    // Plansza
    const board = document.getElementById('game-board');
    if (board) {
      if (board.children.length !== state.grid.length) {
        board.innerHTML = '';
        board.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
        state.grid.forEach((_, i) => {
          const cell = document.createElement('div');
          cell.className = 'grid-cell';
          cell.dataset.id = i.toString();
          board.appendChild(cell);
        });
      }

      state.grid.forEach((elem, i) => {
        const cell = board.children[i] as HTMLElement;
        cell.innerHTML = '';
        cell.className = 'grid-cell';
        
        if (elem.type !== 'EMPTY') {
          const icon = document.createElement('div');
          icon.className = `optics-icon icon-${elem.type.toLowerCase()}`;
          icon.style.transform = `rotate(${elem.rotation}deg)`;
          cell.appendChild(icon);
        }
      });
    }

    // Warstwy dodatkowe
    this.renderPeripherals(state);
    this.renderRays(state.rays, state.cols, state.rows);

    // Stopka
    const fireBtn = document.getElementById('btn-fire') as HTMLButtonElement;
    const resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
    if (fireBtn) {
      if (state.status === 'WIN') fireBtn.textContent = t.next;
      else if (state.status === 'GAME_OVER') fireBtn.textContent = t.try;
      else fireBtn.textContent = t.fire;
    }
    if (resetBtn) resetBtn.disabled = state.status !== 'PLAYING';

    // Modale
    const infoEl = document.getElementById('dynamic-info-wrapper');
    if (infoEl) {
      const isStandalone = typeof window !== 'undefined' && 
        (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
      const isPL = state.lang === 'PL';
      const isDE = state.lang === 'DE';
      const btnInstall = isPL ? "Zainstaluj Aplikację" : isDE ? "App installieren" : "Install Application";

      infoEl.innerHTML = `
        <div class="info-content">
          <h2>${t.infoTitle}</h2>
          <ul>
            <li>🖱️ ${t.inst}</li>
            <li>🔢 ${t.instVars}</li>
            <li>❤️ <b>Roguelike:</b> One beam hitting a mine or a wrong receiver will cost a life!</li>
          </ul>
          ${!isStandalone ? `<button id="btn-modal-install" class="btn-primary" style="width:100%; margin-bottom:12px;" onclick="window.__beamsInstall && window.__beamsInstall()">📲 ${btnInstall}</button>` : ''}
          <div class="author-info"><span class="author-name">ade BEAMS by Adrian Ulbrych</span><span class="author-meta">v1.0.0 © 2026-05-14</span></div>
        </div>
      `;
    }
  }
}