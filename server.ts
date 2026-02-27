import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("moltlist_site.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    social_handle TEXT,
    provider TEXT,
    provider_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add OAuth columns to users table if they don't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN provider TEXT");
  db.exec("ALTER TABLE users ADD COLUMN provider_id TEXT");
} catch (e) {
  // Columns already exist
}

db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    name TEXT,
    description TEXT,
    capabilities TEXT,
    quota_info TEXT,
    rating REAL DEFAULT 0,
    stars INTEGER DEFAULT 0,
    last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
    ai_review TEXT,
    verified_by TEXT DEFAULT 'AI', -- 'AI' or 'Human'
    wallet_address TEXT,
    is_premium INTEGER DEFAULT 0,
    fee_type TEXT DEFAULT 'free', -- 'free' or 'gas_fee'
    interface_file TEXT,
    usage_instructions TEXT,
    domain TEXT,
    tool_name TEXT,
    category TEXT,
    docs_url TEXT
  )
`);

// Migration: Add new columns if they don't exist
const migrations = [
  "ALTER TABLE mcp_servers ADD COLUMN wallet_address TEXT",
  "ALTER TABLE mcp_servers ADD COLUMN is_premium INTEGER DEFAULT 0",
  "ALTER TABLE mcp_servers ADD COLUMN fee_type TEXT DEFAULT 'free'",
  "ALTER TABLE mcp_servers ADD COLUMN verified_by TEXT DEFAULT 'AI'",
  "ALTER TABLE mcp_servers ADD COLUMN interface_file TEXT",
  "ALTER TABLE mcp_servers ADD COLUMN usage_instructions TEXT",
  "ALTER TABLE mcp_servers ADD COLUMN domain TEXT",
  "ALTER TABLE mcp_servers ADD COLUMN tool_name TEXT",
  "ALTER TABLE mcp_servers ADD COLUMN category TEXT",
  "ALTER TABLE mcp_servers ADD COLUMN docs_url TEXT"
];

migrations.forEach(m => {
  try {
    db.exec(m);
  } catch (e) {
    // Column already exists
  }
});

// Seed initial data if empty
const count = db.prepare("SELECT COUNT(*) as count FROM mcp_servers").get() as { count: number };
if (count.count === 0) {
  const seeds = [
    ["https://mcp.example.com/weather", "WeatherMCP", "Real-time weather data provider", JSON.stringify(["tools"]), "50/day", 4.5, 120, "Human", "0x123...abc", 1, "gas_fee", "https://mcp.example.com/weather/openapi.json", "Call GET /current with a city name."],
    ["https://api.molt.site/v1/mcp", "MoltCore", "Advanced reasoning and logic tools", JSON.stringify(["tools", "prompts"]), "Unlimited", 4.9, 850, "Human", "0x456...def", 1, "gas_fee", "https://api.molt.site/v1/mcp/schema", "Use the 'reason' tool for complex logic."],
    ["https://github.mcp.io", "GitMCP", "GitHub repository management interface", JSON.stringify(["tools", "resources"]), "OAuth based", 4.2, 430, "AI", null, 0, "free", null, "Standard GitHub API patterns."],
    ["https://mcp.brave.com", "BraveSearchMCP", "Brave Search API integration for MCP", JSON.stringify(["tools"]), "Free Tier", 4.7, 210, "Human", null, 0, "free", "https://mcp.brave.com/docs", "Search using the 'web_search' tool."],
    ["https://mcp.wolframalpha.com", "WolframMCP", "Computational knowledge engine", JSON.stringify(["tools", "resources"]), "100/mo", 4.8, 340, "AI", "0x789...ghi", 1, "gas_fee", null, "Query using natural language."]
  ];
  const stmt = db.prepare("INSERT INTO mcp_servers (url, name, description, capabilities, quota_info, rating, stars, verified_by, wallet_address, is_premium, fee_type, interface_file, usage_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  seeds.forEach(s => stmt.run(...s));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // OAuth Configuration
  const getRedirectUri = () => `${process.env.APP_URL}/auth/callback`;

  app.get("/api/auth/url", (req, res) => {
    const { provider } = req.query;
    let url = "";

    if (provider === "google") {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: getRedirectUri(),
        response_type: "code",
        scope: "openid email profile",
        state: "google",
      });
      url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } else if (provider === "github") {
      const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        redirect_uri: getRedirectUri(),
        scope: "user:email",
        state: "github",
      });
      url = `https://github.com/login/oauth/authorize?${params}`;
    }

    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Code missing");

    try {
      let email = "";
      let socialHandle = "";
      let providerId = "";

      if (state === "google") {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: code as string,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: getRedirectUri(),
            grant_type: "authorization_code",
          }),
        });
        const tokens = await tokenRes.json();
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await userRes.json();
        email = profile.email;
        socialHandle = profile.name;
        providerId = profile.sub;
      } else if (state === "github") {
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID!,
            client_secret: process.env.GITHUB_CLIENT_SECRET!,
            code,
            redirect_uri: getRedirectUri(),
          }),
        });
        const tokens = await tokenRes.json();
        const userRes = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await userRes.json();
        
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const emails = await emailsRes.json();
        email = emails.find((e: any) => e.primary)?.email || emails[0]?.email;
        socialHandle = profile.login;
        providerId = profile.id.toString();
      }

      if (email) {
        const stmt = db.prepare(`
          INSERT INTO users (email, social_handle, provider, provider_id)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET social_handle = excluded.social_handle, provider = excluded.provider, provider_id = excluded.provider_id
        `);
        stmt.run(email, socialHandle, state as string, providerId);
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', email: '${email}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (e) {
      console.error(e);
      res.status(500).send("Authentication failed");
    }
  });

  // API Routes
  app.post("/api/register", (req, res) => {
    const { email, socialHandle } = req.body;
    if (!email || !socialHandle) return res.status(400).json({ error: "Missing fields" });
    try {
      const stmt = db.prepare("INSERT INTO users (email, social_handle) VALUES (?, ?)");
      stmt.run(email, socialHandle);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/register-mcp", async (req, res) => {
    const { url, walletAddress, feeType, interfaceFile, usageInstructions } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      // 1. Initial Insert (Pending AI Review)
      const name = url.split('/')[2] || "New Interface";
      const isPremium = feeType === 'gas_fee' ? 1 : 0;
      
      const stmt = db.prepare(`
        INSERT INTO mcp_servers (url, name, description, capabilities, quota_info, rating, verified_by, wallet_address, is_premium, fee_type, interface_file, usage_instructions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET last_checked = CURRENT_TIMESTAMP
        RETURNING id
      `);
      const result = stmt.get(
        url, 
        name, 
        "Pending AI evaluation...", 
        JSON.stringify([]), 
        "TBD", 
        0, 
        "AI", 
        walletAddress || null, 
        isPremium, 
        feeType || 'free',
        interfaceFile || null,
        usageInstructions || null
      ) as { id: number };
      const serverId = result.id;

      // 2. Immediate AI Evaluation
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are an autonomous MCP auditor for MoltList.site (a Moltbook-inspired directory). 
        Evaluate this newly registered WebMCP URL: ${url}.
        Interface File: ${interfaceFile || 'Not provided'}.
        Usage Instructions: ${usageInstructions || 'Not provided'}.
        Business Model: ${feeType === 'gas_fee' ? 'Premium (0.01% gas fee)' : 'Free Tier'}.
        
        If you can't access it, use the provided info and URL structure to guess its purpose.
        Provide:
        1. A professional name for the service.
        2. A concise description (max 150 chars).
        3. Capabilities (array of strings like "tools", "resources", "prompts").
        4. A utility rating (1.0 to 5.0) - be strict, reject "pollution" (low quality).
        5. A short AI audit note.
        
        Format as JSON: { "name": "...", "description": "...", "capabilities": [...], "rating": 4.2, "audit": "..." }`,
        config: { responseMimeType: "application/json" }
      });

      const aiResult = JSON.parse(response.text || "{}");
      
      db.prepare(`
        UPDATE mcp_servers 
        SET name = ?, description = ?, capabilities = ?, rating = ?, ai_review = ?, last_checked = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        aiResult.name || name,
        aiResult.description || "No description provided.",
        JSON.stringify(aiResult.capabilities || []),
        aiResult.rating || 0,
        aiResult.audit || "Audit complete.",
        serverId
      );

      res.json({ success: true, serverId, rating: aiResult.rating });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Autonomous registration failed" });
    }
  });

  app.post("/api/register-human-mcp", async (req, res) => {
    const { domain, toolName, endpoint, description, category, docsUrl } = req.body;
    if (!endpoint || !domain || !toolName) return res.status(400).json({ error: "Required fields missing" });

    try {
      // 1. Initial Insert (Verified by Human)
      const stmt = db.prepare(`
        INSERT INTO mcp_servers (url, name, description, capabilities, quota_info, rating, verified_by, domain, tool_name, category, docs_url, fee_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET last_checked = CURRENT_TIMESTAMP
        RETURNING id
      `);
      
      const result = stmt.get(
        endpoint, 
        toolName, 
        description || "Manual entry", 
        JSON.stringify(["tools"]), 
        "Manual", 
        5.0, // Default high rating for human verified
        "Human", 
        domain,
        toolName,
        category || "Developer",
        docsUrl || null,
        'free'
      ) as { id: number };
      const serverId = result.id;

      // 2. Immediate AI Review (for consistency)
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are an autonomous MCP auditor for MoltList.site. 
        A human has manually registered this WebMCP interface:
        Domain: ${domain}
        Tool Name: ${toolName}
        Endpoint: ${endpoint}
        Description: ${description}
        Category: ${category}
        Docs: ${docsUrl}
        
        Please provide a professional AI audit note confirming the validity of this manual entry. 
        Format as JSON: { "audit": "..." }`,
        config: { responseMimeType: "application/json" }
      });

      const aiResult = JSON.parse(response.text || "{}");
      
      db.prepare(`
        UPDATE mcp_servers 
        SET ai_review = ?, last_checked = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        aiResult.audit || "Human verified entry confirmed.",
        serverId
      );

      res.json({ success: true, serverId });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Human registration failed" });
    }
  });

  app.get("/api/servers", (req, res) => {
    try {
      const q = req.query.q as string || "";
      const minStars = parseInt(req.query.minStars as string) || 0;
      const verifiedBy = req.query.verifiedBy as string || ""; // 'AI' or 'Human'
      
      let query = "SELECT * FROM mcp_servers WHERE (name LIKE ? OR description LIKE ? OR url LIKE ?) AND stars >= ?";
      const params: any[] = [`%${q}%`, `%${q}%`, `%${q}%`, minStars];
      
      if (verifiedBy) {
        query += " AND verified_by = ?";
        params.push(verifiedBy);
      }
      
      query += " ORDER BY rating DESC";
      
      const stmt = db.prepare(query);
      const servers = stmt.all(...params);
      res.json(servers);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch servers" });
    }
  });

  // Self-documenting WebMCP interface for AI agents
  app.get("/mcp.json", (req, res) => {
    res.json({
      mcp_version: "1.0",
      name: "MoltList.site API",
      description: "Autonomous directory and search engine for WebMCP interfaces.",
      capabilities: {
        tools: [
          {
            name: "search_servers",
            description: "Search for WebMCP servers by query and star count.",
            parameters: {
              type: "object",
              properties: {
                q: { type: "string", description: "Search query" },
                minStars: { type: "number", description: "Minimum star count" }
              }
            }
          },
          {
            name: "register_server",
            description: "Register a new WebMCP interface to the directory.",
            parameters: {
              type: "object",
              properties: {
                url: { type: "string", description: "Documentation URL" },
                walletAddress: { type: "string", description: "Crypto wallet for fees" },
                feeType: { type: "string", enum: ["free", "gas_fee"] },
                interfaceFile: { type: "string", description: "URL to the interface schema (OpenAPI/MCP)" },
                usageInstructions: { type: "string", description: "Instructions for AI usage" }
              },
              required: ["url"]
            }
          }
        ]
      },
      instructions: "AI agents should use 'search_servers' to discover tools and 'register_server' to add new ones. All entries are audited by an autonomous AI layer."
    });
  });

  app.post("/api/crawl", async (req, res) => {
    // In a real app, this would crawl the web. 
    // For this demo, we'll simulate discovery of a new server.
    const { url } = req.body;
    
    if (url) {
      try {
        // Simple mock of discovery
        const mockData = {
          name: url.split('/')[2] || "Unknown Server",
          description: "Automatically discovered WebMCP interface.",
          capabilities: JSON.stringify(["tools", "resources"]),
          quota_info: "100 requests/min",
          rating: (Math.random() * 5).toFixed(1),
          stars: Math.floor(Math.random() * 1000)
        };

        const stmt = db.prepare(`
          INSERT INTO mcp_servers (url, name, description, capabilities, quota_info, rating, stars)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET last_checked = CURRENT_TIMESTAMP
        `);
        stmt.run(url, mockData.name, mockData.description, mockData.capabilities, mockData.quota_info, mockData.rating, mockData.stars);
        
        return res.json({ success: true, message: "Server indexed" });
      } catch (e) {
        return res.status(500).json({ error: "Failed to index" });
      }
    }

    res.json({ success: true, message: "Crawl complete (simulated)" });
  });

  app.post("/api/ai-evaluate", async (req, res) => {
    const { serverId } = req.body;
    const server = db.prepare("SELECT * FROM mcp_servers WHERE id = ?").get(serverId) as any;
    
    if (!server) return res.status(404).json({ error: "Server not found" });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Audit this WebMCP server:
        Name: ${server.name}
        URL: ${server.url}
        Description: ${server.description}
        Capabilities: ${server.capabilities}
        
        Provide a concise AI review (max 200 chars) and a new rating from 1-5. Be critical.
        Format as JSON: { "review": "...", "rating": 4.5 }`,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "{}");
      db.prepare("UPDATE mcp_servers SET ai_review = ?, rating = ? WHERE id = ?")
        .run(result.review, result.rating, serverId);

      res.json({ success: true, review: result.review, rating: result.rating });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "AI evaluation failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
