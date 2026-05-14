# cadlens-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the [CADLens](https://cadlens.co) REST API so MCP-aware LLM clients (Claude Desktop, Claude Code, Continue, Zed) can parse CAD files (`.dwg`, `.dxf`, `.dwf`, `.dwfx`, `.dgn` V7, `.pdf`, max 100 MB) and reason over the extracted entity / layer / metadata payloads.

## Quick start

```bash
npm install
npm run build

export CADLENS_API_KEY="cadl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# Optional — defaults to https://api.cadlens.co/v1
export CADLENS_API_BASE="https://api.cadlens.co/v1"

node dist/index.js
```

Create an API key in the CADLens dashboard — the MCP server does not (and cannot) create keys.

## Claude Code wiring

```bash
claude mcp add cadlens \
  --env CADLENS_API_KEY=cadl_xxx \
  --env CADLENS_API_BASE=https://api.cadlens.co/v1 \
  -- node /absolute/path/to/cadlens-mcp/dist/index.js
```

## Claude Desktop wiring

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "cadlens": {
      "command": "node",
      "args": ["/absolute/path/to/cadlens-mcp/dist/index.js"],
      "env": {
        "CADLENS_API_BASE": "https://api.cadlens.co/v1",
        "CADLENS_API_KEY": "cadl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `cadlens_parse_file` | Upload a local CAD file, poll until parsed (5 min budget), return summary. |
| `cadlens_parse_url` | Download a CAD file from a URL, then parse it like `parse_file`. |
| `cadlens_get_job` | Cheap status check (`PENDING` / `PROCESSING` / `COMPLETED` / `FAILED`). |
| `cadlens_get_result` | Fetch parsed content. `mode`: `summary` (default), `entities_by_type`, `entities_on_layer`, `full`. |
| `cadlens_refresh_image_url` | Re-fetch the 1h presigned PNG URL without re-downloading the full result. |
| `cadlens_list_jobs` | The 100 most recent jobs for the configured API key. |
| `cadlens_delete_job` | Delete a job and its S3 artifacts. Irreversible. |

## Configuration

| Env var | Required | Default | Notes |
|---|---|---|---|
| `CADLENS_API_KEY` | yes | — | Created in the CADLens dashboard. |
| `CADLENS_API_BASE` | no | `https://api.cadlens.co/v1` | Set to `http://localhost:3001/v1` for local dev. |
| `WEBHOOK_PORT` | no | `0` (random) | Port for the in-process webhook receiver. |
| `WEBHOOK_PUBLIC_URL` | no | unset | Set to a tunnel URL (ngrok/cloudflared) to let CADLens hit the local receiver. When set, parse calls auto-register the webhook and the poller short-circuits on receipt. |
| `REQUEST_TIMEOUT_MS` | no | `30000` | Per-HTTP-request timeout for CADLens calls. |

## Webhook short-circuit (optional)

If `WEBHOOK_PUBLIC_URL` is set, `parse_file` / `parse_url` register a per-process webhook URL alongside the upload. The webhook handler updates an in-memory job-state cache; the poller checks that cache before each HTTP GET and returns early when `COMPLETED` / `FAILED` arrives. This trims worst-case latency by up to one full poll tick (~1 s) without changing the tool surface.

Example tunnel setup:

```bash
cloudflared tunnel --url http://localhost:8787 &
export WEBHOOK_PORT=8787
export WEBHOOK_PUBLIC_URL="https://<your-tunnel>.trycloudflare.com"
```

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run smoke   # tools/list smoke test against built binary
```

## Project-scoped Claude agents

This repo ships five agents under `.claude/agents/`:

- `cadlens-api-debugger` — diagnoses unexplained CADLens 4xx/5xx using `mcp-server-reference.md`.
- `mcp-tool-tester` — drives JSON-RPC against the built server to validate tool responses.
- `mcp-tool-implementer` — scaffolds new tools following the existing `src/tools/*` pattern.
- `cad-drawing-summarizer` — uses the MCP tools to summarize a CAD file in natural language.
- `cad-layer-inspector` — drills into a single layer of a parsed drawing.

## License

MIT
