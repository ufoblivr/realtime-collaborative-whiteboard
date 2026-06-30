export type Tool = 'select' | 'pen' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text' | 'pan';
export type ShapeKind = 'pen' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface BaseShape {
  id: string;
  kind: ShapeKind;
  color: string;
  strokeWidth: number;
  createdBy: string;
  rotation: number;
}

export interface PenShape extends BaseShape {
  kind: 'pen';
  points: Point[];
}

export interface RectangleShape extends BaseShape {
  kind: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleShape extends BaseShape {
  kind: 'circle';
  x: number;
  y: number;
  radius: number;
}

export interface ArrowShape extends BaseShape {
  kind: 'arrow';
  start: Point;
  end: Point;
}

export interface LineShape extends BaseShape {
  kind: 'line';
  start: Point;
  end: Point;
}

export interface TextShape extends BaseShape {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export type BoardShape = PenShape | RectangleShape | CircleShape | ArrowShape | LineShape | TextShape;

export interface Presence {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  connected: boolean;
}

export interface Operation {
  type: 'add' | 'update' | 'delete' | 'clear' | 'set';
  shape?: BoardShape;
  targetId?: string;
  board?: BoardShape[];
}
