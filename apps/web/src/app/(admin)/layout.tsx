import type { Metadata } from "next";
import AdminShell from "@/components/admin/layout/AdminShell";

/** 운영 콘솔은 색인 금지 — robots.ts와 이중으로 막는다. */
export const metadata: Metadata = {
  title: "mingles 운영 콘솔",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
