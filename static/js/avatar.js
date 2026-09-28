/**
 * J.A.R.V.I.S. Holographic Avatar Engine (Mark-86 Next-Gen)
 * High-Definition 3D Human Hologram with Glowing Eyes, Radiant Arc Reactor Core,
 * Luminous Neural/Vascular Pathways, Orbiting Halo Rings, and Natural Speech Mimic.
 */

class AvatarEngine {
    constructor() {
        this.container = document.getElementById('hologramContainer');
        if (!this.container) return;

        this.scene = new THREE.Scene();
        
        // Holographic point lights
        this.amberCoreLight = new THREE.PointLight(0xff9900, 4.0, 400);
        this.amberCoreLight.position.set(0, -28, 35);
        this.scene.add(this.amberCoreLight);

        this.cyanAuraLight = new THREE.PointLight(0x00f0ff, 2.5, 500);
        this.cyanAuraLight.position.set(0, 35, 60);
        this.scene.add(this.cyanAuraLight);

        const width = 340;
        const height = 344;
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
        this.camera.position.set(0, -2.5, 210);
        this.camera.lookAt(0, -2.5, 0);

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.domElement.style.display = 'block';
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

        // Speech & Natural Mimic state
        this.smoothSpeechIntensity = 0.0;
        this.speechPhase = 0.0;
        this.lastBlinkTime = 0;
        this.isBlinking = false;

        // Particle Data Arrays (50,000 for high-density holographic realism)
        this.particleCount = 50000;
        this.basePositions = new Float32Array(this.particleCount * 3);
        this.targetPositions = new Float32Array(this.particleCount * 3);
        this.currentPositions = new Float32Array(this.particleCount * 3);
        this.colors = new Float32Array(this.particleCount * 3);
        // Types: 0: Skin/Torso Scanlines, 1: Face/Lips, 2: Vascular/Neural Tree, 3: Arc Reactor Core, 4: Embers, 5: Glowing Eyes, 6: Orbital Rings
        this.particleTypes = new Uint8Array(this.particleCount);

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
        grad.addColorStop(0.15, 'rgba(0, 240, 255, 0.95)');
        grad.addColorStop(0.4, 'rgba(0, 190, 255, 0.45)');
        grad.addColorStop(0.75, 'rgba(0, 120, 255, 0.12)');
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
        const colorDeepCyan = new THREE.Color(0x0088cc);
        const colorTeal = new THREE.Color(0x00d4aa);
        const colorGold = new THREE.Color(0xffbb00);
        const colorAmber = new THREE.Color(0xff8800);
        const colorCoreHot = new THREE.Color(0xff3300);
        const colorWhite = new THREE.Color(0xffffff);
        const colorEyeCyan = new THREE.Color(0x7df9ff);

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
            } else if (type === 5) { // Glowing Eyes
                c = Math.random() > 0.3 ? colorWhite : colorEyeCyan;
            } else if (type === 3) { // Radiant Arc Reactor Core
                const distToCore = Math.sqrt(x * x + (y + 28) * (y + 28));
                if (distToCore < 4.5) {
                    c = colorWhite.clone().lerp(colorGold, distToCore / 4.5);
                } else if (distToCore < 12.0) {
                    c = colorGold.clone().lerp(colorAmber, (distToCore - 4.5) / 7.5);
                } else {
                    c = colorAmber.clone().lerp(colorCoreHot, Math.random() * 0.7);
                }
            } else if (type === 2) { // Neural / Vascular Tree
                c = Math.random() > 0.45 ? colorGold : colorAmber;
            } else if (type === 1) { // Lips, Mouth, Nose
                const distToMouth = Math.sqrt(x * x + (y - 23) * (y - 23) + (z - 16) * (z - 16));
                if (distToMouth < 14) {
                    c = colorCyan.clone().lerp(colorTeal, 0.4);
                } else {
                    c = colorCyan;
                }
            } else if (type === 6) { // Holographic Orbital Rings
                c = Math.random() > 0.2 ? colorCyan : colorWhite;
            } else { // Torso & Scanlines
                const edgeFactor = Math.min(1, Math.max(0, Math.abs(x) / 70.0));
                c = colorCyan.clone().lerp(colorDeepCyan, edgeFactor * 0.65);
            }

            this.colors[i3] = c.r;
            this.colors[i3 + 1] = c.g;
            this.colors[i3 + 2] = c.b;

            idx++;
        };

        // 1. EXTRACT 3D HEAD VERTICES
        const rawPositions = headGeometry.attributes.position.array;
        const scale = 5.8;
        const yOffset = 28;
        
        // Dynamically downsample head to ~12k vertices so we don't overflow the particle array
        const vertexCount = rawPositions.length / 3;
        const step = Math.max(1, Math.floor(vertexCount / 12000));

        for (let i = 0; i < rawPositions.length; i += (3 * step)) {
            let hx = rawPositions[i] * scale;
            let hy = rawPositions[i + 1] * scale + yOffset;
            let hz = rawPositions[i + 2] * scale;

            const isMouth = (hy > 16 && hy < 27 && Math.abs(hx) < 14 && hz > 8);
            const type = isMouth ? 1 : 0;

            addParticle(hx, hy, hz, type);

            // Interpolate for ultra-high facial definition
            if (hz > 4 && Math.random() > 0.35) {
                addParticle(
                    hx + (Math.random() - 0.5) * 1.0,
                    hy + (Math.random() - 0.5) * 1.0,
                    hz + (Math.random() - 0.5) * 1.0,
                    type
                );
            }
        }

        // 2. GLOWING EYES (Left & Right)
        this.generateGlowingEyes(addParticle);

        // 3. ANATOMICAL SHOULDERS, CLAVICLES & CHEST (BUST)
        this.generateTorsoGeometry(addParticle);

        // 4. RADIANT CHEST ARC REACTOR CORE
        this.generateArcReactorCore(addParticle);

        // 5. RADIATING VASCULAR & NEURAL BRANCHING TREE
        this.generateVascularNetwork(addParticle);

        // 6. HOLOGRAPHIC ORBITAL HALO & INTERFACE RINGS
        this.generateOrbitalRings(addParticle);

        // 7. AMBIENT CYBERNETIC EMBERS
        while (idx < count) {
            const ax = (Math.random() - 0.5) * 170;
            const ay = -65 + Math.random() * 130;
            const az = (Math.random() - 0.5) * 130;
            const dustCol = Math.random() > 0.65 ? colorGold : colorCyan;
            addParticle(ax, ay, az, 4, dustCol);
        }

        this.finishMeshConstruction();
    }

    buildProceduralAvatar() {
        let idx = 0;
        const count = this.particleCount;
        const colorCyan = new THREE.Color(0x00f0ff);
        const colorDeepCyan = new THREE.Color(0x0088cc);
        const colorTeal = new THREE.Color(0x00d4aa);
        const colorGold = new THREE.Color(0xffbb00);
        const colorAmber = new THREE.Color(0xff8800);
        const colorCoreHot = new THREE.Color(0xff3300);
        const colorWhite = new THREE.Color(0xffffff);
        const colorEyeCyan = new THREE.Color(0x7df9ff);

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
            } else if (type === 5) {
                c = Math.random() > 0.3 ? colorWhite : colorEyeCyan;
            } else if (type === 3) {
                const distToCore = Math.sqrt(x * x + (y + 28) * (y + 28));
                if (distToCore < 4.5) {
                    c = colorWhite.clone().lerp(colorGold, distToCore / 4.5);
                } else if (distToCore < 12.0) {
                    c = colorGold.clone().lerp(colorAmber, (distToCore - 4.5) / 7.5);
                } else {
                    c = colorAmber.clone().lerp(colorCoreHot, Math.random() * 0.7);
                }
            } else if (type === 2) {
                c = Math.random() > 0.45 ? colorGold : colorAmber;
            } else if (type === 1) {
                c = colorCyan.clone().lerp(colorTeal, 0.4);
            } else if (type === 6) {
                c = Math.random() > 0.2 ? colorCyan : colorWhite;
            } else {
                const edgeFactor = Math.min(1, Math.max(0, Math.abs(x) / 70.0));
                c = colorCyan.clone().lerp(colorDeepCyan, edgeFactor * 0.65);
            }

            this.colors[i3] = c.r;
            this.colors[i3 + 1] = c.g;
            this.colors[i3 + 2] = c.b;

            idx++;
        };

        // Procedural Cranium & Face Slices
        for (let s = 0; s < 68; s++) {
            const vNorm = s / 68;
            const y = 6 + vNorm * 46;
            let rx = 22;
            let rz = 24;

            if (y > 38) {
                const domeT = (y - 38) / 14;
                const rad = Math.sqrt(Math.max(0, 1 - domeT * domeT));
                rx = 22 * rad;
                rz = 24 * rad;
            } else if (y < 20) {
                const jawT = (20 - y) / 14;
                rx = 22 - jawT * 8;
                rz = 24 - jawT * 5;
            }

            const pts = 155;
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

        // Volumetric Holographic Hair Waves
        for (let h = 0; h < 1400; h++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.45;
            const hrad = 22.5 + Math.random() * 3.5;
            const hx = Math.sin(phi) * Math.cos(theta) * hrad;
            const hy = 34 + Math.cos(phi) * (hrad * 1.15) + (Math.random() - 0.5) * 2;
            const hz = Math.sin(phi) * Math.sin(theta) * (hrad * 0.95);
            addParticle(hx, hy, hz, 0);
        }

        this.generateGlowingEyes(addParticle);
        this.generateTorsoGeometry(addParticle);
        this.generateArcReactorCore(addParticle);
        this.generateVascularNetwork(addParticle);
        this.generateOrbitalRings(addParticle);

        while (idx < count) {
            const ax = (Math.random() - 0.5) * 170;
            const ay = -65 + Math.random() * 130;
            const az = (Math.random() - 0.5) * 130;
            addParticle(ax, ay, az, 4);
        }

        this.finishMeshConstruction();
    }

    generateGlowingEyes(addParticle) {
        // High-density luminous white-cyan eye spheres matching the reference image
        for (let e = -1; e <= 1; e += 2) {
            const eyeX = e * 6.5;
            const eyeY = 34.8;
            const eyeZ = 14.8;
            for (let k = 0; k < 260; k++) {
                const r = Math.random() * 2.8;
                const theta = Math.random() * Math.PI * 2;
                const phi = (Math.random() - 0.5) * Math.PI * 0.85;
                const ex = eyeX + Math.cos(theta) * Math.cos(phi) * r;
                const ey = eyeY + Math.sin(theta) * Math.cos(phi) * (r * 0.8);
                const ez = eyeZ + Math.sin(phi) * (r * 0.65) + 0.6;
                addParticle(ex, ey, ez, 5);
            }
        }
    }

    generateTorsoGeometry(addParticle) {
        const torsoSlices = 82;
        for (let s = 0; s < torsoSlices; s++) {
            const vNorm = s / torsoSlices;
            const y = -58 + vNorm * 65;

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

            const pointsPerSlice = Math.floor(165 + halfWidth * 1.6);
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
    }

    generateArcReactorCore(addParticle) {
        // Radiant multi-tiered concentric golden-amber core in the middle of the chest
        const coreCenterX = 0;
        const coreCenterY = -28;
        const coreCenterZ = 12;

        for (let ring = 0; ring < 12; ring++) {
            const radius = ring * 1.9;
            const ringPts = Math.floor(50 + ring * 26);
            for (let p = 0; p < ringPts; p++) {
                const u = (p / ringPts) * Math.PI * 2;
                const cx = coreCenterX + Math.cos(u) * radius + (Math.random() - 0.5) * 0.7;
                const cy = coreCenterY + Math.sin(u) * radius + (Math.random() - 0.5) * 0.7;
                const cz = coreCenterZ + (Math.random() - 0.5) * 1.4;
                addParticle(cx, cy, cz, 3);
            }
        }
    }

    generateVascularNetwork(addParticle) {
        const generateBranch = (startPt, endPt, branchCount, jitter = 2.0, depth = 0) => {
            const steps = 38;
            for (let s = 0; s <= steps; s++) {
                const prog = s / steps;
                const pt = new THREE.Vector3().copy(startPt).lerp(endPt, prog);

                pt.x += Math.sin(prog * Math.PI * 4 + depth) * jitter;
                pt.y += Math.cos(prog * Math.PI * 3 + depth) * (jitter * 0.5);
                pt.z += Math.sin(prog * Math.PI * 5 + depth * 2) * (jitter * 0.6);

                const cluster = 2 + Math.floor(Math.random() * 2);
                for (let k = 0; k < cluster; k++) {
                    addParticle(
                        pt.x + (Math.random() - 0.5) * 1.4,
                        pt.y + (Math.random() - 0.5) * 1.4,
                        pt.z + (Math.random() - 0.5) * 1.4,
                        2
                    );
                }

                if (branchCount > 0 && s % 12 === 0 && s > 6 && s < steps - 4) {
                    const sideDir = (Math.random() > 0.5 ? 1 : -1);
                    const subEnd = new THREE.Vector3(
                        pt.x + sideDir * (12 + Math.random() * 18),
                        pt.y - (8 + Math.random() * 14),
                        pt.z + (Math.random() - 0.5) * 6
                    );
                    generateBranch(pt, subEnd, branchCount - 1, jitter * 0.7, depth + 1);
                }
            }
        };

        // Radiating directly from the Arc Reactor core upwards into the neck and cranium
        generateBranch(new THREE.Vector3(0, -28, 12), new THREE.Vector3(-6, 32, 10), 2, 2.0);
        generateBranch(new THREE.Vector3(0, -28, 12), new THREE.Vector3(6, 32, 10), 2, 2.0);

        // Subclavian radiating branches towards shoulders
        generateBranch(new THREE.Vector3(0, -28, 12), new THREE.Vector3(-65, -20, 6), 2, 2.4);
        generateBranch(new THREE.Vector3(0, -28, 12), new THREE.Vector3(65, -20, 6), 2, 2.4);

        // Lower thoracic rib branches
        generateBranch(new THREE.Vector3(0, -28, 12), new THREE.Vector3(-42, -55, 10), 1, 2.2);
        generateBranch(new THREE.Vector3(0, -28, 12), new THREE.Vector3(42, -55, 10), 1, 2.2);
    }

    generateOrbitalRings(addParticle) {
        // 1. Head Halo Orbital Rings (tilted 3D holographic rings revolving around crown)
        for (let r = 0; r < 2; r++) {
            const haloRadius = 28 + r * 5;
            const haloY = 46 + r * 4;
            const haloPts = 190;
            for (let p = 0; p < haloPts; p++) {
                const u = (p / haloPts) * Math.PI * 2;
                const hx = Math.cos(u) * haloRadius;
                const hz = Math.sin(u) * haloRadius;
                const hy = haloY + Math.sin(u) * 3.5;
                addParticle(hx, hy, hz, 6);
            }
        }

        // 2. Chest & Shoulder Orbital UI Ring
        for (let p = 0; p < 240; p++) {
            const u = (p / 240) * Math.PI * 2;
            const cx = Math.cos(u) * 82;
            const cz = Math.sin(u) * 38;
            const cy = -22 + Math.sin(u) * 4;
            addParticle(cx, cy, cz, 6);
        }

        // 3. Base Pedestal Projection Ring
        for (let p = 0; p < 220; p++) {
            const u = (p / 220) * Math.PI * 2;
            const bx = Math.cos(u) * 76;
            const bz = Math.sin(u) * 36;
            const by = -56;
            addParticle(bx, by, bz, 6);
        }
    }

    finishMeshConstruction() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.currentPositions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

        const material = new THREE.PointsMaterial({
            size: 3.2,
            sizeAttenuation: false,
            map: this.glowTexture,
            vertexColors: true,
            transparent: true,
            opacity: 0.96,
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
        if (!this.isVisible || !this.container) {
            this.animFrameId = null;
            return;
        }
        this.animFrameId = requestAnimationFrame(() => this.animate());

        const time = performance.now() * 0.001;

        // Smooth Parallax Mouse Tracking (Cinematic Head Turn)
        this.targetRotationY = this.mouseX * 0.32;
        this.targetRotationX = -this.mouseY * 0.18;
        
        this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.06;
        this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.06;

        if (this.particleSystem && this.isLoaded) {
            this.particleSystem.rotation.y = this.currentRotationY;
            this.particleSystem.rotation.x = this.currentRotationX;

            // Natural Eye Blink Cycle
            if (time - this.lastBlinkTime > 4.2) {
                this.isBlinking = true;
                if (time - this.lastBlinkTime > 4.35) {
                    this.isBlinking = false;
                    this.lastBlinkTime = time;
                }
            }

            // Speech Mimic Audio Intensity
            let rawSpeech = 0.0;
            if (window.jarvisAudio && window.jarvisAudio.getSpeechIntensity) {
                rawSpeech = window.jarvisAudio.getSpeechIntensity();
            } else if (window.jarvisAudio && window.jarvisAudio.isSpeaking) {
                rawSpeech = Math.abs(Math.sin(time * 14.0)) * 0.85;
            }

            this.smoothSpeechIntensity += (rawSpeech - this.smoothSpeechIntensity) * 0.28;
            this.speechPhase += (0.15 + this.smoothSpeechIntensity * 0.35);

            const speech = this.smoothSpeechIntensity;
            const phoneme = Math.sin(this.speechPhase * 5.5);

            // Arc Reactor light pulse
            if (this.amberCoreLight) {
                this.amberCoreLight.intensity = 3.5 + speech * 5.0 + Math.sin(time * 3.5) * 0.6;
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

                    // 0. Body Scanlines & Laser Ripple
                    if (type === 0) {
                        const wave = Math.sin(ty * 0.14 - time * 2.8) * 1.1;
                        tz += wave;
                    }

                    // 1. Natural Speech Mimic & Lip Articulation
                    if (type === 1) {
                        if (ty < 23.5) { // Lower Lip & Jaw drop
                            const jawDrop = speech * 4.4 * (0.65 + Math.abs(phoneme) * 0.35);
                            ty -= jawDrop;
                            tz += Math.sin(phoneme * Math.PI) * 1.2 * speech;
                        } else if (ty >= 23.5) { // Upper Lip
                            ty += speech * 1.2 * Math.max(0, phoneme);
                        }
                        tx *= (1.0 + speech * 0.14 * phoneme); // Lip corner stretch
                    }

                    // 2. Glowing Vascular Pulses from Arc Core
                    if (type === 2) {
                        const pulse = Math.sin((tx + ty + tz) * 0.22 - time * 7.5);
                        if (pulse > 0.7) {
                            tz += 0.8;
                        }
                        if (speech > 0.1) {
                            tz += Math.sin(time * 15.0 + ty * 0.12) * (speech * 1.4);
                        }
                    }

                    // 3. Radiant Chest Arc Reactor Core Pulse
                    if (type === 3) {
                        const corePulse = 1.0 + speech * 0.35 + Math.sin(time * 3.8) * 0.09;
                        tx = base[i3] * corePulse;
                        ty = -28 + (base[i3 + 1] - (-28)) * corePulse;
                        tz = 12 + (base[i3 + 2] - 12) * corePulse;
                    }

                    // 4. Ambient Cybernetic Embers
                    if (type === 4) {
                        ty += Math.sin(time + tx) * 0.3;
                        tx += Math.cos(time * 0.8 + ty) * 0.3;
                    }

                    // 5. Glowing Eyes (Intelligent Presence & Blinking)
                    if (type === 5) {
                        if (this.isBlinking) {
                            ty = 34.8 + (base[i3 + 1] - 34.8) * 0.15;
                        } else {
                            tz += Math.sin(time * 2.0) * 0.3;
                        }
                    }

                    // 6. Holographic Orbital Halo & UI Rings
                    if (type === 6) {
                        const rotSpeed = ty > 40 ? 0.4 : (ty > -30 ? -0.25 : 0.35);
                        const angle = time * rotSpeed;
                        const origX = base[i3];
                        const origZ = base[i3 + 2];
                        tx = origX * Math.cos(angle) - origZ * Math.sin(angle);
                        tz = origX * Math.sin(angle) + origZ * Math.cos(angle);
                    }

                    // Natural chest breathing (rhythmic 4-second cycle)
                    if (ty < -5 && ty > -55) {
                        const breath = Math.sin(time * 1.6) * 1.2;
                        tz += breath * Math.max(0, (-ty - 5) / 45.0);
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
