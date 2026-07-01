import { database, storage } from "./firebase-config.js";
import { ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "पब्लिश हो रहा है, कृपया रुकें... ⏳";

    const title = postTitle.value;
    const location = postLocation.value;
    const content = postContent.value;
    
    const finalCharCount = content.length;
    const finalWordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    const imageUrls = [];

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const uniqueFileName = `post_images/${Date.now()}_${i}_${file.name}`;
            const storageRef = sRef(storage, uniqueFileName);
            
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);
            imageUrls.push(downloadUrl);
        }

        const newPostRef = push(ref(database, 'posts'));
        
        await set(newPostRef, {
            title: title,
            location: location,
            content: content,
            images: imageUrls,
            views: 0,
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
                
