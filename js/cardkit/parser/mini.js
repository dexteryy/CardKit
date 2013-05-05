
define([
    'dollar',
    'mo/lang',
    './list'
], function($, _, listParser){
    
    function exports(unit, raw){
        var data = listParser(unit, raw);
        return data;
    }

    return exports;

});
