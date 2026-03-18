#!/bin/bash
# PostToolUse hook — logs every tool invocation to an audit file.
# Claude Code passes hook context as JSON on stdin.
# Uses Node.js to parse (jq not available in container).

AUDIT_FILE="/workspace/group/logs/tool-audit.jsonl"
mkdir -p "$(dirname "$AUDIT_FILE")"

node -e "
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    const input = JSON.parse(data);
    const entry = {
      timestamp: new Date().toISOString(),
      tool: input.tool_name || 'unknown',
      session: input.session_id || 'unknown'
    };
    require('fs').appendFileSync('$AUDIT_FILE', JSON.stringify(entry) + '\n');
  });
"

exit 0
