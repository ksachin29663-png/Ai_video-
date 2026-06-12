// menu.js - फुटर कंट्रोलर
document.addEventListener('DOMContentLoaded', () => {
    const footer = document.getElementById('main-footer');
    
    if (footer) {
        footer.innerHTML = `
            <div class="footer-links" style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                <a href="privacy.html" style="color: #64748b; text-decoration: none;">प्राइवेसी पॉलिसी</a>
                <a href="about.html" style="color: #64748b; text-decoration: none;">अबाउट अस</a>
                <a href="disclaimer.html" style="color: #64748b; text-decoration: none;">डिस्क्लेमर</a>
                <a href="terms.html" style="color: #64748b; text-decoration: none;">टर्म्स एंड कंडीशंस</a>
                <a href="contact.html" style="color: #64748b; text-decoration: none;">कांटेक्ट</a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 10px;">&copy; 2026 AI Website 36. सर्वाधिकार सुरक्षित।</p>
        `;
    }
});
