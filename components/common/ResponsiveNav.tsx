import React from 'react';
import TopNav from './TopNav';
import BottomNav from './BottomNav';

interface ResponsiveNavProps {
    children: React.ReactNode;
}

/**
 * ResponsiveNav - Shows TopNav on desktop, BottomNav on mobile
 * Wrap your page content with this component for consistent navigation
 */
const ResponsiveNav: React.FC<ResponsiveNavProps> = ({ children }) => {
    return (
        <>
            {/* Desktop Top Navigation - hidden on mobile */}
            <div className="hidden lg:block">
                <TopNav />
            </div>

            {/* Page Content - with padding for nav bars */}
            <main className="lg:pt-16 pb-20 lg:pb-0 min-h-screen">
                {children}
            </main>

            {/* Mobile Bottom Navigation - hidden on desktop */}
            <div className="lg:hidden">
                <BottomNav />
            </div>
        </>
    );
};

export default ResponsiveNav;
