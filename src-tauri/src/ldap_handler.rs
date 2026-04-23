use crate::models::{AdObject, LdapConfig, DnsRecord};
use ldap3::{Ldap, LdapConnAsync, LdapError, Scope, SearchEntry, Mod, LdapConnSettings};
use std::collections::HashMap;

pub struct LdapHandler;

impl LdapHandler {
    async fn get_ldap_conn(config: &LdapConfig) -> Result<Ldap, LdapError> {
        let url = format!("{}://{}:{}", config.protocol, config.hostname, config.port);
        let mut settings = LdapConnSettings::new();

        if config.protocol == "ldaps" && config.disable_tls_verification {
            settings = settings.set_no_certificate_verification(true);
        }

        let (conn, ldap) = LdapConnAsync::with_settings(settings, &url).await?;
        ldap3::drive!(conn);
        Ok(ldap)
    }

    pub fn escape_filter(value: &str) -> String {
        value.replace('\\', "\\5c")
             .replace('*', "\\2a")
             .replace('(', "\\28")
             .replace(')', "\\29")
             .replace('\0', "\\00")
    }

    pub async fn bind(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;
        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    fn get_attr(attrs: &HashMap<String, Vec<String>>, name: &str) -> Option<Vec<String>> {
        attrs.iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.clone())
    }

    fn get_attr_single(attrs: &HashMap<String, Vec<String>>, name: &str) -> Option<String> {
        Self::get_attr(attrs, name).and_then(|v| v.get(0).cloned())
    }

    pub async fn search_objects(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        base_dn: &str,
        scope: Scope,
        filter: &str,
    ) -> Result<Vec<AdObject>, String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let (rs, _res) = ldap
            .search(base_dn, scope, filter, vec!["*"])
            .await
            .map_err(|e| e.to_string())?;

        let objects = rs.into_iter().map(|entry| {
            let search_entry = SearchEntry::construct(entry);
            AdObject {
                dn: search_entry.dn.clone(),
                object_class: Self::get_attr(&search_entry.attrs, "objectClass").unwrap_or_default(),
                cn: Self::get_attr_single(&search_entry.attrs, "cn").unwrap_or_default(),
                s_am_account_name: Self::get_attr_single(&search_entry.attrs, "sAMAccountName").unwrap_or_default(),
                mail: Self::get_attr_single(&search_entry.attrs, "mail"),
                display_name: Self::get_attr_single(&search_entry.attrs, "displayName"),
                telephone_number: Self::get_attr_single(&search_entry.attrs, "telephoneNumber"),
                title: Self::get_attr_single(&search_entry.attrs, "title"),
                department: Self::get_attr_single(&search_entry.attrs, "department"),
                user_account_control: Self::get_attr_single(&search_entry.attrs, "userAccountControl").and_then(|v| v.parse().ok()),
                last_logon_timestamp: Self::get_attr_single(&search_entry.attrs, "lastLogonTimestamp"),
                when_created: Self::get_attr_single(&search_entry.attrs, "whenCreated"),
                when_changed: Self::get_attr_single(&search_entry.attrs, "whenChanged"),
                member: Self::get_attr(&search_entry.attrs, "member"),
                member_of: Self::get_attr(&search_entry.attrs, "memberOf"),
                description: Self::get_attr_single(&search_entry.attrs, "description"),
                d_ns_host_name: Self::get_attr_single(&search_entry.attrs, "dNSHostName"),
                operating_system: Self::get_attr_single(&search_entry.attrs, "operatingSystem"),
                operating_system_version: Self::get_attr_single(&search_entry.attrs, "operatingSystemVersion"),
                ou: Self::get_attr_single(&search_entry.attrs, "ou"),
            }
        }).collect();

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(objects)
    }

    pub async fn update_password(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        target_dn: &str,
        new_password: &str,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let quoted_password = format!("\"{}\"", new_password);
        let utf16_password: Vec<u8> = quoted_password
            .encode_utf16()
            .flat_map(|c| c.to_le_bytes())
            .collect();

        ldap.modify(
            target_dn,
            vec![Mod::Replace("unicodePwd".to_string(), vec![utf16_password])],
        )
        .await
        .map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn toggle_status(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        target_dn: &str,
        enabled: bool,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let (rs, _res) = ldap
            .search(target_dn, Scope::Base, "(objectClass=*)", vec!["userAccountControl"])
            .await
            .map_err(|e| e.to_string())?;

        let entry = rs.get(0).ok_or_else(|| "Object not found".to_string())?;
        let search_entry = SearchEntry::construct(entry.clone());
        let uac_str = Self::get_attr_single(&search_entry.attrs, "userAccountControl").ok_or_else(|| "userAccountControl not found".to_string())?;
        let uac: u32 = uac_str.parse().map_err(|e| e.to_string())?;

        const ACCOUNTDISABLE: u32 = 0x0002;
        let new_uac = if enabled {
            uac & !ACCOUNTDISABLE
        } else {
            uac | ACCOUNTDISABLE
        };

        ldap.modify(
            target_dn,
            vec![Mod::Replace("userAccountControl".to_string(), vec![new_uac.to_string()])],
        )
        .await
        .map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn update_object(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        target_dn: &str,
        attributes: &serde_json::Value,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let mut mods = Vec::new();
        if let Some(obj) = attributes.as_object() {
            for (key, value) in obj {
                if key == "dn" || key == "cn" { continue; }

                if value.is_null() || (value.is_string() && value.as_str().unwrap().is_empty()) {
                    mods.push(Mod::Delete(key.clone(), Vec::<String>::new()));
                } else if let Some(s) = value.as_str() {
                    mods.push(Mod::Replace(key.clone(), vec![s.to_string()]));
                }
            }
        }

        if !mods.is_empty() {
            ldap.modify(target_dn, mods).await.map_err(|e| e.to_string())?;
        }

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_object(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        target_dn: &str,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        ldap.delete(target_dn).await.map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn move_object(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        target_dn: &str,
        new_parent_dn: &str,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let rdn = target_dn.split(',').next().ok_or("Invalid DN")?;

        ldap.modify_dn(target_dn, rdn, true, Some(new_parent_dn))
            .await
            .map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn create_object(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        ou_dn: &str,
        object_type: &str,
        attributes: &serde_json::Value,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let cn = attributes.get("cn").and_then(|v| v.as_str())
            .or_else(|| attributes.get("displayName").and_then(|v| v.as_str()))
            .or_else(|| attributes.get("sAMAccountName").and_then(|v| v.as_str()))
            .ok_or("Common Name (cn) or Display Name is required")?;

        let dn = format!("CN={},{}", cn, ou_dn);

        let mut object_classes = vec!["top".to_string()];
        match object_type {
            "user" => {
                object_classes.push("person".to_string());
                object_classes.push("organizationalPerson".to_string());
                object_classes.push("user".to_string());
            },
            "group" => {
                object_classes.push("group".to_string());
            },
            _ => return Err(format!("Unsupported object type: {}", object_type)),
        }

        let mut ldap_attrs = vec![("objectClass".to_string(), object_classes)];
        if let Some(obj) = attributes.as_object() {
            for (key, value) in obj {
                if key == "dn" || key == "cn" || key == "objectClass" { continue; }
                if let Some(s) = value.as_str() {
                    ldap_attrs.push((key.clone(), vec![s.to_string()]));
                }
            }
        }

        ldap.add(&dn, ldap_attrs).await.map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn create_ou(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        parent_dn: Option<&str>,
        ou_name: &str,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let dn = match parent_dn {
            Some(p) => format!("OU={},{}", ou_name, p),
            None => format!("OU={},{}", ou_name, config.base_dn),
        };

        ldap.add(
            &dn,
            vec![
                ("objectClass", vec!["top", "organizationalUnit"]),
                ("ou", vec![ou_name]),
            ],
        )
        .await
        .map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_ou(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        ou_dn: &str,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        ldap.delete(ou_dn).await.map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn toggle_group_member(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        group_dn: &str,
        member_dn: &str,
        action: &str,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let mods = match action {
            "add" => vec![Mod::Add("member".to_string(), vec![member_dn.to_string()])],
            "delete" => vec![Mod::Delete("member".to_string(), vec![member_dn.to_string()])],
            _ => return Err(format!("Unsupported action: {}", action)),
        };

        ldap.modify(group_dn, mods).await.map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_dns_records(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
    ) -> Result<Vec<DnsRecord>, String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let dns_base = format!("CN=MicrosoftDNS,DC=DomainDnsZones,{}", config.base_dn);

        let (zones, _res) = ldap.search(&dns_base, Scope::OneLevel, "(objectClass=dnsZone)", vec!["name"]).await.map_err(|e| e.to_string())?;

        let mut all_records = Vec::new();
        for zone_entry in zones {
            let zone_search = SearchEntry::construct(zone_entry);
            let zone_name = Self::get_attr_single(&zone_search.attrs, "name").unwrap_or_default();

            let (nodes, _res) = ldap.search(&zone_search.dn, Scope::OneLevel, "(objectClass=dnsNode)", vec!["dnsRecord", "name", "whenCreated", "whenChanged"]).await.map_err(|e| e.to_string())?;

            for node_entry in nodes {
                let node_search = SearchEntry::construct(node_entry);
                let node_name = Self::get_attr_single(&node_search.attrs, "name").unwrap_or_default();
                let records_raw = node_search.attrs.get("dnsRecord");

                if let Some(record_list) = records_raw {
                    for buf_vec in record_list {
                        let buf = buf_vec.as_slice();
                        if buf.len() >= 24 {
                            let type_num = u16::from_le_bytes([buf[2], buf[3]]);
                            let ttl = u32::from_le_bytes([buf[12], buf[13], buf[14], buf[15]]);

                            let (dns_type, data) = match type_num {
                                1 if buf.len() >= 28 => ("A".to_string(), format!("{}.{}.{}.{}", buf[24], buf[25], buf[26], buf[27])),
                                28 if buf.len() >= 40 => {
                                    let mut ip = String::new();
                                    for i in 0..8 {
                                        ip.push_str(&format!("{:x}:", u16::from_be_bytes([buf[24+i*2], buf[25+i*2]])));
                                    }
                                    ip.pop();
                                    ("AAAA".to_string(), ip)
                                },
                                5 => ("CNAME".to_string(), "Alias Name".to_string()),
                                15 if buf.len() >= 26 => ("MX".to_string(), "Mail Exchanger".to_string()),
                                16 => ("TXT".to_string(), String::from_utf8_lossy(&buf[25..]).to_string()),
                                _ => ("Other".to_string(), "Binary Data".to_string()),
                            };

                            all_records.push(DnsRecord {
                                id: node_search.dn.clone(),
                                zone: zone_name.clone(),
                                name: node_name.clone(),
                                r#type: dns_type,
                                data,
                                ttl: Some(ttl),
                                priority: if type_num == 15 { Some(u16::from_le_bytes([buf[24], buf[25]])) } else { None },
                                created: Self::get_attr_single(&node_search.attrs, "whenCreated"),
                                modified: Self::get_attr_single(&node_search.attrs, "whenChanged"),
                            });
                        }
                    }
                }
            }
        }

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(all_records)
    }

    pub async fn create_dns_record(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        zone: &str,
        name: &str,
        dns_type: &str,
        data: &str,
        ttl: u32,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        let zone_dn = format!("DC={},CN=MicrosoftDNS,DC=DomainDnsZones,{}", zone, config.base_dn);
        let node_dn = format!("DC={},{}", name, zone_dn);

        // This is a simplified implementation. Real AD DNS records are complex binary blobs.
        // We add a minimal dnsNode for now.
        ldap.add(
            &node_dn,
            vec![
                ("objectClass", vec!["top", "dnsNode"]),
                ("name", vec![name]),
            ],
        )
        .await
        .map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn delete_dns_record(
        config: &LdapConfig,
        user_dn: &str,
        password: &str,
        dn: &str,
    ) -> Result<(), String> {
        let mut ldap = Self::get_ldap_conn(config).await.map_err(|e| e.to_string())?;
        ldap.simple_bind(user_dn, password)
            .await
            .map_err(|e| e.to_string())?;

        ldap.delete(dn).await.map_err(|e| e.to_string())?;

        ldap.unbind().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
