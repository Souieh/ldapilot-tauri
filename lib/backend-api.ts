import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauri-utils';

export async function getSession() {
  if (isTauri()) {
    return await invoke('get_session');
  } else {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return null;
    return await res.json();
  }
}

export async function createDnsRecord(payload: any) {
  if (isTauri()) {
    return await invoke('create_dns_record', { payload });
  } else {
    const res = await fetch('/api/ldap/dns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function updateDnsRecord(payload: any) {
  if (isTauri()) {
    return await invoke('update_dns_record', { payload });
  } else {
    const res = await fetch('/api/ldap/dns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function deleteDnsRecord(id: string) {
  if (isTauri()) {
    return await invoke('delete_dns_record', { id });
  } else {
    const res = await fetch(`/api/ldap/dns/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function getGroupMembers(objectDN: string) {
  if (isTauri()) {
    return await invoke('get_group_members', { objectDn: objectDN });
  } else {
    const res = await fetch('/api/ldap/objects/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectDN }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function logout() {
  if (isTauri()) {
    return await invoke('logout');
  } else {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    return res.ok;
  }
}

export async function login(profileId: string, username: string, password: string) {
  if (isTauri()) {
    return await invoke('login', { profileId, username, password });
  } else {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, username, password }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Login failed');
    }
    return await res.json();
  }
}

export async function getProfiles() {
  if (isTauri()) {
    return await invoke('get_profiles');
  } else {
    const res = await fetch('/api/config/profiles');
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function createProfile(name: string, config: any) {
  if (isTauri()) {
    return await invoke('create_profile', { name, config });
  } else {
    const res = await fetch('/api/config/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function updateProfile(profileId: string, name: string, config: any) {
  if (isTauri()) {
    return await invoke('update_profile', { profileId, name, config });
  } else {
    const res = await fetch(`/api/config/profiles/${profileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function deleteProfile(profileId: string) {
  if (isTauri()) {
    return await invoke('delete_profile', { profileId });
  } else {
    const res = await fetch(`/api/config/profiles/${profileId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function setActiveProfile(profileId: string) {
  if (isTauri()) {
    return await invoke('set_active_profile', { profileId });
  } else {
    const res = await fetch('/api/config/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function testConnection(params: any) {
  if (isTauri()) {
    return await invoke('test_connection', { ...params });
  } else {
    const res = await fetch('/api/ldap/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Connection failed' }));
        throw new Error(errorData.error || 'Connection failed');
    }
    return await res.json();
  }
}

export async function ldapSearch(ouDN: string, objectType: string, query?: string, scope?: string) {
  if (isTauri()) {
    return await invoke('ldap_search', { ouDn: ouDN, objectType, query, scope });
  } else {
    const res = await fetch('/api/ldap/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ouDN, objectType, query, scope }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function ldapUpdate(dn: string, action: string, payload: any) {
  if (isTauri()) {
    return await invoke('ldap_update', { dn, action, payload });
  } else {
    const res = await fetch('/api/ldap/objects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dn, action, payload }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function createObject(ouDN: string, objectType: string, attributes: any) {
  if (isTauri()) {
    return await invoke('create_object', { ouDn: ouDN, objectType, attributes });
  } else {
    const res = await fetch('/api/ldap/objects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ouDN, objectType, attributes }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function deleteObject(dn: string) {
  if (isTauri()) {
    return await invoke('delete_object', { dn });
  } else {
    const res = await fetch('/api/ldap/objects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dn }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function getObjectDetails(dn: string) {
  if (isTauri()) {
    const results: any[] = await invoke('ldap_search', {
      ouDn: dn,
      objectType: 'any',
      scope: 'base',
    });
    return results[0];
  } else {
    const res = await fetch(`/api/ldap/objects/details?dn=${encodeURIComponent(dn)}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function getObjectParents(objectDN: string) {
  if (isTauri()) {
    return await invoke('get_object_parents', { objectDn: objectDN });
  } else {
    const res = await fetch('/api/ldap/objects/parents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectDN }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function getObjectPermissions(objectDN: string) {
  if (isTauri()) {
    return await invoke('get_object_permissions', { objectDn: objectDN });
  } else {
    const res = await fetch(`/api/ldap/objects/permissions?dn=${encodeURIComponent(objectDN)}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function getOUs() {
  if (isTauri()) {
    return await invoke('ldap_search', { ouDn: 'ROOT', objectType: 'ou' });
  } else {
    const res = await fetch('/api/ldap/ous');
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function createOU(ouName: string, parentDN?: string) {
  if (isTauri()) {
    return await invoke('create_ou', { ouName, parentDn: parentDN });
  } else {
    const res = await fetch('/api/ldap/ous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ouName, parentDN }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function deleteOU(ouDN: string) {
  if (isTauri()) {
    return await invoke('delete_ou', { ouDn: ouDN });
  } else {
    const res = await fetch('/api/ldap/ous', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ouDN }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function getDashboardStats() {
  if (isTauri()) {
    return await invoke('get_dashboard_stats');
  } else {
    const res = await fetch('/api/ldap/dashboard');
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function getDnsRecords() {
  if (isTauri()) {
    return await invoke('get_dns_records');
  } else {
    const res = await fetch('/api/ldap/dns');
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}
