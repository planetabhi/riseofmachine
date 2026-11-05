# Rise of Machine

A maker sits with a small idea and a shorter afternoon, and somewhere in the noise of a thousand new tools is the one that fits the hand. Rise of Machine is the quiet room where that one is found, a directory of AI tools gathered by autonomous agents for makers and small businesses, kept at `riseofmachine.com`. The machines do the tending, and the person is left with the choosing.

Three kinds of thing are gathered here. The AI tools make up a growing directory, sorted newest first and grouped by category. The MCP servers are drawn from the official Model Context Protocol registry. The skills come from their published sources. Browse any category, open a card for its full detail and its kindred picks, search the whole catalog in a breath, and set a tool aside to return to when the need comes round again.

### API

The catalog that reads so simply in a browser is, underneath, only text waiting to be asked. A read-only JSON API serves the tools catalog at `https://riseofmachine.com/api/v1`. It needs no key and no sign-up, so the door stands open to anyone who knocks.

| Endpoint | Returns |
| --- | --- |
| `/index.json` | Version, the newest tool date, and links to the main endpoints |
| `/tools.json` | First page of tools, newest first |
| `/tools/page/{n}.json` | Later pages of tools |
| `/tools-all.json` | The full catalog in one request |
| `/tools/{slug}.json` | One tool, with its body and related tools |
| `/tools/category/{id}.json` | First page of tools in a category |
| `/tools/category/{id}/page/{n}.json` | Later pages of tools in a category |
| `/categories.json` | Every category with its ID, title, and count |
| `/search-index.json` | Compact records for search |
| `/openapi.json`, `/openapi.yaml` | The OpenAPI 3.1 specification |

List endpoints return a `data` array wrapped in the same quiet envelope each time, a `meta` with the total, the page, the count per page, and the total pages, and a `links` with self, next, previous, first, and last, so every page also carries a small map of where to go from here. Pages hold twenty-four tools. Each tool carries a title, description, links, pricing tag, category, and date added, and the full single-tool records add the body and the related picks. The `tag` field marks pricing alone, so a tool counts as open source by the plainer sign of a `githubUrl`. The shape of all of it is written down once in the OpenAPI 3.1 specification, for anyone who would rather read the contract than guess it.

### MCP server

A model remembers the world as it was on the day its memory closed, and the day moves on without it. The `ai-tool-radar-mcp` server mends that gap, turning the directory API into MCP tools so clients, Claude Desktop, Cursor, VS Code, Gemini CLI, and any MCP client, answer from the living catalog rather than from a fading recollection. It needs [Bun](https://bun.sh/) ≥ 1.2, so launch it with `bunx`.

Most clients, Claude Desktop, Cursor, and Gemini CLI, use a `mcpServers` key:

```json
{
  "mcpServers": {
    "ai-tool-radar": {
      "command": "bunx",
      "args": ["ai-tool-radar-mcp"]
    }
  }
}
```

VS Code uses a `servers` key in `.vscode/mcp.json` or your user `mcp.json`:

```json
{
  "servers": {
    "ai-tool-radar": {
      "command": "bunx",
      "args": ["ai-tool-radar-mcp"]
    }
  }
}
```

No API key. See [MCP/ai-tool-radar-mcp](./MCP/ai-tool-radar-mcp/README.md) for per-client config file locations and the full tool list.

Inside, the design is as plain as the idea. Each endpoint of the directory becomes a single MCP tool, discovered at startup from the files that describe it, so a new endpoint is only a new file and nothing more. Six tools make up the whole of it, and between them they cover the catalog end to end. One lists the tools newest first, a page of twenty-four at a time. One returns every tool in a single breath for the client that wants the whole. One fetches a tool by its slug, with its body and its related picks. One names the categories and their counts, one walks a single category, and one searches by name or feature. The server speaks over stdio, Bun-native and quiet, asking nothing of you but that the catalog be allowed to answer for itself.

### Claude Code plugin

The same turn from memory to the living moment belongs inside the editor too. The `ai-tool-radar` plugin asks the live API for tools that are real and current, rather than leaning on what the model once held. Add it in Claude Code:

```
/plugin marketplace add planetabhi/riseofmachine
/plugin install ai-tool-radar@riseofmachine
```

Then use:

- `/ai-tool-radar:new [days] [category]` lists the lately added tools grouped by category, and takes an optional window of days and a category to narrow the view.
- `/ai-tool-radar:find <need> [free] [open-source]` reads a need in plain words and returns the three to five tools that meet it, each with a single line of reason, and filters to free or open source when you ask.
- Ask Claude which tool to reach for or what is new, and the `tool-discovery` skill runs the same lookup unbidden, so the answer rises from the directory and not from memory.
