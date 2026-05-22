const fs = require('fs');

const AD_BLOCK = `
<!-- ===== ADSTERRA ADS START ===== -->
<!-- Popunder -->
<script type="text/javascript" src="https://pl29487642.effectivecpmnetwork.com/99/2e/66/992e666bbb3d92cdc222c614640658d00.js"></script>
<!-- Social Bar -->
<script type="text/javascript" src="https://pl29470507.effectivecpmnetwork.com/16/a8/85/16a885ab5decd866c8172097a528540e.js"></script>
<!-- 320x50 Mobile Banner -->
<div id="sachin-ad-320" style="display:block;text-align:center;background:linear-gradient(90deg,#0a0e1a,#0d1225);border-top:1px solid rgba(99,102,241,0.3);border-bottom:1px solid rgba(99,102,241,0.3);padding:3px 0;width:100%;min-height:56px;overflow:hidden;">
<script type="text/javascript">atOptions={'key':'b1c2005cd8e1095bc458e4c59f785aa9','format':'iframe','height':50,'width':320,'params':{}};</script>
<script type="text/javascript" src="https://www.highperformanceformat.com/b1c2005cd8e1095bc458e4c59f785aa9/invoke.js"></script>
</div>
<!-- 728x90 Leaderboard Banner -->
<div id="sachin-ad-728" style="display:block;text-align:center;background:linear-gradient(90deg,#0a0e1a,#0d1225);padding:3px 0;width:100%;min-height:96px;overflow:hidden;">
<script type="text/javascript">atOptions={'key':'5e113b8022609e2135c5e1e265084235','format':'iframe','height':90,'width':728,'params':{}};</script>
<script type="text/javascript" src="https://www.highperformanceformat.com/5e113b8022609e2135c5e1e265084235/invoke.js"></script>
</div>
<!-- Native Banner -->
<div style="text-align:center;margin:6px auto;max-width:100%;min-height:60px;">
<script async="async" data-cfasync="false" src="https://pl29470505.effectivecpmnetwork.com/30a2c535b11a237c281ced645d908d88/invoke.js"></script>
<div id="container-30a2c535b11a237c281ced645d908d88"></div>
</div>
<!-- 300x250 Rectangle -->
<div id="sachin-ad-300" style="display:block;text-align:center;margin:8px auto;width:100%;min-height:254px;overflow:hidden;">
<script type="text/javascript">atOptions={'key':'817c9252a9900f63d05a904142664916','format':'iframe','height':250,'width':300,'params':{}};</script>
<script type="text/javascript" src="https://www.highperformanceformat.com/817c9252a9900f63d05a904142664916/invoke.js"></script>
</div>
<!-- ===== ADSTERRA ADS END ===== -->
`;

// Also inject a mid-page ad banner (before </main> or mid-content)
const MID_AD = `<!-- Mid-Page Ad -->
<div style="text-align:center;margin:12px auto;width:100%;min-height:56px;overflow:hidden;">
<script type="text/javascript">atOptions={'key':'b1c2005cd8e1095bc458e4c59f785aa9','format':'iframe','height':50,'width':320,'params':{}};</script>
<script type="text/javascript" src="https://www.highperformanceformat.com/b1c2005cd8e1095bc458e4c59f785aa9/invoke.js"></script>
</div>`;

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
let updated = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Remove ALL previous injections
    content = content.replace(/\n?<!-- ===== ADSTERRA ADS START ===== -->[\s\S]*?<!-- ===== ADSTERRA ADS END ===== -->\n?/g, '');
    content = content.replace(/\n?<!-- Mid-Page Ad -->[\s\S]*?<\/div>\n?/g, '');

    // Fix broken absolute paths for GitHub Pages subfolder
    content = content.replace(/src="\/ads\.js"/g, 'src="ads.js"');
    content = content.replace(/src="\/tracker\.js"/g, 'src="tracker.js"');

    // Remove old ads.js script tag entirely (we use direct embeds now)
    content = content.replace(/<script src="ads\.js"><\/script>\s*/g, '');
    content = content.replace(/<script src="\/ads\.js"><\/script>\s*/g, '');

    // Inject mid-page ad before </main> if exists
    if (content.includes('</main>')) {
        content = content.replace('</main>', MID_AD + '\n</main>');
    }

    // Inject full ad block before </body>
    if (content.includes('</body>')) {
        content = content.replace('</body>', AD_BLOCK + '</body>');
        fs.writeFileSync(file, content, 'utf8');
        updated++;
        process.stdout.write('✅ ' + file + '\n');
    }
});

console.log('\nTotal updated: ' + updated + '/' + files.length);
