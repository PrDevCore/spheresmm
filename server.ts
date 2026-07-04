import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load .env.local first (user-specific overrides), then .env (defaults)
dotenv.config({ path: ".env.local" });
dotenv.config();

type PublishAccount = {
  id?: string;
  platform: "twitter" | "linkedin" | "facebook" | "instagram";
  accessToken: string;
  externalAccountId?: string;
  pageId?: string;
  authorUrn?: string;
  instagramBusinessAccountId?: string;
};

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }

  return data;
}

async function publishToPlatform(account: PublishAccount, content: string, mediaUrl?: string) {
  if (!account?.platform || !account?.accessToken) {
    throw new Error("Missing platform or access token for a connected account.");
  }

  if (account.platform === "twitter") {
    const data = await postJson(
      "https://api.x.com/2/tweets",
      { text: content },
      { Authorization: `Bearer ${account.accessToken}` }
    );

    return {
      providerId: data?.data?.id,
      providerUrl: data?.data?.id ? `https://x.com/i/web/status/${data.data.id}` : undefined,
      response: data
    };
  }

  if (account.platform === "facebook") {
    const pageId = account.externalAccountId || account.pageId;
    if (!pageId) {
      throw new Error("Facebook publishing requires a Page ID.");
    }

    const data = await postJson(`https://graph.facebook.com/v23.0/${pageId}/feed`, {
      message: content,
      access_token: account.accessToken
    });

    return {
      providerId: data?.id,
      providerUrl: data?.id ? `https://facebook.com/${data.id}` : undefined,
      response: data
    };
  }

  if (account.platform === "instagram") {
    const igUserId = account.externalAccountId || account.instagramBusinessAccountId;
    if (!igUserId) {
      throw new Error("Instagram publishing requires an Instagram Business Account ID.");
    }
    if (!mediaUrl) {
      throw new Error("Instagram publishing requires a public image or video media URL.");
    }

    const container = await postJson(`https://graph.facebook.com/v23.0/${igUserId}/media`, {
      image_url: mediaUrl,
      caption: content,
      access_token: account.accessToken
    });
    const published = await postJson(`https://graph.facebook.com/v23.0/${igUserId}/media_publish`, {
      creation_id: container.id,
      access_token: account.accessToken
    });

    return {
      providerId: published?.id,
      response: { container, published }
    };
  }

  if (account.platform === "linkedin") {
    const author = account.externalAccountId || account.authorUrn;
    if (!author || !author.startsWith("urn:li:")) {
      throw new Error("LinkedIn publishing requires an author URN, such as urn:li:person:{id} or urn:li:organization:{id}.");
    }

    const data = await postJson(
      "https://api.linkedin.com/rest/posts",
      {
        author,
        commentary: content,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
      },
      {
        Authorization: `Bearer ${account.accessToken}`,
        "Linkedin-Version": process.env.LINKEDIN_VERSION || "202606",
        "X-Restli-Protocol-Version": "2.0.0"
      }
    );

    return {
      providerId: data?.id,
      response: data
    };
  }

  throw new Error(`Unsupported platform: ${account.platform}`);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/data-deletion
  //
  // Meta App Data Deletion Callback URL
  // Used in: Meta Developer Dashboard → App Settings → User Data Deletion
  // This endpoint serves as a live URL that Meta requires for app review.
  // When a user requests data deletion, Meta redirects to this URL.
  // The response includes a deletion request confirmation code.
  // ────────────────────────────────────────────────────────────────────────────
  app.get("/api/data-deletion", (req, res) => {
    const confirmationCode = `del_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    res.status(200).json({
      url: `${process.env.APP_URL || "https://spheresmm.onrender.com"}/data-deletion`,
      confirmation_code: confirmationCode,
      status: "received",
      message: "Your data deletion request has been received. We will process it within 30 days. Please contact prdevcore@email.com with your account email and this confirmation code to complete the process.",
      confirmation_code_note: "Please save this confirmation code for your records."
    });
  });

  // Also serve a human-readable HTML page at /data-deletion
  app.get("/data-deletion", (req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SphereSMM — Data Deletion</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f3f4f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: white; border-radius: 24px; padding: 40px; max-width: 500px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
          h1 { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase; color: #0f172a; }
          p { font-size: 14px; color: #64748b; line-height: 1.6; }
          .code { background: #f1f5f9; padding: 8px 16px; border-radius: 8px; font-family: monospace; font-size: 12px; word-break: break-all; }
          .btn { display: inline-block; padding: 12px 24px; background: #0f172a; color: white; text-decoration: none; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Data Deletion</h1>
          <p>To request deletion of your SphereSMM Dashboard data, send an email to <strong>prdevcore@email.com</strong> with:</p>
          <ul style="text-align: left; font-size: 13px; color: #475569; line-height: 1.8;">
            <li><strong>Subject:</strong> Data Deletion Request</li>
            <li><strong>Body:</strong> Your account email address and Firebase User ID</li>
          </ul>
          <p style="font-size: 12px;">We will process all requests within 30 days. You will receive a confirmation email once complete.</p>
          <a href="mailto:prdevcore@email.com?subject=Data%20Deletion%20Request" class="btn">Request Deletion</a>
        </div>
      </body>
      </html>
    `);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Privacy Policy page
  // Required for Meta Developer Dashboard → App Settings → Privacy Policy URL
  // ────────────────────────────────────────────────────────────────────────────
  app.get("/privacy", (req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SphereSMM — Privacy Policy</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f3f4f6; display: flex; justify-content: center; padding: 40px 20px; min-height: 100vh; margin: 0; }
          .card { background: white; border-radius: 24px; padding: 48px; max-width: 640px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase; color: #0f172a; margin-bottom: 8px; }
          .updated { font-size: 12px; color: #94a3b8; font-weight: 600; margin-bottom: 32px; }
          h2 { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 28px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
          p, li { font-size: 14px; color: #475569; line-height: 1.7; }
          ul { padding-left: 20px; margin: 8px 0; }
          li { margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
          th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
          th { font-weight: 700; color: #0f172a; }
          td { color: #475569; }
          strong { color: #0f172a; }
          a { color: #4f46e5; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Privacy Policy</h1>
          <p class="updated">Last updated: July 2026</p>

          <h2>Data We Collect</h2>
          <ul>
            <li><strong>Email address and display name</strong> — for authentication via Firebase Auth</li>
            <li><strong>Post content and media URLs</strong> — content you compose, schedule, or publish through the dashboard</li>
            <li><strong>Social account references</strong> — platform, username, display name, avatar URL (no access tokens stored on servers)</li>
            <li><strong>Analytics data</strong> — impressions, engagements, clicks derived from published posts</li>
          </ul>

          <h2>How We Use Your Data</h2>
          <ul>
            <li>To authenticate you via Firebase Auth (email/password, Google, Facebook)</li>
            <li>To publish social media posts on your behalf to platforms you authorize (X/Twitter, Facebook, Instagram, LinkedIn)</li>
            <li>To generate AI caption suggestions via Google Gemini API</li>
            <li>To display analytics and performance metrics</li>
          </ul>

          <h2>Data Storage</h2>
          <ul>
            <li><strong>Authentication data</strong> is handled by Firebase (Google Cloud infrastructure)</li>
            <li><strong>Post drafts and schedules</strong> are stored in Firestore (Google Cloud)</li>
            <li><strong>Social media access tokens</strong> are NEVER stored on our servers — they exist only in your browser memory during a publishing session and are immediately garbage collected</li>
          </ul>

          <h2>Third-Party Services</h2>
          <table>
            <tr><th>Service</th><th>Purpose</th></tr>
            <tr><td>Firebase (Google)</td><td>Authentication, Firestore database</td></tr>
            <tr><td>Google Gemini AI</td><td>AI caption generation</td></tr>
            <tr><td>Meta (Facebook/Instagram)</td><td>Publishing to connected accounts</td></tr>
            <tr><td>X (Twitter)</td><td>Publishing tweets</td></tr>
            <tr><td>LinkedIn</td><td>Publishing posts</td></tr>
          </table>

          <h2>Data Security</h2>
          <ul>
            <li>Access tokens are ephemeral — obtained fresh via OAuth popup at publish time</li>
            <li>No tokens are written to disk, database, logs, or localStorage</li>
            <li>Firestore security rules enforce per-user data isolation</li>
            <li>All API calls use HTTPS encryption</li>
          </ul>

          <h2>Your Rights</h2>
          <p>You can request deletion of your data at any time by emailing <strong>prdevcore@email.com</strong> with subject "Data Deletion Request" and your account email address. We will delete all associated data within 30 days.</p>

          <h2>Contact</h2>
          <p><strong>Email:</strong> <a href="mailto:prdevcore@email.com">prdevcore@email.com</a></p>
        </div>
      </body>
      </html>
    `);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Terms of Service page
  // Required for Meta Developer Dashboard → App Settings → Terms of Service URL
  // ────────────────────────────────────────────────────────────────────────────
  app.get("/terms", (req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SphereSMM — Terms of Service</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f3f4f6; display: flex; justify-content: center; padding: 40px 20px; min-height: 100vh; margin: 0; }
          .card { background: white; border-radius: 24px; padding: 48px; max-width: 640px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase; color: #0f172a; margin-bottom: 8px; }
          .updated { font-size: 12px; color: #94a3b8; font-weight: 600; margin-bottom: 32px; }
          h2 { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 28px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
          p, li { font-size: 14px; color: #475569; line-height: 1.7; }
          ul { padding-left: 20px; margin: 8px 0; }
          li { margin-bottom: 6px; }
          strong { color: #0f172a; }
          a { color: #4f46e5; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Terms of Service</h1>
          <p class="updated">Last updated: July 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>By using SphereSMM Dashboard ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>

          <h2>2. Description of Service</h2>
          <p>SphereSMM Dashboard is a social media management tool that allows users to:</p>
          <ul>
            <li>Compose and schedule social media posts</li>
            <li>Generate AI-powered captions using Google Gemini</li>
            <li>Publish content to connected social media accounts (X/Twitter, Facebook, Instagram, LinkedIn)</li>
            <li>View analytics and performance metrics</li>
          </ul>

          <h2>3. User Responsibilities</h2>
          <ul>
            <li>You are solely responsible for all content you publish through the Service</li>
            <li>You must comply with each platform's Terms of Service (X/Twitter, Facebook, Instagram, LinkedIn)</li>
            <li>You must not use the Service to publish harmful, illegal, or misleading content</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
          </ul>

          <h2>4. Third-Party Services</h2>
          <p>The Service integrates with third-party platforms: Firebase (Google), Google Gemini AI, Meta (Facebook/Instagram), X (Twitter), and LinkedIn. We are not responsible for the availability, functionality, or terms of these third-party services.</p>

          <h2>5. Limitation of Liability</h2>
          <p>The Service is provided "as is" without warranty of any kind. We are not liable for any content published through the Service, damages or losses resulting from use or inability to use the Service, or actions taken by third-party platforms in response to published content.</p>

          <h2>6. Intellectual Property</h2>
          <p>You retain all rights to content you create and publish through the Service. We claim no ownership over your content.</p>

          <h2>7. Termination</h2>
          <p>We reserve the right to suspend or terminate access to the Service for violations of these terms or for misuse of the platform.</p>

          <h2>8. Changes to Terms</h2>
          <p>We may update these terms. Continued use of the Service after changes constitutes acceptance of the new terms.</p>

          <h2>9. Contact</h2>
          <p><strong>Email:</strong> <a href="mailto:prdevcore@email.com">prdevcore@email.com</a></p>
        </div>
      </body>
      </html>
    `);
  });

  app.post("/api/generate-captions", async (req, res) => {
    try {
      const { topic, platform, tone, length, hashtagsCount } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "Topic/prompt description is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const lengthDesc = length === "short" ? "under 100 characters" : length === "long" ? "rich, detailed (around 400 characters)" : "standard (around 200 characters)";
      const hashtagsDesc = hashtagsCount > 0 ? `Include exactly ${hashtagsCount} relevant hashtags.` : "Do not include any hashtags.";

      const prompt = `You are an expert Social Media Manager. Generate exactly 3 highly engaging social media captions optimized for the platform: ${platform}.
Topic/Content theme: "${topic}"
Tone of voice: ${tone}
Length requirements: ${lengthDesc}
Hashtags configuration: ${hashtagsDesc}

Return the response strictly as a JSON object adhering to this schema:
{
  "captions": [
    {
      "text": "The main caption text",
      "explanation": "A short, 1-sentence tip on why this caption works well for this platform."
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              captions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    explanation: { type: "string" }
                  },
                  required: ["text", "explanation"]
                }
              }
            },
            required: ["captions"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response received from Gemini.");
      }

      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error("Gemini Caption Generator error:", error);
      res.status(500).json({ error: error.message || "Failed to generate captions" });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/meta/exchange-token
  //
  // Authorization Code Exchange — swaps a short-lived authorization code for
  // a long-lived access token via server-to-server call to Meta.
  //
  // Flow:
  //   1. Browser opens Meta OAuth with response_type=code → user authorizes
  //   2. Meta redirects to /oauth/callback?code=XXXXX&state=facebook
  //   3. Browser posts the code here → server combines code + app_secret
  //   4. Server calls GET https://graph.facebook.com/v23.0/oauth/access_token
  //   5. Server returns the long-lived access token to the browser
  //
  // The client_secret NEVER reaches the browser — it lives only in server memory.
  // ────────────────────────────────────────────────────────────────────────────
  app.post("/api/meta/exchange-token", async (req, res) => {
    try {
      const { code, redirect_uri } = req.body;

      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Authorization code is required." });
      }

      const appId = process.env.VITE_META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;

      if (!appId || !appSecret) {
        return res.status(500).json({ error: "Meta App ID or App Secret is not configured on the server." });
      }

      // Use the provided redirect_uri or fall back to the default
      const effectiveRedirectUri = redirect_uri || `${process.env.APP_URL || "http://localhost:3000"}/oauth/callback`;

      // Server-to-server call to Meta to exchange code for access token
      const tokenUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", effectiveRedirectUri);
      tokenUrl.searchParams.set("code", code);

      const response = await fetch(tokenUrl.toString());
      const data = await response.json();

      if (data.error) {
        const errorMessage = data.error.message || "Token exchange failed.";
        console.error("Meta token exchange error:", data.error);
        return res.status(400).json({ error: errorMessage });
      }

      // Return the access token to the browser (ephemeral — never persisted)
      res.json({
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in
      });
    } catch (error: any) {
      console.error("Meta token exchange error:", error);
      res.status(500).json({ error: error.message || "Failed to exchange authorization code for access token." });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/posts/publish
  // 
  // STATELESS PUBLISH ENDPOINT — absolute garbage collection guaranteed:
  //
  // 1. Tokens arrive ephemerally in req.body.accounts[].accessToken
  //    (passed from browser after authorization code exchange — never from a database)
  //
  // 2. NO database connections (Firestore, MongoDB, PostgreSQL, Redis) are
  //    initialized or connected inside this route handler
  //
  // 3. NO files are written to disk (no /tmp, no fs.writeFile, no logging of tokens)
  //
  // 4. Token is used ONLY inside the publishToPlatform() call, then goes out
  //    of scope when the request handler completes — JavaScript GC destroys it
  //
  // 5. The response is sent and the request execution thread terminates.
  //    All local variables (accounts array, token strings, etc.) are collected.
  // ────────────────────────────────────────────────────────────────────────────
  app.post("/api/posts/publish", async (req, res) => {
    try {
      const { content, mediaUrl, accounts } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Post content is required." });
      }
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({ error: "At least one configured social account is required." });
      }

      const results = await Promise.all(accounts.map(async (account: PublishAccount) => {
        try {
          const published = await publishToPlatform(account, content, mediaUrl);
          return {
            accountId: account.id,
            platform: account.platform,
            success: true,
            ...published
          };
        } catch (error: any) {
          return {
            accountId: account.id,
            platform: account.platform,
            success: false,
            error: error.message || "Publishing failed."
          };
        }
      }));

      const failed = results.filter((result) => !result.success);
      res.status(failed.length ? 207 : 200).json({
        success: failed.length === 0,
        results
      });
    } catch (error: any) {
      console.error("Social publishing error:", error);
      res.status(500).json({ error: error.message || "Failed to publish post." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
