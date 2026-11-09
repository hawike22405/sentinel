import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import { mountRibbon } from './ribbon.js';
import { mountChecksCarousel } from './checks-carousel.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

mountRibbon(document.getElementById('ribbon'),
  ['Threat intelligence', 'Threat analysis', 'Web security', 'Certificate validation']);
mountChecksCarousel(document.getElementById('checks'));