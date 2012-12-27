define([
    'dollar',
    'mo/lang',
    'mo/template',
    'soviet',
    'choreo',
    'moui/gesture/base',
    'moui/gesture/tap',
    'moui/gesture/swipe',
    'moui/gesture/drag',
    'moui/gesture/scroll',
    './bus',
    './pagesession',
    './view/parser',
    './view/modal',
    'mo/domready'
], function($, _, tpl, soviet, choreo, 
    baseGeste, tapGeste, swipeGeste, dragGeste, scrollGeste, 
    bus, pageSession, htmlparser, modal){

    var window = this,
        location = window.location,
        document = window.document,
        body = document.body,

        SUPPORT_ORIENT = "orientation" in window && "onorientationchange" in window,
        SUPPORT_OVERFLOWSCROLL = "overflowScrolling" in body;

    _.mix(baseGeste.GestureBase.prototype, {
        bind: function(ev, handler){
            $(this.node).bind(ev, handler);
            return this;
        },
        unbind: function(ev, handler){
            $(this.node).unbind(ev, handler);
            return this;
        },
        trigger: function(e, ev){
            $(e.target).trigger(ev);
            return this;
        }
    });

    var tap_events = {

        'a': link_handler,
        'a *': link_handler,

        '.ck-modal': function(e){
            var me = $(this),
                json_url = me.data('jsonUrl'),
                target_id = me.data('target');
            view.openModal({
                title: me.data('title'),
                content: target_id ? $('#' + target_id).html() : undefined,
                url: me.data('url') || json_url,
                urlType: json_url && 'json'
            });
        }
    
    };

    modal.event.bind('open', function(modal){
        var wph = window.innerHeight - 50,
            h = Math.round(wph - view.headerHeight);
        view.disableView = true;
        view.showTopbar();
        modal._wrapper.css('marginTop', wph + 'px');
        modal._content.css('height', h + 'px');
        choreo.transform(modal._wrapper[0], 'translateY', 0 - wph + 'px');
        choreo.transform(view.header.parent()[0], 'scale', 0.75);
        choreo.transform(view.header.parent()[0], 'translateY', '10px');
    });

    var view = {

        init: function(opt){
            var wrapper = this.wrapper = opt.wrapper;
            this.header = opt.header,
            this.loadingCard = $('#ckLoading');
            this.defaultCard = $('#ckDefault');
            this.headerHeight = this.header.height();
            this.windowFullHeight = Infinity;

            this.render();
            this.showTopbar();
            this.initState();

            $(window).bind('resize', function(e){
                view.updateSize();
            });

            this.hideAddressbar();
            this.windowFullHeight = window.innerHeight;

            tapGeste(document, {});
            scrollGeste(document, {});

            soviet(document, {
                matchesSelector: true,
                preventDefault: true
            }).on('click', {
                'a': nothing,
                'a *': nothing
            }).on('tap', tap_events);

            $(document).bind('scrolldown', function(e){
                view.hideAddressbar();
                if (view.viewport[0].scrollTop >= view.headerHeight) {
                    view.hideTopbar();
                }
            }).bind('scrollup', function(e){
                view.showTopbar();
            });

            var _startY, 
                _prevent_down_inited,
                _prevent_up_inited;

            $(document).bind('touchstart', function(e){
                var t = e.touches[0], 
                    _prevented,
                    vp = view.viewport[0];
                _startY = t.clientY;
                if (vp.scrollTop + vp.offsetHeight >= vp.scrollHeight
                        && !_prevent_up_inited) {
                    $(document).bind('touchmove', prevent_up);
                    _prevent_up_inited = true;
                    _prevented = true;
                }
                if (vp.scrollTop <= 0 && !_prevent_down_inited) {
                    $(document).bind('touchmove', prevent_down);
                    _prevent_down_inited = true;
                    _prevented = true;
                }
                if (!_prevented){
                    $(document).unbind('touchmove', prevent_up);
                    $(document).unbind('touchmove', prevent_down);
                    _prevent_down_inited = false;
                    _prevent_up_inited = false;
                }
            });

            function prevent_up(e){
                var t = e.touches[0];
                if (t.clientY <= _startY) {
                    //confirm('[待实现]要显示地址栏么？', function(){
                        //view.viewport[0].scrollTop = 100;
                    //});
                    e.preventDefault();
                } else {
                    $(document).unbind('touchmove', prevent_up);
                    _prevent_up_inited = false;
                }
            }

            function prevent_down(e){
                var t = e.touches[0];
                if (t.clientY >= _startY) {
                    //confirm('[待实现]要立刻返回顶部么？', function(){
                    
                    //});
                    e.preventDefault();
                } else {
                    $(document).unbind('touchmove', prevent_down);
                    _prevent_down_inited = false;
                }
            }

        },

        render: function(){
            htmlparser(this.wrapper);
            this.loadingCard.hide();
        },

        initState: function(){

            $(window).bind("popstate", function(e){
                var loading = view.viewport[0].id === 'ckLoading';
                //alert(['pop', 
                 //e.state && [e.state.prev, e.state.next], 
                 //view.viewport && view.viewport[0].id].join(', '))
                if (e.state) {
                    if (e.state.next === '_modal_') {
                        modal.set(e.state.opt).open();
                    } else if (modal.opened) {
                        view.closeModal();
                    } else if (e.state.next === 'ckLoading' && loading) {
                        // back from other page
                        history.back();
                    } else if (loading) {
                        // from other page, need hide loading immediately
                        view.showTopbar();
                        view.changeView(e.state.next);
                        view.loadingCard.hide();
                    } else if (e.state.prev === view.viewport[0].id) {
                        // forward from inner view
                        link_handler(e.state.next, e.state.link);
                    } else {
                        // back from inner view
                        back_handler(e.state.next);
                    }
                } else if (loading) {
                    // forward from other page, need restore (cache mod)
                    history.forward();
                } else { 
                    // back to other page, need show loading first
                    back_handler('ckLoading');
                }
            });

            pageSession.init();

            var current_state = history.state,
                restore_state = current_state && current_state.next;
            //alert(['init', 
             //current_state && [current_state.prev, current_state.next], 
             //view.viewport && view.viewport[0].id].join(', '))
            if (restore_state === '_modal_') { // @TODO
                restore_state = current_state.prev;
                modal.set(history.state.opt).open();
            }
            if (restore_state) {
                view.changeView(restore_state);
                if (restore_state === 'ckLoading') {
                    history.back();
                }
            } else {
                if (pageSession.indexOf(location.href) !== -1) {
                    view.changeView(view.loadingCard);
                    history.forward();
                } else {
                    view.changeView(view.defaultCard);
                    push_history(view.loadingCard[0].id, view.defaultCard[0].id);
                    pageSession.push(location.href);
                }
            }

        },

        changeView: function(card){
            if (typeof card === 'string') {
                card = $('#' + card);
            }
            this.viewport = card.show();
            this.updateSize();
            //card[0].scrollTop = this.topbarEnable ? 0 : this.headerHeight;
        },

        updateSize: function(){
            this.viewport[0].style.height = window.innerHeight + 'px';
        },

        hideTopbar: function(){
            if (this.topbarEnable && !this.disableView) {
                this.topbarEnable = false;
                choreo.transform(view.header[0], 'translateY', '-' + this.headerHeight + 'px');
            }
        },

        showTopbar: function(){
            if (!this.topbarEnable) {
                this.topbarEnable = true;
                choreo.transform(view.header[0], 'translateY', '0');
            }
        },

        hideAddressbar: function(){
            if (this.windowFullHeight > window.innerHeight) {
                body.style.height = screen.availHeight + 'px';
                window.scrollTo(0, 1);
                view.updateSize();
                body.style.height = '';
            }
        },

        //showAddressbar: function(){
            //setTimeout(function() {
                //window.scrollTo(0, 0);
                //view.updateSize();
            //}, 0);
        //},

        //getOrientation : function() {
            //var is_portrait = true;
            //if (SUPPORT_ORIENT) {
                //is_portrait = ({ "0": true, "180": true })[window.orientation];
            //} else {
                //is_portrait = body.clientWidth / body.clientHeight < 1.1;
            //}

            //return is_portrait ? "portrait" : "landscape";
        //},

        openModal: function(opt){
            if (!modal.opened) {
                push_history(view.viewport[0].id, '_modal_', false, opt);
            }
            modal.set(opt).open();
        },

        closeModal: function(){
            view.disableView = false;
            choreo.transform(modal._wrapper[0], 'translateY', '0');
            choreo.transform(view.header.parent()[0], 'scale', 1);
            choreo.transform(view.header.parent()[0], 'translateY', '0');
            setTimeout(function(){
                modal.close();
            }, 400);
        },

        modal: modal

    };

    function nothing(){}

    function link_handler(next_id, true_link){
        var me, is_forward = typeof next_id === 'string';
        if (!is_forward) {
            me = next_id.target;
            next_id = '';
            while (!me.href) {
                me = me.parentNode;
            }
            if ($(me).hasClass('ck-link')) {
                next_id = (me.href.replace(location.href, '')
                    .match(/^#(.+)/) || [])[1];
            }
        }
        var next = next_id && $('#' + next_id);
        if (!next) {
            if (me) {
                next_id = 'ckLoading';
                next = view.loadingCard;
                true_link = me.href;
                pageSession.clear(pageSession.indexOf(location.href));
            } else {
                return;
            }
        }
        var current = view.viewport;
        if (!is_forward) {
            push_history(current[0].id, next_id, true_link);
        }
        view.showTopbar();
        view.changeView(next);
        next.addClass('moving');
        choreo().play().actor(view.wrapper[0], {
            'transform': 'translateX(' + (0 - window.innerWidth) + 'px)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide();
            choreo.transform(view.wrapper[0], 'translateX', '0');
            next.removeClass('moving');
            if (true_link) {
                if (is_forward) {
                    history.forward();
                } else {
                    location.href = true_link;
                }
            }
            //view.hideTopbar();
        });
    }

    function back_handler(prev_id){
        var prev = $('#' + prev_id);
        var current = view.viewport;
        view.showTopbar();
        view.changeView(prev);
        choreo.transform(view.wrapper[0], 'translateX', 0 - window.innerWidth + 'px');
        current.addClass('moving');
        prev.show();
        choreo().play().actor(view.wrapper[0], {
            'transform': 'translateX(0)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide().removeClass('moving');
            if (prev_id === 'ckLoading') {
                history.back();
            }
            //view.hideTopbar();
        });
    }

    function push_history(prev_id, next_id, link, opt){
        history.pushState({
            prev: prev_id,
            next: next_id,
            link: link,
            opt: opt,
            i: history.length
        }, document.title, location.href);
    }

    return view;

});
