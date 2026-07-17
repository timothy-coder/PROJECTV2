/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: [
    "mysql2",
    "bcryptjs",
    "jsonwebtoken",
    "pdfkit",
    "puppeteer",
    "exceljs",
    "xlsx",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@hugeicons/react"],
  },
};

export default nextConfig;
