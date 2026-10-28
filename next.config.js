const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "gsap",
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
    // AVIF lebih kecil ~20-30% dari WebP pada foto; WebP tetap jadi fallback
    // untuk browser lama. Urutan penting: Next memilih format pertama yang
    // didukung Accept header klien.
    formats: ["image/avif", "image/webp"],
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
