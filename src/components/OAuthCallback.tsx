import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * OAuthCallback
 * 
 * This is the redirect landing page for Meta OAuth with response_type=token.
 * 
 * When Meta redirects the user back here, the access token is in the URL
 * hash fragment (#access_token=...). This component:
 * 1. Reads the hash fragment
 * 2. Extracts the access token
 * 3. Posts it back to the opener window via postMessage
 * 4. Self-closes the popup
 * 
 * The token NEVER touches any server, database, log, or storage.
 * It exists only transiently in the browser URL and is immediately
 * relayed to the opener window, then the window closes.
 */
export default function OAuthCallback() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Completing authorization...");

  useEffect(() => {
    try {
      // Parse the URL hash fragment
      // After response_type=token, Meta redirects to:
      //   /oauth/callback#access_token=EAAxxx...&expires_in=...&state=...
      const hash = window.location.hash.substring(1); // Remove the leading #
      
      if (!hash) {
        // Check if there's an error in the URL query params (e.g. ?error=access_denied)
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get("error");
        const errorReason = params.get("error_reason");
        const errorDescription = params.get("error_description");

        if (errorParam) {
          setStatus("error");
          setMessage(errorDescription || errorReason || "Authorization was denied.");
          // Notify the opener window about the error
          if (window.opener) {
            window.opener.postMessage({
              type: "META_OAUTH_ERROR",
              error: errorDescription || errorReason || "User denied authorization."
            }, window.origin);
          }
          return;
        }

        setStatus("error");
        setMessage("No authorization data received. The hash fragment is empty.");
        return;
      }

      // Parse the hash fragment as query string parameters
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const expiresIn = hashParams.get("expires_in");
      const state = hashParams.get("state"); // platform name passed in original request

      if (!accessToken) {
        setStatus("error");
        setMessage("No access token found in the response.");
        if (window.opener) {
          window.opener.postMessage({
            type: "META_OAUTH_ERROR",
            error: "No access token in callback. The hash was: " + hash.substring(0, 50) + "..."
          }, window.origin);
        }
        return;
      }

      // Success! Post the token back to the opener window
      setStatus("success");
      setMessage("Token received. You can close this window.");

      if (window.opener) {
        window.opener.postMessage({
          type: "META_OAUTH_TOKEN",
          token: accessToken,
          platform: state || "facebook",
          expiresIn: expiresIn || "unknown",
          externalAccountId: hashParams.get("account_id") || undefined
        }, window.origin);

        // Clear the hash for security — token is gone from URL
        window.location.hash = "";
      } else {
        // No opener — this shouldn't happen in normal flow
        setStatus("error");
        setMessage("This window was not opened by the application. Cannot relay token.");
        return;
      }

      // Close the popup after a brief delay so user sees success
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "An unexpected error occurred during OAuth callback.");
      if (window.opener) {
        window.opener.postMessage({
          type: "META_OAUTH_ERROR",
          error: err.message || "Unexpected OAuth callback error."
        }, window.origin);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border-2 border-slate-200/80 rounded-3xl p-10 shadow-xl text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center text-white font-black text-3xl shadow-md mx-auto">
          S.
        </div>

        {status === "processing" && (
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-slate-700 font-bold text-sm">Processing OAuth response...</p>
            <p className="text-slate-400 text-xs">Extracting token from URL fragment</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center mx-auto">
              <span className="text-emerald-600 text-2xl font-black">✓</span>
            </div>
            <p className="text-slate-800 font-black text-sm uppercase tracking-wider">Authorization Successful</p>
            <p className="text-slate-400 text-xs">
              Token relayed to application. This window will close automatically.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto">
              <span className="text-red-500 text-2xl font-black">!</span>
            </div>
            <p className="text-slate-800 font-black text-sm uppercase tracking-wider">Authorization Failed</p>
            <p className="text-red-600 text-xs font-medium">{message}</p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2.5 bg-black hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}