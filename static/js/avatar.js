/**
 * J.A.R.V.I.S. Holographic Avatar Engine (Mark-86 Next-Gen)
 * High-Definition 3D Human Bust with Glowing Neural/Vascular Pathways
 * and Natural Speech Mimic / Audio-Synchronized Articulation.
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

        const width = 340;
        const height = 344;
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
        this.camera.position.set(0, -3.5, 195);
        this.camera.lookAt(0, -3.5, 0);

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.container.appendChild(this.renderer.domElement);

        // Core system state
        this.particleSystem = null;
        this.isForming = false;
        this.isLoaded = false;
        this.isVisible = false;
        this.animFrameId = null;
        
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

        // Particle Data Arrays (Optimized to 32,000 for 60FPS fluid rendering)
        this.particleCount = 32000;
        this.basePositions = new Float32Array(this.particleCount * 3);
        this.targetPositions = new Float32Array(this.particleCount * 3);
        this.currentPositions = new Float32Array(this.particleCount * 3);
        this.colors = new Float32Array(this.particleCount * 3);
        this.particleTypes = new Uint8Array(this.particleCount); // 0: Contour Scanline, 1: Face/Lip, 2: Veins/Neural, 3: Core, 4: Dust

        this.glowTexture = this.createGlowPointTexture();
        this.loadHumanBustModel();
        this.bindEvents();

        // Initial hidden state
        this.container.style.opacity = '0';
        this.container.style.pointerEvents = 'none';
        this.container.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    createGlowPointTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.2, 'rgba(0, 240, 255, 0.95)');
        grad.addColorStop(0.5, 'rgba(0, 180, 255, 0.4)');
        grad.addColorStop(0.8, 'rgba(0, 120, 255, 0.1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(32, 32, 32, 0, Math.PI * 2);
        ctx.fill();
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    loadHumanBustModel() {
        // Load genuine 3D human scan or fallback seamlessly to anatomical procedural generator
        if (typeof THREE.GLTFLoader !== 'undefined') {
            const loader = new THREE.GLTFLoader();
            loader.load('/static/models/LeePerrySmith.glb', (gltf) => {
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
            }, undefined, () => {
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

            // Fluid localized quantum initialization
            this.currentPositions[i3] = x + (Math.random() - 0.5) * 35;
            this.currentPositions[i3 + 1] = y + (Math.random() - 0.5) * 35;
            this.currentPositions[i3 + 2] = z + (Math.random() - 0.5) * 35;

            this.particleTypes[idx] = type;

            let c = colorCyan;
            if (customColor) {
                c = customColor;
            } else if (type === 2) { // Veins / Neural
                c = Math.random() > 0.4 ? colorGold : colorAmber;
            } else if (type === 3) { // Vocal Vortex / Core
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

        // 1. EXTRACT HEAD VERTICES FROM REAL SCAN
        const rawPositions = headGeometry.attributes.position.array;
        const scale = 5.8;
        const yOffset = 28;

        for (let i = 0; i < rawPositions.length; i += 3) {
            let hx = rawPositions[i] * scale;
            let hy = rawPositions[i + 1] * scale + yOffset;
            let hz = rawPositions[i + 2] * scale;

            const isMouth = (hy > 16 && hy < 27 && Math.abs(hx) < 14 && hz > 8);
            const type = isMouth ? 1 : 0;

            addParticle(hx, hy, hz, type);

            if (hz > 4 && Math.random() > 0.45) {
                addParticle(
                    hx + (Math.random() - 0.5) * 1.1,
                    hy + (Math.random() - 0.5) * 1.1,
                    hz + (Math.random() - 0.5) * 1.1,
                    type
                );
            }
        }

        // 2. ANATOMICAL SHOULDERS, CLAVICLES & UPPER TORSO (BUST)
        const torsoSlices = 80;
        for (let s = 0; s < torsoSlices; s++) {
            const vNorm = s / torsoSlices;
            const y = -58 + vNorm * 65; // Y from -58 to +7 connecting to neck

            let halfWidth = 15;
            let depth = 15;
            let centerZ = 0;

            if (y >= 0) {
                halfWidth = 15 + (7 - y) * 1.2;
                depth = 15;
                centerZ = 2;
            } else if (y >= -16) {
                const trapT = (0 - y) / 16.0;
                const smoothTrap = Math.sin(trapT * Math.PI * 0.5);
                halfWidth = 16 + Math.pow(smoothTrap, 1.2) * 59; // Widens out to 75 at shoulders
                depth = 16 + Math.sin(trapT * Math.PI) * 6;
                centerZ = 2 + Math.sin(trapT * Math.PI) * 3;
            } else {
                const chestT = (-16 - y) / 42.0;
                halfWidth = 75 - chestT * 23;
                depth = 22 - chestT * 4;
                centerZ = 2 - chestT * 2;
            }

            const pointsPerSlice = Math.floor(160 + halfWidth * 1.6);
            for (let p = 0; p < pointsPerSlice; p++) {
                const u = (p / pointsPerSlice) * Math.PI * 2;
                let px = Math.cos(u) * halfWidth;
                let pz = centerZ + Math.sin(u) * depth;

                if (pz > 0 && y < -10 && y > -40) {
                    const pect = Math.sin(Math.abs(px) / (halfWidth || 1) * Math.PI) * 5.5;
                    pz += pect;
                }
                if (pz > 0 && y >= -16 && y <= -6) {
                    const clav = Math.cos((px / (halfWidth || 1)) * Math.PI * 1.5) * 4.0;
                    pz += Math.max(0, clav);
                }

                addParticle(
                    px + (Math.random() - 0.5) * 1.2,
                    y + (Math.random() - 0.5) * 1.0,
                    pz + (Math.random() - 0.5) * 1.2,
                    0
                );
            }
        }

        // 3. GLOWING INTERNAL VASCULAR & NEURAL TREE
        this.generateVascularNetwork(addParticle);

        // 4. LUMINOUS FACIAL ENERGY VORTEX
        const coreCount = 2400;
        for (let c = 0; c < coreCount; c++) {
            const rad = Math.random() * 16;
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;

            const cx = Math.sin(theta) * Math.cos(phi) * (rad * 0.9);
            const cy = 26 + Math.cos(theta) * (rad * 1.2);
            const cz = 9 + Math.sin(theta) * Math.sin(phi) * (rad * 0.7);

            addParticle(cx, cy, cz, 3);
        }

        // 5. AMBIENT CYBERNETIC EMBERS
        while (idx < count) {
            const ax = (Math.random() - 0.5) * 160;
            const ay = -65 + Math.random() * 125;
            const az = (Math.random() - 0.5) * 120;
            const dustCol = Math.random() > 0.6 ? colorGold : colorCyan;
            addParticle(ax, ay, az, 4, dustCol);
        }

        this.finishMeshConstruction();
    }

    buildProceduralAvatar() {
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

            this.currentPositions[i3] = x + (Math.random() - 0.5) * 35;
            this.currentPositions[i3 + 1] = y + (Math.random() - 0.5) * 35;
            this.currentPositions[i3 + 2] = z + (Math.random() - 0.5) * 35;

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

        // Procedural Cranium & Facial Slices
        for (let s = 0; s < 62; s++) {
            const vNorm = s / 62;
            const y = 6 + vNorm * 45;
            let rx = 22;
            let rz = 24;

            if (y > 38) {
                const domeT = (y - 38) / 13;
                const rad = Math.sqrt(Math.max(0, 1 - domeT * domeT));
                rx = 22 * rad;
                rz = 24 * rad;
            } else if (y < 20) {
                const jawT = (20 - y) / 14;
                rx = 22 - jawT * 8;
                rz = 24 - jawT * 5;
            }

            const pts = 145;
            for (let p = 0; p < pts; p++) {
                const u = (p / pts) * Math.PI * 2;
                let px = Math.cos(u) * rx;
                let pz = Math.sin(u) * rz;

                if (y > 24 && y < 35 && Math.abs(px) < 5 && pz > 14) pz += 7.0; // Nose
                if (y > 17 && y < 25 && Math.abs(px) < 12 && pz > 12) {
                    addParticle(px, y, pz, 1); // Mouth & Lips
                } else {
                    addParticle(px, y, pz, 0);
                }
            }
        }

        // Procedural Torso & Shoulders
        for (let s = 0; s < 78; s++) {
            const vNorm = s / 78;
            const y = -58 + vNorm * 65;
            let halfWidth = 15;
            let depth = 15;

            if (y >= 0) {
                halfWidth = 15;
            } else if (y >= -16) {
                const trapT = (0 - y) / 16.0;
                halfWidth = 15 + Math.pow(trapT, 1.2) * 60;
                depth = 16 + Math.sin(trapT * Math.PI) * 6;
            } else {
                const chestT = (-16 - y) / 42.0;
                halfWidth = 75 - chestT * 23;
                depth = 22 - chestT * 4;
            }

            const pts = Math.floor(165 + halfWidth * 1.6);
            for (let p = 0; p < pts; p++) {
                const u = (p / pts) * Math.PI * 2;
                let px = Math.cos(u) * halfWidth;
                let pz = Math.sin(u) * depth;
                addParticle(px, y, pz, 0);
            }
        }

        this.generateVascularNetwork(addParticle);

        while (idx < count) {
            const ax = (Math.random() - 0.5) * 160;
            const ay = -65 + Math.random() * 125;
            const az = (Math.random() - 0.5) * 120;
            addParticle(ax, ay, az, 4);
        }

        this.finishMeshConstruction();
    }

    generateVascularNetwork(addParticle) {
        const generateBranch = (startPt, endPt, branchCount, jitter = 2.0, depth = 0) => {
            const steps = 40;
            for (let s = 0; s <= steps; s++) {
                const prog = s / steps;
                const pt = new THREE.Vector3().copy(startPt).lerp(endPt, prog);

                pt.x += Math.sin(prog * Math.PI * 4 + depth) * jitter;
                pt.y += Math.cos(prog * Math.PI * 3 + depth) * (jitter * 0.5);
                pt.z += Math.sin(prog * Math.PI * 5 + depth * 2) * (jitter * 0.6);

                const cluster = 2 + Math.floor(Math.random() * 2);
                for (let k = 0; k < cluster; k++) {
                    addParticle(
                        pt.x + (Math.random() - 0.5) * 1.5,
                        pt.y + (Math.random() - 0.5) * 1.5,
                        pt.z + (Math.random() - 0.5) * 1.5,
                        2
                    );
                }

                if (branchCount > 0 && s % 14 === 0 && s > 6 && s < steps - 4) {
                    const sideDir = (Math.random() > 0.5 ? 1 : -1);
                    const subEnd = new THREE.Vector3(
                        pt.x + sideDir * (12 + Math.random() * 20),
                        pt.y - (8 + Math.random() * 16),
                        pt.z + (Math.random() - 0.5) * 6
                    );
                    generateBranch(pt, subEnd, branchCount - 1, jitter * 0.7, depth + 1);
                }
            }
        };

        // Carotid Arteries & Jugular Lines (Neck)
        generateBranch(new THREE.Vector3(-6, 30, 9), new THREE.Vector3(-8, -10, 10), 2, 1.8);
        generateBranch(new THREE.Vector3(6, 30, 9), new THREE.Vector3(8, -10, 10), 2, 1.8);

        // Vocal Cord & Thyroid Plexus
        generateBranch(new THREE.Vector3(0, 22, 11), new THREE.Vector3(0, -4, 9), 2, 1.5);

        // Aortic Arch & Cardiac Core (Mid-Chest)
        generateBranch(new THREE.Vector3(0, -10, 10), new THREE.Vector3(0, -45, 12), 2, 2.5);

        // Subclavian Arteries (Shoulders)
        generateBranch(new THREE.Vector3(-7, -8, 10), new THREE.Vector3(-60, -20, 5), 2, 2.4);
        generateBranch(new THREE.Vector3(7, -8, 10), new THREE.Vector3(60, -20, 5), 2, 2.4);
    }

    finishMeshConstruction() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.currentPositions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        const material = new THREE.PointsMaterial({
            size: 2.2,
            map: this.glowTexture,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.particleSystem.position.set(0, 0, 0);
        this.particleSystem.frustumCulled = false;
        this.scene.add(this.particleSystem);
        this.isLoaded = true;
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.resizeToContainer();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.renderer || !this.container) return;
            const w = window.innerWidth || 1;
            const h = window.innerHeight || 1;
            this.mouseX = (e.clientX / w) * 2 - 1;
            this.mouseY = -(e.clientY / h) * 2 + 1;
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isForming) {
                this.hideAvatar();
            }
        });
    }

    formAvatar() {
        if (!this.container) return;
        this.container.style.display = 'block';
        void this.container.offsetWidth;
        this.container.style.opacity = '1';
        this.container.style.pointerEvents = 'auto';
        this.isForming = true;
        this.isVisible = true;

        this.resizeToContainer();

        if (window.jarvisAudio && window.jarvisAudio.playBoot) {
            window.jarvisAudio.playBoot();
        }
        if (!this.animFrameId) {
            this.animate();
        }
    }

    hideAvatar() {
        if (!this.container) return;
        this.isVisible = false;
        this.isForming = false;
        this.container.style.opacity = '0';
        this.container.style.pointerEvents = 'none';

        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        setTimeout(() => {
            if (!this.isVisible && this.container) {
                this.container.style.display = 'none';
            }
        }, 400);
    }

    resizeToContainer() {
        if (!this.container || !this.camera || !this.renderer) return;
        const width = this.container.clientWidth || 340;
        const totalHeight = this.container.clientHeight || 380;
        const height = Math.max(100, totalHeight - 36);
        if (width > 0 && height > 0) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }

    animate() {
        if (!this.isVisible || !this.container || this.container.style.display === 'none' || this.container.style.opacity === '0') {
            this.animFrameId = null;
            return;
        }
        this.animFrameId = requestAnimationFrame(() => this.animate());

        const time = performance.now() * 0.001;

        // Smooth Parallax Mouse Tracking
        this.targetRotationY = this.mouseX * 0.32;
        this.targetRotationX = -this.mouseY * 0.18;
        
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
                const lerpSpeed = 0.08;

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
                            const jawDrop = speech * 4.2 * (0.65 + Math.abs(phoneme) * 0.35);
                            ty -= jawDrop;
                            tz += Math.sin(phoneme * Math.PI) * 1.2 * speech;
                        } else if (ty >= 23.5) { // Upper Lip
                            ty += speech * 1.2 * Math.max(0, phoneme);
                        }
                        tx *= (1.0 + speech * 0.14 * phoneme); // Lip corner stretch
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
                        const coreExpansion = 1.0 + speech * 0.30 + Math.sin(time * 4.0) * 0.08;
                        tx = base[i3] * coreExpansion;
                        ty = 26 + (base[i3 + 1] - 26) * coreExpansion;
                        tz = 9 + (base[i3 + 2] - 9) * coreExpansion;
                    }

                    // 5. Ambient Cybernetic Embers
                    if (type === 4) {
                        ty += Math.sin(time + tx) * 0.3;
                        tx += Math.cos(time * 0.8 + ty) * 0.3;
                    }

                    // Natural chest breathing
                    if (ty < 0) {
                        const breath = Math.sin(time * 1.8) * 1.0;
                        tz += breath * Math.max(0, (-ty) / 50.0);
                    }

                    pos[i3] += (tx - pos[i3]) * lerpSpeed;
                    pos[i3 + 1] += (ty - pos[i3 + 1]) * lerpSpeed;
                    pos[i3 + 2] += (tz - pos[i3 + 2]) * lerpSpeed;
                }

                this.particleSystem.geometry.attributes.position.needsUpdate = true;
            }
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
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
