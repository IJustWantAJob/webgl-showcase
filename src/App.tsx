/**
 * WebGL Showcase Playground
 *
 * An educational gallery demonstrating WebGL2 techniques.
 */

import { PlaygroundProvider } from './context/PlaygroundContext';
import { AppLayout } from './components/AppLayout';
import { getInitialDemoFromURL } from './hooks/useURLSync';
import './App.css';

function App() {
  // Get initial demo from URL query param
  const initialDemoId = getInitialDemoFromURL() || 'voronoi';

  return (
    <PlaygroundProvider initialDemoId={initialDemoId}>
      <AppLayout />
    </PlaygroundProvider>
  );
}

export default App;
