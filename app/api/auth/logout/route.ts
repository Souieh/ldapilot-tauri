import { deleteSession } from '@/lib/server/session-store';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  await deleteSession();

  const response = NextResponse.json({ success: true });
  response.cookies.set('session_id', '', { maxAge: 0, path: '/' });

  return response;
}
