import React, { useState, useEffect, useRef } from "react";
import { SocialPlatform } from "../types";
import { Facebook, Camera } from "lucide-react";

interface MetaOAuthButtonProps {
  platform: "facebook" | "instagram";
  onTokenReceived: (token: string, platform: SocialPlatform, externalAccountId?: string) => void;
  disabled?: boolean;
}

/**
 * MetaOAuthButton — Authorization Code Flow
 *
 * The Handshake:  Client opens Meta OAuth popup with response_type=code
 * The Response:   Meta returns a short-lived Authorization Code (not a token)
 * The Exchange:   Client-side JS sends this code to our backend via POST
 * The Verification: Server swaps code + client_secret for a long-lived access token
 *
 * The client_secret NEVER reaches the browser.
 */
export default function MetaOAuthButton({ platform, onTokenReceived, disabled }: MetaOAuthButtonProps) {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState("");
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

  const handleAuthorize = () => {
    setError("");
    setIsAuthorizing(true);

    const appId = import.meta.env.VITE_META_APP_ID || "";
    if (!appId) {
      setError("VITE_META_APP_ID is not configured. Set it in .env.local");
      setIsAuthorizing(false);
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;

    const scopes = platform === "instagram"
      ? "instagram_basic,instagram_content_publish,pages_read_engagement"
      : "pages_manage_posts,pages_read_engagement";

    // The Handshake: open popup with response_type=code
    const oauthUrl = `https://www.facebook.com/v23.0/dialog/oauth?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${platform}`;

    const messageHandler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, code, platform: returnedPlatform, externalAccountId, error: oauthError } = event.data || {};

      if (type === "META_OAUTH_CODE" && code) {
        // The Response: received authorization code from popup
        // The Exchange: send code to backend to swap for access token
        try {
          const response = await fetch("/api/meta/exchange-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirect_uri: redirectUri })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Token exchange failed.");
          }

          // The Verification: server returned the long-lived access token
          onTokenReceived(data.access_token, returnedPlatform || platform, externalAccountId);
          setIsAuthorizing(false);
        } catch (err: any) {
          setError(err.message || "Failed to exchange authorization code for access token.");
          setIsAuthorizing(false);
        }

        if (listenerRef.current) {
          window.removeEventListener("message", listenerRef.current);
          listenerRef.current = null;
        }
      } else if (type === "META_OAUTH_ERROR") {
        setError(oauthError || "Authorization was cancelled or failed.");
        setIsAuthorizing(false);
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
      setError("Popup was blocked. Please allow popups for this site and try again.");
      setIsAuthorizing(false);
      window.removeEventListener("message", messageHandler);
      listenerRef.current = null;
      return;
    }

    popupRef.current = popup;

    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        if (listenerRef.current) {
          setError("Authorization window was closed before completing sign-in.");
          setIsAuthorizing(false);
          window.removeEventListener("message", listenerRef.current);
          listenerRef.current = null;
        }
      }
    }, 500);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleAuthorize}
        disabled={disabled || isAuthorizing}
        className={`w-full flex items-center justify-center space-x-2.5 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
          platform === "facebook"
            ? "bg-[#1877F2] hover:bg-[#166FE5] text-white"
            : "bg-pink-600 hover:bg-pink-700 text-white"
        } disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
      >
        {isAuthorizing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Authorizing...</span>
          </>
        ) : (
          <>
            {platform === "facebook" ? (
              <Facebook className="w-4 h-4" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span>Authorize {platform === "facebook" ? "Facebook" : "Instagram"}</span>
          </>
        )}
      </button>

      {error && (
        <p className="text-[10px] text-red-500 font-medium leading-relaxed px-1">{error}</p>
      )}

      <p className="text-[9px] text-slate-400 font-medium leading-relaxed px-1">
        Authorization code flow — code is exchanged server-side. Client secret never reaches the browser.
      </p>
    </div>
  );
}
