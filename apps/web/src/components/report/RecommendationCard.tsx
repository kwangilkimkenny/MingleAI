"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import MessageIcon from "@mui/icons-material/Message";
import HelpIcon from "@mui/icons-material/Help";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import type { ActionRecommendation } from "@mingle/shared";
import { ACTION_TYPE_LABELS } from "@/lib/constants";

const ACTION_ICONS: Record<string, React.ReactNode> = {
  send_message: <MessageIcon color="primary" />,
  ask_question: <HelpIcon color="info" />,
  suggest_date: <FavoriteIcon color="error" />,
  learn_more: <SearchIcon color="secondary" />,
  pass: <CloseIcon color="disabled" />,
};

export default function RecommendationCard({
  recommendation,
}: {
  recommendation: ActionRecommendation;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={600} mb={2}>
          {recommendation.partnerName}에게 추천 액션
        </Typography>
        <List disablePadding>
          {recommendation.recommendedActions.map((action, i) => (
            <ListItem key={i} alignItems="flex-start" sx={{ px: 0 }}>
              <ListItemIcon sx={{ mt: 1.5 }}>
                {ACTION_ICONS[action.type] || <MessageIcon />}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={ACTION_TYPE_LABELS[action.type]}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <>
                    <Typography variant="body2" mt={0.5}>
                      {action.content}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      display="block"
                      mt={0.5}
                    >
                      {action.rationale}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}
