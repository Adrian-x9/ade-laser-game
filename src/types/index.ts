export type GameStatus = 'IDLE' | 'PLAYING' | 'GAME_OVER' | 'WIN';
export type Language = 'EN' | 'PL' | 'DE';

export type LaserColor = 'R' | 'G' | 'B' | 'C' | 'M' | 'Y' | 'W';

export interface RaySegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: LaserColor;
}

export type GridElementType = 
  | 'EMPTY'
  | 'MIRROR_1'
  | 'MIRROR_2'
  | 'SPLITTER'
  | 'MINE';

export interface GridElement {
  type: GridElementType;
  rotation: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Emitter {
  index: number;
  color: LaserColor;
  direction: Direction;
}

export interface Receiver {
  index: number;
  targetColor: LaserColor;
  isSatisfied: boolean;
}

export interface GameState {
  score: number;
  bestScore: number;
  bestLevel: number;
  level: number;
  status: GameStatus;
  
  cols: number;
  rows: number;
  grid: GridElement[];
  emitters: Emitter[];
  receivers: Receiver[];
  rays: RaySegment[];
  
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
