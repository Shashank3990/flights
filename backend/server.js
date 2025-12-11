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

// Allow CORS from any origin (safe for demo). On prod restrict origin as needed.
app.use(cors());
app.use(express.json());

// Config from env
const OPENSKY_USER = process.env.OPENSKY_USER || "";
const OPENSKY_PASS = process.env.OPENSKY_PASS || "";
const PORT = parseInt(process.env.PORT || "5000", 10);

// Helper: generate N mock flights worldwide (random)
function generateMockFlights(n = 200) {
  const flights = [];
  for (let i = 0; i < n; i++) {
    const lat = (Math.random() * 180 - 90).toFixed(6);   // -90..+90
    const lon = (Math.random() * 360 - 180).toFixed(6);  // -180..+180
    const callsign = `MOCK${100 + i}`;
    const origin_country = ["USA","France","India","UAE","Brazil","Thailand","Spain"][Math.floor(Math.random()*7)];
    flights.push({
      icao24: `mock${i}`,
      callsign,
      origin_country,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      baro_altitude: Math.round(Math.random()*12000),
      velocity: Math.round(Math.random()*300),
      heading: Math.round(Math.random()*360),
      last_contact: Math.floor(Date.now()/1000)
    });
  }
  return flights;
}

// Route: /api/flights
app.get("/api/flights", async (req, res) => {
  try {
    // If user provided OpenSky credentials try to fetch from OpenSky REST
    if (OPENSKY_USER && OPENSKY_PASS) {
      const url = "https://opensky-network.org/api/states/all";
      const auth = {
        username: OPENSKY_USER,
        password: OPENSKY_PASS
      };

      // fetch states
      const resp = await axios.get(url, { auth, timeout: 10000 });

      // OpenSky returns { time, states: [ ... ] } where each state is an array
      const states = resp.data && resp.data.states ? resp.data.states : [];

      // Map to our flight objects (defensive checks)
      const flights = states
        .filter(s => s && typeof s === "object" && s.length >= 7)
        .map(f => ({
          icao24: f[0],
          callsign: (f[1] || "").trim() || null,
          origin_country: f[2] || null,
          last_contact: f[4] || null,
          longitude: f[5] !== null ? parseFloat(f[5]) : null,
          latitude: f[6] !== null ? parseFloat(f[6]) : null,
          baro_altitude: f[7] || null,
          on_ground: f[8] || null,
          velocity: f[9] || null,
          heading: f[10] || null,
          vertical_rate: f[11] || null
        }))
        .filter(f => f.latitude !== null && f.longitude !== null);

      // If OpenSky returned zero flights (rare) fall back to mock
      if (!flights || flights.length === 0) {
        console.warn("OpenSky returned 0 flights -> using mock set");
        return res.json({ source: "mock", count: 0, flights: generateMockFlights(200) });
      }

      return res.json({ source: "opensky", count: flights.length, flights });
    }

    // No credentials -> return global mock flights
    const mock = generateMockFlights(300);
    res.json({ source: "mock", count: mock.length, flights: mock });
  } catch (err) {
    console.error("Backend Error:", err.message || err);
    // On failure return mock flights so frontend still works
    const mock = generateMockFlights(200);
    res.status(200).json({ source: "fallback-mock", error: err.message || "open-sky fetch failed", count: mock.length, flights: mock });
  }
});

// health
app.get("/api/health", (_, res) => res.json({ ok: true }));

// serve basic message at root (optional)
app.get("/", (_, res) => res.send("Flight backend running"));

app.listen(PORT, () => console.log(`API running on port ${PORT}`));


