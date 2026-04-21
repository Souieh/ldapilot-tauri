pub mod models;
pub mod ldap_handler;
pub mod config_handler;

use models::{ConfigProfile, Session, AdObject, LdapConfig, DnsRecord, DashboardStats, Stats};
use ldap_handler::LdapHandler;
use config_handler::{AppState, ConfigHandler};
use tauri::{AppHandle, State};
use std::sync::Mutex;

#[tauri::command]
async fn create_profile(
    app: AppHandle,
    name: String,
    config: serde_json::Value,
) -> Result<ConfigProfile, String> {
    let mut profiles = ConfigHandler::get_profiles(&app);
    let id = format!("profile_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let now = chrono::Utc::now().to_rfc3339();

    let mut ldap_config: models::LdapConfig = serde_json::from_value(config).map_err(|e| e.to_string())?;
    ldap_config.id = id.clone();
    ldap_config.created = now.clone();
    ldap_config.modified = now;

    let new_profile = ConfigProfile {
        id,
        name,
        is_active: profiles.is_empty(),
        config: ldap_config,
    };

    profiles.push(new_profile.clone());
    ConfigHandler::save_profiles(&app, profiles)?;
    Ok(new_profile)
}

#[tauri::command]
async fn update_profile(
    app: AppHandle,
    profile_id: String,
    name: String,
    config: serde_json::Value,
) -> Result<ConfigProfile, String> {
    let mut profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter_mut().find(|p| p.id == profile_id).ok_or("Profile not found")?;

    profile.name = name;
    let mut ldap_config: models::LdapConfig = serde_json::from_value(config).map_err(|e| e.to_string())?;
    ldap_config.id = profile_id;
    ldap_config.modified = chrono::Utc::now().to_rfc3339();
    profile.config = ldap_config;

    let updated = profile.clone();
    ConfigHandler::save_profiles(&app, profiles)?;
    Ok(updated)
}

#[tauri::command]
async fn delete_profile(
    app: AppHandle,
    profile_id: String,
) -> Result<(), String> {
    let mut profiles = ConfigHandler::get_profiles(&app);
    profiles.retain(|p| p.id != profile_id);
    ConfigHandler::save_profiles(&app, profiles)
}

#[tauri::command]
async fn set_active_profile(
    app: AppHandle,
    profile_id: String,
) -> Result<(), String> {
    let mut profiles = ConfigHandler::get_profiles(&app);
    for p in &mut profiles {
        p.is_active = p.id == profile_id;
    }
    ConfigHandler::save_profiles(&app, profiles)
}

#[tauri::command]
async fn test_connection(
    hostname: String,
    port: u16,
    protocol: String,
    domain: String,
    #[serde(rename = "baseDN")]
    base_dn: String,
    username: String,
    password: String,
    #[serde(rename = "disableTlsVerification")]
    disable_tls_verification: bool,
    #[serde(rename = "caCert")]
    ca_cert: Option<String>,
) -> Result<(), String> {
    let config = models::LdapConfig {
        id: "test".to_string(),
        name: "test".to_string(),
        hostname,
        port,
        protocol,
        domain: domain.clone(),
        base_dn,
        created: "".to_string(),
        modified: "".to_string(),
        disable_tls_verification,
        ca: ca_cert,
    };

    let upn = if username.contains('@') {
        username
    } else {
        format!("{}@{}", username, domain)
    };

    LdapHandler::bind(&config, &upn, &password).await
}

#[tauri::command]
async fn get_session(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let session_guard = state.session.lock().unwrap();
    if let Some(session) = session_guard.as_ref() {
        let profiles = ConfigHandler::get_profiles(&app);
        let profile = profiles.iter().find(|p| p.id == session.profile_id);

        Ok(serde_json::json!({
            "authenticated": true,
            "user": { "username": session.username },
            "profile": profile.map(|p| serde_json::json!({ "name": p.name }))
        }))
    } else {
        Ok(serde_json::json!({ "authenticated": false }))
    }
}

#[tauri::command]
async fn logout(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut session_guard = state.session.lock().unwrap();
    *session_guard = None;
    Ok(())
}

#[tauri::command]
async fn login(
    app: AppHandle,
    state: State<'_, AppState>,
    profile_id: String,
    username: String,
    password: String,
) -> Result<AdObject, String> {
    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let upn = if username.contains('@') {
        username.clone()
    } else {
        format!("{}@{}", username, profile.config.domain)
    };

    LdapHandler::bind(&profile.config, &upn, &password).await?;

    let objects = LdapHandler::search_objects(
        &profile.config,
        &upn,
        &password,
        &profile.config.base_dn,
        ldap3::Scope::Subtree,
        &format!("(sAMAccountName={})", username)
    ).await?;

    let user = objects.get(0).ok_or_else(|| "User not found after bind".to_string())?.clone();

    let mut session_guard = state.session.lock().unwrap();
    *session_guard = Some(Session {
        user_dn: user.dn.clone(),
        user_pn: upn,
        username: username.clone(),
        profile_id,
        password,
    });

    Ok(user)
}

#[tauri::command]
fn get_profiles(app: AppHandle) -> Vec<ConfigProfile> {
    ConfigHandler::get_profiles(&app)
}

#[tauri::command]
async fn ldap_search(
    app: AppHandle,
    state: State<'_, AppState>,
    ou_dn: String,
    object_type: String,
    query: Option<String>,
    scope: Option<String>,
) -> Result<Vec<AdObject>, String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let filter = match (object_type.as_str(), query.as_deref()) {
        ("user", Some(q)) if !q.is_empty() => format!("(&(objectClass=user)(objectCategory=person)(|(cn=*{0}*)(sAMAccountName=*{0}*)(mail=*{0}*)(displayName=*{0}*)))", q),
        ("user", _) => "(&(objectClass=user)(objectCategory=person))".to_string(),
        ("group", Some(q)) if !q.is_empty() => format!("(&(objectClass=group)(|(cn=*{0}*)(sAMAccountName=*{0}*)))", q),
        ("group", _) => "(objectClass=group)".to_string(),
        ("computer", Some(q)) if !q.is_empty() => format!("(&(objectClass=computer)(|(cn=*{0}*)(sAMAccountName=*{0}*)))", q),
        ("computer", _) => "(objectClass=computer)".to_string(),
        ("ou", Some(q)) if !q.is_empty() => format!("(&(objectClass=organizationalUnit)(|(ou=*{0}*)(name=*{0}*)))", q),
        ("ou", _) => "(objectClass=organizationalUnit)".to_string(),
        (_, Some(q)) if !q.is_empty() => format!("(|(cn=*{0}*)(sAMAccountName=*{0}*)(ou=*{0}*))", q),
        _ => "(objectClass=*)".to_string(),
    };

    let base_dn = if ou_dn == "ROOT" { &profile.config.base_dn } else { &ou_dn };
    let ldap_scope = match scope.as_deref() {
        Some("base") => ldap3::Scope::Base,
        Some("one") => ldap3::Scope::OneLevel,
        _ => ldap3::Scope::Subtree,
    };

    LdapHandler::search_objects(
        &profile.config,
        &session.user_dn,
        &session.password,
        base_dn,
        ldap_scope,
        &filter
    ).await
}

#[tauri::command]
async fn ldap_update(
    app: AppHandle,
    state: State<'_, AppState>,
    dn: String,
    action: String,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    match action.as_str() {
        "password" => {
            let new_password = payload.get("newPassword").and_then(|v| v.as_str()).ok_or("Missing newPassword")?;
            LdapHandler::update_password(&profile.config, &session.user_dn, &session.password, &dn, new_password).await?;
            Ok(serde_json::json!({ "success": true }))
        },
        "toggle-status" => {
            let enabled = payload.get("enabled").and_then(|v| v.as_bool()).ok_or("Missing enabled")?;
            LdapHandler::toggle_status(&profile.config, &session.user_dn, &session.password, &dn, enabled).await?;
            Ok(serde_json::json!({ "success": true }))
        },
        "update" => {
            let attributes = payload.get("attributes").ok_or("Missing attributes")?;
            LdapHandler::update_object(&profile.config, &session.user_dn, &session.password, &dn, attributes).await?;
            Ok(serde_json::json!({ "success": true }))
        },
        "move" => {
            let new_ou = payload.get("newOU").and_then(|v| v.as_str()).ok_or("Missing newOU")?;
            LdapHandler::move_object(&profile.config, &session.user_dn, &session.password, &dn, new_ou).await?;
            let rdn = dn.split(',').next().ok_or("Invalid DN")?;
            let new_dn = format!("{},{}", rdn, new_ou);
            Ok(serde_json::json!({ "newDN": new_dn }))
        },
        "toggle-member" => {
            let member_dn = payload.get("memberDN").and_then(|v| v.as_str()).ok_or("Missing memberDN")?;
            let action_type = payload.get("type").and_then(|v| v.as_str()).ok_or("Missing type")?;
            LdapHandler::toggle_group_member(&profile.config, &session.user_dn, &session.password, &dn, member_dn, action_type).await?;
            Ok(serde_json::json!({ "success": true }))
        },
        _ => Err(format!("Unsupported action: {}", action)),
    }
}

#[tauri::command]
async fn create_object(
    app: AppHandle,
    state: State<'_, AppState>,
    ou_dn: String,
    object_type: String,
    attributes: serde_json::Value,
) -> Result<(), String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    LdapHandler::create_object(&profile.config, &session.user_dn, &session.password, &ou_dn, &object_type, &attributes).await
}

#[tauri::command]
async fn delete_object(
    app: AppHandle,
    state: State<'_, AppState>,
    dn: String,
) -> Result<(), String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    LdapHandler::delete_object(&profile.config, &session.user_dn, &session.password, &dn).await
}

#[tauri::command]
async fn create_ou(
    app: AppHandle,
    state: State<'_, AppState>,
    parent_dn: Option<String>,
    ou_name: String,
) -> Result<(), String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    LdapHandler::create_ou(&profile.config, &session.user_dn, &session.password, parent_dn.as_deref(), &ou_name).await
}

#[tauri::command]
async fn delete_ou(
    app: AppHandle,
    state: State<'_, AppState>,
    ou_dn: String,
) -> Result<(), String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    LdapHandler::delete_ou(&profile.config, &session.user_dn, &session.password, &ou_dn).await
}

#[tauri::command]
async fn get_dashboard_stats(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DashboardStats, String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let users = LdapHandler::search_objects(&profile.config, &session.user_dn, &session.password, &profile.config.base_dn, ldap3::Scope::Subtree, "(objectClass=user)").await?.len();
    let groups = LdapHandler::search_objects(&profile.config, &session.user_dn, &session.password, &profile.config.base_dn, ldap3::Scope::Subtree, "(objectClass=group)").await?.len();
    let computers = LdapHandler::search_objects(&profile.config, &session.user_dn, &session.password, &profile.config.base_dn, ldap3::Scope::Subtree, "(objectClass=computer)").await?.len();

    Ok(DashboardStats {
        stats: Stats {
            users,
            groups,
            computers,
        },
        profile: profile.config.clone(),
    })
}

#[tauri::command]
async fn get_dns_records(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<DnsRecord>, String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    Ok(Vec::new())
}

#[tauri::command]
async fn create_dns_record(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: serde_json::Value,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn update_dns_record(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: serde_json::Value,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn delete_dns_record(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn get_group_members(
    app: AppHandle,
    state: State<'_, AppState>,
    object_dn: String,
) -> Result<serde_json::Value, String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let objects = LdapHandler::search_objects(&profile.config, &session.user_dn, &session.password, &object_dn, ldap3::Scope::Base, "(objectClass=group)").await?;
    let group = objects.get(0).ok_or("Group not found")?;

    let mut members = Vec::new();
    if let Some(dns) = &group.member {
        if !dns.is_empty() {
            let filter = format!("(|{})", dns.iter().map(|dn| format!("(distinguishedName={})", dn)).collect::<Vec<_>>().join(""));
            members = LdapHandler::search_objects(&profile.config, &session.user_dn, &session.password, &profile.config.base_dn, ldap3::Scope::Subtree, &filter).await?;
        }
    }

    Ok(serde_json::json!(members))
}

#[tauri::command]
async fn get_object_parents(
    app: AppHandle,
    state: State<'_, AppState>,
    object_dn: String,
) -> Result<serde_json::Value, String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let objects = LdapHandler::search_objects(&profile.config, &session.user_dn, &session.password, &object_dn, ldap3::Scope::Base, "(objectClass=*)").await?;
    let obj = objects.get(0).ok_or("Object not found")?;

    let mut parents = Vec::new();
    if let Some(dns) = &obj.member_of {
        if !dns.is_empty() {
            let filter = format!("(|{})", dns.iter().map(|dn| format!("(distinguishedName={})", dn)).collect::<Vec<_>>().join(""));
            parents = LdapHandler::search_objects(&profile.config, &session.user_dn, &session.password, &profile.config.base_dn, ldap3::Scope::Subtree, &filter).await?;
        }
    }

    Ok(serde_json::json!(parents))
}

#[tauri::command]
async fn get_object_permissions(
    app: AppHandle,
    state: State<'_, AppState>,
    object_dn: String,
) -> Result<serde_json::Value, String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    Ok(serde_json::json!([]))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .manage(AppState { session: Mutex::new(None) })
    .invoke_handler(tauri::generate_handler![
        get_session,
        logout,
        login,
        get_profiles,
        create_profile,
        update_profile,
        delete_profile,
        set_active_profile,
        test_connection,
        ldap_search,
        ldap_update,
        get_dns_records,
        create_dns_record,
        update_dns_record,
        delete_dns_record,
        create_ou,
        delete_ou,
        create_object,
        delete_object,
        get_dashboard_stats,
        get_group_members,
        get_object_parents,
        get_object_permissions
    ])
    .setup(|app| {
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
