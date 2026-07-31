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
