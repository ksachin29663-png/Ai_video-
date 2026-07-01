import { database } from "./firebase-config.js";
import { ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const postForm = document.getElementById('post-form');
const postTitle = document.getElementById('post-title');
const postLocation = document.getElementById('post-location');
const postImages = document.getElementById('post-images');
const imagePreview = document.getElementById('image-preview');
const postContent = document.getElementById('post-content');
const charCountSpan = document.getElementById('char-count');
const wordCountSpan = document.getElementById('word-count');
const totalPostsCountSpan = document.getElementById('total-posts-count');
const submitBtn = document.getElementById('submit-btn');

let selectedFiles = [];

// लाइव वर्ड और कैरेक्टर काउंटर
postContent.addEventListener('input', () => {
    const text = postContent.value;
    charCountSpan.textContent = text.length;
    
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    wordCountSpan.textContent = words.length;
    
    if (words.length > 5000) {
        wordCountSpan.style.color = "red";
    } else {
        wordCountSpan.style.color = "#0056b3";
    }
});

// फोटो चुनने पर प्रीव्यू दिखाना
postImages.addEventListener('change', (e) => {
    imagePreview.innerHTML = "";
    selectedFiles = Array.from(e.target.files);
    
    if (selectedFiles.length > 4) {
        alert("आप अधिकतम 4 फोटो ही अपलोड कर सकते हैं!");
        postImages.value = "";
        selectedFiles = [];
        return;
    }

    selectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            imagePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
});

// कुल पोस्ट काउंटर
const totalPostsRef = ref(database, 'posts');
onValue(totalPostsRef, (snapshot) => {
    if (snapshot.exists()) {
        const data = snapshot.val();
        const totalCount = Object.keys(data).length;
        totalPostsCountSpan.textContent = totalCount;
    } else {
        totalPostsCountSpan.textContent = 0;
    }
});

// फाइल को Base64 टेक्स्ट में बदलने का फंक्शन
const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

// फॉर्म सबमिट होने पर सीधा डेटाबेस में सेव करना
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "पब्लिश हो रहा है, कृपया रुकें... ⏳";

    const title = postTitle.value;
    const location = postLocation.value;
    const content = postContent.value;
    
    const finalCharCount = content.length;
    const finalWordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    const base64Images = [];

    try {
        // सभी चुनी हुई फोटो को एक-एक करके टेक्स्ट (Base64) में बदलना
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const base64String = await convertFileToBase64(file);
            base64Images.push(base64String); // यह सीधा टेक्स्ट एरे में जाएगा
        }

        const newPostRef = push(ref(database, 'posts'));
        
        // सीधे रियल-टाइम डेटाबेस में सारा डेटा एक साथ सेव करना
        await set(newPostRef, {
            title: title,
            location: location,
            content: content,
            images: base64Images, // फोटो अब टेक्स्ट बनकर सीधा डेटाबेस में जा रही है
            views: 0,
            date: new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
            charCount: finalCharCount,
            wordCount: finalWordCount
        });

        alert("🚀 आपकी पोस्ट बिना किसी स्टोरेज के सीधे रियल-टाइम डेटाबेस में पब्लिश हो गई है!");
        postForm.reset();
        imagePreview.innerHTML = "";
        selectedFiles = [];
        
    } catch (error) {
        console.error("Error publishing post: ", error);
        alert("❌ कुछ गड़बड़ हुई! कृपया दोबारा प्रयास करें।");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "पोस्ट पब्लिश करें 🚀";
    }
});
            
