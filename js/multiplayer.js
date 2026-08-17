const DEFAULT_LEADERBOARD = [
    { name: "Aquarist Prime", points: 5500, generation: 5, released: 4, date: "2026-08-12" },
    { name: "Dr. Seaman", points: 4200, generation: 4, released: 3, date: "2026-08-12" },
    { name: "Oceanic Master", points: 3100, generation: 3, released: 2, date: "2026-08-11" },
    { name: "AquaBreeder99", points: 2400, generation: 3, released: 2, date: "2026-08-10" },
    { name: "Catfish Explorer", points: 1500, generation: 2, released: 1, date: "2026-08-09" }
];

class MultiplayerManager {
    constructor(appContext) {
        this.app = appContext; // reference to main app / tank / seamen
        this.socket = null;
        this.isOnline = false;
        this.playerName = localStorage.getItem('catfish_player_name') || 'Aquarist_' + Math.floor(Math.random() * 8999 + 1000);
        this.remotePlayers = new Map(); // socketId -> remote player data & fish
        this.onlineCount = 1;

        // Initialize leaderboard cache from localStorage or default entries
        const cached = localStorage.getItem('catfish_leaderboard_cache');
        try {
            this.leaderboardCache = cached ? JSON.parse(cached) : [...DEFAULT_LEADERBOARD];
        } catch(e) {
            this.leaderboardCache = [...DEFAULT_LEADERBOARD];
        }

        this.syncInterval = null;
    }

    getServerUrl(path = '') {
        const baseUrl = window.CATFISH_SERVER_URL || '';
        return baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path;
    }

    init() {
        if (typeof io !== 'undefined') {
            try {
                const serverUrl = window.CATFISH_SERVER_URL || undefined;
                this.socket = io(serverUrl);
                this.setupSocketListeners();
            } catch (e) {
                console.warn('Socket.io connection failed, operating in local offline mode:', e);
            }
        } else {
            console.log('Socket.io client library not loaded. Running in local standalone mode.');
        }

        this.fetchLeaderboard();
        this.setupUIEvents();
    }

    setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            this.isOnline = true;
            this.updateOnlineBadge(true);
            console.log('🟢 Connected to CATFISH Multiplayer Server!');
            this.joinLobby();
        });

        this.socket.on('disconnect', () => {
            this.isOnline = false;
            this.updateOnlineBadge(false);
            console.log('🔴 Disconnected from Multiplayer Server.');
        });

        this.socket.on('online_count', (count) => {
            this.onlineCount = count;
            const countEl = document.getElementById('onlinePlayerCount');
            if (countEl) countEl.textContent = `${count} Online`;
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
                this.showToast(`🌐 Aquarist ${p.name} joined the online tank!`);
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
                this.remotePlayers.set(data.playerId, {
                    id: data.playerId,
                    name: data.playerName,
                    fish: data.fish,
                    points: data.points,
                    generation: data.generation
                });
            }
        });

        this.socket.on('receive_global_chat', (data) => {
            const consoleEl = document.getElementById('chatConsole');
            if (consoleEl) {
                const entry = document.createElement('div');
                const isSelf = data.senderId === this.socket?.id;
                entry.className = isSelf ? 'chat-entry you' : 'chat-entry multiplayer';
                const timeStr = data.time ? `[${data.time}] ` : '';
                entry.innerHTML = `<span class="chat-time" style="font-size: 0.7rem; opacity: 0.7; margin-right: 4px;">${timeStr}</span><span class="chat-sender" style="color: ${isSelf ? 'var(--neon-green)' : 'var(--neon-pink)'}; font-weight: bold;">🌐 ${this.escapeHTML(data.sender)}:</span> <span class="chat-text" style="color: #fff;">${this.escapeHTML(data.text)}</span>`;
                consoleEl.appendChild(entry);
                consoleEl.scrollTop = consoleEl.scrollHeight;
            }

            // Audio notification for incoming chat messages from other players
            if (window.gameAudio && data.senderId !== this.socket?.id) {
                window.gameAudio.playButtonBeep();
            }
        });

        this.socket.on('leaderboard_update', (board) => {
            this.leaderboardCache = board;
            this.renderLeaderboardUI(board);
        });

        // Start periodic fish sync (every 500ms)
        this.syncInterval = setInterval(() => {
            this.broadcastLocalFishState();
        }, 500);
    }

    joinLobby() {
        if (!this.socket || !this.isOnline) return;

        const simplifiedFish = (this.app.seamen || []).map(s => ({
            name: s.name,
            speciesId: s.speciesId,
            stage: s.stage,
            x: Math.round(s.x),
            y: Math.round(s.y),
            angle: s.angle,
            health: Math.round(s.health),
            isDead: s.isDead,
            traits: s.traits.map(t => t.name)
        }));

        this.socket.emit('join_online_lobby', {
            name: this.playerName,
            fish: simplifiedFish,
            points: this.app.researchPoints || 0,
            generation: this.app.currentGeneration || 1,
            released: this.app.totalFishReleased || 0
        });
    }

    broadcastLocalFishState() {
        if (!this.socket || !this.isOnline) return;

        const simplifiedFish = (this.app.seamen || []).map(s => ({
            name: s.name,
            speciesId: s.speciesId,
            stage: s.stage,
            x: Math.round(s.x),
            y: Math.round(s.y),
            angle: s.angle,
            health: Math.round(s.health),
            isDead: s.isDead,
            traits: s.traits.map(t => t.name)
        }));

        this.socket.emit('sync_fish_state', {
            fish: simplifiedFish,
            points: this.app.researchPoints || 0,
            generation: this.app.currentGeneration || 1,
            released: this.app.totalFishReleased || 0
        });
    }

    sendGlobalChat(text) {
        if (!text || !text.trim()) return;
        if (this.socket && this.isOnline) {
            this.socket.emit('send_global_chat', { text: text.trim() });
        } else {
            // Local fallback if offline
            const consoleEl = document.getElementById('chatConsole');
            if (consoleEl) {
                const entry = document.createElement('div');
                entry.className = 'chat-entry you';
                entry.innerHTML = `<span class="chat-sender">You (${this.escapeHTML(this.playerName)}):</span> <span class="chat-text">${this.escapeHTML(text)}</span>`;
                consoleEl.appendChild(entry);
                consoleEl.scrollTop = consoleEl.scrollHeight;
            }
        }
    }

    async fetchLeaderboard() {
        // Render currently cached leaderboard immediately (no delay)
        this.renderLeaderboardUI(this.leaderboardCache);

        try {
            const res = await fetch(this.getServerUrl('/api/leaderboard'));
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

    async submitScore(points, generation, releasedCount) {
        const payload = {
            name: this.playerName,
            points: points,
            generation: generation,
            released: releasedCount
        };

        try {
            const res = await fetch(this.getServerUrl('/api/leaderboard'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                this.showToast(`🏆 Score submitted to Global Leaderboard! (${points} PTS)`);
                if (data.leaderboard) {
                    this.leaderboardCache = data.leaderboard;
                    localStorage.setItem('catfish_leaderboard_cache', JSON.stringify(data.leaderboard));
                    this.renderLeaderboardUI(data.leaderboard);
                }
            }
        } catch (e) {
            console.warn('Score submission offline, saving to local leaderboard:', e);
            this.updateLocalOfflineLeaderboard(this.playerName, points, generation, releasedCount);
            this.showToast(`🏆 Milestone recorded! ${points} PTS`);
        }
    }

    renderLeaderboardUI(board) {
        const listEl = document.getElementById('leaderboardBody');
        const headerTopScoreEl = document.getElementById('headerTopScore');

        if (!board || !Array.isArray(board)) board = [];

        // Ensure sorted descending by research points
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

        // Strictly limit main list to Top 10 players
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
                <td style="color: var(--neon-cyan); text-align: right; font-weight: bold;">${entry.points.toLocaleString()} PTS</td>
                <td style="text-align: center;">Gen ${entry.generation}</td>
                <td style="text-align: center;">${entry.released || 0} Released</td>
                <td style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">${entry.date || 'Today'}</td>
            `;
            listEl.appendChild(tr);
        });

        // If player is registered below Top 10, display their personal rank position at the bottom
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
                <td style="color: var(--neon-cyan); text-align: right; font-weight: bold;">${pEntry.points.toLocaleString()} PTS</td>
                <td style="text-align: center;">Gen ${pEntry.generation}</td>
                <td style="text-align: center;">${pEntry.released || 0} Released</td>
                <td style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">${pEntry.date || 'Today'}</td>
            `;
            listEl.appendChild(trSelf);
        }
    }

    drawRemotePlayers(ctx) {
        if (!this.app.isMultiplayerMode || this.remotePlayers.size === 0) return;

        ctx.save();
        this.remotePlayers.forEach((player) => {
            if (!player.fish || player.fish.length === 0) return;

            player.fish.forEach((f) => {
                ctx.save();
                ctx.globalAlpha = 0.55;

                ctx.fillStyle = 'rgba(78, 205, 196, 0.2)';
                ctx.strokeStyle = 'rgba(78, 205, 196, 0.6)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(f.x, f.y, 22, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();

                ctx.font = "12px 'Share Tech Mono'";
                ctx.fillStyle = '#4edcc4';
                ctx.textAlign = 'center';
                ctx.fillText(`🌐 ${player.name}'s ${f.name}`, f.x, f.y - 28);

                ctx.restore();
            });
        });
        ctx.restore();
    }

    updateOnlineBadge(isOnline) {
        const badge = document.getElementById('onlineStatusBadge');
        if (badge) {
            badge.style.background = isOnline ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)';
            badge.style.borderColor = isOnline ? 'var(--neon-green)' : 'var(--neon-red)';
            badge.style.color = isOnline ? 'var(--neon-green)' : 'var(--neon-red)';
            badge.textContent = isOnline ? '🟢 Online Server' : '🔴 Standalone Local';
        }
    }

    setupUIEvents() {
        const openLbBtn = document.getElementById('openLeaderboardBtn');
        const headerTopScoreEl = document.getElementById('headerTopScore');
        const lbModal = document.getElementById('leaderboardModal');
        const closeLbBtn = document.getElementById('closeLeaderboard');
        const changeNameBtn = document.getElementById('changePlayerNameBtn');

        const openModal = () => {
            this.fetchLeaderboard();
            if (lbModal) lbModal.style.display = 'flex';
        };

        openLbBtn?.addEventListener('click', openModal);
        headerTopScoreEl?.addEventListener('click', openModal);

        closeLbBtn?.addEventListener('click', () => {
            if (lbModal) lbModal.style.display = 'none';
        });

        // Close modal when clicking backdrop overlay
        lbModal?.addEventListener('click', (e) => {
            if (e.target === lbModal) lbModal.style.display = 'none';
        });

        changeNameBtn?.addEventListener('click', () => {
            const newName = prompt('Enter your Aquarist handle for leaderboards & multiplayer:', this.playerName);
            if (newName && newName.trim()) {
                this.playerName = newName.trim().substring(0, 24);
                localStorage.setItem('catfish_player_name', this.playerName);
                this.showToast(`Handle updated to: ${this.playerName}`);
                this.joinLobby();
                this.submitScore(this.app.researchPoints || 0, this.app.currentGeneration || 1, this.app.totalFishReleased || 0);
                const nameDisplay = document.getElementById('aquaristHandleDisplay');
                if (nameDisplay) nameDisplay.textContent = this.playerName;
            }
        });

        const nameDisplay = document.getElementById('aquaristHandleDisplay');
        if (nameDisplay) nameDisplay.textContent = this.playerName;

        // Render initial UI state immediately
        this.renderLeaderboardUI(this.leaderboardCache);
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
}

window.MultiplayerManager = MultiplayerManager;
