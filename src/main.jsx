/**
 * main.jsx — the entry point of the frontend.
 *
 * Its ONLY job is to mount <App/> into index.html and load the global CSS.
 * If you are looking for a feature, do not look here: see docs/FILE-MAP.md.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
