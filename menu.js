// menu.js - यह फाइल सारा मेनू मैनेज करेगी
const menuHTML = `
    <nav class="category-tabs">
        <button onclick="loadPosts('home')">होम</button>
        <button onclick="loadPosts('business')">बिजनेस</button>
        <button onclick="loadPosts('youtube')">YouTube</button>
        <button onclick="loadPosts('shayari')">शायरी</button>
        <div class="dropdown">
            <button class="dropbtn">☰ मेनू</button>
            <div class="dropdown-content">
                <a href="privacy.html">प्राइवेसी पॉलिसी</a>
                <a href="about.html">अबाउट अस</a>
                <a href="contact.html">कांटेक्ट</a>
                <a href="disclaimer.html">डिस्क्लेमर</a>
            </div>
        </div>
    </nav>
`;

// यह कोड ऑटोमैटिकली हेडर के नीचे मेनू डाल देगा
document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    header.insertAdjacentHTML('afterend', menuHTML);
});

