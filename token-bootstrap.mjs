#!/usr/bin/env node
/**
 * Standalone token bootstrapper for QuickBooks MCP server.
 * Tests refresh tokens and creates .token-state.json if successful.
 * If no valid token found, starts OAuth flow for manual authorization.
 *
 * Usage: node token-bootstrap.mjs [--oauth] [--write-env-refresh]
 */
import OAuthClient from 'intuit-oauth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import open from 'open';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_STATE_PATH = path.join(__dirname, '.token-state.json');
const ENV_PATH = path.join(__dirname, '.env');

// Read env vars (prefer process.env, fall back to .env file)
function loadConfig() {
  // Read .env file for fallback values
  const envTokens = {};
  try {
    const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^(QUICKBOOKS_\w+)=(.+)$/);
      if (match && !match[2].includes('your_') && !match[2].includes('(')) {
        envTokens[match[1]] = match[2].trim();
      }
    }
  } catch { /* ignore */ }

  return {
    clientId: process.env.QUICKBOOKS_CLIENT_ID || envTokens.QUICKBOOKS_CLIENT_ID,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || envTokens.QUICKBOOKS_CLIENT_SECRET,
    refreshTokenEnv: process.env.QUICKBOOKS_REFRESH_TOKEN,
    refreshTokenDotenv: envTokens.QUICKBOOKS_REFRESH_TOKEN,
    realmId: process.env.QUICKBOOKS_REALM_ID || envTokens.QUICKBOOKS_REALM_ID,
    environment: process.env.QUICKBOOKS_ENVIRONMENT || 'production',
  };
}

async function tryRefresh(oauthClient, refreshToken, label) {
  if (!refreshToken) {
    console.log(`  [${label}] No token — skipping`);
    return null;
  }
  console.log(`  [${label}] Testing token candidate`);
  try {
    const response = await oauthClient.refreshUsingToken(refreshToken);
    console.log(`  [${label}] SUCCESS`);
    return response.token;
  } catch (err) {
    const msg = err?.message || String(err);
    console.log(`  [${label}] FAILED: ${msg.substring(0, 100)}`);
    return null;
  }
}

function saveTokenState(tokens, realmId) {
  const state = {
    refresh_token: tokens.refresh_token,
    realm_id: realmId,
    access_token: tokens.access_token,
    access_token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  const tmpPath = TOKEN_STATE_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, TOKEN_STATE_PATH);
  console.log(`\nSaved token state to ${TOKEN_STATE_PATH}`);
  console.log(`  access_token_expiry: ${state.access_token_expiry}`);
}

function updateEnvFile(refreshToken, realmId, writeEnvRefresh) {
  try {
    if (!fs.existsSync(ENV_PATH)) {
      return;
    }

    let content = fs.readFileSync(ENV_PATH, 'utf-8');
    const lines = content.split('\n');
    const update = (name, value) => {
      const idx = lines.findIndex(l => l.startsWith(`${name}=`));
      if (idx !== -1) lines[idx] = `${name}=${value}`;
      else lines.push(`${name}=${value}`);
    };
    if (writeEnvRefresh && refreshToken) update('QUICKBOOKS_REFRESH_TOKEN', refreshToken);
    if (realmId) update('QUICKBOOKS_REALM_ID', realmId);
    fs.writeFileSync(ENV_PATH, lines.join('\n'));
    if (writeEnvRefresh) {
      console.log(`Updated .env with latest realm + refresh token`);
    } else {
      console.log(`Updated .env with realm only (refresh token write disabled by default)`);
    }
  } catch (err) {
    console.warn(`Warning: could not update .env: ${err.message}`);
  }
}

async function startOAuthFlow(config) {
  const oauthClient = new OAuthClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    environment: config.environment,
    redirectUri: 'http://localhost:8000/callback',
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) return;
      try {
        const response = await oauthClient.createToken(req.url);
        const tokens = response.token;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Connected! You can close this window.</h2></body></html>');
        setTimeout(() => { server.close(); resolve(tokens); }, 500);
      } catch (err) {
        res.writeHead(500);
        res.end('OAuth error — check terminal');
        reject(err);
      }
    });

    server.listen(8000, async () => {
      const authUri = oauthClient.authorizeUri({
        scope: [OAuthClient.scopes.Accounting],
        state: 'bootstrap',
      }).toString();
      console.log(`\nOpening browser for authorization...`);
      console.log(`If browser doesn't open, visit:\n${authUri}\n`);
      await open(authUri);
    });

    server.on('error', reject);
  });
}

async function main() {
  const config = loadConfig();
  const args = new Set(process.argv.slice(2));
  const forceOAuth = args.has('--oauth');
  const writeEnvRefresh = args.has('--write-env-refresh');
  const allowedArgs = new Set(['--oauth', '--write-env-refresh']);
  const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));

  if (unknownArgs.length > 0) {
    console.error(`ERROR: unknown argument(s): ${unknownArgs.join(', ')}`);
    console.error('Usage: node token-bootstrap.mjs [--oauth] [--write-env-refresh]');
    process.exit(2);
  }

  if (!config.clientId || !config.clientSecret) {
    console.error('ERROR: QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET must be set');
    console.error('Run: op-load-keys  (or set env vars manually)');
    process.exit(1);
  }

  console.log(`QuickBooks Token Bootstrap`);
  console.log(`========================`);
  console.log(`Client ID: ${config.clientId.substring(0, 10)}...`);
  console.log(`Realm ID: ${config.realmId}`);
  console.log(`Environment: ${config.environment}`);
  console.log(`Token state path: ${TOKEN_STATE_PATH}`);
  console.log(`Token state exists: ${fs.existsSync(TOKEN_STATE_PATH)}`);

  if (forceOAuth) {
    console.log(`\n--oauth flag: skipping token test, going straight to OAuth flow`);
    const tokens = await startOAuthFlow(config);
    const realmId = tokens.realmId || config.realmId;
    saveTokenState(tokens, realmId);
    updateEnvFile(tokens.refresh_token, realmId, writeEnvRefresh);
    console.log(`\nDone! Restart your Claude Code session to pick up new tokens.`);
    process.exit(0);
  }

  const oauthClient = new OAuthClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    environment: config.environment,
    redirectUri: 'http://localhost:8000/callback',
  });

  // Collect unique tokens to try
  let existingStateToken = null;
  try {
    const state = JSON.parse(fs.readFileSync(TOKEN_STATE_PATH, 'utf-8'));
    existingStateToken = state.refresh_token;
  } catch { /* no state file */ }

  console.log(`\nTesting refresh tokens:`);

  // Try tokens in priority order: state file > .env > MCP env var
  const candidates = [
    [existingStateToken, '.token-state.json'],
    [config.refreshTokenDotenv, '.env file'],
    [config.refreshTokenEnv, 'MCP env var'],
  ];

  // Deduplicate
  const seen = new Set();
  const unique = candidates.filter(([token, _]) => {
    if (!token || seen.has(token)) return false;
    seen.add(token);
    return true;
  });

  let successTokens = null;
  for (const [token, label] of unique) {
    const result = await tryRefresh(oauthClient, token, label);
    if (result) {
      successTokens = result;
      break;
    }
  }

  if (successTokens) {
    const realmId = successTokens.realmId || config.realmId;
    saveTokenState(successTokens, realmId);
    updateEnvFile(successTokens.refresh_token, realmId, writeEnvRefresh);
    console.log(`\nDone! Restart your Claude Code session to pick up new tokens.`);
  } else {
    console.log(`\nAll refresh tokens are invalid. Starting OAuth flow...`);
    const tokens = await startOAuthFlow(config);
    const realmId = tokens.realmId || config.realmId;
    saveTokenState(tokens, realmId);
    updateEnvFile(tokens.refresh_token, realmId, writeEnvRefresh);
    console.log(`\nDone! Restart your Claude Code session to pick up new tokens.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
