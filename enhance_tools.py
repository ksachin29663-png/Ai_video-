import os
import re

tools_dir = "/home/ubuntu/Ai_video-"
tool_files = [f for f in os.listdir(tools_dir) if f.startswith("ai-") and f.endswith(".html")]

enhancement_template = """
<!-- HOW TO USE + FAQ -->
<div class="how-to-section" style="max-width:800px;margin:40px auto;padding:20px;background:rgba(255,255,255,0.02);border-radius:15px;border:1px solid rgba(255,255,255,0.05);">
    <h2 style="color:var(--accent2);font-size:1.5rem;margin-bottom:20px;text-align:center;">इस AI टूल के बारे में पूरी जानकारी</h2>
    
    <div style="margin-bottom:30px;">
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:10px;">📖 इस्तेमाल कैसे करें?</h3>
        <ul style="color:var(--sub);line-height:1.8;font-size:0.9rem;">
            <li>सबसे पहले ऊपर दिए गए इनपुट बॉक्स में अपनी जरूरत के अनुसार जानकारी भरें।</li>
            <li>'Generate' बटन पर क्लिक करें और कुछ सेकंड का इंतजार करें।</li>
            <li>AI आपके लिए बेहतरीन परिणाम तैयार करेगा जिसे आप कॉपी या डाउनलोड कर सकते हैं।</li>
        </ul>
    </div>

    <div style="margin-bottom:30px;">
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:10px;">🌟 मुख्य विशेषताएं</h3>
        <ul style="color:var(--sub);line-height:1.8;font-size:0.9rem;">
            <li><strong>तेज़ और सटीक:</strong> हमारा AI मॉडल सेकंडों में परिणाम देता है।</li>
            <li><strong>100% सुरक्षित:</strong> आपका डेटा हमारे पास सुरक्षित रहता है।</li>
            <li><strong>फ्री सर्विस:</strong> सभी टूल्स बिना किसी सब्सक्रिप्शन के इस्तेमाल किए जा सकते हैं।</li>
        </ul>
    </div>

    <div>
        <h3 style="color:#fff;font-size:1.1rem;margin-bottom:10px;">❓ अक्सर पूछे जाने वाले सवाल (FAQs)</h3>
        <div style="margin-bottom:15px;">
            <p style="color:#e2e8f0;font-weight:bold;font-size:0.9rem;">क्या यह टूल फ्री है?</p>
            <p style="color:var(--sub);font-size:0.85rem;">हाँ, Sachin AI Studio के सभी टूल्स पूरी तरह से मुफ्त हैं।</p>
        </div>
        <div style="margin-bottom:15px;">
            <p style="color:#e2e8f0;font-weight:bold;font-size:0.9rem;">क्या मुझे अकाउंट बनाने की जरूरत है?</p>
            <p style="color:var(--sub);font-size:0.85rem;">नहीं, आप बिना लॉगिन किए भी इन टूल्स का उपयोग कर सकते हैं।</p>
        </div>
    </div>
</div>
"""

for file_name in tool_files:
    path = os.path.join(tools_dir, file_name)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if enhancement already exists
    if "how-to-section" in content:
        continue
    
    # Insert before </body>
    if "</body>" in content:
        new_content = content.replace("</body>", enhancement_template + "\n</body>")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Enhanced: {file_name}")
