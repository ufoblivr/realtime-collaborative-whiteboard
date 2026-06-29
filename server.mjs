import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rooms = new Map();

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { board: [], history: [], redoStack: [] });
  }
  return rooms.get(roomId);
};

const cloneBoard = (board) => board.map((item) => ({ ...item }));

const applyOperation = (room, operation) => {
  const board = cloneBoard(room.board);
  const snapshot = cloneBoard(board);
  if (operation.type === 'add' && operation.shape) {
    room.board = [...board, operation.shape];
  } else if (operation.type === 'update' && operation.shape) {
    room.board = board.map((item) => (item.id === operation.shape.id ? operation.shape : item));
  } else if (operation.type === 'delete' && operation.targetId) {
    room.board = board.filter((item) => item.id !== operation.targetId);
  } else if (operation.type === 'clear') {
    room.board = [];
  } else if (operation.type === 'set' && operation.board) {
    room.board = operation.board;
  }
  room.history.push(snapshot);
  room.redoStack = [];
};

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, userName, color }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userName = userName;
      socket.data.color = color;
      const room = getRoom(roomId);
      socket.emit('board:state', { board: room.board });
      const users = [];
      const roomSockets = io.sockets.adapter.rooms.get(roomId) || new Set();
      roomSockets.forEach((id) => {
        const current = io.sockets.sockets.get(id);
        if (current?.data?.userName) {
          users.push({
            id,
            name: current.data.userName,
            color: current.data.color || '#38bdf8',
            x: current.data.x || 0,
            y: current.data.y || 0,
            connected: true,
          });
        }
      });
      io.to(roomId).emit('presence', { users });
    });

    socket.on('board:operation', ({ roomId, operation }) => {
      const room = getRoom(roomId);
      applyOperation(room, operation);
      socket.to(roomId).emit('board:operation', { operation });
    });

    socket.on('board:undo', ({ roomId }) => {
      const room = getRoom(roomId);
      if (room.history.length) {
        const previous = room.history.pop();
        room.redoStack.push(cloneBoard(room.board));
        room.board = previous || [];
        io.to(roomId).emit('board:operation', { operation: { type: 'set', board: room.board } });
      }
    });

    socket.on('board:redo', ({ roomId }) => {
      const room = getRoom(roomId);
      if (room.redoStack.length) {
        const next = room.redoStack.pop();
        room.history.push(cloneBoard(room.board));
        room.board = next || [];
        io.to(roomId).emit('board:operation', { operation: { type: 'set', board: room.board } });
      }
    });

    socket.on('cursor', ({ roomId, x, y, color, name }) => {
      socket.data.x = x;
      socket.data.y = y;
      socket.to(roomId).emit('cursor', { cursor: { id: socket.id, name, color, x, y, connected: true } });
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        return;
      }
      const roomSockets = io.sockets.adapter.rooms.get(roomId) || new Set();
      const users = [];
      roomSockets.forEach((id) => {
        const current = io.sockets.sockets.get(id);
        if (current?.data?.userName) {
          users.push({
            id,
            name: current.data.userName,
            color: current.data.color || '#38bdf8',
            x: current.data.x || 0,
            y: current.data.y || 0,
            connected: true,
          });
        }
      });
      io.to(roomId).emit('presence', { users });
    });
  });

  server.listen(port, hostname, () => {
    console.log(`Ready on http://${hostname}:${port}`);
  });
});
