define('moui/modalview', [
    'dollar',
    'mo/lang',
    'mo/template/string',
    'moui/overlay'
], function($, _, tpl, overlay) {

    var mix = _.mix,

        NS = 'mouiModalView',
        TPL_VIEW =
           '<div id="{{id}}" class="moui-modalview">\
                <div class="shd"></div>\
                <div class="wrapper">\
                    <header>\
                        <div class="confirm"></div>\
                        <div class="cancel"></div>\
                        <h1></h1>\
                    </header>\
                    <article><div class="content"></div></article>\
                </div>\
            </div>',
        TPL_BTN = '<button class="{{type}}" data-is-default="{{isDefault}}">{{text}}</button>',

        button_config = {
            'confirm': {
                type: 'confirm',
                text: '确定',
                isDefault: true,
                method: function(modal) {
                    modal.event.fire('confirm', [modal]);
                }
            }, 
            'cancel': {
                type: 'cancel',
                text: '取消',
                method: function(modal) {
                    modal.event.fire('cancel', [modal]);
                    modal.done();
                }
            }
        },

        default_config = mix(overlay.Overlay.prototype, {
            buttons: ['confirm', 'cancel']
        });


    var ModalView = _.construct(overlay.Overlay, function(opt){
        this.init(opt);
        var self = this,
            handlers = this._btnHandlers = {};
        this._wrapper = this._node.find('.wrapper').eq(0);
        this._contentWrapper = this._wrapper.find('article').eq(0);
        this._content = this._contentWrapper.find('.content').eq(0);
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

            var self = this;
            self.superClass.set.call(self, opt);

            if (opt.buttons && opt.buttons.length > 0) {
                var handlers = self._btnHandlers, 
                    btn_lib = _.index(opt.buttons.map(function(btn){
                        return typeof btn === 'object' ? btn : { type: btn };
                    }), 'type');
                default_config.buttons.forEach(function(type) {
                    var btn = btn_lib[type];
                    btn = btn && mix({}, button_config[type], btn) || {};
                    handlers[type] = btn.method;
                    this['_' + type + 'Btn'].html(function(){
                        return btn && tpl.format(TPL_BTN, btn) || '';
                    });
                }, self);
            }

            if (opt.content !== undefined) {
                self._config.iframe = null;
                self.setContent(opt.content);
            } else if (opt.iframe) {
                self.setIframeContent(opt);
            } 
            
            return self;

        },

        setIframeContent: function(){
            var self = this;
            this.clearIframeContent();
            self.setContent('');
            self.showLoading();
            self._iframeContent = $('<iframe class="moui-modalview-iframebd" '
                    + 'frameborder="0" scrolling="no" style="visibility:hidden;width:100%;"></iframe>')
                .bind('load', function(){
                    try {
                        self._iframeWindow = $(this.contentWindow);
                        if (!self._iframeContent
                            && self._iframeWindow[0].location.href !== self._config.iframe) {
                            return;
                        }
                        self._iframeContent[0].style.visibility = '';
                        self.event.fire("frameOnload", [self]);
                        self.hideLoading();
                    } catch(ex) {}
                }).appendTo(self._content);
        },

        clearIframeContent: function(){
            if (this._iframeContent) {
                this._iframeContent.remove();
                this._iframeContent = null;
            }
        },

        done: function(){
            this.close();
        },

        open: function(){
            this.superClass.open.call(this);
            if (this._config.iframe) {
                this._iframeContent.attr('src', this._config.iframe);
            }
            return this;
        },

        close: function(){
            this.clearIframeContent();
            return this.superClass.close.call(this);
        },

        destroy: function() {
            this._btnHandlers = {};
            return this.superClass.destroy.call(this);
        }

    });

    function nothing(){}

    function exports(opt) {
        return new exports.ModalView(opt);
    }

    exports.ModalView = ModalView;

    return exports;

});
