export const LDAP_ATTRIBUTES = {
  user: {
    objectClass: 'user',
    attributes: [
      'cn', // Common Name
      'sAMAccountName', // Account Name
      'mail', // Email
      'telephoneNumber', // Phone
      'title', // Title
      'department', // Department
      'userAccountControl', // Account Control (enabled/disabled)
      'lastLogonTimestamp', // Last Logon
      'whenCreated', // Created
      'whenChanged', // Modified
      'displayName', // Display Name
    ],
    editable: [
      'displayName',
      'mail',
      'telephoneNumber',
      'title',
      'department',
    ],
  },
  computer: {
    objectClass: 'computer',
    attributes: [
      'cn',
      'sAMAccountName',
      'dNSHostName',
      'operatingSystem',
      'operatingSystemVersion',
      'userAccountControl',
      'whenCreated',
      'whenChanged',
      'lastLogonTimestamp',
    ],
    editable: [
      'dNSHostName',
      'description',
    ],
  },
  group: {
    objectClass: 'group',
    attributes: [
      'cn',
      'sAMAccountName',
      'mail',
      'description',
      'member',
      'memberOf',
      'whenCreated',
      'whenChanged',
    ],
    editable: [
      'description',
      'mail',
    ],
  },
  ou: {
    objectClass: 'organizationalUnit',
    attributes: [
      'ou',
      'cn',
      'description',
      'whenCreated',
      'whenChanged',
    ],
  },
};

export const ACCOUNT_CONTROL_FLAGS = {
  SCRIPT: 0x0001,
  ACCOUNTDISABLE: 0x0002,
  HOMEDIR_REQUIRED: 0x0008,
  LOCKOUT: 0x0010,
  PASSWD_NOTREQD: 0x0020,
  PASSWD_CANT_CHANGE: 0x0040,
  ENCRYPTED_TEXT_PWD_ALLOWED: 0x0080,
  TEMP_DUPLICATE_ACCOUNT: 0x0100,
  NORMAL_ACCOUNT: 0x0200,
  INTERDOMAIN_TRUST_ACCOUNT: 0x0800,
  WORKSTATION_TRUST_ACCOUNT: 0x1000,
  SERVER_TRUST_ACCOUNT: 0x2000,
  DONT_EXPIRE_PASSWD: 0x10000,
  SMARTCARD_REQUIRED: 0x40000,
  TRUSTED_FOR_DELEGATION: 0x80000,
  NOT_DELEGATED: 0x100000,
  USE_DES_KEY_ONLY: 0x200000,
  DONT_REQ_PREAUTH: 0x400000,
  PASSWORD_EXPIRED: 0x800000,
  TRUSTED_TO_AUTH_FOR_DELEGATION: 0x1000000,
} as const;

export function isAccountEnabled(userAccountControl: number): boolean {
  return (userAccountControl & ACCOUNT_CONTROL_FLAGS.ACCOUNTDISABLE) === 0;
}

export function getAccountStatus(userAccountControl: number): string {
  return isAccountEnabled(userAccountControl) ? 'Enabled' : 'Disabled';
}
