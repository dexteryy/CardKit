define('moui/growl', [
    'dollar',
    'mo/lang',
    'mo/template',
    'moui/overlay'
], function($, _, tpl, overlay) {

    var NS = 'mouiGrowl',
        TPL_VIEW =
           '<div id="{{id}}" class="moui-growl">\
                <header><h2></h2></header>\
                <article></article>\
            </div>';

    var Growl = _.construct(overlay.Overlay);

    function exports(opt){
        return new exports.Growl(opt);
    }

    _.mix(Growl.prototype, {

        _ns: NS,
        _template: TPL_VIEW

    });

    exports.Growl = Growl;

    return exports;

});
