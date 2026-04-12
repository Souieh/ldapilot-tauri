import { Client } from 'ldapts';
import { LDAPConfig, ADOU } from '@/lib/types/config';
import { getClient, mapToADOU, escapeDNValue } from './ldap-helpers';

export async function searchOUs(config: LDAPConfig, userDN: string, password: string): Promise<ADOU[]> {
  const client = getClient(config);
  try {   
     
    await client.bind(userDN , password);
    const baseDN = config.baseDN || '';
    const { searchEntries } = await client.search(baseDN, {
      filter: '(objectClass=organizationalUnit)',
      scope: 'sub',
      attributes: ['dn', 'objectClass', 'ou', 'cn', 'description', 'whenCreated', 'whenChanged'],
    });

    return searchEntries.map((entry) => mapToADOU(entry));
  } finally {
    await client.unbind();
  }
}

export async function createOU(config: LDAPConfig, userDN: string, password: string, parentDN: string | undefined, ouName: string): Promise<ADOU> {
  const client = getClient(config);
  try {
    await client.bind(userDN, password);

    const baseDN = config.baseDN || userDN.split(',').filter(part => part.toLowerCase().startsWith('dc=')).join(',');
    const safeParentDN = parentDN?.trim() || baseDN;
    if (!safeParentDN) {
      throw new Error('Parent DN is required to create an OU');
    }

    const safeOuName = escapeDNValue(ouName);
    if (!safeOuName) {
      throw new Error('OU name is invalid');
    }

    const newOuDN = `OU=${safeOuName},${safeParentDN}`;
    await client.add(newOuDN, {
      objectClass: ['top', 'organizationalUnit'],
      ou: safeOuName,
    });

    const { searchEntries } = await client.search(newOuDN, {
      scope: 'base',
      filter: '(objectClass=organizationalUnit)',
      attributes: ['dn', 'objectClass', 'ou', 'cn', 'description', 'whenCreated', 'whenChanged'],
    });

    if (searchEntries.length === 0) {
      throw new Error('Created OU could not be retrieved');
    }

    return mapToADOU(searchEntries[0]);
  } finally {
    await client.unbind();
  }
}

export async function deleteOU(config: LDAPConfig,  userDN: string,password: string, ouDN: string): Promise<void> {
  const client = getClient(config);
  try {
    await client.bind(userDN, password);

    const { searchEntries } = await client.search(ouDN, {
      scope: 'one',
      filter: '(objectClass=*)',
      attributes: ['dn'],
    });

    if (searchEntries.length > 0) {
      throw new Error('OU is not empty');
    }

    await client.del(ouDN);
  } finally {
    await client.unbind();
  }
}