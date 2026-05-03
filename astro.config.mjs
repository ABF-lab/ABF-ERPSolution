import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel/serverless";

export default defineConfig({
  site: "https://www.activebengaluru.org",
  output: "hybrid",
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  integrations: [tailwind(), mdx()],
});
