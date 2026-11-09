import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ColorModeContext, createAppTheme } from './theme';
import type { PaletteMode } from '@mui/material/styles';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const COLOR_MODE_STORAGE_KEY = 'it-manager-color-mode';

const AppRoot = () => {
  const [mode, setMode] = React.useState<PaletteMode>(() => {
    try {
      return localStorage.getItem(COLOR_MODE_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const theme = React.useMemo(() => createAppTheme(mode), [mode]);
  const toggleColorMode = React.useCallback(() => {
    setMode((current) => current === 'light' ? 'dark' : 'light');
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
    } catch {
      // The theme remains usable when browser storage is unavailable.
    }
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <ColorModeContext.Provider value={{ toggleColorMode }}>
        <CssBaseline />
        <AuthProvider>
          <App />
        </AuthProvider>
      </ColorModeContext.Provider>
    </ThemeProvider>
  );
};

root.render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
