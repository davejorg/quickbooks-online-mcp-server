import dotenv from "dotenv";
import QuickBooks from "node-quickbooks";
import OAuthClient from "intuit-oauth";
import http from 'http';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client_id = process.env.QUICKBOOKS_CLIENT_ID;
const client_secret = process.env.QUICKBOOKS_CLIENT_SECRET;
const refresh_token = process.env.QUICKBOOKS_REFRESH_TOKEN;
const realm_id = process.env.QUICKBOOKS_REALM_ID;
const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
const redirect_uri = 'http://localhost:8000/callback';

// Only throw error if client_id or client_secret is missing
if (!client_id || !client_secret || !redirect_uri) {
  throw Error("Client ID, Client Secret and Redirect URI must be set in environment variables");
}

class QuickbooksClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private refreshToken?: string;
  private realmId?: string;
  private readonly environment: string;
  private accessToken?: string;
  private accessTokenExpiry?: Date;
  private quickbooksInstance?: QuickBooks;
  private oauthClient: OAuthClient;
  private isAuthenticating: boolean = false;
  private redirectUri: string;
  private refreshPromise: Promise<{ access_token: string; expires_in: number }> | null = null;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    refreshToken?: string;
    realmId?: string;
    environment: string;
    redirectUri: string;
  }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.refreshToken = config.refreshToken;
    this.realmId = config.realmId;
    this.environment = config.environment;
    this.redirectUri = config.redirectUri;
    this.oauthClient = new OAuthClient({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      environment: this.environment,
      redirectUri: this.redirectUri,
    });
    this.loadTokenState();
  }

  private get tokenStatePath(): string {
    return path.join(__dirname, '..', '..', '.token-state.json');
  }

  private get tokenStateLockPath(): string {
    return `${this.tokenStatePath}.lock`;
  }

  private loadTokenState(): void {
    try {
      const data = fs.readFileSync(this.tokenStatePath, 'utf-8');
      const state = JSON.parse(data);
      if (state.refresh_token) this.refreshToken = state.refresh_token;
      if (state.realm_id) this.realmId = state.realm_id;
      if (state.access_token) this.accessToken = state.access_token;
      if (state.access_token_expiry) this.accessTokenExpiry = new Date(state.access_token_expiry);
    } catch {
      // No persisted state or read error — fall back to env vars (already set)
    }
  }

  private persistTokenState(): void {
    const state = {
      refresh_token: this.refreshToken,
      realm_id: this.realmId,
      access_token: this.accessToken,
      access_token_expiry: this.accessTokenExpiry?.toISOString(),
      updated_at: new Date().toISOString(),
    };
    const tmpPath = this.tokenStatePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, this.tokenStatePath);
  }

  private async acquireTokenStateLock(
    timeoutMs = 15000,
    staleMs = 120000,
    pollMs = 200,
  ): Promise<() => Promise<void>> {
    const startedAt = Date.now();
    const lockContent = JSON.stringify({
      pid: process.pid,
      created_at: new Date().toISOString(),
    });

    while (Date.now() - startedAt <= timeoutMs) {
      try {
        const handle = await fsp.open(this.tokenStateLockPath, 'wx', 0o600);
        try {
          await handle.writeFile(lockContent, 'utf8');
        } finally {
          await handle.close();
        }

        let released = false;
        return async () => {
          if (released) return;
          released = true;
          try {
            await fsp.unlink(this.tokenStateLockPath);
          } catch (error: any) {
            if (error?.code !== 'ENOENT') {
              throw error;
            }
          }
        };
      } catch (error: any) {
        if (error?.code !== 'EEXIST') {
          throw error;
        }
      }

      try {
        const stat = await fsp.stat(this.tokenStateLockPath);
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fsp.unlink(this.tokenStateLockPath);
          continue;
        }
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          throw error;
        }
      }

      await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
    }

    throw new Error(`Timed out acquiring QuickBooks token lock after ${timeoutMs}ms`);
  }

  private async startOAuthFlow(): Promise<void> {
    if (this.isAuthenticating) {
      return;
    }

    this.isAuthenticating = true;
    const port = 8000;

    return new Promise((resolve, reject) => {
      // Create temporary server for OAuth callback
      const server = http.createServer(async (req, res) => {
        if (req.url?.startsWith('/callback')) {
          try {
            const response = await this.oauthClient.createToken(req.url);
            const tokens = response.token;
            
            // Save tokens
            this.refreshToken = tokens.refresh_token;
            this.realmId = tokens.realmId;
            this.saveTokensToEnv();
            this.persistTokenState();
            
            // Send success response
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  font-family: Arial, sans-serif;
                  background-color: #f5f5f5;
                ">
                  <h2 style="color: #2E8B57;">✓ Successfully connected to QuickBooks!</h2>
                  <p>You can close this window now.</p>
                </body>
              </html>
            `);
            
            // Close server after a short delay
            setTimeout(() => {
              server.close();
              this.isAuthenticating = false;
              resolve();
            }, 1000);
          } catch (error) {
            console.error('Error during token creation:', error);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  font-family: Arial, sans-serif;
                  background-color: #fff0f0;
                ">
                  <h2 style="color: #d32f2f;">Error connecting to QuickBooks</h2>
                  <p>Please check the console for more details.</p>
                </body>
              </html>
            `);
            this.isAuthenticating = false;
            reject(error);
          }
        }
      });

      // Start server
      server.listen(port, async () => {
        
        // Generate authorization URL with proper type assertion
        const authUri = this.oauthClient.authorizeUri({
          scope: [OAuthClient.scopes.Accounting as string],
          state: 'testState'
        }).toString();
        
        // Open browser automatically
        await open(authUri);
      });

      // Handle server errors
      server.on('error', (error) => {
        console.error('Server error:', error);
        this.isAuthenticating = false;
        reject(error);
      });
    });
  }

  private saveTokensToEnv(): void {
    const tokenPath = path.join(__dirname, '..', '..', '.env');
    const envContent = fs.readFileSync(tokenPath, 'utf-8');
    const envLines = envContent.split('\n');
    
    const updateEnvVar = (name: string, value: string) => {
      const index = envLines.findIndex(line => line.startsWith(`${name}=`));
      if (index !== -1) {
        envLines[index] = `${name}=${value}`;
      } else {
        envLines.push(`${name}=${value}`);
      }
    };

    if (this.refreshToken) updateEnvVar('QUICKBOOKS_REFRESH_TOKEN', this.refreshToken);
    if (this.realmId) updateEnvVar('QUICKBOOKS_REALM_ID', this.realmId);

    fs.writeFileSync(tokenPath, envLines.join('\n'));
  }

  async refreshAccessToken(): Promise<{ access_token: string; expires_in: number }> {
    // Mutex: coalesce concurrent refresh calls onto a single request
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this._doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<{ access_token: string; expires_in: number }> {
    const releaseLock = await this.acquireTokenStateLock();
    try {
      // Always reload persisted state before refresh to avoid stale in-memory tokens.
      this.loadTokenState();

      if (!this.refreshToken) {
        await this.startOAuthFlow();
        this.loadTokenState();
        if (!this.refreshToken) {
          throw new Error('Failed to obtain refresh token from OAuth flow');
        }
      }

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const tokenUsed: string = this.refreshToken ?? '';
        if (!tokenUsed) {
          throw new Error('Missing refresh token');
        }

        try {
          const authResponse = await this.oauthClient.refreshUsingToken(tokenUsed);

          this.accessToken = authResponse.token.access_token;
          this.refreshToken = authResponse.token.refresh_token;

          const expiresIn = authResponse.token.expires_in || 3600;
          this.accessTokenExpiry = new Date(Date.now() + expiresIn * 1000);
          this.persistTokenState();

          const refreshExpirySeconds = authResponse.token.x_refresh_token_expires_in;
          if (refreshExpirySeconds && refreshExpirySeconds < 30 * 24 * 3600) {
            const days = Math.round(refreshExpirySeconds / 86400);
            console.warn(`[QuickBooks] Refresh token expires in ${days} days — re-authorize soon`);
          }

          return { access_token: this.accessToken, expires_in: expiresIn };
        } catch (error: any) {
          const msg = error?.message || String(error);
          if (!msg.includes('invalid_grant')) {
            throw new Error(`Failed to refresh Quickbooks token: ${msg}`);
          }

          // If another process already rotated token, reload state and retry once.
          this.loadTokenState();
          if (attempt === 0 && this.refreshToken && this.refreshToken !== tokenUsed) {
            console.warn('[QuickBooks] Detected newer refresh token in state file, retrying refresh once');
            continue;
          }

          console.warn('[QuickBooks] invalid_grant — starting OAuth re-authorization flow');
          this.refreshToken = undefined;
          this.accessToken = undefined;
          this.accessTokenExpiry = undefined;
          await this.startOAuthFlow();
          this.loadTokenState();
          if (!this.refreshToken) {
            throw new Error('Failed to re-authorize after invalid_grant');
          }
        }
      }

      throw new Error('Failed to refresh Quickbooks token after retry');
    } finally {
      await releaseLock();
    }
  }

  async authenticate() {
    if (!this.refreshToken || !this.realmId) {
      await this.startOAuthFlow();
      
      // Verify we have both tokens after OAuth flow
      if (!this.refreshToken || !this.realmId) {
        throw new Error('Failed to obtain required tokens from OAuth flow');
      }
    }

    // Check if token exists and is still valid
    const now = new Date();
    if (!this.accessToken || !this.accessTokenExpiry || this.accessTokenExpiry <= now) {
      const tokenResponse = await this.refreshAccessToken();
      this.accessToken = tokenResponse.access_token;
    }
    
    // At this point we know all tokens are available
    this.quickbooksInstance = new QuickBooks(
      this.clientId,
      this.clientSecret,
      this.accessToken,
      false, // no token secret for OAuth 2.0
      this.realmId!, // Safe to use ! here as we checked above
      this.environment === 'sandbox', // use the sandbox?
      false, // debug?
      null, // minor version
      '2.0', // oauth version
      this.refreshToken
    );
    
    return this.quickbooksInstance;
  }
  
  getQuickbooks() {
    if (!this.quickbooksInstance) {
      throw new Error('Quickbooks not authenticated. Call authenticate() first');
    }
    return this.quickbooksInstance;
  }
}

export const quickbooksClient = new QuickbooksClient({
  clientId: client_id,
  clientSecret: client_secret,
  refreshToken: refresh_token,
  realmId: realm_id,
  environment: environment,
  redirectUri: redirect_uri,
});
