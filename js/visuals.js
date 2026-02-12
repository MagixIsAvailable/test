// Visual Reaction Logic (Shaders and Earth Updates)

export function setupVisuals(viewer, state, osmBuildings) {
    // Post-process removed to prevent full-screen color washing

    // Functions to update imagery and buildings
    const updateImagery = () => {
        const layers = viewer.scene.imageryLayers;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers.get(i);
            layer.saturation = Math.max(0, 1.0 - (state.boundaries.biodiversity.state * 0.9));
            layer.hue = state.boundaries.biodiversity.state * -0.3;
        }
    };

    const updateBuildings = (buildings) => {
        if (!buildings) return;
        buildings.style = new Cesium.Cesium3DTileStyle({
            color: {
                conditions: [
                    ['true', `color("white", ${1.0 - (state.boundaries.land.state * 0.7)})`]
                ]
            }
        });
    };

    // --- PARTICLE SYSTEMS ---
    const particleSystems = {};
    
    // Create a reliable circular particle image via Canvas
    function createParticleImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        context.beginPath();
        context.arc(16, 16, 12, 0, Math.PI * 2);
        context.fillStyle = 'white';
        context.fill();
        return canvas;
    }
    const particleCanvas = createParticleImage();

    const hotspots = {
        nitrogen: { pos: [-10, 45, 10000], color: Cesium.Color.YELLOW, trigger: 0.6 },
        climate: { pos: [0, 80, 10000], color: Cesium.Color.RED, trigger: 0.7 },
        biodiversity: { pos: [-60, 0, 10000], color: Cesium.Color.BLACK, trigger: 0.8 },
        land: { pos: [60, 45, 10000], color: Cesium.Color.SADDLEBROWN, trigger: 0.5 }
    };

    const updateParticles = () => {
        Object.entries(hotspots).forEach(([name, data]) => {
            const bState = state.boundaries[name === 'land' ? 'land' : name].state;
            
            if (bState > data.trigger && !particleSystems[name]) {
                const pos = Cesium.Cartesian3.fromDegrees(data.pos[0], data.pos[1], data.pos[2]);
                particleSystems[name] = viewer.scene.primitives.add(new Cesium.ParticleSystem({
                    image: particleCanvas,
                    startColor: data.color.withAlpha(0.6),
                    endColor: data.color.withAlpha(0.0),
                    startScale: 1.0, endScale: 5.0,
                    minimumParticleLife: 2.0, maximumParticleLife: 4.0,
                    minimumSpeed: 5000.0, maximumSpeed: 15000.0,
                    emissionRate: bState * 100,
                    lifetime: 10.0,
                    emitterModelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(pos),
                    sizeInMeters: true,
                    updateCallback: (p, dt) => {
                        const gravity = Cesium.Cartesian3.normalize(p.position, new Cesium.Cartesian3());
                        Cesium.Cartesian3.multiplyByScalar(gravity, -9.8 * dt, gravity);
                        Cesium.Cartesian3.add(p.velocity, gravity, p.velocity);
                    }
                }));
            } else if (bState < data.trigger - 0.1 && particleSystems[name]) {
                viewer.scene.primitives.remove(particleSystems[name]);
                particleSystems[name] = null;
            } else if (particleSystems[name]) {
                particleSystems[name].emissionRate = bState * 100;
            }
        });
    };

    return { updateImagery, updateBuildings, updateParticles };
}
