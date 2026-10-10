// Compatibility shim: Ensure window.fetch has both getter and setter for extension/frame wrappers
try {
  let _f = window.fetch;
  Object.defineProperty(window, 'fetch', {
    get() {
      return _f;
    },
    set(v) {
      _f = v;
    },
    configurable: true,
    enumerable: true,
  });
} catch (_) {}

// Global error trap — surfaces the actual error to the DOM so a "blank
// page" becomes a readable error. React's default behavior is to unmount
// the tree and log to the console, which is easy to miss.
function showFatal(err: unknown): void {
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:24px;background:#0f172a;color:#fca5a5;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow:auto;z-index:99999;';
  const msg = err instanceof Error ? `${err.name}: ${err.message}\n\n${err.stack ?? ''}` : String(err);
  pre.textContent = msg;
  document.body.appendChild(pre);
}
window.addEventListener('error', (e) => showFatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(e.reason));

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  createRoot(document.getElementById('root')!).render(<App />);
} catch (err) {
  showFatal(err);
}
