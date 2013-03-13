
define('moui/control', [
    'mo/lang',
    'dollar',
    'eventmaster'
], function(_, $, event){

    var default_config = {
            field: null,
            label: null,
            enableVal: 1,
            disableVal: 0,
            enableLabel: '',
            disableLabel: '',
            loadingLabel: '稍等...'
        };

    function Control(elm, opt){
        this.init(elm, opt);
        this.set(this._config);
    }

    Control.prototype = {

        _defaults: default_config,

        init: function(elm, opt){
            this.event = event();
            var node = this._node = $(elm);
            opt = _.mix({}, this.data(), opt);
            this._field = opt.field && $(opt.field, node) || node;
            this._label = opt.label && $(opt.label, node) || node;
            if (this._label[0]) {
                this._isLabelClose = this._label.isEmpty();
            }
            opt.disableVal = this.val();
            opt.disableLabel = this.label();
            this._config = _.mix({}, this._defaults, opt);
        },

        set: function(opt){
            opt = opt || {};
            this._config = _.mix(this._config, opt);
            return this;
        },

        val: function(v){
            return this._field.val(v);
        },

        label: function(str){
            if (this._isLabelClose) {
                return this._label.val(str);
            } else {
                return this._label.html(str);
            }
        },

        data: function(){
            return this._node.data();
        },

        showLoading: function(){
            this._node.addClass('loading');
            this.label(this._config.loadingLabel);
            return this;
        },

        hideLoading: function(){
            this._node.removeClass('loading');
            return this;
        },

        toggle: function(){
            if (this.isEnabled) {
                this.disable();
            } else {
                this.enable();
            }
            return this;
        },

        enable: function(){
            if (this.isEnabled) {
                return;
            }
            this.isEnabled = true;
            this._node.addClass('enabled');
            this.val(this._config.enableVal);
            if (this._config.enableLabel) {
                this.label(this._config.enableLabel);
            }
            this.event.reset('disable')
                .resolve('enable', [this]);
            return this;
        },

        disable: function(){
            if (!this.isEnabled) {
                return;
            }
            this.isEnabled = false;
            this._node.removeClass('enabled');
            this.val(this._config.disbleVal);
            if (this._config.disableLabel) {
                this.label(this._config.disableLabel);
            }
            this.event.reset('enable')
                .resolve('disable', [this]);
            return this;
        }
    
    };

    function exports(elm, opt){
        return new exports.Control(elm, opt);
    }

    exports.Control = Control;

    return exports;

});

