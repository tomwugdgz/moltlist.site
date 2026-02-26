import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("moltmcp.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    social_handle TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

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
    verified_by TEXT DEFAULT 'AI' -- 'AI' or 'Human'
  )
`);

// Migration: Add verified_by column if it doesn't exist
try {
  db.exec("ALTER TABLE mcp_servers ADD COLUMN verified_by TEXT DEFAULT 'AI'");
} catch (e) {
  // Column already exists or other error we can ignore for this simple migration
}

// Seed initial data if empty
const count = db.prepare("SELECT COUNT(*) as count FROM mcp_servers").get() as { count: number };
if (count.count === 0) {
  const seeds = [
    ["https://mcp.example.com/weather", "WeatherMCP", "Real-time weather data provider", JSON.stringify(["tools"]), "50/day", 4.5, 120, "Human"],
    ["https://api.molt.site/v1/mcp", "MoltCore", "Advanced reasoning and logic tools", JSON.stringify(["tools", "prompts"]), "Unlimited", 4.9, 850, "Human"],
    ["https://github.mcp.io", "GitMCP", "GitHub repository management interface", JSON.stringify(["tools", "resources"]), "OAuth based", 4.2, 430, "AI"],
    ["https://mcp.brave.com", "BraveSearchMCP", "Brave Search API integration for MCP", JSON.stringify(["tools"]), "Free Tier", 4.7, 210, "Human"],
    ["https://mcp.wolframalpha.com", "WolframMCP", "Computational knowledge engine", JSON.stringify(["tools", "resources"]), "100/mo", 4.8, 340, "AI"]
  ];
  const stmt = db.prepare("INSERT INTO mcp_servers (url, name, description, capabilities, quota_info, rating, stars, verified_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  seeds.forEach(s => stmt.run(...s));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      // 1. Initial Insert (Pending AI Review)
      const name = url.split('/')[2] || "New Interface";
      const stmt = db.prepare(`
        INSERT INTO mcp_servers (url, name, description, capabilities, quota_info, rating, verified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET last_checked = CURRENT_TIMESTAMP
        RETURNING id
      `);
      const result = stmt.get(url, name, "Pending AI evaluation...", JSON.stringify([]), "TBD", 0, "AI") as { id: number };
      const serverId = result.id;

      // 2. Immediate AI Evaluation
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are an autonomous MCP auditor. Evaluate this newly registered WebMCP URL: ${url}.
        If you can't access it, use the URL structure and common patterns to guess its purpose.
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
