import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "firebase/auth";
import { auth } from "../firebase";
import { Mail, Lock, User, ArrowRight, Facebook, AlertTriangle } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: (uid: string) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const finishAuth = (uid: string) => {
    setError("");
    onAuthSuccess(uid);
  };

  // Handle redirect result on mount (for Facebook which may require redirect flow)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          finishAuth(result.user.uid);
        }
      })
      .catch((err: any) => {
        // Silently ignore - user likely cancelled or no redirect happened
        if (err.code !== "auth/credential-already-in-use" && err.code !== "auth/no-such-provider") {
          console.warn("Redirect auth result check:", err.code);
        }
      });
  }, []);

  const handleProviderSignIn = async (providerName: "google" | "facebook") => {
    setError("");
    setIsLoading(true);
    try {
      const provider = providerName === "google" ? new GoogleAuthProvider() : new FacebookAuthProvider();
      
      // Add scopes for Facebook to request email and public profile
      if (provider instanceof FacebookAuthProvider) {
        provider.addScope("email");
        provider.addScope("public_profile");
      }
      if (provider instanceof GoogleAuthProvider) {
        provider.addScope("email");
        provider.addScope("profile");
      }

      try {
        // Try popup first (works in most modern browsers)
        const credential = await signInWithPopup(auth, provider);
        finishAuth(credential.user.uid);
      } catch (popupErr: any) {
        // If popup is blocked or unavailable (e.g. iOS, some mobile browsers), fall back to redirect
        if (popupErr.code === "auth/popup-blocked" || popupErr.code === "auth/popup-closed-by-user") {
          console.warn("Popup was blocked or closed. Falling back to redirect flow...");
          await signInWithRedirect(auth, provider);
          // The page will redirect, so we don't resolve here
          return;
        }
        throw popupErr;
      }
    } catch (err: any) {
      console.error("Provider authentication error:", err);
      let friendlyMsg = "Provider sign-in failed.";
      
      if (err.code === "auth/operation-not-allowed") {
        friendlyMsg = "Facebook/Google sign-in is not enabled in this Firebase project. Go to Firebase Console > Authentication > Sign-in providers and enable Facebook and Google.";
      } else if (err.code === "auth/account-exists-with-different-credential") {
        friendlyMsg = "An account already exists with the same email but different sign-in method. Try signing in with email/password first, then link your account.";
      } else if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        friendlyMsg = "Sign-in was cancelled. Please try again.";
      } else if (err.code === "auth/unauthorized-domain") {
        friendlyMsg = "This domain is not authorized for OAuth. Add it in Firebase Console > Authentication > Settings > Authorized domains.";
      } else {
        friendlyMsg = err.message || "Provider sign-in failed. Check that this provider is enabled in Firebase Authentication.";
      }
      
      setError(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !displayName)) {
      setError("Please fill in all required fields.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        finishAuth(userCredential.user.uid);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        finishAuth(userCredential.user.uid);
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      let friendlyMessage = "An unexpected authentication issue occurred.";
      if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already in use. Please sign in instead.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Password is too weak. Please use at least 6 characters.";
      } else if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        friendlyMessage = "Incorrect email or password. Please try again.";
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-900 font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border-2 border-slate-200/80 rounded-3xl p-10 shadow-xl space-y-8 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center text-white font-black text-3xl shadow-md mx-auto">
            S.
          </div>
          <div>
            <h1 className="font-display font-black text-2xl text-black tracking-tight uppercase">SphereSMM.</h1>
            <p className="text-[10px] font-black text-indigo-600 tracking-widest uppercase">Authenticated Workspace</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 font-medium leading-relaxed">
            {error}
          </div>
        )}

          <div className="space-y-3">
            <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block text-center">
              Sign in with Firebase providers
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => handleProviderSignIn("google")}
                disabled={isLoading}
                className="w-full py-3 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer transition-all flex items-center justify-center space-x-2.5 shadow-sm active:scale-[0.98]"
              >
                <Mail className="w-4 h-4 text-red-500" />
                <span>Sign in with Google</span>
              </button>
              <button
                onClick={() => handleProviderSignIn("facebook")}
                disabled={isLoading}
                className="w-full py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer transition-all flex items-center justify-center space-x-2.5 shadow-md active:scale-[0.98]"
              >
                <Facebook className="w-4 h-4" />
                <span>Sign in with Facebook</span>
              </button>
            </div>

            {/* Firebase configuration hint */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[10px] text-amber-800 leading-relaxed font-medium flex items-start space-x-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Setup required:</strong> Enable&nbsp;Facebook&nbsp;and&nbsp;Google providers in the&nbsp;Firebase&nbsp;Console → Authentication → Sign-in&nbsp;providers for these buttons to work. Meta App ID for client-side OAuth (response_type=token flow).
              </span>
            </div>
          </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Or use email
          </span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 pl-12 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none placeholder-slate-400"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 pl-12 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none placeholder-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 pl-12 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none placeholder-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-black hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer transition-all shadow-md flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? "Signing in..." : isSignUp ? "Create Workspace Account" : "Access Workspace"}</span>
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-xs font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            {isSignUp ? "Already have an account? Sign In" : "New to SphereSMM? Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
