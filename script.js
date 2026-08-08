(function() {
    // ============================================================
    // PARTIKEL HINTERGRUND
    // ============================================================
    function createParticles() {
        const container = document.getElementById('particles');
        const count = 60;
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.width = (1 + Math.random() * 4) + 'px';
            particle.style.height = particle.style.width;
            particle.style.animationDuration = (15 + Math.random() * 30) + 's';
            particle.style.animationDelay = (Math.random() * 20) + 's';
            particle.style.opacity = 0.1 + Math.random() * 0.3;
            container.appendChild(particle);
        }
    }
    createParticles();

    // ============================================================
    // HINTERGRUND MUSIK
    // ============================================================
    const audio = document.getElementById('bgMusic');
    audio.volume = 0.08;

    document.addEventListener('click', function() {
        if (audio.paused) {
            audio.play().catch(function(e) {
                console.log('Autoplay blockiert, Benutzer muss klicken.');
            });
        }
    }, { once: true });

    // ============================================================
    // LOGIN MODAL
    // ============================================================
    const loginModalOverlay = document.getElementById('loginModalOverlay');
    const loginScriptCode = document.getElementById('loginScriptCode');
    const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
    const closeLoginModalX = document.getElementById('closeLoginModal');
    const copyLoginScriptBtn = document.getElementById('copyLoginScript');

    window.login = function(token) {
        if (!token || token.length < 10) {
            showToast('❌ Ungültiger Token!', 'error');
            return;
        }
        
        const script = `function login(token) {\n    setInterval(() => {\n        document.body.appendChild(document.createElement \`iframe\`).contentWindow.localStorage.token = \`"\${token}"\`\n    }, 50);\n    setTimeout(() => {\n        location.reload();\n    }, 2500);\n}\nlogin('${token}');`;
        
        loginScriptCode.textContent = script;
        loginModalOverlay.classList.add('active');
    };

    function closeLoginModal() {
        loginModalOverlay.classList.remove('active');
    }

    closeLoginModalBtn.addEventListener('click', closeLoginModal);
    closeLoginModalX.addEventListener('click', closeLoginModal);

    loginModalOverlay.addEventListener('click', function(e) {
        if (e.target === this) closeLoginModal();
    });

    copyLoginScriptBtn.addEventListener('click', function() {
        const text = loginScriptCode.textContent;
        navigator.clipboard.writeText(text).then(() => {
            showToast('✅ Script kopiert!', 'success');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            showToast('✅ Script kopiert!', 'success');
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && loginModalOverlay.classList.contains('active')) {
            closeLoginModal();
        }
    });

    // ============================================================
    // 2FA FUNKTIONEN
    // ============================================================
    function base32Decode(str) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        for (let i = 0; i < str.length; i++) {
            const val = alphabet.indexOf(str[i].toUpperCase());
            if (val === -1) continue;
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.slice(i, i + 8), 2));
        }
        return new Uint8Array(bytes);
    }

    async function hmacSha1(key, message) {
        const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key;
        const msgData = typeof message === 'string' ? new TextEncoder().encode(message) : message;
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-1' },
            false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        return new Uint8Array(signature);
    }

    async function generateTotp(secret) {
        if (!secret || secret.trim().length === 0) return null;
        try {
            const cleanSecret = secret.trim().toUpperCase().replace(/\s/g, '');
            const key = base32Decode(cleanSecret);
            const epoch = Math.floor(Date.now() / 1000);
            const time = Math.floor(epoch / 30);
            const timeBuffer = new ArrayBuffer(8);
            const view = new DataView(timeBuffer);
            view.setBigUint64(0, BigInt(time), false);
            const hmac = await hmacSha1(key, new Uint8Array(timeBuffer));
            const offset = hmac[19] & 0xf;
            const code = ((hmac[offset] & 0x7f) << 24) |
                ((hmac[offset + 1] & 0xff) << 16) |
                ((hmac[offset + 2] & 0xff) << 8) |
                (hmac[offset + 3] & 0xff);
            const totp = code % 1000000;
            return totp.toString().padStart(6, '0');
        } catch (e) {
            return null;
        }
    }

    // ============================================================
    // 2FA MODAL
    // ============================================================
    const modalOverlay = document.getElementById('modalOverlay');
    const totpSecret = document.getElementById('totpSecret');
    const totpCode = document.getElementById('totpCode');
    const totpTimerDisplay = document.getElementById('totpTimerDisplay');
    const open2faBtn = document.getElementById('open2faBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const generateTotpBtn = document.getElementById('generateTotpBtn');

    let totpInterval = null;

    open2faBtn.addEventListener('click', function() {
        modalOverlay.classList.add('active');
        totpSecret.value = '';
        totpCode.textContent = '------';
        totpTimerDisplay.textContent = '30s';
        if (totpInterval) clearInterval(totpInterval);
        document.querySelector('.modal').style.animation = 'none';
        setTimeout(() => {
            document.querySelector('.modal').style.animation = 'modalSlideUp 0.4s ease-out';
        }, 10);
    });

    closeModalBtn.addEventListener('click', function() {
        modalOverlay.classList.remove('active');
        if (totpInterval) clearInterval(totpInterval);
    });

    modalOverlay.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
            if (totpInterval) clearInterval(totpInterval);
        }
    });

    generateTotpBtn.addEventListener('click', async function() {
        const secret = totpSecret.value.trim();
        if (!secret) {
            showToast('❌ Bitte gib einen Secret Key ein!', 'error');
            return;
        }
        const code = await generateTotp(secret);
        if (code) {
            totpCode.textContent = code;
            totpCode.style.animation = 'none';
            setTimeout(() => {
                totpCode.style.animation = 'codePop 0.3s ease-out';
            }, 10);
            const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            totpTimerDisplay.textContent = remaining + 's';
            if (totpInterval) clearInterval(totpInterval);
            totpInterval = setInterval(async () => {
                const rem = 30 - (Math.floor(Date.now() / 1000) % 30);
                totpTimerDisplay.textContent = rem + 's';
                if (rem === 0 || rem === 30) {
                    const newCode = await generateTotp(secret);
                    if (newCode) {
                        totpCode.textContent = newCode;
                        totpCode.style.animation = 'none';
                        setTimeout(() => {
                            totpCode.style.animation = 'codePop 0.3s ease-out';
                        }, 10);
                    }
                }
            }, 1000);
            showToast('✅ 2FA Code generiert!', 'success');
        } else {
            showToast('❌ Ungültiger Secret Key!', 'error');
        }
    });

    totpSecret.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') generateTotpBtn.click();
    });

    // ============================================================
    // TOAST
    // ============================================================
    function showToast(message, type = 'info') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // ============================================================
    // TOKEN CHECKER
    // ============================================================
    const tokenInput = document.getElementById('tokenInput');
    const checkBtn = document.getElementById('checkTokensBtn');
    const fileInput = document.getElementById('fileInput');
    const clearBtn = document.getElementById('clearBtn');
    const extractValidBtn = document.getElementById('extractValidBtn');
    const resultList = document.getElementById('resultList');
    const validCount = document.getElementById('validCount');
    const invalidCount = document.getElementById('invalidCount');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const statBoxes = document.querySelectorAll('.stat-box');

    const tokenCache = new Map();
    let currentResults = [];
    let currentTokens = [];
    let activeFilter = 'all';

    // ============================================================
    // ACCOUNT AGE
    // ============================================================
    function getAccountAgeFromId(userId) {
        try {
            const snowflake = BigInt(userId);
            const timestamp = Number((snowflake >> 22n) + 1420070400000n);
            const created = new Date(timestamp);
            const now = new Date();
            if (isNaN(created.getTime())) return 'Unbekannt';
            const diffMs = now - created;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays < 1) {
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                return `${diffHours} Stunde${diffHours !== 1 ? 'n' : ''}`;
            } else if (diffDays < 30) {
                return `${diffDays} Tag${diffDays !== 1 ? 'e' : ''}`;
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                const remainingDays = diffDays % 30;
                if (remainingDays === 0) return `${months} Monat${months !== 1 ? 'e' : ''}`;
                return `${months} Monat${months !== 1 ? 'e' : ''}, ${remainingDays} Tag${remainingDays !== 1 ? 'e' : ''}`;
            } else {
                const years = Math.floor(diffDays / 365);
                const remainingDays = diffDays % 365;
                const months = Math.floor(remainingDays / 30);
                const days = remainingDays % 30;
                let result = `${years} Jahr${years > 1 ? 'e' : ''}`;
                if (months > 0) result += `, ${months} Monat${months > 1 ? 'e' : ''}`;
                if (days > 0 && months === 0) result += `, ${days} Tag${days > 1 ? 'e' : ''}`;
                return result;
            }
        } catch (e) {
            return 'Unbekannt';
        }
    }

    // ============================================================
    // TOKEN CHECK
    // ============================================================
    async function checkToken(token) {
        const clean = token.trim();
        if (!clean) return { status: 'empty', error: 'Leeres Token', token: clean };

        if (tokenCache.has(clean)) {
            return tokenCache.get(clean);
        }

        try {
            const response = await fetch('https://discord.com/api/v10/users/@me', {
                headers: {
                    'Authorization': clean,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            let result = { status: 'invalid', error: 'Unbekannter Fehler', token: clean };

            if (response.status === 200) {
                const data = await response.json();
                const avatarUrl = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=64` : null;
                const age = getAccountAgeFromId(data.id);
                let nitro = 'none';
                if (data.premium_type === 2) nitro = 'boost';
                else if (data.premium_type === 1) nitro = 'classic';

                result = {
                    status: 'valid',
                    username: data.username,
                    discriminator: data.discriminator || '0',
                    id: data.id,
                    avatar: avatarUrl,
                    age: age,
                    verified: data.verified || false,
                    email: data.email || null,
                    nitro: nitro,
                    token: clean,
                    raw: data
                };
            } else if (response.status === 401) {
                result = { status: 'invalid', error: 'Ungültiger Token', token: clean };
            } else if (response.status === 429) {
                result = { status: 'invalid', error: 'Rate Limit', token: clean };
            } else {
                result = { status: 'invalid', error: `HTTP ${response.status}`, token: clean };
            }

            tokenCache.set(clean, result);
            return result;
        } catch (error) {
            const result = { status: 'invalid', error: 'Netzwerkfehler', token: clean };
            tokenCache.set(clean, result);
            return result;
        }
    }

    // ============================================================
    // RENDER
    // ============================================================
    function renderResultItem(token, result, index) {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.style.animationDelay = `${index * 0.05}s`;
        div.dataset.status = result.status || 'pending';

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        if (result.status === 'valid' && result.avatar) {
            const img = document.createElement('img');
            img.src = result.avatar;
            img.alt = 'Avatar';
            img.loading = 'lazy';
            avatarDiv.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fas fa-user';
            avatarDiv.appendChild(icon);
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'info';

        const usernameSpan = document.createElement('div');
        usernameSpan.className = 'username';
        if (result.status === 'valid') {
            const displayName = result.discriminator && result.discriminator !== '0' ?
                `${result.username}#${result.discriminator}` :
                result.username;
            usernameSpan.textContent = displayName;

            if (result.nitro && result.nitro !== 'none') {
                const nitroSpan = document.createElement('span');
                nitroSpan.className = `nitro-indicator ${result.nitro}`;
                nitroSpan.textContent = result.nitro === 'boost' ? '⚡ Boost' : '👑 Classic';
                usernameSpan.appendChild(nitroSpan);
            }
        } else {
            const shortToken = token.length > 20 ? token.slice(0, 16) + '…' : token;
            usernameSpan.textContent = result.status === 'pending' ? '⏳ Prüfe…' : shortToken;
        }

        const detailsSpan = document.createElement('div');
        detailsSpan.className = 'details';
        if (result.status === 'valid') {
            const idSpan = document.createElement('span');
            idSpan.innerHTML = `<i class="fas fa-id-card"></i> ${result.id}`;
            detailsSpan.appendChild(idSpan);
            const ageSpan = document.createElement('span');
            ageSpan.innerHTML = `<i class="fas fa-clock"></i> ${result.age}`;
            detailsSpan.appendChild(ageSpan);
            if (result.verified) {
                const verifiedSpan = document.createElement('span');
                verifiedSpan.innerHTML = `<i class="fas fa-check-circle" style="color:#4ade80;"></i> Verifiziert`;
                detailsSpan.appendChild(verifiedSpan);
            }
            if (result.email) {
                const emailSpan = document.createElement('span');
                emailSpan.innerHTML = `<i class="fas fa-envelope"></i> ${result.email}`;
                detailsSpan.appendChild(emailSpan);
            }
        } else if (result.status === 'pending') {
            const pendingSpan = document.createElement('span');
            pendingSpan.innerHTML = `<i class="fas fa-spinner"></i> Wird geprüft…`;
            detailsSpan.appendChild(pendingSpan);
        } else {
            const errorSpan = document.createElement('span');
            errorSpan.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${result.error || 'Fehler'}`;
            detailsSpan.appendChild(errorSpan);
        }

        infoDiv.appendChild(usernameSpan);
        infoDiv.appendChild(detailsSpan);

        const badge = document.createElement('span');
        badge.className = `status-badge ${result.status}`;
        badge.textContent = result.status === 'valid' ? 'VALID' : result.status === 'invalid' ? 'INVALID' : 'PENDING';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'result-actions';
        
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Kopieren';
        copyBtn.title = 'Kopieren';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(token).then(() => showToast('✅ Token kopiert!', 'success'));
        });
        actionsDiv.appendChild(copyBtn);

        if (result.status === 'valid') {
            const loginBtn = document.createElement('button');
            loginBtn.className = 'login-btn';
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            loginBtn.title = 'Mit Token einloggen';
            loginBtn.addEventListener('click', () => {
                window.login(token);
            });
            actionsDiv.appendChild(loginBtn);
        }

        div.appendChild(avatarDiv);
        div.appendChild(infoDiv);
        div.appendChild(badge);
        div.appendChild(actionsDiv);

        return div;
    }

    function updateStats(results) {
        let valid = 0, invalid = 0;
        results.forEach(r => {
            if (r.status === 'valid') valid++;
            else if (r.status === 'invalid') invalid++;
        });
        validCount.textContent = valid;
        invalidCount.textContent = invalid;

        document.querySelectorAll('.stat-box .number').forEach(el => {
            el.style.animation = 'none';
            setTimeout(() => {
                el.style.animation = 'numberPop 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            }, 10);
        });
    }

    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes numberPop {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(styleSheet);

    function renderResults(tokens, results) {
        currentTokens = tokens;
        currentResults = results;
        applyFilter();
    }

    function applyFilter() {
        const filteredResults = currentResults.filter((r, index) => {
            if (activeFilter === 'all') return true;
            return r.status === activeFilter;
        });
        const filteredTokens = currentTokens.filter((t, index) => {
            if (activeFilter === 'all') return true;
            return currentResults[index]?.status === activeFilter;
        });

        if (filteredResults.length === 0) {
            resultList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-filter"></i>
                    <div>Keine ${activeFilter === 'all' ? 'Ergebnisse' : activeFilter === 'valid' ? 'gültigen' : 'ungültigen'} Tokens</div>
                    <div class="sub-text">Ändere den Filter oder prüfe mehr Tokens</div>
                </div>
            `;
            return;
        }

        resultList.innerHTML = '';
        filteredTokens.forEach((token, index) => {
            const result = filteredResults[index] || { status: 'pending', error: 'Wird geprüft…', token: token };
            const item = renderResultItem(token, result, index);
            resultList.appendChild(item);
        });
    }

    // ============================================================
    // FILTER
    // ============================================================
    function setFilter(filter) {
        activeFilter = filter;
        filterButtons.forEach(btn => {
            btn.classList.remove('active', 'active-valid', 'active-invalid');
            if (btn.dataset.filter === filter) {
                if (filter === 'valid') btn.classList.add('active-valid');
                else if (filter === 'invalid') btn.classList.add('active-invalid');
                else btn.classList.add('active');
            }
        });
        applyFilter();
    }

    // ============================================================
    // MAIN PROCESS
    // ============================================================
    async function processTokens() {
        const raw = tokenInput.value;
        const lines = raw.split(/\r?\n/);
        const tokens = lines.map(l => l.trim()).filter(t => t.length > 0);

        if (tokens.length === 0) {
            resultList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <div>Keine Tokens zum Prüfen</div>
                    <div class="sub-text">Füge Tokens in das Textfeld ein</div>
                </div>
            `;
            updateStats([]);
            progressBar.classList.remove('active');
            return;
        }

        progressBar.classList.add('active');
        progressFill.style.width = '0%';

        const pendingResults = tokens.map(t => ({ status: 'pending', error: 'Prüfe…', token: t }));
        renderResults(tokens, pendingResults);
        updateStats(pendingResults);

        const results = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const result = await checkToken(token);
            results.push(result);

            const currentResults = [...results];
            for (let j = results.length; j < tokens.length; j++) {
                currentResults.push({ status: 'pending', error: 'Prüfe…', token: tokens[j] });
            }
            renderResults(tokens, currentResults);
            updateStats(currentResults);
            progressFill.style.width = `${((i + 1) / tokens.length) * 100}%`;

            if (i < tokens.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        // ============================================================
        // ACCOUNTS SPEICHERN
        // ============================================================
        const validResults = results.filter(r => r.status === 'valid');
        validResults.forEach(r => addAccount(r));

        setFilter('all');
        setTimeout(() => progressBar.classList.remove('active'), 500);
    }

    // ============================================================
    // EVENTS
    // ============================================================
    checkBtn.addEventListener('click', processTokens);

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            tokenInput.value = ev.target.result;
            processTokens();
            fileInput.value = '';
        };
        reader.readAsText(file, 'UTF-8');
    });

    clearBtn.addEventListener('click', function() {
        tokenInput.value = '';
        resultList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <div>Keine Tokens zum Prüfen</div>
                <div class="sub-text">Füge Tokens in das Textfeld ein</div>
            </div>
        `;
        updateStats([]);
        tokenCache.clear();
        progressBar.classList.remove('active');
        setFilter('all');
    });

    extractValidBtn.addEventListener('click', function() {
        const validTokens = currentResults.filter(r => r.status === 'valid');
        if (validTokens.length === 0) {
            showToast('❌ Keine gültigen Tokens gefunden', 'error');
            return;
        }
        const tokens = validTokens.map(r => r.token).join('\n');
        tokenInput.value = tokens;
        processTokens();
        showToast(`✅ ${validTokens.length} gültige Tokens extrahiert!`, 'success');
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            setFilter(this.dataset.filter);
        });
    });

    statBoxes.forEach(box => {
        box.addEventListener('click', function() {
            setFilter(this.dataset.filter);
        });
    });

    tokenInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            processTokens();
        }
    });

    // ============================================================
    // ACCOUNT MANAGER HELPER
    // ============================================================
    function loadAccounts() {
        try {
            return JSON.parse(localStorage.getItem('savedAccounts')) || [];
        } catch {
            return [];
        }
    }

    function saveAccounts(accounts) {
        localStorage.setItem('savedAccounts', JSON.stringify(accounts));
    }

    function addAccount(account) {
        const accounts = loadAccounts();
        const exists = accounts.some(a => a.id === account.id);
        if (!exists) {
            accounts.push({
                id: account.id,
                username: account.username,
                discriminator: account.discriminator,
                avatar: account.avatar,
                age: account.age,
                nitro: account.nitro,
                verified: account.verified,
                email: account.email,
                token: account.token,
                status: account.status,
                date: new Date().toISOString()
            });
            saveAccounts(accounts);
        }
    }

    window.addEventListener('DOMContentLoaded', function() {
        resultList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-rocket"></i>
                <div>Bereit für die Token-Prüfung</div>
                <div class="sub-text">Füge Tokens ein und klicke auf "Check Tokens"</div>
            </div>
        `;
        updateStats([]);
        setFilter('all');
        
        console.log('%c🔐 Token Checker geladen!', 'font-size:16px; font-weight:bold; color:#8b9cf7;');
        console.log('%c📋 Klicke auf "Login" bei gültigen Tokens', 'font-size:12px; color:#8892b0;');
        console.log('%c🎵 M83 - Outro spielt leise im Hintergrund', 'font-size:12px; color:#8892b0;');
        console.log('%c📊 Accounts werden automatisch gespeichert', 'font-size:12px; color:#8b9cf7;');
    });

    console.log('✅ Token Checker geladen!');
})();
