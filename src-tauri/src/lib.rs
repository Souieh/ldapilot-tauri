pub mod models;
pub mod ldap_handler;
pub mod config_handler;

use models::{ConfigProfile, Session, AdUser, LdapConfig};
use ldap_handler::LdapHandler;
use config_handler::{AppState, ConfigHandler};
use tauri::{AppHandle, State};
use std::sync::Mutex;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsRecord {
    pub id: String,
    pub zone: String,
    pub name: String,
    pub r#type: String,
    pub data: String,
    pub ttl: Option<u32>,
    pub priority: Option<u16>,
    pub created: Option<String>,
    pub modified: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub stats: Stats,
    pub profile: LdapConfig,
}

#[derive(Debug, Serialize)]
pub struct Stats {
    pub users: usize,
    pub groups: usize,
    pub computers: usize,
}

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
    base_dn: String,
    username: String,
    password: String,
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
        disable_tls_verification: true,
        ca: None,
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
) -> Result<AdUser, String> {
    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let upn = if username.contains('@') {
        username.clone()
    } else {
        format!("{}@{}", username, profile.config.domain)
    };

    LdapHandler::bind(&profile.config, &upn, &password).await?;

    let users = LdapHandler::search_users(
        &profile.config,
        &upn,
        &password,
        &profile.config.base_dn,
        ldap3::Scope::Subtree,
        &format!("(sAMAccountName={})", username)
    ).await?;

    let user = users.get(0).ok_or_else(|| "User not found after bind".to_string())?.clone();

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
) -> Result<Vec<AdUser>, String> {
    let session_guard = state.session.lock().unwrap();
    let session = session_guard.as_ref().ok_or_else(|| "Unauthorized".to_string())?;

    let profiles = ConfigHandler::get_profiles(&app);
    let profile = profiles.iter().find(|p| p.id == session.profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let filter = match object_type.as_str() {
        "user" => format!("(&(objectClass=user)(objectCategory=person){})", query.as_deref().unwrap_or_default()),
        "group" => format!("(&(objectClass=group){})", query.as_deref().unwrap_or_default()),
        "computer" => format!("(&(objectClass=computer){})", query.as_deref().unwrap_or_default()),
        "ou" => format!("(&(objectClass=organizationalUnit){})", query.as_deref().unwrap_or_default()),
        _ => "(objectClass=*)".to_string(),
    };

    let base_dn = if ou_dn == "ROOT" { &profile.config.base_dn } else { &ou_dn };
    let ldap_scope = match scope.as_deref() {
        Some("base") => ldap3::Scope::Base,
        Some("one") => ldap3::Scope::OneLevel,
        _ => ldap3::Scope::Subtree,
    };

    LdapHandler::search_users(
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

    let users = LdapHandler::search_users(&profile.config, &session.user_dn, &session.password, &profile.config.base_dn, ldap3::Scope::Subtree, "(objectClass=user)").await?.len();
    let groups = LdapHandler::search_users(&profile.config, &session.user_dn, &session.password, &profile.config.base_dn, ldap3::Scope::Subtree, "(objectClass=group)").await?.len();
    let computers = LdapHandler::search_users(&profile.config, &session.user_dn, &session.password, &profile.config.base_dn, ldap3::Scope::Subtree, "(objectClass=computer)").await?.len();

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
) -> Result<Vec<DnsRecord>, String> {
    Ok(Vec::new())
}

#[tauri::command]
async fn create_dns_record(
    payload: serde_json::Value,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn update_dns_record(
    payload: serde_json::Value,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn delete_dns_record(
    id: String,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn get_group_members(
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!([]))
}

#[tauri::command]
async fn get_object_parents(
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!([]))
}

#[tauri::command]
async fn get_object_permissions(
) -> Result<serde_json::Value, String> {
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
