/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker(Cloud Run/Render/Railway/Fly) 배포용 최소 번들. Vercel은 이 설정과 무관하게 동작한다.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
