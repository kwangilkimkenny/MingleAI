"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import List from "@mui/material/List";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Pagination from "@mui/material/Pagination";
import NotificationsIcon from "@mui/icons-material/Notifications";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type Notification,
} from "@/lib/api/notifications";
import NotificationItem from "@/components/notification/NotificationItem";
import { useNotificationStore } from "@/lib/store/notification";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { setUnreadCount, markAllAsRead: storeMarkAllAsRead } = useNotificationStore();

  const limit = 20;

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await getNotifications(limit, (page - 1) * limit);
      setNotifications(res.notifications);
      setTotal(res.total);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [page]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      // 전역 스토어 업데이트
      const unread = notifications.filter((n) => !n.read && n.id !== id).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      storeMarkAllAsRead();
      setUnreadCount(0);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      const notification = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notification && !notification.read) {
        const currentUnread = notifications.filter((n) => !n.read).length;
        setUnreadCount(currentUnread - 1);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={4}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} mb={1}>
            알림
          </Typography>
          <Typography variant="body1" color="text.secondary">
            총 {total}개의 알림 {unreadCount > 0 && `(읽지 않음 ${unreadCount}개)`}
          </Typography>
        </Box>
        {unreadCount > 0 && (
          <Button onClick={handleMarkAllAsRead}>모두 읽음 처리</Button>
        )}
      </Box>

      {loading ? (
        <Card>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={80} sx={{ m: 2 }} />
          ))}
        </Card>
      ) : notifications.length === 0 ? (
        <Box textAlign="center" py={8}>
          <NotificationsIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            알림이 없습니다
          </Typography>
        </Box>
      ) : (
        <>
          <Card>
            <List>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleMarkAsRead(notification.id)}
                  onDelete={() => handleDelete(notification.id)}
                />
              ))}
            </List>
          </Card>

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
