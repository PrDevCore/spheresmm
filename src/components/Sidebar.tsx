import React from "react";
import { 
  LayoutDashboard, 
  Share2, 
  PenSquare, 
  Calendar, 
  BarChart3, 
  Database,
  CircleDot,
  LogOut
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userId: string;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, userId, onLogout }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
    { id: "composer", name: "Composer & AI", icon: PenSquare },
    { id: "calendar", name: "Content Queue", icon: Calendar },
    { id: "analytics", name: "Analytics Lab", icon: BarChart3 },
    { id: "accounts", name: "Linked Channels", icon: Share2 }
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 text-slate-900 flex flex-col justify-between h-screen sticky top-0">
      <div>
        {/* Header/Brand Logo */}
        <div className="p-6 border-b border-slate-200 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white font-black text-xl shadow-sm">
            S.
          </div>
          <div>
            <h1 className="font-display font-black text-lg text-black tracking-tight uppercase">SphereSMM.</h1>
            <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">WORKSPACE</p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200 ${
                  isActive
                    ? "bg-black text-white shadow-lg shadow-black/10"
                    : "text-slate-500 hover:bg-slate-100 hover:text-black"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer and Logout Controls */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 cursor-pointer border border-transparent hover:border-red-100"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

        <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-indigo-50 border-2 border-indigo-100">
          <CircleDot className="w-3.5 h-3.5 text-indigo-600 animate-pulse shrink-0" />
          <span className="text-[9px] font-black tracking-wider text-indigo-600 uppercase">AUTHENTICATED</span>
        </div>
        
        <div className="px-2">
          <p className="text-[10px] text-slate-400 font-mono flex items-center uppercase tracking-wider">
            <Database className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            UID: {userId ? userId.substring(0, 12) : "NO_SESSION"}
          </p>
        </div>
      </div>
    </div>
  );
}
