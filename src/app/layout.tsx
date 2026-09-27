import type { Metadata, Viewport } from "next";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

export const metadata: Metadata = {
  title: "최저가 비교",
  description: "국내 Top5 / 해외직구 Top5 단가 기준 최저가 비교",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // 아이폰 홈 화면 앱 설정 (안드로이드는 manifest.json이 담당)
  appleWebApp: { capable: true, title: "최저가비교", statusBarStyle: "default" },
  // 아이폰이 가격 숫자를 전화번호 링크로 바꾸지 않도록
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 노치·펀치홀·제스처 바 영역까지 화면을 쓰고, 여백은 safe-area로 직접 준다 (page.tsx)
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#101113" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 한글 글꼴. 빌드 시 다운로드가 필요 없는 <link> 방식 (로드 실패 시 시스템 글꼴로 대체) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap" />
      </head>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
