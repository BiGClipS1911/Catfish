const DEFAULT_LEADERBOARD = [
    { name: "Aquarist Prime", points: 5500, generation: 5, released: 4, date: "2026-08-12" },
    { name: "Dr. Seaman", points: 4200, generation: 4, released: 3, date: "2026-08-12" },
    { name: "Oceanic Master", points: 3100, generation: 3, released: 2, date: "2026-08-11" },
    { name: "AquaBreeder99", points: 2400, generation: 3, released: 2, date: "2026-08-10" },
    { name: "Catfish Explorer", points: 1500, generation: 2, released: 1, date: "2026-08-09" }
];

const SPECIES_PALETTES = {
    catfish: { dark: '#1b3b2b', mid: '#2e5c46', light: '#4b8c6e', icon: '🐱' },
    angler:  { dark: '#19152b', mid: '#2c2547', light: '#483d73', icon: '💡' },
    goldfish: { dark: '#663b00', mid: '#b86b00', light: '#f39c12', icon: '🐠' },
    piranha: { dark: '#5c1010', mid: '#9e1b1b', light: '#e74c3c', icon: '🦈' },
    puffer:  { dark: '#4a4413', mid: '#827822', light: '#f1c40f', icon: '🐡' }
};

class MultiplayerManager {
    constructor(appContext) {
        this.app = appContext; // reference to main app / tank / seamen
        this.socket = null;
        this.isOnline = false;
        this.playerName = localStorage.getItem('catfish_player_name') || 'Aquarist_' + Math.floor(Math.random() * 8999 + 1000);
        this.remotePlayers = new Map(); // socketId -> remote player data & fish
        this.onlineCount = 1;
        this.unreadChatCount = 0;

        // Initialize leaderboard cache from localStorage or default entries
        const cached = localStorage.getItem('catfish_leaderboard_cache');
        try {
            this.leaderboardCache = cached ? JSON.parse(cached) : [...DEFAULT_LEADERBOARD];
        } catch(e) {
            this.leaderboardCache = [...DEFAULT_LEADERBOARD];
        }

        this.syncInterval = null;
    }

    isExternalHost() {
        if (typeof window === 'undefined') return false;
        const host = (window.location.hostname || '').toLowerCase();
        const isIframe = window.self !== window.top;
        const isStaticCloudHost = host.includes('itch') || host.includes('hwcdn') || host.includes('github') || host.includes('netlify') || host.includes('vercel');
        return isIframe || isStaticCloudHost;
    }

    getServerUrl(path = '') {
        let customUrl = localStorage.getItem('catfish_railway_url') || '';
        let baseUrl = customUrl || window.CATFISH_SERVER_URL || 'https://catfish-production.up.railway.app';

        // Auto-resolve to origin if hosted directly on Railway or localhost
        if (!customUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            if (!this.isExternalHost()) {
                baseUrl = window.location.origin;
            }
        }

        baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://catfish-production.up.railway.app';

        // Auto-fix protocol if missing
        if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = 'https://' + baseUrl;
        }

        return `${baseUrl}${path}`;
    }

    init() {
        const targetUrl = this.getServerUrl();

        if (typeof io !== 'undefined') {
            try {
                this.updateOnlineBadge('connecting');
                this.socket = io(targetUrl, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    timeout: 20000
                });
                this.setupSocketListeners();
            } catch (e) {
                console.warn('Socket.io connection failed, operating in local offline mode:', e);
                this.updateOnlineBadge('offline');
            }
        } else {
            console.log('Socket.io client library not loaded. Running in local standalone mode.');
            this.updateOnlineBadge('offline');
        }

        this.fetchLeaderboard();
        this.setupUIEvents();
    }

    setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            this.isOnline = true;
            this.updateOnlineBadge('online');
            console.log('🟢 Connected to CATFISH Railway Multiplayer Server!');
            this.joinLobby();
        });

        this.socket.on('disconnect', () => {
            this.isOnline = false;
            this.updateOnlineBadge('offline');
            console.log('🔴 Disconnected from Multiplayer Server.');
        });

        this.socket.on('reconnect_attempt', () => {
            this.updateOnlineBadge('connecting');
        });

        this.socket.on('online_count', (count) => {
            this.onlineCount = Math.max(1, count || 1);
            const label = `${this.onlineCount} ${this.onlineCount === 1 ? 'Active Player' : 'Active Players'}`;
            ['onlinePlayerCount', 'floatingOnlineCount'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = `🟢 ${label}`;
            });
        });

        this.socket.on('lobby_state', (data) => {
            this.remotePlayers.clear();
            if (data.players) {
                data.players.forEach(p => {
                    if (p.id !== this.socket.id) {
                        this.remotePlayers.set(p.id, p);
                    }
                });
            }
        });

        this.socket.on('player_joined', (p) => {
            if (p.id !== this.socket.id) {
                this.remotePlayers.set(p.id, p);
                if (window.gameAudio) window.gameAudio.playButtonBeep();
                this.showToast(`🌐 Aquarist ${p.name} joined the online network!`);
            }
        });

        this.socket.on('player_left', (data) => {
            const p = this.remotePlayers.get(data.id);
            if (p) {
                this.showToast(`🚪 Aquarist ${p.name} disconnected.`);
                this.remotePlayers.delete(data.id);
            }
        });

        this.socket.on('remote_fish_update', (data) => {
            if (data.playerId !== this.socket.id) {
                const existing = this.remotePlayers.get(data.playerId);
                const updatedPlayer = {
                    id: data.playerId,
                    name: data.playerName,
                    fish: data.fish || [],
                    points: data.points,
                    generation: data.generation
                };

                if (existing && existing.fish && updatedPlayer.fish) {
                    updatedPlayer.fish.forEach((newFish) => {
                        const prevFish = existing.fish.find(f => f.id === newFish.id || f.name === newFish.name);
                        if (prevFish && prevFish.lerpX !== undefined) {
                            newFish.lerpX = prevFish.lerpX;
                            newFish.lerpY = prevFish.lerpY;
                            newFish.lerpAngle = prevFish.lerpAngle;
                        }
                    });
                }
                this.remotePlayers.set(data.playerId, updatedPlayer);
            }
        });

        this.socket.on('remote_player_action', (data) => {
            if (!this.app.isMultiplayerMode || data.senderId === this.socket.id) return;

            if (data.type === 'feed' && this.app.tank) {
                this.app.tank.addFood(data.x, data.y, false);
                this.showToast(`🌐 ${data.sender} dropped food pellets!`);
            } else if (data.type === 'love' && this.app.tank) {
                this.app.tank.addFood(data.x, data.y, true);
                this.app.tank.addHeartParticle(data.x, data.y);
                this.showToast(`🌐 ${data.sender} dropped aphrodisiacs!`);
            } else if (data.type === 'tap' && this.app.tank) {
                this.app.tank.tapGlass(data.x, data.y);
                this.showToast(`🌐 ${data.sender} tapped the tank glass!`);
            } else if (data.type === 'scrub' && this.app.tank) {
                this.app.tank.scrubAt(data.x, data.y);
            }
        });

        this.socket.on('chat_history', (history) => {
            if (Array.isArray(history)) {
                ['chatConsole', 'floatingChatConsole'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '';
                });
                history.forEach(msg => this.appendChatMessage(msg));
            }
        });

        this.socket.on('receive_global_chat', (data) => {
            this.appendChatMessage(data);
        });

        this.socket.on('leaderboard_update', (board) => {
            if (Array.isArray(board)) {
                this.leaderboardCache = board;
                localStorage.setItem('catfish_leaderboard_cache', JSON.stringify(board));
                this.renderLeaderboardUI(board);
            }
        });

        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            this.broadcastLocalFishState();
        }, 250);
    }

    appendChatMessage(data) {
        if (!data || !data.text) return;

        const isSelf = data.senderId === this.socket?.id || data.senderId === 'self' || (data.sender && data.sender.toLowerCase() === this.playerName.toLowerCase());
        const isSystem = data.isSystem || data.senderId === 'system' || data.sender === 'System';
        const isSeaman = data.senderId === 'seaman' || data.sender === 'Seaman';
        const timeStr = data.time ? `[${data.time}] ` : '';

        const buildHTML = () => {
            if (isSystem) {
                return `<span class="chat-time" style="font-size: 0.7rem; opacity: 0.7; margin-right: 4px;">${timeStr}</span><span class="chat-sender" style="color: var(--neon-amber); font-weight: bold;">📢 System:</span> <span class="chat-text" style="color: #f1c40f; font-style: italic;">${this.escapeHTML(data.text)}</span>`;
            }
            if (isSeaman) {
                return `<span class="chat-time" style="font-size: 0.7rem; opacity: 0.7; margin-right: 4px;">${timeStr}</span><span class="chat-sender" style="color: var(--neon-cyan); font-weight: bold;">🐱 Seaman:</span> <span class="chat-text" style="color: var(--neon-cyan);">${this.escapeHTML(data.text)}</span>`;
            }
            const color = isSelf ? 'var(--neon-green)' : 'var(--neon-pink)';
            const prefix = isSelf ? `You (${this.escapeHTML(data.sender)})` : `🌐 ${this.escapeHTML(data.sender)}`;
            return `<span class="chat-time" style="font-size: 0.7rem; opacity: 0.7; margin-right: 4px;">${timeStr}</span><span class="chat-sender" style="color: ${color}; font-weight: bold;">${prefix}:</span> <span class="chat-text" style="color: #fff;">${this.escapeHTML(data.text)}</span>`;
        };

        ['chatConsole', 'floatingChatConsole'].forEach((consoleId) => {
            const consoleEl = document.getElementById(consoleId);
            if (consoleEl) {
                const entry = document.createElement('div');
                entry.className = isSystem ? 'chat-entry system' : isSeaman ? 'chat-entry seaman' : isSelf ? 'chat-entry you' : 'chat-entry multiplayer';
                entry.innerHTML = buildHTML();
                consoleEl.appendChild(entry);
                consoleEl.scrollTop = consoleEl.scrollHeight;
            }
        });

        const untiedModal = document.getElementById('untiedChatModal');
        const isUntiedOpen = untiedModal && untiedModal.style.display === 'flex';
        if (!isSelf && !isSystem && !isUntiedOpen) {
            this.unreadChatCount++;
            this.updateUnreadBadge();
        }

        if (window.gameAudio && !isSelf && !isSystem) {
            window.gameAudio.playButtonBeep();
        }
    }

    updateUnreadBadge() {
        const badge = document.getElementById('unreadChatBadge');
        if (!badge) return;

        if (this.unreadChatCount > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = this.unreadChatCount > 99 ? '99+' : this.unreadChatCount;
        } else {
            badge.style.display = 'none';
            badge.textContent = '0';
        }
    }

    clearUnreadBadge() {
        this.unreadChatCount = 0;
        this.updateUnreadBadge();
    }

    joinLobby() {
        if (!this.socket || !this.isOnline) return;

        const simplifiedFish = this.getSimplifiedLocalFish();
        this.socket.emit('join_online_lobby', {
            name: this.playerName,
            fish: simplifiedFish,
            points: this.app.researchPoints || 0,
            generation: this.app.currentGeneration || 1,
            released: this.app.totalFishReleased || 0
        });
    }

    getSimplifiedLocalFish() {
        return (this.app.seamen || []).map(s => ({
            id: s.id,
            name: s.name,
            speciesId: s.speciesId,
            stage: s.stage,
            x: Math.round(s.x),
            y: Math.round(s.y),
            vx: Math.round((s.vx || 0) * 10) / 10,
            vy: Math.round((s.vy || 0) * 10) / 10,
            angle: Math.round((s.angle || 0) * 100) / 100,
            facingLeft: s.facingLeft,
            health: Math.round(s.health),
            isDead: s.isDead,
            isPufferInflated: !!s.isPufferInflated,
            decayStage: s.decayStage || 0,
            traits: (s.traits || []).map(t => t.name || t.id || t),
            baseSize: s.baseSize || (s.isBaby ? 20 : 42)
        }));
    }

    broadcastLocalFishState() {
        if (!this.socket || !this.isOnline) return;

        const simplifiedFish = this.getSimplifiedLocalFish();
        this.socket.emit('sync_fish_state', {
            name: this.playerName,
            fish: simplifiedFish,
            points: this.app.researchPoints || 0,
            generation: this.app.currentGeneration || 1,
            released: this.app.totalFishReleased || 0
        });
    }

    sendPlayerAction(type, x, y, extraData = {}) {
        if (this.socket && this.isOnline) {
            this.socket.emit('player_action', {
                type,
                x: Math.round(x),
                y: Math.round(y),
                ...extraData
            });
        }
    }

    sendGlobalChat(text) {
        if (!text || !text.trim()) return;
        const cleanText = text.trim();

        if (this.socket && this.isOnline) {
            this.socket.emit('send_global_chat', { text: cleanText });
        } else {
            this.appendChatMessage({
                id: 'local_' + Date.now(),
                senderId: 'self',
                sender: this.playerName,
                text: cleanText,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
    }

    async fetchLeaderboard() {
        this.renderLeaderboardUI(this.leaderboardCache);

        try {
            const url = this.getServerUrl('/api/leaderboard');
            if (!url) return;

            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    this.leaderboardCache = data;
                    localStorage.setItem('catfish_leaderboard_cache', JSON.stringify(data));
                    this.renderLeaderboardUI(data);
                }
            }
        } catch (e) {
            console.log('Server fetch offline, using local cached leaderboard:', e);
            this.updateLocalOfflineLeaderboard(
                this.playerName,
                this.app.researchPoints || 0,
                this.app.currentGeneration || 1,
                this.app.totalFishReleased || 0
            );
        }
    }

    updateLocalOfflineLeaderboard(name, points, generation, released) {
        if (!name) return;
        const cleanName = name.trim().substring(0, 24);
        const idx = this.leaderboardCache.findIndex(e => e.name.toLowerCase() === cleanName.toLowerCase());
        const entry = {
            name: cleanName,
            points: Math.max(0, Math.floor(points)),
            generation: Math.max(1, generation || 1),
            released: Math.max(0, released || 0),
            date: new Date().toISOString().split('T')[0]
        };

        if (idx >= 0) {
            if (entry.points >= this.leaderboardCache[idx].points) {
                this.leaderboardCache[idx] = { ...this.leaderboardCache[idx], ...entry };
            }
        } else {
            this.leaderboardCache.push(entry);
        }

        this.leaderboardCache.sort((a, b) => (b.points || 0) - (a.points || 0));
        localStorage.setItem('catfish_leaderboard_cache', JSON.stringify(this.leaderboardCache));
        this.renderLeaderboardUI(this.leaderboardCache);
    }

    submitScore(points, generation, releasedCount) {
        const payload = {
            name: this.playerName,
            points: Math.max(0, Math.floor(points || 0)),
            generation: Math.max(1, generation || 1),
            released: Math.max(0, releasedCount || 0)
        };

        if (this.socket && this.isOnline) {
            this.socket.emit('submit_score', payload);
            this.showToast(`🏆 Score updated on Railway Leaderboard! (${payload.points} PTS)`);
        } else {
            this.submitScoreREST(payload);
        }
    }

    async submitScoreREST(payload) {
        try {
            const url = this.getServerUrl('/api/leaderboard');
            if (!url) throw new Error('No server URL configured');

            const res = await fetch(url, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                this.showToast(`🏆 Score submitted! (${payload.points} PTS)`);
                if (data.leaderboard) {
                    this.leaderboardCache = data.leaderboard;
                    localStorage.setItem('catfish_leaderboard_cache', JSON.stringify(data.leaderboard));
                    this.renderLeaderboardUI(data.leaderboard);
                }
            }
        } catch (e) {
            console.warn('Score submission offline, saving to local leaderboard:', e);
            this.updateLocalOfflineLeaderboard(payload.name, payload.points, payload.generation, payload.released);
            this.showToast(`🏆 Milestone recorded! ${payload.points} PTS`);
        }
    }

    renderLeaderboardUI(board) {
        const listEl = document.getElementById('leaderboardBody');
        const headerTopScoreEl = document.getElementById('headerTopScore');

        if (!board || !Array.isArray(board)) board = [];
        board.sort((a, b) => (b.points || 0) - (a.points || 0));

        if (headerTopScoreEl && board.length > 0) {
            const top = board[0];
            headerTopScoreEl.textContent = `🏆 #1 ${top.name}: ${top.points.toLocaleString()} PTS`;
            headerTopScoreEl.style.cursor = 'pointer';
        }

        if (!listEl) return;

        listEl.innerHTML = '';
        if (board.length === 0) {
            listEl.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No high scores recorded yet! Be the first!</td></tr>`;
            return;
        }

        const top10 = board.slice(0, 10);
        let playerInTop10 = false;

        top10.forEach((entry, idx) => {
            const tr = document.createElement('tr');
            const medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `#${idx + 1} `;
            const isSelf = entry.name.toLowerCase() === this.playerName.toLowerCase();
            if (isSelf) playerInTop10 = true;

            tr.style.background = isSelf ? 'rgba(78, 205, 196, 0.22)' : 'transparent';
            if (isSelf) tr.style.fontWeight = 'bold';

            tr.innerHTML = `
                <td style="color: ${isSelf ? 'var(--neon-green)' : 'var(--neon-amber)'};">${medal}${this.escapeHTML(entry.name)}${isSelf ? ' (YOU)' : ''}</td>
                <td style="color: var(--neon-cyan); text-align: right; font-weight: bold;">${(entry.points || 0).toLocaleString()} PTS</td>
                <td style="text-align: center;">Gen ${entry.generation || 1}</td>
                <td style="text-align: center;">${entry.released || 0} Released</td>
                <td style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">${entry.date || 'Today'}</td>
            `;
            listEl.appendChild(tr);
        });

        const playerRankIndex = board.findIndex(e => e.name.toLowerCase() === this.playerName.toLowerCase());
        if (!playerInTop10 && playerRankIndex >= 0) {
            const pEntry = board[playerRankIndex];
            const trDivider = document.createElement('tr');
            trDivider.innerHTML = `<td colspan="5" style="text-align:center; font-size:0.75rem; color: var(--text-muted); padding: 6px 0;">──────── YOUR CURRENT RANK POSITION ────────</td>`;
            listEl.appendChild(trDivider);

            const trSelf = document.createElement('tr');
            trSelf.style.background = 'rgba(78, 205, 196, 0.22)';
            trSelf.style.fontWeight = 'bold';
            trSelf.innerHTML = `
                <td style="color: var(--neon-green);">#${playerRankIndex + 1} ${this.escapeHTML(pEntry.name)} (YOU)</td>
                <td style="color: var(--neon-cyan); text-align: right; font-weight: bold;">${(pEntry.points || 0).toLocaleString()} PTS</td>
                <td style="text-align: center;">Gen ${pEntry.generation || 1}</td>
                <td style="text-align: center;">${pEntry.released || 0} Released</td>
                <td style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">${pEntry.date || 'Today'}</td>
            `;
            listEl.appendChild(trSelf);
        }
    }

    drawRemotePlayers(ctx) {
        if (!this.remotePlayers || this.remotePlayers.size === 0) return;

        ctx.save();
        const now = Date.now();

        this.remotePlayers.forEach((player) => {
            if (!player.fish || !Array.isArray(player.fish) || player.fish.length === 0) return;

            player.fish.forEach((f) => {
                if (f.lerpX === undefined) {
                    f.lerpX = f.x;
                    f.lerpY = f.y;
                    f.lerpAngle = f.angle || 0;
                }

                // 60 FPS LERP position smoothing across screens
                f.lerpX += (f.x - f.lerpX) * 0.22;
                f.lerpY += (f.y - f.lerpY) * 0.22;
                f.lerpAngle += ((f.angle || 0) - f.lerpAngle) * 0.22;

                const drawX = f.lerpX;
                const drawY = f.lerpY;
                const size = f.baseSize || 38;
                const palette = SPECIES_PALETTES[f.speciesId] || SPECIES_PALETTES.catfish;

                ctx.save();

                if (f.decayStage === 3 || f.isDead) {
                    ctx.fillStyle = '#bdc3c7';
                    ctx.strokeStyle = '#7f8c8d';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, 14, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();
                    ctx.font = '14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('🦴', drawX, drawY + 5);
                } else {
                    // Holographic aura ring under remote player fish
                    ctx.fillStyle = 'rgba(78, 205, 196, 0.14)';
                    ctx.strokeStyle = 'rgba(78, 205, 196, 0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, size * 0.9, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();

                    // Fish Body Frame
                    ctx.save();
                    ctx.translate(drawX, drawY);
                    ctx.scale(f.facingLeft ? -1 : 1, 1);
                    ctx.rotate(f.lerpAngle * 0.3);

                    // Tail Fin Motion
                    const wiggle = Math.sin(now * 0.009 + (f.x || 0)) * 8;
                    ctx.fillStyle = palette.mid;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-size * 0.95, -size * 0.45 + wiggle);
                    ctx.lineTo(-size * 0.95, size * 0.45 + wiggle);
                    ctx.closePath();
                    ctx.fill();

                    // Main Oval Body
                    const bodyRadius = f.isPufferInflated ? size * 0.78 : size * 0.58;
                    ctx.fillStyle = palette.light;
                    ctx.strokeStyle = palette.dark;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, bodyRadius * 1.1, bodyRadius * 0.78, 0, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();

                    // Eye & Expression
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(bodyRadius * 0.5, -bodyRadius * 0.25, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#050c12';
                    ctx.beginPath();
                    ctx.arc(bodyRadius * 0.55, -bodyRadius * 0.25, 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();

                    // Species Icon Floating Badge
                    ctx.font = '16px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(palette.icon, drawX - size * 0.6, drawY - size * 0.4);
                }

                // -------------------------------------------------------------
                // ILLUMINATED PLAYER NAME TAG BADGE (ABOVE FISH HEAD)
                // -------------------------------------------------------------
                const headY = drawY - size * 0.9 - 14;
                const nameLabel = `🌐 ${player.name}`;
                const subLabel = `${f.name || 'Fish'} (Gen ${f.generation || 1})`;

                ctx.save();
                ctx.font = "bold 11px 'Share Tech Mono', monospace";
                const nameWidth = ctx.measureText(nameLabel).width;
                const pillWidth = Math.max(88, nameWidth + 18);
                const pillHeight = 20;
                const pillX = drawX - pillWidth / 2;
                const pillY = headY - 22;

                // Glowing Dark Capsule Container
                ctx.fillStyle = 'rgba(5, 12, 18, 0.88)';
                ctx.strokeStyle = '#4edcc4';
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 5);
                ctx.fill();
                ctx.stroke();

                // Player Handle Text inside Pill
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.shadowColor = '#4edcc4';
                ctx.shadowBlur = 4;
                ctx.fillText(nameLabel, drawX, pillY + 14);

                // Subtitle Fish Name & Generation
                ctx.shadowBlur = 0;
                ctx.font = "10px 'Share Tech Mono', monospace";
                ctx.fillStyle = '#4edcc4';
                ctx.fillText(subLabel, drawX, pillY + 32);

                // Health Bar (if active)
                if (!f.isDead && f.health !== undefined) {
                    const hpBarW = pillWidth * 0.75;
                    const hpBarH = 3;
                    const hpBarX = drawX - hpBarW / 2;
                    const hpBarY = pillY + 36;
                    const hpRatio = Math.max(0, Math.min(1, f.health / 100));

                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
                    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
                    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);
                }

                ctx.restore();
                ctx.restore();
            });
        });
        ctx.restore();
    }

    updateOnlineBadge(status) {
        const badge = document.getElementById('onlineStatusBadge');
        if (!badge) return;

        badge.style.cursor = 'pointer';

        if (status === 'online' || status === true) {
            badge.style.background = 'rgba(46, 204, 113, 0.2)';
            badge.style.borderColor = 'var(--neon-green)';
            badge.style.color = 'var(--neon-green)';
            badge.textContent = '🟢 Railway Server';
        } else if (status === 'connecting') {
            badge.style.background = 'rgba(241, 196, 15, 0.2)';
            badge.style.borderColor = 'var(--neon-amber)';
            badge.style.color = 'var(--neon-amber)';
            badge.textContent = '🟡 Connecting...';
        } else {
            badge.style.background = 'rgba(231, 76, 60, 0.2)';
            badge.style.borderColor = 'var(--neon-red)';
            badge.style.color = 'var(--neon-red)';
            badge.textContent = '🔴 Standalone Local';
        }
    }

    async verifyRailwayServer(rawUrl) {
        let inputVal = (rawUrl || '').trim();
        if (!inputVal) {
            inputVal = localStorage.getItem('catfish_railway_url') || window.CATFISH_SERVER_URL || '';
        }

        if (inputVal && !inputVal.startsWith('http://') && !inputVal.startsWith('https://')) {
            inputVal = 'https://' + inputVal;
        }

        if (!inputVal && this.isExternalHost()) {
            return { ok: false, message: '⚠️ Running on itch.io! Please enter your Railway server URL (e.g. https://your-catfish-app.up.railway.app) above.' };
        }

        const targetBase = inputVal ? inputVal.replace(/\/$/, '') : window.location.origin;
        const testUrl = `${targetBase}/api/health`;

        // 1. Primary Strategy: REST API Fetch with CORS
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(testUrl, {
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                return { ok: true, url: targetBase, message: `✅ Connection Success! Connected to Railway (${data.onlinePlayers || 0} Aquarists Online).` };
            }
        } catch (e) {
            console.log('REST health check failed, testing Socket.IO handshake...', e);
        }

        // 2. Secondary Strategy: Direct Socket.IO Handshake Probe
        if (typeof io !== 'undefined') {
            try {
                const socketProbeResult = await new Promise((resolve) => {
                    const probeSocket = io(targetBase, {
                        transports: ['websocket', 'polling'],
                        reconnection: false,
                        timeout: 4000
                    });

                    const timer = setTimeout(() => {
                        try { probeSocket.disconnect(); } catch (e) {}
                        resolve(false);
                    }, 4500);

                    probeSocket.on('connect', () => {
                        clearTimeout(timer);
                        try { probeSocket.disconnect(); } catch (e) {}
                        resolve(true);
                    });

                    probeSocket.on('connect_error', () => {
                        clearTimeout(timer);
                        try { probeSocket.disconnect(); } catch (e) {}
                        resolve(false);
                    });
                });

                if (socketProbeResult) {
                    return { ok: true, url: targetBase, message: '✅ Real-time Socket.IO Connection Success! Multi-player active.' };
                }
            } catch (e) {
                console.log('Socket probe failed:', e);
            }
        }

        // 3. Fallback Strategy: Network reachability probe
        try {
            const res = await fetch(testUrl, { mode: 'no-cors' });
            if (res.type === 'opaque' || res.ok) {
                return { ok: true, url: targetBase, message: '✅ Railway Server Reachable! Connecting real-time sockets...' };
            }
        } catch (e) {
            // unreachable
        }

        return {
            ok: false,
            url: targetBase,
            message: '❌ Connection Failed! Could not reach Railway server. Make sure your Railway app is live and domain is correct.'
        };
    }

    setupUIEvents() {
        const openLbBtn = document.getElementById('openLeaderboardBtn');
        const headerTopScoreEl = document.getElementById('headerTopScore');
        const lbModal = document.getElementById('leaderboardModal');
        const closeLbBtn = document.getElementById('closeLeaderboard');
        const changeNameBtn = document.getElementById('changePlayerNameBtn');
        const changeNameBtnUntied = document.getElementById('changePlayerNameBtnUntied');
        const statusBadge = document.getElementById('onlineStatusBadge');

        const untiedModal = document.getElementById('untiedChatModal');
        const toggleGlobalChatBtn = document.getElementById('toggleGlobalChatBtn');
        const popOutChatBtn = document.getElementById('popOutChatBtn');
        const closeUntiedChatModal = document.getElementById('closeUntiedChatModal');

        const railwayModal = document.getElementById('railwayServerModal');
        const closeRailwayBtn = document.getElementById('closeRailwayServerModal');
        const railwayUrlInput = document.getElementById('railwayServerUrlInput');
        const testRailwayBtn = document.getElementById('testRailwayServerBtn');
        const saveRailwayBtn = document.getElementById('saveRailwayServerBtn');
        const resetRailwayBtn = document.getElementById('resetRailwayServerBtn');
        const railwayStatusText = document.getElementById('railwayServerStatusText');

        const openLbModal = () => {
            this.fetchLeaderboard();
            if (lbModal) lbModal.style.display = 'flex';
        };

        const openRailwayModal = () => {
            if (!railwayModal) return;
            const currentUrl = localStorage.getItem('catfish_railway_url') || window.CATFISH_SERVER_URL || '';
            if (railwayUrlInput) railwayUrlInput.value = currentUrl;
            this.updateRailwayModalStatusText();
            railwayModal.style.display = 'flex';
        };

        const openUntiedChat = () => {
            if (untiedModal) {
                untiedModal.style.display = 'flex';
                this.clearUnreadBadge();
                const floatingInput = document.getElementById('floatingChatInput');
                if (floatingInput) floatingInput.focus();
            }
        };

        toggleGlobalChatBtn?.addEventListener('click', openUntiedChat);
        popOutChatBtn?.addEventListener('click', openUntiedChat);
        closeUntiedChatModal?.addEventListener('click', () => {
            if (untiedModal) untiedModal.style.display = 'none';
        });

        openLbBtn?.addEventListener('click', openLbModal);
        headerTopScoreEl?.addEventListener('click', openLbModal);
        statusBadge?.addEventListener('click', openRailwayModal);

        closeLbBtn?.addEventListener('click', () => {
            if (lbModal) lbModal.style.display = 'none';
        });

        closeRailwayBtn?.addEventListener('click', () => {
            if (railwayModal) railwayModal.style.display = 'none';
        });

        lbModal?.addEventListener('click', (e) => {
            if (e.target === lbModal) lbModal.style.display = 'none';
        });

        railwayModal?.addEventListener('click', (e) => {
            if (e.target === railwayModal) railwayModal.style.display = 'none';
        });

        untiedModal?.addEventListener('click', (e) => {
            if (e.target === untiedModal) untiedModal.style.display = 'none';
        });

        testRailwayBtn?.addEventListener('click', async () => {
            let inputVal = (railwayUrlInput?.value || '').trim();
            if (railwayStatusText) {
                railwayStatusText.style.color = 'var(--neon-cyan)';
                railwayStatusText.textContent = '⏳ Testing multi-strategy connection to Railway Server...';
            }

            const result = await this.verifyRailwayServer(inputVal);
            if (railwayStatusText) {
                railwayStatusText.style.color = result.ok ? 'var(--neon-green)' : 'var(--neon-red)';
                railwayStatusText.textContent = result.message;
            }
            if (result.ok && result.url && railwayUrlInput) {
                railwayUrlInput.value = result.url;
            }
        });

        saveRailwayBtn?.addEventListener('click', async () => {
            let inputVal = (railwayUrlInput?.value || '').trim();
            if (inputVal && !inputVal.startsWith('http://') && !inputVal.startsWith('https://')) {
                inputVal = 'https://' + inputVal;
            }

            if (inputVal) {
                localStorage.setItem('catfish_railway_url', inputVal);
                this.showToast(`⚙️ Saved Railway Server URL: ${inputVal}`);
            } else {
                localStorage.removeItem('catfish_railway_url');
                this.showToast(`⚙️ Reset to default auto-detected domain.`);
            }

            if (railwayModal) railwayModal.style.display = 'none';

            if (this.socket) {
                try { this.socket.disconnect(); } catch (e) {}
            }
            this.init();
        });

        resetRailwayBtn?.addEventListener('click', () => {
            if (railwayUrlInput) railwayUrlInput.value = '';
            localStorage.removeItem('catfish_railway_url');
            if (railwayStatusText) {
                railwayStatusText.style.color = 'var(--neon-cyan)';
                railwayStatusText.textContent = 'ℹ️ Reset to default host domain.';
            }
        });

        const handleChangeName = () => {
            const newName = prompt('Enter your Aquarist handle for leaderboards & multiplayer chat:', this.playerName);
            if (newName && newName.trim()) {
                this.playerName = newName.trim().substring(0, 24);
                localStorage.setItem('catfish_player_name', this.playerName);
                this.showToast(`Handle updated to: ${this.playerName}`);
                this.joinLobby();
                this.submitScore(this.app.researchPoints || 0, this.app.currentGeneration || 1, this.app.totalFishReleased || 0);
                this.updateHandleDisplays();
            }
        };

        changeNameBtn?.addEventListener('click', handleChangeName);
        changeNameBtnUntied?.addEventListener('click', handleChangeName);

        this.updateHandleDisplays();
        this.renderLeaderboardUI(this.leaderboardCache);
    }

    updateHandleDisplays() {
        ['aquaristHandleDisplay', 'aquaristHandleDisplayUntied'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = this.playerName;
        });
    }

    updateRailwayModalStatusText() {
        const railwayStatusText = document.getElementById('railwayServerStatusText');
        if (!railwayStatusText) return;

        const currentUrl = localStorage.getItem('catfish_railway_url') || this.getServerUrl();
        if (this.isOnline) {
            railwayStatusText.style.color = 'var(--neon-green)';
            railwayStatusText.textContent = `🟢 Connected to Railway Server (${currentUrl || 'Auto-Detected Origin'})`;
        } else {
            railwayStatusText.style.color = 'var(--neon-amber)';
            railwayStatusText.textContent = `🔴 Disconnected / Local Mode. Target: ${currentUrl || 'Not configured (click test below)'}`;
        }
    }

    showToast(message) {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

window.MultiplayerManager = MultiplayerManager;
