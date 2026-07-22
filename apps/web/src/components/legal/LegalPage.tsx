import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
      <Link component={NextLink} href="/" underline="hover">MingleAI</Link>
      <Typography component="h1" variant="h3" fontWeight={800} sx={{ mt: 2, mb: 1 }}>{title}</Typography>
      <Typography color="text.secondary" sx={{ mb: 5 }}>시행일 2026년 7월 22일</Typography>
      <Box sx={{ display: "grid", gap: 4 }}>{children}</Box>
    </Container>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section">
      <Typography component="h2" variant="h5" fontWeight={700} gutterBottom>{title}</Typography>
      <Typography color="text.secondary" sx={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>{children}</Typography>
    </Box>
  );
}
