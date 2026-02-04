"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#E91E63",
      light: "#F48FB1",
      dark: "#C2185B",
    },
    secondary: {
      main: "#FF6F00",
      light: "#FFB74D",
      dark: "#E65100",
    },
    background: {
      default: "#FFF8F0",
      paper: "#FFFFFF",
    },
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Noto Sans KR"',
      "sans-serif",
    ].join(","),
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        },
      },
    },
  },
});

export default theme;
