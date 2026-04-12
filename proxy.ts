import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // Redirects for in-memory sessions are handled in layouts
  // to ensure access to the shared Node.js memory heap.
  return NextResponse.next();
} 

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};