define('moui/modalview', [
    'dollar',
    'mo/lang',
    'mo/network',
    'mo/template',
    'moui/overlay'
], function($, _, net, tpl, overlay) {

    var body = $('body'),
        mix = _.mix,

        NS = 'mouiModalView',
        TPL_VIEW =
           '<div id="{{id}}" class="moui-modalview">\
                <div class="shd"></div>\
                <div class="wrapper">\
                    <header><div>\
                        <div class="confirm"></div>\
                        <div class="cancel"></div>\
                        <h1></h1>\
                    </div></header>\
                    <div class="moui-modalview-content"></div>\
                </div>\
            </div>',
        TPL_BTN = '<button class="{{type}}" data-default={{isDefault}}>{{text}}</button>',

        button_config = {
            'confirm': {
                type: 'confirm',
                text: '确定',
                isDefault: true,
                method: function(modal) {
                    modal.submit(function() {
                        modal.hideLoading();
                        modal.close();
                    });
                    modal.showLoading('提交中');
                }
            }, 
            'cancel': {
                type: 'cancel',
                text: '取消',
                method: function(modal) {
                    modal.close();
                }
            }
        },

        default_config = mix(overlay.Overlay.prototype, {
            url: null,
            buttons: ['confirm', 'cancel']
        });


    var ModalView = _.construct(overlay.Overlay, function(opt){
        this.init(opt);
        var self = this,
            handlers = this._btnHandlers = {};
        this._wrapper = this._node.find('.wrapper').eq(0);
        this._content = this._wrapper.find('.moui-modalview-content');
        this._confirmBtn = this._header.find('.confirm');
        this._cancelBtn = this._header.find('.cancel');
        this._confirmBtn.concat(this._cancelBtn).bind('click', function(e){
            (handlers[this.className] || nothing).call(this, self, e);
        });
        this.set(this._config);
    });

    mix(ModalView.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: default_config,

        set: function(opt) {

            this.superClass.set.call(this, opt);
            var self = this;

            if (opt.buttons && opt.buttons.length > 0) {
                var handlers = this._btnHandlers, 
                    btn_lib = _.index(opt.buttons, 'type');
                default_config.buttons.forEach(function(type) {
                    var btn = btn_lib[type];
                    btn = btn && mix({}, button_config[type], 
                        typeof btn === 'object' ? btn : {}) || {};
                    handlers[type] = btn.method;
                    this['_' + type + 'Btn'].html(function(){
                        return btn && tpl.format(TPL_BTN, btn) || '';
                    });
                }, this);
            }

            if (opt.url) {
                self.showLoading();
                net.ajax({
                    url: opt.url,
                    dataType: 'text',
                    success: function(html){
                        self.setContent(html);
                        self.hideLoading();
                    }
                });
            }

            return this;

        },

        submit: function(callback){
            this._content.find('form').bind(callback).trigger('submit');
        },

        close: function() {
            var self = this;
            this.event.fire('close', [this]);
            setTimeout(function(){
                self._node.removeClass('active');
            }, 400);
            return this;
        },

        destroy: function() {
            this._btnHandlers = {};
            return this.superClass.destroy.call(this);
        }

    });

    function nothing(){}

    function exports(opt) {
        return new ModalView(opt);
    }

    exports.ModalView = ModalView;

    return exports;

});
