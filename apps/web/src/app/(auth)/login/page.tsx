"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{ bgcolor: "background.default" }}
    >
      <Card sx={{ maxWidth: 420, width: "100%", mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <LoginForm />
        </CardContent>
      </Card>
    </Box>
  );
}
