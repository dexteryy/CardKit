
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
            var controler = control(elm);
            controler.bind('enable', change.bind(this))
                .bind('disable', change.bind(this));
            this._options.push(controler);
            return this;
        },

        removeOption: function(elm){
            this.unselect(elm);
            var controler = this.getOption(elm);
            if (controler) {
                this._options.splice(
                    this._options.indexOf(controler), 1);
            }
            return this;
        },

        getOption: function(elm){
            if (typeof elm === 'number') {
                elm = this._options[elm];
            } else {
                var oid = elm[OID], controler;
                if (!oid) {
                    return null;
                }
                for (var i = 0, l = this._options.length; i < l; i++) {
                    controler = this._options[i];
                    if (controler[OID] === oid) {
                        elm = controler;
                        break;
                    }
                }
            }
            return elm;
        },

        val: function(v){
            if (this._config.multiSelect) {
                return this._allSelected.map(function(controler){
                    return controler.val();
                });
            } else {
                return this._lastSelected.val(v);
            }
        },

        select: function(i){
            var controler = this.getOption(i);
            if (controler) {
                controler.enable();
                this.hasSelected = true;
            }
        },

        unselect: function(i){
            var controler = this.getOption(i);
            if (controler) {
                controler.disable();
                if (!this._config.multiSelect
                        || !this._allSelected.length) {
                    this.hasSelected = false;
                }
            }
        }

    });

    function change(controler){
        if (this.subject === 'enable') {
            if (this._config.multiSelect) {
                this._allSelected.push(controler);
            } else {
                this._lastSelected.disable();
                this._lastSelected = controler;
            }
        } else {
            if (this._config.multiSelect) {
                this._allSelected.splice(
                    this._allSelected.indexOf(controler), 1);
            } else {
                if (this._lastSelected === controler) {
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

