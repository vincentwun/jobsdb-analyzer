// Summary: Left-side navigation with app title and links
import React from 'react';
import { useLocation } from '../hooks/useLocation';

// Sidebar: shows app logo and navigation links, highlights active route
export const Sidebar: React.FC = () => {
  const currentPath = useLocation();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/result.html', label: 'Result' },
    { href: '/analysis.html', label: 'Analysis' },
    { href: '/setting.html', label: 'Settings' }
  ];

  return (
    <aside className="sidebar">
      <div className="logo">JobsDB Analyzer</div>
      <nav className="nav" role="navigation">
        {navLinks.map(link => {
          const isActive = currentPath === link.href || 
            (link.href !== '/' && currentPath.startsWith(link.href));
          
          return (
            <a
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
};
