// menu.js - फुटर कंट्रोलर
document.addEventListener('DOMContentLoaded', () => {
    const footerContainer = document.getElementById('footer-links');
    
    if (footerContainer) {
        footerContainer.innerHTML = `
            <div class="footer-links" style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                <a href="privacy.html">प्राइवेसी पॉलिसी</a>
                <a href="about.html">अबाउट अस</a>
                <a href="disclaimer.html">डिस्क्लेमर</a>
                <a href="terms.html">टर्म्स एंड कंडीशंस</a>
                <a href="contact.html">कांटेक्ट</a>
            </div>
            <p style="font-size: 12px; margin-top: 10px;">&copy; 2026 AI Website 36</p>
        `;
    }
});
