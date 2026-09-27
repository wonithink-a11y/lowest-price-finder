import type { Metadata, Viewport } from "next";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

export const metadata: Metadata = {
  title: "최저가 비교",
  description: "국내 Top5 / 해외직구 Top5 단가 기준 최저가 비교",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#111827",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
