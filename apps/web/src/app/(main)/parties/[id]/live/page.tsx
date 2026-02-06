"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Party3DViewer } from "@/components/party3d";

export default function PartyLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <Box sx={{ height: "calc(100vh - 100px)", display: "flex", flexDirection: "column" }}>
      {/* 헤더 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 2,
        }}
      >
        <IconButton onClick={() => router.push(`/parties/${id}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>
          파티 생중계
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push(`/parties/${id}/results`)}
        >
          결과 보기
        </Button>
      </Box>

      {/* 3D 뷰어 */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Party3DViewer partyId={id} />
      </Box>
    </Box>
  );
}
