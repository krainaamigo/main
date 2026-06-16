// Inicjalizacja bezpiecznego klienta Supabase
// Klucz anonimowy (publiczny) jest bezpieczny, bo baza chroni się sama za pomocą reguł RLS
const supabaseUrl = 'https://eegecpstukwlmlfkbgfh.supabase.co';
const supabaseKey = 'sb_publishable_ZEzgCDMu5JsT48WqcJuBAg_iXjUaxOf';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// CONFIG: Uzupełnij swoimi danymi z Supabase
// ==========================================
let currentLanguage = 'pl';
let translations = {};

// --- 1. POBIERANIE TEKSTÓW Z BAZY SUPABASE ---
async function loadTranslationsFromDB() {
    try {
        // Pobieramy całą tabelę z tekstami z chmury
        let { data, error } = await _supabase.from('translations').select('*');
        
        if (error) throw error;

        // Przekształcamy odpowiedź na płaski słownik klucz -> tekst dla wybranego języka
        translations = {};
        data.forEach(row => {
            translations[row.key] = row[currentLanguage]; 
        });

        // Wstrzykujemy pobrane teksty w elementy HTML na stronie
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[key]) {
                element.textContent = translations[key];
            }
        });

        // Po załadowaniu tekstów odświeżamy widgety zależne od języka
        fetchWeather();
        generateCalendar();

    } catch (error) {
        console.error("Błąd pobierania danych z Supabase:", error.message);
    }
}
loadTranslationsFromDB();

// --- 2. LOGOWANIE ADMINISTRATORA (BEZPIECZNE) ---
async function loginAsAdmin() {
    const email = prompt("Email administratora:");
    const password = prompt("Hasło:");

    if (!email || !password) return;

    // Supabase weryfikuje dane w chmurze i zapisuje token sesji
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Błąd logowania: " + error.message);
        return;
    }

    alert("Zalogowano pomyślnie! Tryb edycji został aktywowany.");
    enableLiveEditing();
}

// --- 3. WŁĄCZENIE TRYBU EDYCJI "LIVE" NA STRONIE ---
function enableLiveEditing() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.setAttribute('contenteditable', 'true');
        
        // Zapis do bazy wywołuje się w momencie, gdy admin kliknie poza edytowane pole (blur)
        el.addEventListener('blur', async (event) => {
            const key = event.target.getAttribute('data-i18n');
            const newText = event.target.textContent.trim();

            const updateData = {};
            updateData[currentLanguage] = newText;

            // Wyślij aktualizację do Supabase
            const { error } = await _supabase
                .from('translations')
                .update(updateData)
                .eq('key', key);

            if (error) {
                alert("Nie udało się zapisać w bazie: " + error.message);
            } else {
                console.log(`Zapisano w chmurze: ${key} -> ${newText}`);
            }
        });
    });
    
    // Pokazujemy pasek informacyjny na dole strony
    const adminBar = document.getElementById('admin-save-bar');
    if (adminBar) {
        adminBar.style.display = 'flex';
        adminBar.innerHTML = "<span>Tryb administratora aktywny. Kliknij dowolny tekst, aby go zmienić. Zmiany zapisują się same!</span>";
    }
}

// --- 4. ZMIANA JĘZYKA STRONY ---
async function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('preferred_language', lang);
    
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${lang}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Pobierz z bazy teksty dla nowo wybranego języka
    await loadTranslationsFromDB();
}

// --- 5. POGODA Z API (Open-Meteo) ---
async function fetchWeather() {
    const lat = 52.1325;
    const lon = 21.0615;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        const isDay = data.current_weather.is_day;

        updateWeatherWidget(temp, code, isDay);
    } catch (error) {
        console.error("Błąd pobierania pogody z API:", error);
        const textSpan = document.getElementById('weather-text');
        if (textSpan) textSpan.textContent = currentLanguage === 'pl' ? "Pogoda niedostępna" : "Weather offline";
    }
}

function updateWeatherWidget(temp, code, isDay) {
    const textSpan = document.getElementById('weather-text');
    const icon = document.getElementById('weather-icon');
    if (!textSpan || !icon) return;
    
    icon.className = "fas"; 

    if (code === 0) {
        icon.classList.add(isDay === 1 ? 'fa-sun' : 'fa-moon');
        icon.style.color = '#f1c40f';
    } else if (code === 1 || code === 2) {
        icon.classList.add(isDay === 1 ? 'fa-cloud-sun' : 'fa-cloud-moon');
        icon.style.color = '#bdc3c7';
    } else if (code === 3) {
        icon.classList.add('fa-cloud');
        icon.style.color = '#95a5a6';
    } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
        icon.classList.add('fa-cloud-showers-heavy');
        icon.style.color = '#3498db';
    } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
        icon.classList.add('fa-snowflake');
        icon.style.color = '#a5f2f3';
    } else if ([95, 96, 99].includes(code)) {
        icon.classList.add('fa-cloud-bolt');
        icon.style.color = '#e67e22';
    } else {
        icon.classList.add('fa-cloud');
        icon.style.color = '#95a5a6';
    }

    let cityName = currentLanguage === 'pl' ? 'Warszawa' : 'Warsaw';
    if (translations && translations.weather_city) {
        cityName = translations.weather_city;
    }

    if (currentLanguage === 'pl') {
        textSpan.textContent = `${cityName}: ${temp}°C`;
    } else {
        const tempF = Math.round((temp * 9/5) + 32);
        textSpan.textContent = `${cityName}: ${tempF}°F`;
    }
}

// --- 6. DYNAMICZNY KALENDARZ ---
function generateCalendar() {
    const container = document.getElementById('calendar-days-container');
    const monthYearHeader = document.getElementById('calendar-month-year');
    if (!container || !monthYearHeader) return;
    
    container.innerHTML = ''; 

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); 
    const todayDate = now.getDate();

    const monthName = now.toLocaleString(currentLanguage === 'pl' ? 'pl-PL' : 'en-US', { month: 'long' });
    monthYearHeader.textContent = `${monthName} ${currentYear}`;

    const daysShort = currentLanguage === 'pl' 
        ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'] 
        : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    daysShort.forEach(day => {
        const dayNameDiv = document.createElement('div');
        dayNameDiv.className = 'cal-day-name';
        dayNameDiv.textContent = day;
        container.appendChild(dayNameDiv);
    });

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const startingPoint = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < startingPoint; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'cal-day empty';
        container.appendChild(emptyDiv);
    }

    const eventDays = [6, 20];

    for (let day = 1; day <= totalDays; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'cal-day';
        dayDiv.textContent = day;

        if (day === todayDate) dayDiv.classList.add('today');

        if (eventDays.includes(day)) {
            dayDiv.classList.add('has-event');
            dayDiv.onclick = () => alert(translations.event_notice || "Event!");
        }
        container.appendChild(dayDiv);
    }
}

// --- 7. OBSŁUGA STRON (ROUTING) ---
function navigateTo(pageId) {
    window.location.hash = pageId;
    renderPage(pageId);
    document.getElementById('mobile-nav').classList.remove('open');
}

function renderPage(pageId) {
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
        const navLink = document.getElementById(`nav-${pageId}`);
        if (navLink) navLink.classList.add('active');
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
}

// --- 8. MENU MOBILNE ---
function toggleMenu() {
    document.getElementById('mobile-nav').classList.toggle('open');
}

// --- 9. LIGHTBOX (GALERIA) ---
let currentImgIndex = 0;
const galleryImages = document.querySelectorAll('.ticket-wrapper');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

galleryImages.forEach((ticket, index) => {
    ticket.addEventListener('click', () => { currentImgIndex = index; openLightbox(ticket.children[0].children[0].src); });
});

function openLightbox(src) {
    if (!lightboxImg || !lightbox) return;
    lightboxImg.src = src; 
    lightbox.classList.add('active'); 
    document.body.style.overflow = 'hidden';
}
function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active'); 
    document.body.style.overflow = 'auto';
}
function changeImage(direction) {
    if (!lightboxImg) return;
    currentImgIndex += direction;
    if (currentImgIndex >= galleryImages.length) currentImgIndex = 0;
    if (currentImgIndex < 0) currentImgIndex = galleryImages.length - 1;
    lightboxImg.src = galleryImages[currentImgIndex].children[0].children[0].src;
}

window.addEventListener('keydown', (e) => {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'ArrowRight') changeImage(1);
    if (e.key === 'ArrowLeft') changeImage(-1);
    if (e.key === 'Escape') closeLightbox();
});
if (lightbox) {
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
}

// --- INICJALIZACJA STARTOWA STRONY ---
window.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferred_language') || 'pl';
    
    // Pierwsze uruchomienie pobierania z bazy danych Supabase
    changeLanguage(savedLang);
    
    const currentHash = window.location.hash.replace('#', '') || 'home';
    renderPage(currentHash);
});

window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash.replace('#', '') || 'home';
    renderPage(currentHash);
});