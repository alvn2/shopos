import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Navigation */}
      <nav className="border-b-2 border-slate-700 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="font-bold text-xl tracking-widest uppercase">SHOP_OS</span>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link to="/inventory" className="px-4 py-2 bg-blue-600 text-white font-bold tracking-wider text-sm hover:bg-blue-700 transition-none">
                  ACCESS SYSTEM
                </Link>
              ) : (
                <Link to="/login" className="px-4 py-2 bg-slate-200 text-slate-900 font-bold tracking-wider text-sm hover:bg-slate-300 transition-none">
                  AUTHENTICATE
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter mb-8 leading-tight uppercase text-white">
              Inventory & Sales<br/>Management Terminal.
            </h1>
            <p className="text-xl sm:text-2xl text-slate-400 mb-10 leading-relaxed font-medium max-w-2xl">
              Strictly functional point-of-sale system. Zero fluff. Multi-tenant architecture designed for speed, reliability, and offline capability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              {isAuthenticated ? (
                <Link to="/inventory" className="inline-block px-8 py-4 bg-blue-600 text-white font-bold uppercase tracking-widest text-center hover:bg-blue-700 transition-none">
                  INITIATE SESSION
                </Link>
              ) : (
                <Link to="/login" className="inline-block px-8 py-4 bg-blue-600 text-white font-bold uppercase tracking-widest text-center hover:bg-blue-700 transition-none">
                  SYSTEM LOGIN
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="border-t-2 border-slate-700 bg-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              
              <div className="flex flex-col border-l-4 border-blue-600 pl-6">
                <h3 className="text-xl font-bold mb-3 uppercase tracking-widest text-white">Offline Engine</h3>
                <p className="text-slate-400 leading-relaxed">
                  Local cache architecture ensures operational continuity during network failures via IndexedDB synchronization.
                </p>
              </div>

              <div className="flex flex-col border-l-4 border-blue-600 pl-6">
                <h3 className="text-xl font-bold mb-3 uppercase tracking-widest text-white">Live Metrics</h3>
                <p className="text-slate-400 leading-relaxed">
                  Real-time aggregation of sales data, margin analysis, and inventory depletion alerts.
                </p>
              </div>

              <div className="flex flex-col border-l-4 border-blue-600 pl-6">
                <h3 className="text-xl font-bold mb-3 uppercase tracking-widest text-white">Multi-Tenant</h3>
                <p className="text-slate-400 leading-relaxed">
                  Isolated data partitions supporting SetupMotors and CarWorld Auto with strict role-based access control.
                </p>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-slate-700 bg-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center">
          <span className="font-bold tracking-widest uppercase mb-4 sm:mb-0 text-white">SHOP_OS</span>
          <span className="text-slate-500 font-mono text-sm">v2.0.0-PROD</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
