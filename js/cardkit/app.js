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
    './render',
    './view/modal',
    './view/growl',
    'mo/domready'
], function($, _, tpl, soviet, choreo, 
    baseGeste, tapGeste, swipeGeste, dragGeste, scrollGeste, 
    bus, pageSession, render, modal, growl){

    var window = this,
        location = window.location,
        document = window.document,
        body = document.body,
        _back_timeout,

        TPL_MASK = '<div class="ck-globalmask"></div>',

        SUPPORT_ORIENT = "orientation" in window && "onorientationchange" in window,
        SUPPORT_OVERFLOWSCROLL = "overflowScrolling" in body;

    _.mix(baseGeste.GestureBase.prototype, {
        bind: function(ev, handler, elm){
            $(elm || this.node).bind(ev, handler);
            return this;
        },
        unbind: function(ev, handler, elm){
            $(elm || this.node).unbind(ev, handler);
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
            ck.openModal({
                title: me.data('title'),
                content: target_id ? $('#' + target_id).html() : undefined,
                url: me.data('url') || json_url,
                urlType: json_url && 'json'
            });
        }
    
    };

    modal.event.bind('open', function(modal){
        ck.disableView = true;
        ck.showTopbar();
        $(body).addClass('bg').addClass('modal_view');
        setTimeout(function(){
            choreo.transform(modal._wrapper[0], 'translateY', '0');
            var prev = ck.viewport,
                current = modal._contentWrapper;
            ck.changeView(current);
            modal._content[0].style.minHeight = current[0].offsetHeight + 'px';
            modal.event.once('close', function(){
                ck.changeView(prev);
            });
        }, 200);
    });

    var ck = {

        init: function(opt){
            var wrapper = this.wrapper = opt.wrapper;
            this.header = opt.header,
            this.loadingCard = $('#ckLoading');
            this.defaultCard = $('#ckDefault');
            this.globalMask = $(TPL_MASK).appendTo(body);
            this.headerHeight = this.header.height();
            this.windowFullHeight = Infinity;
            this.inited = false;

            this.scrollGesture = scrollGeste(document, {});
            tapGeste(document, {});

            render(wrapper);
            this.initState();

            setTimeout(function(){
                ck.hideAddressbar();
                ck.hideLoading();
            }, 0);

            //$(window).bind('resize', function(e){
                //ck.updateSize();
            //});

            soviet(document, {
                matchesSelector: true,
                preventDefault: true
            }).on('click', {
                'a': nothing,
                'a *': nothing
            }).on('tap', tap_events);

            $(document).bind('scrolldown', function(e){
                setTimeout(function(){
                    ck.hideAddressbar();
                }, 0);
                //if (ck.viewport[0].scrollTop >= ck.headerHeight) {
                    //ck.hideTopbar();
                //}
            }).bind('scrollup', function(e){
                ck.showTopbar();
            }).bind('scrollstart', function(){
                ck.globalMask.show();
            }).bind('scrollend', function(){
                ck.globalMask.hide();
                prevent_window_scroll();
            });

            $(document).bind('touchstart', prevent_window_scroll);

            var startY,
                hold_timer, 
                holded,
                cancel_hold = function(){
                    clearTimeout(hold_timer);
                    if (holded) {
                        holded = false;
                        growl.tip.close();
                    }
                };
            this.header.bind('touchstart', function(e){
                startY = e.touches[0].clientY;
                hold_timer = setTimeout(function(){
                    holded = true;
                    ck.viewport[0].scrollTop = 0;
                    growl.tip.set({
                        content: '向下拖动显示地址栏'
                    }).open();
                }, 200);
            }).bind('touchmove', function(e){
                clearTimeout(hold_timer);
                if (holded && e.touches[0].clientY < startY) {
                    cancel_hold();
                    ck.hideAddressbar();
                }
            }).bind('touchend', cancel_hold).bind('touchcancel', cancel_hold);

        },

        initState: function(){

            $(window).bind("popstate", function(e){
                clearTimeout(_back_timeout);
                var loading = ck.viewport[0].id === 'ckLoading'; // alert(['pop', e.state && [e.state.prev, e.state.next], ck.viewport && ck.viewport[0].id].join(', '))
                if (e.state) {
                    if (e.state.next === '_modal_') {
                        // 11. forward from normal card, show modal card.  alert(11)
                        modal.set(e.state.opt).open();
                    } else if (modal.opened) {
                        // 12. back from modal card.  alert(12)
                        ck.closeModal();
                    } else if (loading) {
                        if (e.state.next === 'ckLoading') {
                            // 6. back from other page, no GC. 
                            //    go to 2.  alert(6)
                            history.back();
                        } else {
                            // 7. from 6, hide loading immediately.  alert(7)
                            ck.changeView(e.state.next);
                            ck.hideLoading();
                        }
                    } else if (e.state.prev === ck.viewport[0].id) {
                        // 3. forward from normal card.  alert(3)
                        link_handler(e.state.next, e.state.link);
                    } else {
                        // 2. back from normal card.  alert(2)
                        back_handler(e.state.next);
                    }
                } else if (loading) {
                    // 5. forward from other page, no GC.  alert(5)
                    history.forward();
                } else { 
                    // 4. back to other page, shift left and show loading.
                    //    if no GC: go to 6.
                    //    if no prev page: reload, go to 8
                    //    else: go to 8.  alert(4)
                    back_handler('ckLoading');
                }
            });

            pageSession.init();

            var current_state = history.state,
                restore_state = current_state && current_state.next; // alert(['init', current_state && [current_state.prev, current_state.next], ck.viewport && ck.viewport[0].id].join(', '))
            if (restore_state === '_modal_') { // @TODO
                restore_state = current_state.prev;
                modal.set(history.state.opt).open();
            }
            if (restore_state) {
                // 1. reload from normal card.  alert(0)
                ck.changeView(restore_state);
                if (restore_state === 'ckLoading') {
                    // 9.  alert(9)
                    history.back();
                }
            } else {
                if (pageSession.indexOf(location.href) !== -1) {
                    // 8. reload from loading card.
                    //    or forward from other page.  alert(8)
                    ck.changeView(ck.loadingCard);
                    history.forward();
                } else {
                    // 0. new page.  alert(1)
                    ck.changeView(ck.defaultCard);
                    push_history(ck.loadingCard[0].id, ck.defaultCard[0].id);
                    pageSession.push(location.href);
                }
            }

        },

        changeView: function(card){
            if (typeof card === 'string') {
                card = $('#' + card);
            }
            this.viewport = card.show();
            if (card !== this.loadingCard) {
                this.updateSize();
            }
            this.watchScroll(this.viewport);
            this.settingUI();
        },

        updateSize: function(){
            this.viewport[0].style.height = (this.inited ? 
                window.innerHeight : (screen.availHeight + 60)) + 'px';
            // enable scrollable when height is not enough 
            var ft = this.viewport.find('.ck-footer')[0];
            if (ft) {
                var d = screen.availHeight - (ft.offsetTop 
                        + ft.offsetHeight + this.viewport[0].scrollTop); 
                if (d > 0) {
                    ft.style.paddingTop = (parseFloat(ft.style.paddingTop) || 0) + d + 100 + 'px';
                }
            }
        },

        watchScroll: function(card){
            this.scrollGesture.watchScroll(card[0]);
        },

        settingUI: function(){
            var top_submit = this.header.find('.ck-top-create').empty();
            var create_btn = this.viewport.find('.ckd-create');
            if (create_btn[0]) {
                top_submit.append(create_btn.clone());
            }
        },

        hideLoading: function() {
            if (!this._loadingAnimate) {
                this._loadingAnimate = choreo();
            }
            this._loadingAnimate.clear().play()
                .actor(ck.loadingCard[0], {
                    opacity: 0
                }, 400, 'easeInOut').follow().then(function(){
                    ck.loadingCard.hide().css({
                        position: 'static',
                        opacity: '',
                        height: window.innerHeight + 'px'
                    });
                    ck.showTopbar();
                });
        },

        hideTopbar: function(){
            if (this.topbarEnable && !this.disableView) {
                this.topbarEnable = false;
                choreo.transform(ck.header[0], 'translateY', '-' + this.headerHeight + 'px');
            }
        },

        showTopbar: function(){
            if (!this.topbarEnable) {
                this.topbarEnable = true;
                choreo.transform(ck.header[0], 'translateY', '0');
            }
        },

        hideAddressbar: function(){
            if (this.windowFullHeight > window.innerHeight) {
                if (!this.inited) {
                    this.inited = true;
                }
                this.loadingCard.find('div')[0].style.visibility = 'hidden';
                window.scrollTo(0, 1);
                this.windowFullHeight = window.innerHeight;
                ck.updateSize();
                this.loadingCard.find('div')[0].style.visibility = '';
            }
        },

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
                push_history(ck.viewport[0].id, '_modal_', false, opt);
            }
            modal.set(opt).open();
        },

        closeModal: function(){
            ck.disableView = false;
            $(body).removeClass('modal_view');
            choreo.transform(modal._wrapper[0], 'translateY', '100%');
            setTimeout(function(){
                $(body).removeClass('bg');
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
                next = ck.loadingCard;
                true_link = me.href;
                pageSession.clear(pageSession.indexOf(location.href));
            } else {
                return;
            }
        }
        var current = ck.viewport;
        if (!is_forward) {
            push_history(current[0].id, next_id, true_link);
        }
        ck.globalMask.show();
        ck.showTopbar();
        next.addClass('moving');
        ck.changeView(next);
        choreo().play().actor(ck.wrapper[0], {
            'transform': 'translateX(' + (0 - window.innerWidth) + 'px)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide();
            choreo.transform(ck.wrapper[0], 'translateX', '0');
            next.removeClass('moving');
            ck.globalMask.hide();
            if (true_link) {
                if (is_forward) {
                    history.forward();
                } else {
                    location.href = true_link;
                }
            }
        });
    }

    function back_handler(prev_id){
        var prev = $('#' + prev_id);
        var current = ck.viewport;
        ck.globalMask.show();
        ck.showTopbar();
        choreo.transform(ck.wrapper[0], 'translateX', 0 - window.innerWidth + 'px');
        current.addClass('moving');
        prev.show();
        ck.changeView(prev);
        choreo().play().actor(ck.wrapper[0], {
            'transform': 'translateX(0)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide().removeClass('moving');
            ck.globalMask.hide();
            if (prev_id === 'ckLoading') {
                history.back();
                _back_timeout = setTimeout(function(){
                    location.reload();
                }, 800);
            }
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

    function prevent_window_scroll(){
        var vp = ck.viewport[0],
            bottom;
        if (vp.scrollTop <= 1) {
            vp.scrollTop = 1;
        } else if (vp.scrollTop >= (bottom = vp.scrollHeight 
                - vp.offsetHeight - 1)) {
            vp.scrollTop = bottom;
        }
    }

    return ck;

});
