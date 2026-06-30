'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Circle, Grid3X3, MousePointer2, Pencil, Redo2, RotateCw, Save, Square, Trash2, Type, Undo2, ZoomIn, ZoomOut, Move, Copy, Maximize2, Minimize2, Menu } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { createTextShape, getResizeHandles, getRotationHandle, getShapeAtPoint, getShapeBounds, getShapeCenter, serializeBoard } from '@/lib/whiteboard/geometry';
import type { BoardShape, Operation, Point, Presence, Tool } from '@/lib/whiteboard/types';

const TOOL_OPTIONS: Array<{ key: Tool; label: string; icon: React.ReactNode }> = [
  { key: 'select', label: 'Select', icon: <MousePointer2 size={16} /> },
  { key: 'pen', label: 'Pen', icon: <Pencil size={16} /> },
  { key: 'rectangle', label: 'Rect', icon: <Square size={16} /> },
  { key: 'circle', label: 'Circle', icon: <Circle size={16} /> },
  { key: 'arrow', label: 'Arrow', icon: <ArrowRight size={16} /> },
  { key: 'line', label: 'Line', icon: <Move size={16} /> },
  { key: 'text', label: 'Text', icon: <Type size={16} /> },
  { key: 'pan', label: 'Pan', icon: <Grid3X3 size={16} /> },
];

const COLORS = ['#0f172a', '#2563eb', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899'];

const getBoardId = () => {
  if (typeof window === 'undefined') {
    return 'demo-board';
  }
  const params = new URLSearchParams(window.location.search);
  const board = params.get('board');
  return board ?? 'demo-board';
};

const getStoredBoard = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem('rtw-whiteboard');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getUserName = () => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('rtw-user-name');
    if (stored) {
      return stored;
    }
  }
  const fallback = `Guest-${Math.floor(Math.random() * 1000)}`;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('rtw-user-name', fallback);
  }
  return fallback;
};

const drawShape = (ctx: CanvasRenderingContext2D, shape: BoardShape, selected = false) => {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth;
  ctx.fillStyle = shape.color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.translate(0, 0);

  if (shape.kind === 'rectangle') {
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
  }
  if (shape.kind === 'circle') {
    ctx.beginPath();
    ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (shape.kind === 'line') {
    ctx.beginPath();
    ctx.moveTo(shape.start.x, shape.start.y);
    ctx.lineTo(shape.end.x, shape.end.y);
    ctx.stroke();
  }
  if (shape.kind === 'arrow') {
    const angle = Math.atan2(shape.end.y - shape.start.y, shape.end.x - shape.start.x);
    ctx.beginPath();
    ctx.moveTo(shape.start.x, shape.start.y);
    ctx.lineTo(shape.end.x, shape.end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shape.end.x, shape.end.y);
    ctx.lineTo(shape.end.x - 12 * Math.cos(angle - Math.PI / 6), shape.end.y - 12 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(shape.end.x - 12 * Math.cos(angle + Math.PI / 6), shape.end.y - 12 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
  if (shape.kind === 'pen') {
    if (shape.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.slice(1).forEach(({ x, y }) => ctx.lineTo(x, y));
      ctx.stroke();
    }
  }
  if (shape.kind === 'text') {
    ctx.font = `${shape.fontSize}px Arial`;
    ctx.fillText(shape.text, shape.x, shape.y);
  }

  if (selected) {
    const bounds = getShapeBounds(shape);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
    const handles = getResizeHandles(shape);
    handles.forEach((handle) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    const rotationHandle = getRotationHandle(shape);
    ctx.beginPath();
    ctx.arc(rotationHandle.x, rotationHandle.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
};

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const boardRef = useRef<BoardShape[]>([]);
  const [board, setBoard] = useState<BoardShape[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState('#0f172a');
  const [brushSize, setBrushSize] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [cursors, setCursors] = useState<Record<string, Presence>>({});
  const [boardId, setBoardId] = useState('demo-board');
  const [shareLink, setShareLink] = useState('demo-board');
  const [userName, setUserName] = useState(getUserName());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });
  const [draftShape, setDraftShape] = useState<BoardShape | null>(null);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragInfo, setDragInfo] = useState<{ type: 'move' | 'resize' | 'rotate'; shapeId: string; offset?: Point; handle?: string; start?: Point } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState<Point | null>(null);

  useEffect(() => {
    setBoardId(getBoardId());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareLink(`${window.location.origin}${window.location.pathname}?board=${boardId}`);
    }
  }, [boardId]);

  useEffect(() => {
    const onFs = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleSidebar = () => setSidebarCollapsed((v) => !v);

  const copyShareLink = async () => {
    try {
      if (navigator.clipboard && shareLink) {
        await navigator.clipboard.writeText(shareLink);
        setCopySuccess('Copied');
        setTimeout(() => setCopySuccess(null), 1500);
      }
    } catch (e) {
      setCopySuccess('Failed');
      setTimeout(() => setCopySuccess(null), 1500);
    }
  };

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullScreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullScreen(false);
      }
    } catch (e) {
      // ignore fullscreen errors
    }
  };

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    const stored = getStoredBoard();
    if (stored) {
      setBoard(stored);
      boardRef.current = stored;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rtw-whiteboard', JSON.stringify(board));
    }
  }, [board]);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', { roomId: boardId, userName, color });
    });

    socket.on('board:state', ({ board: remoteBoard }: { board: BoardShape[] }) => {
      setBoard(remoteBoard);
      boardRef.current = remoteBoard;
    });

    socket.on('board:operation', ({ operation }: { operation: Operation }) => {
      const shaped = operation.shape ?? null;
      if (operation.type === 'add' && shaped) {
        setBoard((current) => {
          const next = [...current, shaped];
          boardRef.current = next;
          return next;
        });
      }
      if (operation.type === 'update' && shaped) {
        setBoard((current) => {
          const next = current.map((item) => (item.id === shaped.id ? shaped : item));
          boardRef.current = next;
          return next;
        });
      }
      if (operation.type === 'delete' && operation.targetId) {
        setBoard((current) => {
          const next = current.filter((item) => item.id !== operation.targetId);
          boardRef.current = next;
          return next;
        });
      }
      if (operation.type === 'clear') {
        setBoard([]);
        boardRef.current = [];
      }
      if (operation.type === 'set' && operation.board) {
        setBoard(operation.board);
        boardRef.current = operation.board;
      }
    });

    socket.on('presence', ({ users }: { users: Presence[] }) => {
      setPresence(users);
    });

    socket.on('cursor', ({ cursor }: { cursor: Presence }) => {
      setCursors((current) => ({ ...current, [cursor.id]: cursor }));
    });

    return () => {
      socket.disconnect();
    };
  }, [boardId, userName, color]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const updateSize = () => {
      const next = {
        width: container.clientWidth || 1200,
        height: container.clientHeight || 800,
      };
      setViewportSize(next);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewportSize.width * dpr;
    canvas.height = viewportSize.height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, viewportSize.width, viewportSize.height);
    context.save();
    context.translate(pan.x, pan.y);
    context.scale(zoom, zoom);

    context.fillStyle = '#f8fafc';
    context.fillRect(-pan.x / zoom, -pan.y / zoom, viewportSize.width / zoom, viewportSize.height / zoom);

    context.strokeStyle = '#e2e8f0';
    context.lineWidth = 1;
    for (let x = 0; x < viewportSize.width / zoom + 100; x += 24) {
      context.beginPath();
      context.moveTo(x - pan.x / zoom, -pan.y / zoom);
      context.lineTo(x - pan.x / zoom, viewportSize.height / zoom + 100);
      context.stroke();
    }
    for (let y = 0; y < viewportSize.height / zoom + 100; y += 24) {
      context.beginPath();
      context.moveTo(-pan.x / zoom, y - pan.y / zoom);
      context.lineTo(viewportSize.width / zoom + 100, y - pan.y / zoom);
      context.stroke();
    }

    board.forEach((shape) => drawShape(context, shape, selectedId === shape.id));
    if (draftShape) {
      drawShape(context, draftShape, true);
    }
    if (draftPoints.length > 1) {
      const preview: BoardShape = {
        id: 'draft',
        kind: 'pen',
        points: draftPoints,
        color,
        strokeWidth: brushSize,
        createdBy: userName,
        rotation: 0,
      };
      drawShape(context, preview);
    }

    Object.values(cursors).forEach((cursor) => {
      context.fillStyle = cursor.color;
      context.beginPath();
      context.moveTo(cursor.x, cursor.y);
      context.lineTo(cursor.x + 6, cursor.y + 10);
      context.lineTo(cursor.x + 14, cursor.y + 6);
      context.closePath();
      context.fill();
      context.fillText(cursor.name, cursor.x + 10, cursor.y + 12);
    });

    context.restore();
  }, [board, color, brushSize, selectedId, draftShape, draftPoints, pan, zoom, viewportSize, cursors, userName]);

  const commitOperation = (operation: Operation) => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    socket.emit('board:operation', { roomId: boardId, operation });
  };

  const sendCursor = (x: number, y: number) => {
    socketRef.current?.emit('cursor', { roomId: boardId, x, y, color, name: userName });
  };

  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - pan.x) / zoom,
      y: (event.clientY - bounds.top - pan.y) / zoom,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    sendCursor(point.x, point.y);

    if (tool === 'pan') {
      setIsPanning(true);
      setPanOrigin(point);
      return;
    }

    if (tool === 'pen') {
      setIsDrawing(true);
      setDraftPoints([point]);
      return;
    }

    if (tool === 'text') {
      const input = window.prompt('Enter text', 'Text');
      const shape = createTextShape(point.x, point.y, color, brushSize, userName, input ?? 'Text');
      const operation: Operation = { type: 'add', shape };
      commitOperation(operation);
      setBoard((current) => {
        const next = [...current, shape];
        boardRef.current = next;
        return next;
      });
      setSelectedId(shape.id);
      return;
    }

    if (tool === 'select') {
      const hit = getShapeAtPoint(boardRef.current, point);
      if (hit) {
        setSelectedId(hit.id);
        const bounds = getShapeBounds(hit);
        const handles = getResizeHandles(hit);
        const rotationHandle = getRotationHandle(hit);
        const isHandle = handles.some(({ x, y }) => Math.hypot(point.x - x, point.y - y) <= 8);
        const isRotate = Math.hypot(point.x - rotationHandle.x, point.y - rotationHandle.y) <= 8;
        if (isHandle) {
          setDragInfo({ type: 'resize', shapeId: hit.id, handle: 'se', start: point });
          return;
        }
        if (isRotate) {
          setDragInfo({ type: 'rotate', shapeId: hit.id, start: point });
          return;
        }
        setDragInfo({ type: 'move', shapeId: hit.id, offset: { x: point.x - bounds.x, y: point.y - bounds.y } });
        return;
      }
      setSelectedId(null);
      return;
    }

    const baseShape: BoardShape = tool === 'rectangle'
      ? { id: 'draft', kind: 'rectangle', x: point.x, y: point.y, width: 0, height: 0, color, strokeWidth: brushSize, createdBy: userName, rotation: 0 }
      : tool === 'circle'
        ? { id: 'draft', kind: 'circle', x: point.x, y: point.y, radius: 0, color, strokeWidth: brushSize, createdBy: userName, rotation: 0 }
        : tool === 'arrow'
          ? { id: 'draft', kind: 'arrow', start: point, end: point, color, strokeWidth: brushSize, createdBy: userName, rotation: 0 }
          : { id: 'draft', kind: 'line', start: point, end: point, color, strokeWidth: brushSize, createdBy: userName, rotation: 0 };
    setDraftShape(baseShape);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(event);
    sendCursor(point.x, point.y);

    if (isPanning && panOrigin) {
      setPan({ x: pan.x + (point.x - panOrigin.x), y: pan.y + (point.y - panOrigin.y) });
      setPanOrigin(point);
      return;
    }

    if (tool === 'pen' && isDrawing) {
      setDraftPoints((current) => [...current, point]);
      return;
    }

    if (draftShape) {
      if (draftShape.kind === 'rectangle') {
        const width = point.x - draftShape.x;
        const height = point.y - draftShape.y;
        setDraftShape({ ...draftShape, width, height });
      }
      if (draftShape.kind === 'circle') {
        const radius = Math.hypot(point.x - draftShape.x, point.y - draftShape.y);
        setDraftShape({ ...draftShape, radius });
      }
      if (draftShape.kind === 'arrow' || draftShape.kind === 'line') {
        setDraftShape({ ...draftShape, end: point });
      }
    }

    if (dragInfo && dragInfo.shapeId) {
      const currentShape = boardRef.current.find((item) => item.id === dragInfo.shapeId);
      if (!currentShape) {
        return;
      }
      if (dragInfo.type === 'move') {
        const next = { ...currentShape } as BoardShape;
        if (next.kind === 'rectangle') {
          next.x = point.x - (dragInfo.offset?.x ?? 0);
          next.y = point.y - (dragInfo.offset?.y ?? 0);
        }
        if (next.kind === 'circle') {
          next.x = point.x;
          next.y = point.y;
        }
        if (next.kind === 'text') {
          next.x = point.x - 40;
          next.y = point.y - 20;
        }
        if (next.kind === 'line' || next.kind === 'arrow') {
          const dx = point.x - (dragInfo.start?.x ?? point.x);
          const dy = point.y - (dragInfo.start?.y ?? point.y);
          next.start = { x: next.start.x + dx, y: next.start.y + dy };
          next.end = { x: next.end.x + dx, y: next.end.y + dy };
        }
        setBoard((current) => {
          const updated = current.map((item) => (item.id === next.id ? next : item));
          boardRef.current = updated;
          return updated;
        });
        commitOperation({ type: 'update', shape: next });
      }
      if (dragInfo.type === 'resize') {
        const next = { ...currentShape } as BoardShape;
        if (next.kind === 'rectangle') {
          next.width = Math.max(12, point.x - next.x);
          next.height = Math.max(12, point.y - next.y);
        }
        if (next.kind === 'circle') {
          next.radius = Math.max(12, Math.hypot(point.x - next.x, point.y - next.y));
        }
        setBoard((current) => {
          const updated = current.map((item) => (item.id === next.id ? next : item));
          boardRef.current = updated;
          return updated;
        });
        commitOperation({ type: 'update', shape: next });
      }
      if (dragInfo.type === 'rotate') {
        const center = getShapeCenter(currentShape);
        const angle = Math.atan2(point.y - center.y, point.x - center.x);
        const next = { ...currentShape, rotation: angle };
        setBoard((current) => {
          const updated = current.map((item) => (item.id === next.id ? next : item));
          boardRef.current = updated;
          return updated;
        });
        commitOperation({ type: 'update', shape: next });
      }
    }
  };

  const handlePointerUp = () => {
    if (tool === 'pen' && isDrawing) {
      const shape: BoardShape = {
        id: `shape-${Date.now()}`,
        kind: 'pen',
        points: draftPoints,
        color,
        strokeWidth: brushSize,
        createdBy: userName,
        rotation: 0,
      };
      const operation: Operation = { type: 'add', shape };
      commitOperation(operation);
      setBoard((current) => {
        const next = [...current, shape];
        boardRef.current = next;
        return next;
      });
      setDraftPoints([]);
      setIsDrawing(false);
      return;
    }

    if (draftShape) {
      const operation: Operation = { type: 'add', shape: draftShape };
      commitOperation(operation);
      setBoard((current) => {
        const next = [...current, draftShape];
        boardRef.current = next;
        return next;
      });
      setDraftShape(null);
      return;
    }

    setIsPanning(false);
    setPanOrigin(null);
    setDragInfo(null);
  };

  const deleteSelected = () => {
    if (!selectedId) {
      return;
    }
    const operation: Operation = { type: 'delete', targetId: selectedId };
    commitOperation(operation);
    setBoard((current) => {
      const next = current.filter((item) => item.id !== selectedId);
      boardRef.current = next;
      return next;
    });
    setSelectedId(null);
  };

  const clearBoard = () => {
    commitOperation({ type: 'clear' });
    setBoard([]);
    boardRef.current = [];
  };

  const undo = () => {
    socketRef.current?.emit('board:undo', { roomId: boardId });
  };

  const redo = () => {
    socketRef.current?.emit('board:redo', { roomId: boardId });
  };

  const zoomIn = () => setZoom((value) => Math.min(3, value + 0.1));
  const zoomOut = () => setZoom((value) => Math.max(0.5, value - 0.1));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelected();
      }
      if (event.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, boardId]);

  const summary = useMemo(() => `${board.length} shapes • ${presence.length} online`, [board.length, presence.length]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {!isFullScreen && (
        <header className="border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-lg font-semibold">Realtime Collaborative Whiteboard</p>
                <p className="text-sm text-slate-400 flex items-center gap-2">
                  <span>Share this link with collaborators:</span>
                  <span className="font-mono text-xs text-slate-300 truncate max-w-[420px]">{shareLink}</span>
                  <button onClick={copyShareLink} className="ml-2 rounded px-2 py-1 bg-slate-800 text-slate-200 border border-white/10 text-sm flex items-center gap-2">
                    <Copy size={14} /> Copy
                  </button>
                  {copySuccess && <span className="ml-2 text-sm text-emerald-400">{copySuccess}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={toggleFullScreen} className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm flex items-center gap-2">
                <Maximize2 size={14} /> Fullscreen
              </button>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-800/80 px-3 py-2 text-sm">
                <Save size={14} />
                <span>{summary}</span>
              </div>
              <button onClick={toggleSidebar} className="ml-2 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm flex items-center gap-2">
                <Menu size={14} /> {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>
          </div>
        </header>
      )}

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className={`${sidebarCollapsed ? 'w-14' : 'w-full lg:w-80'} border-b border-white/10 bg-slate-900/70 p-2 lg:border-b-0 lg:border-r`}> 
          {!sidebarCollapsed ? (
            <div className="space-y-4 p-2">
              <div>
                <label className="mb-2 block text-sm text-slate-400">Board name</label>
                <input
                  value={boardId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setBoardId(next);
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      url.searchParams.set('board', next);
                      window.history.replaceState({}, '', url.toString());
                    }
                  }}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Display name</label>
                <input
                  value={userName}
                  onChange={(event) => {
                    const next = event.target.value;
                    setUserName(next);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('rtw-user-name', next);
                    }
                  }}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Tools</label>
                <div className="grid grid-cols-2 gap-2">
                  {TOOL_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setTool(option.key)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${tool === option.key ? 'border-sky-500 bg-sky-600/20 text-sky-300' : 'border-white/10 bg-slate-800 text-slate-200'}`}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                <div>
                  <label className="mb-2 block text-sm text-slate-400">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((swatch) => (
                      <button
                        key={swatch}
                        onClick={() => setColor(swatch)}
                        className={`h-7 w-7 rounded-full border-2 ${color === swatch ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-400">Brush size</label>
                  <input type="range" min="1" max="16" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="w-full" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={undo} className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm">Undo</button>
                <button onClick={redo} className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm">Redo</button>
                <button onClick={clearBoard} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">Clear</button>
                <button onClick={deleteSelected} className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm">Delete</button>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-800/80 p-3">
                <p className="mb-2 text-sm text-slate-400">Presence</p>
                <div className="flex flex-wrap gap-2">
                  {presence.map((person) => (
                    <span key={person.id} className="rounded-full border border-white/10 px-2 py-1 text-xs" style={{ color: person.color }}>
                      {person.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-800/80 p-3 text-sm text-slate-400">
                <p className="font-medium text-slate-200">Shortcuts</p>
                <ul className="mt-2 space-y-1">
                  <li>Ctrl/Cmd + Z: Undo</li>
                  <li>Ctrl/Cmd + Y: Redo</li>
                  <li>Delete: Remove selection</li>
                  <li>Pan tool: Drag viewport</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              {TOOL_OPTIONS.map((option) => (
                <button key={option.key} title={option.label} onClick={() => setTool(option.key)} className={`flex h-10 w-10 items-center justify-center rounded hover:bg-slate-800/60 ${tool === option.key ? 'ring-2 ring-sky-500' : ''}`}>
                  {option.icon}
                </button>
              ))}
              <div className="mt-4 flex flex-col items-center gap-2">
                <button title="Toggle sidebar" onClick={toggleSidebar} className="h-8 w-8 rounded bg-slate-800/60 flex items-center justify-center"><Menu size={14} /></button>
                <button title="Fullscreen" onClick={toggleFullScreen} className="h-8 w-8 rounded bg-slate-800/60 flex items-center justify-center"><Maximize2 size={14} /></button>
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={zoomIn} className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm"><ZoomIn size={16} /></button>
              <button onClick={zoomOut} className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm"><ZoomOut size={16} /></button>
              <span className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm">Zoom {zoom.toFixed(1)}×</span>
            </div>
            
          </div>
          <div ref={containerRef} className="h-[75vh] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
            <canvas
              ref={canvasRef}
              className="h-full w-full touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onWheel={(event) => {
                event.preventDefault();
                if (event.ctrlKey || event.metaKey) {
                  setZoom((value) => Math.min(3, Math.max(0.5, value + (event.deltaY > 0 ? -0.1 : 0.1))));
                }
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
