// next.config.js  (ESM sürüm)
 /** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
