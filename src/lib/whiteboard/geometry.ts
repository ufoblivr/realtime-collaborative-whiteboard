import type { BoardShape, CircleShape, Point, RectangleShape, TextShape } from './types';

export const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const cloneBoard = (board: BoardShape[]): BoardShape[] => board.map((shape) => ({ ...shape }));

export const createTextShape = (
  x: number,
  y: number,
  color: string,
  strokeWidth: number,
  createdBy: string,
  text = 'Text',
): TextShape => ({
  id: createId(),
  kind: 'text',
  x,
  y,
  text,
  fontSize: 24,
  color,
  strokeWidth,
  createdBy,
  rotation: 0,
});

export const getShapeBounds = (shape: BoardShape) => {
  switch (shape.kind) {
    case 'rectangle':
      return {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
      };
    case 'circle':
      return {
        x: shape.x - shape.radius,
        y: shape.y - shape.radius,
        width: shape.radius * 2,
        height: shape.radius * 2,
      };
    case 'text':
      return {
        x: shape.x,
        y: shape.y,
        width: shape.text.length * (shape.fontSize * 0.6),
        height: shape.fontSize * 1.2,
      };
    case 'line':
    case 'arrow':
      return {
        x: Math.min(shape.start.x, shape.end.x),
        y: Math.min(shape.start.y, shape.end.y),
        width: Math.abs(shape.end.x - shape.start.x),
        height: Math.abs(shape.end.y - shape.start.y),
      };
    case 'pen':
      if (!shape.points.length) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
      const xs = shape.points.map((point) => point.x);
      const ys = shape.points.map((point) => point.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
};

export const pointInShape = (shape: BoardShape, point: Point) => {
  const bounds = getShapeBounds(shape);
  if (shape.kind === 'rectangle') {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }
  if (shape.kind === 'circle') {
    const dx = point.x - shape.x;
    const dy = point.y - shape.y;
    return dx * dx + dy * dy <= shape.radius * shape.radius;
  }
  if (shape.kind === 'text') {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }
  if (shape.kind === 'line' || shape.kind === 'arrow') {
    const dx = shape.end.x - shape.start.x;
    const dy = shape.end.y - shape.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
      return Math.hypot(point.x - shape.start.x, point.y - shape.start.y) <= 8;
    }
    const t = ((point.x - shape.start.x) * dx + (point.y - shape.start.y) * dy) / lengthSquared;
    const closestX = shape.start.x + t * dx;
    const closestY = shape.start.y + t * dy;
    return Math.hypot(point.x - closestX, point.y - closestY) <= 8;
  }
  if (shape.kind === 'pen') {
    for (let index = 1; index < shape.points.length; index += 1) {
      const p1 = shape.points[index - 1];
      const p2 = shape.points[index];
      const distance = Math.abs((p2.y - p1.y) * point.x - (p2.x - p1.x) * point.y + p2.x * p1.y - p2.y * p1.x) / Math.hypot(p2.y - p1.y, p2.x - p1.x);
      if (distance <= 6) {
        return true;
      }
    }
  }
  return false;
};

export const getShapeAtPoint = (shapes: BoardShape[], point: Point) => {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (pointInShape(shape, point)) {
      return shape;
    }
  }
  return null;
};

export const getResizeHandles = (shape: BoardShape) => {
  const bounds = getShapeBounds(shape);
  return [
    { x: bounds.x, y: bounds.y, type: 'nw' },
    { x: bounds.x + bounds.width, y: bounds.y, type: 'ne' },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se' },
    { x: bounds.x, y: bounds.y + bounds.height, type: 'sw' },
  ];
};

export const getRotationHandle = (shape: BoardShape) => {
  const bounds = getShapeBounds(shape);
  return { x: bounds.x + bounds.width / 2, y: bounds.y - 26 };
};

export const getShapeCenter = (shape: BoardShape) => {
  const bounds = getShapeBounds(shape);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
};

export const serializeBoard = (board: BoardShape[]) => JSON.stringify(board);
