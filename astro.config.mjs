import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  site: "https://www.ellienzo.com.mx",
  output: "server",
  adapter: node({ mode: "standalone" }),
  security: {
    // Railway terminates HTTPS at its proxy; trust only this site's hosts so
    // multipart uploads retain their public origin during Astro's CSRF check.
    allowedDomains: [
      { hostname: "el-lienzo-web-production-1b2c.up.railway.app", protocol: "https" },
      { hostname: "el-lienzo-web-production.up.railway.app", protocol: "https" },
      { hostname: "ellienzo.com.mx", protocol: "https" },
      { hostname: "www.ellienzo.com.mx", protocol: "https" },
    ],
  },
  devToolbar: {
    enabled: false,
  },
  build: {
    assets: "assets",
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      cssMinify: "lightningcss",
    },
  },
});
