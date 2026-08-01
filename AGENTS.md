<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Dev Server

Port **8000** is required (Discord OAuth callback). Start detached so the process survives shell exit:

```bash
setsid bash -c 'cd /home/johnn/cosmo-next && exec npx next dev -p 8000 >> /tmp/next-server.log 2>&1' &
```

Verify with `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000` (expect 200).
Logs: `tail -f /tmp/next-server.log`

## QA Testing with Real Data (playwright-cli + Brave)

For UI/UX testing against real data, use the `playwright-cli` skill (`playwright-cli` CLI, global install). It drives the system Brave binary (`.playwright/cli.config.json` sets `executablePath`) with a persistent QA profile.

- Real-data session (must be logged in once via Discord OAuth):
  ```bash
  playwright-cli -s=qa open http://localhost:8000 --persistent --profile=/home/johnn/cosmo-next/.qa/brave-profile --headed
  ```
- One-time manual login: `scripts/qa-brave.sh` (or complete the login in the headed window and tell the agent).
- Never use `~/.config/BraveSoftware/Brave-Browser` (the live profile) — it is locked while Brave is running.
- Artifacts (snapshots/screenshots) go to `.qa/output/` (gitignored).
- Available slash commands: `/qa-smoke-test`, `/qa-accessibility-audit`.
- App requires Discord OAuth for authenticated routes; admins are set via `ADMIN_USERNAMES` in `.env`.
