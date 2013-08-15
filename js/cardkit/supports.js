define([
    'mo/browsers',
    'cardkit/env'
], function(browsers, env){

    var window = this,
        document = window.document,
        body = document.body,
        is_android = browsers.os === 'android',
        is_ios = browsers.os === 'iphone' || browsers.os === 'ipad',
        is_ios5 = is_ios && parseFloat(browsers.osversion) < 6,
        is_ios7 = parseFloat(browsers.osversion) >= 7,
        is_mobilefirefox = browsers.mozilla && is_android,
        is_webview = browsers.webview 
            || /micromessenger/.test(browsers.ua),
        is_aosp_like = is_android 
            && !browsers.chrome 
            && !is_mobilefirefox,
        is_desktop = browsers.os === 'mac'
            || browsers.os === 'windows'
            || browsers.os === 'linux';

    var exports = {
    
        //HISTORY: 'pushState' in history
            //&& !browsers.crios 
            //&& !is_aosp_like
            //&& !is_mobilefirefox
            //&& !is_ios5,

        GOBACK_WHEN_POP: !is_ios5
            && !is_aosp_like,

        REPLACE_HASH: !is_ios5
            && !is_aosp_like,

        BROWSER_CONTROL: is_desktop
            || browsers.mobilesafari
            || is_webview
            || is_android && browsers.chrome,

        NO_POP_ON_CACHED_PAGE: is_mobilefirefox, 

        RESIZE_WHEN_SCROLL: is_mobilefirefox,

        FIXED_BOTTOM_BUGGY: browsers.crios,

        NEW_WIN: !is_ios5 
            && !is_aosp_like,

        CARD_SCROLL: !is_desktop
            && !is_aosp_like,

        HIDE_ADDRESSBAR: !browsers.crios,

        PREVENT_WINDOW_SCROLL: !!browsers.mobilesafari,

        FULLSCREEN_MODE: typeof env.fullscreenMode !== 'undefined' 
            ? env.fullscreenMode 
            : is_webview,

        FOLDABLE_URLBAR: browsers.mobilesafari && !is_ios7

    };

    exports.SAFARI_OVERFLOWSCROLL = "webkitOverflowScrolling" in body.style
        && (exports.CARD_SCROLL || is_ios5);

    //exports.PREVENT_CACHE = browsers.aosp 
        //|| browsers.mobilesafari && !exports.HISTORY;

    //exports.UNIVERSAL_TRANS = exports.HISTORY
        //&& exports.CARD_SCROLL
        //&& !browsers.aosp 
        //&& !is_ios5
        //&& !is_desktop;

    exports.WINDOW_SCROLL = !exports.CARD_SCROLL 
        || is_android;

    return exports;

});
