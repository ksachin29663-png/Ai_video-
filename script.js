// script.js

// 1. शायरी कॉपी करने का फंक्शन
function copyShayari(elementId) {
    const shayariText = document.querySelector(`#${elementId} .shayari-text`).innerText;
    navigator.clipboard.writeText(shayariText).then(() => {
        alert("शायरी कॉपी हो गई!");
    });
}

// 2. शेयर करने का फंक्शन
function shareShayari(elementId) {
    const shayariText = document.querySelector(`#${elementId} .shayari-text`).innerText;
    if (navigator.share) {
        navigator.share({
            title: 'मेरी शायरी',
            text: shayariText,
        }).catch(err => console.log('शेयरिंग में एरर:', err));
    } else {
        alert("आपका ब्राउज़र शेयरिंग सपोर्ट नहीं करता।");
    }
}
