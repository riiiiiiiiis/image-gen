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
        ...config.watchOptions,
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
  // Use polling for more stable file watching
  webpackDevMiddleware: (config) => {
    config.watchOptions = {
      poll: 1000, // Check for changes every second
      aggregateTimeout: 300, // Delay rebuild after change detection
      ignored: /node_modules/,
    };
    return config;
  },
};

export default nextConfig;
