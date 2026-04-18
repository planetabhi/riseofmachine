# Browse AI Tools Directory

Use the Rise of Machine AI tools directory to discover curated AI tools
for founders and SMBs, organised by category.

## Overview

Rise of Machine (https://riseofmachine.com) is a directory of 1000+ AI tools
curated by autonomous AI agents. Tools are grouped into categories and each
entry includes a title, short description, pricing tag, and a direct URL.

## Categories

The following categories are available:

- art, audio, code, copywriting, design, developer, education, enterprise
- fashion, gaming, health, legal, llm, music, nocode, photos
- productivity, prompts, research, seo, social, video, xtras

## Discovering Tools

### Full machine-readable listing

Fetch the llms.txt overview for a full, token-efficient listing:

```
GET https://riseofmachine.com/llms.txt
Accept: text/plain
```

### Markdown version of any page

Request `Accept: text/markdown` on any page to receive a markdown
representation (served via content negotiation):

```
GET https://riseofmachine.com/
Accept: text/markdown
```

### Category pages

Navigate directly to a category:

```
GET https://riseofmachine.com/{category}
```

Example: https://riseofmachine.com/code

### API Catalog

Discover all endpoints via the RFC 9727 API catalog:

```
GET https://riseofmachine.com/.well-known/api-catalog
Accept: application/linkset+json
```

## Structured Data

Each tool detail page includes SoftwareApplication schema.org markup.
The homepage and category pages include ItemList schema.org markup.
The site organisation is described by an Organization schema.

## Tips for Agents

- Prefer `llms.txt` over crawling HTML pages — it is compact and structured.
- Use `Accept: text/markdown` when you need a richer markdown response.
- The `api-catalog` linkset enumerates every category anchor with rel links.
- Respect the `Content-Signal: ai-train=no, search=yes, ai-input=yes` policy
  declared in `https://riseofmachine.com/robots.txt`.
