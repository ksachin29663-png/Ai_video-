const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crcVal]);
}

function makePNG(W, H, pixel) {
    const sig = Buffer.from([137,80,78,71,13,10,26,10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4);
    ihdr[8]=8; ihdr[9]=2;
    const raw = Buffer.alloc(H*(W*3+1));
    for (let y=0;y<H;y++) {
        raw[y*(W*3+1)]=0;
        for (let x=0;x<W;x++) {
            const [r,g,b] = pixel(x,y);
            const o = y*(W*3+1)+1+x*3;
            raw[o]=r; raw[o+1]=g; raw[o+2]=b;
        }
    }
    const idat = zlib.deflateSync(raw, {level:9});
    return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

const W=64, H=64;
const png = makePNG(W, H, (x, y) => {
    const cx=32, cy=32;
    const dx=x-cx, dy=y-cy;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const rx=Math.abs(x-cx), ry=Math.abs(y-cy);

    // Rounded rect boundary
    const inRR = rx<=27 && ry<=27 && !(rx>18 && ry>18 && Math.sqrt((rx-18)**2+(ry-18)**2)>9);
    if (!inRR) return [10,14,26];

    // Gradient: purple(124,58,237) -> cyan(0,255,204)
    const t = Math.min(1, Math.max(0, (x+y)/120));
    const gr = Math.round(124*(1-t));
    const gg = Math.round(58*(1-t)+255*t);
    const gb = Math.round(237*(1-t)+204*t);

    // Outer camera ring
    if (dist>=13 && dist<=18) return [gr,gg,gb];
    // Inner lens dot
    if (dist<=7) return [gr,gg,gb];
    // Horizontal line (lens line)
    if (Math.abs(y-37)<=1 && rx<=22) return [gr,gg,gb];
    // "AI" bottom text row  
    if (y>=46 && y<=49) {
        // A
        if (x>=17&&x<=22) { if(y===46||y===49||(x===19&&y>=46&&y<=49)||(Math.abs(x-19.5)<=2.5&&y===48)) return [230,255,248]; }
        // I
        if (x>=26&&x<=30&&(y===46||y===49)) return [230,255,248];
        if (x===28&&y>=46&&y<=49) return [230,255,248];
        // S
        if (x>=33&&x<=38) {
            if(y===46||y===49) return [230,255,248];
            if(x===33&&y<=47) return [230,255,248];
            if(x===38&&y>=48) return [230,255,248];
            if(y===47||y===48) return [230,255,248];
        }
        // T  
        if (x>=41&&x<=47) {
            if(y===46) return [230,255,248];
            if(x===44&&y>=46&&y<=49) return [230,255,248];
        }
    }
    return [10,14,26];
});

fs.writeFileSync('favicon.png', png);
console.log('✅ favicon.png created:', png.length, 'bytes');

// Also make 192x192 for Open Graph / PWA
const png192 = makePNG(192, 192, (x, y) => {
    const cx=96, cy=96;
    const dx=x-cx, dy=y-cy;
    const dist = Math.sqrt(dx*dx+dy*dy);
    const rx=Math.abs(x-cx), ry=Math.abs(y-cy);
    const inRR = rx<=85 && ry<=85 && !(rx>55 && ry>55 && Math.sqrt((rx-55)**2+(ry-55)**2)>30);
    if (!inRR) return [10,14,26];
    const t = Math.min(1,Math.max(0,(x+y)/360));
    const gr=Math.round(124*(1-t));
    const gg=Math.round(58*(1-t)+255*t);
    const gb=Math.round(237*(1-t)+204*t);
    if (dist>=38 && dist<=54) return [gr,gg,gb];
    if (dist<=21) return [gr,gg,gb];
    if (Math.abs(y-110)<=3 && rx<=66) return [gr,gg,gb];
    return [10,14,26];
});
fs.writeFileSync('logo192.png', png192);
console.log('✅ logo192.png created:', png192.length, 'bytes');
