use crate::parser;
use crate::project;
use crate::types::{ContextNode, CtxConfig};
use std::collections::HashMap;
use std::path::Path;
use walkdir::WalkDir;
use globset::{Glob, GlobSetBuilder};

/// Scan the project for all valid context nodes
pub fn scan_nodes(project_root: &Path, config: &CtxConfig) -> (Vec<ContextNode>, Vec<String>) {
    let mut nodes = Vec::new();
    let mut warnings = Vec::new();

    // Build ignore globset
    let mut builder = GlobSetBuilder::new();
    for pattern in &config.ignore {
        if let Ok(glob) = Glob::new(pattern) {
            builder.add(glob);
        }
    }
    let ignore_set = builder.build().unwrap_or_else(|_| GlobSetBuilder::new().build().unwrap());

    for entry in WalkDir::new(project_root)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Only process .md files
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let rel = project::relative_path(path, project_root);

        // Check ignore patterns
        if ignore_set.is_match(&rel) {
            continue;
        }

        // Read and parse
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        match parser::parse_context_file(&content, &rel) {
            Ok(Some(node)) => nodes.push(node),
            Ok(None) => {}, // Not a ctx node, skip silently
            Err(e) => warnings.push(e),
        }
    }

    (nodes, warnings)
}

/// Build a name→node map, detecting duplicates
pub fn build_node_map(nodes: Vec<ContextNode>) -> (HashMap<String, ContextNode>, Vec<(String, Vec<String>)>) {
    let mut map: HashMap<String, ContextNode> = HashMap::new();
    let mut all_paths: HashMap<String, Vec<String>> = HashMap::new();

    // Sort nodes by path for deterministic first-found behavior
    let mut sorted_nodes = nodes;
    sorted_nodes.sort_by(|a, b| a.path.cmp(&b.path));

    for node in sorted_nodes {
        all_paths
            .entry(node.name.clone())
            .or_default()
            .push(node.path.clone());

        map.entry(node.name.clone()).or_insert(node);
    }

    let duplicates: Vec<(String, Vec<String>)> = all_paths
        .into_iter()
        .filter(|(_, paths)| paths.len() > 1)
        .collect();

    (map, duplicates)
}
