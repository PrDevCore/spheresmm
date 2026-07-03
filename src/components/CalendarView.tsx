import React from "react";
import { 
  CalendarDays, 
  Clock, 
  CheckCircle, 
  FileText, 
  Trash2, 
  Send,
  Sparkles
} from "lucide-react";
import { Post, SocialPlatform } from "../types";

interface CalendarViewProps {
  posts: Post[];
  onPublishPostNow: (postId: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onNavigateToComposer: () => void;
}

export default function CalendarView({
  posts,
  onPublishPostNow,
  onDeletePost,
  onNavigateToComposer
}: CalendarViewProps) {
  
  const scheduledPosts = posts.filter((p) => p.status === "scheduled");
  const publishedPosts = posts.filter((p) => p.status === "published");
  const draftPosts = posts.filter((p) => p.status === "draft");

  // Format date helper
  const formatDateStr = (isoString?: string) => {
    if (!isoString) return { weekday: "DAY", dayNum: "00", month: "MTH" };
    const date = new Date(isoString);
    const wday = date.toLocaleDateString([], { weekday: "short" }).toUpperCase();
    const day = date.toLocaleDateString([], { day: "2-digit" });
    const mth = date.toLocaleDateString([], { month: "short" }).toUpperCase();
    return {
      weekday: wday,
      dayNum: day,
      month: mth
    };
  };

  const formatTimeStr = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toUpperCase();
  };

  return (
    <div className="space-y-10 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h2 className="text-xs font-black tracking-[0.22em] text-slate-400 uppercase">Campaigns / Scheduling</h2>
          <h1 className="text-6xl font-black tracking-tighter mt-1 text-slate-950 uppercase">PIPELINE.</h1>
        </div>
        <button
          onClick={onNavigateToComposer}
          className="px-6 py-3 bg-black hover:bg-slate-800 text-white text-xs font-black tracking-widest uppercase rounded-full shadow-lg transition-all duration-200 cursor-pointer"
        >
          <span>Schedule Campaign</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMN 1 & 2: AUTOMATED QUEUE (TIMELINE) (lg:col-span-2) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between border-b-2 border-slate-200 pb-4">
            <h3 className="text-xl font-black italic tracking-tight uppercase text-slate-900 flex items-center">
              <Clock className="w-[22px] h-[22px] text-indigo-600 mr-2.5" />
              <span>QUEUE.AUTOMATED ({scheduledPosts.length})</span>
            </h3>
            <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">TIMELINE ORDER</span>
          </div>

          <div className="space-y-4">
            {scheduledPosts.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 p-16 text-center rounded-[2rem] shadow-sm">
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h4 className="text-slate-800 font-black uppercase text-xs tracking-wider">No scheduled campaigns</h4>
                <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Head over to the Composer view to write and configure specific schedule deployment slots.
                </p>
                <button
                  onClick={onNavigateToComposer}
                  className="mt-5 px-5 py-3 rounded-xl bg-black hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Open Composer
                </button>
              </div>
            ) : (
              // Sort scheduled posts ascending by scheduled date
              [...scheduledPosts]
                .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
                .map((post) => {
                  const { weekday, dayNum, month } = formatDateStr(post.scheduledFor);
                  return (
                    <div key={post.id} className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-6 shadow-sm hover:border-slate-300 transition-colors flex items-start space-x-5">
                      
                      {/* Big Bold Date Badge */}
                      <div className="bg-slate-100 border-2 border-slate-200/60 rounded-2xl p-3.5 text-center shrink-0 min-w-[4.5rem] flex flex-col justify-center">
                        <span className="text-[9px] font-black tracking-wider text-indigo-600 block leading-none">{weekday}</span>
                        <span className="text-2xl font-black tracking-tighter text-slate-900 block mt-1 leading-none">{dayNum}</span>
                        <span className="text-[9px] font-black tracking-wider text-slate-400 block mt-1 leading-none">{month}</span>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {post.platforms.map((plat) => {
                              const badgeColor = 
                                plat === "twitter" ? "bg-black text-white" :
                                plat === "linkedin" ? "bg-blue-600 text-white" :
                                plat === "instagram" ? "bg-pink-600 text-white" : "bg-indigo-700 text-white";
                              return (
                                <span 
                                  key={plat} 
                                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${badgeColor}`}
                                >
                                  {plat}
                                </span>
                              );
                            })}
                          </div>
                          
                          <div className="text-[10px] font-black tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md uppercase">
                            TIME: {formatTimeStr(post.scheduledFor)}
                          </div>
                        </div>

                        <p className="text-slate-700 font-bold text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-[18px]">
                          <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">SLOT ACTIVE</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => onPublishPostNow(post.id)}
                              className="px-4 py-2 rounded-xl bg-black hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Publish Now
                            </button>
                            <button
                              onClick={() => onDeletePost(post.id)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                              title="Delete Slot"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* COLUMN 3: DRAFTS & HISTORIC ARCHIVES */}
        <div className="space-y-8">
          
          {/* Draft Workspace */}
          <div className="space-y-4">
            <div className="border-b-2 border-slate-200 pb-4">
              <h3 className="text-xl font-black italic tracking-tight uppercase text-slate-900 flex items-center">
                <FileText className="w-[22px] h-[22px] text-indigo-600 mr-2.5" />
                <span>QUEUE.DRAFTS ({draftPosts.length})</span>
              </h3>
            </div>

            <div className="space-y-4">
              {draftPosts.length === 0 ? (
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider py-4 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">No drafts saved.</p>
              ) : (
                draftPosts.map((post) => (
                  <div key={post.id} className="bg-white border-2 border-slate-200/85 rounded-[2rem] p-6 shadow-sm space-y-4 text-left">
                    <p className="text-slate-700 font-bold text-xs leading-relaxed line-clamp-3">{post.content}</p>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3.5">
                      <div className="flex items-center space-x-1">
                        {post.platforms.map((p) => (
                          <span key={p} className="text-[8px] font-black uppercase tracking-wider text-indigo-600 mr-1.5">{p}</span>
                        ))}
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => onPublishPostNow(post.id)}
                          className="text-black hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest cursor-pointer"
                        >
                          Publish
                        </button>
                        <button
                          onClick={() => onDeletePost(post.id)}
                          className="text-slate-300 hover:text-red-600 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Published Archives */}
          <div className="space-y-4">
            <div className="border-b-2 border-slate-200 pb-4">
              <h3 className="text-xl font-black italic tracking-tight uppercase text-slate-900 flex items-center">
                <CheckCircle className="w-[22px] h-[22px] text-emerald-600 mr-2.5" />
                <span>ARCHIVE.HISTORIC</span>
              </h3>
            </div>

            <div className="space-y-4">
              {publishedPosts.length === 0 ? (
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider py-4 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">No published logs.</p>
              ) : (
                publishedPosts.slice(0, 4).map((post) => {
                  const { weekday, dayNum, month } = formatDateStr(post.publishedAt || post.createdAt);
                  return (
                    <div key={post.id} className="bg-white border-2 border-slate-200/60 rounded-[2rem] p-5 shadow-sm space-y-3 text-left opacity-80 hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">DATE: {month} {dayNum}</span>
                        <span className="inline-flex items-center text-[8px] font-black tracking-widest text-emerald-500 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                          PUBLISHED
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium text-xs leading-relaxed line-clamp-2">{post.content}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
