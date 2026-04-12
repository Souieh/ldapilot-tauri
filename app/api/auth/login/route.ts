import { configService } from '@/lib/server/config-service';
import { ldapService } from '@/lib/server/ldap/ldap-service';
import { createSession } from '@/lib/server/session-store';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, username, password } = body;

    if (!profileId || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const profiles = await configService.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const authResult = await ldapService.bindWithPassword(profile.config, username, password);

    if (!authResult) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    if (authResult.success === false || !authResult.dn) {
      return NextResponse.json(
        { error: 'Authentication failed: ' + authResult.error },
        { status: 401 }
      );
    }

    await createSession({
      password,
      userDN: authResult.dn || '',
      userPN: authResult.upn || '',
      username,
      profileId,
    });

    // Set active profile
    await configService.setActiveProfile(profileId);

    const response = NextResponse.json({
      success: true,
      user: {
        username,
        dn: authResult.dn,
      },
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
