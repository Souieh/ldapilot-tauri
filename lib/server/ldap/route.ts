import { NextRequest, NextResponse } from 'next/server';
import { ldapService } from '@/lib/server/ldap/ldap-service';
import { sessionStore } from '@/lib/server/session-store';
import { configService } from '@/lib/server/config-service';

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session_id')?.value;
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await sessionStore.getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const profile = await configService.getActiveProfile();
  if (!profile) {
    return NextResponse.json({ error: 'No active profile' }, { status: 404 });
  }

  try {
    const stats = await ldapService.getDashboardStats(profile.config, session.password);
    return NextResponse.json({
      profile: {
        name: profile.name,
        hostname: profile.config.hostname,
        port: profile.config.port,
        protocol: profile.config.protocol,
        baseDN: profile.config.baseDN
      },
      stats
    });
  } catch (error: any) {
    console.error('Dashboard Stats Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}