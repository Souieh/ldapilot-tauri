import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export interface Session {
  id: string;
  userDN: string;
  userPN: string;
  username: string;
  profileId: string;
  password: string;
  expiry: number;
}

const COOKIE_NAME = 'session';
const SESSION_DURATION = 1000 * 60 * 60 * 24; // 24 hours

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET env var must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

// ── Core crypto ──────────────────────────────────────────────────────────────

async function encryptSession(session: Session): Promise<string> {
  return await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(session.expiry / 1000)) // jose uses seconds
    .sign(getSecret());
}

async function decryptSession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const session = payload as unknown as Session;

    if (Date.now() > session.expiry) return null;

    return session;
  } catch {
    return null;
  }
}

// ── Public API (mirrors your old SessionStore) ────────────────────────────────

export async function createSession(params: {
  userDN: string;
  userPN: string;
  username: string;
  profileId: string;
  password: string;
}): Promise<void> {
  const { randomBytes } = await import('node:crypto');

  const session: Session = {
    id: randomBytes(32).toString('hex'),
    ...params,
    expiry: Date.now() + SESSION_DURATION,
  };

  const token = await encryptSession(session);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION / 1000, // seconds
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  return decryptSession(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
