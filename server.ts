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
  // POST /api/posts/publish
  // 
  // STATELESS PUBLISH ENDPOINT — absolute garbage collection guaranteed:
  //
  // 1. Tokens arrive ephemerally in req.body.accounts[].accessToken
  //    (passed from browser's MetaOAuthButton popup flow — never from a database)
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
