import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const TeamsSidePanel = lazy(() => import('./teams/TeamsSidePanel'));
const TeamsConfig = lazy(() => import('./teams/TeamsConfig'));

function Root() {
  const path = window.location.pathname;

  // Teams routes
  if (path.startsWith('/teams/sidepanel')) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <TeamsSidePanel />
      </Suspense>
    );
  }
  if (path.startsWith('/teams/config')) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <TeamsConfig />
      </Suspense>
    );
  }

  // Default standalone mode
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
