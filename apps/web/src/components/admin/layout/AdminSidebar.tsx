"use client";

import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import CelebrationIcon from "@mui/icons-material/Celebration";
import ReportIcon from "@mui/icons-material/Report";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeIcon from "@mui/icons-material/Home";
import { useAuthStore } from "@/lib/store/auth";

const NAV_ITEMS = [
  { label: "대시보드", icon: <DashboardIcon />, path: "/admin" },
  { label: "사용자 관리", icon: <PeopleIcon />, path: "/admin/users" },
  { label: "파티 관리", icon: <CelebrationIcon />, path: "/admin/parties" },
  { label: "신고 관리", icon: <ReportIcon />, path: "/admin/reports" },
];

interface AdminSidebarProps {
  onClose?: () => void;
}

export default function AdminSidebar({ onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const handleNav = (path: string) => {
    router.push(path);
    onClose?.();
  };

  return (
    <Box
      sx={{
        width: 260,
        py: 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Box px={3} pb={2}>
        <Typography variant="h6" fontWeight={700} color="primary">
          MingleAI
        </Typography>
        <Typography variant="caption" color="text.secondary">
          관리자 대시보드
        </Typography>
      </Box>
      <Divider />

      <List sx={{ flexGrow: 1, pt: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.path);

          return (
            <ListItemButton
              key={item.path}
              selected={isActive}
              onClick={() => handleNav(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>

      <Divider />
      <List>
        <ListItemButton onClick={() => router.push("/dashboard")}>
          <ListItemIcon>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText primary="사용자 홈으로" />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            logout();
            router.push("/login");
          }}
        >
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="로그아웃" />
        </ListItemButton>
      </List>
    </Box>
  );
}
