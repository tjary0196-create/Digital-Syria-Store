/**
 * King Cinema API Integration (Diagnostic Mode)
 * ================================================
 */

const KING_CINEMA_BASE_URL = "https://kingcinema.app";
const CONFIG_URL = "https://raw.githubusercontent.com/seedrama/app-config/main/domain.txt";
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
        // تجربة مسار الـ API الذي تم التأكد من عمله
        const targetUrl = `${currentDomain}/api/app_sections.php?action=list&platform=app`;
        const finalUrl = PROXY_URL + encodeURIComponent(targetUrl);
        
        const response = await fetch(finalUrl);
        const data = await response.json();
        
        console.log("API Response for " + containerId + ":", data);

        // إذا لم نجد أفلام مباشرة، سنعرض رسالة توضح هيكل البيانات المستلم
        if (data.success && data.sections) {
            // هذا يعني أن الـ API يعمل ولكنه يعيد الأقسام وليس الأفلام مباشرة
            // سنقوم بطلب الأفلام لكل قسم إذا كان ذلك متاحاً
            container.innerHTML = '<div style="color:#888;padding:10px;">تم الاتصال بالسيرفر بنجاح، جاري استخراج الأفلام...</div>';
            
            // محاكاة بيانات أفلام إذا كان السيرفر يعيد الأقسام فقط حالياً
            // (سيتم استبدال هذا بجلب حقيقي بمجرد معرفة مسار الـ posts الصحيح)
            const mockMovies = [
                { id: 1, title: "فيلم تجريبي 1", poster: "https://via.placeholder.com/200x300?text=King+Cinema" },
                { id: 2, title: "فيلم تجريبي 2", poster: "https://via.placeholder.com/200x300?text=King+Cinema" }
            ];
            renderMovies(mockMovies, container);
        } else {
            container.innerHTML = '<div style="color:#ff4444;padding:10px;">السيرفر لم يعيد بيانات الأفلام المتوقعة.</div>';
        }

    } catch (error) {
        console.error("Fetch Error:", error);
        if (container) {
            container.innerHTML = `<div style="color:#ff4444;padding:10px;font-size:12px;">خطأ في الاتصال: ${error.message}</div>`;
        }
    }
}

function renderMovies(movies, container) {
    container.innerHTML = "";
    movies.forEach((movie) => {
        const card = document.createElement("div");
        card.className = "movie-card";
        const title = movie.title || movie.name;
        const poster = movie.poster || movie.image;
        
        card.innerHTML = `
            <img src="${poster}" alt="${title}" onerror="this.src='https://via.placeholder.com/200x300?text=Error'">
            <div class="movie-card-info">
                <h4>${title}</h4>
            </div>
        `;
        card.onclick = () => openKingPlayer(movie);
        container.appendChild(card);
    });
}

function openKingPlayer(movie) {
    const modal = document.getElementById("player-modal");
    modal.style.display = "block";
    document.getElementById("player-title").textContent = movie.title;
    document.getElementById("video-iframe").src = `${currentDomain}/api/extractor.php?url=${movie.id}`;
}

document.addEventListener("DOMContentLoaded", async () => {
    await updateActiveDomain();
    fetchMovies('list', '1', 'trending-movies');
    fetchMovies('list', '4', 'action-movies');
    fetchMovies('list', '5', 'horror-movies');
});
