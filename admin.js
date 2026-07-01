// हमारी फायरबेस कॉन्फ़िगरेशन फ़ाइल से डेटाबेस और स्टोरेज को इंपोर्ट करना
import { database, storage } from "./firebase-config.js";
import { ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// HTML एलिमेंट्स को सेलेक्ट करना
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

// 1. लाइव वर्ड और कैरेक्टर काउंटर लॉजिक
postContent.addEventListener('input', () => {
    const text = postContent.value;
    
    // अक्षरों की संख्या (बिना किसी परेशानी के डायरेक्ट गिनती)
    charCountSpan.textContent = text.length;
    
    // शब्दों की संख्या (स्पेस के आधार पर सही गिनती)
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    wordCountSpan.textContent = words.length;
    
    // अगर शब्द 5000 से ऊपर जाते हैं तो अलर्ट या रोक लगा सकते हैं
    if (words.length > 5000) {
        wordCountSpan.style.color = "red";
    } else {
        wordCountSpan.style.color = "#0056b3";
    }
});

// 2. फोटो सेलेक्ट करने पर स्क्रीन पर छोटा प्रीव्यू दिखाना
postImages.addEventListener('change', (e) => {
    imagePreview.innerHTML = ""; // पुराना प्रीव्यू साफ़ करें
    selectedFiles = Array.from(e.target.files);
    
    // सुरक्षा: ज़्यादा से ज़्यादा 4 फोटो की लिमिट
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

// 3. डेटाबेस से कुल पोस्ट की संख्या (Total Post Counter) लाइव दिखाना
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

// 4. फॉर्म सबमिट होने पर फोटो और डेटा सेव करने का लॉजिक
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    submitBtn.textContent = "पब्लिश हो रहा है, कृपया रुकें... ⏳";

    const title = postTitle.value;
    const location = postLocation.value;
    const content = postContent.value;
    
    // शब्दों और अक्षरों का फाइनल काउंट निकालने के लिए
    const finalCharCount = content.length;
    const finalWordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;

    const imageUrls = [];

    try {
        // फोटो अपलोडिंग प्रोसेस (Firebase Storage में)
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const uniqueFileName = `post_images/${Date.now()}_${i}_${file.name}`;
            const storageRef = sRef(storage, uniqueFileName);
            
            // फाइल अपलोड करें
            await uploadBytes(storageRef, file);
            // डाउनलोड लिंक प्राप्त करें
            const downloadUrl = await getDownloadURL(storageRef);
            imageUrls.push(downloadUrl);
        }

        // नया पोस्ट आईडी (Unique ID) जनरेट करना
        const newPostRef = push(ref(database, 'posts'));
        
        // रियल-टाइम डेटाबेस में सारा टेक्स्ट डेटा और फोटो लिंक्स एक साथ सेव करना
        await set(newPostRef, {
            title: title,
            location: location,
            content: content,
            images: imageUrls, // यह एक एरे (Array) के रूप में स्टोर होगा (0 से 4 लिंक्स)
            views: 0,          // शुरुआत में 0 व्यूज
            date: new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
            charCount: finalCharCount,
            wordCount: finalWordCount
        });

        alert("🚀 आपकी पोस्ट सफलतापूर्वक पब्लिश हो गई है!");
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
              
