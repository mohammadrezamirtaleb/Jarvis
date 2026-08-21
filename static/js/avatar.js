/**
 * J.A.R.V.I.S. Holographic Avatar Engine (Mark-86 Next-Gen)
 * High-Definition 3D Human Torso (Bust) with Glowing Neural/Vascular Pathways
 * and Natural Speech Mimic / Audio-Synchronized Lip Articulation.
 */

class AvatarEngine {
    constructor() {
        this.container = document.getElementById('hologramContainer');
        if (!this.container) return;

        this.scene = new THREE.Scene();
        
        // Dynamic holographic lights
        this.amberCoreLight = new THREE.PointLight(0xff9900, 3.5, 300);
        this.amberCoreLight.position.set(0, 25, 25);
        this.scene.add(this.amberCoreLight);

        this.cyanAuraLight = new THREE.PointLight(0x00f0ff, 2.0, 400);
        this.cyanAuraLight.position.set(0, -20, 60);
        this.scene.add(this.cyanAuraLight);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 3000);
        this.camera.position.set(0, 0, 240);

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Core system state
        this.particleSystem = null;
        this.isForming = false;
        this.formedProgress = 0.0;
        
        // Mouse tracking & Kinematic Parallax
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.currentRotationX = 0;
        this.currentRotationY = 0;

        // Speech & Mimic state
        this.smoothSpeechIntensity = 0.0;
        this.speechPhase = 0.0;

        // Particle Data Arrays
        this.particleCount = 42000;
        this.basePositions = null;
        this.targetPositions = null;
        this.currentPositions = null;
        this.colors = null;
        this.particleTypes = null; // 0: Contour Scanline, 1: Face/Lip, 2: Veins/Neural, 3: Core, 4: Dust

        this.buildHumanTorsoWithVessels();
        this.buildUIOverlay();
        this.bindEvents();
        this.animate();

        // Initial hidden state
        this.container.style.opacity = '0';
        this.container.style.pointerEvents = 'none';
        this.container.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        this.container.style.background = 'radial-gradient(circle at center 40%, rgba(4, 18, 42, 0.88) 0%, rgba(1, 6, 16, 0.97) 85%)';
        this.container.style.backdropFilter = 'blur(16px)';
        this.container.style.webkitBackdropFilter = 'blur(16px)';
    }

    buildUIOverlay() {
        // Hologram HUD Header
        const header = document.createElement('div');
        header.style.position = 'absolute';
        header.style.top = '25px';
        header.style.left = '35px';
        header.style.zIndex = '9002';
        header.style.fontFamily = 'var(--font-telemetry, monospace)';
        header.style.pointerEvents = 'none';
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:10px; height:10px; border-radius:50%; background:#00f0ff; box-shadow:0 0 12px #00f0ff; animation:blinkDot 1.2s infinite alternate;"></div>
                <span style="color:#00f0ff; font-weight:700; letter-spacing:2px; font-size:0.95rem;">J.A.R.V.I.S. // NEURAL AVATAR LINK</span>
            </div>
            <div style="color:rgba(0,240,255,0.6); font-size:0.75rem; letter-spacing:1px; margin-top:3px;">
                SYNAPSE MATRIX: ACTIVE | VASCULAR CORE: SYNCED
            </div>
        `;
        this.container.appendChild(header);

        // Close Hologram Button
        this.closeBtn = document.createElement('button');
        this.closeBtn.innerHTML = '⛌ CLOSE AVATAR';
        this.closeBtn.style.position = 'absolute';
        this.closeBtn.style.top = '25px';
        this.closeBtn.style.right = '35px';
        this.closeBtn.style.background = 'rgba(255, 42, 85, 0.15)';
        this.closeBtn.style.border = '1px solid rgba(255, 42, 85, 0.6)';
        this.closeBtn.style.color = '#ff2a55';
        this.closeBtn.style.padding = '8px 18px';
        this.closeBtn.style.fontFamily = 'var(--font-telemetry, monospace)';
        this.closeBtn.style.fontSize = '0.85rem';
        this.closeBtn.style.fontWeight = '600';
        this.closeBtn.style.letterSpacing = '1.5px';
        this.closeBtn.style.borderRadius = '4px';
        this.closeBtn.style.cursor = 'pointer';
        this.closeBtn.style.zIndex = '9002';
        this.closeBtn.style.boxShadow = '0 0 15px rgba(255,42,85,0.2)';
        this.closeBtn.style.transition = 'all 0.2s ease';
        
        this.closeBtn.onmouseenter = () => {
            this.closeBtn.style.background = 'rgba(255, 42, 85, 0.35)';
            this.closeBtn.style.boxShadow = '0 0 20px rgba(255,42,85,0.5)';
        };
        this.closeBtn.onmouseleave = () => {
            this.closeBtn.style.background = 'rgba(255, 42, 85, 0.15)';
            this.closeBtn.style.boxShadow = '0 0 15px rgba(255,42,85,0.2)';
        };
        this.closeBtn.onclick = () => this.hideAvatar();
        this.container.appendChild(this.closeBtn);
    }

    buildHumanTorsoWithVessels() {
        const count = this.particleCount;
        this.basePositions = new Float32Array(count * 3);
        this.targetPositions = new Float32Array(count * 3);
        this.currentPositions = new Float32Array(count * 3);
        this.colors = new Float32Array(count * 3);
        this.particleTypes = new Uint8Array(count); // 0: contour, 1: mouth/jaw, 2: veins/neural, 3: core, 4: dust

        let idx = 0;

        const colorCyan = new THREE.Color(0x00f0ff);
        const colorTeal = new THREE.Color(0x00d4aa);
        const colorGold = new THREE.Color(0xffbb00);
        const colorAmber = new THREE.Color(0xff8800);
        const colorCoreHot = new THREE.Color(0xff5500);

        // Helper to push a particle
        const addParticle = (x, y, z, type, customColor = null) => {
            if (idx >= count) return;
            const i3 = idx * 3;

            this.targetPositions[i3] = x;
            this.targetPositions[i3 + 1] = y;
            this.targetPositions[i3 + 2] = z;

            this.basePositions[i3] = x;
            this.basePositions[i3 + 1] = y;
            this.basePositions[i3 + 2] = z;

            // Random scattered initial powder position
            const angle = Math.random() * Math.PI * 2;
            const radius = 200 + Math.random() * 600;
            this.currentPositions[i3] = Math.cos(angle) * radius;
            this.currentPositions[i3 + 1] = (Math.random() - 0.5) * 800;
            this.currentPositions[i3 + 2] = (Math.random() - 0.5) * 600;

            this.particleTypes[idx] = type;

            let c = colorCyan;
            if (customColor) {
                c = customColor;
            } else if (type === 2) { // Veins / Neural
                c = Math.random() > 0.4 ? colorGold : colorAmber;
            } else if (type === 3) { // Core Vocal/Brain
                c = colorAmber.clone().lerp(colorCoreHot, Math.random() * 0.7);
            } else if (type === 1) { // Face & Lips
                const distToMouth = Math.sqrt(x * x + (y - 23) * (y - 23) + (z - 20) * (z - 20));
                if (distToMouth < 16) {
                    c = colorGold.clone().lerp(colorAmber, 0.4);
                } else {
                    c = colorCyan.clone().lerp(colorTeal, Math.random() * 0.3);
                }
            } else { // Contour scanlines
                // Color gradient along Y height: shoulders cyan/teal, upper head glowing electric cyan
                c = colorCyan.clone().lerp(colorTeal, Math.min(1, Math.max(0, (-y) / 80.0)));
            }

            this.colors[i3] = c.r;
            this.colors[i3 + 1] = c.g;
            this.colors[i3 + 2] = c.b;

            idx++;
        };

        // =========================================================================
        // 1. GENERATE UPPER TORSO, SHOULDERS & CHEST CONTOURS (Horizontal Scanlines)
        // =========================================================================
        const torsoSlices = 75;
        for (let s = 0; s < torsoSlices; s++) {
            const vNorm = s / torsoSlices;
            const y = -80 + vNorm * 70; // Y from -80 to -10

            // Width of torso at height Y
            let halfWidth = 55;
            let depth = 22;

            if (y > -25) { // Shoulders & Clavicle area
                const shoulderT = (-y - 10) / 15; // 0 at neck base, 1 at shoulder tip
                halfWidth = 24 + shoulderT * 70; // Spreads wide to 94 at shoulder joints
                depth = 18 + Math.sin(shoulderT * Math.PI) * 8;
            } else { // Chest & Ribcage area
                const chestT = (-y - 25) / 55;
                halfWidth = 94 - chestT * 32; // Tapers down from shoulders (94) to waist (62)
                depth = 26 - chestT * 8;
            }

            const pointsPerSlice = Math.floor(180 + halfWidth * 2.2);
            for (let p = 0; p < pointsPerSlice; p++) {
                const u = (p / pointsPerSlice) * Math.PI * 2;
                
                // Elliptical cross-section with pectoral shaping in front (Z > 0)
                let cosU = Math.cos(u);
                let sinU = Math.sin(u);
                
                let px = cosU * halfWidth;
                let pz = sinU * depth;

                // Front chest / pectoral muscle curvature shaping
                if (pz > 0 && y < -15 && y > -55) {
                    const pect = Math.sin(Math.abs(px) / halfWidth * Math.PI) * 7.5;
                    pz += pect;
                }
                
                // Clavicle bone ridge protrusion
                if (pz > 0 && y > -20 && y < -10) {
                    const clavicle = Math.cos((px / halfWidth) * Math.PI * 1.5) * 4.5;
                    pz += Math.max(0, clavicle);
                }

                // Add subtle organic particle noise
                px += (Math.random() - 0.5) * 1.8;
                const py = y + (Math.random() - 0.5) * 1.2;
                pz += (Math.random() - 0.5) * 1.8;

                addParticle(px, py, pz, 0);
            }
        }

        // =========================================================================
        // 2. GENERATE NECK & THROAT
        // =========================================================================
        const neckSlices = 35;
        for (let s = 0; s < neckSlices; s++) {
            const vNorm = s / neckSlices;
            const y = -10 + vNorm * 30; // Y from -10 to +20

            // Neck radius & natural anatomical forward inclination
            const neckRadiusX = 18 - vNorm * 3.5;
            const neckRadiusZ = 16 - vNorm * 2.5;
            const neckCenterZ = 2 + (1 - vNorm) * 4.0; // slight forward curve

            const pointsPerSlice = 140;
            for (let p = 0; p < pointsPerSlice; p++) {
                const u = (p / pointsPerSlice) * Math.PI * 2;
                let px = Math.cos(u) * neckRadiusX;
                let pz = neckCenterZ + Math.sin(u) * neckRadiusZ;

                // Adam's Apple protrusion in anterior throat
                if (Math.abs(px) < 6 && pz > 0 && y > 2 && y < 12) {
                    pz += 3.5 * Math.cos((px / 6) * Math.PI * 0.5);
                }

                // Sternocleidomastoid muscle ridges
                const scmLeft = Math.abs(px - (8 + (20 - y) * 0.4));
                const scmRight = Math.abs(px + (8 + (20 - y) * 0.4));
                if (pz > 0 && (scmLeft < 4 || scmRight < 4)) {
                    pz += 2.2;
                }

                addParticle(px + (Math.random() - 0.5), y + (Math.random() - 0.5), pz + (Math.random() - 0.5), 0);
            }
        }

        // =========================================================================
        // 3. GENERATE HUMAN HEAD & CRANIUM (Horizontal Contour Scanlines)
        // =========================================================================
        const headSlices = 80;
        for (let s = 0; s < headSlices; s++) {
            const vNorm = s / headSlices;
            const y = 18 + vNorm * 58; // Y from 18 to 76

            let rx = 24;
            let rz = 26;
            let centerZ = 0;

            if (y > 50) { // Cranial Dome
                const domeT = (y - 50) / 26;
                const domeRadius = Math.sqrt(Math.max(0, 1 - domeT * domeT));
                rx = 26 * domeRadius;
                rz = 28 * domeRadius;
                centerZ = -4 * domeT;
            } else if (y > 32) { // Forehead, Eyes, Temples
                rx = 25.5;
                rz = 26.5;
                centerZ = 2;
            } else { // Cheeks, Chin, Jaw
                const jawT = (32 - y) / 14;
                rx = 25.5 - jawT * 12.0; // Narrowing into chin
                rz = 26.5 - jawT * 4.0;
                centerZ = 4 + jawT * 3;
            }

            const pointsPerSlice = 200;
            for (let p = 0; p < pointsPerSlice; p++) {
                const u = (p / pointsPerSlice) * Math.PI * 2;
                let px = Math.cos(u) * rx;
                let pz = centerZ + Math.sin(u) * rz;

                // Eye Socket Recesses
                if (y > 36 && y < 45 && pz > 14 && (Math.abs(px - 12) < 7 || Math.abs(px + 12) < 7)) {
                    pz -= 4.5;
                }

                // Nose Bridge & Tip Protrusion
                if (y > 25 && y < 40 && Math.abs(px) < 7 && pz > 15) {
                    const noseT = 1 - Math.abs(px) / 7;
                    const noseY = 1 - Math.abs(y - 31) / 9;
                    pz += 8.5 * Math.max(0, noseT * noseY);
                }

                // Cheekbone Definition
                if (y > 28 && y < 38 && Math.abs(px) > 16 && pz > 8) {
                    px *= 1.08;
                    pz += 2.5;
                }

                addParticle(px + (Math.random() - 0.5), y + (Math.random() - 0.5), pz + (Math.random() - 0.5), 0);
            }
        }

        // =========================================================================
        // 4. HIGH-PRECISION ANATOMICAL LIPS & MOUTH STRUCTURE (Speech Mimic Layer)
        // =========================================================================
        // Generates densely sampled upper lip, lower lip, oral cavity and chin
        const mouthLayers = 28;
        for (let m = 0; m < mouthLayers; m++) {
            const t = m / mouthLayers;
            const yMouth = 19 + t * 9; // Y from 19 to 28

            const lipPoints = 90;
            for (let lp = 0; lp < lipPoints; lp++) {
                const u = (lp / lipPoints) * 2 - 1; // -1 to +1 across mouth width
                const x = u * 14.5; // Lip width ~29 units

                let y = yMouth;
                let z = 22.5;

                const arch = Math.cos(u * Math.PI * 0.5); // Curves back at corners

                if (yMouth >= 24) { // Upper Lip & Cupid's Bow
                    const bow = Math.sin(Math.abs(u) * Math.PI * 2) * 1.0;
                    y = 25.5 + bow * 0.8;
                    z = 22.0 + arch * 4.5;
                } else { // Lower Lip
                    y = 21.8 - (1 - Math.abs(u)) * 1.5;
                    z = 21.5 + arch * 5.0;
                }

                // Inner oral cavity depth
                z -= (1 - Math.abs(u)) * 2.0;

                // Mark as Speech Mimic particle (type 1)
                addParticle(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6, 1);
            }
        }

        // =========================================================================
        // 5. GLOWING VASCULAR & NEURAL BRANCHING PATHWAYS ("رگ‌های داخلی انسان")
        // =========================================================================
        // Procedural 3D spline tree generation for carotid arteries, subclavian,
        // thoracic/cardiac plexus, and cranial nerves matching the screenshot!
        const generateVesselBranch = (startPt, endPt, branchCount, jitter = 2.5, depth = 0) => {
            const steps = 60;
            const current = new THREE.Vector3().copy(startPt);
            const dir = new THREE.Vector3().subVectors(endPt, startPt).multiplyScalar(1 / steps);

            for (let s = 0; s <= steps; s++) {
                const prog = s / steps;
                const pt = new THREE.Vector3().copy(startPt).lerp(endPt, prog);

                // Add organic meandering curve to the blood vessel
                pt.x += Math.sin(prog * Math.PI * 4 + depth) * jitter;
                pt.y += Math.cos(prog * Math.PI * 3 + depth) * (jitter * 0.6);
                pt.z += Math.sin(prog * Math.PI * 5 + depth * 2) * (jitter * 0.8);

                // Deposit cluster of glowing vein particles
                const veinCluster = 3 + Math.floor(Math.random() * 3);
                for (let k = 0; k < veinCluster; k++) {
                    const vx = pt.x + (Math.random() - 0.5) * 1.8;
                    const vy = pt.y + (Math.random() - 0.5) * 1.8;
                    const vz = pt.z + (Math.random() - 0.5) * 1.8;
                    addParticle(vx, vy, vz, 2);
                }

                // Secondary branching
                if (branchCount > 0 && s % 18 === 0 && s > 10 && s < steps - 5) {
                    const sideDir = (Math.random() > 0.5 ? 1 : -1);
                    const subEnd = new THREE.Vector3(
                        pt.x + sideDir * (15 + Math.random() * 25),
                        pt.y - (8 + Math.random() * 20),
                        pt.z + (Math.random() - 0.5) * 8
                    );
                    generateVesselBranch(pt, subEnd, branchCount - 1, jitter * 0.7, depth + 1);
                }
            }
        };

        // Carotid & Jugular Main Trunks (Left & Right Throat)
        generateVesselBranch(new THREE.Vector3(-6, 32, 14), new THREE.Vector3(-10, -18, 16), 2, 2.2);
        generateVesselBranch(new THREE.Vector3(6, 32, 14), new THREE.Vector3(10, -18, 16), 2, 2.2);

        // Central Thyroid & Vocal Cord Plexus
        generateVesselBranch(new THREE.Vector3(0, 26, 16), new THREE.Vector3(0, -5, 14), 2, 1.8);

        // Aortic Arch & Cardiac Plexus (Mid-Chest Center)
        generateVesselBranch(new THREE.Vector3(0, -15, 15), new THREE.Vector3(0, -55, 18), 3, 3.5);

        // Subclavian Arteries (Flowing from throat across clavicles to shoulders)
        generateVesselBranch(new THREE.Vector3(-8, -12, 14), new THREE.Vector3(-75, -28, 8), 3, 3.0);
        generateVesselBranch(new THREE.Vector3(8, -12, 14), new THREE.Vector3(75, -28, 8), 3, 3.0);

        // Intercostal Pectoral Branches (Sweeping across ribs and chest)
        generateVesselBranch(new THREE.Vector3(-5, -28, 18), new THREE.Vector3(-45, -65, 12), 2, 2.8);
        generateVesselBranch(new THREE.Vector3(5, -28, 18), new THREE.Vector3(45, -65, 12), 2, 2.8);

        // Cranial Neural Crown (Ascending into forehead and temples)
        generateVesselBranch(new THREE.Vector3(-4, 38, 16), new THREE.Vector3(-18, 62, 12), 2, 2.0);
        generateVesselBranch(new THREE.Vector3(4, 38, 16), new THREE.Vector3(18, 62, 12), 2, 2.0);

        // =========================================================================
        // 6. LUMINOUS QUANTUM CORE & VOCAL ENERGY VORTEX (Speech Aura)
        // =========================================================================
        const coreParticleCount = 2800;
        for (let c = 0; c < coreParticleCount; c++) {
            const rad = Math.random() * 16;
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;

            // Centered at speech & facial energy locus (y=26, z=14)
            const cx = Math.sin(theta) * Math.cos(phi) * (rad * 0.9);
            const cy = 26 + Math.cos(theta) * (rad * 1.3);
            const cz = 14 + Math.sin(theta) * Math.sin(phi) * (rad * 0.8);

            addParticle(cx, cy, cz, 3);
        }

        // =========================================================================
        // 7. AMBIENT CYBERNETIC EMBERS & HOLOGRAPHIC DUST
        // =========================================================================
        while (idx < count) {
            const ax = (Math.random() - 0.5) * 320;
            const ay = -90 + Math.random() * 200;
            const az = (Math.random() - 0.5) * 260;
            const dustCol = Math.random() > 0.6 ? colorGold : colorCyan;
            addParticle(ax, ay, az, 4, dustCol);
        }

        // Construct Three.js BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.currentPositions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        // High-definition Point Material with Additive Blending
        const material = new THREE.PointsMaterial({
            size: 0.85,
            vertexColors: true,
            transparent: true,
            opacity: 0.88,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.particleSystem.position.y = 8; // Center bust in view
        this.scene.add(this.particleSystem);
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.addEventListener('mousemove', (e) => {
            // Normalized Device Coordinates [-1, 1]
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isForming) {
                this.hideAvatar();
            }
        });
    }

    formAvatar() {
        if (this.isForming) return;
        this.container.style.opacity = '1';
        this.container.style.pointerEvents = 'auto';
        this.isForming = true;
        this.formedProgress = 0.0;

        if (window.jarvisAudio) window.jarvisAudio.playBoot();
    }

    hideAvatar() {
        if (!this.isForming) return;
        this.container.style.opacity = '0';
        this.container.style.pointerEvents = 'none';
        this.isForming = false;
        this.formedProgress = 0.0;

        // Scatter particles back to chaotic powder cloud
        if (this.particleSystem) {
            const count = this.particleCount;
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const angle = Math.random() * Math.PI * 2;
                const radius = 200 + Math.random() * 600;
                this.currentPositions[i3] = Math.cos(angle) * radius;
                this.currentPositions[i3 + 1] = (Math.random() - 0.5) * 800;
                this.currentPositions[i3 + 2] = (Math.random() - 0.5) * 600;
            }
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = performance.now() * 0.001;

        // Smooth Mouse Parallax Tracking
        this.targetRotationY = this.mouseX * 0.38; // Head yaw
        this.targetRotationX = -this.mouseY * 0.22; // Head pitch
        
        this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.06;
        this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.06;

        if (this.particleSystem) {
            this.particleSystem.rotation.y = this.currentRotationY;
            this.particleSystem.rotation.x = this.currentRotationX;

            // Speech Mimic Intensity Calculation
            let rawSpeechIntensity = 0.0;
            if (window.jarvisAudio && window.jarvisAudio.getSpeechIntensity) {
                rawSpeechIntensity = window.jarvisAudio.getSpeechIntensity();
            } else if (window.jarvisAudio && window.jarvisAudio.isSpeaking) {
                rawSpeechIntensity = Math.abs(Math.sin(time * 12.0)) * 0.8;
            }

            // Smooth speech dampening
            this.smoothSpeechIntensity += (rawSpeechIntensity - this.smoothSpeechIntensity) * 0.25;
            this.speechPhase += (0.15 + this.smoothSpeechIntensity * 0.35);

            const speech = this.smoothSpeechIntensity;
            const phoneme = Math.sin(this.speechPhase * 5.5);

            // Core light breathing & speech glow reaction
            if (this.amberCoreLight) {
                this.amberCoreLight.intensity = 2.5 + speech * 4.5 + Math.sin(time * 3) * 0.4;
            }

            // Animate Particles
            if (this.isForming) {
                const count = this.particleCount;
                const pos = this.currentPositions;
                const target = this.targetPositions;
                const base = this.basePositions;
                const types = this.particleTypes;

                // Lerp speed toward assembled shape
                const lerpSpeed = 0.035;

                for (let i = 0; i < count; i++) {
                    const i3 = i * 3;
                    const type = types[i];

                    let tx = base[i3];
                    let ty = base[i3 + 1];
                    let tz = base[i3 + 2];

                    // 1. Scanline Wave Ripple across the Torso/Head
                    if (type === 0) {
                        const wave = Math.sin(ty * 0.16 - time * 3.0) * 1.1;
                        tz += wave;
                    }

                    // 2. Dynamic Speech Mimic & Natural Mouth Articulation
                    if (type === 1) { // Lips, Jaw & Oral Cavity
                        // Lower lip & Jaw drop
                        if (ty < 24.5) {
                            const jawDrop = speech * 4.8 * (0.6 + Math.abs(phoneme) * 0.4);
                            ty -= jawDrop;
                            tz += Math.sin(phoneme * Math.PI) * 1.2 * speech;
                        } 
                        // Upper lip raises subtly
                        else if (ty >= 24.5) {
                            ty += speech * 1.4 * Math.max(0, phoneme);
                        }

                        // Lip corners stretch horizontally during vowels
                        tx *= (1.0 + speech * 0.18 * phoneme);
                    }

                    // 3. Glowing Vascular Action Potential Pulses
                    if (type === 2) { // Veins / Arteries
                        // Traveling electrical nerve pulse along vessels
                        const veinPulse = Math.sin((tx + ty + tz) * 0.25 - time * 8.0);
                        if (veinPulse > 0.7) {
                            tx += (Math.random() - 0.5) * 0.8;
                            ty += (Math.random() - 0.5) * 0.8;
                            tz += (Math.random() - 0.5) * 0.8 + 0.6;
                        }
                        // Speech surge through neck & chest veins
                        if (speech > 0.1) {
                            tz += Math.sin(time * 16.0 + ty * 0.1) * (speech * 1.4);
                        }
                    }

                    // 4. Vocal Core Energy Vortex Modulation
                    if (type === 3) {
                        const coreExpansion = 1.0 + speech * 0.35 + Math.sin(time * 4.0) * 0.08;
                        tx = base[i3] * coreExpansion;
                        ty = 26 + (base[i3 + 1] - 26) * coreExpansion;
                        tz = 14 + (base[i3 + 2] - 14) * coreExpansion;
                    }

                    // 5. Ambient Cybernetic Embers Drifting
                    if (type === 4) {
                        ty += Math.sin(time + tx) * 0.4;
                        tx += Math.cos(time * 0.8 + ty) * 0.4;
                    }

                    // Natural organic micro-breathing motion of the chest
                    if (ty < -10) {
                        const breath = Math.sin(time * 1.8) * 1.2;
                        tz += breath * Math.max(0, ( -10 - ty ) / 60);
                    }

                    // Interpolate current position to target position
                    pos[i3] += (tx - pos[i3]) * lerpSpeed;
                    pos[i3 + 1] += (ty - pos[i3 + 1]) * lerpSpeed;
                    pos[i3 + 2] += (tz - pos[i3 + 2]) * lerpSpeed;
                }

                this.particleSystem.geometry.attributes.position.needsUpdate = true;
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.jarvisAvatar = new AvatarEngine();
    
    window.showHolographicAvatar = () => {
        if (window.jarvisAvatar) window.jarvisAvatar.formAvatar();
    };
    window.hideHolographicAvatar = () => {
        if (window.jarvisAvatar) window.jarvisAvatar.hideAvatar();
    };
});
