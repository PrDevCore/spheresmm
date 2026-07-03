import React from "react";
import { 
  Users, 
  Clock, 
  CheckCircle, 
  Share2, 
  ArrowRight,
  TrendingUp,
  FileText,
  CalendarDays,
  Sparkles
} from "lucide-react";
import { SocialAccount, Post } from "../types";

interface DashboardViewProps {
  accounts: SocialAccount[];
  posts: Post[];
  onNavigateToComposer: () => void;
  onNavigateToAccounts: () => void;
  onNavigateToCalendar: () => void;
  onPublishPostNow: (postId: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
}

export default function DashboardView({
  accounts,
  posts,
  onNavigateToComposer,
  onNavigateToAccounts,
  onNavigateToCalendar,
  onPublishPostNow,
  onDeletePost
}: DashboardViewProps) {
  
  // Compute aggregated stats
  const totalFollowers = accounts.reduce((acc, curr) => acc + curr.followerCount, 0);
  const scheduledPosts = posts.filter(p => p.status === "scheduled");
  const publishedPosts = posts.filter(p => p.status === "published");
  const draftPosts = posts.filter(p => p.status === "draft");

  // Format numbers to short form (e.g. 1.2K, 24K)
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatTimeStr = (isoString?: string) => {
    if (!isoString) return { time: "--:--", period: "PM" };
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: true };
    const parts = date.toLocaleTimeString([], options).split(" ");
    return {
      time: parts[0] || "--:--",
      period: parts[1] || "PM"
    };
  };

  return (
    <div className="space-y-10 animate-fade-in">
      
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-xs font-black tracking-[0.22em] text-slate-400 uppercase">Dashboard / Insights</h2>
          <h1 className="text-6xl font-black tracking-tighter mt-1 text-slate-950 uppercase">PERFORMANCE.</h1>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex -space-x-2">
            {accounts.map((acc) => (
              <div 
                key={acc.id} 
                className="w-9 h-9 rounded-full border-2 border-[#F3F4F6] flex items-center justify-center text-[10px] text-white font-black italic shadow-sm"
                style={{ 
                  backgroundColor: acc.platform === "twitter" ? "#000" : 
                                   acc.platform === "linkedin" ? "#0a66c2" : 
                                   acc.platform === "instagram" ? "#e1306c" : "#6366f1"
                }}
                title={`@${acc.username}`}
              >
                {acc.platform.substring(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
          <button
            onClick={onNavigateToComposer}
            className="px-6 py-3 bg-black hover:bg-slate-800 text-white text-xs font-black tracking-widest uppercase rounded-full shadow-md transition-all duration-200 cursor-pointer"
          >
            + NEW POST
          </button>
        </div>
      </header>

      {/* Welcome Banner */}
      <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-8 flex flex-col md:flex-row md:items-center md:justify-between shadow-sm">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-600 font-black tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI.CAPTION_ORCHESTRATION</span>
          </div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">SMM COMMAND CENTER.</h2>
          <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
            Compose campaign captions with Gemini, publish through configured social channels, and manage unified scheduled queues.
          </p>
        </div>
        <div className="mt-6 md:mt-0 flex gap-3">
          <button
            onClick={onNavigateToComposer}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer"
          >
            Create Campaign
          </button>
          <button
            onClick={onNavigateToAccounts}
            className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer"
          >
            Connect Channels
          </button>
        </div>
      </div>

      {/* Statistics Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1: Total Reach */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-48">
          <div>
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase mb-2 block">Net Reach</span>
            <div className="text-6xl font-black tracking-tighter text-slate-950">{formatNumber(totalFollowers)}</div>
          </div>
          <div className="mt-4 flex items-center text-emerald-500 text-xs font-black uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            <span>+12.4% vs last week</span>
          </div>
        </div>

        {/* Stat 2: Connected Accounts */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-48">
          <div>
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase mb-2 block">Channels</span>
            <div className="text-6xl font-black tracking-tighter text-slate-950">{accounts.length.toString().padStart(2, "0")}</div>
          </div>
          <div className="mt-4 flex items-center text-slate-400 text-xs font-black uppercase tracking-wider">
            <span>optimal sync active</span>
          </div>
        </div>

        {/* Stat 3: Scheduled Queue */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-48">
          <div>
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase mb-2 block">Scheduled</span>
            <div className="text-6xl font-black tracking-tighter text-slate-950">{scheduledPosts.length.toString().padStart(2, "0")}</div>
          </div>
          <div className="mt-4 flex items-center text-amber-500 text-xs font-black uppercase tracking-wider">
            <span>Automated pipe ready</span>
          </div>
        </div>

        {/* Stat 4: Active Campaigns (standout colored card like in spec) */}
        <div className="bg-indigo-600 p-8 rounded-[2rem] shadow-lg text-white flex flex-col justify-between min-h-48">
          <div>
            <span className="text-[10px] font-black tracking-widest text-indigo-200 uppercase mb-2 block">Active Posts</span>
            <div className="text-6xl font-black tracking-tighter">{publishedPosts.length.toString().padStart(2, "0")}</div>
          </div>
          <div className="mt-4 flex items-center text-indigo-200 text-xs font-black uppercase tracking-wider">
            <span>publishing enabled</span>
          </div>
        </div>
      </section>

      {/* Bottom Section: Queue & Channels */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left: Queue Section (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-[2rem] p-8 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-black italic tracking-tight uppercase">QUEUE.NEXT</h3>
              <p className="text-xs text-slate-400">Scheduled and draft publications lined up</p>
            </div>
            <button
              onClick={onNavigateToCalendar}
              className="text-indigo-600 hover:text-indigo-700 text-xs font-black uppercase tracking-wider flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <span>View Full Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4 flex-1">
            {scheduledPosts.length === 0 && draftPosts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <CalendarDays className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-slate-800 font-black uppercase text-xs tracking-wider">No pending publications</h4>
                <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                  Compose high-conversion captions and schedule them across multiple directories.
                </p>
                <button
                  onClick={onNavigateToComposer}
                  className="mt-4 px-4 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer"
                >
                  Create First Post
                </button>
              </div>
            ) : (
              [...scheduledPosts, ...draftPosts].slice(0, 4).map((post) => {
                const isScheduled = post.status === "scheduled";
                const { time, period } = formatTimeStr(post.scheduledFor);
                
                // Color strip based on first platform
                const firstPlatform = post.platforms[0] || "twitter";
                const borderColors = {
                  twitter: "border-slate-900",
                  linkedin: "border-blue-600",
                  instagram: "border-pink-500",
                  facebook: "border-indigo-600"
                };

                return (
                  <div 
                    key={post.id} 
                    className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 rounded-2xl border-l-4 ${borderColors[firstPlatform as keyof typeof borderColors] || "border-indigo-600"} gap-4`}
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="text-xs font-black leading-none text-slate-700 shrink-0 bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-center min-w-14">
                        {isScheduled ? (
                          <>
                            {time}
                            <span className="text-[9px] text-slate-400 uppercase block mt-0.5">{period}</span>
                          </>
                        ) : (
                          <span className="text-[9px] text-indigo-600 uppercase block font-black tracking-wide">DRAFT</span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center space-x-2">
                          {post.platforms.map((plat) => {
                            const pColors = {
                              twitter: "text-slate-900",
                              linkedin: "text-blue-600",
                              instagram: "text-pink-600",
                              facebook: "text-indigo-600"
                            };
                            return (
                              <span 
                                key={plat} 
                                className={`text-[9px] font-black uppercase tracking-wider ${pColors[plat as keyof typeof pColors] || "text-indigo-600"}`}
                              >
                                {plat}
                              </span>
                            );
                          })}
                        </div>
                        <p className="font-bold text-slate-800 text-sm truncate">{post.content}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
                      <button
                        onClick={() => onPublishPostNow(post.id)}
                        className="px-3.5 py-2 rounded-xl bg-black hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Publish Now
                      </button>
                      <button
                        onClick={() => onDeletePost(post.id)}
                        className="px-3 py-2 rounded-xl bg-slate-200/50 hover:bg-red-50 text-slate-500 hover:text-red-600 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Channels & Optimization Tip (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm flex flex-col h-full justify-between">
            <div>
              <h3 className="text-xl font-black italic tracking-tight uppercase mb-6">CHANNELS.SYNCED</h3>
              
              <div className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">No channels linked</p>
                    <button
                      onClick={onNavigateToAccounts}
                      className="mt-3 text-indigo-600 hover:text-indigo-500 text-xs font-black uppercase tracking-wider"
                    >
                      Link Social Accounts
                    </button>
                  </div>
                ) : (
                  accounts.map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <img 
                          src={acc.avatarUrl} 
                          alt={acc.displayName} 
                          className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{acc.displayName}</h4>
                          <p className="text-[10px] text-slate-400 font-mono">@{acc.username}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-black text-slate-950 block">
                          {formatNumber(acc.followerCount)}
                        </span>
                        <span className="inline-flex items-center text-[8px] font-black tracking-wider text-emerald-500 uppercase">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1 inline-block animate-pulse"></span>
                          SYNCED
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick AI Tip Card inside the channels frame */}
            <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-5 space-y-2 mt-6">
              <h4 className="text-xs font-black tracking-widest text-indigo-950 uppercase flex items-center">
                <Sparkles className="w-4 h-4 text-indigo-600 mr-2" />
                OPTIMIZATION.INSIGHT
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Posts scheduled for <strong>Tuesdays 9:00 AM - 11:00 AM</strong> see an average of 14% higher engagement on professional channels like LinkedIn. Try scheduling your next draft in this golden window!
              </p>
            </div>
          </div>
        </div>

      </section>

    </div>
  );
}
