use crate::types::{ContextNode, MatchResult};
use globset::{Glob, GlobMatcher};
use std::collections::{HashMap, HashSet};

/// Match file paths against node triggers, then expand 1-level depends_on
pub fn match_files(
    files: &[String],
    nodes: &HashMap<String, ContextNode>,
    include_body: bool,
) -> Vec<MatchResult> {
    let mut direct_matches: HashMap<String, Vec<String>> = HashMap::new(); // node_name → matched_triggers
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    // Build glob matchers for each node's triggers
    let matchers: Vec<(&ContextNode, Vec<(String, GlobMatcher)>)> = nodes
        .values()
        .map(|node| {
            let globs: Vec<(String, GlobMatcher)> = node
                .triggers
                .iter()
                .filter_map(|pattern| {
                    Glob::new(pattern)
                        .ok()
                        .map(|g| (pattern.clone(), g.compile_matcher()))
                })
                .collect();
            (node, globs)
        })
        .collect();

    // Match each file against each node's triggers
    for file in files {
        for (node, globs) in &matchers {
            for (pattern, matcher) in globs {
                if matcher.is_match(file) {
                    direct_matches
                        .entry(node.name.clone())
                        .or_default()
                        .push(pattern.clone());
                }
            }
        }
    }

    // Deduplicate triggers per node
    for triggers in direct_matches.values_mut() {
        triggers.sort();
        triggers.dedup();
    }

    // Add direct matches
    for (name, matched_triggers) in &direct_matches {
        if seen.insert(name.clone()) {
            if let Some(node) = nodes.get(name) {
                results.push(MatchResult {
                    name: node.name.clone(),
                    path: node.path.clone(),
                    match_type: "direct".to_string(),
                    matched_triggers: matched_triggers.clone(),
                    via: None,
                    actions: node.actions.clone(),
                    body: if include_body { Some(node.body.clone()) } else { None },
                });
            }
        }
    }

    // 1-level depends_on traversal
    let direct_names: Vec<String> = direct_matches.keys().cloned().collect();
    for direct_name in &direct_names {
        if let Some(node) = nodes.get(direct_name) {
            for dep_name in &node.depends_on {
                if seen.insert(dep_name.clone()) {
                    if let Some(dep_node) = nodes.get(dep_name) {
                        results.push(MatchResult {
                            name: dep_node.name.clone(),
                            path: dep_node.path.clone(),
                            match_type: "dependency".to_string(),
                            matched_triggers: vec![],
                            via: Some(direct_name.clone()),
                            actions: dep_node.actions.clone(),
                            body: if include_body { Some(dep_node.body.clone()) } else { None },
                        });
                    }
                    // If dep_name not found in nodes → silently skip (dangling ref)
                }
            }
        }
    }

    // Sort: direct first, then dependencies
    results.sort_by(|a, b| {
        a.match_type.cmp(&b.match_type).then(a.name.cmp(&b.name))
    });

    results
}

/// BM25 search over context nodes (keywords + what + body)
/// Returns (node_name, score) pairs sorted by score descending
pub fn bm25_search(query: &str, nodes: &HashMap<String, ContextNode>) -> Vec<(String, f64)> {
    let query_tokens: Vec<String> = query
        .split_whitespace()
        .map(|s| s.to_lowercase())
        .collect();

    if query_tokens.is_empty() {
        return vec![];
    }

    let n = nodes.len() as f64; // total documents
    if n == 0.0 {
        return vec![];
    }

    // BM25 parameters
    let k1: f64 = 1.2;
    let b: f64 = 0.75;

    // Build document texts: combine keywords + what + body for each node
    let docs: Vec<(&ContextNode, Vec<String>)> = nodes.values().map(|node| {
        let mut tokens = Vec::new();
        // Keywords (weight boost: add twice)
        for kw in &node.keywords {
            let lower = kw.to_lowercase();
            tokens.push(lower.clone());
            tokens.push(lower); // double weight for keywords
        }
        // What field
        for word in node.what.split_whitespace() {
            tokens.push(word.to_lowercase());
        }
        // Body
        for word in node.body.split_whitespace() {
            tokens.push(word.to_lowercase());
        }
        (node, tokens)
    }).collect();

    // Average document length
    let avg_dl: f64 = docs.iter().map(|(_, t)| t.len() as f64).sum::<f64>() / n;

    // Compute IDF for each query token: log((N - df + 0.5) / (df + 0.5) + 1)
    let mut df: HashMap<&str, usize> = HashMap::new();
    for qt in &query_tokens {
        let count = docs.iter().filter(|(_, tokens)| {
            tokens.iter().any(|t| t == qt || t.contains(qt.as_str()))
        }).count();
        df.insert(qt.as_str(), count);
    }

    // Score each document
    let mut scored: Vec<(String, f64)> = docs.iter().filter_map(|(node, tokens)| {
        let dl = tokens.len() as f64;
        let mut score = 0.0_f64;

        for qt in &query_tokens {
            let df_val = *df.get(qt.as_str()).unwrap_or(&0) as f64;
            if df_val == 0.0 { continue; }

            // IDF
            let idf = ((n - df_val + 0.5) / (df_val + 0.5) + 1.0).ln();

            // TF: count occurrences (including substring match for body)
            let tf = tokens.iter().filter(|t| {
                *t == qt || t.contains(qt.as_str())
            }).count() as f64;

            // BM25 TF normalization
            let tf_norm = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * dl / avg_dl));

            score += idf * tf_norm;
        }

        if score > 0.0 {
            Some((node.name.clone(), score))
        } else {
            None
        }
    }).collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored
}
