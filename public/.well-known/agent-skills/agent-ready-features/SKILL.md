# Agent-Ready Features Reference

This skill documents all agent-ready features published by Rise of Machine
(https://riseofmachine.com) for automated discovery and integration.

## Well-Known Resources

| Path | Media Type | Description |
|---|---|---|
| `/.well-known/agent-skills/index.json` | `application/json` | Agent Skills discovery index (this document's parent) |
| `/.well-known/api-catalog` | `application/linkset+json` | RFC 9727 API catalog |
| `/.well-known/mcp/server-card.json` | `application/json` | MCP Server Card (SEP-1649) |
| `/llms.txt` | `text/plain` | LLM-friendly site overview |
| `/robots.txt` | `text/plain` | Crawl policy + Content Signals |
| `/sitemap-index.xml` | `application/xml` | XML sitemap index |

## Response Headers (Homepage)

The homepage (`https://riseofmachine.com/`) advertises all discovery endpoints
via RFC 8288 `Link` response headers:

```
Link: </.well-known/mcp/server-card.json>; rel="mcp-server-card",
      </.well-known/api-catalog>; rel="api-catalog",
      </llms.txt>; rel="describedby"; type="text/plain",
      </robots.txt>; rel="robots"
```

## Markdown Content Negotiation

Any page on the site supports `Accept: text/markdown` content negotiation.
When requested, the response is served as `text/markdown` with:

- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept`
- `x-markdown-tokens: {estimated token count}`
- `Content-Signal: ai-train=yes, search=yes, ai-input=yes`

## Content Signals (robots.txt)

The site declares content usage preferences per the Content Signals spec
(https://contentsignals.org/):

```
Content-Signal: ai-train=no, search=yes, ai-input=yes
```

- `search=yes` — allow indexing for search results
- `ai-input=yes` — allow RAG / grounding use
- `ai-train=no` — do not use content to train or fine-tune AI models
