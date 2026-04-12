import { Client, Change, Attribute } from 'ldapts';
import { LDAPConfig, DNSRecord, DNSRecordType } from '@/lib/types/config';
import { getClient } from './ldap-helpers';

/**
 * AD DNS Record types mapping
 */
const DNS_TYPE_MAP: Record<number, DNSRecordType> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
};

const DNS_TYPE_VALUE: Record<string, number> = Object.entries(DNS_TYPE_MAP).reduce(
  (acc, [k, v]) => ({ ...acc, [v]: parseInt(k) }),
  {}
);

export async function getDnsRecords(config: LDAPConfig, userDN: string, password: string): Promise<DNSRecord[]> {
  const client = getClient(config);
  try {
    await client.bind(userDN, password);
    
    // AD DNS is usually in the DomainDnsZones partition
    const dnsBase = `CN=MicrosoftDNS,DC=DomainDnsZones,${config.baseDN}`;
    
    // 1. Find all Zones
    const { searchEntries: zones } = await client.search(dnsBase, {
      filter: '(objectClass=dnsZone)',
      scope: 'one',
      attributes: ['name'],
    });

    const allRecords: DNSRecord[] = [];
 
    
    // 2. For each zone, find dnsNodes
    for (const zone of zones) {
      const zoneName = zone.name as string;
      const { searchEntries: nodes } = await client.search(zone.dn, {
        filter: '(objectClass=dnsNode)',
        scope: 'one',
        attributes: ['dnsRecord', 'name', 'whenCreated', 'whenChanged'],
      });

      for (const node of nodes) {
        const records = node.dnsRecord;
        if (!records) continue;

        const recordList = Array.isArray(records) ? records : [records];
        
        for (const buf of recordList) {
          if (!Buffer.isBuffer(buf)) continue;
          
          const parsed = parseDnsRecord(buf);
          if (parsed) {
            allRecords.push({
              id: node.dn,
              zone: zoneName,
              name: node.name as string,
              type: parsed.type,
              data: parsed.data,
              ttl: parsed.ttl,
              priority: parsed.priority,
              created: node.whenCreated as string,
              modified: node.whenChanged as string,
            });
          }
        }
      }
    }

    return allRecords;
  } catch (error) {
    console.error('LDAP DNS Search Error:', error);
    return [];
  } finally {
    await client.unbind();
  }
}

export async function createDnsRecord(config: LDAPConfig, record: Partial<DNSRecord>, userDN: string, password: string) {
  const client = getClient(config);
  try {
    await client.bind(userDN, password);
    
    const zoneDN = `DC=${record.zone},CN=MicrosoftDNS,DC=DomainDnsZones,${config.baseDN}`;
    const nodeDN = `DC=${record.name},${zoneDN}`;
    
    const dnsRecordBinary = encodeDnsRecord(record as DNSRecord);
    
    try {
      // Try to add to existing node first
      await client.modify(nodeDN, [
        new Change({
          operation: 'add',
          modification: new Attribute({ type: 'dnsRecord', values: [dnsRecordBinary] })
        })
      ]);
    } catch (e: any) {
      // If node doesn't exist, create it
      if (e.name === 'NoSuchObjectError') {
        await client.add(nodeDN, {
          objectClass: ['top', 'dnsNode'],
          dnsRecord: [dnsRecordBinary.toString('base64')]
        });
      } else {
        throw e;
      }
    }
    return { success: true };
  } finally {
    await client.unbind();
  }
}

export async function deleteDnsRecord(config: LDAPConfig, dn: string, userDN: string, password: string): Promise<void> {
  const client = getClient(config);
  try {
    await client.bind(userDN, password);
    // In AD LDAP, we typically delete the dnsNode if it's the last record, 
    // or modify the dnsRecord attribute if multiple exist.
    // For simplicity in this implementation, we delete the node.
    await client.del(dn);
  } finally {
    await client.unbind();
  }
}

/**
 * Minimal AD dnsRecord binary parser
 */
function parseDnsRecord(buf: Buffer) {
  if (buf.length < 24) return null;

  const typeNum = buf.readUInt16LE(2);
  const type = DNS_TYPE_MAP[typeNum];
  const ttl = buf.readUInt32LE(12);
  
  let data = '';
  let priority: number | undefined;

  try {
    if (type === 'A' && buf.length >= 28) {
      data = `${buf[24]}.${buf[25]}.${buf[26]}.${buf[27]}`;
    } else if (type === 'AAAA' && buf.length >= 40) {
      data = buf.slice(24, 40).toString('hex').match(/.{1,4}/g)?.join(':') || '';
    } else if ((type === 'CNAME' || type === 'NS' || type === 'PTR') && buf.length > 24) {
      data = parseDnsName(buf.slice(24));
    } else if (type === 'MX' && buf.length > 26) {
      priority = buf.readUInt16LE(24);
      data = parseDnsName(buf.slice(26));
    } else if (type === 'TXT') {
      data = buf.slice(25, 25 + buf[24]).toString('utf8');
    }
  } catch {
    data = 'Binary Data';
  }

  return type ? { type, data, ttl, priority } : null;
}

function parseDnsName(buf: Buffer): string {
  let offset = 0;
  const parts = [];
  while (offset < buf.length && buf[offset] !== 0) {
    const len = buf[offset];
    parts.push(buf.slice(offset + 1, offset + 1 + len).toString());
    offset += len + 1;
  }
  return parts.join('.');
}

/**
 * Minimal AD dnsRecord binary encoder
 */
function encodeDnsRecord(record: DNSRecord): Buffer {
  const header = Buffer.alloc(24);
  header.writeUInt16LE(DNS_TYPE_VALUE[record.type] || 1, 2);
  header.writeUInt32LE(record.ttl || 3600, 12);
  header.writeUInt16LE(5, 0); // Data length placeholder

  let dataBuf: Buffer;
  if (record.type === 'A') {
    dataBuf = Buffer.from(record.data.split('.').map(Number));
  } else if (record.type === 'MX') {
    const prio = Buffer.alloc(2);
    prio.writeUInt16LE(record.priority || 10, 0);
    dataBuf = Buffer.concat([prio, encodeDnsName(record.data)]);
  } else if (record.type === 'TXT') {
    dataBuf = Buffer.concat([Buffer.from([record.data.length]), Buffer.from(record.data)]);
  } else {
    dataBuf = encodeDnsName(record.data);
  }

  header.writeUInt16LE(dataBuf.length, 0);
  return Buffer.concat([header, dataBuf]);
}

function encodeDnsName(name: string): Buffer {
  const parts = name.split('.');
  const bufs = parts.map(p => Buffer.concat([Buffer.from([p.length]), Buffer.from(p)]));
  return Buffer.concat([...bufs, Buffer.from([0])]);
}

export async function updateDnsRecord(config: LDAPConfig, dn: string, record: Partial<DNSRecord>, userDN: string, password: string) {
  // Simplified: Delete and re-create to handle binary blob updates correctly
  await deleteDnsRecord(config, dn, userDN, password);
  return createDnsRecord(config, record, userDN, password);
}