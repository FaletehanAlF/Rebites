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
    // Hanya WebP. Sebelumnya AVIF dicoba lebih dulu, dan encoder AVIF jauh
    // lebih lambat daripada WebP pada permintaan pertama sebuah gambar —
    // terasa sebagai "foto makanannya lama sekali muncul" tepat setelah penjual
    // mengunggah produk baru, lalu normal setelah refresh karena hasilnya sudah
    // tersimpan di cache optimizer. WebP didukung semua browser target dan
    // ukurannya sudah cukup kecil untuk foto makanan.
    formats: ["image/webp"],
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
