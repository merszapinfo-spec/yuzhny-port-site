// @ts-check
import { defineConfig } from 'astro/config';

// BASE_PATH задаётся при сборке под GitHub Pages (например, /yuzhny-port-site).
// Для своего домена или Vercel оставляем корень.
export default defineConfig({
  site: process.env.SITE_URL || 'https://merszapinfo-spec.github.io',
  base: process.env.BASE_PATH || '/',
});
