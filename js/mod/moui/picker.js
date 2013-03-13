
define('moui/picker', [
    'mo/lang',
    'dollar',
    'eventmaster',
    'moui/control'
], function(_, $, event, control){

    var mix = _.mix,

        OID = '_moPickerOid',

        default_config = {
            options: null,
            multiSelect: false
        };

    var Picker = _.construct(control.Control);

    mix(Picker.prototype, {

        _defaults: mix(default_config, control.Control._defaults),

        init: function(elm, opt){
            this._uoid = 0;
            this.superClass.init.call(this, elm, opt);
            var cfg = this._config;
            if (cfg.multiSelect) {
                this._allSelected = [];
            }
            var options = cfg.options && $(cfg.options, this._node) 
                || this._node.find('.option');
            options.forEach(this.addOption, this);
            return this;
        },

        set: function(opt){
            opt = opt || {};
            this.superClass.set.call(this, opt);

            if (opt.options !== undefined) {
                opt.options.forEach(this.addOption, this);
            }

            return this;
        },

        addOption: function(elm){
            if (elm[OID]) {
                return;
            }
            elm[OID] = ++this._uoid;
            var controller = control(elm);
            controller.bind('enable', change.bind(this))
                .bind('disable', change.bind(this));
            this._options.push(controller);
            return this;
        },

        removeOption: function(elm){
            this.unselect(elm);
            var controller = this.getOption(elm);
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
                var oid = elm[OID], controller;
                if (!oid) {
                    return null;
                }
                for (var i = 0, l = this._options.length; i < l; i++) {
                    controller = this._options[i];
                    if (controller[OID] === oid) {
                        elm = controller;
                        break;
                    }
                }
            }
            return elm;
        },

        val: function(v){
            if (this._config.multiSelect) {
                return this._allSelected.map(function(controller){
                    return controller.val();
                });
            } else {
                return this._lastSelected.val(v);
            }
        },

        select: function(i){
            var controller = this.getOption(i);
            if (controller) {
                controller.enable();
                this.hasSelected = true;
            }
        },

        unselect: function(i){
            var controller = this.getOption(i);
            if (controller) {
                controller.disable();
                if (!this._config.multiSelect
                        || !this._allSelected.length) {
                    this.hasSelected = false;
                }
            }
        }

    });

    function change(controller){
        if (this.subject === 'enable') {
            if (this._config.multiSelect) {
                this._allSelected.push(controller);
            } else {
                this._lastSelected.disable();
                this._lastSelected = controller;
            }
        } else {
            if (this._config.multiSelect) {
                this._allSelected.splice(
                    this._allSelected.indexOf(controller), 1);
            } else {
                if (this._lastSelected === controller) {
                    this._lastSelected = null;
                }
            }
        }
        this.event.fire('change', []);
    }

    function exports(elm, opt){
        return new exports.Picker(elm, opt);
    }

    exports.Picker = Picker;

    return exports;

});

