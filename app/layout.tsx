import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "조달근거 — 구매 검토의 이유를 남기다",
  description:
    "구매 조건부터 비교사례, 확인 사항, 검토서까지. 근거가 연결되는 공공 구매 검토 워크스페이스.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
