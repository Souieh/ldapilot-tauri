import { ADComputer, ADGroup, ADUser, LDAPConfig } from '@/lib/types/config';
import { getClient, mapToADComputer, mapToADGroup, mapToADUser } from './ldap-helpers';

export async function searchUsers(
  config: LDAPConfig,
  userDN: string,
  password: string,
  ouDN: string,
  scope: 'base' | 'one' | 'sub' = 'one'
): Promise<ADUser[]> {
  const client = getClient(config);
  try {
    await client.bind(userDN, password);
    const { searchEntries } = await client.search(ouDN, {
      filter: '(&(objectClass=person)(objectClass=user))',
      scope,
      attributes: [
        'dn',
        'objectClass',
        'cn',
        'sAMAccountName',
        'mail',
        'displayName',
        'telephoneNumber',
        'title',
        'department',
        'userAccountControl',
        'lastLogonTimestamp',
        'whenCreated',
        'whenChanged',
      ],
    });

    return searchEntries.map((entry) => mapToADUser(entry));
  } finally {
    await client.unbind();
  }
}

export async function searchComputers(
  config: LDAPConfig,
  userDN: string,
  password: string,
  ouDN: string,
  scope: 'base' | 'one' | 'sub' = 'one'
): Promise<ADComputer[]> {
  const client = getClient(config);
  try {
    await client.bind(userDN, password);
    const { searchEntries } = await client.search(ouDN, {
      filter: '(objectClass=computer)',
      scope,
      attributes: [
        'dn',
        'objectClass',
        'cn',
        'sAMAccountName',
        'dNSHostName',
        'operatingSystem',
        'operatingSystemVersion',
        'userAccountControl',
        'whenCreated',
        'whenChanged',
      ],
    });

    return searchEntries.map((entry) => mapToADComputer(entry));
  } finally {
    await client.unbind();
  }
}

export async function searchGroups(
  config: LDAPConfig,
  userDN: string,
  password: string,
  ouDN: string,
  scope: 'base' | 'one' | 'sub' = 'one'
): Promise<ADGroup[]> {
  const client = getClient(config);
  try {
    await client.bind(userDN, password);
    const { searchEntries } = await client.search(ouDN, {
      filter: '(objectClass=group)',
      scope,
      attributes: [
        'dn',
        'objectClass',
        'cn',
        'sAMAccountName',
        'mail',
        'description',
        'member',
        'memberOf',
        'whenCreated',
        'whenChanged',
      ],
    });

    return searchEntries.map((entry) => mapToADGroup(entry));
  } finally {
    await client.unbind();
  }
}
