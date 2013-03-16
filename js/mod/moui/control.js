
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
            opt = _.mix({
                field: node,
                label: node
            }, this.data(), opt);
            this.setNodes(opt);
            if (this._label[0]) {
                this._isLabelClose = this._label.isEmpty();
            }
            opt.disableVal = this.val();
            opt.disableLabel = this.label();
            this._config = _.config({}, opt, this._defaults);
        },

        set: function(opt){
            opt = opt || {};
            _.mix(this._config, opt);
            this.setNodes(opt);
            return this;
        },

        setNodes: function(opt){
            if (opt.field !== undefined) {
                if (opt.field) {
                    this._field = $(opt.field, 
                        typeof opt.field === 'string' && this._node);
                } else {
                    this._field = [];
                }
            }
            if (opt.label !== undefined) {
                if (opt.label) {
                    this._label = $(opt.label, 
                        typeof opt.label === 'string' && this._node);
                } else {
                    this._label = [];
                }
            }
            return this;
        },

        val: function(v){
            if (this._field[0]) {
                if (this._field[0].nodeName === 'A') {
                    return this._field.attr('href', v);
                } else {
                    return this._field.val(v);
                }
            }
        },

        label: function(str){
            if (!this._label[0]) {
                return;
            }
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
                return this;
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
                return this;
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

