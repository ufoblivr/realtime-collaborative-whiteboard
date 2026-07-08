import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const boards = await prisma.board.findMany({
    where: { ownerId: session?.user?.id },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json(boards);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const board = await prisma.board.create({
    data: {
      name: body.name || 'Untitled board',
      ownerId: session.user.id,
      data: body.data || [],
    },
  });

  return NextResponse.json(board, { status: 201 });
}
