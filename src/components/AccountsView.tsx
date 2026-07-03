import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  ShieldAlert,
  RefreshCw,
  Lock,
  KeyRound
} from "lucide-react";
import { SocialAccount, SocialPlatform } from "../types";

interface AccountsViewProps {
  accounts: SocialAccount[];
  onConnectAccount: (accountData: Omit<SocialAccount, "id" | "userId" | "createdAt">) => Promise<void>;
  onDisconnectAccount: (accountId: string) => Promise<void>;
}

const platformIcons = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook
};

const colors = {
  twitter: "bg-black border-b-4 border-slate-800",
  linkedin: "bg-blue-600 border-b-4 border-blue-800",
  instagram: "bg-pink-600 border-b-4 border-pink-800",
  facebook: "bg-indigo-600 border-b-4 border-indigo-800"
};

const platformHelp: Record<SocialPlatform, string> = {
  twitter: "Use an X OAuth 2.0 user access token with tweet.write scope. Account ID can be your X user ID.",
  linkedin: "Use a LinkedIn member or organization token. Account ID must be an author URN like urn:li:person:{id} or urn:li:organization:{id}.",
  facebook: "Use a Facebook Page access token. Account ID must be the Page ID.",
  instagram: "Use a Meta token for an Instagram Business account. Account ID must be the IG Business Account ID; publishing requires a public media URL."
};

export default function AccountsView({
  accounts,
  onConnectAccount,
  onDisconnectAccount
}: AccountsViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    platform: "twitter" as SocialPlatform,
    username: "",
    displayName: "",
    externalAccountId: "",
    accessToken: "",
    avatarUrl: "",
    followerCount: "0"
  });

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.username || !form.displayName || !form.externalAccountId || !form.accessToken) {
      setError("Username, display name, platform account ID, and access token are required.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await onConnectAccount({
        platform: form.platform,
        username: form.username.replace("@", ""),
        displayName: form.displayName,
        avatarUrl: form.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.displayName)}&background=111827&color=fff`,
        status: "active",
        followerCount: Number.parseInt(form.followerCount, 10) || 0,
        accessToken: form.accessToken,
        externalAccountId: form.externalAccountId
      });
      setForm({
        platform: "twitter",
        username: "",
        displayName: "",
        externalAccountId: "",
        accessToken: "",
        avatarUrl: "",
        followerCount: "0"
      });
      setShowAddForm(false);
    } catch (err: any) {
      console.error("Failed to connect channel:", err);
      setError(err.message || "Failed to save social channel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h2 className="text-xs font-black tracking-[0.22em] text-slate-400 uppercase">System / Connections</h2>
          <h1 className="text-6xl font-black tracking-tighter mt-1 text-slate-950 uppercase">CHANNELS.</h1>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-6 py-3 bg-black hover:bg-slate-800 text-white text-xs font-black tracking-widest uppercase rounded-full shadow-lg transition-all duration-200 flex items-center space-x-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? "Close Module" : "Connect Channel"}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 font-medium">
          {error}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white border-2 border-slate-200/80 rounded-3xl p-8 max-w-5xl animate-fade-in space-y-6 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="text-xl font-black italic tracking-tight uppercase text-slate-900">Add Real Publishing Credentials</h3>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Credentials are used for live publishing. Use platform-issued access tokens and the matching Page ID, Instagram Business Account ID, X user ID, or LinkedIn author URN.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Platform</span>
              <select
                value={form.platform}
                onChange={(e) => updateForm("platform", e.target.value as SocialPlatform)}
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="twitter">X / Twitter</option>
                <option value="linkedin">LinkedIn</option>
                <option value="facebook">Facebook Page</option>
                <option value="instagram">Instagram Business</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Platform Account ID</span>
              <input
                value={form.externalAccountId}
                onChange={(e) => updateForm("externalAccountId", e.target.value)}
                placeholder="Page ID, IG account ID, X user ID, or LinkedIn URN"
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Username / Handle</span>
              <input
                value={form.username}
                onChange={(e) => updateForm("username", e.target.value)}
                placeholder="@brand"
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Display Name</span>
              <input
                value={form.displayName}
                onChange={(e) => updateForm("displayName", e.target.value)}
                placeholder="Brand or account name"
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Access Token</span>
              <input
                type="password"
                value={form.accessToken}
                onChange={(e) => updateForm("accessToken", e.target.value)}
                placeholder="Paste the platform OAuth access token"
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Avatar URL</span>
              <input
                value={form.avatarUrl}
                onChange={(e) => updateForm("avatarUrl", e.target.value)}
                placeholder="Optional public image URL"
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Follower Count</span>
              <input
                type="number"
                min={0}
                value={form.followerCount}
                onChange={(e) => updateForm("followerCount", e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </label>
          </div>

          <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 leading-relaxed">
            {platformHelp[form.platform]}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-5 gap-4">
            <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 tracking-widest uppercase">
              <Lock className="w-3.5 h-3.5 text-indigo-500" />
              <span>Stored in your Firestore user workspace</span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-black hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-black tracking-widest uppercase rounded-xl shadow-md transition-all cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Channel"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {accounts.length === 0 ? (
          <div className="col-span-full bg-white border-2 border-dashed border-slate-200 p-16 text-center rounded-3xl shadow-sm">
            <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h4 className="text-slate-800 font-black uppercase text-xs tracking-wider">No accounts connected yet</h4>
            <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
              Add real social account credentials before composing or publishing campaigns.
            </p>
          </div>
        ) : (
          accounts.map((acc) => {
            const Icon = platformIcons[acc.platform];
            return (
              <div
                key={acc.id}
                className="bg-white border-2 border-slate-200 rounded-3xl shadow-sm hover:border-slate-300 transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div className={`p-6 ${colors[acc.platform]} text-white relative`}>
                  <div className="absolute right-4 top-4">
                    <Icon className="w-12 h-12 opacity-15" />
                  </div>

                  <div className="flex items-center space-x-4 relative z-10">
                    <img
                      src={acc.avatarUrl}
                      alt={acc.displayName}
                      className="w-12 h-12 rounded-full border-2 border-white/30 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-base font-black uppercase tracking-tight text-white">{acc.displayName}</h4>
                      <p className="text-[10px] font-mono text-white/80">@{acc.username}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-50 pb-5">
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block mb-1">Followers</span>
                      <span className="text-3xl font-black tracking-tighter text-slate-950">
                        {acc.followerCount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block mb-1.5">Status</span>
                      <span className="inline-flex items-center text-[9px] font-black tracking-widest uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    Account ID: {acc.externalAccountId}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="flex items-center font-black uppercase tracking-wider text-slate-400 text-[9px]">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                      Live Credentials
                    </span>
                    <button
                      onClick={() => onDisconnectAccount(acc.id)}
                      className="inline-flex items-center space-x-1 hover:text-red-600 transition-colors cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-400"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
