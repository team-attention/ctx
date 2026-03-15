use crate::types::CtxConfig;
use std::path::{Path, PathBuf};
use std::fs;

/// Find project root by walking up from cwd
/// Priority: .ctxconfig → .ctx/ → .git/ → error
pub fn find_project_root(start: &Path) -> Result<PathBuf, String> {
    let mut current = start.to_path_buf();
    loop {
        if current.join(".ctxconfig").exists() {
            return Ok(current);
        }
        if current.join(".ctx").is_dir() {
            return Ok(current);
        }
        if current.join(".git").exists() {
            return Ok(current);
        }
        if !current.pop() {
            return Err("No ctx project found (no .ctxconfig, .ctx/, or .git/)".into());
        }
    }
}

/// Read .ctxconfig or return defaults
pub fn read_config(project_root: &Path) -> CtxConfig {
    let config_path = project_root.join(".ctxconfig");
    if let Ok(content) = fs::read_to_string(&config_path) {
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        CtxConfig::default()
    }
}

/// Make a path relative to project root
pub fn relative_path(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}
