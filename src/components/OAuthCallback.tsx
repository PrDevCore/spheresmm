import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * OAuthCallback — Authorization Code Flow
 *
 * When Meta redirects the user back here after authorization, the
 * authorization code is in the URL query parameters:
 *   /oauth/callback?code=XXXXX&state=facebook
 *
 * This component:
 * 1. Reads the authorization code from query params
 * 2. Posts it back to the opener window via postMessage
 * 3. The opener (MetaOAuthButton) sends the code to the backend
 * 4. The backend swaps the code + client_secret for an access token
 * 5. Self-closes the popup
 *
 * The authorization code NEVER touches any server from this component.
 * It is only relayed to the opener window for the exchange step.
 */
export default function OAuthCallback() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Completing authorization...");

  useEffect(() => {
    try {
      // The authorization code is in the URL query parameters (not hash fragment)
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state"); // platform name passed in original request
      const errorParam = params.get("error");
      const errorReason = params.get("error_reason");
      const errorDescription = params.get("error_description");

      // Handle errors from Meta
      if (errorParam) {
        setStatus("error");
        setMessage(errorDescription || errorReason || "Authorization was denied.");
        if (window.opener) {
          window.opener.postMessage({
            type: "META_OAUTH_ERROR",
            error: errorDescription || errorReason || "User denied authorization."
          }, window.origin);
        }
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("No authorization code received. The query parameters are empty.");
        return;
      }

      // Success! Post the authorization code back to the opener window
      setStatus("success");
      setMessage("Authorization code received. Exchanging for access token...");

      if (window.opener) {
        window.opener.postMessage({
          type: "META_OAUTH_CODE",
          code: code,
          platform: state || "facebook"
        }, window.origin);

        // Clear the authorization code from the URL for security
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setStatus("error");
        setMessage("This window was not opened by the application. Cannot relay authorization code.");
        return;
      }

      // Close the popup after a brief delay
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
            <p className="text-slate-400 text-xs">Extracting authorization code from URL</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center mx-auto">
              <span className="text-emerald-600 text-2xl font-black">✓</span>
            </div>
            <p className="text-slate-800 font-black text-sm uppercase tracking-wider">Authorization Successful</p>
            <p className="text-slate-400 text-xs">
              Code relayed to application. Token exchange in progress. This window will close automatically.
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
