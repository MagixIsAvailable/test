// Main Initialization and Application Logic
import { setupVisuals } from './visuals.js';
import { makeDraggable, setupVR, fixInjectedWarning } from './ui.js';

// --- 1. CONFIGURATION ---
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzYjA5MjdiOC1jNzA5LTQ4NDMtODI5NS1mZWQ5YTIyYmY3ODMiLCJpZCI6NjE4Nywic2NvcGVzIjpbImFzciIsImdjIl0sImlhdCI6MTU0NTU2MTQyM30.Xoz6eKvitWfZamO2bGahg6vPKUvqNST_jApymD-hEpQ';

// --- 2. INITIALIZE VIEWER ---
const viewer = new Cesium.Viewer('cesiumContainer', {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    animation: true,
    timeline: true,
    fullscreenButton: false,
    vrButton: false, 
    infoBox: false,
    selectionIndicator: false,
    baseLayerPicker: true,
    shouldAnimate: true
});

viewer.resolutionScale = 0.8;
viewer.camera.flyHome(0);

// Add Hotspot Entities
viewer.entities.add({
    id: "nitrogen-farm",
    name: "Intensive Agriculture Zone (Nitrogen)",
    position: Cesium.Cartesian3.fromDegrees(-10, 45, 1000), 
    billboard: {
        image: 'https://img.icons8.com/color/48/000000/sprout.png',
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.8
    },
    label: {
        text: "Nitrogen Hotspot (Europe)",
        font: '12pt sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -50),
        showBackground: true
    }
});

viewer.entities.add({
    id: "biodiversity-amazon",
    name: "Amazon Tropical Rainforest (Biodiversity)",
    position: Cesium.Cartesian3.fromDegrees(-60, -3, 1000), 
    billboard: {
        image: 'https://img.icons8.com/color/48/000000/amazon.png',
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.8
    },
    label: {
        text: "Biodiversity Hotspot (Amazon)",
        font: '12pt sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -50),
        showBackground: true
    }
});

viewer.entities.add({
    id: "land-africa",
    name: "Sub-Saharan Agriculture Expansion (Land/Phosphorus)",
    position: Cesium.Cartesian3.fromDegrees(25, 0, 1000), 
    billboard: {
        image: 'https://img.icons8.com/color/48/000000/safari.png',
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.8
    },
    label: {
        text: "Land/P Hotspot (Africa)",
        font: '12pt sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -50),
        showBackground: true
    }
});

// Add OSM Buildings
let osmBuildings;
Cesium.createOsmBuildingsAsync().then(primitive => {
    osmBuildings = viewer.scene.primitives.add(primitive);
    if (visualUpdates) visualUpdates.updateBuildings(osmBuildings);
});

// --- 3. GAME STATE (Planetary Boundaries Simulation) ---
const state = {
  "year": 2020,
  "budget": 100,
  "boundaries": {
    "climate": {"state": 0.3, "pressure": 0.6, "threshold": 1.0, "drivers": ["fossil","ag"]},
    "biodiversity": {"state": 0.7, "pressure": 0.9, "threshold": 1.0, "drivers": ["ag","urban"]},
    "land": {"state": 0.4, "pressure": 0.7, "threshold": 1.0, "drivers": ["ag"]},
    "freshwater": {"state": 0.5, "pressure": 0.8, "threshold": 1.0, "drivers": ["ag"]},
    "nitrogen": {"state": 0.8, "pressure": 0.95, "threshold": 1.0, "drivers": ["ag"]},
    "phosphorus": {"state": 0.6, "pressure": 0.7, "threshold": 1.0, "drivers": ["ag"]},
    "ocean": {"state": 0.4, "pressure": 0.6, "threshold": 1.0, "drivers": ["fossil"]},
    "ozone": {"state": 0.1, "pressure": 0.2, "threshold": 1.0, "drivers": []},
    "novel": {"state": 0.3, "pressure": 0.4, "threshold": 1.0, "drivers": ["industry"]}
  },
  "knobs": {"fossil":0.5, "ag":0.7, "urban":0.4, "industry":0.5},
  "policies": {"climate":0, "nitrogen":0},
  "pbiuslaVisible": false
};

// --- 4. TICK FUNCTION (Core Simulation Loop) ---
let lastTickJulian = null;

function tick() {
  // Derive year from Cesium Clock
  const currentTime = viewer.clock.currentTime;
  const startTime = viewer.clock.startTime;
  const totalDays = Cesium.JulianDate.daysDifference(viewer.clock.stopTime, startTime);
  const currentDays = Cesium.JulianDate.daysDifference(currentTime, startTime);
  
  state.year = 2020 + (currentDays / 365.25);
  
  // COMPUTE PRESSURES FROM KNOBS
  const weights = {
    climate: [0.8, 0.2],      // fossil, ag
    biodiversity: [0.3, 0.2], // ag, urban  
    land: [0.6],              // ag
    freshwater: [0.7],        // ag
    nitrogen: [0.9],          // ag
    phosphorus: [0.8],        // ag
    ocean: [0.3],             // fossil
    ozone: [],
    novel: [0.8]              // industry
  };
  
  Object.keys(state.boundaries).forEach(boundary => {
    let pressure = 0;
    const w = weights[boundary];
    if (w.length > 0) {
      w.forEach((weight, i) => {
        const driverName = state.boundaries[boundary].drivers[i];
        if (driverName) {
            pressure += weight * state.knobs[driverName];
        }
      });
    }
    // SMOOTH WITH INERTIA (alpha=0.05)
    state.boundaries[boundary].pressure = 0.95 * state.boundaries[boundary].pressure + 0.05 * pressure;
  });
  
  // UPDATE STATES (stock-flow dynamics)
  Object.keys(state.boundaries).forEach(boundary => {
    const b = state.boundaries[boundary];
    const policyImpact = state.policies[boundary] || 0;
    
    // Lowered threshold internally to 0.5 to ensure transgression at high knob values
    const effectiveThreshold = 0.5; 
    const delta = 0.01 * (b.pressure - effectiveThreshold) - 0.02 * policyImpact;
    b.state = Math.max(0, Math.min(1, b.state + delta));
    
    // EVENTS
    if (b.state > 0.9 && Math.random() < 0.01) console.log(`${boundary} CRITICAL: ${b.state.toFixed(2)}`);
  });
  
  if (visualUpdates) {
      visualUpdates.updateImagery();
      visualUpdates.updateBuildings(osmBuildings);
      visualUpdates.updateParticles();
  }
  updateGlobeColors();
}

function updateGlobeColors() {
    // 1. Update HUD bars for all 9 boundaries
    Object.keys(state.boundaries).forEach(key => {
        const container = document.getElementById(`${key}-bar`);
        if (container) {
            const fill = container.querySelector('.bar-fill');
            if (fill) {
                const val = state.boundaries[key].state * 100;
                fill.style.width = val + "%";
                // Color mapping: Green to Red
                const r = Math.min(255, Math.floor(val * 2.55));
                const g = Math.max(0, Math.floor(255 - (val * 2.55)));
                fill.style.backgroundColor = `rgb(${r}, ${g}, 0)`;
            }
        }
    });

    // 2. Global Globe Tint (Tints ONLY the Earth, not the whole screen)
    const avgState = Object.values(state.boundaries).reduce((sum, b) => sum + b.state, 0) / 9;
    if (!viewer.scene.globe.material || viewer.scene.globe.material.type !== 'Color') {
        viewer.scene.globe.material = Cesium.Material.fromType('Color');
    }
    
    // We target the Globe material specifically to avoid whole-screen tinting
    const startColor = Cesium.Color.fromCssColorString('#2ed573').withAlpha(0.1);
    const endColor = Cesium.Color.fromCssColorString('#ff4757').withAlpha(0.6);
    
    viewer.scene.globe.material.uniforms.color = Cesium.Color.lerp(
        startColor, 
        endColor, 
        avgState, 
        new Cesium.Color()
    );
}

// Global test for Chaos button
window.testChaos = function() {
    console.warn("CHAOS MODE ACTIVATED: Driving all knobs to MAX");
    Object.keys(state.knobs).forEach(k => {
        state.knobs[k] = 1.0;
    });
    // Update Dat.GUI manually to reflect changes
    for (let i in gui.__folders) {
        let folder = gui.__folders[i];
        for (let j in folder.__controllers) {
            folder.__controllers[j].updateDisplay();
        }
    }
    tick();
};

// --- 5. VISUAL REACTION LOGIC ---
const visualUpdates = setupVisuals(viewer, state);

// --- 5. TIMELINE & DYNAMIC DATA ---
const start = Cesium.JulianDate.fromIso8601("2020-01-01T00:00:00Z");
const stop = Cesium.JulianDate.fromIso8601("2030-12-31T23:59:59Z");

viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
viewer.clock.multiplier = 31536000;
viewer.timeline.zoomTo(start, stop);

const czml = [{
    "id": "document",
    "version": "1.0"
}, {
    "id": "pb-trend-marker",
    "name": "Global PB Trend",
    "availability": "2020-01-01T00:00:00Z/2030-12-31T23:59:59Z",
    "point": {
        "pixelSize": 15,
        "color": { "rgba": [255, 255, 0, 255] },
        "outlineColor": { "rgba": [0, 0, 0, 255] },
        "outlineWidth": 2
    },
    "position": { "cartographicDegrees": [0, 20, 2000000] },
    "label": {
        "text": "Planetary Boundary Health",
        "font": "14pt sans-serif",
        "horizontalOrigin": "LEFT",
        "pixelOffset": { "cartesian2": [20, 0] }
    }
}];

// --- 6. GAME LOOP REGISTRATION ---
let lastTickDate = null;

viewer.clock.onTick.addEventListener(() => {
    // Only tick when a "month" passes in simulation time (approx 30 days)
    const currentTime = viewer.clock.currentTime;
    if (!lastTickDate || Math.abs(Cesium.JulianDate.daysDifference(currentTime, lastTickDate)) >= 30) {
        tick();
        lastTickDate = currentTime.clone();
        
        // Log status occasionally
        if (Math.random() < 0.1) {
            console.log(`Year ${state.year.toFixed(1)}: Nitrogen=${state.boundaries.nitrogen.state.toFixed(2)}, Climate=${state.boundaries.climate.state.toFixed(2)}`);
        }
    }

    // Timeline marker logic
    const ds = viewer.dataSources.get(0);
    if (ds && ds.entities) {
        const entity = ds.entities.getById('pb-trend-marker');
        if (entity) {
            const seconds = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, viewer.clock.startTime);
            const progress = seconds / Cesium.JulianDate.secondsDifference(viewer.clock.stopTime, viewer.clock.startTime);
            entity.position = Cesium.Cartesian3.fromDegrees(0, 20 + (progress * 10), 2000000);
            
            const bounds = state.boundaries;
            const avg = (bounds.climate.state + bounds.biodiversity.state + bounds.land.state) / 3;
            entity.point.color = Cesium.Color.fromHsl(0.3 - (avg * 0.3), 1.0, 0.5, 1.0);
        }
    }
});

viewer.dataSources.add(Cesium.CzmlDataSource.load(czml));

// --- 7. KNOBS (dat.gui) ---
const gui = new dat.GUI();
const knobFolder = gui.addFolder('Driver Knobs');
knobFolder.add(state.knobs, 'fossil', 0, 1).name('Fossil Fuel');
knobFolder.add(state.knobs, 'ag', 0, 1).name('Agriculture');
knobFolder.add(state.knobs, 'urban', 0, 1).name('Urbanization');
knobFolder.add(state.knobs, 'industry', 0, 1).name('Industrialization');
knobFolder.open();

const policyFolder = gui.addFolder('Policy Interventions');
policyFolder.add(state.policies, 'climate', 0, 1).name('Climate Policy');
policyFolder.add(state.policies, 'nitrogen', 0, 1).name('Nitrogen Policy');
policyFolder.open();

// --- 8. UI CONTROLS ---
setupVR(viewer, state);

const pbToggle = document.getElementById('pbiusla-toggle');
let pbLayer = null;
pbToggle.addEventListener('click', () => {
    state.pbiuslaVisible = !state.pbiuslaVisible;
    pbToggle.classList.toggle('active');
    
    if (state.pbiuslaVisible) {
        const ASSET_ID = 0; 
        if (ASSET_ID !== 0) {
            Cesium.Cesium3DTileset.fromIonAssetId(ASSET_ID).then(tileset => {
                pbLayer = viewer.scene.primitives.add(tileset);
                viewer.zoomTo(pbLayer);
            });
        } else {
            alert("PBiusla Asset ID not set.");
        }
    } else if (pbLayer) {
        viewer.scene.primitives.remove(pbLayer);
        pbLayer = null;
    }
});

// Initial updates
visualUpdates.updateImagery();

// --- 8. UTILITIES ---
makeDraggable(document.getElementById("ui-panel"), document.getElementById("ui-header"));
makeDraggable(document.getElementById("hud"), document.getElementById("hud-header"));

const guiContainer = document.querySelector('.dg.main');
if (guiContainer) {
    const guiTitle = guiContainer.querySelector('.title');
    if (guiTitle) {
        makeDraggable(guiContainer, guiTitle);
        guiTitle.style.cursor = 'move';
    }
}

const uiPanel = document.getElementById("ui-panel");
uiPanel.addEventListener('mousedown', (e) => e.stopPropagation());
uiPanel.addEventListener('wheel', (e) => e.stopPropagation());
uiPanel.addEventListener('dblclick', (e) => e.stopPropagation());

// --- 9. INTERACTIONS ---
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (picked && picked.id) {
        const name = picked.id.name || picked.id.id;
        // Check if it's one of our boundaries
        const boundaryKey = Object.keys(state.boundaries).find(k => name.toLowerCase().includes(k));
        if (boundaryKey) {
            const b = state.boundaries[boundaryKey];
            alert(`${boundaryKey.toUpperCase()}:
State: ${b.state.toFixed(2)}
Pressure: ${b.pressure.toFixed(2)}`);
        } else {
            alert(`Picked: ${name}`);
        }
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// --- 10. GAME LOOP DECOUPLING ---
let lastTime = Cesium.JulianDate.now();
let accumulator = 0;
const fixedDt = 1/60;

function frameUpdate() {
    const currentTime = Cesium.JulianDate.now();
    const dt = Cesium.JulianDate.secondsDifference(currentTime, lastTime);
    lastTime = currentTime;
    
    accumulator += dt;
    while (accumulator >= fixedDt) {
        // We still use Cesium Clock for year-based tick logic in game loop registration
        accumulator -= fixedDt;
    }
    requestAnimationFrame(frameUpdate);
}
requestAnimationFrame(frameUpdate);

// --- 11. EXPOSE FOR TESTING ---
window.state = state;
window.tick = tick;

console.log("Planetary Boundaries Game Loop Initialized.");
console.log("Run window.runTests() to verify equations.");

window.runTests = function() {
    console.log("Starting Test 1: Agriculture overload...");
    const originalAg = state.knobs.ag;
    state.knobs.ag = 1.0;
    for(let i=0; i<60; i++) tick();  // 5 years
    console.log("High ag test (Nitrogen state):", state.boundaries.nitrogen.state.toFixed(4));
    
    console.log("Starting Test 2: Recovery...");
    const originalPolicy = state.policies.nitrogen;
    state.policies.nitrogen = 1.0;
    for(let i=0; i<24; i++) tick();  // 2 years recovery
    console.log("Policy recovery (Nitrogen state):", state.boundaries.nitrogen.state.toFixed(4));
    
    // Reset
    state.knobs.ag = originalAg;
    state.policies.nitrogen = originalPolicy;
};

setTimeout(() => fixInjectedWarning(makeDraggable), 1000);
