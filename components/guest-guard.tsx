import { getSession } from '@/lib/server/session-store';
import { redirect } from 'next/navigation';

/**
 * Prevents authenticated users from accessing login/setup pages
 */
export async function GuestGuard({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!!session) redirect('/dashboard');
  return <>{children}</>;
}
