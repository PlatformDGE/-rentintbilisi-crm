# Implementation Plan — Object Registry MVP

## Goal
Implement the first object-registry workflow in the existing CRM app without replacing the current UI structure or removing existing modules.

## Scope
- Extend the existing Objects section with a real registry experience.
- Add object creation with duplicate detection before save.
- Reuse the same object-creation flow for the Make Photo From Platform path.
- Introduce a repository abstraction that can later be replaced by API-backed storage.
- Add a Telegram notifier mock and action-log support.
- Add unit tests for normalization and duplicate rules.

## Planned steps
1. Review the current data model and UI in the existing app, especially the Objects screen and property data shape.
2. Add a small repository layer that wraps the current localStorage-backed data and exposes the required methods:
   - listProperties
   - getProperty
   - createProperty
   - updateProperty
   - archiveProperty
   - findDuplicates
   - assignProperty
   - listAgentProperties
   - createTask
   - appendActionLog
3. Implement normalization helpers for:
   - phone
   - URL
   - address
   - external ID extraction
4. Build duplicate-check logic covering:
   - normalized URL
   - extracted external ID
   - cadastral code
   - normalized phone + normalized address
   - archived objects included in search
5. Add object creation flow with the requested fields and a duplicate-detection result view that shows the existing object and agent details.
6. On successful creation, set status to ASSIGNED, assign the agent, create a MAKE_PHOTO task, append an action log, and trigger a Telegram notifier mock.
7. Refactor the existing Make Photo From Platform entry point to use the same object-creation service.
8. Add unit tests for normalization and duplicate rules.
9. Verify with tests and a manual smoke test in the browser.

## Constraints
- Keep the current design style intact.
- Do not remove existing modules or replace the current local demo storage immediately.
- Do not implement Telegram Bot API in this task; use a mock notifier interface only.

## Status
- Plan created.
- No production code changes have been made yet.
