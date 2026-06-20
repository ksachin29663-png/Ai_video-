// 🚀 अपडेटेड एल्गोरिदम: तारीख, समय और NEW टैग के साथ
(function() {
    window.loadPosts = function(category) {
        const container = document.getElementById('post-container');
        if (!container) return;

        container.innerHTML = '<p>ताज़ा पोस्ट लोड हो रही हैं...</p>';

        // Firebase से डेटा का पाथ (आपके ओरिजिनल कोड के अनुसार)
        const dbRef = (category === 'home') ? ref(db, 'posts') : ref(db, 'posts/' + category);

        onValue(dbRef, (snapshot) => {
            container.innerHTML = "";
            const data = snapshot.val();

            if (!data) {
                container.innerHTML = '<p>इस कैटेगरी में कोई पोस्ट नहीं है!</p>';
                return;
            }

            let allPosts = [];

            // 1. सारा डेटा लिस्ट में इकट्ठा करना
            if (category === 'home') {
                Object.values(data).forEach(catData => {
                    if (typeof catData === 'object') {
                        allPosts = allPosts.concat(Object.values(catData));
                    }
                });
            } else {
                allPosts = Object.values(data);
            }

            // 2. ⚡ सॉर्टिंग एल्गोरिदम (नया आर्टिकल सबसे ऊपर)
            allPosts.sort((a, b) => {
                const timeA = a.timestamp || a.date || 0;
                const timeB = b.timestamp || b.date || 0;
                
                if (timeA && timeB) {
                    return new Date(timeB) - new Date(timeA);
                }
                return 1;
            });
            
            // लेटेस्ट पोस्ट को टॉप पर रखने के लिए रिवर्स सेट करना
            allPosts.reverse();

            // 3. पोस्ट्स को स्क्रीन पर तारीख और समय के साथ दिखाना
            allPosts.forEach(p => {
                
                // 📅 तारीख और समय निकालने का लॉजिक
                let postDateTime = "तारीख उपलब्ध नहीं";
                const checkTime = p.timestamp || p.date;
                
                if (checkTime) {
                    // तारीख और समय को भारतीय फॉर्मेट (Time-Zone) में बदलना
                    postDateTime = new Date(checkTime).toLocaleDateString('hi-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true // PM/AM दिखाने के लिए
                    });
                }

                // नया डिज़ाइन कार्ड (तारीख और समय के साथ)
                const cardHTML = `
                    <div class="youtube-card" style="margin-bottom: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 10px; overflow: hidden; background: #fff; border: 1px solid #eee;">
                        <a href="${p.postLink || '#'}" target="_blank" style="text-decoration: none; color: black;">
                            <img src="${p.imageUrl || 'https://via.placeholder.com/400'}" style="width: 100%; height: 220px; object-fit: cover;">
                            
                            <div style="padding: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <span style="color: #666; font-size: 13px; font-weight: 500;">📅 ${postDateTime}</span>
                                    <span style="background: #ff0000; color: white; padding: 2px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; animation: blink 1s infinite;">NEW POST</span>
                                </div>
                                
                                <h3 style="margin: 5px 0 0 0; font-size: 18px; color: #222; line-height: 1.4;">${p.title || 'शीर्षक'}</h3>
                            </div>
                        </a>
                    </div>
                `;
                container.innerHTML += cardHTML;
            });
        });
    };
})();

// ब्लिंक (लपझप) एनीमेशन स्टाइल
if (!document.getElementById('blink-style')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'blink-style';
    styleElement.innerHTML = `@keyframes blink { 0% {opacity: 1;} 50% {opacity: 0.4;} 100% {opacity: 1;} }`;
    document.head.appendChild(styleElement);
}
