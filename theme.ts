import { createContext } from 'react';
import { createTheme, responsiveFontSizes, type PaletteMode } from '@mui/material/styles';

export const ColorModeContext = createContext({ toggleColorMode: () => {} });

export const createAppTheme = (mode: PaletteMode) => {
  const isDark = mode === 'dark';
  const baseTheme = createTheme({
    palette: {
      mode,
      primary: isDark
        ? { main: '#7EC0E8', dark: '#B6DCF3', light: '#203C50', contrastText: '#102432' }
        : { main: '#145A8D', dark: '#10466E', light: '#E8F1F7', contrastText: '#FFFFFF' },
      secondary: isDark
        ? { main: '#62C7C0', dark: '#9BE7E0', light: '#1F4444', contrastText: '#0D2929' }
        : { main: '#168C8C', dark: '#107373', light: '#E6F4F3', contrastText: '#FFFFFF' },
      success: isDark
        ? { main: '#72C77A', dark: '#A5E6A9', light: '#25472A', contrastText: '#102112' }
        : { main: '#2E7D32', dark: '#1B5E20', light: '#E8F5E9', contrastText: '#FFFFFF' },
      warning: isDark
        ? { main: '#F1B750', dark: '#FFDA8A', light: '#4A3921', contrastText: '#30200A' }
        : { main: '#A85F00', dark: '#804900', light: '#FFF3E0', contrastText: '#FFFFFF' },
      error: isDark
        ? { main: '#F17770', dark: '#FFA8A2', light: '#4B2727', contrastText: '#31100F' }
        : { main: '#B3261E', dark: '#8C1D18', light: '#FCE8E6', contrastText: '#FFFFFF' },
      info: isDark
        ? { main: '#70BDE7', dark: '#A3DAF5', light: '#203B4B', contrastText: '#102533' }
        : { main: '#1677A8', dark: '#105A80', light: '#E5F4FB', contrastText: '#FFFFFF' },
      background: isDark
        ? { default: '#111923', paper: '#18232E' }
        : { default: '#F4F6F8', paper: '#FFFFFF' },
      text: isDark
        ? { primary: '#E7EDF3', secondary: '#AAB7C4', disabled: '#798794' }
        : { primary: '#1F2937', secondary: '#667085', disabled: '#98A2B3' },
      divider: isDark ? '#344250' : '#D9E0E7',
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
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            colorScheme: mode,
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 999,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
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
            border: `1px solid ${isDark ? '#2C3B48' : '#E3E8EF'}`,
            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.16)' : '0 1px 3px rgba(16,36,56,0.04)',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 20,
            '&:last-child': { paddingBottom: 20 },
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 24,
            border: `1px solid ${isDark ? '#2C3B48' : '#E3E8EF'}`,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: isDark ? '#202B36' : '#FFFFFF',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? '#667786' : '#98A2B3',
            },
          },
          notchedOutline: {
            borderColor: isDark ? '#40505E' : '#C8D1DB',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontWeight: 700,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 700,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 900,
            backgroundColor: isDark ? '#202D38' : '#EDF2F6',
          },
          root: {
            borderBottomColor: isDark ? '#2C3B48' : '#E3E8EF',
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });

  return responsiveFontSizes(baseTheme);
};
