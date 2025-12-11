// app.js - frontend logic
const map = L.map("map").setView([20, 0], 2); // world view

// two tile layers (light + dark-ish)
const tileLight = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
const tileCarto = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, attribution: '© Carto' });

tileCarto.addTo(map);

// layer control
L.control.layers({ "OSM": tileLight, "Carto Light": tileCarto }, {}).addTo(map);

// layer group for flights
const flightLayer = L.layerGroup().addTo(map);
const markers = {}; // keyed by icao24

// plane icon factory using divIcon with rotated img
function planeIcon(heading) {
  const rot = heading || 0;
  return L.divIcon({
    className: "plane-icon",
    html: `<img class="plane-icon-img" src="https://img.icons8.com/ios-glyphs/30/000000/airplane-take-off.png" style="transform:rotate(${rot}deg)" />`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

// smooth move helper
function smoothMove(marker, newLat, newLng) {
  if (!marker) return;
  const start = marker.getLatLng();
  const steps = 10;
  const duration = 600; // ms
  const delay = duration / steps;
  const dLat = (newLat - start.lat) / steps;
  const dLng = (newLng - start.lng) / steps;
  let i = 0;
  const id = setInterval(() => {
    if (i >= steps) {
      clearInterval(id);
      marker.setLatLng([newLat, newLng]);
      return;
    }
    marker.setLatLng([start.lat + dLat * i, start.lng + dLng * i]);
    i++;
  }, delay);
}

let lastData = null;

// load and update flights
async function loadFlights() {
  try {
    const res = await fetch("/api/flights");
    const data = await res.json();

    if (!data || !Array.isArray(data.flights)) {
      console.warn("No flights received from backend");
      return;
    }

    lastData = data;

    // build active id set
    const activeIds = new Set(data.flights.map(f => f.icao24));

    // remove markers no longer present
    for (const id in markers) {
      if (!activeIds.has(id)) {
        flightLayer.removeLayer(markers[id]);
        delete markers[id];
      }
    }

    // clear sidebar and repopulate filtered list later
    const listEl = document.getElementById("flight-list");
    listEl.innerHTML = "";

    // apply simple search filter
    const q = document.getElementById("search").value.trim().toLowerCase();

    // bounds for fit
    const bounds = [];

    data.flights.forEach(f => {
      // If existing, update position and rotation
      if (markers[f.icao24]) {
        smoothMove(markers[f.icao24], f.latitude, f.longitude);

        // rotate icon img inside marker
        const img = markers[f.icao24]._icon && markers[f.icao24]._icon.querySelector(".plane-icon-img");
        if (img) img.style.transform = `rotate(${f.heading}deg)`;
      } else {
        // create new marker
        const m = L.marker([f.latitude, f.longitude], { icon: planeIcon(f.heading) });
        m.bindPopup(`<b>${f.callsign}</b><br>${f.origin_country}<br>Alt: ${f.baro_altitude} m<br>Spd: ${f.velocity} m/s`);
        m.addTo(flightLayer);
        markers[f.icao24] = m;
      }

      // sidebar entry (apply search)
      if (!q || (f.callsign && f.callsign.toLowerCase().includes(q)) || (f.origin_country && f.origin_country.toLowerCase().includes(q))) {
        const card = document.createElement("div");
        card.className = "flight-card";
        card.innerHTML = `<strong>${f.callsign || "Unknown"} - ${f.origin_country}</strong>
                          <small>Lat: ${f.latitude.toFixed(2)}, Lon: ${f.longitude.toFixed(2)}</small>`;
        card.onclick = () => {
          map.flyTo([f.latitude, f.longitude], 6, { duration: 1.0 });
          markers[f.icao24].openPopup();
        };
        listEl.appendChild(card);
      }

      bounds.push([f.latitude, f.longitude]);
    });

    // fit to bounds if we have many visible flights
    if (bounds.length > 1) {
      const b = L.latLngBounds(bounds);
      // only fit if current view is outside or zoom is too close
      map.fitBounds(b, { maxZoom: 6, padding: [60, 60] });
    }
  } catch (err) {
    console.error("Failed to load flights:", err);
  }
}

// initial load + polling
loadFlights();
setInterval(loadFlights, 3000);

// search handler
document.getElementById("search").addEventListener("input", () => {
  // just re-render using lastData
  if (lastData) {
    // temporarily reassign to force list rebuild
    const tmp = lastData;
    lastData = null;
    // call loadFlights but use fetch? simpler: rebuild from tmp directly:
    (async function rebuild() {
      // create local shallow copy to feed UI update logic
      const fakeResp = { flights: tmp.flights };
      // emulate the same function logic: we'll re-run the UI update code by replacing lastData and calling loadFlights again.
      lastData = fakeResp;
      // we will not fetch — but call a simplified renderer:
      const data = fakeResp;
      const activeIds = new Set(data.flights.map(f => f.icao24));
      // remove markers not present (none)
      // rebuild list
      const listEl = document.getElementById("flight-list");
      listEl.innerHTML = "";
      const q = document.getElementById("search").value.trim().toLowerCase();
      data.flights.forEach(f => {
        if (!q || (f.callsign && f.callsign.toLowerCase().includes(q)) || (f.origin_country && f.origin_country.toLowerCase().includes(q))) {
            const card = document.createElement("div");
            card.className = "flight-card";
            card.innerHTML = `<strong>${f.callsign || "Unknown"} - ${f.origin_country}</strong>
                              <small>Lat: ${f.latitude.toFixed(2)}, Lon: ${f.longitude.toFixed(2)}</small>`;
            card.onclick = () => {
              map.flyTo([f.latitude, f.longitude], 6, { duration: 1.0 });
              markers[f.icao24] && markers[f.icao24].openPopup();
            };
            listEl.appendChild(card);
        }
      });
    })();
  }
});

// theme toggle
const toggleBtn = document.getElementById("toggle-theme");
toggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
});
