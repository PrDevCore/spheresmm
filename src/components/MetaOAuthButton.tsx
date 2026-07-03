import React, { useState, useEffect, useRef } from "react";
import { SocialPlatform } from "../types";
import { Facebook, Camera, LogIn } from "lucide-react";

interface MetaOAuthButtonProps {
  platform: "facebook" | "instagram";
  onTokenReceived: (token: string, platform: SocialPlatform, externalAccountId?: string) => void;
  disabled?: boolean;
}

/**
 * MetaOAuthButton
 * 
 * Launches a Meta OAuth popup with response_type=token.
 * The access token is returned in the URL hash fragment (#access_token=...)
 * and captured via postMessage from the OAuth callback popup.
 * 
 * The token is NEVER stored in any database — it exists only in
 * browser memory (React useState) and is garbage collected on unmount.
 */
export default function MetaOAuthButton({ platform, onTokenReceived, disabled }: MetaOAuthButtonProps) {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState("");
  const popupRef = useRef<Window | null>(null);
  const listenerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Cleanup message listener on unmount (garbage collection)
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

    // Meta App ID — should be configured via env var
    const appId = import.meta.env.VITE_META_APP_ID || "";
    if (!appId) {
      setError("VITE_META_APP_ID is not configured. Set it in .env.local");
      setIsAuthorizing(false);
      return;
    }

    // The redirect URI must point to our OAuth callback page
    const redirectUri = `${window.location.origin}/oauth/callback`;

    // Build the OAuth dialog URL with response_type=token
    // This returns the access token in the URL hash fragment, NOT via a server-side code exchange
    const scopes = platform === "instagram"
      ? "instagram_basic,instagram_content_publish,pages_read_engagement"
      : "pages_manage_posts,pages_read_engagement";

    const oauthUrl = `https://www.facebook.com/v23.0/dialog/oauth?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${platform}`; // pass platform in state so callback knows which platform

    // Set up the postMessage listener BEFORE opening the popup
    const messageHandler = (event: MessageEvent) => {
      // Security: only accept messages from our own origin
      if (event.origin !== window.location.origin) return;

      const { type, token, platform: returnedPlatform, externalAccountId, error: oauthError } = event.data || {};

      if (type === "META_OAUTH_TOKEN" && token) {
        // Token received — pass it to parent component
        onTokenReceived(token, returnedPlatform || platform, externalAccountId);
        setIsAuthorizing(false);
        // Clean up listener
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

    // Open the popup
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

    // Poll to detect if the user closed the popup without completing auth
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        if (isAuthorizing) {
          setError("Authorization window was closed before completing sign-in.");
          setIsAuthorizing(false);
          window.removeEventListener("message", messageHandler);
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
        Opens a popup to Meta. Token is ephemeral — never stored on any server.
      </p>
    </div>
  );
}