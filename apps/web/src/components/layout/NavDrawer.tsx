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
import PersonIcon from "@mui/icons-material/Person";
import CelebrationIcon from "@mui/icons-material/Celebration";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ShieldIcon from "@mui/icons-material/Shield";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuthStore } from "@/lib/store/auth";

const NAV_ITEMS = [
  { label: "대시보드", icon: <DashboardIcon />, path: "/dashboard" },
  { label: "프로필", icon: <PersonIcon />, path: "/profile/create" },
  { label: "파티", icon: <CelebrationIcon />, path: "/parties" },
  { label: "리포트", icon: <AssessmentIcon />, path: "/reports" },
  { label: "데이트 코스", icon: <FavoriteIcon />, path: "/date-plans/create" },
  { label: "안전 신고", icon: <ShieldIcon />, path: "/safety/report" },
];

export default function NavDrawer({
  onClose,
}: {
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const handleNav = (path: string) => {
    router.push(path);
    onClose?.();
  };

  return (
    <Box sx={{ width: 260, py: 2 }}>
      <Box px={3} pb={2}>
        <Typography variant="h6" fontWeight={700} color="primary">
          MingleAI
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Another I
        </Typography>
      </Box>
      <Divider />
      <List>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.path}
            selected={pathname.startsWith(item.path)}
            onClick={() => handleNav(item.path)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <List>
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
