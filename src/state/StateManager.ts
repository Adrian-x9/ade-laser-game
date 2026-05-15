import { GameState } from '../types/index';

export class StateManager {
  private readonly STORAGE_KEY = 'laser_game_save_v1_0';
  private state: GameState;

  constructor() {
    this.state = this.loadState();
  }

  private getDefaultState(): GameState {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let defaultLang: 'EN' | 'PL' | 'DE' = 'EN';
    if (typeof navigator !== 'undefined' && navigator.language) {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('pl')) defaultLang = 'PL';
      else if (browserLang.startsWith('de')) defaultLang = 'DE';
    }

    return {
      score: 0,
      bestScore: 0,
      bestLevel: 1,
      level: 1,
      status: 'IDLE',
      cols: 5,
      rows: 5,
      grid: [],
      emitters: [],
      receivers: [],
      rays: [],
      time: 0,
      totalTime: 0,
      lives: 3,
      savesLeft: 3,
      loadsLeft: 3,
      savedSnapshot: null,
      lang: defaultLang,
      isDarkMode: prefersDark,
      rivalScore: null,
      rivalLevel: null
    };
  }

  public getState(): Readonly<GameState> {
    return this.state;
  }

  public updateState(partialState: Partial<GameState>): void {
    this.state = { ...this.state, ...partialState };

    if (this.state.score > this.state.bestScore) {
      this.state.bestScore = this.state.score;
    }
    if (this.state.level > this.state.bestLevel) {
      this.state.bestLevel = this.state.level;
    }

    this.saveState();
  }

  private saveState(): void {
    try {
      const saveObj = {
        bestScore: this.state.bestScore,
        bestLevel: this.state.bestLevel,
        lang: this.state.lang,
        isDarkMode: this.state.isDarkMode,
        rivalScore: this.state.rivalScore,
        rivalLevel: this.state.rivalLevel
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saveObj));
    } catch (e) {
      console.warn('LocalStorage is not available:', e);
    }
  }

  private loadState(): GameState {
    const defaultState = this.getDefaultState();
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultState,
          bestScore: parsed.bestScore || 0,
          bestLevel: parsed.bestLevel || 1,
          lang: parsed.lang || defaultState.lang,
          isDarkMode: parsed.isDarkMode ?? defaultState.isDarkMode,
          rivalScore: parsed.rivalScore ?? null,
          rivalLevel: parsed.rivalLevel ?? null
        };
      }
    } catch (e) {
      console.warn('Failed to parse save data:', e);
    }
    return defaultState;
  }

  public resetCurrentGame(): void {
    this.updateState({
      score: 0,
      status: 'IDLE',
      grid: [],
      emitters: [],
      receivers: [],
      rays: [],
      lives: 3,
      savesLeft: 3,
      loadsLeft: 3,
      savedSnapshot: null,
      time: 0,
      totalTime: 0
    });
  }

  public factoryReset(): void {
    const defaultState = this.getDefaultState();
    this.state = {
      ...defaultState,
      lang: this.state.lang,
      isDarkMode: this.state.isDarkMode
    };
    this.saveState();
  }
}
