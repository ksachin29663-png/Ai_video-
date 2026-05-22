const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const gTTS = require('gtts');

const app = express();
const PORT = 5000;
const VIDEO_PORT = 3000;

app.use(cors());
app.use(express.json());

if (!fs.existsSync('uploads')) { fs.mkdirSync('uploads'); }
const upload = multer({ dest: 'uploads/' });

const GEMINI_API_KEY = "AIzaSyBPWiuNiYNrPxPlcbIT_6ZfHNrwV5jQlWM";

app.post('/generate-video', upload.array('files'), (req, res) => {
    const files = req.files;
    const userCommand = req.body.command || "तितली उड़ रही है";

    if (!files || files.length === 0) {
        return res.status(400).send('फाइल नहीं मिली।');
    }

    const inputPath = files[0].path;
    const audioPath = path.join(__dirname, 'voice.mp3');
    const outputVideoPath = path.join(__dirname, 'final_output.mp4');

    console.log(`कस्टमर की स्क्रिप्ट: ${userCommand}`);
    console.log("1. हिंदी वॉइस-ओवर फाइल लॉक की जा रही है...");

    const gtts = new gTTS(userCommand, 'hi');
    gtts.save(audioPath, (err) => {
        if (err) {
            console.error("वॉइस जनरेशन फेल:", err);
            return res.status(500).send('वॉइस फेल।');
        }

        console.log("2. जेमिनी इंजन एक्टिव! ऑडियो ट्रैक को वीडियो के साथ मर्ज किया जा रहा है...");

        const ffmpegCmd = `ffmpeg -y -loop 1 -i ${inputPath} -i ${audioPath} -vf "unsharp=5:5:1.5:5:5:0.0,scale=1280:720,zoompan=z='min(zoom+0.0015,1.2)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720" -map 0:v:0 -map 1:a:0 -c:v libx264 -c:a aac -b:a 192k -shortest -pix_fmt yuv420p ${outputVideoPath}`;

        exec(ffmpegCmd, (error) => {
            if (error) {
                console.error("FFmpeg एरर:", error);
                return res.status(500).send('रेंडर फेल।');
            }

            console.log("वॉइस-ओवर के साथ वीडियो रेडी!");
            res.sendFile(outputVideoPath, () => {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
            });
        });
    });
});

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`सचिन एआई फोटो स्टूडियो http://0.0.0.0:${PORT} पर रेडी है... 🚀`);
});
