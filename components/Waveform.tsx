
import React from 'react';

interface WaveformProps {
  isActive: boolean;
  color?: string;
}

export const Waveform: React.FC<WaveformProps> = ({ isActive, color = 'bg-teal-500' }) => {
  return (
    <div className="flex items-end justify-center space-x-1 h-16 w-full max-w-xs mx-auto mb-6">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <div
          key={i}
          className={`${color} rounded-full transition-all duration-300 ${
            isActive 
              ? `animate-pulse` 
              : `h-2`
          }`}
          style={{
            width: '4px',
            height: isActive ? `${Math.random() * 100}%` : '8px',
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </div>
  );
};
