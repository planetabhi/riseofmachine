/**
 * Markdown content negotiation edge function (RFC 9110 / llmstxt.org)
 *
 * When a request includes `Accept: text/markdown`, this function returns
 * the markdown representation of the requested page instead of HTML.
 * For the homepage we serve the pre-built /llms.txt which is already a
 * well-formed, LLM-friendly markdown document describing the whole site.
 *
 * Response headers set:
 *   Content-Type: text/markdown; charset=utf-8
 *   Vary: Accept                   (tells caches this response varies by Accept)
 *   x-markdown-tokens: <estimate>  (rough token count for agent context budgeting)
 */

// Very rough token estimator: ~4 chars per token (GPT-style BPE average).
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export default async function handler(
  request: Request
): Promise<Response | undefined> {
  const accept = request.headers.get("accept") ?? "";

  // Only intercept when the client explicitly prefers text/markdown.
  if (!accept.includes("text/markdown")) {
    // Pass through to the normal static response.
    return undefined;
  }

  const url = new URL(request.url);

  // Serve /llms.txt as the markdown representation of the homepage.
  const markdownUrl = new URL("/llms.txt", url.origin);
  const mdResponse = await fetch(markdownUrl.toString());

  if (!mdResponse.ok) {
    // Can't serve markdown — let the normal HTML response through.
    return undefined;
  }

  const markdownText = await mdResponse.text();
  const tokenCount = estimateTokens(markdownText);

  return new Response(markdownText, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "x-markdown-tokens": String(tokenCount),
      // Content Signals: allow AI training, search indexing and AI input.
      "Content-Signal": "ai-train=yes, search=yes, ai-input=yes",
      // Cache for 5 minutes — same TTL as the static HTML.
      "Cache-Control": "public, max-age=300",
    },
  });
}

export const config = {
  // Run on the homepage; extend the pattern if you want other paths covered.
  path: "/",
};
