// Brief: Hook returning normalized current window path and updates on history changes
import { useEffect, useState } from 'react';

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
