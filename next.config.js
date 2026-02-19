/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for Docker deployment - creates standalone build
  // output: 'standalone',
};

module.exports = nextConfig;
