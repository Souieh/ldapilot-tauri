use crate::models::{AdObject, LdapConfig};
use ldap3::{Ldap, LdapConnAsync, LdapError, Scope, SearchEntry, Mod, Entry, LdapConnSettings};
use std::collections::HashMap;

pub struct LdapHandler;

impl LdapHandler {
    async fn get_ldap_conn(config: &LdapConfig) -> Result<Ldap, LdapError> {
        let url = format!("{}://{}:{}", config.protocol, config.hostname, config.port);
        let mut settings = LdapConnSettings::new();

        // Handling TLS verification
        if config.protocol == "ldaps" && config.disable_tls_verification {
            settings = settings.set_no_certificate_verification(true);
        }

        let (conn, ldap) = LdapConnAsync::with_settings(settings, &url).await?;
        ldap3::drive!(conn);
        Ok(ldap)
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
}
