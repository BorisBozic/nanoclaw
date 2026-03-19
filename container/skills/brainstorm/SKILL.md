---
name: brainstorm
description: Explore requirements and approaches through collaborative dialogue before planning. Triggers on "brainstorm", "let's think through", "explore this idea", or when Boris asks to plan an initiative.
---

# Brainstorm an Initiative

Brainstorming answers **WHAT** to build through collaborative dialogue. It precedes `/plan-initiative`, which answers **HOW** to build it.

Adapted from Compound Engineering's ce:brainstorm pattern.

## Feature Description

#$ARGUMENTS

**If empty, ask Boris:** "What would you like to explore? Describe the feature, problem, or initiative you're thinking about."

## Execution Flow

### Phase 1: Context Gathering

1. Read the initiatives file at `/workspace/extra/family-docs/sigma-app-tasks.md`
2. Check if this relates to an existing initiative — if so, read its current plan and steps
3. Read any relevant family docs (MOC.md first, then specific files)

### Phase 2: Collaborative Dialogue

Ask Boris questions **one at a time** to understand the idea.

Guidelines:
- Prefer multiple choice when natural options exist
- Start broad (purpose, who benefits) then narrow (constraints, edge cases)
- Validate assumptions explicitly
- Ask about success criteria
- Keep it conversational — Boris is a designer, not an engineer
- Apply YAGNI — prefer simpler solutions

**Exit condition:** Continue until the idea is clear OR Boris says "proceed"

### Phase 3: Explore Approaches

Propose **2-3 concrete approaches** based on conversation.

For each approach:
- Brief description (2-3 sentences)
- Pros and cons
- When it's best suited

Lead with your recommendation and explain why.

### Phase 4: Capture the Design

Write the brainstorm outcome back into the initiative:
1. Update the initiative's description/plan text in the initiatives file
2. Add or refine steps based on what we decided
3. Save the file

### Phase 5: Handoff

Ask Boris what's next:
1. **Refine further** — keep asking questions
2. **Plan it** — run `/plan-initiative` to create implementation details
3. **Done for now** — come back later

## Important Guidelines

- **Stay focused on WHAT, not HOW** — implementation details belong in the plan
- **Ask one question at a time** — don't overwhelm
- **Apply YAGNI** — prefer simpler approaches
- **Write back to the initiative** — the initiatives file is the single source of truth
- **NEVER CODE** — just explore and document decisions
