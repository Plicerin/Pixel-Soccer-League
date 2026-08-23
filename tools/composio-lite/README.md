# composio-lite

Small Windows-native Composio helper CLI for Codex.

## Auth

Set the API key in the environment:

```powershell
$env:COMPOSIO_API_KEY="..."
```

The CLI does not accept API keys as flags, so keys do not leak into shell history or process listings.

## Commands

```powershell
composio-lite --json doctor
composio-lite --json accounts list --limit 20
composio-lite --json toolkits list --limit 20
composio-lite --json actions list --user-id default --toolkit github --limit 20
composio-lite --json actions execute --user-id default --tool GITHUB_GET_REPOS --args-json '{"owner":"ComposioHQ"}'
composio-lite --json request get /api/v3.1/connected_accounts
```

## JSON Policy

With `--json`, stdout contains JSON only. Errors use:

```json
{
  "ok": false,
  "error": {
    "message": "What failed",
    "code": "ERROR_CODE"
  }
}
```

Success uses:

```json
{
  "ok": true,
  "data": {}
}
```

Tokens are never printed. `doctor` reports only whether auth is present and where it came from.

## Safety

`actions execute` blocks tool names that look write-oriented by default. Use this CLI for read-only inspection unless the user explicitly asks for a live write and the command is extended with a deliberate write path.
