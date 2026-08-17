/**
 * Tank Environment Engine
 * Supports real-life fish poop particles (💩), gradual cleanliness decay,
 * aerator bubbles, food pellets, heart particles, and glass ripples.
 */

class Tank {
    constructor(width = 800, height = 600) {
        this.width = width;
        this.height = height;

        this.temperature = 21.0;
        this.oxygen = 75;
        this.cleanliness = 90;
        this.lightOn = true;
        this.aeratorOn = true;
        this.heaterOn = false;

        this.bubbles = [];
        this.foods = [];
        this.poops = []; // Real-life fish poop particles!
        this.ripples = [];
        this.heartParticles = [];
        this.dirtParticles = [];

        this.initDirt();
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
    }

    initDirt() {
        this.dirtParticles = [];
        for (let i = 0; i < 25; i++) {
            this.dirtParticles.push({
                x: Math.random() * this.width,
                y: 60 + Math.random() * (this.height - 120),
                size: 2 + Math.random() * 5
            });
        }
    }

    addPoop(x, y) {
        this.poops.push({
            x: x,
            y: y,
            vy: 0.8 + Math.random() * 0.4,
            size: 12 + Math.random() * 6,
            decayTimer: 0
        });
    }

    addHeartParticle(x, y) {
        this.heartParticles.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y + (Math.random() - 0.5) * 30,
            vy: -1.2 - Math.random() * 1.5,
            size: 14 + Math.random() * 10,
            alpha: 1.0
        });
    }

    update(dt) {
        // Temperature Drift
        if (this.heaterOn) {
            this.temperature += dt * 0.8;
        } else if (this.temperature > 16) {
            this.temperature -= dt * 0.12;
        }
        this.temperature = Math.max(10, Math.min(38, this.temperature));

        // Oxygen levels
        if (this.aeratorOn) {
            this.oxygen = Math.min(100, this.oxygen + dt * 2.0);
            this.spawnBubbles(dt);
        } else {
            this.oxygen = Math.max(0, this.oxygen - dt * 0.6);
        }

        // Gradual Cleanliness decay from time and fish poop!
        const seabedY = this.height - 65;
        let poopPollution = 0;

        for (let i = this.poops.length - 1; i >= 0; i--) {
            const p = this.poops[i];
            p.decayTimer += dt;
            p.y += p.vy * (dt * 60);

            // Sink to seabed gravel
            if (p.y > seabedY) {
                p.y = seabedY;
                p.vy = 0;
            }

            // Poop slowly pollutes water over time
            poopPollution += 0.08;
        }

        // Natural gradual water dirtiness over time
        this.cleanliness = Math.max(0, this.cleanliness - dt * (0.04 + poopPollution * 0.1));

        // Bubbles
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.y -= b.speed * (dt * 60);
            b.x += Math.sin(b.y * 0.05) * 0.5;
            b.alpha -= dt * 0.1;
            if (b.y < 50 || b.alpha <= 0) this.bubbles.splice(i, 1);
        }

        // Heart Particles
        for (let i = this.heartParticles.length - 1; i >= 0; i--) {
            const hp = this.heartParticles[i];
            hp.y += hp.vy * (dt * 60);
            hp.alpha -= dt * 0.5;
            if (hp.alpha <= 0) this.heartParticles.splice(i, 1);
        }

        // Food Pellets
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const f = this.foods[i];
            f.vy += 0.08 * (dt * 60);
            f.vy *= 0.92;
            f.y += f.vy;
            if (f.y > seabedY) { f.y = seabedY; f.vy = 0; }
        }

        // Glass Ripples
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += r.expandSpeed * (dt * 60);
            r.alpha -= dt * 1.5;
            if (r.alpha <= 0) this.ripples.splice(i, 1);
        }
    }

    spawnBubbles(dt) {
        if (Math.random() < 0.6) {
            this.bubbles.push({
                x: 80 + (Math.random() - 0.5) * 20,
                y: this.height - 80,
                size: 2 + Math.random() * 6,
                speed: 1.5 + Math.random() * 2.5,
                alpha: 0.8
            });
        }
    }

    addFood(x, y, isAphrodisiac = false) {
        this.foods.push({ x, y, vy: 1.5, size: isAphrodisiac ? 9 : 6, isAphrodisiac });
        if (window.gameAudio) window.gameAudio.playSplash();
    }

    tapGlass(x, y) {
        this.ripples.push({ x, y, radius: 5, expandSpeed: 4, alpha: 1.0 });
        if (window.gameAudio) window.gameAudio.playGlassTap();
    }

    cleanWater() {
        this.cleanliness = 100;
        this.poops = []; // Clear all fish poop!
        this.initDirt();
    }

    scrubAt(x, y) {
        // Scrubbing restores cleanliness and clears nearby poop
        this.cleanliness = Math.min(100, this.cleanliness + 8);

        // Clear poop near squeegee cursor
        for (let i = this.poops.length - 1; i >= 0; i--) {
            const dist = Math.hypot(x - this.poops[i].x, y - this.poops[i].y);
            if (dist < 45) {
                this.poops.splice(i, 1);
            }
        }

        // Spawn cleaning sparkles
        if (Math.random() < 0.6) {
            this.ripples.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                radius: 4,
                expandSpeed: 3,
                alpha: 0.9
            });
        }
    }

    drawBackground(ctx) {
        const w = this.width;
        const h = this.height;

        const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
        if (this.lightOn) {
            waterGrad.addColorStop(0, '#0a2e38');
            waterGrad.addColorStop(0.5, '#071f28');
            waterGrad.addColorStop(1, '#030c12');
        } else {
            waterGrad.addColorStop(0, '#041117');
            waterGrad.addColorStop(1, '#010406');
        }

        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, 0, w, h);

        // Water Murkiness overlay when cleanliness drops
        if (this.cleanliness < 80) {
            const murkRatio = (80 - this.cleanliness) / 80;
            ctx.fillStyle = `rgba(35, 55, 20, ${murkRatio * 0.55})`;
            ctx.fillRect(0, 0, w, h);
        }

        // Light Rays
        if (this.lightOn) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const rayGrad = ctx.createLinearGradient(w / 2, 0, w / 2, h * 0.7);
            rayGrad.addColorStop(0, 'rgba(78, 205, 196, 0.25)');
            rayGrad.addColorStop(1, 'rgba(78, 205, 196, 0.0)');

            ctx.fillStyle = rayGrad;
            ctx.beginPath();
            ctx.moveTo(w * 0.2, 0);
            ctx.lineTo(w * 0.8, 0);
            ctx.lineTo(w * 0.95, h);
            ctx.lineTo(w * 0.05, h);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Seabed Gravel
        ctx.fillStyle = '#1c2621';
        ctx.beginPath();
        ctx.moveTo(0, h - 60);
        ctx.quadraticCurveTo(w * 0.25, h - 85, w * 0.5, h - 65);
        ctx.quadraticCurveTo(w * 0.75, h - 45, w, h - 70);
        ctx.lineTo(w, h); ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();

        // Render Fish Poop Particles (💩)
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        for (let p of this.poops) {
            ctx.fillText('💩', p.x, p.y);
        }

        // Bubbles
        ctx.strokeStyle = 'rgba(180, 240, 255, 0.7)';
        ctx.fillStyle = 'rgba(180, 240, 255, 0.25)';
        for (let b of this.bubbles) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }

        // Heart particles
        ctx.font = '20px sans-serif';
        for (let hp of this.heartParticles) {
            ctx.globalAlpha = hp.alpha;
            ctx.fillText('💖', hp.x, hp.y);
        }
        ctx.globalAlpha = 1.0;

        // Food Pellets
        for (let f of this.foods) {
            ctx.fillStyle = f.isAphrodisiac ? '#e74c3c' : '#e67e22';
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawForeground(ctx) {
        const w = this.width;
        const h = this.height;

        // 1. FOGGY GLASS & ALGAE GRIME OVERLAY
        if (this.cleanliness < 85) {
            const dirtiness = (85 - this.cleanliness) / 85;
            ctx.save();

            // Foggy haze across glass
            const fogGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
            fogGrad.addColorStop(0, `rgba(40, 65, 30, ${dirtiness * 0.4})`);
            fogGrad.addColorStop(0.7, `rgba(25, 45, 15, ${dirtiness * 0.75})`);
            fogGrad.addColorStop(1, `rgba(15, 35, 10, ${dirtiness * 0.95})`);

            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, w, h);

            // Algae Grime on Glass Edges & Bottom Substrate
            ctx.fillStyle = `rgba(20, 50, 15, ${dirtiness * 0.85})`;
            
            // Bottom edge algae buildup
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(0, h - 90 * dirtiness);
            ctx.quadraticCurveTo(w * 0.3, h - 40 * dirtiness, w * 0.6, h - 80 * dirtiness);
            ctx.quadraticCurveTo(w * 0.85, h - 30 * dirtiness, w, h - 100 * dirtiness);
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();

            // Top corner grime spots
            ctx.beginPath();
            ctx.arc(30, 30, 100 * dirtiness, 0, Math.PI * 2);
            ctx.arc(w - 30, 30, 90 * dirtiness, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // 2. GLASS WEAR, SCRATCHES & WATER MARKS
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;

        // Diagonal glass glare / reflection lines
        ctx.beginPath();
        ctx.moveTo(w * 0.05, 0); ctx.lineTo(w * 0.3, h);
        ctx.moveTo(w * 0.12, 0); ctx.lineTo(w * 0.37, h);
        ctx.moveTo(w * 0.85, 0); ctx.lineTo(w * 0.98, h);
        ctx.stroke();

        // Wear & Scratch Marks
        ctx.strokeStyle = 'rgba(200, 240, 255, 0.12)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(w * 0.22, 120); ctx.lineTo(w * 0.25, 128); // Scratch 1
        ctx.moveTo(w * 0.75, h - 140); ctx.lineTo(w * 0.78, h - 132); // Scratch 2
        ctx.moveTo(w * 0.5, 90); ctx.arc(w * 0.5, 90, 8, 0, Math.PI); // Water spot
        ctx.stroke();
        ctx.restore();

        // 3. Glass Ripples
        ctx.lineWidth = 2.5;
        for (let r of this.ripples) {
            ctx.strokeStyle = `rgba(180, 240, 255, ${r.alpha})`;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 4. Outer Tank Frame Border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, this.width, this.height);
    }
}

window.Tank = Tank;
