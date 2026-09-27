"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA 설치는 부가 기능이므로 등록 실패해도 앱 동작에는 영향 없음
      });
    }
  }, []);
  return null;
}
