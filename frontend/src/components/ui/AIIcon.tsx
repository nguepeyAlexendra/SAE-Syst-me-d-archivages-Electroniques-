import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface AIIconProps {
  className?: string;
  status?: 'ready' | 'thinking';
  size?: number;
}

export function AIIcon({ className = '', status = 'ready', size = 20 }: AIIconProps) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <Sparkles
        style={{ width: size, height: size }}
        className="text-primary"
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <span
        className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background ${
          status === 'thinking' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
        }`}
      />
    </span>
  );
}

export function AIDropdownTrigger({ className = '', onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const navigate = useNavigate();
  const { langue } = useTranslation();
  const fr = langue === 'fr';
  const [hover, setHover] = useState(false);

  return (
    <button
      {...props}
      onClick={(e) => {
        if (onClick) onClick(e);
        else navigate('/assistant');
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`
        relative h-11 w-11 rounded-full
        bg-gradient-to-br from-primary/15 to-primary/5
        border border-primary/25
        hover:from-primary/25 hover:to-primary/10 hover:border-primary/40
        hover:shadow-lg hover:scale-105
        active:scale-[0.97]
        transition-all duration-200
        flex items-center justify-center
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
        ${className}
      `}
      aria-label={fr ? 'Assistant IA' : 'AI Assistant'}
    >
      <AIIcon size={22} />

      {hover && (
        <span
          className="absolute right-full top-1/2 -translate-y-1/2 mr-3 px-3 py-1.5 rounded-lg
            bg-card border shadow-lg text-xs font-medium whitespace-nowrap pointer-events-none z-50"
          role="tooltip"
        >
          {fr ? 'Assistant IA' : 'AI Assistant'}
          <span className="absolute left-full top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-card border-t border-r" />
        </span>
      )}
    </button>
  );
}

export default AIIcon;