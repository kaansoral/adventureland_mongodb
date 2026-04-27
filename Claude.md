Rules:

- Never expose keys and passwords anywhere, load them dynamically from secretsandconfig. Never put exposed keys or key files in /agentic
- Don't remove or change features without explicit permission while refactoring, this is a live game's development server!
- Don't edit files from parent folders, only reference them
- Don't edit files from symlinked folders, unless explicit permission is given. /common is sacred.
- For agentic tasks and scripts, use the /agentic folder, keep your scripts for future repetitions / improvements. Don't clutter the main files.
- Project will be open source, if you are going to use private keys or api keys, place them in /secretsandconfig and read from there.
- Even if bypass permissions is on, be delicate, clarify your plan whenever you can and ask for permission!
- /agentic folder is for Agent scripts, you should only use this folder for the scripts you are working on. Never add one time scripts into actual code!

After task completion, if files are changed, commit your work to git

- After changing code, run `npx prettier --check .` from the `node/` directory to verify formatting. If prettier reports issues on files you changed, run `npx prettier --write <file>` to fix them before committing.
