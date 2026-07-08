'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Whiteboard from '@/components/whiteboard/Whiteboard';

type BoardSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

export default function Home() {
  const { data: session, status } = useSession();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  
  const getBoardFromUrl = () => {
    if (typeof window === 'undefined') {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('board');
  };

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(() => getBoardFromUrl());
  const [selectedBoardName, setSelectedBoardName] = useState<string>('Untitled board');
  const [newBoardName, setNewBoardName] = useState('Untitled board');
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const loadBoards = async () => {
      setLoadingBoards(true);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/boards');
        if (!response.ok) {
          throw new Error('Failed to load boards');
        }
        const data = (await response.json()) as BoardSummary[];
        setBoards(data);

        const urlBoardId = getBoardFromUrl();
        if (urlBoardId) {
          const selected = data.find((board) => board.id === urlBoardId);
          if (selected) {
            setSelectedBoardId(selected.id);
            setSelectedBoardName(selected.name);
            return;
          }
        }

        if (!selectedBoardId && data.length > 0) {
          setSelectedBoardId(data[0].id);
          setSelectedBoardName(data[0].name);
        }
      } catch (error) {
        setErrorMessage((error as Error).message || 'Unable to load boards');
      } finally {
        setLoadingBoards(false);
      }
    };

    void loadBoards();
  }, [status, selectedBoardId]);

  const createBoard = async () => {
    setErrorMessage(null);
    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        body: JSON.stringify({ name: newBoardName, data: [] }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to create board');
      }
      const board = await response.json();
      setBoards((current) => [board, ...current]);
      setSelectedBoardId(board.id);
      setSelectedBoardName(board.name);
      setNewBoardName('Untitled board');
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('board', board.id);
        window.history.replaceState({}, '', url.toString());
      }
    } catch (error) {
      setErrorMessage((error as Error).message || 'Unable to create board');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-300">Loading session…</p>
      </div>
    );
  }

  if (!session?.user) {
    // Show demo mode if user wants to try it or if board ID is in URL
    if (selectedBoardId) {
      // Guest mode with board selected - show whiteboard
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <header className="border-b border-white/10 bg-slate-900/80 px-4 py-5 shadow-sm shadow-slate-950/20">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Realtime Collaborative Whiteboard</p>
                <p className="text-sm text-slate-400">Demo Mode</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBoardId(null)}
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Back
              </button>
            </div>
          </header>

          <main className="mx-auto w-full px-4 py-6">
            <div className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">Board</p>
                  <p className="text-xl font-semibold text-slate-100">{selectedBoardName || selectedBoardId || 'Demo board'}</p>
                </div>
              </div>
              <Whiteboard initialBoardId={selectedBoardId} />
            </div>
          </main>
        </div>
      );
    }
    
    // Guest mode - login screen with Try Demo option
    const demoBoard = 'demo-board-' + Math.random().toString(36).slice(2, 9);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-4">
        <div className="max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-10 text-center shadow-2xl">
          <h1 className="text-3xl font-semibold mb-4">Realtime Collaborative Whiteboard</h1>
          <p className="mb-8 text-slate-400">Draw and collaborate in real-time with shared cursors and instant synchronization.</p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setSelectedBoardId(demoBoard);
              }}
              className="w-full inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400"
            >
              Try Demo
            </button>
            <p className="text-xs text-slate-500">Or sign in for persistent boards:</p>
            <button
              type="button"
              onClick={() => signIn('google')}
              className="w-full inline-flex items-center justify-center rounded-full border border-white/20 bg-slate-800 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const userName = session?.user?.name || session?.user?.email || 'Signed in user';

  const boardList = (
    <aside className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">My boards</p>
          <p className="text-lg font-semibold text-slate-100">{boards.length} saved boards</p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
        >
          Sign out
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid gap-2">
          <input
            value={newBoardName}
            onChange={(event) => setNewBoardName(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            placeholder="New board name"
          />
          <button
            type="button"
            onClick={createBoard}
            className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Create board
          </button>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        {loadingBoards ? (
          <p className="text-sm text-slate-400">Loading boards…</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-slate-400">No boards yet. Create one to begin.</p>
        ) : (
          boards.map((board) => (
            <button
              key={board.id}
              type="button"
              onClick={() => {
                setSelectedBoardId(board.id);
                setSelectedBoardName(board.name);
              }}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                selectedBoardId === board.id
                  ? 'border-sky-500 bg-slate-800 text-sky-200'
                  : 'border-white/10 bg-slate-950 text-slate-200 hover:border-slate-200/20'
              }`}
            >
              <div className="font-semibold">{board.name}</div>
              <div className="text-xs text-slate-500">Updated {new Date(board.updatedAt).toUTCString()}</div>
            </button>
          ))
        )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/80 px-4 py-5 shadow-sm shadow-slate-950/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">Realtime Collaborative Whiteboard</p>
            <p className="text-sm text-slate-400">Signed in as {userName}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {boardList}
        <div className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Board</p>
              <p className="text-xl font-semibold text-slate-100">{selectedBoardName || selectedBoardId || 'Untitled board'}</p>
            </div>
          </div>
          {selectedBoardId ? (
            <Whiteboard initialBoardId={selectedBoardId} />
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/60 p-8 text-center text-slate-400">
              Select or create a board to begin drawing.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
