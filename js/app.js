/**
 * CATFISH Main Application Controller
 * Multi-species reproduction, real-life biology needs, fish poop particles (💩),
 * dynamic mission guidance banner, life stage evolution progress, real-time multiplayer,
 * and global leaderboards.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Parent Processors
    const faceParent1 = new FaceProcessor('seaman_face.png');
    await faceParent1.init();

    const faceParent2 = new FaceProcessor('seaman_face2.png');
    await faceParent2.init();

    let parentA = new Seaman(faceParent1, 'Catfish Alpha (Dad)', 3, false, null, 'catfish');
    let parentB = new Seaman(faceParent2, 'Goldfish Beta (Mom)', 3, false, null, 'goldfish');

    let seamen = [parentA, parentB];
    let familyTree = [];

    let currentGeneration = 1;
    let researchPoints = 0;
    let totalFishReleased = 0;
    let selectedFish = parentA;
    let isMultiplayerMode = false;

    const tank = new Tank(800, 600);
    const dialogue = new DialogueEngine(parentA, tank);
    const audio = new GameAudio();
    window.gameAudio = audio;

    // Create App Context for Multiplayer Manager
    const appContext = {
        get seamen() { return seamen; },
        get researchPoints() { return researchPoints; },
        get currentGeneration() { return currentGeneration; },
        get totalFishReleased() { return totalFishReleased; },
        get isMultiplayerMode() { return isMultiplayerMode; }
    };

    const multiplayer = new MultiplayerManager(appContext);
    multiplayer.init();
    window.multiplayerManager = multiplayer;

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        tank.resize(canvas.width, canvas.height);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let currentTool = 'hand';
    let isMouseDown = false;
    let grabbedSeaman = null;

    setTimeout(() => {
        dialogue.speak("Welcome to CATFISH Evolutionary Lab! Click 'How to Play' for objectives or connect online to see other aquarists!");
    }, 1200);

    // 2. Main Game Loop
    let lastTime = performance.now();
    function gameLoop(time) {
        const dt = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;

        tank.update(dt);

        for (let s of seamen) {
            s.update(dt, tank, seamen);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tank.drawBackground(ctx);

        for (let s of seamen) {
            s.draw(ctx);
        }

        // Draw remote online players' fish if in multiplayer mode
        if (isMultiplayerMode && multiplayer) {
            multiplayer.drawRemotePlayers(ctx);
        }

        tank.drawForeground(ctx);

        updateGauges();
        updateSelectedFishHUD();
        updateMissionBanner();
        checkAutonomousBreeding(dt);
        checkGameOverCondition();

        requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);

    // 3. Dynamic Mission & Guidance Banner System
    function updateMissionBanner() {
        const bannerIcon = document.querySelector('#missionBanner .mission-icon');
        const bannerTitle = document.querySelector('#missionBanner .mission-title');
        const bannerDesc = document.getElementById('missionDesc');
        if (!bannerTitle || !bannerDesc) return;

        // Check Critical Warnings first
        if (tank.oxygen < 45) {
            if (bannerIcon) bannerIcon.textContent = '⚠️';
            bannerTitle.textContent = 'CRITICAL WARNING: LOW OXYGEN (O2 < 45%)';
            bannerDesc.textContent = 'Turn on the 💨 Aerator Pump immediately to prevent fish suffocation!';
            return;
        }

        if (tank.cleanliness < 40 || tank.poops.length > 3) {
            if (bannerIcon) bannerIcon.textContent = '💩';
            bannerTitle.textContent = 'WARNING: TANK POLLUTION & FISH POOP';
            bannerDesc.textContent = 'Use the 🧹 Squeegee tool to clear fish poop and scrub substrate clean!';
            return;
        }

        if (seamen.some(s => !s.isDead && s.hunger > 70)) {
            if (bannerIcon) bannerIcon.textContent = '🍗';
            bannerTitle.textContent = 'ALERT: HUNGRY CATFISH';
            bannerDesc.textContent = 'Select 🟢 Feed Pellets tool and click inside the tank to feed your fish!';
            return;
        }

        const aliveAdults = seamen.filter(s => !s.isDead && s.stage >= 3);
        const aliveElders = seamen.filter(s => !s.isDead && s.stage === 4);

        if (aliveElders.length > 0) {
            if (bannerIcon) bannerIcon.textContent = '🌿';
            bannerTitle.textContent = `MILESTONE READY: RELEASE ELDER FROG-FISH`;
            bannerDesc.textContent = `Select ${aliveElders[0].name} and click "Release Elder Frog-Fish" to earn +1000 PTS & advance to Generation ${currentGeneration + 1}!`;
            return;
        }

        if (aliveAdults.length >= 2) {
            if (bannerIcon) bannerIcon.textContent = '💖';
            bannerTitle.textContent = `GOAL: INITIATE BREEDING RITUAL`;
            bannerDesc.textContent = `You have 2 adult fish! Click "💖 INITIATE MATING RITUAL" to hatch a Gen ${currentGeneration + 1} hybrid egg sac!`;
            return;
        }

        if (seamen.length < 2) {
            if (bannerIcon) bannerIcon.textContent = '➕';
            bannerTitle.textContent = `GOAL: INTRODUCE A SPECIES MATE`;
            bannerDesc.textContent = `Use "INTRODUCE SPECIES" in the side panel to add an adult Anglerfish, Goldfish, or Piranha partner!`;
            return;
        }

        // Standard Default Guidance
        if (bannerIcon) bannerIcon.textContent = '🎯';
        bannerTitle.textContent = `DYNASTY GENERATION ${currentGeneration} OF 5`;
        bannerDesc.textContent = `Keep water clean and O2 high. Feed fish pellets so they grow from Fry to Elder stage!`;
    }

    // 4. Mating & Cross-Species Genetic Fusion System
    async function triggerMatingRitual(isAutonomous = false) {
        if (seamen.length >= 12) {
            if (!isAutonomous) {
                dialogue.speak("Tank capacity reached (12 fish)! Release Elder fish into the wild to free up space!");
                multiplayer.showToast("⚠️ Tank capacity full (12/12 fish)! Release Elder fish to breed more.");
            }
            return;
        }

        const aliveAdults = seamen.filter(s => !s.isDead && s.stage >= 3 && !s.isMating && s.matingCooldown <= 0);
        if (aliveAdults.length < 2) {
            if (!isAutonomous) {
                dialogue.speak("You need at least 2 living, adult fish (Stage 4+) ready for mating!");
                multiplayer.showToast("⚠️ Need 2 adult fish ready to mate!");
            }
            return;
        }

        // Pair selection: prefer selectedFish if valid adult, otherwise pick first 2 available adults
        let p1 = aliveAdults[0];
        let p2 = aliveAdults[1];

        if (selectedFish && !selectedFish.isDead && selectedFish.stage >= 3 && !selectedFish.isMating && selectedFish.matingCooldown <= 0) {
            p1 = selectedFish;
            const targetPartner = aliveAdults.find(s => s !== selectedFish);
            if (targetPartner) p2 = targetPartner;
        }

        if (!isAutonomous) {
            audio.playButtonBeep();
            dialogue.speak(`Initializing genetic cross-breeding between ${p1.name} and ${p2.name}!`);
            multiplayer.showToast(`💖 Breeding ritual started between ${p1.name} & ${p2.name}!`);
        } else {
            multiplayer.showToast(`💖 ${p1.name} & ${p2.name} naturally initiated courtship!`);
        }

        p1.startMatingWith(p2);
        p2.startMatingWith(p1);

        setTimeout(() => {
            const offspringFace = FaceProcessor.createOffspringFace(p1.face, p2.face, 0.5);
            const inheritedTraits = Seaman.inheritTraits(p1, p2);

            const babySpecies = Math.random() < 0.5 ? p1.speciesId : p2.speciesId;
            const babyName = `Gen ${currentGeneration + 1} Hybrid #${familyTree.length + 1}`;
            const babyFish = new Seaman(offspringFace, babyName, 0, true, inheritedTraits, babySpecies);

            babyFish.x = tank.width * (0.3 + Math.random() * 0.4);
            babyFish.y = tank.height - 75;

            seamen.push(babyFish);
            researchPoints += 250;

            familyTree.push({
                name: babyName,
                faceUrl: offspringFace.previewUrl,
                parent1: `${p1.name} (${p1.speciesInfo.name})`,
                parent2: `${p2.name} (${p2.speciesInfo.name})`,
                traits: inheritedTraits.map(t => t.name).join(', ')
            });

            updateFamilyTreeUI();
            updateTargetFishDropdown();

            dialogue.speak(`A new ${babyFish.speciesInfo.name} hybrid egg sac has been born! (Pop: ${seamen.length}/12)`);
            multiplayer.showToast(`🥚 New ${babyFish.speciesInfo.name} egg sac hatched! (+250 PTS | Pop: ${seamen.length}/12)`);

        }, 3000);
    }

    // Autonomous Background Breeding Check (rare event every 120s - fish live independent lives!)
    let autoBreedTimer = 120.0;
    function checkAutonomousBreeding(dt) {
        autoBreedTimer -= dt;
        if (autoBreedTimer <= 0) {
            autoBreedTimer = 120.0 + Math.random() * 60.0;

            if (seamen.length < 12 && tank.cleanliness > 70 && tank.oxygen > 65) {
                const healthyAdults = seamen.filter(s => !s.isDead && s.stage >= 3 && !s.isMating && s.matingCooldown <= 0 && s.hunger < 30 && s.health > 85);
                if (healthyAdults.length >= 2 && Math.random() < 0.3) {
                    triggerMatingRitual(true);
                }
            }
        }
    }

    // Spawn New Species
    document.getElementById('spawnSpeciesBtn')?.addEventListener('click', async () => {
        audio.playButtonBeep();
        if (seamen.length >= 12) {
            multiplayer.showToast("⚠️ Tank capacity full (12/12 fish)! Release Elder fish first.");
            return;
        }

        const speciesSelect = document.getElementById('speciesSelect');
        const specId = speciesSelect ? speciesSelect.value : 'angler';
        const specObj = window.FISH_SPECIES.find(s => s.id === specId) || window.FISH_SPECIES[1];

        const newFace = new FaceProcessor('seaman_face2.png');
        await newFace.init();

        const newFish = new Seaman(newFace, `${specObj.name} Mate`, 3, false, null, specId);
        seamen.push(newFish);
        selectedFish = newFish;

        updateTargetFishDropdown();
        dialogue.speak(`Added a new adult ${specObj.name} to the tank! It can now mate with your catfish!`);
        multiplayer.showToast(`➕ Added adult ${specObj.name} mate! Ready to breed (Pop: ${seamen.length}/12).`);
    });

    // Clean Tank, Remove Fish Poop (💩) & Scoop Bones
    function cleanTankAndScoopBones() {
        tank.cleanWater();
        for (let i = seamen.length - 1; i >= 0; i--) {
            if (seamen[i].isDead) {
                const deadFish = seamen[i];
                seamen.splice(i, 1);
                dialogue.speak(`Scooped and cleaned ${deadFish.name}'s remains from the tank!`);
            }
        }
        multiplayer.showToast("🧹 Tank water scrubbed & fish poop cleared!");
    }

    // 5. Game Over Check & Restart
    function checkGameOverCondition() {
        if (seamen.length > 0 && seamen.every(s => s.isDead)) {
            const gameOverModal = document.getElementById('gameOverModal');
            if (gameOverModal && gameOverModal.style.display !== 'flex') {
                gameOverModal.style.display = 'flex';
                dialogue.speak("CRITICAL FAILURE! All Catfish in your laboratory tank have perished!");
            }
        }
    }

    function restartLaboratorySimulation() {
        audio.playButtonBeep();
        document.getElementById('gameOverModal').style.display = 'none';

        tank.temperature = 21.0;
        tank.oxygen = 80;
        tank.cleanliness = 90;
        tank.poops = [];
        tank.initDirt();

        parentA = new Seaman(faceParent1, 'Catfish Alpha (Dad)', 3, false, null, 'catfish');
        parentB = new Seaman(faceParent2, 'Goldfish Beta (Mom)', 3, false, null, 'goldfish');
        seamen = [parentA, parentB];
        selectedFish = parentA;

        dialogue.speak("Catfish simulation restarted. Keep your fish fed and clean!");
        multiplayer.showToast("🔄 Laboratory tank restarted.");
    }

    document.getElementById('restartBtn')?.addEventListener('click', restartLaboratorySimulation);

    // 6. HUD Updates & Evolution Progress
    function updateSelectedFishHUD() {
        if (!selectedFish) return;

        const nameEl = document.getElementById('selectedFishName');
        const bioEl = document.getElementById('selectedFishBio');
        const stageEl = document.getElementById('selectedFishStage');
        const ageEl = document.getElementById('selectedFishAge');
        const hpEl = document.getElementById('selectedFishHp');
        const hpFill = document.getElementById('selectedFishHpFill');
        const hungerEl = document.getElementById('selectedFishHunger');
        const traitsEl = document.getElementById('selectedFishTraits');
        const releaseBtn = document.getElementById('releaseBtn');
        const growthText = document.getElementById('growthPercentText');
        const stageFill = document.getElementById('stageProgressFill');

        if (nameEl) nameEl.textContent = `${selectedFish.speciesInfo.icon} ${selectedFish.name}`;
        if (bioEl) bioEl.textContent = selectedFish.speciesInfo.realLifeInfo;
        if (stageEl) stageEl.textContent = selectedFish.stageNames[selectedFish.stage];
        if (ageEl) ageEl.textContent = `${Math.round(selectedFish.ageSeconds)}s`;
        
        if (hpEl) hpEl.textContent = selectedFish.isDead ? 'DEAD' : `${Math.max(0, Math.round(selectedFish.health))}%`;
        if (hpFill) hpFill.style.width = `${Math.max(0, selectedFish.health)}%`;

        if (hungerEl) hungerEl.textContent = `${Math.round(selectedFish.hunger)}%`;

        if (traitsEl) {
            traitsEl.innerHTML = selectedFish.traits.map(t => `<span class="trait-badge" title="${t.desc}">${t.name}</span>`).join('');
        }

        // Calculate Evolution Stage Progress %
        let progressPct = 100;
        const age = selectedFish.ageSeconds;
        if (selectedFish.stage === 0) progressPct = Math.min(100, (age / 25) * 100);
        else if (selectedFish.stage === 1) progressPct = Math.min(100, ((age - 25) / 50) * 100);
        else if (selectedFish.stage === 2) progressPct = Math.min(100, ((age - 75) / 85) * 100);
        else if (selectedFish.stage === 3) progressPct = Math.min(100, ((age - 160) / 160) * 100);
        else progressPct = 100;

        if (growthText) growthText.textContent = selectedFish.stage === 4 ? 'MAX STAGE (ELDER)' : `${Math.round(progressPct)}%`;
        if (stageFill) stageFill.style.width = `${Math.max(5, progressPct)}%`;

        if (releaseBtn) {
            releaseBtn.style.display = (selectedFish.stage === 4 && !selectedFish.isDead) ? 'block' : 'none';
        }
    }

    // Release Elder Fish Button & Score Submission
    document.getElementById('releaseBtn')?.addEventListener('click', () => {
        if (selectedFish && selectedFish.stage === 4 && !selectedFish.isDead) {
            audio.playButtonBeep();
            const idx = seamen.indexOf(selectedFish);
            if (idx !== -1) {
                const releasedName = selectedFish.name;
                seamen.splice(idx, 1);
                currentGeneration++;
                researchPoints += 1000;
                totalFishReleased++;

                dialogue.speak(`Hooray! ${releasedName} was released into the wild! Dynasty advanced to Generation ${currentGeneration}! (+1000 PTS)`);
                multiplayer.showToast(`🌿 Released ${releasedName}! Advanced to Gen ${currentGeneration} (+1000 PTS)`);

                // Auto submit score to leaderboard
                multiplayer.submitScore(researchPoints, currentGeneration, totalFishReleased);

                selectedFish = seamen[0] || null;

                if (currentGeneration >= 5) {
                    researchPoints += 2500;
                    multiplayer.submitScore(researchPoints, currentGeneration, totalFishReleased);
                    document.getElementById('victoryModal').style.display = 'flex';
                }
            }
        }
    });

    document.getElementById('victoryPlayAgainBtn')?.addEventListener('click', () => {
        multiplayer.submitScore(researchPoints, currentGeneration, totalFishReleased);
        location.reload();
    });

    function updateGauges() {
        document.getElementById('tempValue').textContent = `${tank.temperature.toFixed(1)}°C`;
        document.getElementById('o2Value').textContent = `${Math.round(tank.oxygen)}%`;
        document.getElementById('cleanValue').textContent = `${Math.round(tank.cleanliness)}%`;
        document.getElementById('populationDisplay').textContent = `${seamen.length} Fish`;
        document.getElementById('genDisplay').textContent = `Gen ${currentGeneration}`;
        document.getElementById('pointsDisplay').textContent = `${researchPoints} PTS`;
    }

    function updateFamilyTreeUI() {
        const container = document.getElementById('familyTreeList');
        if (!container) return;

        container.innerHTML = '';
        familyTree.forEach((member) => {
            const item = document.createElement('div');
            item.className = 'family-item';
            item.innerHTML = `
                <img src="${member.faceUrl}" class="family-thumb" title="Offspring Face">
                <div class="family-info">
                    <div style="font-weight: 600; color: var(--neon-cyan);">${member.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${member.parent1} & ${member.parent2}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    // 7. Pointer & Tool Controls
    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    canvas.addEventListener('mousedown', (e) => {
        audio.init();
        isMouseDown = true;
        const pos = getCanvasCoords(e);

        let hit = false;
        for (let s of seamen) {
            const dist = Math.hypot(pos.x - s.x, pos.y - s.y);
            if (dist < s.baseSize * 1.5) {
                grabbedSeaman = s;
                selectedFish = s;
                s.isGrabbed = true;
                if (!s.isDead) s.zoomFaceOnClick();
                hit = true;
                if (audio) audio.playGlassTap();
                break;
            }
        }

        if (!hit) {
            if (currentTool === 'hand') {
                tank.tapGlass(pos.x, pos.y);
                for (let s of seamen) {
                    s.targetX = pos.x;
                    s.targetY = pos.y;
                }
                dialogue.triggerEventResponse('tappedGlass');
            } else if (currentTool === 'feed') {
                tank.addFood(pos.x, pos.y, false);
            } else if (currentTool === 'love') {
                tank.addFood(pos.x, pos.y, true);
                triggerMatingRitual();
            } else if (currentTool === 'squeegee') {
                tank.scrubAt(pos.x, pos.y);
                cleanTankAndScoopBones();
            }
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        const pos = getCanvasCoords(e);
        if (grabbedSeaman) {
            grabbedSeaman.x = pos.x;
            grabbedSeaman.y = pos.y;
        } else if (currentTool === 'squeegee') {
            tank.scrubAt(pos.x, pos.y);
        }
    });

    window.addEventListener('mouseup', () => {
        isMouseDown = false;
        if (grabbedSeaman) {
            grabbedSeaman.isGrabbed = false;
            grabbedSeaman = null;
        }
    });

    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            audio.playButtonBeep();
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
        });
    });

    document.getElementById('mateBtn')?.addEventListener('click', triggerMatingRitual);

    document.getElementById('aeratorBtn')?.addEventListener('click', (e) => {
        audio.playButtonBeep();
        tank.aeratorOn = !tank.aeratorOn;
        e.target.classList.toggle('active', tank.aeratorOn);
        multiplayer.showToast(tank.aeratorOn ? '💨 Aerator Pump turned ON' : '⏸️ Aerator Pump turned OFF');
    });

    document.getElementById('heaterBtn')?.addEventListener('click', (e) => {
        audio.playButtonBeep();
        tank.heaterOn = !tank.heaterOn;
        e.target.classList.toggle('active', tank.heaterOn);
        multiplayer.showToast(tank.heaterOn ? '🔥 Water Heater turned ON' : '❄️ Water Heater turned OFF');
    });

    document.getElementById('lightBtn')?.addEventListener('click', (e) => {
        audio.playButtonBeep();
        tank.lightOn = !tank.lightOn;
        e.target.classList.toggle('active', tank.lightOn);
        multiplayer.showToast(tank.lightOn ? '💡 Tank Light turned ON' : '🌙 Tank Light turned OFF');
    });

    // Toggle Multiplayer Lobby Mode
    const toggleMpBtn = document.getElementById('toggleMultiplayerBtn');
    toggleMpBtn?.addEventListener('click', () => {
        audio.playButtonBeep();
        isMultiplayerMode = !isMultiplayerMode;
        toggleMpBtn.classList.toggle('active', isMultiplayerMode);
        toggleMpBtn.textContent = isMultiplayerMode ? '🌐 Lobby: Online' : '🌐 Lobby: Solo';
        multiplayer.showToast(isMultiplayerMode ? '🌐 Joined Online Multiplayer Tank Lobby!' : '🏠 Switched to Solo Laboratory Tank');
    });

    // 8. Player Name Entry Modal & Tutorial Modal
    const nameModal = document.getElementById('nameEntryModal');
    const nameInput = document.getElementById('aquaristNameInput');
    const saveNameBtn = document.getElementById('saveNameBtn');

    function promptPlayerName() {
        const existingName = localStorage.getItem('catfish_player_name');
        if (existingName && nameInput) nameInput.value = existingName;
        if (nameModal) nameModal.style.display = 'flex';
    }

    // Auto-prompt name at start if no name set
    if (!localStorage.getItem('catfish_player_name')) {
        promptPlayerName();
    }

    saveNameBtn?.addEventListener('click', () => {
        audio.playButtonBeep();
        const val = nameInput ? nameInput.value.trim() : '';
        if (val) {
            const handle = val.substring(0, 24);
            localStorage.setItem('catfish_player_name', handle);
            multiplayer.playerName = handle;
            const handleDisplay = document.getElementById('aquaristHandleDisplay');
            if (handleDisplay) handleDisplay.textContent = handle;
            if (nameModal) nameModal.style.display = 'none';
            multiplayer.showToast(`👋 Welcome Aquarist ${handle}!`);
            multiplayer.joinLobby();
        }
    });

    document.getElementById('changePlayerNameBtn')?.addEventListener('click', () => {
        audio.playButtonBeep();
        promptPlayerName();
    });

    const tutorialModal = document.getElementById('tutorialModal');
    const openTutorialBtn = document.getElementById('openTutorialBtn');
    const closeTutorialBtn = document.getElementById('closeTutorial');
    const startPlayingBtn = document.getElementById('startPlayingBtn');

    openTutorialBtn?.addEventListener('click', () => {
        audio.playButtonBeep();
        if (tutorialModal) tutorialModal.style.display = 'flex';
    });

    const hideTutorial = () => {
        audio.playButtonBeep();
        if (tutorialModal) tutorialModal.style.display = 'none';
    };

    closeTutorialBtn?.addEventListener('click', hideTutorial);
    startPlayingBtn?.addEventListener('click', hideTutorial);

    // Auto-open tutorial on first visit if preferred
    if (!localStorage.getItem('catfish_tutorial_seen')) {
        setTimeout(() => {
            if (tutorialModal) tutorialModal.style.display = 'flex';
            localStorage.setItem('catfish_tutorial_seen', 'true');
        }, 1000);
    }

    // 9. Face Studio & Upload Modal
    const faceModal = document.getElementById('faceModal');
    const openFaceStudioBtn = document.getElementById('openFaceStudio');
    const closeFaceStudioBtn = document.getElementById('closeFaceStudio');
    const targetFishSelect = document.getElementById('targetFishSelect');
    const customFaceUpload = document.getElementById('customFaceUpload');
    const facePreviewCanvas = document.getElementById('facePreviewCanvas');
    const previewCtx = facePreviewCanvas?.getContext('2d');

    let currentTargetFish = seamen[0];

    function updateTargetFishDropdown() {
        if (!targetFishSelect) return;
        targetFishSelect.innerHTML = '';
        seamen.forEach((s, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `${s.name}`;
            targetFishSelect.appendChild(opt);
        });
    }
    updateTargetFishDropdown();

    function syncFaceStudioControls() {
        if (!currentTargetFish) return;
        const cfg = currentTargetFish.face.config;

        document.getElementById('faceX').value = cfg.centerX * 100;
        document.getElementById('faceY').value = cfg.centerY * 100;
        document.getElementById('faceRadiusX').value = cfg.radiusX * 100;
        document.getElementById('faceRadiusY').value = cfg.radiusY * 100;
        document.getElementById('faceFeather').value = cfg.feather * 100;
        document.getElementById('faceRotation').value = (cfg.rotation || 0) * 100;

        renderFacePreview();
    }

    function renderFacePreview() {
        if (!previewCtx || !currentTargetFish) return;
        previewCtx.clearRect(0, 0, 120, 120);
        currentTargetFish.face.drawFace(previewCtx, 60, 60, 50, 0);
    }

    targetFishSelect?.addEventListener('change', (e) => {
        const idx = parseInt(e.target.value);
        if (seamen[idx]) {
            currentTargetFish = seamen[idx];
            syncFaceStudioControls();
        }
    });

    openFaceStudioBtn?.addEventListener('click', () => {
        audio.playButtonBeep();
        updateTargetFishDropdown();
        syncFaceStudioControls();
        if (faceModal) faceModal.style.display = 'flex';
    });

    closeFaceStudioBtn?.addEventListener('click', () => {
        audio.playButtonBeep();
        if (faceModal) faceModal.style.display = 'none';
    });

    customFaceUpload?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                audio.playButtonBeep();
                const imageSrc = event.target.result;
                await currentTargetFish.face.init(imageSrc);
                syncFaceStudioControls();
                dialogue.speak(`New face photo loaded for ${currentTargetFish.name}! Looking sharp!`);
            };
            reader.readAsDataURL(file);
        }
    });

    const bindSlider = (id, key, scale = 100) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                if (currentTargetFish) {
                    currentTargetFish.face.config[key] = parseFloat(e.target.value) / scale;
                    currentTargetFish.face.processFace();
                    renderFacePreview();
                }
            });
        }
    };

    bindSlider('faceX', 'centerX', 100);
    bindSlider('faceY', 'centerY', 100);
    bindSlider('faceRadiusX', 'radiusX', 100);
    bindSlider('faceRadiusY', 'radiusY', 100);
    bindSlider('faceFeather', 'feather', 100);
    bindSlider('faceRotation', 'rotation', 100);

    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const micBtn = document.getElementById('micBtn');

    function sendChatMessage() {
        if (!chatInput) return;
        const text = chatInput.value.trim();
        if (text) {
            chatInput.value = '';
            dialogue.handleUserSpeechInput(text);
            if (isMultiplayerMode && multiplayer) {
                multiplayer.sendGlobalChat(text);
            }
        }
    }

    sendBtn?.addEventListener('click', sendChatMessage);
    chatInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    micBtn?.addEventListener('click', () => { audio.playButtonBeep(); dialogue.toggleMic(); });

    document.getElementById('muteBtn')?.addEventListener('click', (e) => {
        const isMuted = audio.toggleMute();
        e.target.textContent = isMuted ? '🔇 Muted' : '🔊 Sound ON';
    });
});
