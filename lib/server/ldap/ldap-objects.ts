import { Client, Change, Attribute } from 'ldapts';
import { LDAPConfig } from '@/lib/types/config';
import { configService } from '../config-service';
import { getClient, escapeDNValue } from './ldap-helpers'; 

const WRITABLE_AD_ATTRIBUTES = new Set([
  // Identity
  'cn',
  'displayName',
  'givenName',
  'sn',
  'initials',
  'description',

  // Account
  'sAMAccountName',
  'userPrincipalName',
  'userAccountControl',
  'mail',
  'unicodePwd',

  // Contact
  'telephoneNumber',
  'mobile',
  'facsimileTelephoneNumber',
  'street',
  'l',              // city
  'st',             // state
  'postalCode',
  'co',             // country display name
  'c',              // country code

  // Org
  'title',
  'department',
  'company',
  'manager',
  'employeeID',
  'employeeNumber',

  // Group-specific
  'groupType',
  'member',

  // Computer-specific
  'dNSHostName',
  'operatingSystem',
  'operatingSystemVersion',
]);

export async function createObject(ouDN: string, objectType: string, attributes: any,userDN:string, password: string) {
  const profile = await configService.getActiveProfile();
  if (!profile) throw new Error('No active LDAP profile found');

  const client = getClient(profile.config);
  try {
    await client.bind(userDN, password);

    const cn = attributes.cn || attributes.displayName || attributes.sAMAccountName;
    if (!cn) throw new Error('Common Name (cn) or Display Name is required');

    const dn = `CN=${escapeDNValue(cn)},${ouDN}`;

    const objectClass = objectType === 'user'
      ? ['top', 'person', 'organizationalPerson', 'user']
      : ['top', 'group'];

    const ldapAttributes: any = { objectClass };
    Object.entries(attributes).forEach(([key, value]) => {
      if (key !== 'dn' && value !== undefined && value !== null && String(value).trim() !== '') {
        ldapAttributes[key] = String(value).trim();
      }
    });

    await client.add(dn, ldapAttributes);
  } finally {
    await client.unbind();
  }
}

export async function moveObject(dn: string, newOU: string, userDN:string,password: string) {
  const profile = await configService.getActiveProfile();
  if (!profile) throw new Error('No active LDAP profile found');

  const client = getClient(profile.config);
  try {
    await client.bind(userDN, password);

    const rdn = dn.match(/(?:\\.|[^,])+/)?.[0] || dn.split(',')[0];
    const targetDN = `${rdn},${newOU}`;
    await client.modifyDN(dn, targetDN);
  } finally {
    await client.unbind();
  }
}

export async function updateObject(dn: string, attributes: any, userDN:string,password: string) {
  const profile = await configService.getActiveProfile();
  if (!profile) throw new Error('No active LDAP profile found');

  const client = getClient(profile.config);
  try {
    await client.bind(userDN, password);

    // CN requires modifyDN (rename), not a regular modify
    if (attributes.cn) {
      const newRDN = `CN=${escapeDNValue(attributes.cn)}`;
      const currentRDN = dn.split(',')[0];
      if (newRDN.toLowerCase() !== currentRDN.toLowerCase()) {
        const targetDN = `${newRDN},${dn.split(',').slice(1).join(',')}`;
        await client.modifyDN(dn, targetDN);
        dn = targetDN;
      }
    }

    // Strip cn out — already handled above via modifyDN
    const { cn, ...rest } = attributes;
    const changes: any[] = [];

    Object.entries(rest).forEach(([key, value]) => {
      if (key === 'dn') return;
      if (!WRITABLE_AD_ATTRIBUTES.has(key)) return;
      const isDelete = value === null || value === undefined || value === '';
      changes.push(
        new Change({
    operation: 'replace',
          modification: new Attribute({
            type: key,
      values: isDelete ? [] : [String(value)],
          }),
        })
      );
    });

    if (changes.length > 0) {
      await client.modify(dn, changes);
    }
  } finally {
    await client.unbind();
  }
}

export async function toggleGroupMember(groupDN: string, memberDN: string, action: 'add' | 'delete',userDN:string, password: string) {
  const profile = await configService.getActiveProfile();
  if (!profile) throw new Error('No active LDAP profile found');

  const client = getClient(profile.config);
  try {
    await client.bind(userDN, password);
    await client.modify(groupDN, [
      new Change({
        operation: action,
        modification: new Attribute({
          type: 'member',
          values: [memberDN],
        }),
      }),
    ]);
  } finally {
    await client.unbind();
  }
}

export async function deleteObject(dn: string,userDN:string, password: string) {
  const profile = await configService.getActiveProfile();
  if (!profile) throw new Error('No active LDAP profile found');

  const client = getClient(profile.config);
  try {
    await client.bind(userDN, password);
    await client.del(dn);
  } finally {
    await client.unbind();
  }
}



export async function updatePassword(dn: string, newPassword: string, userDN:string,password: string) {
  const profile = await configService.getActiveProfile();
  if (!profile) throw new Error('No active LDAP profile found');

  const client = getClient(profile.config);
  try {
    await client.bind(userDN, password);

    // 1. Format the password: quotes + UTF-16LE
    const quotedPassword = `"${newPassword}"`;
    const passwordBuffer = Buffer.from(quotedPassword, 'utf16le');

    // 2. Create the specific Change object
    const change = new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'unicodePwd',
        values: [passwordBuffer as any], // ldapts handles the buffer as the raw value
      }),
    });

    await client.modify(dn, [change]);

  } finally {
    await client.unbind();
  }
}