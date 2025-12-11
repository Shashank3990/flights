// server.js
require('dotenv').config(); // if using a .env file locally
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const API_URL = "https://opensky-network.org/api/states/all";

const OPENSKY_USER = process.env.OPENSKY_USER || "";
const OPENSKY_PASS = process.env.OPENSKY_PASS || "";

// simple in-memory token cache
let tokenCache = {
  token: null,
  expiresAt: 0
};

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 5000) { // slight buffer
    return tokenCache.token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing OpenSky client credentials (OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET).");
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);

  const resp = await axios.post(TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const data = resp.data;
  // typical response: { access_token: "...", token_type: "bearer", expires_in: 1800, ... }
  tokenCache.token = data.access_token;
  tokenCache.expiresAt = Date.now() + (data.expires_in || 1800) * 1000;
  return tokenCache.token;
}

app.get("/api/flights", async (req, res) => {
  try {
    // obtain token
    const token = await getAccessToken();

    // optional: you can pass bounding box params like ?lamin=..&lomin=..&lamax=..&lomax=..
    const response = await axios.get(API_URL, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        // example: you can forward user's query params to filter area
        // lamin: req.query.lamin, lomin: req.query.lomin, lamax: req.query.lamax, lomax: req.query.lomax
      },
      timeout: 10000
    });

    const states = response.data.states || [];

    const flights = states
      .map(f => ({
        icao24: f[0],
        callsign: (f[1] || "").trim() || "Unknown",
        origin_country: f[2],
        last_contact: f[4],
        longitude: f[5],
        latitude: f[6],
        baro_altitude: f[7],
        on_ground: f[8],
        velocity: f[9],
        heading: f[10],
        vertical_rate: f[11]
      }))
      .filter(f => f.latitude && f.longitude);

    res.json({ count: flights.length, flights });
  } catch (error) {
    console.error("API error:", error?.response?.status, error?.response?.data || error.message);
    res.status(500).json({ error: "Unable to get live flight data" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
