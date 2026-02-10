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
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import LinearProgress from "@mui/material/LinearProgress";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import TimerIcon from "@mui/icons-material/Timer";
import { io, type Socket } from "socket.io-client";

interface Participant {
  id: string;
  name: string;
  status: "active" | "idle" | "disconnected";
}

interface Table {
  tableId: string;
  participants: string[];
}

interface LivePartyMonitorProps {
  partyId: string;
  partyName: string;
}

export default function LivePartyMonitor({
  partyId,
  partyName,
}: LivePartyMonitorProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(
      process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001",
      {
        query: { partyId },
        transports: ["websocket"],
      },
    );

    socketInstance.on("connect", () => {
      setConnected(true);
      socketInstance.emit("admin:join", { partyId });
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
    });

    socketInstance.on("party:state", (data) => {
      setParticipants(data.participants ?? []);
      setTables(data.tables ?? []);
      setCurrentRound(data.currentRound ?? 0);
      setTotalRounds(data.totalRounds ?? 3);
      setTimeRemaining(data.timeRemaining ?? 0);
    });

    socketInstance.on("participant:joined", (participant) => {
      setParticipants((prev) => [...prev, participant]);
    });

    socketInstance.on("participant:left", ({ participantId }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    });

    socketInstance.on("round:started", (data) => {
      setCurrentRound(data.round);
      setTables(data.tables);
      setTimeRemaining(data.duration);
    });

    socketInstance.on("timer:tick", (seconds) => {
      setTimeRemaining(seconds);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [partyId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getParticipantById = (id: string) =>
    participants.find((p) => p.id === id);

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={600}>
          {partyName} - 실시간 모니터링
        </Typography>
        <Chip
          label={connected ? "연결됨" : "연결 끊김"}
          color={connected ? "success" : "error"}
          size="small"
        />
      </Box>

      {/* 상태 요약 */}
      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <PersonIcon color="primary" />
                <Typography variant="h4">{participants.length}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                참가자
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <GroupsIcon color="primary" />
                <Typography variant="h4">{tables.length}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                테이블
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h4">
                {currentRound}/{totalRounds}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                현재 라운드
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <TimerIcon color="primary" />
                <Typography variant="h4">{formatTime(timeRemaining)}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                남은 시간
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(timeRemaining / 600) * 100}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 테이블 현황 */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title="테이블 현황" />
            <CardContent>
              {tables.length === 0 ? (
                <Typography color="text.secondary" textAlign="center">
                  아직 테이블이 배정되지 않았습니다
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {tables.map((table, index) => (
                    <Grid key={table.tableId} size={{ xs: 6 }}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            테이블 {index + 1}
                          </Typography>
                          {table.participants.map((pId) => {
                            const p = getParticipantById(pId);
                            return (
                              <Chip
                                key={pId}
                                label={p?.name ?? "Unknown"}
                                size="small"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            );
                          })}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title="참가자 목록" />
            <CardContent sx={{ maxHeight: 400, overflow: "auto" }}>
              <List dense>
                {participants.map((participant) => (
                  <ListItem key={participant.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <PersonIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={participant.name}
                      secondary={participant.status}
                    />
                    <Chip
                      label={participant.status}
                      size="small"
                      color={
                        participant.status === "active"
                          ? "success"
                          : participant.status === "idle"
                            ? "warning"
                            : "error"
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
