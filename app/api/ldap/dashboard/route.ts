import { configService } from '@/lib/server/config-service';
import { ldapService } from '@/lib/server/ldap/ldap-service';
import { getSession } from '@/lib/server/session-store';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await configService.getActiveProfile();
  if (!profile) {
    return NextResponse.json({ error: 'No active profile' }, { status: 404 });
  }

  try {
    const stats = await ldapService.getDashboardStats(
      profile.config,
      session.userDN,
      session.password
    );
    return NextResponse.json({
      profile: {
        name: profile.name,
        hostname: profile.config.hostname,
        port: profile.config.port,
        protocol: profile.config.protocol,
        baseDN: profile.config.baseDN,
      },
      stats,
    });
  } catch (error: any) {
    console.error('Dashboard Stats Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
