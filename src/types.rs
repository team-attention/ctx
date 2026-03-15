use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Frontmatter {
    #[serde(default)]
    pub ctx: Option<bool>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub what: Option<String>,
    #[serde(default)]
    pub keywords: Option<Vec<String>>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub triggers: Option<Vec<String>>,
    #[serde(default)]
    pub depends_on: Option<Vec<String>>,
    #[serde(default)]
    pub actions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContextNode {
    pub name: String,
    pub path: String,  // relative to project root
    pub what: String,
    pub keywords: Vec<String>,
    pub category: String,
    pub triggers: Vec<String>,
    pub depends_on: Vec<String>,
    pub actions: Vec<String>,
    #[serde(skip)]
    pub body: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MatchResult {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub match_type: String,  // "direct" or "dependency"
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub matched_triggers: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub via: Option<String>,
    pub actions: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryResult {
    pub name: String,
    pub path: String,
    pub score: Option<f64>,
    #[serde(rename = "type")]
    pub match_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub via: Option<String>,
    pub actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CheckWarning {
    #[serde(rename = "type")]
    pub warning_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CheckResult {
    pub status: String,  // "ok" or "warnings"
    pub node_count: usize,
    pub warnings: Vec<CheckWarning>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CtxConfig {
    #[serde(default)]
    pub ignore: Vec<String>,
}

impl Default for CtxConfig {
    fn default() -> Self {
        Self {
            ignore: vec![
                "node_modules/**".into(),
                "dist/**".into(),
                ".git/**".into(),
                "vendor/**".into(),
                "build/**".into(),
                "target/**".into(),
            ],
        }
    }
}
