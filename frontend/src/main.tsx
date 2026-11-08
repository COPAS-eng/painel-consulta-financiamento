import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootEl = document.getElementById('root')!;
window.addEventListener('error', (e) => {
  rootEl.innerHTML = '<pre style="padding:16px;color:#b91c1c;white-space:pre-wrap">' + (e?.message || e) + '</pre>';
});
window.addEventListener('unhandledrejection', (e) => {
  rootEl.innerHTML = '<pre style="padding:16px;color:#b91c1c;white-space:pre-wrap">' + String(e?.reason) + '</pre>';
});
try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster position="top-right" />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
} catch (err) {
  rootEl.innerHTML = '<pre style="padding:16px;color:#b91c1c">' + String(err) + '</pre>';
}