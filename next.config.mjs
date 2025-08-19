// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gerekirse burada ayarlarını genişletirsin.
  // Örnek: internationalization, images, headers, vs.
  reactStrictMode: true,

  // Vercel Node runtime'ta api routes için edge'e zorlamayalım.
  // Jimp Node istiyor zaten, biz route dosyasında runtime'ı nodejs yaptık.
  experimental: {
    // future flags koyacaksan burayı kullan.
  },

  webpack: (config) => {
    // jimp bazı bundler’larda "fs" uyarısı çıkarabiliyor, client bundla girmesin:
    config.externals = config.externals || [];
    // API route server bundle’ında sorun yok. Client bundle’a yanlışlıkla girerse no-op:
    return config;
  },
};

export default nextConfig;
