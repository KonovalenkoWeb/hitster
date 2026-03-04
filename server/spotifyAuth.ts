import SpotifyWebApi from 'spotify-web-api-node';

export function resolveSpotifyRedirectUri(): string {
  if (process.env.SPOTIFY_REDIRECT_URI) {
    return process.env.SPOTIFY_REDIRECT_URI;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/auth/spotify/callback`;
  }
  if (process.env.APP_BASE_URL) {
    const base = process.env.APP_BASE_URL.replace(/\/+$/, "");
    return `${base}/auth/spotify/callback`;
  }
  const port = process.env.PORT || "5050";
  return `http://localhost:${port}/auth/spotify/callback`;
}

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state'
];

export class SpotifyAuthService {
  private spotifyApi: SpotifyWebApi;

  constructor() {
    const clientId = process.env.SPOTIFY_CLIENT_ID || "";
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";

    this.spotifyApi = new SpotifyWebApi({
      clientId,
      clientSecret,
      redirectUri: resolveSpotifyRedirectUri()
    });
  }

  private assertConfigured() {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      throw new Error('Spotify is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.');
    }
  }

  getAuthorizationUrl(state: string): string {
    this.assertConfigured();
    return this.spotifyApi.createAuthorizeURL(SCOPES, state);
  }

  async handleCallback(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    this.assertConfigured();
    const data = await this.spotifyApi.authorizationCodeGrant(code);
    
    return {
      accessToken: data.body.access_token,
      refreshToken: data.body.refresh_token,
      expiresIn: data.body.expires_in
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    this.assertConfigured();
    this.spotifyApi.setRefreshToken(refreshToken);
    const data = await this.spotifyApi.refreshAccessToken();
    
    return {
      accessToken: data.body.access_token,
      expiresIn: data.body.expires_in
    };
  }

  async playTrack(accessToken: string, trackUri: string, deviceId?: string): Promise<void> {
    this.spotifyApi.setAccessToken(accessToken);
    
    await this.spotifyApi.play({
      uris: [trackUri],
      device_id: deviceId
    });
  }

  async pausePlayback(accessToken: string, deviceId?: string): Promise<void> {
    this.spotifyApi.setAccessToken(accessToken);
    await this.spotifyApi.pause({ device_id: deviceId });
  }

  async getDevices(accessToken: string): Promise<any[]> {
    this.spotifyApi.setAccessToken(accessToken);
    const data = await this.spotifyApi.getMyDevices();
    return data.body.devices || [];
  }
}

export const spotifyAuthService = new SpotifyAuthService();
