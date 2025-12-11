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

const PORT = process.env.PORT || 5000;
const OPENSKY_USER = process.env.OPENSKY_USER || "";
const OPENSKY_PASS = process.env.OPENSKY_PASS || "";

/**
 * Map OpenSky `states` array -> flight object used by frontend
 * OpenSky state array: https://opensky-network.org/apidoc/rest.html#all-state-vectors
 */
function mapOpenSkyState(s) {
  return {
    icao24: s[0],
    callsign: (s[1] || "").trim() || "Unknown",
    origin_country: s[2] || "Unknown",
    last_contact: s[4] || 0,
    longitude: (typeof s[5] === "number") ? s[5] : null,
    latitude: (typeof s[6] === "number") ? s[6] : null,
    baro_altitude: s[7] || 0,
    on_ground: !!s[8],
    velocity: s[9] || 0,
    heading: s[10] || 0,
    vertical_rate: s[11] || 0,
  };
}

/** Generate mock flights so frontend always has data (helpful for testing & no-API mode) */
// function generateMockFlights(center = { lat: 20, lon: 78 }, count = 40) {
//   const flights = [];
//   for (let i = 0; i < count; i++) {
//     const jitterLat = (Math.random() - 0.5) * 6; // +/-3°
//     const jitterLon = (Math.random() - 0.5) * 6;
//     flights.push({
//       icao24: "mock" + i.toString(36),
//       callsign: "MOCK" + (100 + i),
//       origin_country: ["India", "USA", "France", "UAE", "Thailand"][Math.floor(Math.random()*5)],
//       last_contact: Date.now() / 1000,
//       latitude: +(center.lat + jitterLat).toFixed(6),
//       longitude: +(center.lon + jitterLon).toFixed(6),
//       baro_altitude: Math.round(1000 + Math.random() * 10000),
//       on_ground: false,
//       velocity: +(100 + Math.random()*200).toFixed(1),
//       heading: Math.round(Math.random()*360),
//       vertical_rate: 0
//     });
//   }
function randomFlight(id) {
    return {
        icao24: "MOCK" + id,
        callsign: "FL-" + id,
        origin_country: ["USA", "France", "India", "UAE", "Japan", "UK"][Math.floor(Math.random() * 6)],
        
        // WORLDWIDE Lat–Lon 🌍
        latitude: (Math.random() * 180 - 90).toFixed(2),    // -90 to 90
        longitude: (Math.random() * 360 - 180).toFixed(2), // -180 to 180
        
        velocity: (Math.random() * 900).toFixed(1),
        heading: (Math.random() * 360).toFixed(1),
        baro_altitude: (Math.random() * 12000).toFixed(0)
    };
}
  return flights;
}

async function fetchOpenSkyStates() {
  const url = "https://opensky-network.org/api/states/all";
  // If credentials are present, use basic auth
  const axiosConfig = {};
  if (OPENSKY_USER && OPENSKY_PASS) {
    axiosConfig.auth = { username: OPENSKY_USER, password: OPENSKY_PASS };
  }
  const resp = await axios.get(url, axiosConfig);
  // resp.data.states is an array of arrays (OpenSky format)
  return resp.data.states || [];
}

app.get("/api/flights", async (req, res) => {
  try {
    // If user provided OpenSky credentials in env -> use them.
    // Otherwise return mock flights so frontend won't break.
    let flights = [];

    if (OPENSKY_USER && OPENSKY_PASS) {
      // try to fetch from OpenSky
      const states = await fetchOpenSkyStates();
      flights = states.map(mapOpenSkyState).filter(f => f.latitude !== null && f.longitude !== null);
    } else {
      // No credentials -> return mock flights centered on India (lat 20 lon 78)
      flights = generateMockFlights({ lat: 20, lon: 78 }, 120);
    }

    return res.json({ count: flights.length, flights });
  } catch (err) {
    // Log full error for server logs (Render logs)
    console.error("Backend Error fetching flights:", err && err.toString ? err.toString() : err);

    // If the upstream responded with status and body, include for debugging (don't leak secrets)
    if (err.response) {
      console.error("Upstream status:", err.response.status, "data:", err.response.data);
    }

    // Return a friendly error to client but still a well formed JSON so frontend doesn't crash:
    return res.status(500).json({ error: "Unable to fetch live data", details: err && err.message ? err.message : "unknown" });
  }
});

// Simple health endpoint
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (env OPENSKY_USER ${OPENSKY_USER ? "SET" : "NOT SET"})`);
});


