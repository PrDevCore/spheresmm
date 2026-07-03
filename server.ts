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
