# Contributing Guide

This project follows a fork-and-pull-request workflow for paired collaboration.

## Branching Model
- `main`: stable branch
- `feature/<name>`: new features
- `bugfix/<name>`: fixes
- `docs/<name>`: documentation updates

## Required Workflow (Paired Project)
1. One student owns the main repository.
2. Second student forks the repository.
3. Work is done in feature branches, not `main`.
4. Open pull requests from fork/feature branch to main repo `main`.
5. Main owner reviews and merges.

## Local Setup
1. Clone repository.
2. Configure backend and frontend environments from [README.md](README.md).
3. Pull latest `main` before creating new work.

## Commit Message Rules
Use meaningful commits.

Good examples:
- `Add allocation preview room-capacity validation`
- `Fix solo assignment approval status overflow`
- `Implement conflict escalation endpoint`

Avoid:
- `fixes`
- `update`
- `work done`

## Pull Request Checklist
- Explain what changed and why.
- Link related issue/task.
- Include test evidence (commands + result).
- Include screenshots for UI changes.
- Confirm no secrets were committed.

## Code Quality Expectations
- Keep changes focused and minimal.
- Add/update tests for behavior changes.
- Keep API and UI messages consistent.
- Run tests/lint before opening PR.

## Issue Tracking
Use GitHub Issues for:
- Bugs
- Feature requests
- Sprint tasks

Use labels and milestones to group work per sprint.
