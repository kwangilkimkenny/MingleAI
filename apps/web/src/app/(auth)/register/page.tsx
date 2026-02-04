"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
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
          <RegisterForm />
        </CardContent>
      </Card>
    </Box>
  );
}
