export type GameStatus = 'IDLE' | 'PLAYING' | 'GAME_OVER' | 'WIN';
export type Language = 'EN' | 'PL' | 'DE';

// Podstawowe i pochodne kolory światła w modelu addytywnym (RGB)
export type LaserColor = 'R' | 'G' | 'B' | 'C' | 'M' | 'Y' | 'W';

// Reprezentacja pojedynczego segmentu promienia (do renderowania pięknych wiązek SVG/Canvas)
export interface RaySegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: LaserColor;
}

// Typy elementów, które mogą znajdować się na siatce (wewnątrz planszy)
export type GridElementType = 
  | 'EMPTY'    // Pusta przestrzeń
  | 'MIRROR_1' // Lustro '/'
  | 'MIRROR_2' // Lustro '\'
  | 'SPLITTER' // Rozszczepiacz (pryzmat)
  | 'MINE';    // Niestabilna mina optyczna (dotknięcie = wybuch)

export interface GridElement {
  type: GridElementType;
  // Obiekty optyczne mogą być obracane przez gracza (0, 90, 180, 270 stopni)
  rotation: number; 
}

// Kierunki strzału lub wejścia promienia
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

// Emiter (działko laserowe) na obrzeżach planszy
export interface Emitter {
  index: number; // Pozycja (np. indeks brzegowy lub przypisany wiersz/kolumna)
  color: LaserColor; // Strzela czystą wiązką R, G lub B
  direction: Direction;
}

// Odbiornik docelowy na obrzeżach planszy
export interface Receiver {
  index: number;
  targetColor: LaserColor; // Żądany kolor (np. 'Y' wymaga jednoczesnego trafienia R i G)
  isSatisfied: boolean;    // Czy w danej chwili jest poprawnie zasilony
}

export interface GameState {
  score: number;
  bestScore: number;
  bestLevel: number;
  level: number;
  status: GameStatus;
  
  // --- STRUKTURA PLANSZY OPTYCZNEJ ---
  cols: number;
  rows: number;
  grid: GridElement[]; // Kafelki na planszy, którymi gracz może manipulować
  emitters: Emitter[]; // Działka zasilające
  receivers: Receiver[]; // Cele docelowe
  rays: RaySegment[]; // Obliczone w locie wiązki światła do wyrenderowania
  
  time: number;
  totalTime: number;
  lives: number;
  savesLeft: number;
  loadsLeft: number;
  savedSnapshot: string | null;
  lang: Language;
  isDarkMode: boolean;
  rivalScore: number | null;
  rivalLevel: number | null;
}