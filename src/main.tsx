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

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
