# Adventure Land game repository instructions

- Keep changes limited to the active progression plan and its acceptance
  criteria. Do not expand testing into banking, mobile targeting, or unrelated
  server behavior.
- For progression work, use the Node unit and static-contract suites first.
  Do not run live combat, browser, VM, or end-to-end validation unless the
  active plan explicitly calls for it.
- The repository must not contain or restore a command that clears or replaces
  the configured game database contents. Read-only publication and map
  verification are allowed; destructive database operations are not part of the
  normal workflow.
- Test credentials and local runtime overrides belong only in the local runtime
  database or ignored environment files. Never commit them.
- Preserve pre-existing unrelated edits, including `version.js`. Keep only
  files required for the current task in scope and verify the nested
  repository boundary before editing.
