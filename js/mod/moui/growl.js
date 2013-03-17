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
            </div>',
        CORNER = 'corner-',

        default_config = {
            className: 'moui-growl',
            corner: 'center',
            expires: 1400,
            keepalive: false
        };

    var Growl = _.construct(overlay.Overlay);

    _.mix(Growl.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: _.merge({}, default_config, Growl.prototype._defaults),

        set: function(opt) {
            this.superClass.set.call(this, opt);

            if (opt.corner && opt.corner !== this._currentCorner) {
                if (this._currentCorner) {
                    this._node.removeClass(CORNER + this._currentCorner);
                }
                this._node.addClass(CORNER + opt.corner);
                this._currentCorner = opt.corner;
            }

            return this;
        },

        open: function(){
            clearTimeout(this._exptimer);
            if (this._config.expires != -1) {
                var self = this;
                this._exptimer = setTimeout(function(){
                    self.close();
                }, this._config.expires);
            }
            return this.superClass.open.call(this);
        },

        close: function(){
            if (!this.isOpened) {
                return;
            }
            this.isOpened = false;
            this.event.fire('close', [this]);
            this._node.removeClass('active');
            if (!this._config.keepalive) {
                this.destroy();
            }
            return this;
        }

    });

    function exports(opt){
        return new exports.Growl(opt);
    }

    exports.Growl = Growl;

    return exports;

});
