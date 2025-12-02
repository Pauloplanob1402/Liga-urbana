import React from 'react';
import { Home, PlusCircle, User, Users } from 'lucide-react';
import { AppScreen } from '../types';

interface NavigationProps {
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentScreen, setScreen }) => {
  const navItemClass = (screen: AppScreen) =>
    `flex flex-col items-center justify-center w-full h-full space-y-1 ${
      currentScreen === screen ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 max-w-md mx-auto">
      <div className="flex justify-around items-center h-full px-2">
        <button onClick={() => setScreen(AppScreen.FEED)} className={navItemClass(AppScreen.FEED)}>
          <Home size={24} strokeWidth={currentScreen === AppScreen.FEED ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Início</span>
        </button>
        
        <button onClick={() => setScreen(AppScreen.COMMUNITY)} className={navItemClass(AppScreen.COMMUNITY)}>
            <Users size={24} strokeWidth={currentScreen === AppScreen.COMMUNITY ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Vizinhos</span>
        </button>

        <button 
            onClick={() => setScreen(AppScreen.CREATE)} 
            className="flex flex-col items-center justify-center -mt-8"
        >
          <div className="bg-gradient-to-tr from-teal-500 to-teal-400 p-4 rounded-full shadow-lg shadow-teal-200 text-white transform transition-transform active:scale-95">
            <PlusCircle size={32} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-medium text-teal-600 mt-1">Pedir</span>
        </button>

        <button onClick={() => setScreen(AppScreen.PROFILE)} className={navItemClass(AppScreen.PROFILE)}>
          <User size={24} strokeWidth={currentScreen === AppScreen.PROFILE ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Perfil</span>
        </button>
      </div>
    </nav>
  );
};