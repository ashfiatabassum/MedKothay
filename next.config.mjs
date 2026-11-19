/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache Components (on by default in the Next.js 16 template) is turned off on
  // purpose: Supabase auth reads cookies on most pages, and the classic caching
  // model is simpler for a 3-day build. See CLAUDE.md "Stack".
  // Licence photos are up to 5 MB (D2); server actions accept 1 MB by default.
  // The action still checks size and file signature itself.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
