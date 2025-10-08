// Summary: Return a clean current URL path and update when the browser history changes.
import { useEffect, useState } from 'react';

// useLocation: returns the current pathname without a trailing slash and updates on popstate
export function useLocation(): string {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  return path.replace(/\/$/, '') || '/';
}
