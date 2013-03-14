
define('moui/picker', [
    'mo/lang',
    'dollar',
    'eventmaster',
    'moui/control'
], function(_, $, event, control){

    var OID = '_moPickerOid',

        default_config = {
            field: 'input[type="hidden"]',
            options: '.option',
            ignoreRepeat: false,
            multiselect: false
        };

    function Picker(elm, opt){
        this.init(elm, opt);
        this.set(this._config);
    }

    Picker.prototype = {

        _defaults: default_config,

        init: function(elm, opt){
            this._uoid = 0;
            this.event = event();
            this._node = $(elm);
            this._options = [];
            opt = _.mix({}, this.data(), opt);
            this._config = _.mix({}, this._defaults, opt);
            return this;
        },

        set: function(opt){
            opt = opt || {};
            _.mix(this._config, opt);

            if (opt.multiselect !== undefined) {
                if (!opt.multiselect) {
                    this._allSelected = null;
                    this._lastSelected = null;
                } else if (!this._allSelected) {
                    this._allSelected = [];
                }
            }

            if (opt.options) {
                this._options.forEach(this.removeOption, this);
                $(opt.options, this._node).forEach(this.addOption, this);
            }

            if (opt.field !== undefined) {
                if (opt.field) {
                    this._field = $(opt.field, 
                        typeof opt.field === 'string' && this._node);
                } else {
                    this._field = [];
                }
            }

            return this;
        },

        addOption: function(elm){
            elm = $(elm)[0];
            if (elm[OID]) {
                return;
            }
            elm[OID] = ++this._uoid;
            var controller = control(elm, {
                enableVal: elm.value,
                label: false
            });
            controller.event.bind('enable', when_enable.bind(this))
                .bind('disable', when_disable.bind(this));
            this._options.push(controller);
            return this;
        },

        removeOption: function(elm){
            var controller;
            if (elm.constructor === control.Control) {
                controller = elm;
                elm = elm._node[0];
            } else {
                controller = this.getOption(elm);
            }
            this.unselect(elm);
            if (controller) {
                this._options.splice(
                    this._options.indexOf(controller), 1);
            }
            return this;
        },

        getOption: function(elm){
            if (typeof elm === 'number') {
                elm = this._options[elm];
            } else {
                var oid = $(elm)[0][OID];
                if (!oid) {
                    return null;
                }
                for (var i = 0, controller, 
                        l = this._options.length; i < l; i++) {
                    controller = this._options[i];
                    if (controller._node[0][OID] === oid) {
                        elm = controller;
                        break;
                    }
                }
            }
            return elm;
        },

        val: function(){
            if (!this._config) {
                return;
            }
            if (this._config.multiselect) {
                return this._allSelected.map(function(controller){
                    return controller.val();
                });
            } else {
                if (this._lastSelected) {
                    return this._lastSelected.val();
                }
            }
        },

        data: function(){
            return this._node.data();
        },

        showLoading: function(){
            this._node.addClass('loading');
            return this;
        },

        hideLoading: function(){
            this._node.removeClass('loading');
            return this;
        },

        select: function(i){
            var controller = this.getOption(i);
            if (controller) {
                if (this._config.multiselect 
                        && this._allSelected.indexOf(controller) !== -1
                        || !this._config.multiselect
                        && this._lastSelected === controller) {
                    if (!this._config.ignoreRepeat) {
                        return this.unselect(i);
                    }
                } else {
                    controller.enable();
                    this.hasSelected = true;
                }
            }
            return this;
        },

        unselect: function(i){
            if (!i) {
                change.call(this, 'disable');
            } else {
                var controller = this.getOption(i);
                if (controller) {
                    controller.disable();
                    if (!this._config.multiselect
                            || !this._allSelected.length) {
                        this.hasSelected = false;
                    }
                }
            }
            return this;
        }

    };

    function when_enable(controller){
        change.call(this, 'enable', controller);
        this.event.fire('select', [this, controller]);
    }

    function when_disable(controller){
        change.call(this, 'disable', controller);
        this.event.fire('unselect', [this, controller]);
    }

    function change(subject, controller){
        if (subject === 'enable') {
            if (this._config.multiselect) {
                this._allSelected.push(controller);
            } else {
                var last = this._lastSelected;
                this._lastSelected = controller;
                if (last) {
                    last.disable();
                }
            }
        } else {
            if (this._config.multiselect) {
                var i = this._allSelected.indexOf(controller);
                if (i !== -1) {
                    this._allSelected.splice(i, 1);
                }
            } else {
                if (controller 
                        && this._lastSelected !== controller) {
                    return;
                }
                this._lastSelected = null;
            }
        }
        if (this._field[0]) {
            this._field.val(this.val());
        }
        this.event.fire('change', [this, controller]);
    }

    function exports(elm, opt){
        return new exports.Picker(elm, opt);
    }

    exports.Picker = Picker;

    return exports;

});

