import { alpha, createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#173B57", dark: "#0B2438", light: "#DCEAF3" },
    secondary: { main: "#0B7A75" },
    background: { default: "#F5F7F9", paper: "#FFFFFF" },
    text: { primary: "#17212B", secondary: "#5C6874" },
    success: { main: "#237A57" },
    warning: { main: "#A96900" },
    error: { main: "#B42318" }
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 720, letterSpacing: "-0.03em" },
    h5: { fontWeight: 700, letterSpacing: "-0.025em" },
    h6: { fontWeight: 680, letterSpacing: "-0.015em" },
    button: { textTransform: "none", fontWeight: 650 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { minWidth: 320 },
        "*": { boxSizing: "border-box" }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16 }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 650 }
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, backgroundColor: alpha("#173B57", 0.08) },
        bar: { borderRadius: 999 }
      }
    }
  }
});
