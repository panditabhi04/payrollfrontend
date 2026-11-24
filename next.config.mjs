/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `next lint` is not used (eslint 10 is incompatible with Next 14's lint runner); type-checking still runs in the build.
  eslint: { ignoreDuringBuilds: true },
  // Production builds can target a separate folder (NEXT_DIST_DIR) so a build never touches a running dev server's .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/finance_dept.aspx",
        destination: "/finance-dept",
      },
    ];
  },
};

export default nextConfig;
