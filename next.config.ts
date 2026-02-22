import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Server-side SSH operations should not be Edge
    serverExternalPackages: ["ssh2"],
    // Allow large file uploads to pass through the middleware
    // Next.js restricts middleware bodies to 10MB by default if they are read or pass-through
    experimental: {
        middlewareClientMaxBodySize: 4000000000, // Roughly 4GB (in bytes) or use '10gb' depending on Next version? Actually, Next.js might accept 10000000000
    },
};

export default nextConfig;
