import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: 'https://riseofmachine.com',
  // Sidebar tabs are eagerly prefetched (they're always in the viewport), so
  // navigating between category pages is instant. Card links aren't prefetched
  // because clicking a card opens the inline detail panel with no navigation.
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'viewport',
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