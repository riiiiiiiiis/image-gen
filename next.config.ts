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
      {
        protocol: 'https',
        hostname: '*.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable the Next.js dev indicator completely
  devIndicators: false,
  // Fix file watching issues (only when not using Turbopack)
  webpack: (config, { dev, isServer }) => {
    // Check if Turbopack is being used
    const isTurbopack = process.env.TURBOPACK === '1' || process.argv.includes('--turbopack');
    
    if (dev && !isServer && !isTurbopack) {
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
