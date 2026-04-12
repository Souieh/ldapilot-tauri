import { NextRequest, NextResponse } from 'next/server';
import { ldapService } from '@/lib/server/ldap/ldap-service';
import { LDAPConfig } from '@/lib/types/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostname, port, protocol, baseDN, domain, username,  password } = body;

    if (!hostname || !port || !baseDN || !domain || !username ||!password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const config: LDAPConfig = {
      id: 'test',
      name: 'test',
      hostname,
      port: parseInt(port),
      protocol: protocol || 'ldap',
      baseDN,
      domain,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };
    const upn = username.includes('@') ? username : `${username}@${domain}`;

    const success = await ldapService.bindWithPassword(config,upn,  password);
    await ldapService.disconnect();

    if (!success) {
      return NextResponse.json(
        { error: 'Connection failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Connected successfully' });
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection test failed' },
      { status: 500 }
    );
  }
}
