
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {},
            contents = source && util.getOuterHTML(source);
        var data = {
            config: config,
            content: unit[0].innerHTML + (contents || ''),
        };
        if (data.content && /\S/.test(data.content)){
            data.hasContent = true;
        }
        return data;
    }

    return exports;

});
