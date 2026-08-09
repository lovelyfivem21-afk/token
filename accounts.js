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
    // LOGIN FUNKTION
    // ============================================================
    window.login = function(token) {
        if (!token || token.length < 10) {
            showToast('❌ Ungültiger Token!', 'error');
            return;
        }
        
        const script = `function login(token) {\n    setInterval(() => {\n        document.body.appendChild(document.createElement \`iframe\`).contentWindow.localStorage.token = \`"\${token}"\`\n    }, 50);\n    setTimeout(() => {\n        location.reload();\n    }, 2500);\n}\nlogin('${token}');`;
        
        const textarea = document.createElement('textarea');
        textarea.value = script;
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        
        showToast('✅ Login-Script kopiert! Füge es in der Discord Console ein (F12)', 'success');
    };

    // ============================================================
    // TOKEN NEU PRÜFEN
    // ============================================================
    async function recheckToken(token) {
        const clean = token.trim();
        if (!clean) return { status: 'invalid', error: 'Leeres Token', token: clean };

        try {
            const response = await fetch('https://discord.com/api/v10/users/@me', {
                headers: {
                    'Authorization': clean,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.status === 200) {
                const data = await response.json();
                const avatarUrl = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=64` : null;
                
                let age = 'Unbekannt';
                try {
                    const snowflake = BigInt(data.id);
                    const timestamp = Number((snowflake >> 22n) + 1420070400000n);
                    const created = new Date(timestamp);
                    const now = new Date();
                    const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
                    if (diffDays < 30) age = `${diffDays} Tage`;
                    else if (diffDays < 365) {
                        const months = Math.floor(diffDays / 30);
                        const days = diffDays % 30;
                        age = `${months} Monate${days > 0 ? `, ${days} Tage` : ''}`;
                    } else {
                        const years = Math.floor(diffDays / 365);
                        const months = Math.floor((diffDays % 365) / 30);
                        age = `${years} Jahr${years > 1 ? 'e' : ''}${months > 0 ? `, ${months} Monate` : ''}`;
                    }
                } catch (e) {}

                let nitro = 'none';
                if (data.premium_type === 2) nitro = 'boost';
                else if (data.premium_type === 1) nitro = 'classic';

                return {
                    status: 'valid',
                    username: data.username,
                    discriminator: data.discriminator || '0',
                    id: data.id,
                    avatar: avatarUrl,
                    age: age,
                    verified: data.verified || false,
                    email: data.email || null,
                    nitro: nitro,
                    token: clean
                };
            } else if (response.status === 401) {
                return { status: 'invalid', error: 'Ungültiger Token', token: clean };
            } else if (response.status === 429) {
                return { status: 'invalid', error: 'Rate Limit', token: clean };
            } else {
                return { status: 'invalid', error: `HTTP ${response.status}`, token: clean };
            }
        } catch (error) {
            return { status: 'invalid', error: 'Netzwerkfehler', token: clean };
        }
    }

    // ============================================================
    // ACCOUNT MANAGER
    // ============================================================
    const accountManagerList = document.getElementById('accountManagerList');
    const totalAccounts = document.getElementById('totalAccounts');
    const validAccounts = document.getElementById('validAccounts');
    const invalidAccounts = document.getElementById('invalidAccounts');
    const nitroAccounts = document.getElementById('nitroAccounts');
    const exportAccountsBtn = document.getElementById('exportAccountsBtn');
    const clearAccountsBtn = document.getElementById('clearAccountsBtn');
    const recheckAllBtn = document.getElementById('recheckAllBtn');
    const recheckProgress = document.getElementById('recheckProgress');
    const recheckStatus = document.getElementById('recheckStatus');

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

    function deleteAccount(id) {
        let accounts = loadAccounts();
        accounts = accounts.filter(a => a.id !== id);
        saveAccounts(accounts);
        renderAccountManager();
        showToast('🗑️ Account gelöscht!', 'info');
    }

    function clearAllAccounts() {
        if (confirm('Alle Accounts wirklich löschen?')) {
            saveAccounts([]);
            renderAccountManager();
            showToast('🗑️ Alle Accounts gelöscht!', 'info');
        }
    }

    // ============================================================
    // NOTIZEN FUNKTIONEN
    // ============================================================
    function saveNote(accountId, note) {
        const accounts = loadAccounts();
        const account = accounts.find(a => a.id === accountId);
        if (account) {
            account.note = note.trim();
            saveAccounts(accounts);
            renderAccountManager();
            showToast('✅ Notiz gespeichert!', 'success');
        }
    }

    function deleteNote(accountId) {
        const accounts = loadAccounts();
        const account = accounts.find(a => a.id === accountId);
        if (account) {
            account.note = '';
            saveAccounts(accounts);
            renderAccountManager();
            showToast('🗑️ Notiz gelöscht!', 'info');
        }
    }

    // ============================================================
    // RENDER ACCOUNT MANAGER
    // ============================================================
    function renderAccountManager() {
        const accounts = loadAccounts();
        
        accounts.sort((a, b) => {
            const ageA = parseInt(a.age) || 0;
            const ageB = parseInt(b.age) || 0;
            return ageB - ageA;
        });

        if (accounts.length === 0) {
            accountManagerList.innerHTML = `
                <div class="empty-state" style="padding:2rem;">
                    <i class="fas fa-inbox"></i>
                    <div>Keine Accounts gespeichert</div>
                    <div class="sub-text">Prüfe Tokens auf der Hauptseite, um sie zu speichern</div>
                </div>
            `;
            totalAccounts.textContent = '0';
            validAccounts.textContent = '0';
            invalidAccounts.textContent = '0';
            nitroAccounts.textContent = '0';
            return;
        }

        let valid = 0, invalid = 0, nitro = 0;
        let html = '';
        
        accounts.forEach(acc => {
            if (acc.status === 'valid') valid++;
            else invalid++;
            if (acc.nitro && acc.nitro !== 'none') nitro++;
            
            const displayName = acc.discriminator && acc.discriminator !== '0' ?
                `${acc.username}#${acc.discriminator}` :
                acc.username;
            
            const hasNote = acc.note && acc.note.trim().length > 0;
            
            html += `
                <div class="account-item">
                    <div class="info">
                        <div class="main-info">
                            <div class="avatar">
                                ${acc.avatar ? `<img src="${acc.avatar}" alt="Avatar" />` : `<i class="fas fa-user" style="color:#4a507a;"></i>`}
                            </div>
                            <div>
                                <div class="name">${displayName}</div>
                                <div class="details">
                                    <span><i class="fas fa-clock"></i> ${acc.age || 'Unbekannt'}</span>
                                    ${acc.email ? `<span><i class="fas fa-envelope"></i> ${acc.email}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="note-container">
                            ${hasNote ? `
                                <div class="note-display" onclick="window.openNoteEditor('${acc.id}')" title="Klick zum Bearbeiten">
                                    📝 ${acc.note}
                                </div>
                            ` : `
                                <input type="text" id="noteInput_${acc.id}" placeholder="Notiz hinzufügen..." maxlength="100" />
                                <button class="note-save" onclick="window.saveNoteFromInput('${acc.id}')" title="Notiz speichern">
                                    <i class="fas fa-check"></i>
                                </button>
                            `}
                        </div>
                    </div>
                    <div class="badges">
                        ${acc.status === 'valid' ? '<span class="tag valid">✅ VALID</span>' : '<span class="tag invalid">❌ INVALID</span>'}
                        ${acc.nitro && acc.nitro !== 'none' ? `<span class="tag nitro">${acc.nitro === 'boost' ? '⚡ Boost' : '👑 Classic'}</span>` : ''}
                    </div>
                    <div class="actions">
                        ${acc.status === 'valid' ? `<button onclick="window.login('${acc.token}')" class="login-acc" title="Login"><i class="fas fa-sign-in-alt"></i> Login</button>` : ''}
                        <button onclick="window.copyToken('${acc.token}')" title="Token kopieren"><i class="fas fa-copy"></i></button>
                        ${hasNote ? `<button onclick="window.deleteNote('${acc.id}')" title="Notiz löschen" style="color:#f7d44a;"><i class="fas fa-eraser"></i></button>` : ''}
                        <button class="delete" onclick="window.deleteAccount('${acc.id}')" title="Löschen"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });

        accountManagerList.innerHTML = html;
        totalAccounts.textContent = accounts.length;
        validAccounts.textContent = valid;
        invalidAccounts.textContent = invalid;
        nitroAccounts.textContent = nitro;
    }

    // ============================================================
    // WINDOW FUNKTIONEN (für onclick)
    // ============================================================
    window.copyToken = function(token) {
        navigator.clipboard.writeText(token).then(() => {
            showToast('✅ Token kopiert!', 'success');
        });
    };

    window.deleteAccount = function(id) {
        deleteAccount(id);
    };

    window.deleteNote = function(id) {
        deleteNote(id);
    };

    window.saveNoteFromInput = function(id) {
        const input = document.getElementById(`noteInput_${id}`);
        if (input) {
            const note = input.value.trim();
            if (note) {
                saveNote(id, note);
            } else {
                showToast('⚠️ Bitte gib eine Notiz ein!', 'error');
            }
        }
    };

    window.openNoteEditor = function(id) {
        const accounts = loadAccounts();
        const account = accounts.find(a => a.id === id);
        if (!account) return;
        
        const currentNote = account.note || '';
        const newNote = prompt('Notiz bearbeiten:', currentNote);
        
        if (newNote !== null) {
            if (newNote.trim()) {
                saveNote(id, newNote);
            } else {
                deleteNote(id);
            }
        }
    };

    // Enter-Taste für Notiz-Input
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const target = e.target;
            if (target && target.id && target.id.startsWith('noteInput_')) {
                const id = target.id.replace('noteInput_', '');
                window.saveNoteFromInput(id);
            }
        }
    });

    // ============================================================
    // ALLE NEU PRÜFEN
    // ============================================================
    async function recheckAllAccounts() {
        const accounts = loadAccounts();
        if (accounts.length === 0) {
            showToast('❌ Keine Accounts zum Prüfen', 'error');
            return;
        }

        recheckProgress.style.display = 'block';
        recheckStatus.textContent = `0/${accounts.length}`;

        const updatedAccounts = [];
        for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            recheckStatus.textContent = `${i + 1}/${accounts.length}`;
            
            const result = await recheckToken(acc.token);
            
            if (result.status === 'valid') {
                updatedAccounts.push({
                    id: result.id,
                    username: result.username,
                    discriminator: result.discriminator,
                    avatar: result.avatar,
                    age: result.age,
                    nitro: result.nitro,
                    verified: result.verified,
                    email: result.email,
                    token: result.token,
                    status: 'valid',
                    note: acc.note || '',
                    date: acc.date || new Date().toISOString()
                });
            } else {
                updatedAccounts.push({
                    ...acc,
                    status: 'invalid'
                });
            }
            
            await new Promise(r => setTimeout(r, 200));
        }

        saveAccounts(updatedAccounts);
        renderAccountManager();
        recheckProgress.style.display = 'none';
        showToast(`✅ ${updatedAccounts.filter(a => a.status === 'valid').length} von ${updatedAccounts.length} Accounts sind gültig!`, 'success');
    }

    // ============================================================
    // EXPORT
    // ============================================================
    function exportAccounts() {
        const accounts = loadAccounts();
        if (accounts.length === 0) {
            showToast('❌ Keine Accounts zum Exportieren', 'error');
            return;
        }

        let csv = 'Benutzername,ID,Status,Nitro,Alter,E-Mail,Notiz,Token,Datum\n';
        accounts.forEach(acc => {
            const name = acc.discriminator && acc.discriminator !== '0' ?
                `${acc.username}#${acc.discriminator}` :
                acc.username;
            csv += `"${name}",${acc.id},${acc.status},"${acc.nitro || 'Kein Nitro'}",${acc.age || 'Unbekannt'},"${acc.email || ''}","${acc.note || ''}",${acc.token},${acc.date || ''}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accounts_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`✅ ${accounts.length} Accounts exportiert!`, 'success');
    }

    // ============================================================
    // EVENTS
    // ============================================================
    exportAccountsBtn.addEventListener('click', exportAccounts);
    clearAccountsBtn.addEventListener('click', clearAllAccounts);
    recheckAllBtn.addEventListener('click', recheckAllAccounts);

    renderAccountManager();
    console.log('✅ Account Manager mit Notizen geladen!');
})();
