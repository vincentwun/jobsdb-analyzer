// Summary: Small UI block to show loading/success/error messages with color
import React from 'react';

interface StatusMessageProps {
  message: string;
  type: 'loading' | 'success' | 'error';
}

const STATUS_COLORS = {
  loading: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' }
};

// StatusMessage: renders a colored status box for quick user feedback
export const StatusMessage: React.FC<StatusMessageProps> = ({ message, type }) => {
  const color = STATUS_COLORS[type];

  return (
    <div className="status-area">
      <div
        className="status-message"
        style={{
          backgroundColor: color.bg,
          borderLeft: `4px solid ${color.border}`,
          color: color.text
        }}
      >
        {message}
      </div>
    </div>
  );
};
