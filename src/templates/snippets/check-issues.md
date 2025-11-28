# Check Issue Types

## issue-types

| Type | Meaning | Severity |
|------|---------|----------|
| `error` | Target file missing, invalid schema | ❌ Error |
| `stale_target` | Target changed, context may be outdated | ⚠️ Warning |
| `modified` | Context modified but not synced | ⚠️ Warning |
| `new` | Context file not in registry | 💡 Info |
| `deleted` | Context in registry but file deleted | 💡 Info |

## check-output

The `ctx check` command returns JSON with:
- `status`: overall health (`fresh`, `stale`, `error`)
- `summary.local`: `{ total, fresh, stale, new, deleted, errors }`
- `summary.global`: `{ total, fresh, stale, new, deleted, errors }`
- `issues[]`: array of issue objects

Each issue contains:
- `type`: one of `error`, `stale_target`, `modified`, `new`, `deleted`
- `scope`: `local` or `global`
- `contextPath`: path to the context file
- `targetPath`: (local only) path to the target file
- `message`: human-readable description
- `lastModified`: (optional) last sync timestamp

## check-commands

| Command | Description |
|---------|-------------|
| `ctx check` | Check health, output JSON |
| `ctx check --pretty` | Human-readable output |
| `ctx check --fix` | Auto-fix by syncing registry |
| `ctx check --local` | Check local contexts only |
| `ctx check --global` | Check global contexts only |

## check-status

| Status | Meaning |
|--------|---------|
| `fresh` | All contexts up-to-date |
| `stale` | Some contexts need attention (warnings) |
| `error` | Critical issues found (errors) |
