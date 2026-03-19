---
name: work
description: Execute an initiative's plan by working through its steps. Triggers on "work on this", "let's build", "execute the plan", or when an initiative is marked ready.
---

# Work on an Initiative

Execute a planned initiative by working through its steps. Requires a `[ready]` initiative with defined steps.

Adapted from Compound Engineering's ce:work pattern.

## Initiative

#$ARGUMENTS

**If empty, ask Boris:** "Which initiative should we work on?"

Then read `/workspace/extra/family-docs/sigma-app-tasks.md` and show initiatives marked `[ready]`.

## Execution Flow

### Phase 1: Load the Plan

1. Read the initiatives file
2. Find the target initiative
3. Verify it has `[ready]` tag and steps defined
4. If not ready, suggest running `/plan-initiative` first
5. Show Boris the plan and steps, confirm we're aligned

### Phase 2: Work Through Steps

For each unchecked step (`- [ ]`):

1. **Announce** what you're about to do
2. **Execute** the work (code, config, research, whatever the step requires)
3. **Verify** it worked (run tests, check output, screenshot if UI)
4. **Check off** the step by updating the initiatives file (`- [x]`)
5. **Brief Boris** on what was done and any decisions made

**Pause points:** After completing each step, ask Boris if he wants to:
- Continue to the next step
- Review what was done
- Adjust the plan
- Stop for now

### Phase 3: Completion

When all steps are checked:
1. Move the initiative from its current column to Done
2. Save the initiatives file
3. Summarize what was accomplished

## Guidelines

- **One step at a time** — don't batch
- **Check in with Boris** — he wants to understand, not just receive
- **Update the file as you go** — check off steps immediately, don't batch
- **If stuck, say so** — don't spin. Flag the blocker and discuss.
- **Write back to the initiative** — the initiatives file is the single source of truth
