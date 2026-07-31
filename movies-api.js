/**
 * King Cinema API Integration (Fixed)
 * ================================================
 */

const KING_CINEMA_BASE_URL = "https://kingcinema.app";
const CONFIG_URL = "https://raw.githubusercontent.com/seedrama/app-config/main/domain.txt";
// استخدام بروكسي لتجاوز حماية CORS التي تمنع المتصفح من الاتصال بالسيرفر مباشرة
const PROXY_URL = "https://api.allorigins.win/raw?url=";

let currentDomain = KING_CINEMA_BASE_URL;

async function updateActiveDomain() {
    try {
        const response = await fetch(CONFIG_URL);
        const text = await response.text();
        if (text && text.startsWith('http')) {
            currentDomain = text.trim();
        }
    } catch (e) {
        console.error("Domain update failed:", e);
    }
}

async function fetchMovies(action = 'list', categoryId = '1', containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div style="color:#aaa;padding:10px;">جاري الاتصال بالسيرفر...</div>';
    }

    try {
        // بناء الرابط مع البروكسي لتجنب حظر المتصفح
        const targetUrl = `${currentDomain}/api/app_sections.php?action=${action}&platform=app&category_id=${categoryId}`;
        const finalUrl = PROXY_URL + encodeURIComponent(targetUrl);
        
        const response = await fetch(finalUrl);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();
        
        // محاولة استخراج الأفلام من عدة مفاتيح محتملة في الـ JSON
        const movies = data.posts || data.movies || data.items || (Array.isArray(data) ? data : []);

        if (!container) return movies;
        container.innerHTML = "";

        if (movies.length === 0) {
            container.innerHTML = '<div style="color:#888;padding:10px;">لا توجد بيانات حالياً من السيرفر</div>';
            return movies;
        }

        movies.forEach((movie) => {
            const card = document.createElement("div");
            card.className = "movie-card";
            const title = movie.title || movie.name || "بدون عنوان";
            const poster = movie.poster || movie.image || movie.thumbnail || "https://via.placeholder.com/200x300?text=No+Image";
            
            card.innerHTML = `
                <img src="${poster}" alt="${title}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=Error'">
                <div class="movie-card-info">
                    <h4 style="font-size:14px;">${title}</h4>
                    <p style="font-size:11px;color:#00D4FF;">${movie.year || ''} • ${movie.quality || 'HD'}</p>
                </div>
            `;
            card.onclick = () => openKingPlayer(movie);
            container.appendChild(card);
        });

        // إذا كان هذا القسم هو "الرائج"، قم بتحديث الـ Hero
        if (containerId === 'trending-movies' && movies.length > 0) {
            updateHero(movies[0]);
        }

        return movies;
    } catch (error) {
        console.error("Fetch Error:", error);
        if (container) {
            container.innerHTML = `<div style="color:#ff4444;padding:10px;font-size:12px;">فشل التحميل: تأكد من عمل السيرفر ${currentDomain}</div>`;
        }
        return [];
    }
}

function updateHero(movie) {
    const heroTitle = document.getElementById("hero-title");
    const heroOverview = document.getElementById("hero-overview");
    const hero = document.getElementById("hero");
    
    if (heroTitle) heroTitle.textContent = movie.title || movie.name;
    if (heroOverview) heroOverview.textContent = movie.description || movie.excerpt || "مشاهدة ممتعة لأحدث الأفلام.";
    if (hero) {
        const bg = movie.poster || movie.image || "";
        hero.style.backgroundImage = `linear-gradient(to top, #141414, transparent), url(${bg})`;
    }
    window.heroMovie = movie;
}

function openKingPlayer(movie) {
    const modal = document.getElementById("player-modal");
    if (!modal) return;
    
    modal.style.display = "block";
    document.getElementById("player-title").textContent = movie.title || movie.name;
    document.getElementById("player-overview").textContent = movie.description || "لا يوجد وصف متاح.";

    const serverTabs = document.getElementById("server-tabs");
    serverTabs.innerHTML = "";

    // روابط السيرفرات بناءً على ما وجدناه في الـ APK
    const movieId = movie.id || movie.post_id;
    const servers = [
        { name: "سيرفر 1", url: `${currentDomain}/api/extractor.php?url=${movieId}` },
        { name: "سيرفر 2", url: `https://vibuxer.com/e/${movie.vibuxer_id || movieId}` },
        { name: "سيرفر 3", url: `https://voe.sx/e/${movie.voe_id || movieId}` }
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

    document.getElementById("video-iframe").src = servers[0].url;
    document.body.style.overflow = "hidden";
}

document.addEventListener("DOMContentLoaded", async () => {
    await updateActiveDomain();
    // جلب تصنيفات مختلفة
    fetchMovies('list', '1', 'trending-movies');
    fetchMovies('list', '4', 'action-movies');
    fetchMovies('list', '5', 'horror-movies');
});
