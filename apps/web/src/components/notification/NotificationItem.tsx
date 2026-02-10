"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import DeleteIcon from "@mui/icons-material/Delete";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CelebrationIcon from "@mui/icons-material/Celebration";
import FavoriteIcon from "@mui/icons-material/Favorite";
import EventIcon from "@mui/icons-material/Event";
import InfoIcon from "@mui/icons-material/Info";
import type { Notification } from "@/lib/api/notifications";

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function NotificationItem({
  notification,
  onClick,
  onDelete,
}: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case "party_reminder":
        return <CelebrationIcon color="primary" />;
      case "match_result":
        return <FavoriteIcon color="error" />;
      case "reservation":
        return <EventIcon color="success" />;
      case "system":
        return <InfoIcon color="info" />;
      default:
        return <NotificationsIcon />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString("ko-KR");
  };

  return (
    <ListItem
      sx={{
        bgcolor: notification.read ? "transparent" : "action.hover",
        cursor: onClick ? "pointer" : "default",
        borderRadius: 1,
        "&:hover": {
          bgcolor: "action.selected",
        },
      }}
      onClick={onClick}
      secondaryAction={
        onDelete && (
          <IconButton
            edge="end"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )
      }
    >
      <ListItemIcon>{getIcon()}</ListItemIcon>
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography
              variant="body2"
              fontWeight={notification.read ? 400 : 600}
            >
              {notification.title}
            </Typography>
            {!notification.read && (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                }}
              />
            )}
          </Box>
        }
        secondary={
          <>
            <Typography variant="body2" color="text.secondary" component="span">
              {notification.message}
            </Typography>
            <Typography
              variant="caption"
              color="text.disabled"
              display="block"
              mt={0.5}
            >
              {formatDate(notification.createdAt)}
            </Typography>
          </>
        }
      />
    </ListItem>
  );
}
