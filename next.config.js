const nextConfig = {
    distDir: process.env.NEXT_DIST_DIR || ".next",
    eslint: {
        ignoreDuringBuilds: true,
    },
    experimental: {
        optimizePackageImports: [
            "framer-motion",
            "lucide-react",
            "recharts",
            "embla-carousel-react",
            "lenis",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-toast",
            "react-hook-form",
            "zod",
            "clsx",
            "class-variance-authority",
            "tailwind-merge",
        ],
    },
    images: {
        formats: ["image/avif", "image/webp"],
        minimumCacheTTL: 604800,
        remotePatterns: [
            {
                protocol: "https",
                hostname: "images.pexels.com",
            },
            {
                protocol: "https",
                hostname: "*.supabase.co",
            },
        ],
    },
};
module.exports = nextConfig;
