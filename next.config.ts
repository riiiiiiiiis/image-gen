import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pbxt.replicate.delivery',
        pathname: '/**',
      },
    ],
  },
  // Disable the Next.js dev indicator completely
  devIndicators: false,
  // Fix file watching issues
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay rebuild after change detection
        ignored: [
          '**/node_modules',
          '**/.next',
          '**/.git',
          '**/public/images', // Also ignore generated images
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
