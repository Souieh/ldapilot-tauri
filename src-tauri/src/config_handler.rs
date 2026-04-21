use crate::models::{ConfigProfile, Session};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct AppState {
    pub session: Mutex<Option<Session>>,
}

pub struct ConfigHandler;

impl ConfigHandler {
    pub fn get_config_dir(app: &AppHandle) -> PathBuf {
        let mut path = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("./config"));
        if !path.exists() {
            fs::create_dir_all(&path).ok();
        }
        path
    }

    pub fn get_profiles(app: &AppHandle) -> Vec<ConfigProfile> {
        let path = Self::get_config_dir(app).join("profiles.json");
        if let Ok(content) = fs::read_to_string(path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    pub fn save_profiles(app: &AppHandle, profiles: Vec<ConfigProfile>) -> Result<(), String> {
        let path = Self::get_config_dir(app).join("profiles.json");
        let content = serde_json::to_string_pretty(&profiles).map_err(|e| e.to_string())?;
        fs::write(path, content).map_err(|e| e.to_string())?;
        Ok(())
    }
}
