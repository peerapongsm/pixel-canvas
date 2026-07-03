/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/pixel-canvas",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
