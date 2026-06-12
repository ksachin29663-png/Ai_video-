// menu.js - पूरा कंट्रोलर
document.addEventListener('DOMContentLoaded', () => {
    // 1. थ्री-डॉट मेनू जोड़ना
    const header = document.querySelector('header');
    if (header) {
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const menuTrigger = document.createElement('div');
        menuTrigger.innerHTML = '☰';
        menuTrigger.style.cssText = 'cursor:pointer; font-size:30px; color:red; margin-right:15px;';
        
        const menuList = document.createElement('div');
        menuList.id = 'dropdown-menu';
        menuList.style.cssText = 'display:none; background:white; position:absolute; right:10px; top:60px; padding:15px; border:1px solid #ccc; z-index:9999;';
        menuList.innerHTML = `
            <a href="privacy.html" style="display:block; color:#333; margin:5px 0;">प्राइवेसी पॉलिसी</a>
            <a href="about.html" style="display:block; color:#333; margin:5px 0;">अबाउट अस</a>
            <a href="disclaimer.html" style="display:block; color:#333; margin:5px 0;">डिस्क्लेमर</a>
            <a href="terms.html" style="display:block; color:#333; margin:5px 0;">टर्म्स एंड कंडीशंस</a>
            <a href="contact.html" style="display:block; color:#333; margin:5px 0;">कांटेक्ट</a>
        `;
        
        menuTrigger.onclick = () => {
            menuList.style.display = (menuList.style.display === 'none') ? 'block' : 'none';
        };
        
        header.appendChild(menuTrigger);
        document.body.appendChild(menuList);
    }

    // 2. फुटर जोड़ना
    const footer = document.createElement('footer');
    footer.id = 'footer-links';
    footer.style.textAlign = 'center';
    footer.style.padding = '20px';
    footer.innerHTML = '<p>&copy; 2026 AI Website 36</p>';
    document.body.appendChild(footer);
});
