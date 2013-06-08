
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    function exports(cfg, raw){
        cfg = $(cfg);
        var source = util.getSource(cfg, raw),
            config = {
                limit: cfg.data('cfgLimit') || 1
            },
            items = source && source.find('.ckd-item').map(function(elm){
                return util.getItemDataOuter(elm, null, 'item');
            }) || $(),
            overflow_items = source && source.find('.ckd-overflow-item').map(function(elm){
                return util.getItemDataOuter(elm, null, 'overflow-item');
            }) || $(),
            custom_items = util.getCustom('.ckd-item', cfg, raw, util.getItemDataOuter, 'item'),
            custom_overflow_items = util.getCustom('.ckd-overflow-item', cfg, raw, util.getItemDataOuter, 'overflow-item');
        if (source === false && !custom_items.length) {
            return false;
        }
        var data = {
            config: config,
            items: custom_items.concat(items || $()),
            overflowItems: custom_overflow_items.concat(overflow_items || $())
        };
        return data;
    }

    return exports;

});
