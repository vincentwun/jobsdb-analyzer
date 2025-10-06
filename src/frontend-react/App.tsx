// Brief: Main app router that selects pages based on window path
import React from 'react';
import { Sidebar } from './components/Sidebar';
import { IndexPage } from './pages/IndexPage';
import { ResultPage } from './pages/ResultPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { SettingPage } from './pages/SettingPage';

export const App: React.FC = () => {
  const currentPath = window.location.pathname;

  const renderPage = () => {
    if (currentPath === '/' || currentPath === '/index.html') {
      return <IndexPage />;
    } else if (currentPath === '/result.html' || currentPath.startsWith('/result')) {
      return <ResultPage />;
    } else if (currentPath === '/analysis.html' || currentPath.startsWith('/analysis')) {
      return <AnalysisPage />;
    } else if (currentPath === '/setting.html' || currentPath.startsWith('/setting')) {
      return <SettingPage />;
    } else {
      return <IndexPage />;
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        {renderPage()}
      </main>
    </div>
  );
};
