
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

/**
 * PRODUCTION SHIM
 * Browsers do not have 'process.env'. We initialize it here to prevent ReferenceErrors
 * when the Gemini SDK or other modules attempt to access environment variables.
 */
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
  // In production builds, build tools usually inject variables here.
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Critical Error: Root element '#root' not found in DOM.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Application failed to mount:", err);
    
    // Provide a visual fallback instead of a blank page
    rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center; padding: 40px; background-color: #f8fafc;">
        <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
        <h1 style="color: #0f172a; margin-bottom: 12px; font-weight: 800;">စနစ် အမှားအယွင်း ရှိနေပါသည်</h1>
        <p style="color: #64748b; font-size: 18px; max-width: 400px; line-height: 1.6;">
          အက်ပလီကေးရှင်းကို စတင်၍ မရပါ။ ကျေးဇူးပြု၍ Browser Console ကို စစ်ဆေးပေးပါ။
          <br/><small>(Application failed to initialize in production environment)</small>
        </p>
        <button onclick="window.location.reload()" style="margin-top: 32px; padding: 12px 24px; background: #0d9488; color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
          ပြန်လည်ကြိုးစားမည် (Reload Page)
        </button>
      </div>
    `;
  }
}
