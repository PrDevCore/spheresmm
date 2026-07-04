import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import ComposerView from "./components/ComposerView";
import CalendarView from "./components/CalendarView";
import AnalyticsView from "./components/AnalyticsView";
import AccountsView from "./components/AccountsView";
import AuthScreen from "./components/AuthScreen";
import OAuthCallback from "./components/OAuthCallback";

import { initAuth, testConnection, auth } from "./firebase";
import { 
  getSocialAccounts, 
  getPosts, 
  createPost,
  deletePost,
  updatePost,
  connectSocialAccount,
  disconnectSocialAccount
} from "./lib/dataService";
import { SocialAccount, Post } from "./types";
import { CheckCircle } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [userId, setUserId] = useState<string>("");
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string>("");

  // Helper to load all user workspace from Firestore and LocalStorage
  const loadWorkspaceData = async (uid: string) => {
    setIsLoading(true);
    try {
      const loadedAccounts = await getSocialAccounts(uid);
      const loadedPosts = await getPosts(uid);

      setAccounts(loadedAccounts);
      setPosts(loadedPosts);
    } catch (error) {
      console.error("Failed to load SMM workspace data", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup Auth and validate firestore connection on mount
  useEffect(() => {
    testConnection();
    initAuth((user) => {
      if (user) {
        setUserId(user.uid);
        loadWorkspaceData(user.uid);
      } else {
        setUserId("");
        setAccounts([]);
        setPosts([]);
        setIsLoading(false);
      }
    });
  }, []);

  // Logout handler
  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await auth.signOut();
      setUserId("");
      setAccounts([]);
      setPosts([]);
    } catch (error) {
      console.error("Sign out failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Automated scheduled publisher interval
  useEffect(() => {
    if (!userId || posts.length === 0) return;

    const checkScheduledInterval = setInterval(async () => {
      const now = new Date();
      // Find posts scheduled for now or in the past that are still "scheduled"
      const pendingPublish = posts.filter(
        (p) => p.status === "scheduled" && p.scheduledFor && new Date(p.scheduledFor) <= now
      );

      if (pendingPublish.length > 0) {
        for (const post of pendingPublish) {
          console.log(`[Auto Schedule] Publishing scheduled post ${post.id} automatically...`);

          try {
            const selectedAccs = accounts.filter((a) => post.accountIds.includes(a.id));
            const response = await fetch("/api/posts/publish", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: post.content,
                mediaUrl: post.mediaUrl,
                accounts: selectedAccs
              })
            });
            const data = await response.json();
            if ((!response.ok && response.status !== 207) || !data.success) {
              throw new Error(data.error || "Scheduled publish failed.");
            }

            await updatePost(post.id, {
              status: "published",
              publishedAt: now.toISOString()
            });
            setToastMessage(`Scheduled post published to: ${post.platforms.join(", ").toUpperCase()}`);
          } catch (e) {
            console.error("Scheduled publisher failed during background poll", e);
            await updatePost(post.id, { status: "failed" });
            setToastMessage(`Scheduled post failed: ${e instanceof Error ? e.message : "provider rejected the request"}`);
          }

          setTimeout(() => setToastMessage(""), 5000);
        }

        // Reload data to reflect state change
        await loadWorkspaceData(userId);
      }
    }, 12000); // Check every 12 seconds

    return () => clearInterval(checkScheduledInterval);
  }, [posts, userId, accounts]);

  // Handler: Save/Create Post
  const handleCreatePost = async (postData: Omit<Post, "id" | "userId" | "createdAt">) => {
    const freshPost = await createPost({
      ...postData,
      userId,
      createdAt: new Date().toISOString()
    });
    await loadWorkspaceData(userId);
    return freshPost;
  };

  // Handler: Delete Post
  const handleDeletePost = async (postId: string) => {
    await deletePost(postId);
    await loadWorkspaceData(userId);
  };

  // Handler: Connect Account
  const handleConnectAccount = async (accountData: Omit<SocialAccount, "id" | "userId" | "createdAt">) => {
    await connectSocialAccount({
      ...accountData,
      userId,
      createdAt: new Date().toISOString()
    });
    await loadWorkspaceData(userId);
  };

  // Handler: Disconnect Account
  const handleDisconnectAccount = async (accountId: string) => {
    await disconnectSocialAccount(accountId, userId);
    await loadWorkspaceData(userId);
  };

  // Handler: Publish a scheduled or draft post immediately
  const handlePublishPostNow = async (postId: string) => {
    const postToPublish = posts.find((p) => p.id === postId);
    if (!postToPublish) return;

    try {
      const selectedAccs = accounts.filter((a) => postToPublish.accountIds.includes(a.id));
      const response = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: postToPublish.content,
          mediaUrl: postToPublish.mediaUrl,
          accounts: selectedAccs
        })
      });
      const data = await response.json();
      if ((!response.ok && response.status !== 207) || !data.success) {
        throw new Error(data.error || "Provider rejected the publish request.");
      }

      await updatePost(postId, {
        status: "published",
        publishedAt: new Date().toISOString()
      });

      setToastMessage(`Campaign deployed to: ${postToPublish.platforms.join(", ").toUpperCase()}!`);
      setTimeout(() => setToastMessage(""), 4500);

      await loadWorkspaceData(userId);
    } catch (err) {
      console.error(err);
      await updatePost(postId, { status: "failed" });
      setToastMessage(`Campaign failed: ${err instanceof Error ? err.message : "provider rejected the request"}`);
      setTimeout(() => setToastMessage(""), 4500);
    }
  };

  // If loading and we don't have a session state resolved yet
  if (isLoading && !userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F3F4F6] space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600/35 border-t-indigo-600 rounded-full animate-spin"></div>
        <div className="text-center">
          <p className="text-slate-900 font-sans font-black tracking-tight text-lg uppercase">SYSTEM.SYNCING...</p>
          <p className="text-slate-500 font-mono text-[11px] mt-1 tracking-wider uppercase">Verifying Security Context</p>
        </div>
      </div>
    );
  }

  // If not logged in, render AuthScreen
  if (!userId) {
    return <AuthScreen onAuthSuccess={(uid) => { setUserId(uid); loadWorkspaceData(uid); }} />;
  }

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen text-slate-900 font-sans">
      
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userId={userId} 
        onLogout={handleLogout}
      />

      {/* Main Workspace Frame */}
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto space-y-8 relative">
        
        {/* Loading Spinner Overlays */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600/35 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-slate-900 font-sans font-black tracking-tight text-lg uppercase">UPDATING WORKSPACE...</p>
              <p className="text-slate-500 font-mono text-[11px] mt-1 tracking-wider uppercase">Fetching Pipeline Feeds</p>
            </div>
          </div>
        ) : (
          <>
            {/* Elegant Background Automated Post Toast Notification */}
            {toastMessage && (
              <div className="fixed top-6 right-6 z-50 bg-black text-white px-6 py-5 rounded-3xl shadow-2xl max-w-sm flex items-start space-x-4 border-2 border-slate-800 animate-fade-in">
                <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-display font-black text-xs uppercase tracking-widest text-indigo-400">SCHEDULER.ACTIVE</h5>
                  <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed uppercase">{toastMessage}</p>
                </div>
              </div>
            )}

            {/* Render Views based on tab selection */}
            {activeTab === "dashboard" && (
              <DashboardView
                accounts={accounts}
                posts={posts}
                onNavigateToComposer={() => setActiveTab("composer")}
                onNavigateToAccounts={() => setActiveTab("accounts")}
                onNavigateToCalendar={() => setActiveTab("calendar")}
                onPublishPostNow={handlePublishPostNow}
                onDeletePost={handleDeletePost}
              />
            )}

            {activeTab === "composer" && (
              <ComposerView
                accounts={accounts}
                onCreatePost={handleCreatePost}
                onNavigateToQueue={() => setActiveTab("calendar")}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarView
                posts={posts}
                onPublishPostNow={handlePublishPostNow}
                onDeletePost={handleDeletePost}
                onNavigateToComposer={() => setActiveTab("composer")}
              />
            )}

            {activeTab === "analytics" && (
              <AnalyticsView
                accounts={accounts}
                posts={posts}
              />
            )}

            {activeTab === "accounts" && (
              <AccountsView
                accounts={accounts}
                onConnectAccount={handleConnectAccount}
                onDisconnectAccount={handleDisconnectAccount}
              />
            )}
          </>
        )}
      </main>

      {/* OAuth callback route — handles Meta authorization code relay for popup flow */}
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallback />} />
      </Routes>
    </div>
  );
}

