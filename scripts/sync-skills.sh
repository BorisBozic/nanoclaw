#!/bin/bash
# Sync skills from Claude Code plugin cache into NanoClaw container skills
# Run this after Claude Code plugin updates to keep Sigma's skills current.

set -e

DEST="$(dirname "$0")/../container/skills"

# Find latest plugin versions
CE_DIR=$(ls -d /Users/fambot/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/*/skills/ 2>/dev/null | tail -1)
IMP_DIR=$(ls -d /Users/fambot/.claude/plugins/cache/impeccable/impeccable/*/source/skills/ 2>/dev/null | tail -1)

echo "CE source:  ${CE_DIR:-NOT FOUND}"
echo "IMP source: ${IMP_DIR:-NOT FOUND}"
echo "Dest:       $DEST"
echo ""

synced=0

# CE skills (initiative workflow + review)
# Source dirs already have ce- prefix where applicable, so use as-is
if [ -n "$CE_DIR" ]; then
  for skill in ce-brainstorm ce-plan ce-work ce-review ce-compound brainstorming deepen-plan document-review; do
    if [ -d "$CE_DIR/$skill" ]; then
      mkdir -p "$DEST/$skill"
      cp "$CE_DIR/$skill/SKILL.md" "$DEST/$skill/SKILL.md"
      echo "  ✓ $skill"
      synced=$((synced + 1))
    fi
  done
fi

# Impeccable skills (design quality)
if [ -n "$IMP_DIR" ]; then
  for skill in critique polish arrange typeset colorize normalize audit distill bolder quieter delight frontend-design; do
    if [ -d "$IMP_DIR/$skill" ]; then
      mkdir -p "$DEST/imp-$skill"
      cp "$IMP_DIR/$skill/SKILL.md" "$DEST/imp-$skill/SKILL.md"
      echo "  ✓ imp-$skill"
      synced=$((synced + 1))
    fi
  done
fi

echo ""
echo "Synced $synced skills."
echo "Run './container/build.sh' and restart NanoClaw to pick up changes."
