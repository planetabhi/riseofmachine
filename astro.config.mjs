import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: 'https://riseofmachine.com',
  integrations: [react(), partytown(
    {
      config: {
        forward: ["dataLayer.push"],
      },
    }
  ), sitemap()],

  adapter: netlify()
});