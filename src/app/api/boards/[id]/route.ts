import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const board = await prisma.board.findUnique({ where: { id: params.id } });
  if (!board) {
    return new NextResponse(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
  return NextResponse.json(board);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const board = await prisma.board.findUnique({ where: { id: params.id } });
  if (!board) {
    return new NextResponse(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  if (board.ownerId !== session.user.id) {
    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const body = await request.json();
  const updated = await prisma.board.update({
    where: { id: params.id },
    data: { data: body.data, updatedAt: new Date() },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const board = await prisma.board.findUnique({ where: { id: params.id } });
  if (!board) {
    return new NextResponse(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  if (board.ownerId !== session.user.id) {
    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  await prisma.board.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
