/**
 * Copyright (C) 2011, Dexter.Yy, MIT License
 */
define("mod/browsers", [], function(){

    var match, shell, 
        rank = { 
            "360ee": 2,
            "maxthon/3": 2,
            "qqbrowser": 2,
            "metasr": 2,
            "360se": 1,
            "theworld": 1,
            "maxthon": 1,
            "tencenttraveler": -1
        };

    try {
        var ua = navigator.userAgent.toLowerCase(),
            rmobilesafari = /apple.*mobile.*safari/,
            rwebkit = /(webkit)[ \/]([\w.]+)/,
            ropera = /(opera)(?:.*version)?[ \/]([\w.]+)/,
            rmsie = /(msie) ([\w.]+)/,
            rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;

        var r360se = /(360se)/,
            r360ee = /(360ee)/,
            rtheworld = /(theworld)/,
            rmaxthon3 = /(maxthon\/3)/,
            rmaxthon = /(maxthon)\s/,
            rtt = /(tencenttraveler)/,
            rqq = /(qqbrowser)/,
            rmetasr = /(metasr)/;

        match = rmobilesafari.test(ua) && [0, "mobilesafari"] ||
            rwebkit.exec(ua) ||
            ropera.exec(ua) ||
            rmsie.exec(ua) ||
            ua.indexOf("compatible") < 0 && rmozilla.exec(ua) ||
            [];

        shell = r360se.exec(ua) || r360ee.exec(ua) || rtheworld.exec(ua) || 
            rmaxthon3.exec(ua) || rmaxthon.exec(ua) ||
            rtt.exec(ua) || rqq.exec(ua) ||
            rmetasr.exec(ua) || [];

    } catch (ex) {
        match = [];
        shell = [];
    }

    var result = { 
        browser: match[1] || "", 
        version: match[2] || "0",
        shell: shell[1] || ""
    };
    if (match[1]) {
        result[match[1]] = parseInt(result.version, 10) || true;
    }
    if (shell[1]) {
        result.rank = rank[result.shell] || 0;
    }

    return result;

});
