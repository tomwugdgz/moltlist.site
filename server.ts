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
    ai_review TEXT
  )
`);

// Seed initial data if empty
const count = db.prepare("SELECT COUNT(*) as count FROM mcp_servers").get() as { count: number };
if (count.count === 0) {
  const seeds = [
    ["https://mcp.example.com/weather", "WeatherMCP", "Real-time weather data provider", JSON.stringify(["tools"]), "50/day", 4.5],
    ["https://api.molt.site/v1/mcp", "MoltCore", "Advanced reasoning and logic tools", JSON.stringify(["tools", "prompts"]), "Unlimited", 4.9],
    ["https://github.mcp.io", "GitMCP", "GitHub repository management interface", JSON.stringify(["tools", "resources"]), "OAuth based", 4.2],
    ["https://mcp.brave.com", "BraveSearchMCP", "Brave Search API integration for MCP", JSON.stringify(["tools"]), "Free Tier", 4.7],
    ["https://mcp.wolframalpha.com", "WolframMCP", "Computational knowledge engine", JSON.stringify(["tools", "resources"]), "100/mo", 4.8]
  ];
  const stmt = db.prepare("INSERT INTO mcp_servers (url, name, description, capabilities, quota_info, rating) VALUES (?, ?, ?, ?, ?, ?)");
  seeds.forEach(s => stmt.run(...s));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/servers", (req, res) => {
    const q = req.query.q as string || "";
    const stmt = db.prepare("SELECT * FROM mcp_servers WHERE name LIKE ? OR description LIKE ? OR url LIKE ? ORDER BY rating DESC");
    const servers = stmt.all(`%${q}%`, `%${q}%`, `%${q}%`);
    res.json(servers);
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
          rating: (Math.random() * 5).toFixed(1)
        };

        const stmt = db.prepare(`
          INSERT INTO mcp_servers (url, name, description, capabilities, quota_info, rating)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET last_checked = CURRENT_TIMESTAMP
        `);
        stmt.run(url, mockData.name, mockData.description, mockData.capabilities, mockData.quota_info, mockData.rating);
        
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
        contents: `Evaluate this WebMCP server:
        Name: ${server.name}
        URL: ${server.url}
        Description: ${server.description}
        Capabilities: ${server.capabilities}
        
        Provide a concise AI review (max 200 chars) and a new rating from 1-5 based on its perceived utility and reliability. 
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
