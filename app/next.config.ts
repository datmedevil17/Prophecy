import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/api/actions/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, Content-Encoding, Accept-Encoding" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "node:buffer": "buffer",
      "node:crypto": "crypto",
      "node:stream": "stream",
      "node:path": "path",
      "node:fs": "fs",
      "node:os": "os",
      "node:child_process": "child_process",
      "stream/promises": "stream-browserify",
      "vm": "vm-browserify",
      "inquirer": false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
      child_process: false,
      readline: false,
      tty: false,
    };
    return config;
  },
};

export default nextConfig;
