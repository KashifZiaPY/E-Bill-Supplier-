// Serverless function for Vercel: /api/gas
// Forwards requests to Google Apps Script Web App securely without exposing GAS_URL or GAS_API_KEY to the browser.

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed. Use POST.' });
  }

  // 1) Check PIN header
  const configuredPin = process.env.APP_PIN;
  const providedPin = req.headers['x-app-pin'] || req.headers['X-App-Pin'];

  if (configuredPin) {
    if (!providedPin || String(providedPin).trim() !== String(configuredPin).trim()) {
      return res.status(401).json({ ok: false, error: 'Invalid or missing App PIN.' });
    }
  }

  const gasUrl = process.env.GAS_URL;
  if (!gasUrl) {
    return res.status(503).json({
      ok: false,
      error: 'GAS_URL is not configured in environment variables. Please configure GAS_URL and GAS_API_KEY in Vercel or .env.',
      notConfigured: true
    });
  }

  try {
    // Parse body if needed
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
      try {
        bodyData = JSON.parse(bodyData);
      } catch (e) {
        // keep as is
      }
    }

    // Combine payload with GAS_API_KEY
    const forwardPayload = {
      ...(typeof bodyData === 'object' && bodyData !== null ? bodyData : {}),
      key: process.env.GAS_API_KEY || ''
    };

    // Forward to Google Apps Script Web App
    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(forwardPayload),
      redirect: 'follow'
    });

    const responseText = await gasResponse.text();
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
      error: error?.message || 'Failed to connect to Google Apps Script'
    });
  }
}
