document.addEventListener('DOMContentLoaded', function () {

    // ==========================================
    // 1. Seizure Timer with Screen Wake Lock & Audio Alert
    // ==========================================
    const timerDisplay = document.getElementById('timer-display');
    const timerBtn = document.getElementById('start-timer');
    const mobileTimerBtn = document.getElementById('mobile-timer-btn');

    let timerInterval = null;
    let startTime = null;
    let isRunning = false;
    let wakeLock = null;
    let hasPlayedAlert = false;

    // Audio Context for generating beep sound
    let audioContext = null;

    function playAlertBeep() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Play 3 beeps
        for (let i = 0; i < 3; i++) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 880; // A5 note
            oscillator.type = 'sine';

            const startTime = audioContext.currentTime + (i * 0.3);
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.15);

            gainNode.gain.setValueAtTime(0.5, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
        }
    }

    // Request Screen Wake Lock (Keep phone awake)
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.log('Wake Lock error:', err);
            }
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    function toggleTimer() {
        const lang = localStorage.getItem('language') || 'en';

        if (!isRunning) {
            // Start
            isRunning = true;
            hasPlayedAlert = false;
            startTime = Date.now();
            updateTimerUI(true);
            requestWakeLock();

            timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const secs = (elapsed % 60).toString().padStart(2, '0');
                timerDisplay.textContent = `${mins}:${secs}`;

                // Haptic pulse every minute (so caregiver can focus on patient)
                if (elapsed > 0 && elapsed % 60 === 0 && navigator.vibrate) {
                    navigator.vibrate(100); // Single short pulse
                }

                // 5 Minute Warning
                if (elapsed >= 300) {
                    timerDisplay.style.color = 'var(--danger)';
                    if (!hasPlayedAlert) {
                        playAlertBeep();
                        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
                        hasPlayedAlert = true;
                    }
                }
            }, 1000);

        } else {
            // Stop
            clearInterval(timerInterval);
            isRunning = false;
            updateTimerUI(false);
            releaseWakeLock();

            const finalTime = timerDisplay.textContent;
            const message = lang === 'hi'
                ? `दौरे की अवधि: ${finalTime}\n\nकृपया इसे लिख लें या डॉक्टर के लिए स्क्रीनशॉट लें।`
                : `Seizure Duration: ${finalTime}\n\nPlease write this down or screenshot it for the doctor.`;
            alert(message);
        }
    }

    function updateTimerUI(running) {
        const lang = localStorage.getItem('language') || 'en';
        const t = translations[lang];

        const btnText = running ? `⏹️ ${t['timer.stop']}` : `▶️ ${t['timer.start']}`;
        const mobileText = running ? '⏹️' : '⏱️';

        timerBtn.innerHTML = `<span class="icon">${running ? '⏹️' : '▶️'}</span> <span data-i18n="timer.${running ? 'stop' : 'start'}">${running ? t['timer.stop'] : t['timer.start']}</span>`;

        if (mobileTimerBtn) {
            const mobileLabel = mobileTimerBtn.querySelector('[data-i18n]');
            if (mobileLabel) mobileLabel.textContent = running ? (lang === 'hi' ? 'रोकें' : 'Stop') : t['mobile.timer'];
        }

        const card = document.getElementById('timer-container');
        if (card) card.classList[running ? 'add' : 'remove']('running');

        // Update status text
        const statusEl = document.querySelector('.timer-status');
        if (statusEl) {
            statusEl.textContent = running ? t['timer.running'] : t['timer.ready'];
        }
    }

    if (timerBtn) timerBtn.addEventListener('click', toggleTimer);

    // Sync Mobile Button
    if (mobileTimerBtn) {
        mobileTimerBtn.addEventListener('click', () => {
            const timerSection = document.getElementById('timer-container');
            if (!isRunning) {
                timerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                toggleTimer();
            }
        });
    }

    // ==========================================
    // 2. Checklist Persistence
    // ==========================================
    const checkboxes = document.querySelectorAll('.checklist-input');
    const progressFill = document.getElementById('progress-fill');

    const savedState = JSON.parse(localStorage.getItem('seizureChecklist') || '{}');

    checkboxes.forEach(box => {
        const id = box.dataset.id;
        if (savedState[id]) box.checked = true;

        box.addEventListener('change', (e) => {
            savedState[id] = e.target.checked;
            localStorage.setItem('seizureChecklist', JSON.stringify(savedState));
            updateProgress();
        });
    });

    function updateProgress() {
        const total = checkboxes.length;
        const checked = document.querySelectorAll('.checklist-input:checked').length;
        const percent = (checked / total) * 100;
        if (progressFill) progressFill.style.width = `${percent}%`;
    }

    updateProgress();

    // ==========================================
    // 3. Sharing Logic
    // ==========================================
    window.shareResource = async function () {
        const lang = localStorage.getItem('language') || 'en';
        if (navigator.share) {
            try {
                await navigator.share({
                    title: lang === 'hi' ? 'पहला दौरा गाइड' : 'First Seizure Guide',
                    text: lang === 'hi' ? 'दौरों को संभालने के लिए एक उपयोगी गाइड।' : 'A helpful guide for handling first seizures.',
                    url: window.location.href
                });
            } catch (err) {
                // User cancelled
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert(lang === 'hi' ? 'लिंक क्लिपबोर्ड पर कॉपी हो गया' : 'Link copied to clipboard');
        }
    };

    // ==========================================
    // 4. Dark Mode Toggle
    // ==========================================
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    // Check saved preference or system preference
    function initDarkMode() {
        const saved = localStorage.getItem('darkMode');
        if (saved === 'true') {
            document.body.classList.add('dark-mode');
            if (darkModeToggle) darkModeToggle.textContent = '☀️';
        } else if (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
            if (darkModeToggle) darkModeToggle.textContent = '☀️';
        }
    }

    initDarkMode();

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            darkModeToggle.textContent = isDark ? '☀️' : '🌙';
        });
    }

    // ==========================================
    // 5. Language Switching (i18n)
    // ==========================================
    const langToggle = document.getElementById('lang-toggle');

    function applyTranslations(lang) {
        const t = translations[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (t[key]) {
                // Use innerHTML for elements that may contain HTML (like list items with <strong>)
                el.innerHTML = t[key];
            }
        });

        // Update HTML lang attribute
        document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
    }

    function initLanguage() {
        const saved = localStorage.getItem('language') || 'en';
        if (langToggle) langToggle.textContent = saved === 'hi' ? 'हि' : 'EN';
        applyTranslations(saved);
    }

    initLanguage();

    if (langToggle) {
        langToggle.addEventListener('click', () => {
            const current = localStorage.getItem('language') || 'en';
            const newLang = current === 'en' ? 'hi' : 'en';
            localStorage.setItem('language', newLang);
            langToggle.textContent = newLang === 'hi' ? 'हि' : 'EN';
            langToggle.title = newLang === 'hi' ? 'English' : 'हिंदी';
            applyTranslations(newLang);
        });
    }

    // ==========================================
    // 6. Service Worker Registration (PWA)
    // ==========================================
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
});