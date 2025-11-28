# Common Error Messages

## no-active-session
```
❌ Error: No active work session found
Run /ctx.work.init first to start a work session
```

## invalid-provider
```
❌ Error: Unsupported issue provider
Supported: GitHub (github.com), Linear (linear.app)
```

## file-not-found
```
❌ Error: Issue file not found
Check the path in .ctx.current
```

## invalid-frontmatter
```
❌ Error: Invalid issue file format
File must be markdown with frontmatter containing: title, source, provider, status
```

## no-gh-cli
```
❌ Error: GitHub CLI not installed
Install: https://cli.github.com
```

## no-linear-mcp
```
❌ Error: Linear MCP not available
Setup Linear MCP server in Claude Code settings
```

## target-not-found
```
❌ Error: Target file not found: [path]
Cannot create context for non-existent file
```

## context-already-exists
```
⚠️ Context already exists: [path]
Use UPDATE mode or specify a different path
```

## invalid-context-path
```
❌ Error: Invalid context path format
Expected: *.ctx.md (local) or {{global.directory}}/**/*.md (global)
```

## registry-lookup-failed
```
⚠️ Warning: Could not find context in registry for target: [path]
Creating new context file
```
