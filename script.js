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
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${currentLanguage}`);
    if (activeBtn) activeBtn.classList.add('active');

    try {
        let { data, error } = await _supabase.from('translations').select('*');        
        if (error) {throw error;}

        // Przekształcamy odpowiedź
        translations = {};
        data.forEach(row => {
            // Diagnostyka nazw kolumn
            if (row.key === undefined) {
                console.error("BŁĄD: Twoja tabela nie ma kolumny o nazwie 'key'! Sprawdź wielkość liter w Supabase.", row);
            }
            translations[row.key] = row[currentLanguage]; 
        });

        // Wstrzykujemy pobrane teksty
        let injectedCount = 0;
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations && translations[key] !== undefined) {
                element.textContent = translations[key];
                injectedCount++;
            }
        });

    } catch (error) {
        console.error("Krytyczny błąd pobierania danych:", error.message);
    }
}

// --- 2. LOGOWANIE ADMINISTRATORA (BEZPIECZNE) ---
// async function loginAsAdmin() {
//     const email = prompt("Email administratora:");
//     const password = prompt("Hasło:");

//     if (!email || !password) return;

//     // Supabase weryfikuje dane w chmurze i zapisuje token sesji
//     const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

//     if (error) {
//         alert("Błąd logowania: " + error.message);
//         return;
//     }

//     alert("Zalogowano pomyślnie! Tryb edycji został aktywowany.");
    
//     isAdmin = true; 
    
//     enableLiveEditing();
//     generateCalendar();
//     fetchAlbums();
// }

function loginAsAdmin() {
    const modal = document.getElementById('admin-login-modal');
    const emailInput = document.getElementById('admin-email-input');
    const passwordInput = document.getElementById('admin-password-input');
    
    if (modal && passwordInput && emailInput) {
        emailInput.value = ""; // Czyszczenie pola email
        passwordInput.value = ""; // Czyszczenie hasła
        passwordInput.type = "password"; 
        
        const icon = document.getElementById('toggle-password-icon');
        if (icon) { icon.className = "fas fa-eye"; } 
        
        modal.style.display = 'flex'; 
        emailInput.focus(); // Ustawiamy kursor od razu na polu e-mail
        
        // Obsługa logowania po kliknięciu ENTER w polu hasła
        passwordInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                submitAdminLogin();
            }
        };
        // Obsługa przechodzenia do hasła po kliknięciu ENTER w polu email
        emailInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                passwordInput.focus();
            }
        };
    }
}

// 2. FUNKCJA ZAMYKANIA OKIENKA
function closeAdminLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) { modal.style.display = 'none'; }
}

// 3. FUNKCJA PRZEŁĄCZANIA WIDOCZNOŚCI HASŁA (Oko / Przekreślone oko)
function togglePasswordVisibility() {
    const input = document.getElementById('admin-password-input');
    const icon = document.getElementById('toggle-password-icon');
    
    if (input && icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash'; // Zmiana na ikonę przekreślonego oka
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye'; // Zmiana z powrotem na normalne oko
        }
    }
}

// 4. FUNKCJA ZATWIERDZENIA I SPRAWDZENIA HASŁA
async function submitAdminLogin() {
    const emailInput = document.getElementById('admin-email-input');
    const passwordInput = document.getElementById('admin-password-input');
    if (!emailInput || !passwordInput) return;
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        alert("E-mail oraz hasło nie mogą być puste.");
        return;
    }

    const userAgent = navigator.userAgent;
    
    try {
        // Przekazujemy wpisany przez Ciebie email oraz hasło do bazy danych
        const { data, error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            try {
                await _supabase.from('login_history').insert([{
                    email: email,
                    device_info: userAgent,
                    logged_at: new Date().toISOString(),
                    successful: false
                }]);
            } catch (dbErr) {
                console.error("Nie udało się zapisać logu do bazy (prawdopodobnie RLS):", dbErr);
            }
            alert("Błędny e-mail lub hasło administratora!");
            passwordInput.value = "";
            passwordInput.focus();
        } else {
            isAdmin = true;
            closeAdminLoginModal(); 
            enableLiveEditing();
            generateCalendar();
            fetchAlbums();

            await _supabase.from('login_history').insert([{
                email: email,
                device_info: userAgent,
                logged_at: new Date().toISOString(),
                successful: true
            }]);
            alert("Zalogowano jako administrator.");
        }
    } catch (err) {
        await _supabase.from('login_history').insert([{
            email: email,
            device_info: userAgent,
            logged_at: new Date().toISOString(),
            successful: false
        }]);
        alert("Błąd logowania: " + err.message);
    }
}

// --- FUNKCJA WYLOGOWANIA DLA ADMINISTRATORA ---
async function logoutAdmin() {
    if (confirm("Czy chcesz wyjść z trybu administratora i się wylogować?")) {
        try {
            await _supabase.auth.signOut();
            isAdmin = false;
            localChanges = {};
            
            // Ukrywamy pasek edycji
            const adminBar = document.getElementById('admin-save-bar');
            if (adminBar) adminBar.style.display = 'none';

            document.querySelectorAll('.admin-photo-buttons').forEach(el => el.style.display = 'none');
            // Usuwamy możliwość edycji z pól tekstowych
            document.querySelectorAll('[data-i18n]').forEach(el => {
                el.removeAttribute('contenteditable');
            });

            alert("Wylogowano pomyślnie.");
            
            // Przeładowujemy dane i kalendarz, aby wrócić do widoku klienta
            await loadTranslationsFromDB();
            await fetchNewsFromDB();
            await fetchEventsFromDB();            
            await fetchAlbums();
            await fetchPricingFromDB();      
        } catch (error) {
            alert("Błąd podczas wylogowywania: " + error.message);
        }
    }
}

// Nowy, globalny "brudnopis" na zmiany administratora zanim trafią do bazy
let localChanges = {}; 

function enableLiveEditing() {
    document.querySelectorAll('.admin-photo-buttons').forEach(el => el.style.display = 'flex');
    document.getElementById('admin-pricing-control').style.display = 'block';
    fetchPricingFromDB(); // Przeładuje cennik, aby pokazać ikonki edycji i kosza

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.setAttribute('contenteditable', 'true');
        
        el.addEventListener('input', (event) => {
            const key = event.target.getAttribute('data-i18n');
            const newText = event.target.textContent.trim();
            localChanges[key] = newText;
            showAdminBar(true);
        });
    });
    
    // Pokazujemy pasek edycji na dole
    showAdminBar(false);
    
    // Dodatkowo wymuszamy przebudowanie kalendarza w trybie admina
    renderNews();
    generateCalendar();
    fetchAlbums();
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
        adminBar.innerHTML = `
            <span>Tryb edycji aktywny. Kliknij dowolny tekst, aby go zmienić.</span>
            <div class="admin-bar-buttons">
                <button onclick="logoutAdmin()" class="admin-btn cancel-btn" style="background: #95a5a6;"><i class="fas fa-sign-out-alt"></i> Wyloguj</button>
            </div>
        `;
    }
}

// 1. FUNKCJA: ZAPISYWANIE WSZYSTKIAN ZMIAN NA RAZ (ZBIORCZO)
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

        // Przeładowujemy napisy po zapisie
        await loadTranslationsFromDB();

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
    
    // Pobierz z bazy teksty dla nowo wybranego języka
    await loadTranslationsFromDB();
    // Odśwież kalendarz pod nowy język
    await generateCalendar();
    // Odśwież pogodę
    await fetchWeather();
    await fetchNewsFromDB();
    await fetchAlbums();
    await fetchPricingFromDB();
}

// --- 5. POGODA Z API (Open-Meteo) ---
async function fetchWeather() {
    const lat = 52.1325;
    const lon = 21.0615;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data || !data.current_weather) throw new Error("Brak danych pogodowych");
        
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
    if (translations && translations['weather_city']) {
        cityName = translations['weather_city'];
    }

    if (currentLanguage === 'pl') {
        textSpan.textContent = `${cityName}: ${temp}°C`;
    } else {
        const tempF = Math.round((temp * 9/5) + 32);
        textSpan.textContent = `${cityName}: ${tempF}°F`;
    }
}



// Lista klas ikon z FontAwesome dostępnych do kliknięcia
const AVAILABLE_ICONS = [
    "fa-bullhorn", "fa-exclamation-triangle", "fa-info-circle", "fa-star", 
    "fa-gift", "fa-clock", "fa-calendar-alt", "fa-fire", 
    "fa-envelope", "fa-phone", "fa-map-marker-alt", "fa-heart",
    "fa-check-circle", "fa-times-circle", "fa-lightbulb", "fa-graduation-cap"
];

// Automatyczne wstrzyknięcie stylów CSS dla naszego okienka wyboru ikon
const style = document.createElement('style');
style.textContent = `
    .icon-picker-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.6); display: flex; align-items: center;
        justify-content: center; z-index: 9999;
    }
    .icon-picker-window {
        background: #fff; padding: 20px; border-radius: 8px; max-width: 400px;
        width: 90%; box-shadow: 0 4px 15px rgba(0,0,0,0.3); text-align: center;
        font-family: 'Poppins', sans-serif; color: #333;
    }
    .icon-picker-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;
        margin: 20px 0; max-height: 250px; overflow-y: auto; padding: 5px;
    }
    .icon-picker-item {
        font-size: 24px; padding: 10px; border: 1px solid #eee;
        border-radius: 6px; cursor: pointer; transition: all 0.2s; color: #2c3e50;
    }
    .icon-picker-item:hover {
        background: #3498db; color: #fff; border-color: #3498db; transform: scale(1.1);
    }
    .icon-picker-cancel {
        background: #95a5a6; color: white; border: none; padding: 8px 15px;
        border-radius: 4px; cursor: pointer; font-size: 14px;
    }
    .icon-picker-cancel:hover { background: #7f8c8d; }
`;
document.head.appendChild(style);

function openIconPicker() {
    return new Promise((resolve) => {
        // Tworzymy tło okienka
        const overlay = document.createElement('div');
        overlay.className = 'icon-picker-overlay';

        // Budujemy zawartość okienka
        let gridHtml = '';
        AVAILABLE_ICONS.forEach(iconClass => {
            gridHtml += `<div class="icon-picker-item" data-icon="${iconClass}"><i class="fas ${iconClass}"></i></div>`;
        });

        overlay.innerHTML = `
            <div class="icon-picker-window">
                <h4 style="margin: 0 0 10px 0;">${currentLanguage === 'pl' ? 'Wybierz ikonę ogłoszenia' : 'Select notice icon'}</h4>
                <div class="icon-picker-grid">${gridHtml}</div>
                <button class="icon-picker-cancel">${currentLanguage === 'pl' ? 'Anuluj' : 'Cancel'}</button>
            </div>
        `;

        document.body.appendChild(overlay);

        // Obsługa kliknięcia w ikonę
        overlay.querySelectorAll('.icon-picker-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const selectedIcon = e.currentTarget.getAttribute('data-icon');
                overlay.remove(); // Usuwamy okienko z ekranu
                resolve(selectedIcon); // Zwracamy wybraną ikonę
            });
        });

        // Obsługa przycisku Anuluj
        overlay.querySelector('.icon-picker-cancel').addEventListener('click', () => {
            overlay.remove();
            resolve(null); // Zwracamy null (brak zmian)
        });
    });
}

// --- GLOBALNE ZMIENNE DLA NEWSÓW ---
let dbNews = []; // Lista informacji pobrana z Supabase

// 1. POBIERANIE NEWSÓW Z BAZY
async function fetchNewsFromDB() {
    try {
        const { data, error } = await _supabase
            .from('news')
            .select('*');
        
        if (error) throw error;
        dbNews = data || [];
        renderNews();
    } catch (err) {
        console.error("Błąd pobierania informacji bieżących:", err);
    }
}

// 2. RENDEROWANIE NEWSÓW NA STRONIE
function renderNews() {
    const container = document.getElementById('news-container');
    if (!container) return;

    if (dbNews.length === 0) {
        container.innerHTML = `<li><i class="fas fa-info-circle"></i> <span>${currentLanguage === 'pl' ? 'Brak nowych informacji.' : 'No new updates.'}</span></li>`;
        
        // Jeśli zalogowany admin – dodajemy przycisk dodawania nawet do pustej listy
        if (isAdmin) {
            container.innerHTML += `
                <li class="admin-add-news" onclick="handleNewsClick(null)" style="cursor:pointer; color:#2ecc71; list-style:none; margin-top:10px;">
                    <i class="fas fa-plus-circle"></i> <strong>${currentLanguage === 'pl' ? '[Dodaj nową informację]' : '[Add new notice]'}</strong>
                </li>`;
        }
        return;
    }

    let html = "";
    dbNews.forEach(item => {
        const text = currentLanguage === 'pl' ? item.text_pl : item.text_en;
        const iconClass = item.icon ? item.icon : 'fa-bullhorn';
        const adminClass = isAdmin ? 'admin-editable-news' : '';

        // Ważne: Jeśli isAdmin jest true, dodajemy cursor: pointer i ramkę, aby było widać, że można klikać
        html += `
            <li class="${adminClass}" onclick="handleNewsClick('${item.id}')" style="${isAdmin ? 'cursor:pointer; border-left: 2px dashed #f1c40f; padding-left:8px; margin-bottom:8px;' : ''}">
                <i class="fas ${iconClass}"></i> <span>${text}</span>
            </li>
        `;
    });

    // Jeśli zalogowany admin – doklejamy na samym dole przycisk szybkiego dodawania
    if (isAdmin) {
        html += `
            <li onclick="handleNewsClick(null)" style="cursor:pointer; color:#2ecc71; list-style:none; margin-top:10px;">
                <i class="fas fa-plus-circle"></i> <strong>${currentLanguage === 'pl' ? '[Dodaj nową informację]' : '[Add new notice]'}</strong>
            </li>`;
    }

    container.innerHTML = html;
}

// 3. OBSŁUGA INTERAKCJI ADMIN / UŻYTKOWNIK
async function handleNewsClick(newsId) {
    if (!isAdmin) return;
    console.log(newsId)

    // TRYB DODAWANIA NOWEGO NEWSU
    if (newsId === null) {
        const textPl = prompt("Podaj treść informacji (PL):");
        if (!textPl) return; // Jeśli anulowano, przerywamy
        
        const textEn = prompt("Podaj treść informacji (EN):");
        if (!textEn) return;

        // OTWIERAMY GRAFICZNE OKIENKO WYBORU IKONY
        const icon = await openIconPicker(); // || "fa-bullhorn"; 

        if (!icon) return; 

        const { error } = await _supabase.from('news').insert([{ text_pl: textPl, text_en: textEn, icon: icon }]);
        if (!error) {
            alert("Dodano nową informację!");
            fetchNewsFromDB();
        } else {
            alert("Błąd dodawania: " + error.message);
        }
        return;
    }
    console.log("Tu dotarło")
    // TRYB EDYCJI LUB USUNIĘCIA
    const currentItem = dbNews.find(n => n.id === newsId);
    console.log(currentItem)
    if (!currentItem) return;

    const action = prompt("Wpisz 'E' aby edytować, 'U' aby usunąć tę informację:");
    if (!action) return;

    if (action.toUpperCase() === 'E') {
        const newTextPl = prompt("Edytuj treść (PL):", currentItem.text_pl);
        if (!newTextPl) return;

        const newTextEn = prompt("Edytuj treść (EN):", currentItem.text_en);
        if (!newTextEn) return;

        // OTWIERAMY GRAFICZNE OKIENKO WYBORU IKONY PRZY EDYCJI
        const newIcon = await openIconPicker() || currentItem.icon; // Jeśli anulowano, zachowuje starą

        const { error } = await _supabase.from('news').update({ text_pl: newTextPl, text_en: newTextEn, icon: newIcon }).eq('id', newsId);
        if (!error) {
            alert("Zaktualizowano informację!");
            fetchNewsFromDB();
        }
    } else if (action.toUpperCase() === 'U') {
        if (confirm("Czy na pewno chcesz usunąć tę informację z panelu?")) {
            const { error } = await _supabase.from('news').delete().eq('id', newsId);
            if (!error) {
                alert("Usunięto informację!");
                fetchNewsFromDB();
            }
        }
    }
}

// --- 6. DYNAMICZNY KALENDARZ ---
let currentCalendarDate = new Date(); 
let dbEvents = []; 

// --- 1. FUNKCJA: POBIERANIE WYDARZEŃ Z BAZY ---
async function fetchEventsFromDB() {
    try {
        const { data, error } = await _supabase
            .from('events')
            .select('*');
        
        if (error) throw error;
        dbEvents = data || [];
        generateCalendar();
    } catch (err) {
        console.error("Błąd pobierania wydarzeń:", err);
    }
}

// --- 2. FUNKCJA: GENEROWANIE INTERAKTYWNEGO KALENDARZA ---
function generateCalendar() {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // 1. POBIERAMY AKTUALNĄ DATĘ SYSTEMOWĄ DO PORÓWNANIA
    const today = new Date();
    const isCurrentYear = today.getFullYear() === year;
    const isCurrentMonth = today.getMonth() === month;

    const monthNames = {
        pl: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
        en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    };

    const firstDayIndex = new Date(year, month, 1).getDay();
    const startingDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    const totalDays = new Date(year, month + 1, 0).getDate();

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

    for (let i = 0; i < startingDay; i++) {
        html += `<div class="day empty"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
        const currentDataStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = dbEvents.filter(e => e.event_date === currentDataStr);
        const hasEvent = dayEvents.length > 0;
        
        let tooltipText = "";
        if (hasEvent) {
            tooltipText = dayEvents.map(e => currentLanguage === 'pl' ? e.title_pl : e.title_en).join(', ');
        }

        let adminEditClass = isAdmin ? 'admin-editable-day' : '';
        let eventClass = hasEvent ? 'has-event' : '';
        
        // 2. SPRAWDZAMY, CZY TEN KONKRETNY DZIEŃ TO DZISIAJ
        let todayClass = (isCurrentYear && isCurrentMonth && today.getDate() === day) ? 'today' : '';

        // 3. DODAJEMY ${todayClass} DO LISTY KLAS ELEMENTU DIV
        html += `
            <div class="day ${eventClass} ${adminEditClass} ${todayClass}" 
                 data-date="${currentDataStr}"
                 onmouseenter="showTooltip(event, '${tooltipText}')"
                 onmouseleave="hideTooltip()"
                 onclick="handleDayClick('${currentDataStr}', ${hasEvent})">
                 ${day}
            </div>
        `;
    }

    html += `</div>`;
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
    
    if (isAdmin) {
        if (hasEvent) {
            const event = dayEvents[0]; 
            const action = prompt("Wpisz 'E' aby edytować, 'U' aby usunąć wydarzenie:");
            
            if (action && action.toUpperCase() === 'E') {
                const newTitlePl = prompt("Podaj nową nazwę (PL):", event.title_pl);
                const newTitleEn = prompt("Podaj nową nazwę (EN):", event.title_en);
                if (newTitlePl && newTitleEn) {
                    await _supabase.from('events').update({ title_pl: newTitlePl, title_en: newTitleEn }).eq('id', event.id);
                    alert("Zmieniono wydarzenie!");
                    fetchEventsFromDB(); 
                }
            } else if (action && action.toUpperCase() === 'U') {
                if (confirm("Czy na pewno chcesz usunąć to wydarzenie?")) {
                    await _supabase.from('events').delete().eq('id', event.id);
                    alert("Usunięto wydarzenie!");
                    fetchEventsFromDB();
                }
            }
        } else {
            const titlePl = prompt("Dodaj nowe wydarzenie (PL):");
            const titleEn = prompt("Dodaj nowe wydarzenie (EN):");
            if (titlePl && titleEn) {
                await _supabase.from('events').insert([{ event_date: dateStr, title_pl: titlePl, title_en: titleEn }]);
                alert("Dodano nowe wydarzenie!");
                fetchEventsFromDB();
            }
        }
    } else {
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

let currentActiveAlbumId = null;
let currentAlbumPhotos = [];
let currentPhotoIndex = 0;

// ==========================================
// 1. OBSŁUGA ZDJĘĆ NA STRONIE GŁÓWNEJ (DODAJ/USUŃ)
// ==========================================

// Pomocnicza funkcja do wgrywania pliku do Supabase Storage
async function uploadFileToStorage(file, folder = "main") {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { data, error } = await _supabase.storage
        .from('gallery')
        .upload(fileName, file);
        
    if (error) throw error;
    
    // Pobieramy publiczny URL wgranego pliku
    const { data: { publicUrl } } = _supabase.storage.from('gallery').getPublicUrl(fileName);
    return publicUrl;
}


// 1. UNIWERSALNE WGRYWANIE/AKTUALIZACJA ZDJĘCIA
async function uploadManagedPhoto(buttonElement) {
    if (!isAdmin) return;
    
    const zone = buttonElement.closest('.photo-management-zone');
    const imgElement = zone.querySelector('.managed-photo');
    if (!imgElement) return;

    const dbTable = imgElement.getAttribute('data-db-table');
    const rowId = parseInt(imgElement.getAttribute('data-db-id')); // Konwertujemy na liczbę

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const photoUrl = await uploadFileToStorage(file, "dynamic_pages");
            
            // ZAMIANA .update() NA .upsert() -> Inteligentny zapis/aktualizacja
            const { error } = await _supabase
                .from(dbTable)
                .upsert({ id: rowId, photo_url: photoUrl }); // Przekazujemy też ID, żeby wiedział który wiersz stworzyć/zaktualizować
                
            if (error) throw error;
            
            imgElement.src = photoUrl;
            imgElement.style.display = "block";
            alert("Zdjęcie zostało zapisane w bazie danych i zaktualizowane!");
        } catch (err) {
            alert("Błąd zapisu w bazie danych: " + err.message);
        }
    };
    input.click();
}

// 2. UNIWERSALNE USUWANIE ZDJĘCIA
async function deleteManagedPhoto(buttonElement) {
    if (!isAdmin) return;
    if (!confirm("Czy na pewno chcesz usunąć to zdjęcie?")) return;

    const zone = buttonElement.closest('.photo-management-zone');
    const imgElement = zone.querySelector('.managed-photo');
    if (!imgElement) return;

    const dbTable = imgElement.getAttribute('data-db-table');
    const rowId = imgElement.getAttribute('data-db-id');

    try {
        const { error } = await _supabase
            .from(dbTable)
            .update({ photo_url: null })
            .eq('id', rowId);
            
        if (error) throw error;
        
        imgElement.src = "";
        imgElement.style.display = "none";
        alert("Zdjęcie usunięte.");
    } catch (err) {
        alert("Błąd usuwania: " + err.message);
    }
}

// AUTOMATYCZNE ŁADOWANIE WSZYSTKICH ZDJĘĆ Z BAZY
async function loadAllManagedPhotos() {
    const allPhotos = document.querySelectorAll('.managed-photo');
    
    // Przechodzimy po każdym znalezionym obrazku na stronie
    for (const img of allPhotos) {
        const dbTable = img.getAttribute('data-db-table');
        const rowId = img.getAttribute('data-db-id');
        
        try {
            // Pytamy bazę danych dynamicznie o konkretną tabelę i ID
            const { data, error } = await _supabase
                .from(dbTable)
                .select('photo_url')
                .eq('id', rowId)
                .maybeSingle(); // maybeSingle zapobiega wywaleniu błędu gdy wiersz jeszcze nie istnieje
                
            if (!error && data && data.photo_url) {
                img.src = data.photo_url;
                img.style.display = "block"; // Pokazujemy zdjęcie, bo jest w bazie
            } else {
                img.src = "";
                img.style.display = "none"; // Ukrywamy, jeśli pole w bazie jest puste
            }
        } catch (e) {
            console.error("Błąd ładowania zdjęcia dla", dbTable, rowId, e);
        }
    }
}


// ==========================================
// 2. ALBUMY W GALERII (STYLE INSTAX)
// ==========================================

// Pobieranie albumów i renderowanie
async function fetchAlbums() {
    try {
        const { data: albums, error } = await _supabase.from('albums').select('*');
        if (error) throw error;
        
        const container = document.getElementById('albums-container');
        if (!container) return;
        
        let html = "";
        
        // Przycisk dodawania albumu dla admina
        if (isAdmin) {
            html += `
                <div class="instax-folder" onclick="createNewAlbum()" style="border: 2px dashed #2ecc71; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:250px;">
                    <i class="fas fa-plus-circle" style="font-size:40px; color:#2ecc71; margin-bottom:10px;"></i>
                    <span style="color:#2ecc71; font-weight:bold;">Stwórz nowy album</span>
                </div>
            `;
        }
        
        albums.forEach(album => {
            const title = currentLanguage === 'pl' ? album.title_pl : album.title_en;
            html += `
                <div class="instax-folder" onclick="openAlbum('${album.id}', '${title}')">
                    <img src="${album.cover_url || 'https://via.placeholder.com/300?text=Pusty+Album'}" class="instax-cover">
                    <div class="instax-title">${title}</div>
                    ${isAdmin ? `
                        <div class="admin-album-actions" onclick="event.stopPropagation()">
                            <button class="admin-mini-btn" onclick="deleteAlbum('${album.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
    }
}

// Tworzenie nowego albumu przez admina
async function createNewAlbum() {
    // 1. Tworzymy input na plik w locie
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    // 2. Najpierw definiujemy co się stanie, GDY użytkownik wybierze już zdjęcie
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return; // Jeśli zamknął okno bez wyboru, przerywamy
        
        // 3. Dopiero PO wybraniu zdjęcia pytamy o tytuł (bezpieczna kolejność)
        const title_pl = prompt("Podaj tytuł nowego albumu po polsku (podpis na Instaxie):");
        if (!title_pl || title_pl.trim() === "") {
            alert("Anulowano tworzenie albumu (brak tytułu po polsku).");
            return; 
        }

        const title_en = prompt("Podaj tytuł nowego albumu po angielsku (podpis na Instaxie):");
        if (!title_en || title_en.trim() === "") {
            alert("Anulowano tworzenie albumu (brak tytułu po angielsku).");
            return; 
        }
        
        try {
            alert("Wgrywanie okładki na serwer Supabase...");
            const coverUrl = await uploadFileToStorage(file, "covers");
            
            // Zapisujemy nowy album w bazie danych
            const { error } = await _supabase.from('albums').insert([{ title_pl: title_pl.trim(), title_en: title_pl.trim(), cover_url: coverUrl }]);
            if (!error) {
                alert("Album stworzony pomyślnie!");
                fetchAlbums(); // Odświeżamy widok galerii
            } else throw error;
        } catch (err) {
            alert("Błąd podczas tworzenia albumu: " + err.message);
        }
    };
    
    // 4. KLUCZOWY MOMENT: Wywołujemy okno wyboru pliku NATYCHMIAST. 
    // Przeglądarka widzi, że to bezpośredni skutek kliknięcia w przycisk "Stwórz nowy album".
    input.click();
}

// Usuwanie całego albumu
async function deleteAlbum(albumId) {
    if (!confirm("Czy na pewno chcesz usunąć ten album wraz ze WSZYSTKIMI zdjęciami w środku?")) return;
    
    try {
        // RLS i kaskada powinny wyczyścić zdjęcia, ale dla pewności usuwamy powiązania
        await _supabase.from('album_photos').delete().eq('album_id', albumId);
        await _supabase.from('albums').delete().eq('id', albumId);
        alert("Album usunięty.");
        fetchAlbums();
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================
// 3. WIDOK PROFILU ALBUMU (SERIA ZDJĘĆ)
// ==========================================

async function openAlbum(albumId, albumTitle) {
    currentActiveAlbumId = albumId;
    
    // Ustawiamy tytuł albumu w nagłówku okna modalnego
    document.getElementById('modal-album-title').innerText = albumTitle;
    
    // Pokazujemy okno modalne (zmieniamy na flex, żeby zadziałało wyśrodkowanie z CSS)
    const modal = document.getElementById('album-preview-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
    
    // Jeśli zalogowany admin – pokazujemy panel dodawania zdjęć wewnątrz modala
    const adminZone = document.getElementById('admin-add-photo-zone');
    if (adminZone) {
        adminZone.style.display = isAdmin ? 'block' : 'none';
    }
    
    // Pobieramy i renderujemy zdjęcia dla tego albumu
    fetchAlbumPhotos(albumId);
}

// Funkcja wywoływana po kliknięciu krzyżyka (X) lub tła
function closeAlbumModal() {
    const modal = document.getElementById('album-preview-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function fetchAlbumPhotos(albumId) {
    const { data: photos, error } = await _supabase.from('album_photos').select('*').eq('album_id', albumId);
    if (error) return;
    
    currentAlbumPhotos = photos || [];
    const grid = document.getElementById('album-photos-grid');
    
    let html = "";
    currentAlbumPhotos.forEach((photo, index) => {
        html += `
            <div class="photo-item" style="position:relative; display:inline-block; margin:5px;">
                <img src="${photo.photo_url}" onclick="openFullscreenPhoto(${index})" style="width:120px; height:120px; object-fit:cover; cursor:pointer; border-radius:4px;">
                ${isAdmin ? `<button onclick="deletePhotoFromAlbum(${photo.id})" style="position:absolute; top:2px; right:2px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer;">&times;</button>` : ''}
            </div>
        `;
    });
    grid.innerHTML = html;
}

// Wgrywanie wielu zdjęć na raz do otwartego albumu
async function uploadPhotosToAlbum() {
    const fileInput = document.getElementById('album-photo-input');
    const files = fileInput.files;
    if (files.length === 0) return;
    
    alert(`Rozpoczynam wgrywanie ${files.length} zdjęć...`);
    
    for (let i = 0; i < files.length; i++) {
        try {
            const url = await uploadFileToStorage(files[i], `album_${currentActiveAlbumId}`);
            await _supabase.from('album_photos').insert([{ album_id: currentActiveAlbumId, photo_url: url }]);
        } catch (err) {
            console.error("Błąd przy pliku " + files[i].name, err);
        }
    }
    
    alert("Zakończono wgrywanie zdjęć.");
    fetchAlbumPhotos(currentActiveAlbumId);
}

async function deletePhotoFromAlbum(photoId) {
    if (!confirm("Usunąć to zdjęcie z albumu?")) return;
    await _supabase.from('album_photos').delete().eq('id', photoId);
    fetchAlbumPhotos(currentActiveAlbumId);
}

// ==========================================
// 4. PEŁNE POWIĘKSZENIE Z PRZEWIJANIEM (Jak przy atrakcjach)
// ==========================================

function openFullscreenPhoto(index) {
    currentPhotoIndex = index;
    
    // Tworzymy dynamiczny lightbox na całe okno przeglądarki
    const lightbox = document.createElement('div');
    lightbox.id = 'gallery-lightbox';
    lightbox.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:10000; display:flex; align-items:center; justify-content:center;';
    
    lightbox.innerHTML = `
        <span onclick="document.getElementById('gallery-lightbox').remove()" style="position:absolute; top:20px; right:30px; color:white; font-size:40px; cursor:pointer;">&times;</span>
        <button onclick="navigatePhoto(-1)" style="position:absolute; left:20px; background:none; border:none; color:white; font-size:40px; cursor:pointer;"><i class="fas fa-chevron-left"></i></button>
        <img id="gallery-lightbox-img" src="${currentAlbumPhotos[currentPhotoIndex].photo_url}" style="max-width:85%; max-height:85%; object-fit:contain; box-shadow:0 0 20px rgba(255,255,255,0.2);">
        <button onclick="navigatePhoto(1)" style="position:absolute; right:20px; background:none; border:none; color:white; font-size:40px; cursor:pointer;"><i class="fas fa-chevron-right"></i></button>
    `;
    
    document.body.appendChild(lightbox);
}

function navigatePhoto(direction) {
    currentPhotoIndex += direction;
    if (currentPhotoIndex < 0) currentPhotoIndex = currentAlbumPhotos.length - 1;
    if (currentPhotoIndex >= currentAlbumPhotos.length) currentPhotoIndex = 0;
    
    const img = document.getElementById('gallery-lightbox-img'); // <-- Tutaj zmiana!
    if (img) {
        img.src = currentAlbumPhotos[currentPhotoIndex].photo_url;
    }
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

// --- ZARZĄDZANIE CENNIKIEM ---

// 1. Pobieranie i renderowanie cennika
async function fetchPricingFromDB() {
    const container = document.getElementById('pricing-container');
    const adminControl = document.getElementById('admin-pricing-control');
    if (!container) return;

    // --- TWÓJ POMYSŁ W PRAKTYCE: Dynamiczny przycisk główny ---
    if (adminControl) {
        if (isAdmin) {
            // Jeśli admin jest zalogowany, tworzymy przycisk w locie
            adminControl.innerHTML = `
                <button onclick="addPricingItem()" class="admin-photo-btn upload-btn" style="margin-bottom: 20px;">
                    <i class="fas fa-plus"></i> Dodaj nową pozycję
                </button>
            `;
        } else {
            // Jeśli to zwykły użytkownik, kontener jest całkowicie pusty
            adminControl.innerHTML = "";
        }
    }

    try {
        let { data: pricing, error } = await _supabase
            .from('prices')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        let html = "";
        pricing.forEach(item => {
            const title = currentLanguage === 'pl' ? item.title_pl : item.title_en;
            
            // Dynamiczne przyciski wiersza (tylko dla admina)
            const adminButtons = isAdmin ? `
                <div class="pricing-actions">
                    <button onclick="editPricingItem(${item.id}, '${item.title_pl}', '${item.title_en}', '${item.price}')" class="admin-photo-btn upload-btn" style="padding:4px 8px; font-size:11px;"><i class="fas fa-edit"></i></button>
                    <button onclick="deletePricingItem(${item.id})" class="admin-photo-btn delete-btn" style="padding:4px 8px; font-size:11px;"><i class="fas fa-trash"></i></button>
                </div>
            ` : '';

            html += `
                <div class="pricing-item">
                    <div class="pricing-info">
                        <div class="pricing-title">${title}</div>
                    </div>
                    <div class="pricing-cost">${item.price}</div>
                    ${adminButtons}
                </div>
            `;
        });

        container.innerHTML = html || "<p style='text-align:center; color:#999;'>Brak pozycji w cenniku.</p>";
    } catch (err) {
        console.error("Błąd ladowania cennika:", err);
    }
}

// 2. Dodawanie nowej pozycji
async function addPricingItem() {
    if (!isAdmin) return;

    const titlePl = prompt("Podaj nazwę usługi po polsku:");
    if (!titlePl) return;
    const titleEn = prompt("Podaj nazwę usługi po angielsku:");
    if (!titleEn) return;
    const price = prompt("Podaj cenę (np. '50 zł', 'od 120 zł', 'Free'):");
    if (!price) return;

    try {
        const { error } = await _supabase
            .from('prices')
            .insert([{ title_pl: titlePl.trim(), title_en: titleEn.trim(), price: price.trim() }]);

        if (error) throw error;
        alert("Pozycja dodana pomyślnie!");
        fetchPricingFromDB(); // Odświeżamy widok cennika
    } catch (err) {
        alert("Błąd dodawania: " + err.message);
    }
}

// 3. Edycja istniejącej pozycji
async function editPricingItem(id, oldPl, oldEn, oldPrice) {
    if (!isAdmin) return;

    const titlePl = prompt("Edytuj nazwę po polsku:", oldPl);
    if (!titlePl) return;
    const titleEn = prompt("Edytuj nazwę po angielsku:", oldEn);
    if (!titleEn) return;
    const price = prompt("Edytuj cenę:", oldPrice);
    if (!price) return;

    try {
        const { error } = await _supabase
            .from('prices')
            .update({ title_pl: titlePl.trim(), title_en: titleEn.trim(), price: price.trim() })
            .eq('id', id);

        if (error) throw error;
        alert("Cennik zaktualizowany!");
        fetchPricingFromDB();
    } catch (err) {
        alert("Błąd edycji: " + err.message);
    }
}

// 4. Usuwanie pozycji
async function deletePricingItem(id) {
    if (!isAdmin) return;
    if (!confirm("Czy na pewno chcesz usunąć tę pozycję z cennika?")) return;

    try {
        const { error } = await _supabase
            .from('prices')
            .delete()
            .eq('id', id);

        if (error) throw error;
        alert("Pozycja usunięta.");
        fetchPricingFromDB();
    } catch (err) {
        alert("Błąd usuwania: " + err.message);
    }
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

// 1. Nasłuchiwanie na wejście z linku resetującego hasło
_supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    // Użytkownik przyszedł z maila – pokazujemy mu formularz w HTML
    const resetSection = document.getElementById("reset-password-section");
    if (resetSection) {
      resetSection.style.display = "block"; 
    }
  }
});

// 2. Obsługa wysłania formularza (kliknięcie "Zapisz nowe hasło")
const resetForm = document.getElementById("reset-password-form");
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Zapobiega przeładowaniu strony

    const newPassword = document.getElementById("new-password").value;

    // Wysyłamy nowe hasło do Supabase
    const { data, error } = await _supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert("Wystąpił błąd podczas zmiany hasła: " + error.message);
    } else {
      alert("Hasło zostało pomyślnie zmienione! Możesz się teraz zalogować.");
      
      // Ukrywamy formularz po udanej operacji
      document.getElementById("reset-password-section").style.display = "none";
      
      // Opcjonalnie: przekierowanie lub odświeżenie strony
      // window.location.reload();
    }
  });
}

// --- INICJALIZACJA STARTOWA STRONY ---
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Pobieramy preferowany język
    const savedLang = localStorage.getItem('preferred_language') || 'pl';
    currentLanguage = savedLang;

    // 2. Czekamy na wstępne odczytanie sesji przez Supabase
    try {
        const sessionResult = await _supabase.auth.getSession();
        const session = sessionResult.data?.session;
        
        if (session && session.user) {
            isAdmin = true;
        } else {
            isAdmin = false;
        }
    } catch (sessionError) {
        console.error("Błąd autoryzacji sesji:", sessionError);
        isAdmin = false;
    }

    // 3. ROZWIĄZANIE PROBLEMU RLS: 
    // Dajemy klientowi Supabase 150 milisekund na poprawne zmapowanie nagłówków autoryzacji.
    // To zapobiega sytuacji, w której zapytanie o teksty wyprzedza załadowanie tokenu admina.
    setTimeout(async () => {
        await loadTranslationsFromDB(); 
        await fetchEventsFromDB(); 
        await fetchNewsFromDB();
        await fetchAlbums();
        await loadAllManagedPhotos();
        await fetchPricingFromDB();

        if (isAdmin) {
            enableLiveEditing();
        }
    }, 150);

    // 4. Pobieramy pogodę (niezależnie od opóźnienia tekstów)
    fetchWeather();

    // 5. Obsługa zakładek / podstron
    const currentHash = window.location.hash.replace('#', '') || 'home';
    renderPage(currentHash);
});

window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash.replace('#', '') || 'home';
    renderPage(currentHash);
});

window.addEventListener('click', (e) => {
    const loginModal = document.getElementById('admin-login-modal');
    if (e.target === loginModal) {
        closeAdminLoginModal();
    }
    const modal = document.getElementById('album-preview-modal');
    if (e.target === modal) {
        closeAlbumModal();
    }
});