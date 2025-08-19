/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // native/binary modülleri server componentlarda harici tut
    serverComponentsExternalPackages: ["@napi-rs/canvas"]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // binary .node dosyalarını webpack'e parse ettirme
      config.externals = Array.isArray(config.externals)
        ? [...config.externals, "@napi-rs/canvas"]
        : config.externals;
    }
    return config;
  }
};

module.exports = nextConfig;


