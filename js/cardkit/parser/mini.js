
define([
    'dollar',
    'mo/lang',
    './list'
], function($, _, listParser){
    
    function exports(unit, raw){
        var data = listParser(unit, raw);
        data.hasSplitHd = true;
        return data;
    }

    return exports;

});
