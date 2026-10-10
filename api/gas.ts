// Serverless function / Express handler for /api/gas
// Forwards requests to Google Apps Script Web App securely and connects live to Google Sheets.
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.resolve(process.cwd(), '.gas_config.json');

function getStoredConfig(): { gasUrl?: string; gasApiKey?: string } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Ignore read errors
  }
  return {};
}

function saveStoredConfig(cfg: { gasUrl?: string; gasApiKey?: string }) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write .gas_config.json:', err);
  }
}

export default async function handler(req: any, res: any) {
  const stored = getStoredConfig();

  // Allow GET for quick status and connection checks
  if (req.method === 'GET') {
    const activeUrl = (process.env.GAS_URL || stored.gasUrl || '').trim();
    const activeKey = (process.env.GAS_API_KEY || stored.gasApiKey || '').trim();
    // Live backend version, read server-side from the Apps Script doGet
    // (avoids browser CORS issues with script.google.com redirects).
    let backendVersion: string | null = null;
    if (activeUrl) {
      try {
        const r = await fetch(activeUrl, { method: 'GET', redirect: 'follow' });
        const data: any = await r.json();
        if (data && data.version) backendVersion = String(data.version);
      } catch {
        // Leave null: the UI degrades gracefully.
      }
    }
    return res.status(200).json({
      ok: true,
      service: 'Anwar Traders & Hashir Traders GAS Proxy',
      gasUrlConfigured: !!activeUrl,
      gasApiKeyConfigured: !!activeKey,
      appPinConfigured: !!process.env.APP_PIN,
      deletePinConfigured: !!process.env.DELETE_PIN,
      backendVersion,
      gasUrlPreview: activeUrl ? (activeUrl.length > 55 ? activeUrl.substring(0, 42) + '...' + activeUrl.substring(activeUrl.length - 12) : activeUrl) : '',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed. Use POST.' });
  }

  // Parse body safely
  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData);
    } catch {
      // keep
    }
  }

  // 1) Check PIN header if APP_PIN is enforced
  const configuredPin = process.env.APP_PIN;
  const providedPin = req.headers['x-app-pin'] || req.headers['X-App-Pin'];

  if (configuredPin) {
    if (!providedPin || String(providedPin).trim() !== String(configuredPin).trim()) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid or missing App PIN. Please verify your PIN.',
      });
    }
  }

  // 1b) Destructive actions need the separate delete PIN when DELETE_PIN is configured.
  // This keeps day-to-day bill creators from deleting/cancelling without the
  // authority PIN, even though they hold the portal PIN.
  const DESTRUCTIVE_ACTIONS = ['deleteDoc', 'cancelDoc'];
  const configuredDeletePin = process.env.DELETE_PIN;
  const destructiveAction = String(bodyData?.action || '');
  if (configuredDeletePin && DESTRUCTIVE_ACTIONS.includes(destructiveAction)) {
    const providedDeletePin = req.headers['x-delete-pin'] || req.headers['X-Delete-Pin'];
    if (!providedDeletePin || String(providedDeletePin).trim() !== String(configuredDeletePin).trim()) {
      return res.status(401).json({
        ok: false,
        error: 'Delete authority PIN required. Enter the deletion PIN to continue.',
        deletePinRequired: true,
      });
    }
  }

  // Handle Action: Save GAS Configuration from UI
  if (bodyData && (bodyData.action === 'saveGasConfig' || bodyData.action === 'saveConfig')) {
    const newGasUrl = String(bodyData.payload?.gasUrl || bodyData.gasUrl || '').trim();
    const newApiKey = String(bodyData.payload?.gasApiKey || bodyData.gasApiKey || '').trim();
    saveStoredConfig({ gasUrl: newGasUrl, gasApiKey: newApiKey });
    return res.status(200).json({
      ok: true,
      message: 'Google Apps Script configuration saved successfully!',
      config: {
        gasUrlConfigured: !!newGasUrl,
        gasApiKeyConfigured: !!newApiKey,
        gasUrlPreview: newGasUrl ? (newGasUrl.length > 55 ? newGasUrl.substring(0, 42) + '...' + newGasUrl.substring(newGasUrl.length - 12) : newGasUrl) : '',
      },
    });
  }

  // Determine active GAS URL and API Key from all possible sources
  const headerGasUrl = (req.headers['x-gas-url'] || req.headers['X-Gas-Url'] || '') as string;
  const headerGasApiKey = (req.headers['x-gas-api-key'] || req.headers['X-Gas-Api-Key'] || '') as string;
  const bodyGasUrl = String(bodyData?.gasUrl || bodyData?.payload?.gasUrl || '').trim();
  const bodyGasApiKey = String(bodyData?.gasApiKey || bodyData?.payload?.gasApiKey || '').trim();

  const gasUrl = (headerGasUrl || bodyGasUrl || stored.gasUrl || process.env.GAS_URL || '').trim();
  const gasApiKey = (headerGasApiKey || bodyGasApiKey || stored.gasApiKey || process.env.GAS_API_KEY || '').trim();

  // Handle Action: Diagnostics / Check Configuration
  if (bodyData && (bodyData.action === 'checkConfig' || bodyData.action === 'getConfig')) {
    return res.status(200).json({
      ok: true,
      config: {
        gasUrlConfigured: !!gasUrl,
        gasApiKeyConfigured: !!gasApiKey,
        appPinConfigured: !!process.env.APP_PIN,
        deletePinConfigured: !!process.env.DELETE_PIN,
        gasUrlPreview: gasUrl ? (gasUrl.length > 55 ? gasUrl.substring(0, 42) + '...' + gasUrl.substring(gasUrl.length - 12) : gasUrl) : '',
      },
    });
  }

  if (!gasUrl) {
    return res.status(503).json({
      ok: false,
      error: 'Google Apps Script Web App URL is not configured. Please enter your Apps Script Web App URL in Settings > Google Sheets & Backend Connection.',
      notConfigured: true,
      config: {
        gasUrlConfigured: false,
        gasApiKeyConfigured: !!gasApiKey,
        appPinConfigured: !!process.env.APP_PIN,
      },
    });
  }

  try {
    // Pass API key both in URL query param AND inside JSON payload for 100% Apps Script compatibility
    let targetUrl = gasUrl;
    try {
      const parsedUrl = new URL(gasUrl);
      if (gasApiKey) {
        parsedUrl.searchParams.set('key', gasApiKey);
      }
      targetUrl = parsedUrl.toString();
    } catch (e) {
      // use gasUrl as is if parse fails
    }

    const forwardPayload = {
      ...(typeof bodyData === 'object' && bodyData !== null ? bodyData : {}),
      key: gasApiKey || '',
    };

    // Forward to Google Apps Script Web App
    const gasResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
      },
      body: JSON.stringify(forwardPayload),
      redirect: 'follow',
    });

    const responseText = await gasResponse.text();

    // Check if Google returned HTML instead of JSON (common when Web App permissions are restricted)
    const trimmed = responseText.trim();
    if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html')) {
      let specificHint = 'Google Apps Script returned an HTML page instead of JSON.';
      if (trimmed.includes('Sign in') || trimmed.includes('Service Login') || trimmed.includes('accounts.google.com')) {
        specificHint = 'Google Apps Script requires authorization. In Google Apps Script, click Deploy > Manage deployments > Edit > set "Who has access" to "Anyone" (not "Only myself"), then re-deploy.';
      } else if (trimmed.includes('Script function not found') || trimmed.includes('Exception:')) {
        specificHint = 'Apps Script error. Check that Code.gs has doPost(e) function and sheets are initialized.';
      } else if (trimmed.includes('404') || trimmed.includes('Not Found')) {
        specificHint = 'Google Apps Script returned 404 Not Found. Ensure your Web App URL ends with /exec and the deployment is active.';
      }

      return res.status(502).json({
        ok: false,
        error: specificHint,
        rawHtml: trimmed.substring(0, 500),
      });
    }

    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText);
    } catch {
      jsonResult = { ok: gasResponse.ok, data: responseText };
    }

    // Login audit: one Visits row per successful bootstrap (i.e. per PIN
    // login). Fire-and-forget with a timeout race so a slow log never delays
    // the login response. Geo/IP come from Vercel edge headers; only the
    // first three IP octets are stored.
    if (bodyData && bodyData.action === 'bootstrap' && jsonResult && jsonResult.ok) {
      try {
        const fwdFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        const ipParts = fwdFor.split('.');
        const shortIp = ipParts.length === 4 ? ipParts.slice(0, 3).join('.') + '.x' : (fwdFor ? fwdFor.substring(0, 24) : '');
        const ua = String(req.headers['user-agent'] || '');
        const isMobile = /mobile|android|iphone|ipad/i.test(ua);
        let browser = 'Other';
        if (/edg/i.test(ua)) browser = 'Edge';
        else if (/chrome/i.test(ua)) browser = 'Chrome';
        else if (/safari/i.test(ua)) browser = 'Safari';
        else if (/firefox/i.test(ua)) browser = 'Firefox';
        const visitPayload = {
          action: 'logVisit',
          payload: {
            event: 'login',
            country: String(req.headers['x-vercel-ip-country'] || ''),
            region: String(req.headers['x-vercel-ip-country-region'] || ''),
            city: (() => { try { return decodeURIComponent(String(req.headers['x-vercel-ip-city'] || '')); } catch { return ''; } })(),
            ip: shortIp,
            device: `${isMobile ? 'Mobile' : 'Desktop'} · ${browser}`,
          },
          key: gasApiKey || '',
        };
        const logReq = fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(visitPayload),
          redirect: 'follow',
        }).catch(() => null);
        await Promise.race([logReq, new Promise((r) => setTimeout(r, 2500))]);
      } catch {
        // Visit logging must never break login.
      }
    }

    return res.status(gasResponse.status || 200).json(jsonResult);
  } catch (error: any) {
    console.error('Error forwarding to GAS:', error);
    return res.status(500).json({
      ok: false,
      error: `Failed to connect to Google Apps Script: ${error?.message || error}`,
    });
  }
}
