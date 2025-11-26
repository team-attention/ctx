**.ctx.current Structure** (JSON format):

```json
{
  "issue": "<url-or-file-path>",
  "sessions": ["<session-path-1>", "<session-path-2>"]
}
```

**Fields:**
- `issue`: URL (online) or file path (offline) to the issue
  - Example (online): `https://github.com/user/repo/issues/123`
  - Example (online): `https://linear.app/team/issue/ABC-123`
  - Example (offline): `{{global.directory}}/issues/2025-11-20-0000_feature.md`
- `sessions`: Array of JSONL session file paths (optional)
  - Example: `[".claude/sessions/2025-11-20-session.jsonl"]`

**Location:** Project root (`.ctx.current`)
