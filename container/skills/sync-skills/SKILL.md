---
name: sync-skills
description: Sync skills from Compound Engineering and Impeccable plugin sources into NanoClaw. Run periodically to stay up to date. Triggers on "sync skills", "update skills", "check for skill updates".
---

# Sync Skills from Plugin Sources

Pull the latest skill definitions from Compound Engineering and Impeccable plugins into NanoClaw's container skills directory.

## Source Locations

The Claude Code plugin cache on the host machine:
- **CE:** `/Users/fambot/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/*/skills/`
- **Impeccable:** `/Users/fambot/.claude/plugins/cache/impeccable/impeccable/*/source/skills/`

These are mounted into the container at:
- CE: Not directly mounted — read from host via NanoClaw's skill sync
- Impeccable: Not directly mounted — same

**Since we can't access the host plugin cache from inside the container, this skill should be run from the NanoClaw host context (Claude Code), not from inside the agent container.**

## How to Sync (run from Claude Code or host terminal)

```bash
# Find the latest CE version
CE_DIR=$(ls -d /Users/fambot/.claude/plugins/cache/compound-engineering-plugin/compound-engineering/*/skills/ 2>/dev/null | tail -1)

# Find the latest Impeccable version
IMP_DIR=$(ls -d /Users/fambot/.claude/plugins/cache/impeccable/impeccable/*/source/skills/ 2>/dev/null | tail -1)

DEST=/Users/fambot/Projects/Sigma/nanoclaw/container/skills

# CE skills to sync (the ones useful for initiative workflow)
for skill in ce-brainstorm ce-plan ce-work ce-review ce-compound brainstorming deepen-plan document-review; do
  if [ -d "$CE_DIR/$skill" ]; then
    mkdir -p "$DEST/ce-$skill"
    cp "$CE_DIR/$skill/SKILL.md" "$DEST/ce-$skill/SKILL.md"
    echo "Synced: ce-$skill"
  fi
done

# Impeccable skills to sync (design quality)
for skill in critique polish arrange typeset colorize normalize audit distill bolder quieter delight frontend-design; do
  if [ -d "$IMP_DIR/$skill" ]; then
    mkdir -p "$DEST/imp-$skill"
    cp "$IMP_DIR/$skill/SKILL.md" "$DEST/imp-$skill/SKILL.md"
    echo "Synced: imp-$skill"
  fi
done
```

## After Syncing

Rebuild the container to pick up new skills:
```bash
cd /Users/fambot/Projects/Sigma/nanoclaw
./container/build.sh
```

Then restart NanoClaw for the skills to be available to the agent.

## What Gets Synced

### From CE (initiative workflow):
- `ce-brainstorm` — explore requirements through dialogue
- `ce-plan` — transform features into structured plans
- `ce-work` — execute plans efficiently
- `ce-review` — exhaustive code review
- `ce-compound` — document solved problems
- `brainstorming` — detailed brainstorm techniques
- `deepen-plan` — enhance plans with parallel research
- `document-review` — review and refine documents

### From Impeccable (design quality):
- `critique` — holistic design evaluation
- `polish` — final quality pass
- `arrange` — layout and spacing
- `typeset` — typography improvements
- `colorize` — strategic color usage
- `normalize` — design system consistency
- `audit` — comprehensive quality audit
- `distill` — simplify designs
- `bolder` / `quieter` — adjust visual intensity
- `delight` — add personality and joy
- `frontend-design` — production-grade UI creation

## Notes

- Our custom skills (brainstorm, plan-initiative, work) are adapted versions that reference the initiatives file. The synced CE originals are kept as `ce-*` prefixed for reference.
- Plugin versions update when Claude Code updates plugins. Run this sync after plugin updates.
