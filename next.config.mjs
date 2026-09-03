/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['node-sqlite3-wasm'],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
