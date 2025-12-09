## Runtime Config Resolution

Before executing this command, read `ctx.config.yaml` from the project root to resolve configuration variables.

**Config Variables Used:**
| Variable | Config Path | Default |
|----------|-------------|---------|
| `{{global.directory}}` | `global.directory` | `ctx` |
| `{{work.directory}}` | `work.directory` | `.worktrees` |
| `{{work.issue_store.type}}` | `work.issue_store.type` | `local` |
| `{{work.issue_store.url}}` | `work.issue_store.url` | - |
| `{{work.issue_store.project_id}}` | `work.issue_store.project_id` | - |

**How to resolve:**
1. Read `ctx.config.yaml` using the Read tool
2. Parse YAML content
3. Replace `{{variable}}` placeholders with actual config values
4. Use defaults if config values are not set
