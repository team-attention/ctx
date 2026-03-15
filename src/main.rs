mod graph;
mod parser;
mod project;
mod scanner;
mod types;

use clap::{Parser, Subcommand};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use types::{CheckResult, CheckWarning, ContextNode, MatchResult};

#[derive(Parser)]
#[command(name = "ctx", about = "Project context graph tool")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize ctx project
    Init,
    /// Create a new context node
    Create {
        name: String,
        #[arg(long, default_value = "domain")]
        category: String,
        #[arg(long)]
        triggers: Option<String>,
        #[arg(long, alias = "depends-on")]
        depends_on: Option<String>,
    },
    /// List all context nodes
    List {
        #[arg(long)]
        pretty: bool,
    },
    /// Show a specific node's content
    Show {
        node: String,
        #[arg(long)]
        pretty: bool,
    },
    /// Health check
    Check {
        #[arg(long)]
        pretty: bool,
    },
    /// Match files against context nodes
    Match {
        files: Vec<String>,
        #[arg(long)]
        diff: bool,
        #[arg(long)]
        body: bool,
        #[arg(long)]
        staged: bool,
        #[arg(long, alias = "base")]
        base_ref: Option<String>,
        #[arg(long)]
        pretty: bool,
    },
    /// Query contexts by natural language
    Query {
        text: String,
        #[arg(long)]
        body: bool,
        #[arg(long)]
        pretty: bool,
    },
    /// Visualize the context graph
    Graph {
        node: Option<String>,
        #[arg(long)]
        pretty: bool,
    },
    /// Migrate existing .md files
    Migrate {
        #[arg(long)]
        from: String,
        #[arg(long)]
        apply: bool,
    },
}

fn load_project() -> Result<(PathBuf, HashMap<String, ContextNode>, Vec<String>), String> {
    let cwd = std::env::current_dir().map_err(|e| format!("Cannot get cwd: {}", e))?;
    let root = project::find_project_root(&cwd)?;
    let config = project::read_config(&root);
    let (nodes, warnings) = scanner::scan_nodes(&root, &config);
    let (node_map, duplicates) = scanner::build_node_map(nodes);

    // Emit duplicate warnings to stderr
    let mut all_warnings = warnings;
    for (name, paths) in &duplicates {
        eprintln!("warning: duplicate name '{}' in: {}", name, paths.join(", "));
        all_warnings.push(format!("duplicate name '{}' in: {}", name, paths.join(", ")));
    }

    Ok((root, node_map, all_warnings))
}

fn get_diff_files(root: &PathBuf, staged: bool, base_ref: &Option<String>) -> Result<Vec<String>, String> {
    let git_dir = root.join(".git");
    if !git_dir.exists() {
        return Err("Not a git repository".into());
    }

    let mut files = Vec::new();

    // Get changed files
    let base_spec = base_ref.as_ref().map(|b| format!("{}...HEAD", b));
    let diff_args: Vec<&str> = if staged {
        vec!["diff", "--name-only", "--cached"]
    } else if let Some(ref spec) = base_spec {
        vec!["diff", "--name-only", spec.as_str()]
    } else {
        vec!["diff", "--name-only", "HEAD"]
    };

    let output = Command::new("git")
        .args(&diff_args)
        .current_dir(root)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if !line.is_empty() {
                files.push(line.to_string());
            }
        }
    }

    // Also get untracked files (unless staged mode)
    if !staged && base_ref.is_none() {
        let output = Command::new("git")
            .args(["ls-files", "--others", "--exclude-standard"])
            .current_dir(root)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if !line.is_empty() {
                    files.push(line.to_string());
                }
            }
        }
    }

    files.sort();
    files.dedup();
    Ok(files)
}

fn cmd_init() -> i32 {
    let cwd = std::env::current_dir().unwrap();

    // Create .ctxconfig
    let config_path = cwd.join(".ctxconfig");
    if !config_path.exists() {
        let default_config = r#"# .ctxconfig
ignore:
  - node_modules/**
  - dist/**
  - .git/**
  - vendor/**
  - build/**
  - target/**
"#;
        std::fs::write(&config_path, default_config).unwrap();
        eprintln!("Created .ctxconfig");
    }

    // Create .ctx/ directory
    let ctx_dir = cwd.join(".ctx");
    if !ctx_dir.exists() {
        std::fs::create_dir_all(&ctx_dir).unwrap();
        eprintln!("Created .ctx/");
    }

    println!("{{\"status\": \"initialized\"}}");
    0
}

fn cmd_create(name: &str, category: &str, triggers: &Option<String>, depends_on: &Option<String>) -> i32 {
    // Validate name
    if let Err(e) = parser::validate_name(name) {
        eprintln!("error: {}", e);
        return 1;
    }

    // Check for project
    let cwd = std::env::current_dir().unwrap();
    if let Ok((_, node_map, _)) = load_project() {
        if node_map.contains_key(name) {
            eprintln!("error: Node name '{}' already exists", name);
            return 1;
        }
    }

    // Create file
    let ctx_dir = cwd.join(".ctx");
    if !ctx_dir.exists() {
        std::fs::create_dir_all(&ctx_dir).unwrap();
    }

    let file_path = ctx_dir.join(format!("{}.md", name));
    if file_path.exists() {
        eprintln!("error: File already exists: {}", file_path.display());
        return 1;
    }

    let triggers_yaml = match triggers {
        Some(t) => {
            let items: Vec<&str> = t.split(',').map(|s| s.trim()).collect();
            let lines: Vec<String> = items.iter().map(|i| format!("  - \"{}\"", i)).collect();
            format!("triggers:\n{}", lines.join("\n"))
        }
        None => "triggers: []".to_string(),
    };

    let deps_yaml = match depends_on {
        Some(d) => {
            let items: Vec<&str> = d.split(',').map(|s| s.trim()).collect();
            format!("depends_on: [{}]", items.join(", "))
        }
        None => "depends_on: []".to_string(),
    };

    let content = format!(
        r#"---
ctx: true
name: {name}
what: "{name} context"
keywords: ["{name}"]
category: {category}
{triggers}
{deps}
actions: []
---

## {name}

- [ ] TODO: Add checklist items
"#,
        name = name,
        category = category,
        triggers = triggers_yaml,
        deps = deps_yaml,
    );

    std::fs::write(&file_path, content).unwrap();
    println!("{{\"created\": \"{}\"}}", file_path.display());
    0
}

fn cmd_list(pretty: bool) -> i32 {
    let (_, node_map, _) = match load_project() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {}", e);
            return 1;
        }
    };

    let mut nodes: Vec<&ContextNode> = node_map.values().collect();
    nodes.sort_by(|a, b| a.name.cmp(&b.name));

    if pretty {
        for node in &nodes {
            println!("{} ({}) — {}", node.name, node.category, node.what);
            if !node.triggers.is_empty() {
                println!("  triggers: {}", node.triggers.join(", "));
            }
            if !node.depends_on.is_empty() {
                println!("  depends_on: {}", node.depends_on.join(", "));
            }
        }
    } else {
        let list: Vec<serde_json::Value> = nodes
            .iter()
            .map(|n| {
                serde_json::json!({
                    "name": n.name,
                    "path": n.path,
                    "category": n.category,
                    "what": n.what,
                    "keywords": n.keywords,
                    "triggers": n.triggers,
                    "depends_on": n.depends_on,
                })
            })
            .collect();
        println!("{}", serde_json::to_string_pretty(&list).unwrap());
    }
    0
}

fn cmd_show(node_name: &str, pretty: bool) -> i32 {
    let (_, node_map, _) = match load_project() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {}", e);
            return 1;
        }
    };

    match node_map.get(node_name) {
        Some(node) => {
            if pretty {
                println!("# {} ({})\n{}\n\n{}", node.name, node.category, node.what, node.body);
            } else {
                println!("{}", serde_json::to_string_pretty(&serde_json::json!({
                    "name": node.name,
                    "path": node.path,
                    "what": node.what,
                    "category": node.category,
                    "body": node.body,
                })).unwrap());
            }
            0
        }
        None => {
            eprintln!("error: Node '{}' not found", node_name);
            1
        }
    }
}

fn cmd_check(pretty: bool) -> i32 {
    let (_, node_map, scan_warnings) = match load_project() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {}", e);
            return 1;
        }
    };

    let mut warnings: Vec<CheckWarning> = Vec::new();

    // Scan warnings (invalid YAML etc)
    for w in &scan_warnings {
        if w.contains("duplicate name") {
            let parts: Vec<&str> = w.splitn(2, " in: ").collect();
            let name = parts[0].replace("duplicate name '", "").replace("'", "");
            let paths_str = parts.get(1).unwrap_or(&"");
            let paths: Vec<String> = paths_str.split(", ").map(|s| s.to_string()).collect();
            warnings.push(CheckWarning {
                warning_type: "duplicate_name".into(),
                node: None,
                name: Some(name),
                detail: None,
                field: None,
                paths: Some(paths),
            });
        } else if w.contains("Invalid YAML") {
            warnings.push(CheckWarning {
                warning_type: "invalid_yaml".into(),
                node: None,
                name: None,
                detail: Some(w.clone()),
                field: None,
                paths: None,
            });
        }
    }

    // Check each node for issues
    for node in node_map.values() {
        // Missing required fields
        if node.what.is_empty() {
            warnings.push(CheckWarning {
                warning_type: "missing_field".into(),
                node: Some(node.name.clone()),
                name: None,
                detail: None,
                field: Some("what".into()),
                paths: None,
            });
        }
        if node.keywords.is_empty() {
            warnings.push(CheckWarning {
                warning_type: "missing_field".into(),
                node: Some(node.name.clone()),
                name: None,
                detail: None,
                field: Some("keywords".into()),
                paths: None,
            });
        }
        if node.category.is_empty() {
            warnings.push(CheckWarning {
                warning_type: "missing_field".into(),
                node: Some(node.name.clone()),
                name: None,
                detail: None,
                field: Some("category".into()),
                paths: None,
            });
        }

        // Broken depends_on references
        for dep in &node.depends_on {
            if !node_map.contains_key(dep) {
                warnings.push(CheckWarning {
                    warning_type: "broken_dep".into(),
                    node: Some(node.name.clone()),
                    name: None,
                    detail: Some(format!("depends_on '{}' not found", dep)),
                    field: None,
                    paths: None,
                });
            }
        }

        // Name validation
        if let Err(e) = parser::validate_name(&node.name) {
            warnings.push(CheckWarning {
                warning_type: "invalid_name".into(),
                node: Some(node.name.clone()),
                name: None,
                detail: Some(e),
                field: None,
                paths: None,
            });
        }
    }

    let status = if warnings.is_empty() { "ok" } else { "warnings" };
    let result = CheckResult {
        status: status.to_string(),
        node_count: node_map.len(),
        warnings: warnings.clone(),
    };

    if pretty {
        println!("Node count: {}", result.node_count);
        if warnings.is_empty() {
            println!("Status: OK — no issues found");
        } else {
            println!("Status: {} warning(s)", warnings.len());
            for w in &warnings {
                match w.warning_type.as_str() {
                    "duplicate_name" => println!("  ⚠ duplicate name '{}': {:?}", w.name.as_deref().unwrap_or("?"), w.paths),
                    "broken_dep" => println!("  ⚠ {}: {}", w.node.as_deref().unwrap_or("?"), w.detail.as_deref().unwrap_or("")),
                    "missing_field" => println!("  ⚠ {}: missing '{}'", w.node.as_deref().unwrap_or("?"), w.field.as_deref().unwrap_or("")),
                    "invalid_yaml" => println!("  ⚠ {}", w.detail.as_deref().unwrap_or("")),
                    "invalid_name" => println!("  ⚠ {}: {}", w.node.as_deref().unwrap_or("?"), w.detail.as_deref().unwrap_or("")),
                    _ => println!("  ⚠ {:?}", w),
                }
            }
        }
    } else {
        println!("{}", serde_json::to_string_pretty(&result).unwrap());
    }

    if warnings.is_empty() { 0 } else { 2 }
}

fn cmd_match(files: &[String], diff: bool, body: bool, staged: bool, base_ref: &Option<String>, pretty: bool) -> i32 {
    let (root, node_map, _) = match load_project() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {}", e);
            return 1;
        }
    };

    let file_list = if diff {
        match get_diff_files(&root, staged, base_ref) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("error: {}", e);
                return 1;
            }
        }
    } else if !files.is_empty() {
        // Normalize to project-relative paths
        let cwd = std::env::current_dir().unwrap();
        files.iter().map(|f| {
            let abs = if std::path::Path::new(f).is_absolute() {
                PathBuf::from(f)
            } else {
                cwd.join(f)
            };
            project::relative_path(&abs, &root)
        }).collect()
    } else {
        eprintln!("error: Provide file paths or use --diff");
        return 1;
    };

    let results = graph::match_files(&file_list, &node_map, body);

    if pretty {
        if results.is_empty() {
            println!("No matching contexts found.");
        } else {
            for r in &results {
                let marker = if r.match_type == "direct" { "→" } else { "  ↳" };
                let via = r.via.as_deref().map(|v| format!(" (via {})", v)).unwrap_or_default();
                println!("{} {} [{}]{}", marker, r.name, r.match_type, via);
                if !r.matched_triggers.is_empty() {
                    println!("    triggers: {}", r.matched_triggers.join(", "));
                }
                if body {
                    if let Some(b) = &r.body {
                        println!("    ---");
                        for line in b.lines().take(10) {
                            println!("    {}", line);
                        }
                        println!("    ---");
                    }
                }
            }
        }
    } else {
        println!("{}", serde_json::to_string_pretty(&results).unwrap());
    }
    0
}

fn cmd_query(text: &str, body: bool, pretty: bool) -> i32 {
    let (_, node_map, _) = match load_project() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {}", e);
            return 1;
        }
    };

    // Native BM25 search
    let scored_results = graph::bm25_search(text, &node_map);

    // Build results with graph expansion
    let mut results: Vec<serde_json::Value> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for (name, score) in &scored_results {
        if !seen.insert(name.clone()) { continue; }
        if let Some(node) = node_map.get(name) {
            let mut entry = serde_json::json!({
                "name": node.name,
                "path": node.path,
                "score": score,
                "type": "direct",
                "via": null,
                "actions": node.actions,
            });
            if body {
                entry["body"] = serde_json::Value::from(node.body.clone());
            }
            results.push(entry);

            // 1-level depends_on expansion
            for dep_name in &node.depends_on {
                if seen.insert(dep_name.clone()) {
                    if let Some(dep_node) = node_map.get(dep_name) {
                        let mut dep_entry = serde_json::json!({
                            "name": dep_node.name,
                            "path": dep_node.path,
                            "score": null,
                            "type": "dependency",
                            "via": node.name,
                            "actions": dep_node.actions,
                        });
                        if body {
                            dep_entry["body"] = serde_json::Value::from(dep_node.body.clone());
                        }
                        results.push(dep_entry);
                    }
                }
            }
        }
    }

    if pretty {
        if results.is_empty() {
            println!("No matching contexts found.");
        } else {
            for r in &results {
                let name = r["name"].as_str().unwrap_or("?");
                let score = r["score"].as_f64();
                let via = r["via"].as_str();
                let match_type = r["type"].as_str().unwrap_or("?");

                if match_type == "direct" {
                    println!("→ {} (score: {:.2})", name, score.unwrap_or(0.0));
                } else {
                    println!("  ↳ {} (via {})", name, via.unwrap_or("?"));
                }
            }
        }
    } else {
        println!("{}", serde_json::to_string_pretty(&results).unwrap());
    }
    0
}

fn cmd_graph(node: &Option<String>, _pretty: bool) -> i32 {
    let (_, node_map, _) = match load_project() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {}", e);
            return 1;
        }
    };

    match node {
        Some(name) => {
            if let Some(n) = node_map.get(name) {
                println!("{} ({})", n.name, n.category);
                // Outgoing (depends_on)
                if !n.depends_on.is_empty() {
                    println!("  depends on:");
                    for dep in &n.depends_on {
                        let exists = if node_map.contains_key(dep) { "" } else { " [NOT FOUND]" };
                        println!("    → {}{}", dep, exists);
                    }
                }
                // Incoming (who depends on this node)
                let mut dependents: Vec<&str> = node_map.values()
                    .filter(|other| other.depends_on.contains(&name.to_string()))
                    .map(|other| other.name.as_str())
                    .collect();
                dependents.sort();
                if !dependents.is_empty() {
                    println!("  depended on by:");
                    for d in dependents {
                        println!("    ← {}", d);
                    }
                }
                0
            } else {
                eprintln!("error: Node '{}' not found", name);
                1
            }
        }
        None => {
            // Full graph
            let mut nodes: Vec<&ContextNode> = node_map.values().collect();
            nodes.sort_by(|a, b| a.name.cmp(&b.name));
            for node in nodes {
                if node.depends_on.is_empty() {
                    println!("{}", node.name);
                } else {
                    println!("{} ──→ {}", node.name, node.depends_on.join(", "));
                }
            }
            0
        }
    }
}

fn cmd_migrate(from: &str, apply: bool) -> i32 {
    let from_path = std::path::Path::new(from);
    if !from_path.is_dir() {
        eprintln!("error: '{}' is not a directory", from);
        return 1;
    }

    let cwd = std::env::current_dir().unwrap();
    let ctx_dir = cwd.join(".ctx");

    let mut count = 0;
    for entry in walkdir::WalkDir::new(from_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let filename = path.file_stem().unwrap().to_string_lossy();
        let name = filename.to_lowercase().replace(' ', "-");

        // Parse existing frontmatter if present
        let trimmed = content.trim_start();
        let (existing_fm, body) = if trimmed.starts_with("---") {
            let after = &trimmed[3..];
            if let Some(end) = after.find("\n---") {
                let yaml_str = &after[..end];
                let fm: serde_yaml::Value = serde_yaml::from_str(yaml_str).unwrap_or_default();
                let body = after[end+4..].trim().to_string();
                (fm, body)
            } else {
                (serde_yaml::Value::default(), content.clone())
            }
        } else {
            (serde_yaml::Value::default(), content.clone())
        };

        // Extract fields from existing frontmatter, with defaults
        let fm_map = existing_fm.as_mapping();

        let category = fm_map
            .and_then(|m| m.get(&serde_yaml::Value::from("category")))
            .and_then(|v| v.as_str())
            .unwrap_or("domain");

        let triggers: Vec<String> = fm_map
            .and_then(|m| m.get(&serde_yaml::Value::from("triggers")))
            .and_then(|v| v.as_sequence())
            .map(|seq| seq.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let depends_on: Vec<String> = fm_map
            .and_then(|m| m.get(&serde_yaml::Value::from("depends_on")))
            .and_then(|v| v.as_sequence())
            .map(|seq| seq.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let agents: Vec<String> = fm_map
            .and_then(|m| m.get(&serde_yaml::Value::from("agents")))
            .and_then(|v| v.as_sequence())
            .map(|seq| seq.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let commands: Vec<String> = fm_map
            .and_then(|m| m.get(&serde_yaml::Value::from("commands")))
            .and_then(|v| v.as_sequence())
            .map(|seq| seq.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        // Build actions from agents + commands
        let mut actions: Vec<String> = Vec::new();
        for a in &agents { actions.push(format!("Run agent: {}", a)); }
        for c in &commands { actions.push(format!("Run: {}", c)); }

        // Extract 'what' from first heading in body
        let what = body.lines()
            .find(|l| l.starts_with("# "))
            .map(|l| l.trim_start_matches("# ").to_string())
            .unwrap_or_else(|| format!("{} context", name));

        // Build keywords from name + triggers path segments
        let mut keywords = vec![name.clone()];
        for t in &triggers {
            for seg in t.split('/').filter(|s| !s.contains('*') && !s.is_empty()) {
                let kw = seg.to_lowercase();
                if !keywords.contains(&kw) { keywords.push(kw); }
            }
        }

        let triggers_yaml = if triggers.is_empty() {
            "triggers: []".to_string()
        } else {
            let lines: Vec<String> = triggers.iter().map(|t| format!("  - \"{}\"", t)).collect();
            format!("triggers:\n{}", lines.join("\n"))
        };

        let depends_yaml = if depends_on.is_empty() {
            "depends_on: []".to_string()
        } else {
            format!("depends_on: [{}]", depends_on.iter().map(|d| format!("\"{}\"", d)).collect::<Vec<_>>().join(", "))
        };

        let actions_yaml = if actions.is_empty() {
            "actions: []".to_string()
        } else {
            let lines: Vec<String> = actions.iter().map(|a| format!("  - \"{}\"", a)).collect();
            format!("actions:\n{}", lines.join("\n"))
        };

        let keywords_yaml = format!("[{}]", keywords.iter().map(|k| format!("\"{}\"", k)).collect::<Vec<_>>().join(", "));

        let dest = ctx_dir.join(format!("{}.md", name));
        let new_content = format!(
            "---\nctx: true\nname: {name}\nwhat: \"{what}\"\nkeywords: {keywords}\ncategory: {category}\n{triggers}\n{depends}\n{actions}\n---\n\n{body}\n",
            name = name, what = what, keywords = keywords_yaml,
            category = category, triggers = triggers_yaml,
            depends = depends_yaml, actions = actions_yaml, body = body
        );

        if apply {
            if !ctx_dir.exists() {
                std::fs::create_dir_all(&ctx_dir).unwrap();
            }
            std::fs::write(&dest, &new_content).unwrap();
            println!("  Migrated: {} → {}", path.display(), dest.display());
        } else {
            println!("  [DRY RUN] {} → {}", path.display(), dest.display());
        }
        count += 1;
    }

    if !apply && count > 0 {
        println!("\nDRY RUN — no files modified. Run with --apply to execute. ({} files)", count);
    } else if count == 0 {
        println!("No .md files found in '{}'", from);
    }

    0
}

fn main() {
    let cli = Cli::parse();

    let exit_code = match cli.command {
        Commands::Init => cmd_init(),
        Commands::Create { ref name, ref category, ref triggers, ref depends_on } => {
            cmd_create(name, category, triggers, depends_on)
        }
        Commands::List { pretty } => cmd_list(pretty),
        Commands::Show { ref node, pretty } => cmd_show(node, pretty),
        Commands::Check { pretty } => cmd_check(pretty),
        Commands::Match { ref files, diff, body, staged, ref base_ref, pretty } => {
            cmd_match(files, diff, body, staged, base_ref, pretty)
        }
        Commands::Query { ref text, body, pretty } => cmd_query(text, body, pretty),
        Commands::Graph { ref node, pretty } => cmd_graph(node, pretty),
        Commands::Migrate { ref from, apply } => cmd_migrate(from, apply),
    };

    std::process::exit(exit_code);
}
