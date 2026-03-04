import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { randomBytes } from "crypto";
import { setupSocketHandlers } from "./socketHandlers";
import { spotifyAuthService } from "./spotifyAuth";
import { storage } from "./storage";
import { gameManager } from "./gameManager";
import { insertPlayerProfileSchema, updatePlayerProfileSchema } from "@shared/schema";
import { imageStorage } from "./imageStorage";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Spotify OAuth endpoints
  app.get('/auth/spotify', (req: Request, res: Response) => {
    try {
      const state = randomBytes(32).toString('hex');
      req.session.spotifyOAuthState = state;
      const authUrl = spotifyAuthService.getAuthorizationUrl(state);
      res.redirect(authUrl);
    } catch (error) {
      console.error('Spotify auth setup error:', error);
      res.redirect('/?error=spotify_not_configured');
    }
  });

  app.get('/auth/spotify/callback', async (req: Request, res: Response) => {
    const { code, error, state } = req.query;

    if (error || !code) {
      return res.redirect('/?error=spotify_auth_failed');
    }

    if (!state || state !== req.session.spotifyOAuthState) {
      console.error('OAuth state mismatch - possible CSRF attack');
      return res.redirect('/?error=spotify_csrf_detected');
    }

    delete req.session.spotifyOAuthState;

    try {
      const { accessToken, refreshToken, expiresIn } = await spotifyAuthService.handleCallback(code as string);
      
      req.session.spotifyAccessToken = accessToken;
      req.session.spotifyRefreshToken = refreshToken;
      req.session.spotifyTokenExpiry = Date.now() + expiresIn * 1000;

      res.redirect('/?spotify_connected=true');
    } catch (error) {
      console.error('Spotify OAuth callback error:', error);
      res.redirect('/?error=spotify_token_failed');
    }
  });

  app.get('/api/spotify/status', (req: Request, res: Response) => {
    const isConnected = !!(req.session.spotifyAccessToken && 
                          req.session.spotifyTokenExpiry && 
                          req.session.spotifyTokenExpiry > Date.now());
    
    res.json({ connected: isConnected });
  });

  app.get('/api/spotify/token', async (req: Request, res: Response) => {
    if (!req.session.spotifyAccessToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.session.spotifyTokenExpiry && req.session.spotifyTokenExpiry < Date.now()) {
      if (req.session.spotifyRefreshToken) {
        try {
          const { accessToken, expiresIn } = await spotifyAuthService.refreshAccessToken(req.session.spotifyRefreshToken);
          req.session.spotifyAccessToken = accessToken;
          req.session.spotifyTokenExpiry = Date.now() + expiresIn * 1000;
        } catch (error) {
          console.error('Token refresh failed:', error);
          return res.status(401).json({ error: 'Token refresh failed' });
        }
      } else {
        return res.status(401).json({ error: 'Token expired' });
      }
    }

    res.json({ accessToken: req.session.spotifyAccessToken });
  });

  app.post('/api/spotify/disconnect', (req: Request, res: Response) => {
    req.session.spotifyAccessToken = undefined;
    req.session.spotifyRefreshToken = undefined;
    req.session.spotifyTokenExpiry = undefined;
    
    res.json({ success: true });
  });

  app.get('/api/games/:code/meta', (req: Request, res: Response) => {
    const code = String(req.params.code || '').toUpperCase();
    const game = gameManager.getGame(code);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    return res.json({
      gameCode: code,
      mode: game.getMode()
    });
  });

  app.post('/api/catalog/availability', async (req: Request, res: Response) => {
    try {
      const { musicCatalogStubService } = await import('./musicCatalogStub');
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      const filters = musicCatalogStubService.parseFilters(raw);
      const availability = await musicCatalogStubService.getAvailabilityForFilters(filters);
      return res.json({
        filters,
        ...availability
      });
    } catch (error) {
      console.error('Catalog availability error:', error);
      return res.status(500).json({ error: 'Could not evaluate filter availability' });
    }
  });

  app.get('/api/catalogs', async (_req: Request, res: Response) => {
    try {
      const { musicCatalogStubService } = await import('./musicCatalogStub');
      const catalogs = await musicCatalogStubService.getCatalogOptions();
      return res.json({ catalogs });
    } catch (error) {
      console.error('Catalog list error:', error);
      return res.status(500).json({ error: 'Could not list catalogs' });
    }
  });

  app.get('/api/catalogs/:catalog/year-confidence', async (req: Request, res: Response) => {
    try {
      const catalog = String(req.params.catalog || "").trim();
      if (!catalog) return res.status(400).json({ error: "Catalog is required" });
      const limit = Math.max(1, Math.min(500, Number.parseInt(String(req.query.limit || "200"), 10) || 200));

      const { db } = await import("./db");
      const { songs } = await import("@shared/schema");

      const rows = await db
        .select({
          id: songs.id,
          externalId: songs.externalId,
          isrc: songs.isrc,
          title: songs.title,
          artist: songs.artist,
          year: songs.year,
          yearConfidence: songs.yearConfidence,
          yearSource: songs.yearSource,
          albumName: songs.albumName,
          albumType: songs.albumType,
          popularity: songs.popularity
        })
        .from(songs)
        .where(eq(songs.catalog, catalog))
        .limit(limit);

      const low = rows.filter((r) => r.yearConfidence === "low");
      const medium = rows.filter((r) => r.yearConfidence === "medium");
      const high = rows.filter((r) => r.yearConfidence === "high");

      return res.json({
        catalog,
        totalSampled: rows.length,
        summary: {
          high: high.length,
          medium: medium.length,
          low: low.length
        },
        lowConfidence: low
      });
    } catch (error) {
      console.error('Catalog confidence audit error:', error);
      return res.status(500).json({ error: 'Could not fetch confidence audit' });
    }
  });

  // Player Profile endpoints
  app.get('/api/profiles/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const profile = await storage.getPlayerProfile(id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      res.json(profile);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/profiles', async (req: Request, res: Response) => {
    try {
      const validated = insertPlayerProfileSchema.parse(req.body);
      const profile = await storage.createPlayerProfile(validated);
      
      res.status(201).json(profile);
    } catch (error: any) {
      console.error('Create profile error:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid profile data', details: error.errors });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/profiles/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validated = updatePlayerProfileSchema.parse(req.body);
      const profile = await storage.updatePlayerProfile(id, validated);
      
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      res.json(profile);
    } catch (error: any) {
      console.error('Update profile error:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid profile data', details: error.errors });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/profiles/:id/mark-used', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.updateLastUsed(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Mark profile used error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // AI profile generation is disabled in AI-free mode.
  app.post('/api/profiles/generate-ai', (_req: Request, res: Response) => {
    res.status(410).json({
      error: 'AI profile generation is disabled',
      message: 'Upload photo now serves as avatar directly.'
    });
  });

  // Serve profile images (thumbnails) with filesystem cache
  app.get('/api/profiles/images/:imageId', async (req: Request, res: Response) => {
    try {
      const { imageId } = req.params;
      const size = req.query.size as string; // 'full' or undefined (default: thumbnail)

      // Validate imageId format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(imageId)) {
        return res.status(400).json({ error: 'Invalid image ID' });
      }

      // Get thumbnail (cached) or full image
      const image = size === 'full'
        ? await imageStorage.getImage(imageId)
        : await imageStorage.getThumbnail(imageId);

      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Convert base64 to buffer and send
      const buffer = Buffer.from(image.data, 'base64');
      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.send(buffer);
    } catch (error) {
      console.error('Serve image error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" 
        ? false 
        : ["http://localhost:5000", "http://localhost:5173"],
      credentials: true
    }
  });

  setupSocketHandlers(io);

  return httpServer;
}
