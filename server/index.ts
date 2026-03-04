import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import fs from "fs";
import path from "path";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Required on Render/other reverse proxies so secure cookies work correctly over HTTPS.
app.set("trust proxy", 1);

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const file = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf("=");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    // Let .env override empty shell exports (e.g. SPOTIFY_CLIENT_ID="")
    if (!key || (process.env[key] !== undefined && process.env[key] !== "")) continue;

    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile();

function resolveSpotifyRedirectUriForLog(): string {
  if (process.env.SPOTIFY_REDIRECT_URI) return process.env.SPOTIFY_REDIRECT_URI;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}/auth/spotify/callback`;
  if (process.env.APP_BASE_URL) return `${process.env.APP_BASE_URL.replace(/\/+$/, "")}/auth/spotify/callback`;
  const port = process.env.PORT || "5050";
  return `http://localhost:${port}/auth/spotify/callback`;
}

log(`Spotify redirect URI: ${resolveSpotifyRedirectUriForLog()}`, "spotify");

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

declare module 'express-session' {
  interface SessionData {
    spotifyAccessToken?: string;
    spotifyRefreshToken?: string;
    spotifyTokenExpiry?: number;
    spotifyOAuthState?: string;
  }
}

app.use(express.json({
  limit: '10mb', // Increased limit for base64 photo uploads
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '10mb', extended: false }));

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

app.use(session({
  secret: process.env.SESSION_SECRET,
  proxy: app.get("env") === "production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { registerRoutes } = await import("./routes");
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
