import type { Metadata } from "next";
import { Archivo_Black, Noto_Serif_KR } from "next/font/google";
import ThemeProvider from "@/components/providers/ThemeProvider";

/**
 * 랜딩의 명조 헤드라인/본문 서체. next/font가 빌드 시 자체 호스팅하므로 next.config의 CSP
 * (`font-src 'self' data:`)에 걸리지 않는다 — 구글 폰트를 <link>로 부르면 차단된다.
 */
const serif = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif",
  display: "swap",
});

/** 히어로 워드마크 전용 각진 디스플레이 서체. 본문 명조와 섞지 않는다. */
const display = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "mingles — 로테이션 블라인드 소개팅",
  description:
    "남녀 세 명씩 모이면 한 자리가 열립니다. 가면 대화 → 목소리 공개 → 얼굴 공개 순으로 돌아가며 이야기하고, 서로 골랐을 때만 채팅이 열립니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${serif.variable} ${display.variable}`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
