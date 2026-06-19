// Inicjalizacja bezpiecznego klienta Supabase
// Klucz anonimowy (publiczny) jest bezpieczny, bo baza chroni się sama za pomocą reguł RLS
const supabaseUrl = 'https://eegecpstukwlmlfkbgfh.supabase.co';
const supabaseKey = 'sb_publishable_ZEzgCDMu5JsT48WqcJuBAg_iXjUaxOf';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let isAdmin = false; 

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

        // POZOSTAW TYLKO TO:
        fetchWeather(); 

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

// Nowy, globalny "brudnopis" na zmiany administratora zanim trafią do bazy
let localChanges = {}; 

function enableLiveEditing() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.setAttribute('contenteditable', 'true');
        
        // ZMIANA: Reagujemy na "input" (czyli pisanie), a nie na "blur" (kliknięcie obok)
        el.addEventListener('input', (event) => {
            const key = event.target.getAttribute('data-i18n');
            const newText = event.target.textContent.trim();

            // Zapisujemy zmianę TYLKO lokalnie w pamięci przeglądarki
            localChanges[key] = newText;
            
            // Pokazujemy pasek informacyjny z przyciskami, bo wykryliśmy zmiany
            showAdminBar(true);
        });
    });
    
    // Na start trybu edycji pokazujemy pasek w stanie "Gotowy do edycji"
    showAdminBar(false);
}

// Funkcja zarządzająca wyglądem paska na dole
function showAdminBar(hasChanges) {
    const adminBar = document.getElementById('admin-save-bar');
    if (!adminBar) return;

    adminBar.style.display = 'flex';

    if (hasChanges) {
        adminBar.innerHTML = `
            <span style="color: #f1c40f;">Masz niezapisane zmiany!</span>
            <div class="admin-bar-buttons">
                <button onclick="saveAllChangesToDB()" class="admin-btn save-btn"><i class="fas fa-check"></i> Zapisz zmiany</button>
                <button onclick="cancelAllChanges()" class="admin-btn cancel-btn"><i class="fas fa-times"></i> Anuluj</button>
            </div>
        `;
    } else {
        adminBar.innerHTML = `<span>Tryb edycji aktywny. Kliknij dowolny tekst, aby go zmienić. Zmiany zobaczysz po kliknięciu "Zapisz".</span>`;
    }
}

// 1. FUNKCJA: ZAPISYWANIE WSZYSTKICH ZMIAN NA RAZ (ZBIORCZO)
async function saveAllChangesToDB() {
    const keysToUpdate = Object.keys(localChanges);
    if (keysToUpdate.length === 0) return;

    try {
        // Blokujemy przyciski na czas wysyłania danych, żeby nie kliknąć dwa razy
        document.getElementById('admin-save-bar').innerHTML = `<span><i class="fas fa-spinner fa-spin"></i> Zapisywanie w bazie Supabase...</span>`;

        // Wysyłamy każdą zmianę z brudnopisu do bazy danych
        for (const key of keysToUpdate) {
            const updateData = {};
            updateData[currentLanguage] = localChanges[key];

            const { error } = await _supabase
                .from('translations')
                .update(updateData)
                .eq('key', key);

            if (error) throw error;
        }

        alert("Wszystkie zmiany zostały pomyślnie zapisane w chmurze!");
        localChanges = {}; // Czyszczenie brudnopisu
        showAdminBar(false); // Przywrócenie paska do stanu podstawowego

    } catch (error) {
        alert("Wystąpił błąd podczas zapisu: " + error.message);
        showAdminBar(true); // W razie błędu przywracamy przyciski zapisu
    }
}

// 2. FUNKCJA: ANULOWANIE ZMIAN
function cancelAllChanges() {
    if (confirm("Czy na pewno chcesz odrzucić wszystkie wprowadzone zmiany?")) {
        localChanges = {}; // Czyszczenie brudnopisu
        
        // Wyłączamy tryb edycji i po prostu przeładowujemy teksty z bazy, 
        // co przywróci ich oryginalną zawartość na ekranie
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.removeAttribute('contenteditable');
        });
        
        // Ponownie pobieramy czyste dane z bazy
        loadTranslationsFromDB();
        
        // Ukrywamy pasek (lub resetujemy)
        const adminBar = document.getElementById('admin-save-bar');
        if (adminBar) adminBar.style.display = 'none';
        
        alert("Zmiany zostały odrzucone.");
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
// --- GLOBALNE ZMIENNE DLA KALENDARZA ---
let currentCalendarDate = new Date(); // Przechowuje aktualnie przeglądany miesiąc/rok
let dbEvents = []; // Lista wydarzeń pobrana z Supabase

// --- 1. FUNKCJA: POBIERANIE WYDARZEŃ Z BAZY ---
async function fetchEventsFromDB() {
    try {
        const { data, error } = await _supabase
            .from('events')
            .select('*');
        
        if (error) throw error;
        dbEvents = data || [];
        // Po pobraniu wydarzeń, generujemy kalendarz na nowo
        generateCalendar();
    } catch (err) {
        console.error("Błąd pobierania wydarzeń:", err);
    }
}

// Wywołaj fetchEventsFromDB() przy starcie strony (wewnątrz DOMContentLoaded) zamiast starego generateCalendar()

// --- 2. FUNKCJA: GENEROWANIE INTERAKTYWNEGO KALENDARZA ---
function generateCalendar() {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = {
        pl: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
        en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    };

    const firstDayIndex = new Date(year, month, 1).getDay();
    // Korekta na polski standard (Poniedziałek jako pierwszy dzień tygodnia)
    const startingDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Szablon struktury kalendarza z nagłówkiem i nawigacją
    let html = `
        <div class="calendar-header">
            <button onclick="changeMonth(-1)" class="cal-nav-btn">&lt;</button>
            <span class="calendar-month-title">${monthNames[currentLanguage][month]} ${year}</span>
            <button onclick="changeMonth(1)" class="cal-nav-btn">&gt;</button>
        </div>
        <div class="calendar-grid">
            <div class="day-name">Pn</div><div class="day-name">Wt</div><div class="day-name">Śr</div>
            <div class="day-name">Czw</div><div class="day-name">Pt</div><div class="day-name">Sb</div><div class="day-name">Nd</div>
    `;

    // Puste dni na początku miesiąca
    for (let i = 0; i < startingDay; i++) {
        html += `<div class="day empty"></div>`;
    }

    // Generowanie dni miesiąca
    for (let day = 1; day <= totalDays; day++) {
        // Formatowanie daty do postaci YYYY-MM-DD
        const currentDataStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Szukamy wydarzeń przypisanych do tego dnia
        const dayEvents = dbEvents.filter(e => e.event_date === currentDataStr);
        const hasEvent = dayEvents.length > 0;
        
        // Tytuły dymków (tooltipów)
        let tooltipText = "";
        if (hasEvent) {
            tooltipText = dayEvents.map(e => currentLanguage === 'pl' ? e.title_pl : e.title_en).join(', ');
        }

        let adminEditClass = isAdmin ? 'admin-editable-day' : '';
        let eventClass = hasEvent ? 'has-event' : '';

        html += `
            <div class="day ${eventClass} ${adminEditClass}" 
                 data-date="${currentDataStr}"
                 onmouseenter="showTooltip(event, '${tooltipText}')"
                 onmouseleave="hideTooltip()"
                 onclick="handleDayClick('${currentDataStr}', ${hasEvent})">
                 ${day}
            </div>
        `;
    }

    html += `</div>`;
    
    // Na samym dole kalendarza dodajemy listę opisową aktualnych wydarzeń
    html += `<div id="calendar-events-list"></div>`;
    
    calendarContainer.innerHTML = html;
    updateUnderCalendarList(year, month);
}

// --- 3. NAWIGACJA: ZMIANA MIESIĘCY ---
function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    generateCalendar();
}

// --- 4. DYMKI (TOOLTIPY) PO NAJECHANIU MYSZKĄ ---
function showTooltip(event, text) {
    if (!text) return;
    let tooltip = document.getElementById('calendar-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'calendar-tooltip';
        document.body.appendChild(tooltip);
    }
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('calendar-tooltip');
    if (tooltip) tooltip.style.display = 'none';
}

// --- 5. INFORMACJA O WYDARZENIACH POD KALENDARZEM ---
function updateUnderCalendarList(year, month) {
    const listContainer = document.getElementById('calendar-events-list');
    if (!listContainer) return;

    // Filtrujemy wydarzenia tylko z aktualnie wyświetlanego miesiąca
    const currentMonthEvents = dbEvents.filter(e => {
        const evDate = new Date(e.event_date);
        return evDate.getFullYear() === year && evDate.getMonth() === month;
    });

    if (currentMonthEvents.length === 0) {
        listContainer.innerHTML = `<p class="no-events-info">${currentLanguage === 'pl' ? 'Brak wydarzeń w tym miesiącu.' : 'No events this month.'}</p>`;
        return;
    }

    let listHtml = `<h4>${currentLanguage === 'pl' ? 'Wydarzenia w tym miesiącu:' : 'Events this month:'}</h4><ul>`;
    currentMonthEvents.forEach(e => {
        const day = new Date(e.event_date).getDate();
        const title = currentLanguage === 'pl' ? e.title_pl : e.title_en;
        listHtml += `<li><strong>${day}:</strong> ${title}</li>`;
    });
    listHtml += `</ul>`;
    listContainer.innerHTML = listHtml;
}

// --- 6. OBSŁUGA KLIKNIĘCIA (DLA UŻYTKOWNIKA I DLA ADMINA) ---
async function handleDayClick(dateStr, hasEvent) {
    const dayEvents = dbEvents.filter(e => e.event_date === dateStr);
    
    // TRYB ADMINISTRATORA: Dodawanie, edycja i usuwanie wydarzeń
    if (isAdmin) {
        if (hasEvent) {
            const event = dayEvents[0]; // Edytujemy pierwsze wydarzenie danego dnia
            const action = prompt("Wpisz 'E' aby edytować, 'U' aby usunąć wydarzenie:");
            
            if (action && action.toUpperCase() === 'E') {
                const newTitlePl = prompt("Podaj nową nazwę (PL):", event.title_pl);
                const newTitleEn = prompt("Podaj nową nazwę (EN):", event.title_en);
                if (newTitlePl && newTitleEn) {
                    await _supabase.from('events').update({ title_pl: newTitlePl, title_en: newTitleEn }).eq('id', event.id);
                    alert("Zmieniono wydarzenie!");
                    fetchEventsFromDB(); // Odśwież dane
                }
            } else if (action && action.toUpperCase() === 'U') {
                if (confirm("Czy na pewno chcesz usunąć to wydarzenie?")) {
                    await _supabase.from('events').delete().eq('id', event.id);
                    alert("Usunięto wydarzenie!");
                    fetchEventsFromDB();
                }
            }
        } else {
            // Dodawanie nowego wydarzenia
            const titlePl = prompt("Dodaj nowe wydarzenie (PL):");
            const titleEn = prompt("Dodaj nowe wydarzenie (EN):");
            if (titlePl && titleEn) {
                await _supabase.from('events').insert([{ event_date: dateStr, title_pl: titlePl, title_en: titleEn }]);
                alert("Dodano nowe wydarzenie!");
                fetchEventsFromDB();
            }
        }
    } else {
        // TRYB ZWYKŁEGO UŻYTKOWNIKA: Kliknięcie pokazuje klasyczny alert
        if (hasEvent) {
            const titles = dayEvents.map(e => currentLanguage === 'pl' ? e.title_pl : e.title_en).join('\n');
            alert(`${dateStr}:\n${titles}`);
        }
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
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Pobieramy preferowany język
    const savedLang = localStorage.getItem('preferred_language') || 'pl';
    currentLanguage = savedLang;

    // 2. Ładujemy teksty/tłumaczenia z bazy Supabase
    await loadTranslationsFromDB(); 
    
    // 3. NOWOŚĆ: Ładujemy wydarzenia do kalendarza z nowej tabeli
    await fetchEventsFromDB(); 

    // 4. Obsługa zakładek / podstron
    const currentHash = window.location.hash.replace('#', '') || 'home';
    renderPage(currentHash);
});

window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash.replace('#', '') || 'home';
    renderPage(currentHash);
});