/**
 * Catfish Creature Engine
 * Real-life species needs (Catfish, Anglerfish, Goldfish, Piranha, Pufferfish),
 * Fish Poop mechanics (💩), slower balanced hunger decay, and decomposition.
 */

const FISH_SPECIES = [
    { 
        id: 'catfish', 
        name: 'Catfish', 
        colorDark: '#1b3b2b', colorMid: '#2e5c46', colorLight: '#4b8c6e', icon: '🐱',
        idealTempMin: 18, idealTempMax: 23, prefersLight: false, o2Need: 60,
        realLifeInfo: 'Bottom scavenger. Likes dim lighting & clean substrate.' 
    },
    { 
        id: 'angler', 
        name: 'Anglerfish', 
        colorDark: '#19152b', colorMid: '#2c2547', colorLight: '#483d73', icon: '💡',
        idealTempMin: 16, idealTempMax: 20, prefersLight: false, o2Need: 50,
        realLifeInfo: 'Deep-sea predator. Stressed by bright tank lighting & heat!' 
    },
    { 
        id: 'goldfish', 
        name: 'Goldfish', 
        colorDark: '#663b00', colorMid: '#b86b00', colorLight: '#f39c12', icon: '🐠',
        idealTempMin: 20, idealTempMax: 24, prefersLight: true, o2Need: 65,
        realLifeInfo: 'High waste producer! Requires bright light & frequent filtration.' 
    },
    { 
        id: 'piranha', 
        name: 'Piranha', 
        colorDark: '#5c1010', colorMid: '#9e1b1b', colorLight: '#e74c3c', icon: '🦈',
        idealTempMin: 24, idealTempMax: 28, prefersLight: true, o2Need: 60,
        realLifeInfo: 'Tropical predator. Needs warm water (24–28°C) & high protein pellets.' 
    },
    { 
        id: 'puffer', 
        name: 'Pufferfish', 
        colorDark: '#4a4413', colorMid: '#827822', colorLight: '#f1c40f', icon: '🐡',
        idealTempMin: 22, idealTempMax: 26, prefersLight: true, o2Need: 70,
        realLifeInfo: 'Sensitive to dirty water. Inflates round when tapped or scared!' 
    }
];

const GENETIC_TRAITS = [
    { id: 'voracious', name: '🍗 Voracious', desc: 'Grows 25% faster, but gets hungry quicker' },
    { id: 'thermal', name: '🔥 Thermal Tolerant', desc: 'Resistant to hot & freezing water' },
    { id: 'oxygen', name: '💨 Oxygen Adaptor', desc: 'Consumes 40% less oxygen' },
    { id: 'philosopher', name: '🧠 Philosopher', desc: 'Speaks deep quotes and boosts tank happiness' },
    { id: 'golden', name: '✨ Golden Scales', desc: 'Rare shiny scale mutation' },
    { id: 'resilient', name: '🛡️ Tough Immune System', desc: 'Recovers health 2x faster in clean water' }
];

class Seaman {
    constructor(faceProcessor, name = 'Catfish Alpha', stage = 3, isBaby = false, traits = null, speciesId = 'catfish') {
        this.id = 'catfish_' + Math.random().toString(36).substring(2, 9);
        this.face = faceProcessor;
        this.name = name;
        this.isBaby = isBaby;
        this.speciesId = speciesId;
        this.speciesInfo = FISH_SPECIES.find(s => s.id === speciesId) || FISH_SPECIES[0];

        // Position & Physics - Realistic Fish Burst & Glide Kinetics
        this.x = 200 + Math.random() * 400;
        this.y = 200 + Math.random() * 200;
        this.vx = 0;
        this.vy = 0;
        this.targetX = this.x;
        this.targetY = this.y;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = isBaby ? 2.5 : 2.0;
        this.rotationSpeed = 0.09;

        // Fish Burst-and-Glide Mechanics
        this.burstTimer = Math.random() * 2;
        this.burstPower = 0;

        // Health & Decomposition
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.decayTimer = 0;
        this.decayStage = 0; // 0: Alive, 1: Fresh Dead, 2: Rotting, 3: Fish Skeleton / Bones

        // Fish Digestion & Poop Timer
        this.digestionTimer = 0;

        // Traits & Lifecycle
        this.traits = traits || this.generateRandomTraits();
        this.ageSeconds = isBaby ? 0 : 180;
        this.stage = stage;
        this.stageNames = ['Egg Sac', 'Larva Fry', 'Tadpole', 'Adult Catfish', 'Elder Frog-Fish'];
        this.baseSize = isBaby ? 20 : 42;

        this.headScaleAnim = 1.0;
        this.headScaleTarget = 1.0;
        this.isPufferInflated = false;

        // Swim orientation & realistic kinetics
        this.facingLeft = Math.random() < 0.5;
        this.pitchAngle = 0;

        // Spine joints
        this.numJoints = isBaby ? 6 : 8;
        this.joints = Array(this.numJoints).fill(0).map(() => ({ x: 0, y: 0, angle: 0 }));

        this.tailPhase = Math.random() * Math.PI * 2;
        this.finPhase = Math.random() * Math.PI * 2;
        this.blinkTimer = Math.random() * 3;
        this.blinkAmount = 0;
        this.talkAmount = 0;
        this.talkTarget = 0;
        this.expression = 'neutral';

        // REALISTIC SLOWER HUNGER RATE (starts at 15%, decays ~0.15% per sec = 11 mins!)
        this.hunger = 15;
        this.happiness = 85;

        this.isMating = false;
        this.matingPartner = null;
        this.matingTimer = 0;
        this.matingCooldown = 0;

        this.isGrabbed = false;
        this.stateTimer = 0;
    }

    generateRandomTraits() {
        const count = 1 + Math.floor(Math.random() * 2);
        const shuffled = [...GENETIC_TRAITS].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    static inheritTraits(parentA, parentB) {
        const combined = [...parentA.traits, ...parentB.traits];
        const uniqueMap = new Map();
        combined.forEach(t => uniqueMap.set(t.id, t));
        
        let inherited = Array.from(uniqueMap.values()).filter(() => Math.random() < 0.6);
        if (inherited.length === 0) inherited.push(combined[0] || GENETIC_TRAITS[0]);

        if (Math.random() < 0.15 && !inherited.some(t => t.id === 'golden')) {
            inherited.push(GENETIC_TRAITS.find(t => t.id === 'golden'));
        }

        return inherited;
    }

    hasTrait(traitId) {
        return this.traits.some(t => t.id === traitId);
    }

    update(dt, tank) {
        if (this.isDead) {
            this.updateDecomposition(dt, tank);
            return;
        }

        this.ageSeconds += dt;
        if (this.matingCooldown > 0) this.matingCooldown -= dt;
        this.updateDigestionAndPoop(dt, tank);
        this.updateLifecycleAndGrowth(dt);
        this.updateHealthAndSurvival(dt, tank);
        this.updateAnimationTimers(dt);

        if (this.isGrabbed) {
            this.vx *= 0.5;
            this.vy *= 0.5;
            this.headScaleTarget = 2.4;
            this.updateSpine();
            return;
        }

        if (this.isMating && this.matingPartner) {
            this.updateMatingDance(dt, tank);
            this.updateSpine();
            return;
        }

        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.chooseNewBehavior(tank);
        }

        if (this.stage === 0) {
            this.vx *= 0.8;
            this.vy *= 0.8;
        } else {
            this.steerTowardsTarget(dt);
        }

        this.x += this.vx;
        this.y += this.vy;

        const margin = 60;
        if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx) * 0.4; this.targetX = margin + 120; this.facingLeft = false; }
        if (this.x > tank.width - margin) { this.x = tank.width - margin; this.vx = -Math.abs(this.vx) * 0.4; this.targetX = tank.width - margin - 120; this.facingLeft = true; }
        if (this.y < margin + 40) { this.y = margin + 40; this.vy = Math.abs(this.vy) * 0.4; this.targetY = margin + 120; }
        if (this.y > tank.height - margin - 20) { this.y = tank.height - margin - 20; this.vy = -Math.abs(this.vy) * 0.4; this.targetY = tank.height - margin - 120; }

        this.updateSpine();
        this.checkEatFood(tank);
    }

    updateDigestionAndPoop(dt, tank) {
        // Poop Timer after eating food
        if (this.digestionTimer > 0) {
            this.digestionTimer -= dt;
            if (this.digestionTimer <= 0) {
                // Emit Fish Poop particle! Goldfish poop 2x!
                tank.addPoop(this.x, this.y);
                if (this.speciesId === 'goldfish') {
                    setTimeout(() => tank.addPoop(this.x + 10, this.y), 1000);
                }
            }
        }
    }

    updateLifecycleAndGrowth(dt) {
        const growthMult = this.hasTrait('voracious') ? 1.3 : 1.0;
        const effectiveAge = this.ageSeconds * growthMult;
        const prevStage = this.stage;

        if (effectiveAge < 25) {
            this.stage = 0; // Egg Sac
            this.baseSize = 20;
        } else if (effectiveAge < 75) {
            this.stage = 1; // Larva Fry
            this.baseSize = 26 + (effectiveAge - 25) * 0.15;
        } else if (effectiveAge < 160) {
            this.stage = 2; // Tadpole
            this.baseSize = 34 + (effectiveAge - 75) * 0.1;
        } else if (effectiveAge < 320) {
            this.stage = 3; // Adult Catfish
            this.baseSize = 42 + (effectiveAge - 160) * 0.05;
        } else {
            this.stage = 4; // Elder Frog-Fish
            this.baseSize = 50;
        }

        // Trigger evolution reward event when fish progresses to next life stage
        if (this.stage > prevStage && prevStage >= 0) {
            const stageNames = ['Egg Sac', 'Larva Fry', 'Tadpole', 'Adult Catfish', 'Elder Frog-Fish'];
            if (window.onFishEvolved) {
                window.onFishEvolved(this, stageNames[this.stage]);
            }
        }
    }

    /**
     * Real-Life Species Needs Evaluation & Balanced Health System
     */
    updateHealthAndSurvival(dt, tank) {
        // SLOWER, BALANCED HUNGER DRAIN (0.12% per second = ~14 mins to starve!)
        const hungerRate = this.hasTrait('voracious') ? 0.22 : 0.12;
        this.hunger = Math.min(100, this.hunger + dt * hungerRate);

        let damageReason = null;

        const spec = this.speciesInfo;
        const temp = tank.temperature;
        const isThermalProtected = this.hasTrait('thermal');

        // Species Real-Life Temperature Range Checks
        if ((temp < spec.idealTempMin - 4 || temp > spec.idealTempMax + 4) && !isThermalProtected) {
            this.health -= dt * 2.5;
            this.expression = temp < spec.idealTempMin ? 'shivering' : 'overheating';
            damageReason = `temperature out of ${spec.name} range (${spec.idealTempMin}–${spec.idealTempMax}°C)`;
        }

        // Species Real-Life Lighting Stress (Anglerfish & Catfish dislike bright lights!)
        if (!spec.prefersLight && tank.lightOn && Math.random() < 0.05) {
            this.happiness = Math.max(0, this.happiness - dt * 2);
            if (this.speciesId === 'angler') this.expression = 'annoyed';
        }

        // Oxygen Needs
        const o2NeedThreshold = this.hasTrait('oxygen') ? spec.o2Need - 25 : spec.o2Need - 15;
        if (tank.oxygen < o2NeedThreshold) {
            this.health -= dt * 3.5;
            this.expression = 'annoyed';
            damageReason = 'suffocation (low O2)';
        }

        // Water Purity Hazard
        if (tank.cleanliness < 35) {
            this.health -= dt * 2.0;
            damageReason = 'dirty water & ammonia buildup';
        }

        // Starvation Hazard (only when hunger is at max 95%+)
        if (this.hunger >= 95) {
            this.health -= dt * 2.5;
            this.expression = 'annoyed';
            damageReason = 'starvation';
        }

        // Recovery in optimal conditions
        if (!damageReason && temp >= spec.idealTempMin && temp <= spec.idealTempMax && tank.oxygen >= spec.o2Need && tank.cleanliness > 60 && this.hunger < 60) {
            const healSpeed = this.hasTrait('resilient') ? 2.5 : 1.2;
            this.health = Math.min(this.maxHealth, this.health + dt * healSpeed);
            this.expression = 'happy';
        }

        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            this.decayStage = 1;
            this.expression = 'annoyed';
            if (window.gameAudio) window.gameAudio.playGlassTap();
            console.warn(`${this.name} died due to ${damageReason || 'neglect'}!`);
        }
    }

    updateDecomposition(dt, tank) {
        this.decayTimer += dt;

        if (this.decayTimer < 15) {
            this.decayStage = 1; // Fresh Dead
            this.vy = -1.2;
            this.y += this.vy;
            if (this.y < 75) { this.y = 75; this.vy = 0; }
            this.angle = Math.PI;
        } else if (this.decayTimer < 35) {
            this.decayStage = 2; // Rotting Corpse
            this.vy = 0.5;
            this.y += this.vy;
            const seabedY = tank.height - 70;
            if (this.y > seabedY) { this.y = seabedY; this.vy = 0; }
            tank.cleanliness = Math.max(0, tank.cleanliness - dt * 0.4);
            this.angle = Math.PI * 0.8;
        } else {
            this.decayStage = 3; // Fish Skeleton / Bones
            this.y = tank.height - 65;
            this.vy = 0;
            this.angle = 0;
        }

        this.updateSpine();
    }

    updateAnimationTimers(dt) {
        const currentSpeed = Math.hypot(this.vx, this.vy);
        this.tailPhase += dt * (3 + currentSpeed * 2.5);
        this.finPhase += dt * 5;

        this.headScaleAnim += (this.headScaleTarget - this.headScaleAnim) * (dt * 12);
        if (!this.isGrabbed && this.headScaleTarget > 1.0) {
            this.headScaleTarget -= dt * 0.8;
            if (this.headScaleTarget < 1.0) this.headScaleTarget = 1.0;
        }

        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) {
            this.blinkTimer = 2.5 + Math.random() * 4.5;
            this.blinkAmount = 1.0;
        }
        if (this.blinkAmount > 0) {
            this.blinkAmount -= dt * 4;
            if (this.blinkAmount < 0) this.blinkAmount = 0;
        }

        this.talkAmount += (this.talkTarget - this.talkAmount) * (dt * 15);
    }

    zoomFaceOnClick() {
        this.headScaleTarget = 2.5;
        this.expression = 'surprised';
        this.triggerSpeechMouth(1.2);

        // Pufferfish inflates when tapped/clicked!
        if (this.speciesId === 'puffer') {
            this.headScaleTarget = 3.0;
            this.isPufferInflated = true;
            setTimeout(() => { this.isPufferInflated = false; }, 3000);
        }
    }

    startMatingWith(partner) {
        this.isMating = true;
        this.matingPartner = partner;
        this.matingTimer = 3.0;
        this.matingCooldown = 120.0; // 120s cooldown so fish live independent lives!
        this.expression = 'happy';
        this.headScaleTarget = 1.3;
    }

    updateMatingDance(dt, tank) {
        this.matingTimer -= dt;
        const centerX = tank.width * 0.5;
        const centerY = tank.height * 0.45;
        const radius = 50;
        const danceAngle = (Date.now() * 0.003) + (this.id.charCodeAt(0) % 2 === 0 ? 0 : Math.PI);

        this.targetX = centerX + Math.cos(danceAngle) * radius;
        this.targetY = centerY + Math.sin(danceAngle) * radius * 0.5;

        this.steerTowardsTarget(dt);
        this.x += this.vx;
        this.y += this.vy;

        if (Math.random() < 0.3) {
            tank.addHeartParticle(this.x, this.y);
        }

        if (this.matingTimer <= 0) {
            this.isMating = false;
            this.matingPartner = null;
            this.headScaleTarget = 1.0;
            this.chooseNewBehavior(tank);
        }
    }

    chooseNewBehavior(tank) {
        this.stateTimer = 3.0 + Math.random() * 5.0;

        // Food foraging takes priority when pellets are dropped
        if (tank.foods.length > 0) {
            let closest = tank.foods[0];
            let minDist = Math.hypot(this.x - closest.x, this.y - closest.y);
            for (let f of tank.foods) {
                const d = Math.hypot(this.x - f.x, this.y - f.y);
                if (d < minDist) { minDist = d; closest = f; }
            }
            this.targetX = closest.x;
            this.targetY = closest.y;
            return;
        }

        // Independent behavior routines
        const behaviorRoll = Math.random();

        // 1. Curiosity: Inspect bubbles if aerator is on
        if (behaviorRoll < 0.25 && tank.aeratorOn && tank.bubbles.length > 0) {
            this.targetX = 80 + (Math.random() - 0.5) * 60;
            this.targetY = tank.height - 100 - Math.random() * 200;
            return;
        }

        // 2. Species-Specific Independent Depth & Wandering Preferences
        const swayOffset = (Math.random() - 0.5) * 120;
        if (this.speciesId === 'catfish') {
            // Bottom scavenger: roams substrate gravel independently
            this.targetX = 70 + Math.random() * (tank.width - 140);
            this.targetY = tank.height - 150 + Math.random() * 80;
        } else if (this.speciesId === 'angler') {
            // Deep-sea predator: prefers dim lower-middle depths
            this.targetX = 90 + Math.random() * (tank.width - 180);
            this.targetY = tank.height * 0.45 + Math.random() * (tank.height * 0.35);
        } else if (this.speciesId === 'goldfish') {
            // Goldfish: playful upper-middle water loops
            this.targetX = 80 + Math.random() * (tank.width - 160);
            this.targetY = 80 + Math.random() * (tank.height * 0.5);
        } else if (this.speciesId === 'piranha') {
            // Piranha: active mid-depth patrols
            this.targetX = 100 + Math.random() * (tank.width - 200);
            this.targetY = 120 + Math.random() * (tank.height - 240);
        } else {
            // Pufferfish & others: gentle floating
            this.targetX = 100 + Math.random() * (tank.width - 200);
            this.targetY = 100 + Math.random() * (tank.height - 200);
        }
    }

    steerTowardsTarget(dt) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        // Update facing direction based on horizontal movement target
        if (Math.abs(dx) > 10) {
            this.facingLeft = (dx < 0);
        }

        // Pitch angle based on vertical slope
        const targetPitch = Math.max(-0.45, Math.min(0.45, Math.atan2(dy, Math.abs(dx) + 1)));
        this.pitchAngle += (targetPitch - this.pitchAngle) * Math.min(1.0, dt * 5);

        // Burst thrust logic
        this.burstTimer -= dt;
        if (this.burstTimer <= 0 && dist > 15) {
            this.burstTimer = 1.2 + Math.random() * 2.2;
            this.burstPower = 1.0;
        }

        if (dist > 10) {
            const speedMult = this.speed * (this.burstPower > 0 ? 1.6 : 0.7);
            const dirX = dx / dist;
            const dirY = dy / dist;

            this.vx += dirX * speedMult * dt * 5;
            this.vy += dirY * speedMult * dt * 5;

            if (this.burstPower > 0) {
                this.burstPower -= dt * 2.5;
                if (this.burstPower < 0) this.burstPower = 0;
            }
        }

        // Align facing left/right smoothly with actual velocity
        if (this.vx < -0.3) this.facingLeft = true;
        if (this.vx > 0.3) this.facingLeft = false;

        // Hydrodynamic drag (smooth gliding)
        this.vx *= 0.94;
        this.vy *= 0.94;

        // Gentle buoyancy floating sway
        this.vy += Math.sin(Date.now() * 0.002 + this.finPhase) * 0.03;
    }

    updateSpine() {
        const currentSpeed = Math.hypot(this.vx, this.vy);
        const wiggleAmp = 0.15 + Math.min(0.35, currentSpeed * 0.15);
        const segmentDist = this.baseSize * 0.38;

        this.joints[0].x = 0;
        this.joints[0].y = 0;

        for (let i = 1; i < this.numJoints; i++) {
            const wave = Math.sin(this.tailPhase - i * 0.5) * wiggleAmp * (i / this.numJoints) * segmentDist * 1.5;
            this.joints[i].x = -i * segmentDist;
            this.joints[i].y = wave;
        }
    }

    checkEatFood(tank) {
        for (let i = tank.foods.length - 1; i >= 0; i--) {
            const food = tank.foods[i];
            const dist = Math.hypot(this.x - food.x, this.y - food.y);
            if (dist < this.baseSize * 0.9) {
                tank.foods.splice(i, 1);
                this.hunger = Math.max(0, this.hunger - 40);
                this.happiness = Math.min(100, this.happiness + 20);
                this.health = Math.min(this.maxHealth, this.health + 10);
                this.headScaleTarget = 1.6;
                this.triggerSpeechMouth(0.6);
                
                // Trigger Poop digestion timer (poops in 5 seconds!)
                this.digestionTimer = 5.0;

                if (window.onFishFedPoints) window.onFishFedPoints(this);
                if (window.gameAudio) window.gameAudio.playChomp();
                break;
            }
        }
    }

    triggerSpeechMouth(duration = 1.0) {
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 0.1;
            this.talkTarget = Math.abs(Math.sin(elapsed * 18));
            if (elapsed >= duration) {
                clearInterval(interval);
                this.talkTarget = 0;
            }
        }, 100);
    }

    draw(ctx) {
        ctx.save();

        if (this.decayStage === 3) {
            this.drawFishSkeleton(ctx);
            ctx.restore();
            return;
        }

        if (this.stage === 0) {
            this.drawEggStage(ctx);
            ctx.restore();
            return;
        }

        // Local coordinate frame centered at fish head (x, y)
        ctx.translate(this.x, this.y);
        ctx.scale(this.facingLeft ? -1 : 1, 1);
        ctx.rotate(this.pitchAngle);

        this.drawFishBody(ctx);
        this.drawSpeciesFeatures(ctx);

        const headRadius = this.baseSize * (this.stage === 1 ? 0.75 : this.stage === 2 ? 0.88 : 1.0) * this.headScaleAnim;
        
        // Face is rendered centered at local origin (0, 0), right-side up!
        this.face.drawFace(
            ctx, 0, 0, headRadius, 0,
            { 
                talkAmount: this.talkAmount, 
                blinkAmount: this.blinkAmount, 
                expression: this.expression,
                isBaby: (this.isBaby || this.stage <= 2)
            }
        );

        ctx.restore();

        // Draw health bar overlay in world coordinates so text is never inverted
        this.drawHealthBarOverlay(ctx, headRadius);
    }

    drawFishSkeleton(ctx) {
        const x = this.x;
        const y = this.y;
        const r = 22;

        ctx.save();
        ctx.strokeStyle = '#d0d7de';
        ctx.fillStyle = '#e1e7ec';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#1c242b';
        ctx.beginPath();
        ctx.arc(x - 5, y - 3, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + r + 60, y);
        ctx.stroke();

        for (let i = 0; i < 6; i++) {
            const rx = x + r + 10 + i * 9;
            ctx.beginPath();
            ctx.moveTo(rx, y - 14);
            ctx.lineTo(rx, y + 14);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(x + r + 60, y);
        ctx.lineTo(x + r + 75, y - 12);
        ctx.lineTo(x + r + 75, y + 12);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#e74c3c';
        ctx.font = "10px 'Share Tech Mono'";
        ctx.textAlign = 'center';
        ctx.fillText(`🦴 ${this.name} Bones`, x + 30, y - 22);

        ctx.restore();
    }

    drawSpeciesFeatures(ctx) {
        const r = this.baseSize * this.headScaleAnim;

        ctx.save();

        if (this.speciesId === 'catfish' || this.stage >= 3) {
            ctx.strokeStyle = this.decayStage > 0 ? '#7f8c8d' : '#2d4536';
            ctx.lineWidth = 2.5;
            const wave = Math.sin(this.finPhase * 1.5) * 4;

            // Upper Whisker (pointing forward local +X)
            ctx.beginPath();
            ctx.moveTo(r * 0.3, -r * 0.3);
            ctx.bezierCurveTo(r * 0.9, -r * 0.6 + wave, r * 1.5, -r * 0.8, r * 2.0, -r * 1.0 + wave);
            ctx.stroke();

            // Lower Whisker
            ctx.beginPath();
            ctx.moveTo(r * 0.3, r * 0.3);
            ctx.bezierCurveTo(r * 0.9, r * 0.6 - wave, r * 1.5, r * 0.8, r * 2.0, r * 1.0 - wave);
            ctx.stroke();
        }

        if (this.speciesId === 'angler') {
            ctx.strokeStyle = '#483d73';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.8);
            ctx.quadraticCurveTo(r * 0.3, -r * 1.8, r * 0.8, -r * 1.6);
            ctx.stroke();

            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(r * 0.8, -r * 1.6, 7, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.speciesId === 'piranha') {
            ctx.fillStyle = '#ffffff';
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(r * 0.4 + i * 4, r * 0.3);
                ctx.lineTo(r * 0.4 + i * 4 - 2, r * 0.5);
                ctx.lineTo(r * 0.4 + i * 4 + 2, r * 0.5);
                ctx.closePath();
                ctx.fill();
            }
        }

        if (this.speciesId === 'puffer' && this.isPufferInflated) {
            // Puffer Spikes
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 2;
            for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
                const sx = Math.cos(angle) * r * 1.2;
                const sy = Math.sin(angle) * r * 1.2;
                const ex = Math.cos(angle) * r * 1.5;
                const ey = Math.sin(angle) * r * 1.5;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    drawHealthBarOverlay(ctx, headRadius) {
        let topY = this.y - headRadius - 18;

        // Render Action Status Pill Badge over head
        if (!this.isDead) {
            let badgeText = '';
            let badgeBg = '';
            let badgeBorder = '';

            if (this.stage === 4) {
                badgeText = '🏆 READY TO RELEASE (+1000 PTS)';
                badgeBg = 'rgba(46, 204, 113, 0.9)';
                badgeBorder = '#2ecc71';
            } else if (this.hunger > 60) {
                badgeText = '🍖 HUNGRY! (Drop Feed Pellets)';
                badgeBg = 'rgba(230, 126, 34, 0.9)';
                badgeBorder = '#e67e22';
            } else if (this.stage === 3) {
                badgeText = '💖 READY TO MATE';
                badgeBg = 'rgba(232, 67, 147, 0.9)';
                badgeBorder = '#e84393';
            }

            if (badgeText) {
                ctx.save();
                ctx.font = "bold 10px 'Share Tech Mono', sans-serif";
                const txtW = ctx.measureText(badgeText).width + 12;
                const badgeX = this.x - txtW / 2;
                const badgeY = topY - 18;

                ctx.fillStyle = badgeBg;
                ctx.strokeStyle = badgeBorder;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, txtW, 16, 3);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.fillText(badgeText, this.x, badgeY + 12);
                ctx.restore();

                topY -= 18; // Offset name label down
            }
        }

        let statusTxt = `${this.speciesInfo.icon} ${this.name} (${Math.round(this.ageSeconds)}s)`;
        if (this.decayStage === 1) statusTxt = `💀 ${this.name} (FRESH DEAD)`;
        if (this.decayStage === 2) statusTxt = `☣️ ${this.name} (ROTTING CORPSE)`;

        ctx.fillStyle = this.isDead ? '#e74c3c' : 'rgba(78, 205, 196, 0.95)';
        ctx.font = `${this.isBaby ? '10px' : '11px'} 'Share Tech Mono'`;
        ctx.textAlign = 'center';
        ctx.fillText(statusTxt, this.x, topY);

        if (!this.isDead) {
            const barW = 36;
            const barH = 4;
            const barX = this.x - barW / 2;
            const barY = topY + 4;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(barX, barY, barW, barH);

            const hpRatio = this.health / this.maxHealth;
            ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
        }
    }

    drawEggStage(ctx) {
        const x = this.x;
        const y = this.y;
        
        const pulse = 1 + Math.sin(this.tailPhase * 0.8) * 0.05;
        const radius = (this.isBaby ? 22 : 30) * pulse * this.headScaleAnim;

        ctx.save();
        // Translucent glowing egg yolk / embryonic membrane
        const grad = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.2, radius * 0.1, x, y, radius);
        grad.addColorStop(0, 'rgba(255, 230, 150, 0.95)');
        grad.addColorStop(0.5, 'rgba(243, 156, 18, 0.85)');
        grad.addColorStop(0.85, 'rgba(211, 84, 0, 0.7)');
        grad.addColorStop(1, 'rgba(211, 84, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Membrane border glow
        ctx.strokeStyle = 'rgba(243, 156, 18, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cute baby face inside egg
        this.face.drawFace(ctx, x, y, radius * 0.65, 0, { blinkAmount: 0.3, isBaby: true });
        ctx.restore();
    }

    drawFishBody(ctx) {
        const headR = this.baseSize * Math.min(1.3, this.headScaleAnim);
        const j = this.joints;

        const isGolden = this.hasTrait('golden');
        let bodyColorDark = isGolden ? '#5c4500' : this.speciesInfo.colorDark;
        let bodyColorMid = isGolden ? '#b88a00' : this.speciesInfo.colorMid;
        let bodyColorLight = isGolden ? '#f39c12' : this.speciesInfo.colorLight;
        let finColor = isGolden ? 'rgba(243, 156, 18, 0.75)' : 'rgba(78, 205, 196, 0.65)';
        let finLineColor = isGolden ? '#f39c12' : 'rgba(78, 205, 196, 0.9)';

        if (this.decayStage === 1) {
            bodyColorDark = '#2c3e50'; bodyColorMid = '#7f8c8d'; bodyColorLight = '#bdc3c7';
        } else if (this.decayStage === 2) {
            bodyColorDark = '#1a2918'; bodyColorMid = '#3b5437'; bodyColorLight = '#6b8e66';
        }

        const bodyLen = Math.abs(j[this.numJoints - 1].x);
        const tailFlexY = j[this.numJoints - 1].y;
        const finSway = Math.sin(this.finPhase) * 0.35;

        // 1. Sleek Continuous Fish Silhouette Path (No more worm circles!)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, -headR * 0.85);
        
        // Dorsal ridge curve to tail peduncle
        ctx.bezierCurveTo(
            -bodyLen * 0.3, -headR * 1.15,
            -bodyLen * 0.75, -headR * 0.4 + tailFlexY,
            -bodyLen, tailFlexY - headR * 0.15
        );

        // Tail stem tip
        ctx.lineTo(-bodyLen, tailFlexY + headR * 0.15);

        // Ventral (belly) ridge curve back to bottom of head
        ctx.bezierCurveTo(
            -bodyLen * 0.75, headR * 0.5 + tailFlexY,
            -bodyLen * 0.3, headR * 1.1,
            0, headR * 0.85
        );

        // Close front head curve
        ctx.arc(0, 0, headR * 0.85, Math.PI * 0.5, -Math.PI * 0.5, true);
        ctx.closePath();

        // Rich 3D aquatic counter-shading gradient (Dark top, vibrant mid-flank, light belly)
        const bodyGrad = ctx.createLinearGradient(0, -headR, 0, headR);
        bodyGrad.addColorStop(0, bodyColorDark);
        bodyGrad.addColorStop(0.4, bodyColorMid);
        bodyGrad.addColorStop(0.85, bodyColorLight);
        bodyGrad.addColorStop(1, '#ffffff');

        ctx.fillStyle = bodyGrad;
        ctx.fill();

        ctx.strokeStyle = bodyColorDark;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 2. Elegant Dorsal Fin on top ridge
        ctx.fillStyle = finColor;
        ctx.strokeStyle = finLineColor;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(-bodyLen * 0.25, -headR * 0.95);
        ctx.quadraticCurveTo(-bodyLen * 0.45, -headR * 1.8 + finSway * 8, -bodyLen * 0.65, -headR * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Dorsal fin rays
        for (let r = 1; r <= 3; r++) {
            ctx.beginPath();
            ctx.moveTo(-bodyLen * (0.25 + r * 0.1), -headR * 0.9);
            ctx.lineTo(-bodyLen * (0.3 + r * 0.08), -headR * (1.1 + r * 0.15));
            ctx.stroke();
        }

        // 3. Ventral / Anal Fin on lower belly
        ctx.beginPath();
        ctx.moveTo(-bodyLen * 0.45, headR * 0.6);
        ctx.quadraticCurveTo(-bodyLen * 0.65, headR * 1.3 - finSway * 6, -bodyLen * 0.75, headR * 0.3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 4. Authentic Caudal (Tail) Fin at tail peduncle
        const tailX = -bodyLen;
        const tailY = tailFlexY;
        const tailWave = Math.sin(this.tailPhase) * 0.3;

        ctx.beginPath();
        ctx.moveTo(tailX, tailY - 4);
        // Upper lobe
        ctx.bezierCurveTo(
            tailX - headR * 0.9, tailY - headR * 1.3 + tailWave * 12,
            tailX - headR * 1.6, tailY - headR * 1.1 + tailWave * 15,
            tailX - headR * 1.5, tailY + tailWave * 10
        );
        // Lower lobe
        ctx.bezierCurveTo(
            tailX - headR * 1.6, tailY + headR * 1.1 + tailWave * 15,
            tailX - headR * 0.9, tailY + headR * 1.3 + tailWave * 12,
            tailX, tailY + 4
        );
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Caudal fin rays
        for (let ray = -3; ray <= 3; ray++) {
            ctx.beginPath();
            ctx.moveTo(tailX, tailY + ray * 2);
            ctx.lineTo(tailX - headR * 1.4, tailY + ray * (headR * 0.22) + tailWave * 12);
            ctx.stroke();
        }

        // 5. Pectoral Fins at chest
        ctx.beginPath();
        ctx.ellipse(-headR * 0.3, headR * 0.4, headR * 0.5, headR * 0.2, 0.5 + finSway, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // 6. Subtle Iridescent Scale Highlights along body flank
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        for (let row = 0; row < 3; row++) {
            for (let col = 1; col <= 4; col++) {
                const sx = -bodyLen * (col * 0.18);
                const sy = -headR * 0.2 + row * (headR * 0.3);
                ctx.beginPath();
                ctx.arc(sx, sy, 4, 0.2, Math.PI * 0.9);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}

window.Seaman = Seaman;
window.FISH_SPECIES = FISH_SPECIES;
