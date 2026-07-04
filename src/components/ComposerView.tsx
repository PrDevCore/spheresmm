import React, { useState, useEffect, useCallback } from "react";
import { 
  Sparkles, 
  Send, 
  Calendar, 
  FileText, 
  Smile, 
  Hash, 
  Terminal, 
  RefreshCw, 
  Eye,
  CheckCircle2,
  Copy,
  Shield
} from "lucide-react";
import { SocialAccount, SocialPlatform, Post } from "../types";
import MetaOAuthButton from "./MetaOAuthButton";

interface ComposerViewProps {
  accounts: SocialAccount[];
  onCreatePost: (postData: Omit<Post, "id" | "userId" | "createdAt">) => Promise<Post>;
  onNavigateToQueue: () => void;
}

export default function ComposerView({
  accounts,
  onCreatePost,
  onNavigateToQueue
}: ComposerViewProps) {
  // Main composition state
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  
  // AI Generator Form States
  const [topic, setTopic] = useState("");
  const [aiPlatform, setAiPlatform] = useState<SocialPlatform | "all">("all");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [hashtagsCount, setHashtagsCount] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiCaptions, setAiCaptions] = useState<{ text: string; explanation: string }[]>([]);
  const [aiError, setAiError] = useState("");

  // Live publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingLogs, setPublishingLogs] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [successState, setSuccessState] = useState(false);

  // Ephemeral OAuth tokens — exist only in React state, NEVER persisted
  // These are obtained via MetaOAuthButton (authorization code flow → server exchange) and destroyed on unmount
  const [ephemeralTokens, setEphemeralTokens] = useState<Record<string, { token: string; externalAccountId?: string }>>({});

  // Set default selected accounts if accounts change
  useEffect(() => {
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      setSelectedAccountIds([accounts[0].id]);
    }
  }, [accounts]);

  // Handle platform selections derived from selected account IDs
  const getSelectedPlatforms = (): SocialPlatform[] => {
    return accounts
      .filter((a) => selectedAccountIds.includes(a.id))
      .map((a) => a.platform);
  };

  // Run AI Caption Generation
  const handleGenerateCaptions = async () => {
    if (!topic) {
      setAiError("Please provide a topic or prompt.");
      return;
    }
    setIsGenerating(true);
    setAiError("");
    setAiCaptions([]);

    try {
      const response = await fetch("/api/generate-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          platform: aiPlatform,
          tone,
          length,
          hashtagsCount
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI captions.");
      }

      if (data.captions) {
        setAiCaptions(data.captions);
      } else {
        throw new Error("Invalid output format received.");
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Something went wrong. Please ensure your Gemini API Key is configured.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle ephemeral token from MetaOAuthButton
  const handleEphemeralToken = useCallback((token: string, platform: SocialPlatform, externalAccountId?: string) => {
    setEphemeralTokens((prev) => ({
      ...prev,
      [platform]: { token, externalAccountId }
    }));
    setPublishingLogs((prev) => [...prev, `✓ ${platform.toUpperCase()} token obtained (ephemeral, in-memory only)`]);
    setShowConsole(true);
  }, []);

  // Publish through the configured provider APIs and save to Firestore after success
  const handlePublishNow = async () => {
    if (!content) return;
    if (selectedAccountIds.length === 0) {
      alert("Please select at least one social media channel.");
      return;
    }

    // Build accounts payload with ephemeral tokens from Meta OAuth,
    // falling back to stored accounts for non-Meta platforms (Twitter, LinkedIn)
    const selectedAccs = accounts.filter((a) => selectedAccountIds.includes(a.id));
    
    // For each selected account, if it's a Meta platform (facebook/instagram),
    // inject the ephemeral token instead of the stored one
    const publishAccounts = selectedAccs.map((acc) => {
      if ((acc.platform === "facebook" || acc.platform === "instagram") && ephemeralTokens[acc.platform]) {
        return {
          id: acc.id,
          platform: acc.platform,
          accessToken: ephemeralTokens[acc.platform].token,
          externalAccountId: ephemeralTokens[acc.platform].externalAccountId || acc.externalAccountId
        };
      }
      return {
        id: acc.id,
        platform: acc.platform,
        accessToken: acc.accessToken,
        externalAccountId: acc.externalAccountId
      };
    });

    setIsPublishing(true);
    setShowConsole(true);
    setSuccessState(false);
    setPublishingLogs(["Starting live publishing request..."]);

    const platforms = selectedAccs.map((a) => a.platform);

    try {
      const response = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          mediaUrl,
          accounts: publishAccounts
        })
      });

      const resData = await response.json();

      if (!response.ok && response.status !== 207) {
        throw new Error(resData.error || "Publishing request failed.");
      }

      const succeeded = resData.results?.filter((result: any) => result.success) || [];
      const failed = resData.results?.filter((result: any) => !result.success) || [];
      setPublishingLogs([
        ...succeeded.map((result: any) => `${result.platform}: published${result.providerId ? ` (${result.providerId})` : ""}`),
        ...failed.map((result: any) => `${result.platform}: failed - ${result.error}`)
      ]);

      if (failed.length > 0) {
        throw new Error("One or more platforms rejected the publish request.");
      }

      await onCreatePost({
        content,
        mediaUrl: mediaUrl || undefined,
        platforms,
        accountIds: selectedAccountIds,
        status: "published",
        publishedAt: new Date().toISOString()
      });

      setSuccessState(true);
      // Clear ephemeral tokens after successful publish (garbage collection)
      setEphemeralTokens({});
      setContent("");
      setMediaUrl("");
    } catch (error) {
      console.error(error);
      setPublishingLogs((prev) => [...prev, error instanceof Error ? error.message : "Publishing failed."]);
    } finally {
      setIsPublishing(false);
    }
  };

  // Schedule Post for later
  const handleSchedulePost = async () => {
    if (!content) return;
    if (!scheduledDate || !scheduledTime) {
      alert("Please select both a valid date and time to schedule this post.");
      return;
    }
    if (selectedAccountIds.length === 0) {
      alert("Please select at least one social media channel.");
      return;
    }

    const selectedAccs = accounts.filter((a) => selectedAccountIds.includes(a.id));
    const platforms = selectedAccs.map((a) => a.platform);
    const scheduleISO = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

    try {
      await onCreatePost({
        content,
        mediaUrl: mediaUrl || undefined,
        platforms,
        accountIds: selectedAccountIds,
        status: "scheduled",
        scheduledFor: scheduleISO
      });

      alert("Post successfully added to the scheduled queue!");
      setContent("");
      setMediaUrl("");
      setScheduledDate("");
      setScheduledTime("");
      onNavigateToQueue();
    } catch (error) {
      console.error(error);
    }
  };

  // Save Post as a draft
  const handleSaveDraft = async () => {
    if (!content) return;
    const selectedAccs = accounts.filter((a) => selectedAccountIds.includes(a.id));
    const platforms = selectedAccs.map((a) => a.platform);

    try {
      await onCreatePost({
        content,
        mediaUrl: mediaUrl || undefined,
        platforms,
        accountIds: selectedAccountIds,
        status: "draft"
      });

      alert("Draft saved successfully!");
      setContent("");
      setMediaUrl("");
    } catch (error) {
      console.error(error);
    }
  };

  const selectedPlatforms = getSelectedPlatforms();

  const tones = ["professional", "witty", "bold", "casual", "promotional", "educational"];
  const lengths = ["short", "medium", "long"];

  return (
    <div className="space-y-10 animate-fade-in">
      
      {/* Header section */}
      <div>
        <h2 className="text-xs font-black tracking-[0.22em] text-slate-400 uppercase">Campaigns / Authoring</h2>
        <h1 className="text-6xl font-black tracking-tighter mt-1 text-slate-950 uppercase">COMPOSER.</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* LEFT: Composer & Editor Panel (xl:col-span-7) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* Channel Selector */}
          <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-8 shadow-sm space-y-5">
            <label className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block">SELECT PUBLISHING CHANNELS</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No channels linked yet.</p>
              ) : (
                accounts.map((acc) => {
                  const isSelected = selectedAccountIds.includes(acc.id);
                  const hasEphemeralToken = (acc.platform === "facebook" || acc.platform === "instagram") && ephemeralTokens[acc.platform];
                  return (
                    <button
                      key={acc.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedAccountIds(selectedAccountIds.filter((id) => id !== acc.id));
                        } else {
                          setSelectedAccountIds([...selectedAccountIds, acc.id]);
                        }
                      }}
                      className={`flex items-center space-x-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        isSelected 
                          ? "border-black bg-slate-50 shadow-sm" 
                          : "border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="relative">
                        <img 
                          src={acc.avatarUrl} 
                          alt={acc.displayName} 
                          className="w-11 h-11 rounded-full border-2 border-slate-200 object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className={`absolute -bottom-1 -right-1 text-[8px] px-1.5 py-0.5 uppercase font-black rounded text-white ${
                          acc.platform === "twitter" ? "bg-black" :
                          acc.platform === "linkedin" ? "bg-blue-600" :
                          acc.platform === "instagram" ? "bg-pink-600" : "bg-indigo-700"
                        }`}>
                          {acc.platform.substring(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{acc.displayName}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">@{acc.username}</p>
                        {acc.platform === "facebook" || acc.platform === "instagram" ? (
                          <p className={`text-[8px] font-black uppercase tracking-wider mt-0.5 ${hasEphemeralToken ? "text-emerald-500" : "text-amber-500"}`}>
                            {hasEphemeralToken ? "✓ Token ready" : "Needs auth"}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Meta OAuth Section — Ephemeral Token Capture */}
            {(accounts.some(a => a.platform === "facebook") || accounts.some(a => a.platform === "instagram")) && (
              <div className="border-t-2 border-slate-100 pt-5 space-y-3">
                <div className="flex items-center space-x-2 text-[10px] font-black tracking-widest text-indigo-600 uppercase">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Ephemeral Meta Authorization</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Authorization code flow: the code is exchanged server-side for an access token. The client secret never reaches the browser.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {accounts.filter(a => a.platform === "facebook").length > 0 && (
                    <MetaOAuthButton
                      platform="facebook"
                      onTokenReceived={handleEphemeralToken}
                      disabled={isPublishing}
                    />
                  )}
                  {accounts.filter(a => a.platform === "instagram").length > 0 && (
                    <MetaOAuthButton
                      platform="instagram"
                      onTokenReceived={handleEphemeralToken}
                      disabled={isPublishing}
                    />
                  )}
                </div>
                {Object.keys(ephemeralTokens).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ephemeralTokens).map(([platform, data]) => (
                      <span key={platform} className="inline-flex items-center text-[9px] font-black tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md uppercase">
                        {platform} ✓ live
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Text Editor Card */}
          <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black tracking-widest text-indigo-600 uppercase block">CAMPAIGN CONTENT</label>
              <span className="text-xs font-mono text-slate-400 font-bold">{content.length} CHARS</span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Draft your social publication copy here, or generate options via Gemini AI Assistant on the right..."
              rows={6}
              className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-600 focus:outline-none focus:bg-white transition-all"
            />

            <div className="space-y-1.5">
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Public Media URL</label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="Required for Instagram publishing; optional for other platforms"
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* Scheduling and Submission */}
            <div className="border-t-2 border-slate-100 pt-6 space-y-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Schedule Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Schedule Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <button
                  onClick={handleSaveDraft}
                  className="px-5 py-3 rounded-xl text-slate-700 hover:bg-slate-100 border-2 border-slate-200 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Save as Draft
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleSchedulePost}
                    disabled={!scheduledDate || !scheduledTime}
                    className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center space-x-2 cursor-pointer transition-all shadow-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Schedule</span>
                  </button>

                  <button
                    onClick={handlePublishNow}
                    className="px-6 py-3.5 bg-black hover:bg-slate-800 text-white text-xs font-black tracking-widest uppercase rounded-full shadow-lg flex items-center space-x-2 cursor-pointer transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Deploy Campaign</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Publishing results */}
          {showConsole && (
            <div className="bg-black border-2 border-slate-800 rounded-[2rem] p-8 space-y-4 font-mono shadow-2xl text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2.5">
                  <Terminal className="w-[18px] h-[18px] text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">LIVE.PUBLISH_RESULTS</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                </div>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto text-xs leading-relaxed">
                {publishingLogs.map((log, idx) => (
                  <div key={idx} className={log.includes("published") ? "text-emerald-400 font-bold" : log.includes("failed") ? "text-red-400" : "text-slate-300"}>
                    {log}
                  </div>
                ))}
                {isPublishing && (
                  <div className="text-slate-500 flex items-center space-x-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>Awaiting provider API response...</span>
                  </div>
                )}
              </div>

              {successState && (
                <div className="mt-4 p-4 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl flex items-center space-x-3 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Campaign deployed successfully on active channels.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: AI Assistant Panel & Previews (xl:col-span-5) */}
        <div className="xl:col-span-5 space-y-6">
          
          {/* AI CAPTION GENERATOR */}
          <div className="bg-slate-900 border-2 border-slate-800 rounded-[2rem] p-8 text-white space-y-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black italic tracking-tight uppercase">AI.CAPTION_GEN</h3>
              <div className="px-3 py-1 bg-slate-800 rounded text-[9px] font-black tracking-widest text-slate-400 uppercase">v2.0 Turbo</div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Generate highly optimized high-conversion copies with matched hashtags instantly.
            </p>

            <div className="space-y-4">
              {/* Topic Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">DESCRIBE THEME / TOPIC</label>
                <input
                  type="text"
                  placeholder="e.g. 5 steps to design a luxury dashboard template"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-slate-800 p-3 rounded-xl text-xs font-bold text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Target Platform & Tone */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Target Platform</label>
                  <select
                    value={aiPlatform}
                    onChange={(e) => setAiPlatform(e.target.value as SocialPlatform | "all")}
                    className="w-full bg-slate-950 border-2 border-slate-800 p-3 rounded-xl text-xs font-bold text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="all">All Platforms</option>
                    <option value="twitter">X / Twitter</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>

                {/* Tone bento grid options */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">TONE FILTER</label>
                  <div className="grid grid-cols-3 gap-2">
                    {tones.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTone(t)}
                        className={`border-2 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all cursor-pointer ${
                          tone === t 
                            ? "border-indigo-500 text-indigo-400 bg-indigo-950/40" 
                            : "border-slate-800 text-slate-500 hover:border-slate-750"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Length options */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">COPY LENGTH</label>
                  <div className="grid grid-cols-3 gap-2">
                    {lengths.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLength(l as any)}
                        className={`border-2 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all cursor-pointer ${
                          length === l 
                            ? "border-indigo-500 text-indigo-400 bg-indigo-950/40" 
                            : "border-slate-800 text-slate-500 hover:border-slate-750"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hashtags count input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Hashtags Count</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={hashtagsCount}
                    onChange={(e) => setHashtagsCount(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border-2 border-slate-800 p-3 rounded-xl text-xs font-bold text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateCaptions}
                disabled={isGenerating}
                className="w-full py-[18px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 transition-colors cursor-pointer mt-3"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>SYNTHESIZING...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>GENERATE AI COPIES</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Error display */}
            {aiError && (
              <p className="text-red-400 text-[11px] leading-relaxed p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl font-bold uppercase">
                {aiError}
              </p>
            )}

            {/* Generated results stack styled with underlined theme layout */}
            {aiCaptions.length > 0 && (
              <div className="space-y-4 pt-5 border-t border-slate-800 max-h-96 overflow-y-auto">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">AI OPTIONS READY</span>
                {aiCaptions.map((cap, idx) => (
                  <div key={idx} className="bg-slate-950/80 border-2 border-slate-850 p-6 rounded-2xl space-y-4 text-left">
                    <p className="text-slate-100 leading-relaxed font-semibold text-sm italic underline decoration-indigo-400/40 decoration-4 underline-offset-4 whitespace-pre-wrap">
                      "{cap.text}"
                    </p>
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide">EXPLANATION: {cap.explanation}</p>
                    <button
                      onClick={() => setContent(cap.text)}
                      className="w-full py-2.5 rounded-xl hover:bg-indigo-600/20 border-2 border-indigo-500/30 text-indigo-400 hover:text-indigo-300 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>APPLY TO EDITOR</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VISUAL FEED PREVIEW */}
          {content && selectedPlatforms.length > 0 && (
            <div className="bg-white border-2 border-slate-200/80 rounded-[2rem] p-8 space-y-5 shadow-sm">
              <div className="flex items-center space-x-2 text-slate-800 border-b-2 border-slate-100 pb-3">
                <Eye className="w-[18px] h-[18px] text-slate-500" />
                <h4 className="font-display font-black text-xs uppercase tracking-widest text-slate-800">Visual Feed Preview</h4>
              </div>

              {selectedPlatforms.map((plat) => {
                const matchingAcc = accounts.find((a) => a.platform === plat);
                const name = matchingAcc?.displayName || "Sphere SMM Manager";
                const handle = matchingAcc?.username || "smm_creative";
                const avatar = matchingAcc?.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80";

                return (
                  <div key={plat} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 text-left">
                    <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded text-white ${
                      plat === "twitter" ? "bg-slate-900" :
                      plat === "linkedin" ? "bg-blue-600" :
                      plat === "instagram" ? "bg-pink-600" : "bg-indigo-700"
                    }`}>
                      {plat.toUpperCase()} PREVIEW
                    </span>

                    <div className="flex items-start space-x-3 pt-1">
                      <img 
                        src={avatar} 
                        alt={name} 
                        className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 space-y-1 overflow-hidden">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">@{handle}</span>
                        </div>
                        <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap break-words">{content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

