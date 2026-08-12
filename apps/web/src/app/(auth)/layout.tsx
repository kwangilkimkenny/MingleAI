import type { Metadata } from "next";

/** 관리자 로그인은 소비자 대상 화면이 아니다 — 색인 금지. */
export const metadata: Metadata = {
  title: "mingles 운영 콘솔 로그인",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
