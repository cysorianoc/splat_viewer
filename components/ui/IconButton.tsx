
import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  tooltip: string;
}

export const IconButton: React.FC<IconButtonProps> = ({ children, tooltip, ...props }) => {
  return (
    <button
      {...props}
      className="relative group p-2 bg-gray-700/50 hover:bg-gray-600/80 rounded-md text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
    >
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {tooltip}
      </span>
    </button>
  );
};