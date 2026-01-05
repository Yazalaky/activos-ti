import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const baseTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6750A4' },
    secondary: { main: '#625B71' },
    error: { main: '#B3261E' },
    background: {
      default: '#FFFBFE',
      paper: '#FFFBFE',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontSize: 16,
    fontFamily: [
      'Roboto',
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Arial',
      'sans-serif',
    ].join(','),
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 24,
          border: '1px solid rgba(0,0,0,0.08)',
        },
      },
    },
  },
});

export const theme = responsiveFontSizes(baseTheme);
