import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900",
    secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300 focus:ring-slate-300",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-200"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
