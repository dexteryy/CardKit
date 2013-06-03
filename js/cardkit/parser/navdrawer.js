
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    var getCustom = util.getCustom,
        getHd = util.getHd,
        getItemDataOuter = util.getItemDataOuter;

    function exports(cfg, raw){
        cfg = $(cfg);
        var source = util.getSource(cfg, raw),
            config = {},
            hd = getHd(source && source.find('.ckd-hd')),
            contents = source && source.find('.ckd-content').map(function(elm){
                return getCustom('.ckd-content', elm, raw, getItemDataOuter, 'content').join('') 
                    || util.getInnerHTML(elm);
            }) || $(),
            custom_hd = getCustom('.ckd-hd', cfg, raw, getHd)[0] || {},
            custom_contents = getCustom('.ckd-content', cfg, raw, getItemDataOuter, 'content').join('') 
                    || '';
        var data = {
            config: config,
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            content: custom_contents + contents.join(''),
        };
        return data;
    }

    return exports;

});
