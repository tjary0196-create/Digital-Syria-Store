/**
 * King Cinema API Integration (Final Stable Version)
 * ================================================
 */

const KING_CINEMA_BASE_URL = "https://kingcinema.app";
const CONFIG_URL = "https://raw.githubusercontent.com/seedrama/app-config/main/domain.txt";
// استخدام بروكسي بديل وأكثر استقراراً مع نظام Fallback
const PROXY_1 = "https://api.allorigins.win/raw?url=";
const PROXY_2 = "https://corsproxy.io/?";

let currentDomain = KING_CINEMA_BASE_URL;

async function updateActiveDomain() {
    try {
        const response = await fetch(CONFIG_URL);
        if (response.ok) {
            const text = await response.text();
            if (text && text.trim().startsWith('http')) {
                currentDomain = text.trim();
            }
        }
    } catch (e) {
        console.error("Domain update failed:", e);
    }
}

async function fetchMovies(categoryId = '1', containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<div style="color:#aaa;padding:10px;font-size:12px;">جاري تحميل الأفلام المترجمة...</div>';
    }

    // المسار الصحيح الذي تم التأكد منه
    const targetUrl = `${currentDomain}/api/get_posts.php?category_id=${categoryId}&page=1&limit=20&platform=app`;
    
    try {
        let data = await tryFetch(targetUrl, PROXY_1);
        if (!data) data = await tryFetch(targetUrl, PROXY_2);
        
        if (data && Array.isArray(data)) {
            renderMovies(data, container);
            if (containerId === 'trending-movies' && data.length > 0) {
                updateHero(data[0]);
            }
        } else {
            throw new Error("Invalid Data");
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        if (container) {
            container.innerHTML = `<div style="color:#ff4444;padding:10px;font-size:11px;">⚠️ تعذر الاتصال بالسيرفر حالياً.</div>`;
        }
    }
}

async function tryFetch(url, proxy) {
    try {
        const response = await fetch(proxy + encodeURIComponent(url));
        if (!response.ok) return null;
        const text = await response.text();
        if (!text) return null;
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

function renderMovies(movies, container) {
    container.innerHTML = "";
    movies.forEach((movie) => {
        const card = document.createElement("div");
        card.className = "movie-card";
        const title = movie.title_ar || movie.title || "فيلم مترجم";
        const poster = movie.poster || movie.image_url || "https://via.placeholder.com/200x300?text=No+Image";
        
        card.innerHTML = `
            <img src="${poster}" alt="${title}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=Error'">
            <div class="movie-card-info">
                <h4 style="font-size:13px; margin-bottom:5px;">${title}</h4>
                <p style="font-size:10px; color:#00D4FF;">${movie.year || ''} • ${movie.quality || 'HD'}</p>
            </div>
        `;
        card.onclick = () => openKingPlayer(movie);
        container.appendChild(card);
    });
}

function updateHero(movie) {
    const heroTitle = document.getElementById("hero-title");
    const heroOverview = document.getElementById("hero-overview");
    const hero = document.getElementById("hero");
    
    if (heroTitle) heroTitle.textContent = movie.title_ar || movie.title;
    if (heroOverview) heroOverview.textContent = movie.description || "مشاهدة أحدث الأفلام المترجمة بجودة عالية.";
    if (hero) {
        const bg = movie.poster || movie.image_url || "";
        hero.style.backgroundImage = `linear-gradient(to top, #141414, transparent), url(${bg})`;
    }
    window.heroMovie = movie;
}

function openKingPlayer(movie) {
    const modal = document.getElementById("player-modal");
    if (!modal) return;
    
    modal.style.display = "block";
    document.getElementById("player-title").textContent = movie.title_ar || movie.title;
    document.getElementById("player-overview").textContent = movie.description || "لا يوجد وصف متاح.";

    const serverTabs = document.getElementById("server-tabs");
    serverTabs.innerHTML = "";

    // روابط السيرفرات بناءً على ما وجدناه في الـ APK
    const movieId = movie.id;
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
    // 1: أفلام, 4: أكشن, 5: رعب (بناءً على فحص الـ API)
    fetchMovies('1', 'trending-movies');
    fetchMovies('47', 'action-movies'); // تجربة تصنيف آخر للأكشن
    fetchMovies('56', 'horror-movies'); // تجربة تصنيف آخر للرعب
});
