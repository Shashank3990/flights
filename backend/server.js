// const express = require("express");
// const axios = require("axios");
// const cors = require("cors");

// const app = express();
// app.use(cors());

// app.get("/api/flights", async (req, res) => {
//   try {
//     const response = await axios.get(
//       "https://opensky-network.org/api/states/all"
//     );

//     const states = response.data.states || [];

//     const flights = states
//       .map(f => ({
//         icao24: f[0],
//         callsign: f[1]?.trim() || "Unknown",
//         origin_country: f[2],
//         last_contact: f[4],
//         longitude: f[5],
//         latitude: f[6],
//         baro_altitude: f[7],
//         on_ground: f[8],
//         velocity: f[9],
//         heading: f[10],
//         vertical_rate: f[11]
//       }))
//       .filter(f => f.latitude && f.longitude);

//     res.json({ count: flights.length, flights });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Unable to get live flight data" });
//   }
// });

// app.listen(5000, () => console.log("API running on http://localhost:5000"));

// server.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Read credentials from env (set these in Render environment variables)
const OPENSKY_USER = process.env.OPENSKY_USER || "";
const OPENSKY_PASS = process.env.OPENSKY_PASS || "";

/**
 * Generate N random global mock flights (latitude range -85..85, lon -180..180).
 * This ensures the frontend can show worldwide flights when the real API fails.
 */
function generateMockFlights(n = 200) {
  const countries = ["USA", "India", "France", "UAE", "Thailand", "Brazil", "Spain", "Australia"];
  const flights = [];
  for (let i = 0; i < n; i++) {
    const lat = (Math.random() * 170 - 85).toFixed(5);
    const lon = (Math.random() * 360 - 180).toFixed(5);
    flights.push({
      icao24: `MOCK${1000 + i}`,
      callsign: `MOCK${100 + i}`,
      origin_country: countries[Math.floor(Math.random()*countries.length)],
      longitude: parseFloat(lon),
      latitude: parseFloat(lat),
      baro_altitude: Math.round(Math.random()*12000),
      on_ground: false,
      velocity: Math.round(Math.random()*300),
      heading: Math.round(Math.random()*360),
      last_contact: Math.floor(Date.now()/1000)
    });
  }
  return flights;
}

app.get("/api/flights", async (req, res) => {
  try {
    // OpenSky states/all endpoint
    // Note: OpenSky uses HTTP Basic Auth (username + password)
    const url = "https://opensky-network.org/api/states/all";

    const auth = (OPENSKY_USER && OPENSKY_PASS) ? {
      auth: { username: OPENSKY_USER, password: OPENSKY_PASS },
      timeout: 8000
    } : { timeout: 8000 };

    // Try fetching from OpenSky
    const response = await axios.get(url, auth);

    // Response structure: { time:..., states: [ [...], ... ] }
    const states = (response.data && response.data.states) || [];

    // Map states array to nicer objects and filter out invalid positions
    const flights = states
      .map(s => ({
        icao24: s[0],
        callsign: (s[1] || "").trim(),
        origin_country: s[2],
        last_contact: s[4],
        longitude: s[5],
        latitude: s[6],
        baro_altitude: s[7],
        on_ground: s[8],
        velocity: s[9],
        heading: s[10],
        vertical_rate: s[11]
      }))
      .filter(f => f.latitude !== null && f.longitude !== null); // only include valid coords

    // If no flights returned (rare), fallback to mock
    if (!flights.length) {
      console.warn("OpenSky returned 0 flights → returning mock data");
      return res.json({ count: 0, flights: generateMockFlights(400) });
    }

    res.json({ count: flights.length, flights });
  } catch (err) {
    console.error("OpenSky API Error:", err && err.message ? err.message : err);

    // If OpenSky returns 401, 403, 429, etc, return mock global data instead of failing
    const fallback = generateMockFlights(500);
    return res.status(200).json({ count: fallback.length, flights: fallback, mocked: true, error: String(err && err.message) });
  }
});

// Serve a minimal health route
app.get("/", (_req, res) => res.send("Flight backend running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
