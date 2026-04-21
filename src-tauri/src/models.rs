use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LdapConfig {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub port: u16,
    pub protocol: String,
    pub domain: String,
    pub base_dn: String,
    pub created: String,
    pub modified: String,
    pub disable_tls_verification: bool,
    pub ca: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConfigProfile {
    pub id: String,
    pub name: String,
    pub is_active: bool,
    pub config: LdapConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdUser {
    pub dn: String,
    pub object_class: Vec<String>,
    pub cn: String,
    pub s_am_account_name: String,
    pub mail: Option<String>,
    pub display_name: Option<String>,
    pub telephone_number: Option<String>,
    pub title: Option<String>,
    pub department: Option<String>,
    pub user_account_control: Option<u32>,
    pub last_logon_timestamp: Option<String>,
    pub when_created: Option<String>,
    pub when_changed: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdComputer {
    pub dn: String,
    pub object_class: Vec<String>,
    pub cn: String,
    pub s_am_account_name: String,
    pub d_ns_host_name: Option<String>,
    pub operating_system: Option<String>,
    pub operating_system_version: Option<String>,
    pub user_account_control: Option<u32>,
    pub when_created: Option<String>,
    pub when_changed: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdGroup {
    pub dn: String,
    pub object_class: Vec<String>,
    pub cn: String,
    pub s_am_account_name: String,
    pub mail: Option<String>,
    pub description: Option<String>,
    pub member: Vec<String>,
    pub member_of: Vec<String>,
    pub when_created: Option<String>,
    pub when_changed: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdOu {
    pub dn: String,
    pub object_class: Vec<String>,
    pub ou: String,
    pub cn: String,
    pub description: Option<String>,
    pub when_created: Option<String>,
    pub when_changed: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub user_dn: String,
    pub user_pn: String,
    pub username: String,
    pub profile_id: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum AdObject {
    User(AdUser),
    Group(AdGroup),
    Computer(AdComputer),
    Ou(AdOu),
}
