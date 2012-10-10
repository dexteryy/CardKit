
define("mod/dollar", [
    "mod/lang",
    "host"
], function(_, host){

    var doc = host.document,
        MATCHES_SELECTOR = ['webkitMatchesSelector', 'mozMatchesSelector', 'matchesSelector']
            .map(pluck, doc.body).filter(pick)[0],
        _array_each = Array.prototype.forEach,
        _array_push = Array.prototype.push;


    function $(selector, context){
        if (selector) {
            if (context) {
                return ext.find(context).find(selector);
            } else {
                return ext.find(selector);
            }
        }
    }

    $.prototype = Array.prototype;

    var ext = $.fn = _.mix($.prototype, {

        constructor: $,

        find: function(selector){
            if (selector.constructor === $) {
                return selector;
            }
            var obj = new $(), contexts;
            if (this === ext) {
                contexts = [doc];
            } else {
                obj.prevObject = contexts = this;
            }
            if (typeof selector === 'string') {
                if (/^#/.test(selector)) {
                    var elm = doc.getElementById(selector.substr(1));
                    if (elm) {
                        obj.push(elm);
                    }
                } else {
                    var query = /\W/.test(selector) ? 'querySelectorAll' 
                                                    : 'getElementsByTagName';
                    if (contexts[1]) {
                        contexts.forEach(function(context){
                            this.push.apply(this, context[query](selector));
                        }, obj);
                    } else {
                        obj.push.apply(obj, contexts[0][query](selector));
                    }
                }
            } else if (selector) {
                obj.push(selector);
            }
            return obj;
        },

        each: function(fn){
            for (var i = 0, l = this.length; i < l; i++){
                var re = fn.call(this[i], i);
                if (re === false) {
                    break;      
                }
            }
            return this;
        },

        end: function(){
            return this.prevObject || new $();
        },

        eq: function(i){
            return i === -1 ? this.slice(-1) : this.slice(i, i + 1);
        },

        not: function(selector){
            return this.filter(function(item){
                return item && !this(item, selector);
            }, matches_selector);
        },

        has: function(selector){
            return this.filter(function(item){
                return this(item, selector);
            }, matches_selector);
        },

        parent: function(selector){
            return _.unique([undefined, doc, null].concat(this.map(selector ? function(item){
                var p = item.parentNode;
                if (p && matches_selector(p, selector)) {
                    return p;
                }
            } : function(item){
                return item.parentNode;
            }))).slice(3);
        },

        parents: function(selector){
            var ancestors = new $(), p = this,
                finding = selector ? find_selector(selector, 'parentNode') : function(item){
                    return this[this.push(item.parentNode) - 1];
                };
            while (p.length) {
                p = p.map(finding, ancestors);
            }
            return ancestors;
        },

        closest: function(selector){
            var ancestors = new $(), p = this, 
                finding = find_selector(selector, 'parentNode');
            while (p.length && !ancestors.length) {
                p = p.map(finding, ancestors);
            }
            return ancestors.length && ancestors || this;
        },

        siblings: function(selector){
            var sibs = new $(),
                finding = selector ? find_selector(selector) : function(item){
                    this.push(item);
                };
            this.forEach(function(item){
                _array_each.apply(((item || {}).parentNode || {}).children || [], function(child){
                    if (child !== item) {
                        this.call(this, child);
                    }
                }, this);
            }, sibs);
            return _.unique(sibs);
        },

        is: function(selector){
            this.some(function(item){
                return matches_selector(item, selector);
            });
        },

        hasClass: function(cname){
            for (var i = 0, l = this.length; i < l; i++) {
                if (this[i].classList.contains(cname)) {
                    return true;
                }
            }
            return false;
        },

        addClass: function(cname){
            var is_fn_arg = _.isFunction(cname);
            this.forEach(function(item, i){
                if (is_fn_arg) {
                    cname = cname.call(this, i, item.className);
                }
                item.classList.add(cname);
            });
            return this;
        },

        removeClass: function(cname){
            var is_fn_arg = _.isFunction(cname);
            this.forEach(function(item, i){
                if (is_fn_arg) {
                    cname = cname.call(this, i, item.className);
                }
                item.classList.remove(cname);
            });
            return this;
        },

        toggleClass: function(cname, force){
            var is_fn_arg = _.isFunction(cname);
            this.forEach(function(item, i){
                if (is_fn_arg) {
                    cname = cname.call(this, i, item.className);
                }
                item.classList[typeof force === 'undefined' && 'toggle'
                                    || force && 'add' || 'remove'](cname);
            });
            return this;
        },

        css: function(){
        
        },

        attr: function(name, value){
        
        },

        removeAttr: function(){
        
        },

        prop: function(name, value){
        
        },

        html: function(){
        
        },

        text: function(){
        
        },

        val: function(){
        
        },

        offset: function(){
            var set = this[0].getBoundingClientRect();
            return {
                left: set.left + window.pageXOffset,
                top: set.top + window.pageYOffset,
                width: set.width,
                height: set.height
            };
        },

        appendTo: function(){
        
        },

        append: function(){
        
        },

        prependTo: function(){
        
        },

        prepend: function(){
        
        },

        insertBefore: function(){
        
        },

        insertAfter: function(){
        
        },

        bind: function(){
        
        },

        unbind: function(){
        
        }

    });

    function pluck(name){
        return this[name];
    }

    function pick(v){ 
        return v; 
    }

    function matches_selector(elm, selector){
        return elm && elm[MATCHES_SELECTOR](selector);
    }

    function find_selector(selector, attr){
        return function(item){
            if (attr) {
                item = item[attr];
            }
            if (matches_selector(item, selector)) {
                this.push(item);
            }
            return item;
        };
    }

    $.matchesSelector = matches_selector;

    return $;

});
