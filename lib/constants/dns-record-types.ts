export const DNS_RECORD_TYPES = {
  A: {
    name: 'A',
    description: 'IPv4 Address',
    example: '192.168.1.1',
  },
  AAAA: {
    name: 'AAAA',
    description: 'IPv6 Address',
    example: '2001:db8::1',
  },
  CNAME: {
    name: 'CNAME',
    description: 'Canonical Name (Alias)',
    example: 'example.com',
  },
  MX: {
    name: 'MX',
    description: 'Mail Exchange',
    example: '10 mail.example.com',
  },
  NS: {
    name: 'NS',
    description: 'Nameserver',
    example: 'ns1.example.com',
  },
  TXT: {
    name: 'TXT',
    description: 'Text Record',
    example: 'v=spf1 include:example.com ~all',
  },
  SOA: {
    name: 'SOA',
    description: 'Start of Authority',
    example: 'ns1.example.com hostmaster.example.com',
  },
  SRV: {
    name: 'SRV',
    description: 'Service',
    example: '0 5 389 ldap.example.com',
  },
  PTR: {
    name: 'PTR',
    description: 'Reverse DNS Pointer',
    example: 'host.example.com',
  },
  CAA: {
    name: 'CAA',
    description: 'Certification Authority Authorization',
    example: '0 issue "ca.example.com"',
  },
} as const;

export const DNS_RECORD_TYPE_LIST = Object.keys(DNS_RECORD_TYPES) as Array<keyof typeof DNS_RECORD_TYPES>;

export type DNSRecordType = keyof typeof DNS_RECORD_TYPES;

export interface DNSRecord {
  id: string;
  zone: string;
  name: string;
  type: DNSRecordType;
  data: string;
  ttl?: number;
  priority?: number; // for MX, SRV records
  created?: string;
  modified?: string;
}
