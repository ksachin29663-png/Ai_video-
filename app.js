import { database } from "./firebase-config.js"; // यहाँ से storage हटा दिया
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const postsContainer = document.getElementById('posts-container');

function processContentWithHighlights(text) {
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
    let htmlContent = "";

    paragraphs.forEach((para, index) => {
        htmlContent += `<p class="post-content">${para}</p>`;

        if ((index + 1) % 2 === 0 && para.length > 30) {
            const highlightText = para.substring(0, 60) + "...";
            htmlContent += `
                <div class="auto-highlight">
                    📌 मुख्य आकर्षण: "${highlightText}"
                </div>
            `;
        }
    });

    return htmlContent;
}

const postsRef = ref(database, 'posts');

onValue(postsRef, (snapshot) => {
    postsContainer.innerHTML = "";

    if (snapshot.exists()) {
        const postsData = snapshot.val();
        const postsList = Object.keys(postsData).map(key => ({
            id: key,
            ...postsData[key]
        })).reverse();

        postsList.forEach(post => {
            const postCard = document.createElement('div');
            postCard.className = 'post-card';

            let imagesHtml = "";
            if (post.images && post.images.length > 0) {
                const isMulti = post.images.length > 1 ? "multi-img" : "";
                imagesHtml = `<div class="post-images-grid ${isMulti}">`;
                post.images.forEach(imgData => {
                    // imgData में अब सीधा टेक्स्ट कोड है जो इमेज की तरह लोड होगा
                    imagesHtml += `<img src="${imgData}" alt="Post Image" loading="lazy">`;
                });
                imagesHtml += `</div>`;
            }

            const processedBody = processContentWithHighlights(post.content);

            postCard.innerHTML = `
                <h2 class="post-title">${post.title}</h2>
                <div class="post-location">📍 ${post.location}</div>
                
                ${imagesHtml}
                
                <div class="post-text-area">
                    ${processedBody}
                </div>
                
                <div class="post-meta">
                    <span>👁️ ${post.views || 0} व्यूज</span>
                    <span>📅 ${post.date}</span>
                </div>
            `;

            postsContainer.appendChild(postCard);
        });
    } else {
        postsContainer.innerHTML = "<div class='loading'>अभी तक कोई पोस्ट पब्लिश नहीं की गई है।</div>";
    }
}, (error) => {
    console.error("डेटा लोड करने में समस्या आई: ", error);
    postsContainer.innerHTML = "<div class='loading'>डेटा लोड करने में एरर आया।</div>";
});
            
