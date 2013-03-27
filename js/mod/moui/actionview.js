define('moui/actionview', [
    'dollar',
    'mo/lang',
    'mo/template/string',
    'moui/overlay',
    'moui/picker'
], function($, _, tpl, overlay, picker) {

    var mix = _.mix,

        NS = 'mouiActionView',
        TPL_VIEW = 
            '<div id="{{id}}" class="{{cname}}">\
                <div class="shd"></div>\
                <div class="wrapper">\
                    <div class="content">\
                        <header><h1></h1></header>\
                        <div class="desc"></div>\
                        <article></article>\
                    </div>\
                </div>\
                <footer>\
                    <button class="confirm" data-is-default="true"></button>\
                    <button class="cancel"></button>\
                </footer>\
            </div>',

        default_config = {
            className: 'moui-actionview',
            confirmText: '确认',
            cancelText: '取消',
            options: null,
            multiselect: false
        };

    var ActionView = _.construct(overlay.Overlay);

    mix(ActionView.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: _.merge({}, default_config, ActionView.prototype._defaults),

        init: function(opt) {
            this.superClass.init.call(this, opt);
            this._wrapper = this._node.find('.wrapper').eq(0);
            this._actionsWrapper = this._content;
            this._wrapperContent = this._wrapper.find('.content').eq(0);
            this._content = this._wrapper.find('.desc').eq(0);
            this._footer = this._node.find('footer').eq(-1);
            this._confirmBtn = this._footer.find('.confirm');
            this._cancelBtn = this._footer.find('.cancel');
            return this;
        },

        set: function(opt) {
            if (!opt) {
                return this;
            }
            this.superClass.set.call(this, opt);

            if (opt.options) {
                var options = $(opt.options).clone();
                this._actionsWrapper.empty()
                    .append(options);
                this._picker = picker(this._actionsWrapper, {
                    options: options,
                    multiselect: this._config.multiselect,
                    ignoreStatus: !this._config.multiselect
                });
            }

            if (opt.multiselect !== undefined) {
                if (opt.multiselect) {
                    this._footer.addClass('multi');
                } else {
                    this._confirmBtn.removeClass('multi');
                }
            }

            if (opt.confirmText) {
                this._confirmBtn.html(opt.confirmText);
            }

            if (opt.cancelText) {
                this._cancelBtn.html(opt.cancelText);
            }

            return this;
        },

        val: function(){
            if (this._picker) {
                return this._picker.val();
            }
        },

        confirm: function(){
            this.event.fire('confirm', [this, this._picker]);
            return this.done();
        },

        cancel: function(){
            this.event.fire('cancel', [this, this.picker]);
            return this.done();
        },

        done: function(){
            return this.close();
        },

        open: function(){
            if (this.isOpened) {
                return;
            }
            if (!this._config.multiselect && this._picker) {
                var self = this;
                this._picker.event.once('change', function(){
                    self.confirm();
                });
            }
            return this.superClass.open.call(this);
        },

        close: function(){
            if (!this.isOpened) {
                return;
            }
            if (!this._config.multiselect && this._picker) {
                this._picker.event.reset();
            }
            return this.superClass.close.call(this);
        }

    });

    ['select', 'unselect', 'undo',
        'selectAll', 'unselectAll', 'selectInvert'].forEach(function(method){
        this[method] = function(){
            return this._picker[method].apply(this._picker, arguments);
        };
    }, ActionView.prototype);

    function exports(opt) {
        return new exports.ActionView(opt);
    }

    exports.ActionView = ActionView;

    return exports;

});
