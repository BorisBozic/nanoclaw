#!/bin/bash
# PreToolUse hook — blocks writes outside allowed directories.
# Only fires for Write and Edit tools (via matcher).
# Exit 0 = allow, Exit 2 = block silently.

RESULT=$(node -e "
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    const input = JSON.parse(data);
    const fp = (input.tool_input && input.tool_input.file_path) || '';
    if (fp.startsWith('/workspace/group/') || fp.startsWith('/workspace/extra/') || fp.startsWith('/home/node/.claude/')) {
      process.stdout.write('allow');
    } else {
      process.stderr.write('Blocked write to ' + fp + ' — outside allowed directories');
      process.stdout.write('block');
    }
  });
")

if [ "$RESULT" = "block" ]; then
  exit 2
fi
exit 0
