import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
// The auth SDK reads browser storage while importing. Keep startup failures
// visible instead of leaving a blank page; never clear storage to recover.
void import('./App.tsx').then(({ default: App }) => {
  root.render(<StrictMode><App /></StrictMode>);
}).catch(() => {
  root.render(<main className="wrap"><section className="card pagecard" role="alert">
    <h1>Compass could not start</h1>
    <p>Check your connection and that browser storage is available, then reload. The application may not have finished downloading. Your saved data has been left untouched.</p>
    <button type="button" className="btn" onClick={() => window.location.reload()}>Reload Compass</button>
  </section></main>);
});
