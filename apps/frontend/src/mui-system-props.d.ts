import "@mui/material/Stack";
import "@mui/material/Typography";
import "@mui/material/Box";
import "@mui/material/TextField";
import "@mui/material/Dialog";

declare module "@mui/material/Stack" {
  interface StackOwnProps {
    alignItems?: unknown;
    justifyContent?: unknown;
    flexWrap?: unknown;
    gap?: unknown;
    minWidth?: unknown;
    textAlign?: unknown;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyOwnProps {
    fontWeight?: unknown;
    letterSpacing?: unknown;
    lineHeight?: unknown;
    display?: unknown;
    textAlign?: unknown;
  }
}

declare module "@mui/material/Box" {
  interface BoxOwnProps {
    minWidth?: unknown;
  }
}

declare module "@mui/material/TextField" {
  interface BaseTextFieldProps {
    inputProps?: unknown;
  }
}

declare module "@mui/material/Dialog" {
  interface DialogProps {
    PaperProps?: unknown;
  }
}
