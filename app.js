// हमारी फायरबेस कॉन्फ़िगरेशन फ़ाइल से डेटाबेस को इंपोर्ट करना
import { database } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const postsContainer = document.getElementById('posts-container');

// 1. पैराग्राफ को प्रोसेस करके ऑटोमैटिक हाईलाइट बॉक्स तैयार करने वाला फंक्शन
function processContentWithHighlights(text) {
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
    let htmlContent = "";

    paragraphs.forEach((para, index) => {
        // सामान्य पैराग्राफ जोड़ना
        htmlContent += `<p class="post-content">${para}</p>`;

        // हर 2 पैराग्राफ के बाद एक ऑटोमैटिक हाईलाइट बॉक्स बनाना (यदि कंटेंट लंबा है)
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

// 2. फायरबेस से रियल-टाइम में पोस्ट्स लोड करना
const postsRef = ref(database, 'posts');

onValue(postsRef, (snapshot) => {
    postsContainer.innerHTML = ""; // पुराना लोडिंग टेक्स्ट हटाएं

    if (snapshot.exists()) {
        const postsData = snapshot.val();
        
        // पोस्ट्स को उल्टे क्रम (Newest First) में दिखाने के लिए एरे में बदलना
        const postsList = Object.keys(postsData).map(key => ({
            id: key,
            ...postsData[key]
        })).reverse();

        postsList.forEach(post => {
            const postCard = document.createElement('div');
            postCard.className = 'post-card';

            // इमेज ग्रिड तैयार करना (YouTube थंबनेल स्टाइल)
            let imagesHtml = "";
            if (post.images && post.images.length > 0) {
                const isMulti = post.images.length > 1 ? "multi-img" : "";
                imagesHtml = `<div class="post-images-grid ${isMulti}">`;
                post.images.forEach(imgData => {
                    imagesHtml += `<img src="${imgData}" alt="Post Image" loading="lazy">`;
                });
                imagesHtml += `</div>`;
            }

            // प्रोसेस किया हुआ कंटेंट (जिसमें ऑटो-हाईलाइट शामिल है)
            const processedBody = processContentWithHighlights(post.content);

            // पूरा YouTube स्टाइल लेआउट असेम्बल करना (इमेज सबसे ऊपर)
            postCard.innerHTML = `
                ${imagesHtml}
                
                <div class="post-text-area">
                    <h2 class="post-title">${post.title}</h2>
                    <div class="post-location">📍 ${post.location}</div>
                    <div class="post-text-content">
                        ${processedBody}
                    </div>
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
    
