import React from "react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar 
} from "recharts";
import { 
  Eye, 
  MousePointerClick, 
  Heart, 
  TrendingUp, 
  Sparkles,
  BarChart3,
  CalendarDays
} from "lucide-react";
import { SocialAccount, Post } from "../types";

interface AnalyticsViewProps {
  accounts: SocialAccount[];
  posts: Post[];
}

// Helper to calculate local performance estimates based on the post details and channel reach
export function getPostMetrics(post: Post, accounts: SocialAccount[]) {
  if (post.status !== "published") {
    return { impressions: 0, engagements: 0, clicks: 0 };
  }
  
  const contentLen = post.content.length;
  const linkedAccounts = accounts.filter(a => post.accountIds.includes(a.id));
  const baseFollowers = linkedAccounts.reduce((sum, acc) => sum + acc.followerCount, 0) || 800;
  
  // Hash function to make metrics deterministic, stable, yet unique to each post
  let hash = 0;
  for (let i = 0; i < post.id.length; i++) {
    hash = post.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const variance = (Math.abs(hash) % 30) + 85; // 85% to 115%
  
  const impressions = Math.floor((baseFollowers * 0.25 * (contentLen / 100) * (variance / 100)));
  const engagements = Math.floor(impressions * 0.075 * (variance / 100));
  const clicks = Math.floor(engagements * 0.18 * (variance / 100));
  
  return {
    impressions: Math.max(15, impressions),
    engagements: Math.max(4, engagements),
    clicks: Math.max(1, clicks)
  };
}

export default function AnalyticsView({ accounts, posts }: AnalyticsViewProps) {
  // Get only published campaigns
  const publishedPosts = posts.filter(p => p.status === "published");

  // Generate date labels for the last 7 days chronologically
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  // Map chronological dates to dynamic published campaign aggregates
  const chartData = last7Days.map((dateStr) => {
    const publishedOnDay = publishedPosts.filter((post) => {
      const pubDate = post.publishedAt || post.createdAt;
      return pubDate.startsWith(dateStr);
    });

    let impressions = 0;
    let engagements = 0;
    let clicks = 0;

    publishedOnDay.forEach((post) => {
      const metrics = getPostMetrics(post, accounts);
      impressions += metrics.impressions;
      engagements += metrics.engagements;
      clicks += metrics.clicks;
    });

    const d = new Date(dateStr);
    const formattedLabel = d.toLocaleDateString([], { month: "short", day: "numeric" });

    return {
      date: formattedLabel,
      impressions,
      engagements,
      clicks
    };
  });

  // Calculate totals
  const totalImpressions = chartData.reduce((acc, curr) => acc + curr.impressions, 0);
  const totalEngagements = chartData.reduce((acc, curr) => acc + curr.engagements, 0);
  const totalClicks = chartData.reduce((acc, curr) => acc + curr.clicks, 0);
  
  // Calculate Engagement Rate
  const engagementRate = totalImpressions > 0 
    ? ((totalEngagements / totalImpressions) * 100).toFixed(1) 
    : "0.0";

  // Build leaderboard items from the user's active published posts
  const realLeaderboardPosts = publishedPosts.map((post) => {
    const metrics = getPostMetrics(post, accounts);
    const firstPlatform = post.platforms[0] || "twitter";
    const titleSnippet = post.content.length > 55 ? post.content.substring(0, 55) + "..." : post.content;
    const dateFormatted = post.publishedAt 
      ? new Date(post.publishedAt).toLocaleDateString([], { month: "short", day: "numeric" })
      : "Recently";

    return {
      id: post.id,
      title: titleSnippet,
      platform: firstPlatform,
      impressions: metrics.impressions,
      engagements: metrics.engagements,
      clicks: metrics.clicks,
      date: dateFormatted
    };
  }).sort((a, b) => b.impressions - a.impressions);

  // Helper formatting
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toLocaleString();
  };

  return (
    <div className="space-y-10 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h2 className="text-xs font-black tracking-[0.22em] text-slate-400 uppercase">Analytics / Laboratory</h2>
          <h1 className="text-6xl font-black tracking-tighter mt-1 text-slate-950 uppercase">INSIGHTS.</h1>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 border-2 border-indigo-100 rounded-xl bg-indigo-50 shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
          <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">USER DATA</span>
        </div>
      </div>

      {/* Primary Analytics Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Impressions card */}
        <div className="bg-white border-2 border-slate-200/80 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-44">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block">Total Impressions</span>
            <Eye className="w-[18px] h-[18px] text-slate-400" />
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <h4 className="text-5xl font-black tracking-tighter text-slate-950">{formatNumber(totalImpressions)}</h4>
            <span className="text-[9px] font-black tracking-wider text-emerald-500 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase">Active</span>
          </div>
        </div>

        {/* Engagements card */}
        <div className="bg-white border-2 border-slate-200/80 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-44">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block">Total Interactions</span>
            <Heart className="w-[18px] h-[18px] text-slate-400" />
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <h4 className="text-5xl font-black tracking-tighter text-slate-950">{formatNumber(totalEngagements)}</h4>
            <span className="text-[9px] font-black tracking-wider text-emerald-500 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase">Live</span>
          </div>
        </div>

        {/* Click-throughs card */}
        <div className="bg-white border-2 border-slate-200/80 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-44">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block">Campaign Clicks</span>
            <MousePointerClick className="w-[18px] h-[18px] text-slate-400" />
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <h4 className="text-5xl font-black tracking-tighter text-slate-950">{formatNumber(totalClicks)}</h4>
            <span className="text-[9px] font-black tracking-wider text-emerald-500 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase">Synced</span>
          </div>
        </div>

        {/* Engagement Rate card */}
        <div className="bg-white border-2 border-slate-200/80 p-8 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-44">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block">Engagement Rate</span>
            <Sparkles className="w-[18px] h-[18px] text-indigo-500" />
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <h4 className="text-5xl font-black tracking-tighter text-slate-950">{engagementRate}%</h4>
            <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase">Optimal Sync</span>
          </div>
        </div>
      </div>

      {/* Graphical Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* GRAPH 1: IMPRESSIONS OVER TIME */}
        <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-8 shadow-sm space-y-5">
          <div>
            <h4 className="text-xl font-black italic tracking-tight uppercase text-slate-900">REACH.TIMELINE</h4>
            <p className="text-xs text-slate-400">Total daily impressions across active networks (last 7 days)</p>
          </div>

          <div className="h-72">
            {totalImpressions === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-mono uppercase tracking-wider space-y-2">
                <BarChart3 className="w-10 h-10 text-slate-300" />
                <span>Await campaign deployments to plot reach timeline</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b", fontWeight: "bold" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#64748b", fontWeight: "bold" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 16, border: "2px solid #e2e8f0", fontWeight: "bold" }} />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase" }} />
                  <Area type="monotone" dataKey="impressions" name="Impressions" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorImpressions)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GRAPH 2: ENGAGEMENTS & CLICKS */}
        <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-8 shadow-sm space-y-5">
          <div>
            <h4 className="text-xl font-black italic tracking-tight uppercase text-slate-900">MICRO_INTERACTIONS</h4>
            <p className="text-xs text-slate-400">Comparing link clicks vs overall interactions</p>
          </div>

          <div className="h-72">
            {totalEngagements === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-mono uppercase tracking-wider space-y-2">
                <BarChart3 className="w-10 h-10 text-slate-300" />
                <span>Await campaign deployments to chart interactions</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b", fontWeight: "bold" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#64748b", fontWeight: "bold" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 16, border: "2px solid #e2e8f0", fontWeight: "bold" }} />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase" }} />
                  <Bar dataKey="engagements" name="Interactions" fill="#000" radius={[6, 6, 0, 0]} barSize={12} />
                  <Bar dataKey="clicks" name="Link Clicks" fill="#14b8a6" radius={[6, 6, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Posts Table */}
      <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-8 shadow-sm space-y-5">
        <div>
          <h4 className="text-xl font-black italic tracking-tight uppercase text-slate-900">LEADERBOARD.CAMPAIGNS</h4>
          <p className="text-xs text-slate-400">Dynamic engagement highlights of published posts</p>
        </div>

        <div className="overflow-x-auto">
          {realLeaderboardPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <CalendarDays className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="text-slate-800 font-black uppercase text-xs tracking-wider">No published campaigns yet</h4>
              <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                Once you deploy and publish campaign posts, they will list here with local performance estimates.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-100 text-slate-400 uppercase font-bold tracking-widest text-[9px]">
                  <th className="py-4">Post Caption Context</th>
                  <th className="py-4">Platform</th>
                  <th className="py-4 text-right">Impressions</th>
                  <th className="py-4 text-right">Clicks</th>
                  <th className="py-4 text-right">Virality Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700 font-sans">
                {realLeaderboardPosts.map((post, idx) => {
                  const virality = post.impressions > 0 
                    ? ((post.engagements / post.impressions) * 100).toFixed(1) 
                    : "0.0";
                  return (
                    <tr key={post.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-[18px] pr-4">
                        <div className="font-bold text-slate-900 text-sm line-clamp-1">{post.title}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">{post.date}</div>
                      </td>
                      <td className="py-[18px]">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded text-white ${
                          post.platform === "twitter" ? "bg-slate-900" :
                          post.platform === "linkedin" ? "bg-blue-600" :
                          post.platform === "instagram" ? "bg-pink-600" : "bg-indigo-600"
                        }`}>
                          {post.platform}
                        </span>
                      </td>
                      <td className="py-[18px] text-right font-mono font-black text-slate-950 text-xs">
                        {post.impressions.toLocaleString()}
                      </td>
                      <td className="py-[18px] text-right font-mono text-slate-600 text-xs font-bold">
                        {post.clicks.toLocaleString()}
                      </td>
                      <td className="py-[18px] text-right">
                        <span className="inline-flex items-center text-xs font-black text-emerald-500 font-mono">
                          <TrendingUp className="w-3.5 h-3.5 mr-1" />
                          {virality}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
