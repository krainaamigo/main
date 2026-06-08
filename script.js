// Globalny stan języka
let currentLanguage = 'pl';

// Słownik tłumaczeń
const i18n = {
    pl: {
        nav_home: "Strona Główna", nav_attractions: "Atrakcje", nav_gallery: "Galeria", nav_offer: "Oferta", nav_contact: "Kontakt",
        home_title: "Witajcie w Krainie Rozrywki Amigo!", home_desc: "Nasze centrum to idealne miejsce dla całych rodzin...",
        gallery_title: "Galeria zdjęć", gallery_desc: "Zobacz zdjęcia (Kliknij, aby powiększyć).",
        sidebar_news: "Informacje Bieżące", sidebar_cal: "Kalendarz Wydarzeń",
        news_1: "Park otwarty dzisiaj do godziny 21:00!",
        weather_city: "Warszawa", event_notice: "Wydarzenie specjalne w tym dniu!"
    },
    en: {
        nav_home: "Home", nav_attractions: "Attractions", nav_gallery: "Gallery", nav_offer: "Offer", nav_contact: "Contact",
        home_title: "Welcome to Amigo Amusement Land!", home_desc: "Our center is the perfect place for whole families...",
        gallery_title: "Photo Gallery", gallery_desc: "See the smiles of our guests (Click on the image to enlarge).",
        sidebar_news: "Current News", sidebar_cal: "Event Calendar",
        news_1: "The park is open today until 9:00 PM!",
        weather_city: "Warsaw", event_notice: "Special event on this day!"
    }
};

async function fetchWeather() {
    const lat = 52.1325;
    const lon = 21.0615;
    // DODALIŚMY parametr &current_weather=true (który w Open-Meteo automatycznie zwraca 'is_day')
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        const isDay = data.current_weather.is_day; // 1 = dzień, 0 = noc

        updateWeatherWidget(temp, code, isDay);
    } catch (error) {
        console.error("Błąd pobierania pogody z API:", error);
        // Awaryjny tekst w razie braku internetu/błędu API
        const textSpan = document.getElementById('weather-text');
        if (textSpan) textSpan.textContent = currentLanguage === 'pl' ? "Pogoda niedostępna" : "Weather offline";
    }
}

function updateWeatherWidget(temp, code, isDay) {
    const textSpan = document.getElementById('weather-text');
    const icon = document.getElementById('weather-icon');
    if (!textSpan || !icon) return;
    
    icon.className = "fas"; // Czyszczenie poprzednich ikon

    // --- LOGIKA IKON I ZACHMURZENIA ---
    
    // KOD 0: Idealnie czyste niebo
    if (code === 0) {
        if (isDay === 1) {
            icon.classList.add('fa-sun');
            icon.style.color = '#f1c40f'; // Żółte słońce
        } else {
            icon.classList.add('fa-moon');
            icon.style.color = '#f1c40f'; // Żółty księżyc
        }
    }
    // KODY 1, 2: Częściowe zachmurzenie (lekkie chmurki)
    else if (code === 1 || code === 2) {
        if (isDay === 1) {
            icon.classList.add('fa-cloud-sun');
            icon.style.color = '#bdc3c7'; // Słońce za chmurą
        } else {
            icon.classList.add('fa-cloud-moon');
            icon.style.color = '#bdc3c7'; // Księżyc za chmurą
        }
    }
    // KOD 3: Całkowite zachmurzenie (gęste chmury, ponuro)
    else if (code === 3) {
        icon.classList.add('fa-cloud');
        icon.style.color = '#95a5a6'; // Szary, bury kolor
    }
    // KODY 51-65 oraz 80-82: Opady deszczu
    else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
        icon.classList.add('fa-cloud-showers-heavy');
        icon.style.color = '#3498db'; // Niebieski deszcz
    }
    // KODY 71-77 oraz 85-86: Opady śniegu
    else if ([71, 73, 75, 77, 85, 86].includes(code)) {
        icon.classList.add('fa-snowflake');
        icon.style.color = '#a5f2f3'; // Lodowy błękit
    }
    // KODY 95-99: Burza
    else if ([95, 96, 99].includes(code)) {
        icon.classList.add('fa-cloud-bolt');
        icon.style.color = '#e67e22'; // Pomarańczowy piorun
    }
    // Awaryjny restart ikony w razie nieznanego kodu z API
    else {
        icon.classList.add('fa-cloud');
        icon.style.color = '#95a5a6';
    }

    // --- BEZPIECZNE GENEROWANIE TEKSTU (Z ZABEZPIECZENIEM PRZED "ERROR") ---
    // Definiujemy awaryjną nazwę miasta, jeśli plik JSON jeszcze się nie wczytał
    let cityName = currentLanguage === 'pl' ? 'Warszawa' : 'Warsaw';
    
    // Jeśli plik JSON działa i ma klucz, podmień na ten z pliku
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

// --- 2. DYNAMICZNY KALENDARZ ---
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
            dayDiv.onclick = () => alert(i18n[currentLanguage].event_notice);
        }
        container.appendChild(dayDiv);
    }
}

// --- 3. OBSŁUGA STRON (ROUTING #) ---
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
        document.getElementById(`nav-${pageId}`).classList.add('active');
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
}

// --- 4. ZMIANA JĘZYKA ---
function changeLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('preferred_language', lang);
    
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${lang}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (i18n[lang][key]) {
            element.textContent = i18n[lang][key];
        }
    });

    fetchWeather();
    generateCalendar();
}

// --- 5. MENU MOBILNE ---
function toggleMenu() {
    document.getElementById('mobile-nav').classList.toggle('open');
}

// --- 6. POWIĘKSZANIE ZDJĘĆ (LIGHTBOX) ---
let currentImgIndex = 0;
const galleryImages = document.querySelectorAll('.gallery-img');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

galleryImages.forEach((img, index) => {
    img.addEventListener('click', () => { currentImgIndex = index; openLightbox(img.src); });
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
    lightboxImg.src = galleryImages[currentImgIndex].src;
}

// Eventy klawiatury dla galerii i kliknięcia w tło
window.addEventListener('keydown', (e) => {
    if (!lightbox || !lightbox.classList.contains('active')) return;
    if (e.key === 'ArrowRight') changeImage(1);
    if (e.key === 'ArrowLeft') changeImage(-1);
    if (e.key === 'Escape') closeLightbox();
});
if (lightbox) {
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
}

// --- INICJALIZACJA STARTOWA ---
window.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferred_language') || 'pl';
    changeLanguage(savedLang);
    const currentHash = window.location.hash.replace('#', '') || 'home';
    renderPage(currentHash);
});

window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash.replace('#', '') || 'home';
    renderPage(currentHash);
});