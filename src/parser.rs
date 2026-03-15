use crate::types::{ContextNode, Frontmatter};
use std::path::Path;

/// Split markdown file into frontmatter YAML and body
fn split_frontmatter(content: &str) -> Option<(&str, &str)> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return None;
    }
    let after_first = &content[3..];
    let end = after_first.find("\n---")?;
    let yaml = &after_first[..end];
    let body_start = end + 4; // skip \n---
    let body = if body_start < after_first.len() {
        after_first[body_start..].trim_start_matches('\n')
    } else {
        ""
    };
    Some((yaml, body))
}

/// Parse a markdown file into a ContextNode, if it's a valid ctx node
pub fn parse_context_file(content: &str, relative_path: &str) -> Result<Option<ContextNode>, String> {
    let (yaml_str, body) = match split_frontmatter(content) {
        Some(parts) => parts,
        None => return Ok(None), // No frontmatter → skip silently
    };

    let fm: Frontmatter = match serde_yaml::from_str(yaml_str) {
        Ok(fm) => fm,
        Err(e) => return Err(format!("Invalid YAML in {}: {}", relative_path, e)),
    };

    // ctx must be exactly true (boolean)
    match fm.ctx {
        Some(true) => {},
        _ => return Ok(None), // ctx not true → skip
    }

    let name = match fm.name {
        Some(n) => n,
        None => return Ok(None), // name is required for a loadable node
    };

    Ok(Some(ContextNode {
        name,
        path: relative_path.to_string(),
        what: fm.what.unwrap_or_default(),
        keywords: fm.keywords.unwrap_or_default(),
        category: fm.category.unwrap_or_else(|| "domain".to_string()),
        triggers: fm.triggers.unwrap_or_default(),
        depends_on: fm.depends_on.unwrap_or_default(),
        actions: fm.actions.unwrap_or_default(),
        body: body.to_string(),
    }))
}

/// Validate name charset: [a-z0-9-], max 64 chars
pub fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Name cannot be empty".into());
    }
    if name.len() > 64 {
        return Err(format!("Name '{}' exceeds 64 characters", name));
    }
    if !name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err(format!("Name '{}' contains invalid characters (allowed: [a-z0-9-])", name));
    }
    Ok(())
}
