/**
 * King Cinema API Integration
 * ================================================
 * هذا الملف يقوم بجلب البيانات من سيرفرات King Cinema الأصلية
 * التي تم استخراجها من تطبيق الـ APK.
 */

const KING_CINEMA_BASE_URL = "https://kingcinema.app";
const CONFIG_URL = "https://raw.githubusercontent.com/seedrama/app-config/main/domain.txt";

let currentDomain = KING_CINEMA_BASE_URL;

/**
 * تحديث النطاق النشط من GitHub لضمان استمرارية العمل
 */
async function updateActiveDomain() {
    try {
        const response = await fetch(CONFIG_URL);
        const text = await response.text();
        if (text && text.startsWith('http')) {
            currentDomain = text.trim();
            console.log("Active Domain Updated:", currentDomain);
        }
    } catch (e) {
        console.error("Failed to update domain, using default:", currentDomain);
    }
}

/**
 * جلب الأفلام من سيرفر King Cinema
 */
async function fetchMovies(action = 'list', categoryId = '1', containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div class="loading-spinner">جاري تحميل الأفلام...</div>';
    }

    try {
        // استخدام API السيرفر الأصلي
        const apiUrl = `${currentDomain}/api/app_sections.php?action=${action}&platform=app`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        // ملاحظة: هيكل البيانات قد يختلف حسب الـ API، سنقوم بتكييفه
        const movies = data.posts || data.movies || [];

        if (!container) return movies;
        container.innerHTML = "";

        if (movies.length === 0) {
            container.innerHTML = '<div class="no-data">لا توجد أفلام متاحة حالياً</div>';
            return movies;
        }

        movies.forEach((movie) => {
            const card = document.createElement("div");
            card.className = "movie-card";
            const title = movie.title || "عنوان غير معروف";
            const poster = movie.poster || movie.image || "assets/default-poster.png";
            
            card.innerHTML = `
                <img src="${poster}" alt="${title}" loading="lazy" onerror="this.src='assets/default-poster.png'">
                <div class="movie-card-info">
                    <h4>${title}</h4>
                    <p>${movie.year || ''} • ${movie.quality || 'HD'}</p>
                </div>
            `;
            card.onclick = () => openKingPlayer(movie);
            container.appendChild(card);
        });

        return movies;
    } catch (error) {
        console.error("Error fetching King Cinema movies:", error);
        if (container) {
            container.innerHTML = '<div class="error-msg">تعذر الاتصال بالسيرفر، يرجى المحاولة لاحقاً</div>';
        }
        return [];
    }
}

/**
 * فتح مشغل الأفلام مع السيرفرات الأصلية
 */
function openKingPlayer(movie) {
    const modal = document.getElementById("player-modal");
    modal.style.display = "block";
    document.getElementById("player-title").textContent = movie.title;
    document.getElementById("player-overview").textContent = movie.description || "لا يوجد وصف متاح.";

    // إعداد أزرار السيرفرات المستخرجة
    const serverTabs = document.getElementById("server-tabs");
    serverTabs.innerHTML = "";

    // السيرفرات التي وجدناها في الـ APK
    const servers = [
        { name: "Server 1 (Main)", url: `${currentDomain}/api/extractor.php?url=${movie.id || movie.link}` },
        { name: "Server 2 (Vibuxer)", url: `https://vibuxer.com/e/${movie.vibuxer_id || ''}` },
        { name: "Server 3 (Voe)", url: `https://voe.sx/e/${movie.voe_id || ''}` },
        { name: "Server 4 (Filemoon)", url: `https://filemoon.sx/e/${movie.filemoon_id || ''}` }
    ];

    servers.forEach((server, index) => {
        const tab = document.createElement("div");
        tab.className = `server-tab ${index === 0 ? 'active' : ''}`;
        tab.textContent = server.name;
        tab.onclick = () => {
            document.querySelectorAll('.server-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById("video-iframe").src = server.url;
        };
        serverTabs.appendChild(tab);
    });

    // تشغيل السيرفر الأول تلقائياً
    document.getElementById("video-iframe").src = servers[0].url;
    document.body.style.overflow = "hidden";
}

// تشغيل عند التحميل
document.addEventListener("DOMContentLoaded", async () => {
    await updateActiveDomain();
    fetchMovies('list', '1', 'trending-movies');
    fetchMovies('list', '2', 'action-movies');
    fetchMovies('list', '3', 'horror-movies');
});
