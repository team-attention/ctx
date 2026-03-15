## T1
- Rust 1.84.1 is installed; clap must be pinned to =4.5.19 (newer versions pull clap_lex >=1.1.0 which requires edition2024)
- globset must be pinned to =0.4.15 (0.4.16+ requires edition2024)
- serde_yaml 0.9 is deprecated but still functional with unsafe-libyaml-0.2.11 (already in cache)
- serde_json 1 and serde 1 resolve fine with cached versions
- CLI module structure: src/lib.rs exports pub mod cli; src/cli.rs has Cli + Command enums; src/main.rs does parse + dispatch
- All 10 subcommands must be listed in Command enum: init, create, list, show, check, match, query, graph, index, migrate
- cargo clippy -- -D warnings passes with no issues on this scaffold

## T2
- Frontmatter split: use `content.starts_with("---")` then find `"\n---"` as closing delimiter; skip `pos + 4` bytes (`"\n---"`) then `trim_start_matches('\n')` to strip any blank lines before body
- serde_yaml parses into `serde_yaml::Value` first to check `ctx` == bool true before full deserialization; avoids needing a separate raw struct
- Unknown fields are ignored by default in serde (no `deny_unknown_fields`); Category enum uses `#[serde(rename_all = "lowercase")]`
- Name validation ([a-z0-9-], max 64 chars) runs after deserialization and returns `Err(ParseError)` on violation
- `body` field uses `#[serde(skip)]` so serde ignores it; it's populated manually after deserialization
- All 15 parser unit tests pass; `cargo clippy -- -D warnings` clean

## T3
- tempfile must be pinned to =3.13.0; tempfile 3.27+ pulls getrandom 0.4.2 which requires edition2024 (incompatible with Rust 1.84.1)
- Pattern: `cargo build` succeeds but `cargo test` can fail due to dev-dependency version issues; always verify test compilation separately
- `globset =0.4.15` (already pinned from T1) works for building GlobSet from ignore patterns; use `GlobSetBuilder` + `Glob::new()` per pattern
- Ignore matching strategy: check full relative path AND each ancestor prefix so patterns like `node_modules/**` correctly match `node_modules/foo/bar.md`
- Duplicate name detection uses alphabetical path sort first, then a `HashMap<name, first_path>` pass; duplicates are warned to stderr, first occurrence kept
- `config.rs` exports `find_project_root()` (walks up CWD checking .ctxconfig → .ctx/ → .git/), `load_config()`, and `effective_ignore_patterns()`
- `scanner.rs` exports `scan_project(root, ignore_patterns)` returning `Vec<ScannedNode>` with relative paths
- `src/lib.rs` may have additional modules (graph, matcher, search) added by concurrent tasks; always read before editing to avoid clobbering
- All 20 scanner+config unit tests pass; 68 total tests pass across all modules

## T6
- matcher.rs uses `globset::{Glob, GlobSet, GlobSetBuilder}`; each trigger pattern is compiled into its own single-pattern GlobSet so matched_triggers can record which individual patterns matched
- Nodes with `triggers: None` or `triggers: Some([])` are both excluded from matching (checked with `if triggers.is_empty()`)
- Paths passed to `match_files` must already be relative to project root; no path stripping is done inside the matcher
- `MatchResult` holds `node_name: String` and `matched_triggers: Vec<String>`; nodes with zero matching triggers produce no result entry
- 8 unit tests cover: ** wildcard, single-star within segment, relative paths, multiple triggers with partial match, no-triggers excluded, no-match case, multiple nodes independent matching, empty triggers excluded
- `cargo clippy -- -D warnings` must be run from the project root (ctx-new/); pre-existing clippy issues in other modules can cause failures if they exist

## T7
- ContextGraph wraps `HashMap<String, ContextNode>`; `expand_dependencies` takes `&[&str]` of direct names and returns `Vec<ResultNode>`
- NodeRole enum (Direct/Dependency) and ResultNode struct carry `node_type` and `via: Option<String>` fields per spec
- 1-level-only traversal enforced by iterating `direct_node.depends_on` without recursion (C1 constraint)
- Deduplication uses `HashMap<String, ()>` seen-set; direct nodes are collected in a first pass so they take precedence over the same name appearing as a dependency
- Self-references (dep_name == direct_name) and broken references (name not in graph) are both silently skipped with no error
- `cargo clippy -- -D warnings` must be run from the project root (ctx-new/); running from the shell's default cwd may pick up a different Cargo.toml and fail with an edition2024 error
- 13 graph unit tests all pass covering: 1-level traversal, no-transitive guarantee, shared-dep dedup, direct-wins-over-dep dedup, duplicate direct names, broken refs, missing direct, empty input, self-ref, via field, node_type field

## T11
- BM25 corpus is built from `name` + `what` + `keywords` fields only; body is intentionally excluded (C5 constraint). Test `test_body_not_searched` explicitly verifies this.
- Smoothed IDF formula: `ln((N - df + 0.5) / (df + 0.5) + 1.0)` avoids negative scores when df == N; produces non-negative values even for terms appearing in all documents.
- Score normalization divides every raw score by the maximum raw score so the top result always gets 1.0; when max_score == 0 (no matches), all scores are set to 0.0.
- Threshold filtering uses strict `score > threshold` (not >=) so `threshold = 0.0` returns only nodes with positive BM25 scores.
- A test-only constant `SCORE_THRESHOLD` annotated with `#[cfg(test)]` avoids clippy dead_code warning while providing a named default for test readability.
- `cargo test` must use `--offline` flag in this environment; `getrandom 0.4.2` in the global registry requires edition2024 and breaks online resolution.
- 12 search unit tests all pass covering: single keyword, multiple keywords, empty query, no match, scoring order, normalization range, threshold filtering, small corpus, empty nodes, name/what/keywords field searchability, body exclusion.

## T10
- `scan_candidates(from_dir)` recursively collects `.md` files, calls `parse_frontmatter()` to extract existing ctx fields (triggers, depends_on, category), then extracts `what` from first `# Heading` in body and keywords from trigger glob patterns
- Keyword extraction splits triggers on `/`, `*`, `?`, `{`, `}`, `.`, `-`, `_`; keeps only lowercase alphabetic words len>=3 not in a noise set (`src`, `lib`, `app`, etc.); deduplicates via `HashSet`
- `derive_name_from_stem` lowercases, maps non-`[a-z0-9]` to `-`, collapses consecutive hyphens, trims leading/trailing `-`, truncates to 64 chars
- Dry-run is the default: prints `=== [DRY RUN] ===` banner + per-file preview including collision skip; no files are written
- Apply mode gates on `--yes` flag; without `--yes` the code calls `prompt_confirm()` which reads from stdin (TTY y/N). Tests use `--yes` to bypass the prompt
- Collision: if `.ctx/<name>.md` already exists, emit warning to stderr and add to `skipped` list; do NOT overwrite
- Partial failure rollback: `created: Vec<PathBuf>` tracks each successfully written file; on `Err`, loop deletes them all and returns the error
- `render_candidate` builds frontmatter as a String in fixed field order: `ctx`, `name`, `what`, `keywords`, `category`, `triggers`, `depends_on`; appends body after closing `---`
- Wire-in in `main.rs`: mutual exclusion of `--dry-run` and `--apply` is checked at dispatch; `MigrateOptions { from, apply, yes, cwd }` passed to `run_migrate`
- 26 migrate unit tests all pass; `cargo clippy -- -D warnings` clean

## T8
- `run_match(MatchArgs)` is the public entry point returning an i32 exit code; caller in main.rs calls `std::process::exit(exit_code)` only when non-zero
- Git file collection uses three modes: `--staged` → `git diff --name-only --cached`; `--base <ref>` → `git diff --name-only <ref>...HEAD`; default `--diff` → `git diff --name-only HEAD` + `git ls-files --others --exclude-standard` (deduplicated)
- `run_git_command` detects "not a git repository" in git's stderr and maps it to the user-facing message "Not a git repository" (exit 1)
- C2 constraint: dependency nodes (`NodeRole::Dependency`) must NOT have `matched_triggers` in JSON; achieved by `#[serde(skip_serializing_if = "Vec::is_empty")]` on `matched_triggers` and setting it to `Vec::new()` for dep nodes
- `make_relative(root, path)` strips absolute paths under root; passes relative paths through unchanged — paths from git output are already relative to repo root
- Pipeline order: find_project_root → load_config → effective_ignore_patterns → scan_project → match_files → ContextGraph::new → expand_dependencies → serialize JSON
- 15 match_cmd unit tests all pass: make_relative (3), JSON serialization (5), integration pipeline (5), body flag (2)
- Pre-existing clippy errors in check.rs and migrate.rs (from other tasks) caused `cargo clippy -- -D warnings` to fail globally; match_cmd.rs itself has zero clippy issues

## T4
- `src/commands/` module pattern: `mod.rs` lists `pub mod init;` and `pub mod create;`; each file exports a `run_*` function plus an error type
- `run_init(cwd)` writes `.ctxconfig` with `DEFAULT_IGNORE` patterns in YAML list format, creates `.ctx/`; skips each with a stderr warning if already present (idempotent)
- `run_create(root, opts)` validates name with `validate_name()`, calls `scan_project()` to detect duplicates (exit 1), then writes `.ctx/<name>.md` with YAML frontmatter
- Frontmatter is constructed as a String (not serde serialization) to ensure exact field order: `ctx`, `name`, `what`, `category`, then optional `triggers`/`depends_on` lists
- `what` field defaults to `name` when not provided via `--what`; `category` defaults to `"domain"` when not provided via `--category`
- Comma-separated `--triggers` and `--depends-on` flags are split in `main.rs` dispatch using `split(',').map(str::trim)` before passing to `CreateOptions`
- `scan_project()` works even when `.ctx/` doesn't exist (scans recursively); `run_create` creates `.ctx/` if missing before writing the file
- In `main.rs`, `find_project_root(&cwd).unwrap_or(cwd)` allows `ctx create` to work even outside a recognized project root
- `cargo clippy -- -D warnings` passes with no issues; 5 init tests + 12 create tests all pass

## T9
- `run_graph(cwd, node)` takes an optional node name; `None` → full graph (all nodes sorted alphabetically, one per line), `Some(name)` → incoming (who depends on it) + outgoing (what it depends on)
- Output format for nodes with deps: `"billing ──→ ux, infra"` using literal Unicode `\u{2500}\u{2500}\u{2192}`; nodes with no deps print just the name
- Node-specific view: incoming lines formatted as `"callers ──→ target (incoming)"`, outgoing as `"target ──→ deps"`; isolated nodes (no incoming, no outgoing) print just the name
- `deps_map` built from `scanned.node.depends_on.clone().unwrap_or_default()` for all nodes; incoming computed by iterating all other nodes and checking if they list target in their deps
- Error returned (not exit) when specific node name is not found in the project; empty project returns `Ok(())` with no output
- `HashSet` import is used inside node-specific branch but the variable is immediately dropped (`let _ = ...`); remove if not needed to keep clippy clean
- 9 tests cover: empty project, full graph no-deps, full graph with deps, node-not-found, node no deps/no incoming, node with outgoing, node with incoming, node both directions, sorted output
- Wire-in pattern: `Command::Graph { node } => { run_graph(&cwd, node.as_deref()) }` in src/main.rs

## T12
- `is_available()` probes by spawning `qmd --version` with null stdout/stderr; `Command::status().is_ok()` returns false on NotFound without panicking.
- `search()` and `update()` use `Command::output()` with `current_dir(project_root)` so qmd operates in the correct project context.
- JSON parsing uses `serde_json::Value` (already in Cargo.toml) to avoid a new dependency; missing `score` field defaults to 0.0 via `and_then(...).unwrap_or(0.0)`.
- Absence tests use `if is_available() { return; }` guard so they skip gracefully on machines where qmd is installed and pass on machines where it is absent.
- `parse_qmd_json` is extracted as a pure function so JSON parsing tests run without any binary/process overhead.
- `src/lib.rs` had an additional `pub mod commands;` added by a prior task — always re-read before editing to avoid clobbering concurrent additions.
- 10 qmd unit tests pass: empty array, single result, multiple results, missing score, invalid JSON, non-array JSON, missing name field, is_available no-panic, search-err-when-absent, update-err-when-absent.

## T5
- `ctx list` serializes `Vec<ListItem>` via serde_json; `--pretty` uses `serde_json::to_string_pretty`, `--paths` returns newline-joined relative path strings
- `ctx show` re-reads the raw file after finding it by name via scan; returns full file content (frontmatter + body) as-is; `ShowError.not_found` flag lets callers choose exit 1
- `ctx check` requires two scan passes: `scan_all_raw` (no dedup) for `duplicate_name` detection, `scan_project` (with dedup) for `broken_dep` and `missing_field` detection
- `Warning` enum uses `#[serde(tag = "type", rename_all = "snake_case")]` so the `type` field appears in JSON output matching PRD schema
- Required fields for `missing_field` warnings: `what`, `keywords`, `category` (name is always present post-parse)
- `--strict` flag: `run_check` returns `(json_string, has_warnings: bool)`; main.rs calls `std::process::exit(2)` when `strict && has_warnings`
- Default exit code for check is 0 (even with warnings); exit 2 only with `--strict`
- Clippy lint: `path.extension().map_or(false, |e| e == "md")` must be replaced with `path.extension().is_some_and(|e| e == "md")` to pass `-- -D warnings`
- `mod.rs` in commands/ must be read before editing as concurrent tasks may have added entries; always append rather than overwrite
- 7 list tests + 5 show tests + 11 check tests all pass; total 23 new tests added
