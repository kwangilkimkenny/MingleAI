"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid2";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import LinearProgress from "@mui/material/LinearProgress";
import PersonIcon from "@mui/icons-material/Person";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import { io } from "socket.io-client";
import { useAuthStore } from "@/lib/store/auth";

interface MonitorState {
  participants: Array<{ id: string; name: string; status: "active" | "offline"; alive: boolean | null }>;
  game: { phase: string; progress: { done: number; total: number }; started: boolean };
  updatedAt: string;
}

const PHASE_LABEL: Record<string, string> = {
  lobby: "로비",
  playing: "게임 진행",
  meeting: "토론",
  voting: "투표",
  ended: "종료",
};

export default function LivePartyMonitor({ partyId, partyName }: { partyId: string; partyName: string }) {
  const token = useAuthStore((state) => state.token);
  const [state, setState] = useState<MonitorState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    const socket = io(process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000", {
      auth: { token },
      transports: ["websocket"],
    });
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("admin:party:join", { partyId });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("admin:party:state", (next: MonitorState) => setState(next));
    return () => {
      socket.disconnect();
    };
  }, [partyId, token]);

  const participants = state?.participants ?? [];
  const online = participants.filter((participant) => participant.status === "active").length;
  const progress = state?.game.progress;
  const progressValue = progress?.total ? (progress.done / progress.total) * 100 : 0;

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3} flexWrap="wrap">
        <Typography variant="h5" fontWeight={700}>{partyName} 실시간 상태</Typography>
        <Chip label={connected ? "연결됨" : "연결 끊김"} color={connected ? "success" : "error"} size="small" />
        {state ? <Typography variant="caption" color="text.secondary">최근 갱신 {new Date(state.updatedAt).toLocaleTimeString("ko-KR")}</Typography> : null}
      </Box>
      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, sm: 6 }}><Card><CardContent><Box display="flex" alignItems="center" gap={1}><PersonIcon color="primary" /><Typography variant="h4">{online}/{participants.length}</Typography></Box><Typography color="text.secondary">현재 접속 / 전체 참가자</Typography></CardContent></Card></Grid>
        <Grid size={{ xs: 12, sm: 6 }}><Card><CardContent><Box display="flex" alignItems="center" gap={1}><SportsEsportsIcon color="primary" /><Typography variant="h4">{PHASE_LABEL[state?.game.phase ?? "lobby"] ?? state?.game.phase}</Typography></Box><Typography color="text.secondary">게임 상태</Typography>{state?.game.started ? <><LinearProgress variant="determinate" value={progressValue} sx={{ mt: 2 }} /><Typography variant="caption">미션 {progress?.done}/{progress?.total}</Typography></> : null}</CardContent></Card></Grid>
      </Grid>
      <Card>
        <CardHeader title="참가자 상태" subheader="게임 역할은 개인정보와 공정성을 위해 관리자 화면에도 표시하지 않습니다." />
        <CardContent>
          <List dense>{participants.map((participant) => <ListItem key={participant.id} divider><ListItemText primary={participant.name} secondary={participant.alive === false ? "게임에서 탈락" : participant.alive === true ? "생존" : "게임 전"} /><Chip size="small" label={participant.status === "active" ? "접속" : "오프라인"} color={participant.status === "active" ? "success" : "default"} /></ListItem>)}</List>
          {participants.length === 0 ? <Typography color="text.secondary">참가자가 없습니다.</Typography> : null}
        </CardContent>
      </Card>
    </Box>
  );
}
