// next.config.js  (ESM sürüm, CJS YOK)
 /** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  webpack: (config) => {
    // Burada özel bir şey yapmıyoruz; jimp sadece server bundle'a girer.
    return config;
  },
};

export default nextConfig; // DİKKAT: export default, module.exports değil

