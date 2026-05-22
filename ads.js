(function () {
    'use strict';

    // ---- Ad Keys ----
    var ADS = {
        popunder: '//pl29470504.highratecpm.com/78/e8/14/78e81414ae961509619ed88e55ee6b65.js',
        socialBar: '//pl29487645.highratecpm.com/3d/91/a6/3d91a6192e093f8c53c10a099f6d2a764.js',
        banner728_header: { key: '5e113b8022609e2135c5e1e265084235', w: 728, h: 90 },
        banner160_side: { key: '08830bb1c7d986964025599725f9926c', w: 160, h: 600 },
        banner468_mid: { key: '00fb56288558ecc1739a3c6e5cd76c95', w: 468, h: 60 },
        banner300_content: { key: '817c9252a9900f63d05a904142664916', w: 300, h: 250 },
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
        wrapper.setAttribute('data-ad-key', key);
        var base = 'display:block;text-align:center;margin:10px auto;line-height:0;';
        wrapper.style.cssText = base + (extraStyle || '');

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

    function insertAfter(newEl, refEl) {
        if (refEl && refEl.parentNode) {
            refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
        }
    }

    function injectAds() {
        var isMobile = window.innerWidth < 768;
        var isDesktop = window.innerWidth >= 992;

        // 1. Popunder
        loadScript(ADS.popunder);

        // 2. Social Bar (fires at end of body)
        loadScript(ADS.socialBar);

        // 3. After <header>: 728x90 (leaderboard)
        var header = document.querySelector('header');
        if (header) {
            var hAd = createAdUnit(
                ADS.banner728_header.key, ADS.banner728_header.w, ADS.banner728_header.h,
                'max-width:100%;overflow:hidden;background:rgba(0,0,0,0.3);padding:4px 0;'
            );
            insertAfter(hAd, header);
        }

        // 4. After hero / first section: 300x250 (rectangle)
        var hero = document.querySelector('.hero, .studio-container');
        if (hero) {
            var hRec = createAdUnit(
                ADS.banner300_content.key, ADS.banner300_content.w, ADS.banner300_content.h,
                'width:300px;'
            );
            insertAfter(hRec, hero);
        }

        // 5. After first .card or mid main: 468x60
        var firstCard = document.querySelector('.card');
        if (firstCard) {
            var midAd = createAdUnit(
                ADS.banner468_mid.key, ADS.banner468_mid.w, ADS.banner468_mid.h,
                'max-width:100%;'
            );
            insertAfter(midAd, firstCard);
        }

        // 6. Before footer: 728x90 (footer banner)
        var footer = document.querySelector('footer');
        if (footer) {
            var fAd = createAdUnit(
                ADS.banner728_footer.key, ADS.banner728_footer.w, ADS.banner728_footer.h,
                'max-width:100%;overflow:hidden;padding:6px 0;'
            );
            footer.parentNode.insertBefore(fAd, footer);
        }

        // 7. Grid/feed: rectangle after .grid (index page)
        var grid = document.querySelector('.grid');
        if (grid) {
            var gAd = createAdUnit(
                ADS.banner300_content.key, ADS.banner300_content.w, ADS.banner300_content.h,
                'width:300px;margin:16px auto;'
            );
            insertAfter(gAd, grid);
        }

        // 8. Desktop floating sidebar 160x600 (right side)
        if (isDesktop) {
            var sideAd = createAdUnit(
                ADS.banner160_float.key, ADS.banner160_float.w, ADS.banner160_float.h,
                ''
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
