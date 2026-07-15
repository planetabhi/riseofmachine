import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: 'https://riseofmachine.com',
  // Prefetch page HTML on hover/focus so view-transition navigations feel
  // instant in production (no cold round-trip on click). Deduped + cached by
  // Astro; `hover` only fetches links the user actually points at.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [react(), partytown(
    {
      config: {
        forward: ["dataLayer.push"],
      },
    }
  ), sitemap()],

  adapter: netlify()
});