import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, KeyRound, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);
  const userRole = user?.role || 'user';

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout(false);
    navigate('/login');
  };

  const handleChangePassword = () => {
    setOpen(false);
    navigate('/forgot-password');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-medium text-foreground leading-tight max-w-[120px] truncate">
            {user?.full_name || user?.email}
          </div>
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded-full font-medium capitalize text-[10px]",
          userRole === 'admin' ? "bg-purple-100 text-purple-700" :
          userRole === 'manager' ? "bg-blue-100 text-blue-700" :
          "bg-gray-100 text-gray-600"
        )}>
          {userRole}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-sm font-medium text-foreground truncate">{user?.full_name || 'User'}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleChangePassword}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors text-left"
          >
            <KeyRound className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-red-50 transition-colors text-left border-t border-border"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}