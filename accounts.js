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
    // ACCOUNT MANAGER
    // ============================================================
    const accountManagerList = document.getElementById('accountManagerList');
    const totalAccounts = document.getElementById('totalAccounts');
    const validAccounts = document.getElementById('validAccounts');
    const nitroAccounts = document.getElementById('nitroAccounts');
    const exportAccountsBtn = document.getElementById('exportAccountsBtn');
    const clearAccountsBtn = document.getElementById('clearAccountsBtn');

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

    function renderAccountManager() {
        const accounts = loadAccounts();
        
        // Nach Alter sortieren (älteste zuerst)
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
            nitroAccounts.textContent = '0';
            return;
        }

        let valid = 0, nitro = 0;
        let html = '';
        
        accounts.forEach(acc => {
            if (acc.status === 'valid') valid++;
            if (acc.nitro && acc.nitro !== 'none') nitro++;
            
            const displayName = acc.discriminator && acc.discriminator !== '0' ?
                `${acc.username}#${acc.discriminator}` :
                acc.username;
            
            html += `
                <div class="account-item">
                    <div class="info">
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
                    <div class="badges">
                        <span class="tag valid">✅ VALID</span>
                        ${acc.nitro && acc.nitro !== 'none' ? `<span class="tag nitro">${acc.nitro === 'boost' ? '⚡ Boost' : '👑 Classic'}</span>` : ''}
                    </div>
                    <div class="actions">
                        <button onclick="window.login('${acc.token}')" class="login-acc" title="Login"><i class="fas fa-sign-in-alt"></i> Login</button>
                        <button onclick="window.copyToken('${acc.token}')" title="Token kopieren"><i class="fas fa-copy"></i></button>
                        <button class="delete" onclick="window.deleteAccount('${acc.id}')" title="Löschen"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });

        accountManagerList.innerHTML = html;
        totalAccounts.textContent = accounts.length;
        validAccounts.textContent = valid;
        nitroAccounts.textContent = nitro;
    }

    window.copyToken = function(token) {
        navigator.clipboard.writeText(token).then(() => {
            showToast('✅ Token kopiert!', 'success');
        });
    };

    window.deleteAccount = function(id) {
        deleteAccount(id);
    };

    function exportAccounts() {
        const accounts = loadAccounts();
        if (accounts.length === 0) {
            showToast('❌ Keine Accounts zum Exportieren', 'error');
            return;
        }

        let csv = 'Benutzername,ID,Status,Nitro,Alter,E-Mail,Token,Datum\n';
        accounts.forEach(acc => {
            const name = acc.discriminator && acc.discriminator !== '0' ?
                `${acc.username}#${acc.discriminator}` :
                acc.username;
            csv += `"${name}",${acc.id},${acc.status},"${acc.nitro || 'Kein Nitro'}",${acc.age || 'Unbekannt'},"${acc.email || ''}",${acc.token},${acc.date || ''}\n`;
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

    exportAccountsBtn.addEventListener('click', exportAccounts);
    clearAccountsBtn.addEventListener('click', clearAllAccounts);

    renderAccountManager();
    console.log('✅ Account Manager geladen!');
})();