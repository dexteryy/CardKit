
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
            custom_items = util.getCustom('.ckd-item', cfg, raw, util.getItemDataOuter, 'item');
        var data = {
            config: config,
            items: custom_items.concat(items || $())
        };
        data.overflowItems = data.items.splice(config.limit);
        return data;
    }

    return exports;

});
