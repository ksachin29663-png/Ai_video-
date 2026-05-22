(function () {
    'use strict';

    var ADS = {
        popunder: 'https://pl29487642.effectivecpmnetwork.com/99/2e/66/992e666bbb3d92cdc222c614640658d00.js',
        socialBar: 'https://pl29470507.effectivecpmnetwork.com/16/a8/85/16a885ab5decd866c8172097a528540e.js',
        nativeBannerSrc: 'https://pl29470505.effectivecpmnetwork.com/30a2c535b11a237c281ced645d908d88/invoke.js',
        nativeBannerContainerId: 'container-30a2c535b11a237c281ced645d908d88',
        banner320_50: 'b1c2005cd8e1095bc458e4c59f785aa9',
        banner728_header: { key: '5e113b8022609e2135c5e1e265084235', w: 728, h: 90 },
        banner300_content: { key: '817c9252a9900f63d05a904142664916', w: 300, h: 250 },
        banner468_mid: { key: '00fb56288558ecc1739a3c6e5cd76c95', w: 468, h: 60 },
        banner728_footer: { key: 'c78bd0096e420743c110e00865957c18', w: 728, h: 90 },
        banner160_float: { key: '704967a6af9d8e2ae72c5cd5ee7b5271', w: 160, h: 600 },
    };

    function loadScript(src) {
        var s = document.createElement('script');
        s.type = 'text/javascript';
        s.src = src;
        s.async = true;
        document.head.appendChild(s);
    }

    function createAdUnit(key, width, height, extraStyle) {
        var wrapper = document.createElement('div');
        wrapper.className = 'sachin-ad-unit';
        wrapper.style.cssText = 'display:block;text-align:center;margin:10px auto;line-height:0;' + (extraStyle || '');
        var s1 = document.createElement('script');
        s1.type = 'text/javascript';
        s1.text = "atOptions={'key':'" + key + "','format':'iframe','height':" + height + ",'width':" + width + ",'params':{}};";
        var s2 = document.createElement('script');
        s2.type = 'text/javascript';
        s2.src = 'https://www.highperformanceformat.com/' + key + '/invoke.js';
        wrapper.appendChild(s1);
        wrapper.appendChild(s2);
        return wrapper;
    }

    function createNativeBanner() {
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'text-align:center;margin:10px auto;max-width:100%;';
        var s = document.createElement('script');
        s.async = true;
        s.setAttribute('data-cfasync', 'false');
        s.src = ADS.nativeBannerSrc;
        var d = document.createElement('div');
        d.id = ADS.nativeBannerContainerId;
        wrapper.appendChild(s);
        wrapper.appendChild(d);
        return wrapper;
    }

    function create320x50Banner() {
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'text-align:center;margin:10px auto;max-width:100%;overflow:hidden;';
        var s1 = document.createElement('script');
        s1.type = 'text/javascript';
        s1.text = "atOptions={'key':'" + ADS.banner320_50 + "','format':'iframe','height':50,'width':320,'params':{}};";
        var s2 = document.createElement('script');
        s2.type = 'text/javascript';
        s2.src = 'https://www.highperformanceformat.com/' + ADS.banner320_50 + '/invoke.js';
        wrapper.appendChild(s1);
        wrapper.appendChild(s2);
        return wrapper;
    }

    function insertAfter(newEl, refEl) {
        if (refEl && refEl.parentNode) {
            refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
        }
    }

    function injectAds() {
        var isMobile = window.innerWidth < 768;
        var isDesktop = window.innerWidth >= 992;

        // 1. Popunder (fires on page load)
        loadScript(ADS.popunder);

        // 2. Social Bar (sticky bottom bar)
        loadScript(ADS.socialBar);

        // 3. After <header>: 728x90 leaderboard
        var header = document.querySelector('header');
        if (header) {
            var hAd = createAdUnit(
                ADS.banner728_header.key, ADS.banner728_header.w, ADS.banner728_header.h,
                'max-width:100%;overflow:hidden;background:rgba(0,0,0,0.3);padding:4px 0;'
            );
            insertAfter(hAd, header);
        }

        // 4. Native Banner after first card/section
        var firstCard = document.querySelector('.card, .studio-container, main > div');
        if (firstCard) {
            var nativeBanner = createNativeBanner();
            insertAfter(nativeBanner, firstCard);
        }

        // 5. 320x50 banner in middle of page
        var allCards = document.querySelectorAll('.card');
        if (allCards.length >= 2) {
            var midCard = allCards[Math.floor(allCards.length / 2)];
            insertAfter(create320x50Banner(), midCard);
        } else if (allCards.length === 0) {
            var main = document.querySelector('main');
            if (main) main.appendChild(create320x50Banner());
        }

        // 6. After hero section: 300x250 rectangle
        var hero = document.querySelector('.hero');
        if (hero) {
            var hRec = createAdUnit(
                ADS.banner300_content.key, ADS.banner300_content.w, ADS.banner300_content.h,
                'width:300px;'
            );
            insertAfter(hRec, hero);
        }

        // 7. After grid (index page)
        var grid = document.querySelector('.grid');
        if (grid) {
            var gAd = createAdUnit(
                ADS.banner300_content.key, ADS.banner300_content.w, ADS.banner300_content.h,
                'width:300px;margin:16px auto;'
            );
            insertAfter(gAd, grid);
        }

        // 8. Before footer: 728x90 footer banner
        var footer = document.querySelector('footer');
        if (footer) {
            var fAd = createAdUnit(
                ADS.banner728_footer.key, ADS.banner728_footer.w, ADS.banner728_footer.h,
                'max-width:100%;overflow:hidden;padding:6px 0;'
            );
            footer.parentNode.insertBefore(fAd, footer);
        }

        // 9. Desktop floating sidebar 160x600
        if (isDesktop) {
            var sideAd = createAdUnit(
                ADS.banner160_float.key, ADS.banner160_float.w, ADS.banner160_float.h, ''
            );
            sideAd.style.cssText = 'position:fixed;right:4px;top:50%;transform:translateY(-50%);z-index:8888;width:160px;';
            document.body.appendChild(sideAd);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectAds);
    } else {
        injectAds();
    }
})();
