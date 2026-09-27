import type { Config } from "tailwindcss";

// 색은 globals.css의 CSS 변수(라이트/다크)를 가리킨다. 다크 모드는 변수 값만 바뀐다.
const token = (name: string) => `var(--${name})`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: Object.fromEntries(
        [
          "bg", "surface", "surface-2", "ink", "sub", "faint", "line", "chip",
          "accent", "accent-soft", "on-accent", "price",
          "good", "good-soft", "warn", "warn-soft", "danger", "danger-soft",
        ].map((n) => [n, token(n)])
      ),
      fontFamily: {
        sans: ['"IBM Plex Sans KR"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', "system-ui", "sans-serif"],
      },
      boxShadow: { card: token("shadow") },
    },
  },
  plugins: [],
};
export default config;
