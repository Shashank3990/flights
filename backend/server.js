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
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("public")); // serve frontend files from /public

const PORT = process.env.PORT || 5000;

/**
 * In-memory mock flights.
 * We'll generate N flights with global coordinates and then update them slightly
 * on every interval so successive API calls look like live movement.
 */
const NUM_FLIGHTS = 200; // increase/decrease as needed
const flights = {}; // keyed by icao24

// Helper: random number between min and max
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// Create initial flights
for (let i = 0; i < NUM_FLIGHTS; i++) {
  const id = `MOCK${1000 + i}`;
  flights[id] = {
    icao24: id,
    callsign: `MOCK${i}`,
    origin_country: ["USA","India","France","UAE","UK","Thailand","Germany","Brazil","Australia"][Math.floor(rand(0,9))],
    // Random global lat/lon
    latitude: Number(rand(-85, 85).toFixed(5)), 
    longitude: Number(rand(-180, 180).toFixed(5)),
    velocity: Number(rand(50, 950).toFixed(1)), // m/s roughly
    heading: Number(rand(0, 360).toFixed(1)),
    baro_altitude: Number(rand(0, 12000).toFixed(0))
  };
}

// Every second, update positions slightly (simulate motion)
setInterval(() => {
  Object.values(flights).forEach(f => {
    // Simple movement based on heading and velocity (very rough)
    // Convert heading degrees to radians; move small step
    const dist = Math.max(0.01, Math.abs(f.velocity) / 50000); // small step
    const rad = (f.heading * Math.PI) / 180;
    let dLat = Math.cos(rad) * dist;
    let dLon = Math.sin(rad) * dist;

    // sometimes change heading slightly
    if (Math.random() < 0.1) {
      f.heading = (f.heading + rand(-10, 10) + 360) % 360;
    }

    // occasionally change speed
    if (Math.random() < 0.05) {
      f.velocity = Math.max(30, Math.min(900, f.velocity + rand(-50, 50)));
    }

    // update coords
    f.latitude = parseFloat((f.latitude + dLat).toFixed(5));
    f.longitude = parseFloat((f.longitude + dLon).toFixed(5));

    // wrap lat/lon
    if (f.latitude > 89.9) f.latitude = 89.9;
    if (f.latitude < -89.9) f.latitude = -89.9;
    if (f.longitude > 180) f.longitude -= 360;
    if (f.longitude < -180) f.longitude += 360;

    // altitude small random changes
    f.baro_altitude = Math.max(0, Math.min(15000, Number((f.baro_altitude + rand(-50, 50)).toFixed(0))));
  });
}, 1000);

// API endpoint
app.get("/api/flights", (req, res) => {
  try {
    // convert to array
    const arr = Object.values(flights).map(f => ({
      icao24: f.icao24,
      callsign: f.callsign,
      origin_country: f.origin_country,
      latitude: f.latitude,
      longitude: f.longitude,
      velocity: f.velocity,
      heading: f.heading,
      baro_altitude: f.baro_altitude
    }));

    // send meta + flights
    res.json({ count: arr.length, flights: arr });
  } catch (err) {
    console.error("Backend Error:", err);
    res.status(500).json({ error: "Unable to get flight data" });
  }
});

// Serve index page if visiting root
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.listen(PORT, () => {
  console.log(`Mock flight backend listening on http://localhost:${PORT}`);
});




