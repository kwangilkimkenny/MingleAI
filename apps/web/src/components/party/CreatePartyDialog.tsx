"use client";

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import { createParty } from "@/lib/api/parties";

interface CreatePartyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (partyId: string) => void;
}

export default function CreatePartyDialog({
  open,
  onClose,
  onCreated,
}: CreatePartyDialogProps) {
  const [name, setName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [theme, setTheme] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [roundCount, setRoundCount] = useState(3);
  const [roundDuration, setRoundDuration] = useState(10);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const party = await createParty({
        name,
        scheduledAt: new Date(scheduledAt).toISOString(),
        theme: theme || undefined,
        maxParticipants,
        roundCount,
        roundDurationMinutes: roundDuration,
      });
      onCreated(party.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "파티 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>파티 만들기</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="파티 이름"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="예정 일시"
          type="datetime-local"
          required
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="테마"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="예: 여행 좋아하는 사람들"
        />
        <TextField
          label="최대 참가 인원"
          type="number"
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(Number(e.target.value))}
          slotProps={{ htmlInput: { min: 4, max: 100 } }}
        />
        <TextField
          label="라운드 수"
          type="number"
          value={roundCount}
          onChange={(e) => setRoundCount(Number(e.target.value))}
          slotProps={{ htmlInput: { min: 1, max: 10 } }}
        />
        <TextField
          label="라운드당 시간 (분)"
          type="number"
          value={roundDuration}
          onChange={(e) => setRoundDuration(Number(e.target.value))}
          slotProps={{ htmlInput: { min: 5, max: 30 } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!name || !scheduledAt || loading}
        >
          {loading ? "생성 중..." : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
