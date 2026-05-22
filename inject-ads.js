const fs = require('fs');
const path = require('path');

const AD_HTML = `
<!-- ===== ADSTERRA ADS START ===== -->
<!-- 1. Popunder -->
<script type="text/javascript" src="https://pl29487642.effectivecpmnetwork.com/99/2e/66/992e666bbb3d92cdc222c614640658d00.js"></script>
<!-- 2. Social Bar -->
<script type="text/javascript" src="https://pl29470507.effectivecpmnetwork.com/16/a8/85/16a885ab5decd866c8172097a528540e.js"></script>
<!-- 3. 320x50 Banner -->
<div style="text-align:center;margin:8px auto;overflow:hidden;max-width:100%;">
<script type="text/javascript">atOptions={'key':'b1c2005cd8e1095bc458e4c59f785aa9','format':'iframe','height':50,'width':320,'params':{}};</script>
<script type="text/javascript" src="https://www.highperformanceformat.com/b1c2005cd8e1095bc458e4c59f785aa9/invoke.js"></script>
</div>
<!-- 4. Native Banner -->
<div style="text-align:center;margin:8px auto;max-width:100%;">
<script async="async" data-cfasync="false" src="https://pl29470505.effectivecpmnetwork.com/30a2c535b11a237c281ced645d908d88/invoke.js"></script>
<div id="container-30a2c535b11a237c281ced645d908d88"></div>
</div>
<!-- ===== ADSTERRA ADS END ===== -->
`;

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
let updated = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    // Remove old injected block if present
    content = content.replace(/\n<!-- ===== ADSTERRA ADS START ===== -->[\s\S]*?<!-- ===== ADSTERRA ADS END ===== -->\n/g, '');
    // Inject before </body>
    if (content.includes('</body>')) {
        content = content.replace('</body>', AD_HTML + '</body>');
        fs.writeFileSync(file, content, 'utf8');
        updated++;
        console.log('✅ Updated:', file);
    } else {
        console.log('⚠️  No </body> found:', file);
    }
});

console.log(`\nDone! Updated ${updated}/${files.length} files.`);
