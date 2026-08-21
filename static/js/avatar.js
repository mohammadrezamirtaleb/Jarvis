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
        
        // Holographic lighting setup
        this.amberCoreLight = new THREE.PointLight(0xff9900, 3.5, 400);
        this.amberCoreLight.position.set(0, 26, 30);
        this.scene.add(this.amberCoreLight);

        this.cyanAuraLight = new THREE.PointLight(0x00f0ff, 2.2, 500);
        this.cyanAuraLight.position.set(0, -20, 80);
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
        this.isLoaded = false;
        
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
        this.particleCount = 52000;
        this.basePositions = new Float32Array(this.particleCount * 3);
        this.targetPositions = new Float32Array(this.particleCount * 3);
        this.currentPositions = new Float32Array(this.particleCount * 3);
        this.colors = new Float32Array(this.particleCount * 3);
        this.particleTypes = new Uint8Array(this.particleCount); // 0: Contour Scanline, 1: Face/Lip, 2: Veins/Neural, 3: Core, 4: Dust

        this.buildUIOverlay();
        this.loadHumanBustModel();
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

    loadHumanBustModel() {
        // Load the genuine 3D human scan (Lee Perry-Smith) for facial and cranium precision
        if (typeof THREE.GLTFLoader !== 'undefined') {
            const loader = new THREE.GLTFLoader();
            loader.load('models/LeePerrySmith.glb', (gltf) => {
                let headGeometry = null;
                gltf.scene.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        headGeometry = child.geometry;
                    }
                });

                if (headGeometry) {
                    this.buildCombinedAvatar(headGeometry);
                } else {
                    this.buildProceduralAvatar();
                }
            }, undefined, (err) => {
                console.warn("GLTFLoader failed, falling back to high-res procedural bust:", err);
                this.buildProceduralAvatar();
            });
        } else {
            this.buildProceduralAvatar();
        }
    }

    buildCombinedAvatar(headGeometry) {
        let idx = 0;
        const count = this.particleCount;
        const colorCyan = new THREE.Color(0x00f0ff);
        const colorTeal = new THREE.Color(0x00d4aa);
        const colorGold = new THREE.Color(0xffbb00);
        const colorAmber = new THREE.Color(0xff8800);
        const colorCoreHot = new THREE.Color(0xff4400);

        const addParticle = (x, y, z, type, customColor = null) => {
            if (idx >= count) return;
            const i3 = idx * 3;

            this.targetPositions[i3] = x;
            this.targetPositions[i3 + 1] = y;
            this.targetPositions[i3 + 2] = z;

            this.basePositions[i3] = x;
            this.basePositions[i3 + 1] = y;
            this.basePositions[i3 + 2] = z;

            // Random initial powder distribution
            const angle = Math.random() * Math.PI * 2;
            const radius = 220 + Math.random() * 650;
            this.currentPositions[i3] = Math.cos(angle) * radius;
            this.currentPositions[i3 + 1] = (Math.random() - 0.5) * 800;
            this.currentPositions[i3 + 2] = (Math.random() - 0.5) * 600;

            this.particleTypes[idx] = type;

            let c = colorCyan;
            if (customColor) {
                c = customColor;
            } else if (type === 2) { // Veins / Neural
                c = Math.random() > 0.4 ? colorGold : colorAmber;
            } else if (type === 3) { // Core Face / Vocal Vortex
                c = colorAmber.clone().lerp(colorCoreHot, Math.random() * 0.75);
            } else if (type === 1) { // Lips, Mouth, Nose
                const distToMouth = Math.sqrt(x * x + (y - 23) * (y - 23) + (z - 16) * (z - 16));
                if (distToMouth < 16) {
                    c = colorGold.clone().lerp(colorAmber, 0.45);
                } else {
                    c = colorCyan.clone().lerp(colorTeal, 0.2);
                }
            } else { // Torso & Scanlines
                c = colorCyan.clone().lerp(colorTeal, Math.min(1, Math.max(0, (-y) / 60.0)));
            }

            this.colors[i3] = c.r;
            this.colors[i3 + 1] = c.g;
            this.colors[i3 + 2] = c.b;

            idx++;
        };

        // 1. EXTRACT VERTICES FROM REAL HUMAN 3D SCAN
        const rawPositions = headGeometry.attributes.position.array;
        const scale = 5.8;
        const yOffset = 28;

        for (let i = 0; i < rawPositions.length; i += 3) {
            let hx = rawPositions[i] * scale;
            let hy = rawPositions[i + 1] * scale + yOffset;
            let hz = rawPositions[i + 2] * scale;

            // Classify mouth/lip vertices for speech mimic
            const isMouth = (hy > 16 && hy < 27 && Math.abs(hx) < 14 && hz > 8);
            const type = isMouth ? 1 : 0;

            addParticle(hx, hy, hz, type);

            // Add interpolated particles for higher holographic density on face
            if (hz > 4 && Math.random() > 0.35) {
                addParticle(
                    hx + (Math.random() - 0.5) * 1.2,
                    hy + (Math.random() - 0.5) * 1.2,
                    hz + (Math.random() - 0.5) * 1.2,
                    type
                );
            }
        }

        // 2. CURVED ANATOMICAL SHOULDERS, CLAVICLES & UPPER TORSO (BUST)
        // Generates organic flowing horizontal contour scanlines
        const torsoSlices = 95;
        for (let s = 0; s < torsoSlices; s++) {
            const vNorm = s / torsoSlices;
            const y = -65 + vNorm * 72; // Y from -65 to +7 (connecting seamlessly to neck)

            // Natural Anatomical Shoulder & Torso Width Calculation
            let halfWidth = 16;
            let depth = 16;
            let centerZ = 0;

            if (y >= 4) { // Neck base connection
                halfWidth = 15 + (7 - y) * 1.2;
                depth = 15;
                centerZ = 2;
            } else if (y >= -16) { // Trapezius slope & Clavicles to Shoulder Caps
                const trapT = (4 - y) / 20.0; // 0 at neck, 1 at shoulders
                // S-curve shoulder slope
                const smoothTrap = Math.sin(trapT * Math.PI * 0.5);
                halfWidth = 18 + Math.pow(smoothTrap, 1.2) * 68; // Widens out to 86 at shoulders
                depth = 17 + Math.sin(trapT * Math.PI) * 7.5;
                centerZ = 2 + Math.sin(trapT * Math.PI) * 4;
            } else { // Chest, Pectorals & Ribcage
                const chestT = (-16 - y) / 49.0;
                halfWidth = 86 - chestT * 28; // Tapers down to ~58 at mid-torso
                depth = 24.5 - chestT * 6;
                centerZ = 2 - chestT * 3;
            }

            const pointsPerSlice = Math.floor(220 + halfWidth * 2.8);
            for (let p = 0; p < pointsPerSlice; p++) {
                const u = (p / pointsPerSlice) * Math.PI * 2;
                let cosU = Math.cos(u);
                let sinU = Math.sin(u);

                let px = cosU * halfWidth;
                let pz = centerZ + sinU * depth;

                // Anatomical Pectoral muscle curves
                if (pz > 0 && y < -12 && y > -45) {
                    const pect = Math.sin(Math.abs(px) / halfWidth * Math.PI) * 6.5;
                    pz += pect;
                }

                // Clavicle collarbone ridges
                if (pz > 0 && y >= -18 && y <= -8) {
                    const clav = Math.cos((px / halfWidth) * Math.PI * 1.5) * 4.5;
                    pz += Math.max(0, clav);
                }

                // Deltoid shoulder rounding
                if (Math.abs(px) > 65 && y >= -25 && y <= -12) {
                    pz += Math.sin((Math.abs(px) - 65) / 21 * Math.PI) * 4.0;
                }

                addParticle(
                    px + (Math.random() - 0.5) * 1.4,
                    y + (Math.random() - 0.5) * 1.1,
                    pz + (Math.random() - 0.5) * 1.4,
                    0
                );
            }
        }

        // 3. GLOWING INTERNAL VASCULAR & NEURAL BRANCHING TREE ("رگ‌های داخل بدن")
        this.generateVascularNetwork(addParticle);

        // 4. LUMINOUS FACIAL ENERGY VORTEX (Center Core Glow)
        const coreCount = 3800;
        for (let c = 0; c < coreCount; c++) {
            const rad = Math.random() * 18;
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;

            const cx = Math.sin(theta) * Math.cos(phi) * (rad * 0.9);
            const cy = 27 + Math.cos(theta) * (rad * 1.3);
            const cz = 10 + Math.sin(theta) * Math.sin(phi) * (rad * 0.75);

            addParticle(cx, cy, cz, 3);
        }

        // 5. FILL REMAINING WITH AMBIENT CYBERNETIC EMBERS
        while (idx < count) {
            const ax = (Math.random() - 0.5) * 360;
            const ay = -85 + Math.random() * 200;
            const az = (Math.random() - 0.5) * 280;
            const dustCol = Math.random() > 0.6 ? colorGold : colorCyan;
            addParticle(ax, ay, az, 4, dustCol);
        }

        this.finishMeshConstruction();
    }

    buildProceduralAvatar() {
        // High-precision anatomical procedural fallback
        let idx = 0;
        const count = this.particleCount;
        const colorCyan = new THREE.Color(0x00f0ff);
        const colorTeal = new THREE.Color(0x00d4aa);
        const colorGold = new THREE.Color(0xffbb00);
        const colorAmber = new THREE.Color(0xff8800);
        const colorCoreHot = new THREE.Color(0xff4400);

        const addParticle = (x, y, z, type, customColor = null) => {
            if (idx >= count) return;
            const i3 = idx * 3;

            this.targetPositions[i3] = x;
            this.targetPositions[i3 + 1] = y;
            this.targetPositions[i3 + 2] = z;

            this.basePositions[i3] = x;
            this.basePositions[i3 + 1] = y;
            this.basePositions[i3 + 2] = z;

            const angle = Math.random() * Math.PI * 2;
            const radius = 220 + Math.random() * 650;
            this.currentPositions[i3] = Math.cos(angle) * radius;
            this.currentPositions[i3 + 1] = (Math.random() - 0.5) * 800;
            this.currentPositions[i3 + 2] = (Math.random() - 0.5) * 600;

            this.particleTypes[idx] = type;

            let c = colorCyan;
            if (customColor) {
                c = customColor;
            } else if (type === 2) {
                c = Math.random() > 0.4 ? colorGold : colorAmber;
            } else if (type === 3) {
                c = colorAmber.clone().lerp(colorCoreHot, Math.random() * 0.75);
            } else if (type === 1) {
                c = colorGold.clone().lerp(colorAmber, 0.45);
            } else {
                c = colorCyan.clone().lerp(colorTeal, Math.min(1, Math.max(0, (-y) / 60.0)));
            }

            this.colors[i3] = c.r;
            this.colors[i3 + 1] = c.g;
            this.colors[i3 + 2] = c.b;

            idx++;
        };

        // Procedural Head Slices
        for (let s = 0; s < 70; s++) {
            const vNorm = s / 70;
            const y = 8 + vNorm * 48; // Y from 8 to 56
            let rx = 22;
            let rz = 24;

            if (y > 40) {
                const domeT = (y - 40) / 16;
                const rad = Math.sqrt(Math.max(0, 1 - domeT * domeT));
                rx = 23 * rad;
                rz = 25 * rad;
            } else if (y > 22) {
                rx = 23;
                rz = 24;
            } else {
                const jawT = (22 - y) / 14;
                rx = 23 - jawT * 9;
                rz = 24 - jawT * 5;
            }

            const pts = 180;
            for (let p = 0; p < pts; p++) {
                const u = (p / pts) * Math.PI * 2;
                let px = Math.cos(u) * rx;
                let pz = Math.sin(u) * rz;

                if (y > 26 && y < 38 && Math.abs(px) < 6 && pz > 14) pz += 7.5; // Nose
                if (y > 18 && y < 27 && Math.abs(px) < 13 && pz > 12) {
                    addParticle(px, y, pz, 1); // Lips/Mouth
                } else {
                    addParticle(px, y, pz, 0);
                }
            }
        }

        // Procedural Torso & Shoulders
        for (let s = 0; s < 85; s++) {
            const vNorm = s / 85;
            const y = -65 + vNorm * 73;
            let halfWidth = 16;
            let depth = 16;

            if (y >= 4) {
                halfWidth = 15;
            } else if (y >= -16) {
                const trapT = (4 - y) / 20.0;
                halfWidth = 16 + Math.pow(trapT, 1.2) * 70;
                depth = 17 + Math.sin(trapT * Math.PI) * 7;
            } else {
                const chestT = (-16 - y) / 49.0;
                halfWidth = 86 - chestT * 28;
                depth = 24 - chestT * 6;
            }

            const pts = Math.floor(200 + halfWidth * 2.5);
            for (let p = 0; p < pts; p++) {
                const u = (p / pts) * Math.PI * 2;
                let px = Math.cos(u) * halfWidth;
                let pz = Math.sin(u) * depth;
                addParticle(px, y, pz, 0);
            }
        }

        this.generateVascularNetwork(addParticle);

        while (idx < count) {
            const ax = (Math.random() - 0.5) * 360;
            const ay = -85 + Math.random() * 200;
            const az = (Math.random() - 0.5) * 280;
            addParticle(ax, ay, az, 4);
        }

        this.finishMeshConstruction();
    }

    generateVascularNetwork(addParticle) {
        // Procedural 3D branching vascular and neural tree matching the screenshot
        const generateBranch = (startPt, endPt, branchCount, jitter = 2.4, depth = 0) => {
            const steps = 55;
            for (let s = 0; s <= steps; s++) {
                const prog = s / steps;
                const pt = new THREE.Vector3().copy(startPt).lerp(endPt, prog);

                pt.x += Math.sin(prog * Math.PI * 4 + depth) * jitter;
                pt.y += Math.cos(prog * Math.PI * 3 + depth) * (jitter * 0.6);
                pt.z += Math.sin(prog * Math.PI * 5 + depth * 2) * (jitter * 0.8);

                const cluster = 3 + Math.floor(Math.random() * 3);
                for (let k = 0; k < cluster; k++) {
                    addParticle(
                        pt.x + (Math.random() - 0.5) * 1.8,
                        pt.y + (Math.random() - 0.5) * 1.8,
                        pt.z + (Math.random() - 0.5) * 1.8,
                        2
                    );
                }

                if (branchCount > 0 && s % 16 === 0 && s > 8 && s < steps - 6) {
                    const sideDir = (Math.random() > 0.5 ? 1 : -1);
                    const subEnd = new THREE.Vector3(
                        pt.x + sideDir * (15 + Math.random() * 28),
                        pt.y - (10 + Math.random() * 22),
                        pt.z + (Math.random() - 0.5) * 8
                    );
                    generateBranch(pt, subEnd, branchCount - 1, jitter * 0.7, depth + 1);
                }
            }
        };

        // Carotid Arteries & Jugular Lines (Throat / Neck)
        generateBranch(new THREE.Vector3(-6, 32, 10), new THREE.Vector3(-10, -14, 12), 2, 2.2);
        generateBranch(new THREE.Vector3(6, 32, 10), new THREE.Vector3(10, -14, 12), 2, 2.2);

        // Vocal Cord & Thyroid Plexus
        generateBranch(new THREE.Vector3(0, 24, 12), new THREE.Vector3(0, -4, 10), 2, 1.8);

        // Aortic Arch & Cardiac Center (Mid-Chest)
        generateBranch(new THREE.Vector3(0, -12, 11), new THREE.Vector3(0, -52, 14), 3, 3.2);

        // Subclavian Vessels (Spreading across collarbones to shoulders)
        generateBranch(new THREE.Vector3(-8, -10, 11), new THREE.Vector3(-72, -24, 6), 3, 3.0);
        generateBranch(new THREE.Vector3(8, -10, 11), new THREE.Vector3(72, -24, 6), 3, 3.0);

        // Intercostal Thoracic Branches (Ribs and Chest)
        generateBranch(new THREE.Vector3(-6, -24, 14), new THREE.Vector3(-42, -58, 8), 2, 2.5);
        generateBranch(new THREE.Vector3(6, -24, 14), new THREE.Vector3(42, -58, 8), 2, 2.5);
    }

    finishMeshConstruction() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.currentPositions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.9,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.particleSystem.position.y = 8;
        this.scene.add(this.particleSystem);
        this.isLoaded = true;
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        });

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

        if (window.jarvisAudio) window.jarvisAudio.playBoot();
    }

    hideAvatar() {
        if (!this.isForming) return;
        this.container.style.opacity = '0';
        this.container.style.pointerEvents = 'none';
        this.isForming = false;

        if (this.particleSystem) {
            const count = this.particleCount;
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const angle = Math.random() * Math.PI * 2;
                const radius = 220 + Math.random() * 650;
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

        // Smooth Parallax Mouse Tracking
        this.targetRotationY = this.mouseX * 0.36;
        this.targetRotationX = -this.mouseY * 0.20;
        
        this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.06;
        this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.06;

        if (this.particleSystem && this.isLoaded) {
            this.particleSystem.rotation.y = this.currentRotationY;
            this.particleSystem.rotation.x = this.currentRotationX;

            // Speech Mimic Audio Intensity
            let rawSpeech = 0.0;
            if (window.jarvisAudio && window.jarvisAudio.getSpeechIntensity) {
                rawSpeech = window.jarvisAudio.getSpeechIntensity();
            } else if (window.jarvisAudio && window.jarvisAudio.isSpeaking) {
                rawSpeech = Math.abs(Math.sin(time * 14.0)) * 0.8;
            }

            this.smoothSpeechIntensity += (rawSpeech - this.smoothSpeechIntensity) * 0.28;
            this.speechPhase += (0.15 + this.smoothSpeechIntensity * 0.35);

            const speech = this.smoothSpeechIntensity;
            const phoneme = Math.sin(this.speechPhase * 5.5);

            if (this.amberCoreLight) {
                this.amberCoreLight.intensity = 2.5 + speech * 4.0 + Math.sin(time * 3) * 0.4;
            }

            if (this.isForming) {
                const count = this.particleCount;
                const pos = this.currentPositions;
                const base = this.basePositions;
                const types = this.particleTypes;
                const lerpSpeed = 0.038;

                for (let i = 0; i < count; i++) {
                    const i3 = i * 3;
                    const type = types[i];

                    let tx = base[i3];
                    let ty = base[i3 + 1];
                    let tz = base[i3 + 2];

                    // 1. Scanline Wave Ripple across the Body
                    if (type === 0) {
                        const wave = Math.sin(ty * 0.14 - time * 2.8) * 1.1;
                        tz += wave;
                    }

                    // 2. Natural Speech Mimic & Lip Articulation
                    if (type === 1) {
                        if (ty < 23.5) { // Lower Lip & Jaw drop
                            const jawDrop = speech * 4.6 * (0.65 + Math.abs(phoneme) * 0.35);
                            ty -= jawDrop;
                            tz += Math.sin(phoneme * Math.PI) * 1.2 * speech;
                        } else if (ty >= 23.5) { // Upper Lip
                            ty += speech * 1.3 * Math.max(0, phoneme);
                        }
                        tx *= (1.0 + speech * 0.16 * phoneme); // Lip corner stretch
                    }

                    // 3. Glowing Vascular Action Potential Pulses
                    if (type === 2) {
                        const pulse = Math.sin((tx + ty + tz) * 0.22 - time * 7.5);
                        if (pulse > 0.72) {
                            tz += 0.8;
                        }
                        if (speech > 0.1) {
                            tz += Math.sin(time * 15.0 + ty * 0.12) * (speech * 1.3);
                        }
                    }

                    // 4. Vocal Core Energy Vortex
                    if (type === 3) {
                        const coreExpansion = 1.0 + speech * 0.32 + Math.sin(time * 4.0) * 0.08;
                        tx = base[i3] * coreExpansion;
                        ty = 27 + (base[i3 + 1] - 27) * coreExpansion;
                        tz = 10 + (base[i3 + 2] - 10) * coreExpansion;
                    }

                    // 5. Ambient Cybernetic Embers
                    if (type === 4) {
                        ty += Math.sin(time + tx) * 0.4;
                        tx += Math.cos(time * 0.8 + ty) * 0.4;
                    }

                    // Natural chest breathing
                    if (ty < 0) {
                        const breath = Math.sin(time * 1.8) * 1.1;
                        tz += breath * Math.max(0, (-ty) / 50.0);
                    }

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

document.addEventListener('DOMContentLoaded', () => {
    window.jarvisAvatar = new AvatarEngine();
    
    window.showHolographicAvatar = () => {
        if (window.jarvisAvatar) window.jarvisAvatar.formAvatar();
    };
    window.hideHolographicAvatar = () => {
        if (window.jarvisAvatar) window.jarvisAvatar.hideAvatar();
    };
});
