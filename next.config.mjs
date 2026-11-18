/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache Components (on by default in the Next.js 16 template) is turned off on
  // purpose: Supabase auth reads cookies on most pages, and the classic caching
  // model is simpler for a 3-day build. See CLAUDE.md "Stack".
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
