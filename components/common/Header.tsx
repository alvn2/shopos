import React from 'react';
import { User, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storage } from '../../services/api';

interface HeaderProps {
  title?: React.ReactNode;
  showProfile?: boolean;
}

const Header: React.FC<HeaderProps> = ({ title, showProfile = true }) => {
  const { user, logout } = useAuth();
  
  // Use SafeStorage for persistence
  const [isDark, setIsDark] = React.useState(() => {
    const saved = storage.getItem('shopos_theme');
    return saved === 'dark';
  });

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      storage.setItem('shopos_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      storage.setItem('shopos_theme', 'light');
    }
  }, [isDark]);

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 h-16 flex items-center justify-between transition-colors duration-200">
      <div className="flex-1 font-bold text-lg text-gray-900 dark:text-white truncate">
        {title || 'ShopOS'}
      </div>
      
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {showProfile && user && (
          <div className="relative group">
            <button className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 dark:text-brand-100">
                {user.full_name.charAt(0)}
              </div>
            </button>
            {/* Simple dropdown for logout */}
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 hidden group-hover:block border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                Signed in as {user.username}
              </div>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
              >
                <LogOut size={16} className="mr-2" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;