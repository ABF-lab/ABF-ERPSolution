import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://www.activebengaluru.org",
  integrations: [tailwind(), mdx()],
});
