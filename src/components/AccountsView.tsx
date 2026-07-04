import React, { useState, useRef, useEffect } from "react";
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
  KeyRound,
  Loader2,
  CheckCircle2
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
  facebook: "bg-[#1877F2] border-b-4 border-[#1565C0]"
};

export default function AccountsView({
  accounts,
  onConnectAccount,
  onDisconnectAccount
}: AccountsViewProps) {
  const [showConnectPanel, setShowConnectPanel] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [connectSuccess, setConnectSuccess] = useState("");
  const [manualPlatform, setManualPlatform] = useState<SocialPlatform | null>(null);
  const [manualForm, setManualForm] = useState({
    username: "",
    displayName: "",
    externalAccountId: "",
    accessToken: "",
    avatarUrl: "",
    followerCount: "0"
  });
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState("");
  const popupRef = useRef<Window | null>(null);
  const listenerRef = useRef<((event: MessageEvent) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        window.removeEventListener("message", listenerRef.current);
        listenerRef.current = null;
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  const handleFacebookConnect = () => {
    const appId = import.meta.env.VITE_META_APP_ID || "";
    if (!appId) {
      setConnectError("VITE_META_APP_ID is not configured.");
      return;
    }

    setIsConnecting(true);
    setConnectError("");
    setConnectSuccess("");

    const redirectUri = `${window.location.origin}/oauth/callback`;
    const scopes = "pages_show_list,pages_manage_posts,pages_read_engagement";

    const oauthUrl = `https://www.facebook.com/v23.0/dialog/oauth?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=facebook_pages`;

    const messageHandler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, code, error: oauthError } = event.data || {};

      if (type === "META_OAUTH_CODE" && code) {
        try {
          const response = await fetch("/api/meta/connect-pages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirect_uri: redirectUri })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to fetch pages.");
          }

          if (!data.pages || data.pages.length === 0) {
            setConnectError(data.message || "No Facebook Pages found. Create a Facebook Page first.");
            setIsConnecting(false);
            return;
          }

          let connected = 0;
          for (const page of data.pages) {
            const alreadyConnected = accounts.some(
              (a) => a.platform === "facebook" && a.externalAccountId === page.pageId
            );
            if (alreadyConnected) continue;

            await onConnectAccount({
              platform: "facebook",
              username: page.name.toLowerCase().replace(/\s+/g, ""),
              displayName: page.name,
              avatarUrl: page.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.name)}&background=1877F2&color=fff`,
              status: "active",
              followerCount: 0,
              accessToken: page.accessToken,
              externalAccountId: page.pageId
            });
            connected++;
          }

          setConnectSuccess(`Connected ${connected} Facebook Page${connected !== 1 ? "s" : ""}.`);
          setShowConnectPanel(false);
        } catch (err: any) {
          setConnectError(err.message || "Failed to connect Facebook pages.");
        } finally {
          setIsConnecting(false);
        }

        if (listenerRef.current) {
          window.removeEventListener("message", listenerRef.current);
          listenerRef.current = null;
        }
      } else if (type === "META_OAUTH_ERROR") {
        setConnectError(oauthError || "Authorization was cancelled.");
        setIsConnecting(false);
        if (listenerRef.current) {
          window.removeEventListener("message", listenerRef.current);
          listenerRef.current = null;
        }
      }
    };

    window.addEventListener("message", messageHandler);
    listenerRef.current = messageHandler;

    const popup = window.open(
      oauthUrl,
      "MetaOAuth",
      "width=600,height=700,left=200,top=100,scrollbars=yes"
    );

    if (!popup || popup.closed) {
      setConnectError("Popup was blocked. Allow popups for this site.");
      setIsConnecting(false);
      window.removeEventListener("message", messageHandler);
      listenerRef.current = null;
      return;
    }

    popupRef.current = popup;

    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        if (listenerRef.current) {
          setConnectError("Authorization window was closed before completing.");
          setIsConnecting(false);
          window.removeEventListener("message", listenerRef.current);
          listenerRef.current = null;
        }
      }
    }, 500);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.username || !manualForm.displayName || !manualForm.externalAccountId || !manualForm.accessToken) {
      setManualError("All fields except avatar and follower count are required.");
      return;
    }

    setManualError("");
    setIsManualSubmitting(true);
    try {
      await onConnectAccount({
        platform: manualPlatform!,
        username: manualForm.username.replace("@", ""),
        displayName: manualForm.displayName,
        avatarUrl: manualForm.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(manualForm.displayName)}&background=111827&color=fff`,
        status: "active",
        followerCount: Number.parseInt(manualForm.followerCount, 10) || 0,
        accessToken: manualForm.accessToken,
        externalAccountId: manualForm.externalAccountId
      });
      setManualForm({ username: "", displayName: "", externalAccountId: "", accessToken: "", avatarUrl: "", followerCount: "0" });
      setManualPlatform(null);
      setShowConnectPanel(false);
    } catch (err: any) {
      setManualError(err.message || "Failed to save channel.");
    } finally {
      setIsManualSubmitting(false);
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
          onClick={() => { setShowConnectPanel(!showConnectPanel); setConnectError(""); setConnectSuccess(""); setManualPlatform(null); }}
          className="px-6 py-3 bg-black hover:bg-slate-800 text-white text-xs font-black tracking-widest uppercase rounded-full shadow-lg transition-all duration-200 flex items-center space-x-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showConnectPanel ? "Close" : "Connect Channel"}</span>
        </button>
      </div>

      {connectSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-600 font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{connectSuccess}</span>
        </div>
      )}

      {showConnectPanel && (
        <div className="bg-white border-2 border-slate-200/80 rounded-3xl p-8 max-w-5xl animate-fade-in space-y-6 shadow-sm">
          {!manualPlatform ? (
            <>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-xl font-black italic tracking-tight uppercase text-slate-900">Connect a Channel</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Facebook — one-click OAuth */}
                <button
                  onClick={handleFacebookConnect}
                  disabled={isConnecting}
                  className="flex items-center justify-center space-x-3 p-5 rounded-2xl border-2 border-[#1877F2]/20 bg-[#1877F2]/5 hover:bg-[#1877F2]/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <Loader2 className="w-5 h-5 text-[#1877F2] animate-spin" />
                  ) : (
                    <Facebook className="w-5 h-5 text-[#1877F2]" />
                  )}
                  <div className="text-left">
                    <span className="text-sm font-black text-slate-900 block">
                      {isConnecting ? "Connecting..." : "Connect Facebook Pages"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">One-click OAuth — auto-discovers your pages</span>
                  </div>
                </button>

                {/* Instagram — uses same Facebook pages */}
                <button
                  onClick={handleFacebookConnect}
                  disabled={isConnecting}
                  className="flex items-center justify-center space-x-3 p-5 rounded-2xl border-2 border-pink-500/20 bg-pink-500/5 hover:bg-pink-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <Loader2 className="w-5 h-5 text-pink-600 animate-spin" />
                  ) : (
                    <Instagram className="w-5 h-5 text-pink-600" />
                  )}
                  <div className="text-left">
                    <span className="text-sm font-black text-slate-900 block">
                      {isConnecting ? "Connecting..." : "Connect Instagram"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Uses Facebook Pages — requires Business account</span>
                  </div>
                </button>

                {/* Twitter — manual */}
                <button
                  onClick={() => setManualPlatform("twitter")}
                  className="flex items-center justify-center space-x-3 p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <Twitter className="w-5 h-5 text-black" />
                  <div className="text-left">
                    <span className="text-sm font-black text-slate-900 block">Connect X / Twitter</span>
                    <span className="text-[10px] text-slate-400 font-medium">Manual — paste your API bearer token</span>
                  </div>
                </button>

                {/* LinkedIn — manual */}
                <button
                  onClick={() => setManualPlatform("linkedin")}
                  className="flex items-center justify-center space-x-3 p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <Linkedin className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <span className="text-sm font-black text-slate-900 block">Connect LinkedIn</span>
                    <span className="text-[10px] text-slate-400 font-medium">Manual — paste your OAuth token</span>
                  </div>
                </button>
              </div>

              {connectError && (
                <p className="text-xs text-red-500 font-medium p-3 bg-red-50 rounded-xl">{connectError}</p>
              )}

              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Facebook and Instagram use OAuth — your access tokens are exchanged server-side and stored in your Firestore workspace. The client secret never reaches the browser.
              </p>
            </>
          ) : (
            /* Manual form for Twitter/LinkedIn */
            <form onSubmit={handleManualSubmit} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    {React.createElement(platformIcons[manualPlatform], { className: "w-4 h-4" })}
                  </div>
                  <h3 className="text-xl font-black italic tracking-tight uppercase text-slate-900">
                    Connect {manualPlatform === "twitter" ? "X / Twitter" : "LinkedIn"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setManualPlatform(null)}
                  className="text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-wider cursor-pointer"
                >
                  Back
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Platform Account ID</span>
                  <input
                    value={manualForm.externalAccountId}
                    onChange={(e) => setManualForm({ ...manualForm, externalAccountId: e.target.value })}
                    placeholder={manualPlatform === "twitter" ? "X user ID" : "URN like urn:li:person:{id}"}
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Username / Handle</span>
                  <input
                    value={manualForm.username}
                    onChange={(e) => setManualForm({ ...manualForm, username: e.target.value })}
                    placeholder="@handle"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Display Name</span>
                  <input
                    value={manualForm.displayName}
                    onChange={(e) => setManualForm({ ...manualForm, displayName: e.target.value })}
                    placeholder="Account name"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Access Token</span>
                  <input
                    type="password"
                    value={manualForm.accessToken}
                    onChange={(e) => setManualForm({ ...manualForm, accessToken: e.target.value })}
                    placeholder="Paste your API token"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Avatar URL</span>
                  <input
                    value={manualForm.avatarUrl}
                    onChange={(e) => setManualForm({ ...manualForm, avatarUrl: e.target.value })}
                    placeholder="Optional"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Follower Count</span>
                  <input
                    type="number"
                    min={0}
                    value={manualForm.followerCount}
                    onChange={(e) => setManualForm({ ...manualForm, followerCount: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </label>
              </div>

              {manualError && (
                <p className="text-xs text-red-500 font-medium p-3 bg-red-50 rounded-xl">{manualError}</p>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 tracking-widest uppercase">
                  <Lock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Stored in your Firestore workspace</span>
                </div>
                <button
                  type="submit"
                  disabled={isManualSubmitting}
                  className="px-6 py-3 bg-black hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-black tracking-widest uppercase rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {isManualSubmitting ? "Saving..." : "Save Channel"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {accounts.length === 0 ? (
          <div className="col-span-full bg-white border-2 border-dashed border-slate-200 p-16 text-center rounded-3xl shadow-sm">
            <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h4 className="text-slate-800 font-black uppercase text-xs tracking-wider">No accounts connected yet</h4>
            <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
              Click "Connect Channel" to link your Facebook Pages, Instagram, Twitter, or LinkedIn accounts.
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
