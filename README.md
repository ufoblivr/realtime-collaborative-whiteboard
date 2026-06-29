# Realtime Collaborative Whiteboard

A production-style collaborative whiteboard built with Next.js, TypeScript, Tailwind CSS, the HTML canvas, and Socket.IO for real-time shared editing.

## Features

- Shared canvas for drawing and shape creation
- Real-time collaboration across browser sessions
- Presence indicators and cursor sharing
- Undo/redo, delete, clear, zoom, and pan
- Responsive toolbar and modern dark UI

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 to use the board.

## Environment variables

```bash
cp .env.example .env.local
```

Example values:

- PORT=3000
- NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

## Project structure

- src/app: app router entry points and layout
- src/components/whiteboard: whiteboard UI and canvas interactions
- src/lib/whiteboard: geometry helpers and shared types
- server.mjs: custom Next.js + Socket.IO server

## Deployment

Deploy to Vercel, Render, or any Node.js host that supports WebSockets. Set the same environment variables in your hosting provider and start the app with npm run start.

## Future improvements

- Authentication and board ownership
- Export to PNG/SVG/JSON
- Multiple boards with shareable URLs
- CRDT-based conflict-free synchronization
