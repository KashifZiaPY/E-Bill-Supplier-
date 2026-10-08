// Serverless function for Vercel: /api/gas
// Forwards requests to Google Apps Script Web App securely without exposing GAS_URL or GAS_API_KEY to the browser.

export default async function handler(req: any, res: any) {
  // Allow POST and GET (for quick status checks)
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'Anwar Traders GAS Proxy',
      gasUrlConfigured: !!process.env.GAS_URL,
      gasApiKeyConfigured: !!process.env.GAS_API_KEY,
      appPinConfigured: !!process.env.APP_PIN,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed. Use POST.' });
  }

  // 1) Check PIN header
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

  // Parse body if needed
  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData);
    } catch {
      // keep
    }
  }

  // Diagnostics check action
  if (bodyData && bodyData.action === 'checkConfig') {
    return res.status(200).json({
      ok: true,
      config: {
        gasUrlConfigured: !!process.env.GAS_URL,
        gasApiKeyConfigured: !!process.env.GAS_API_KEY,
        appPinConfigured: !!process.env.APP_PIN,
      },
    });
  }

  const gasUrl = process.env.GAS_URL;
  if (!gasUrl) {
    return res.status(503).json({
      ok: false,
      error: 'GAS_URL is not configured in Vercel Environment Variables. Please set GAS_URL in Vercel Project Settings.',
      notConfigured: true,
      config: {
        gasUrlConfigured: false,
        gasApiKeyConfigured: !!process.env.GAS_API_KEY,
        appPinConfigured: !!process.env.APP_PIN,
      },
    });
  }

  try {
    // Pass API key both in URL query param AND inside JSON payload for 100% Apps Script compatibility
    let targetUrl = gasUrl;
    try {
      const parsedUrl = new URL(gasUrl);
      if (process.env.GAS_API_KEY) {
        parsedUrl.searchParams.set('key', process.env.GAS_API_KEY);
      }
      targetUrl = parsedUrl.toString();
    } catch (e) {
      // use gasUrl as is if parse fails
    }

    const forwardPayload = {
      ...(typeof bodyData === 'object' && bodyData !== null ? bodyData : {}),
      key: process.env.GAS_API_KEY || '',
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

    // Check if Google returned HTML instead of JSON (common when Web App permissions are wrong)
    const trimmed = responseText.trim();
    if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html')) {
      let specificHint = 'Google Apps Script returned an HTML page instead of JSON.';
      if (trimmed.includes('Sign in') || trimmed.includes('Service Login') || trimmed.includes('accounts.google.com')) {
        specificHint = 'Google Apps Script requires authentication. In Apps Script > Deploy > Manage deployments, ensure "Who has access" is set to "Anyone" (not "Only myself").';
      } else if (trimmed.includes('Script function not found') || trimmed.includes('Exception:')) {
        specificHint = 'Apps Script error. Check that Code.gs has doPost(e) function and sheets are initialized.';
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

    return res.status(gasResponse.status || 200).json(jsonResult);
  } catch (error: any) {
    console.error('Error forwarding to GAS:', error);
    return res.status(500).json({
      ok: false,
      error: `Failed to connect to Google Apps Script: ${error?.message || error}`,
    });
  }
}
