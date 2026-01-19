
import React, { ReactNode } from 'react';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeTab, setActiveTab }) => {
  const getRoleColor = (role?: UserRole) => {
    switch (role) {
      case UserRole.SUPERADMIN: return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case UserRole.ORGANIZER: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default: return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar / Mobile Nav */}
      <nav className="bg-slate-900 text-white w-full md:w-64 flex-shrink-0 flex md:flex-col justify-between md:justify-start sticky top-0 z-50 p-4 md:p-6 shadow-xl">
        <div className="md:mb-10">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">SmashPro</h1>
          </div>
          {user && (
            <div className={`inline-block px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${getRoleColor(user.role)}`}>
              {user.role}
            </div>
          )}
        </div>

        <div className="hidden md:flex flex-col space-y-2 flex-grow">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="📊" label="Dashboard" />
          <NavItem active={activeTab === 'tournaments'} onClick={() => setActiveTab('tournaments')} icon="🏆" label="Tournaments" />
          {user?.role !== UserRole.PLAYER && (
            <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon="⚙️" label="Admin Panel" />
          )}
          <NavItem active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon="👤" label="My Profile" />
        </div>

        <div className="md:mt-auto flex items-center md:flex-col md:items-start border-t border-slate-800 pt-6">
          <div className="hidden md:block mb-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logged in as</p>
            <p className="text-sm font-bold text-slate-200 truncate w-48">{user?.name}</p>
          </div>
          <button onClick={onLogout} className="text-slate-400 hover:text-white transition-colors flex items-center space-x-2 text-xs font-black uppercase tracking-widest">
            <span>Logout</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8 bg-white/50 p-4 rounded-2xl border border-slate-200 backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">{activeTab}</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-indigo-600 px-4 py-2 rounded-xl shadow-lg shadow-indigo-100 flex items-center space-x-2">
              <span className="text-white font-black">{user?.credits}</span>
              <span className="text-[9px] text-indigo-100 uppercase tracking-widest font-black">Credits</span>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Nav Overlay */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around p-3 z-50">
          <MobileIcon active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon="📊" />
          <MobileIcon active={activeTab === 'tournaments'} onClick={() => setActiveTab('tournaments')} icon="🏆" />
          {user?.role !== UserRole.PLAYER && (
            <MobileIcon active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon="⚙️" />
          )}
          <MobileIcon active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon="👤" />
      </div>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
  >
    <span className={`text-xl transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
    <span className="font-black text-xs uppercase tracking-widest">{label}</span>
  </button>
);

const MobileIcon = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`p-2 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-900' : 'text-slate-400'}`}>
    <span className="text-2xl">{icon}</span>
  </button>
);

export default Layout;
