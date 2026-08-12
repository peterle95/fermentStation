# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding operations

- **Map**: one issue labelled `wayfinder:map`, containing the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a GitHub sub-issue of the map, labelled `wayfinder:<type>` (`research`, `prototype`, `grilling`, or `task`).
- **Blocking**: use GitHub native issue dependencies where available. Otherwise put `Blocked by: #<n>` at the top of the child body.
- **Claim**: assign the ticket to the driving dev before doing work.
- **Resolve**: comment the answer, close the issue, then append a context pointer to the map's Decisions-so-far.
