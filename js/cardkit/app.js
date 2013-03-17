define([
    'dollar',
    'mo/lang',
    'mo/template',
    'soviet',
    'choreo',
    'momotion/base',
    'momotion/tap',
    'momotion/swipe',
    'momotion/drag',
    'momotion/scroll',
    './view/control',
    './view/picker',
    './view/modalcard',
    './view/actionview',
    './view/growl',
    './bus',
    './pagesession',
    './render',
    'mo/domready'
], function($, _, tpl, soviet, choreo, 
    momoBase, momoTap, momoSwipe, momoDrag, momoScroll, 
    control, picker, modalCard, actionView, growl,
    bus, pageSession, render){

    var window = this,
        location = window.location,
        document = window.document,
        body = document.body,
        back_timeout,
        gc_id = 0,

        //SUPPORT_ORIENT = "orientation" in window && "onorientationchange" in window,
        SUPPORT_OVERFLOWSCROLL = "webkitOverflowScrolling" in body.style,

        TPL_MASK = '<div class="ck-globalmask"></div>';

    _.mix(momoBase.Class.prototype, {
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

        '.ck-card .ck-post-link': enable_control,

        '.ck-card .ck-post-button': enable_control,
        '.ck-card .ck-post-button span': function tap_ck_post(){
            if (!$(this).hasClass('ck-post-button')) {
                return tap_ck_post.call(this.parentNode);
            }
            enable_control.call(this);
        },

        '.ck-card .ck-switch span': function tap_ck_switch(){
            if (!$(this).hasClass('ck-switch')) {
                return tap_ck_switch.call(this.parentNode);
            }
            toggle_control.call(this);
        },

        '.ck-segment .option': function(){
            var p = picker(this.parentNode, {
                ignoreRepeat: true
            });
            p.select(this);
        },

        '.ck-tagselector .option': function(){
            var p = picker(this.parentNode);
            p.select(this);
        },

        '.ck-actions .option': function(){
            var actions = $(this).closest('.ck-actions');
            var p = picker(actions, {
                ignoreStatus: actions.data("ignoreStatus") !== 'false' && true
            });
            p.select(this);
        },

        '.ck-folder header': function(){
            control(this.parentNode).toggle();
        },

        '.ck-actions-button, .ck-actions-button span': function(){
            var me = $(this);
            if (!me.hasClass('ck-actions-button')) {
                me = me.parent();
            }
            var opt = _.mix({
                confirmText: '确认',
                cancelText: '取消',
                multiselect: false
            }, me.data());
            opt.options = $(opt.options || '.option', me);
            actionView(me, opt).open();
        },

        '.ck-modal-button': open_modal_card,

        '.ck-actionview .content > article .option': function(){
            actionView.current.select(this);
        },

        '.ck-actionview > footer .confirm': function(){
            actionView.current.confirm();
        },

        '.ck-actionview > footer .cancel': function(){
            actionView.current.cancel();
        },

        '.ck-modalview .wrapper > header .confirm': function(){
            modalCard.confirm();
        },

        '.ck-modalview .wrapper > header .cancel': function(){
            modalCard.cancel();
        },

        '.ck-top-create .btn': open_modal_card,

        '.ck-top-action .btn': function(){
        
        }
    
    };

    function open_modal_card(){
        ck.openModal($(this).data());
    }

    function enable_control(){
        var controller = control(this);
        if (!controller.isEnabled) {
            controller.enable();
            mark_gc(controller);
        }
    } 

    function toggle_control(){
        var controller = control(this).toggle();
        mark_gc(controller);
    } 

    function mark_gc(com){
        if (!com.parentId) {
            com.parentId = ++gc_id;
        }
        ck.viewportGarbage[com.parentId] = 1;
    }

    modalCard.event.bind('open', function(modalCard){
        ck.disableView = true;
        ck.showTopbar();
        $(body).addClass('bg').addClass('modal-view');
        setTimeout(function(){
            choreo.transform(modalCard._wrapper[0], 'translateY', '0');
            var prev = ck.viewport,
                current = modalCard._contentWrapper;
            ck.changeView(current, { 
                isModal: true 
            });
            var h = current[0].offsetHeight*2;
            if (modalCard._iframeContent) {
                modalCard._iframeContent.css({
                    minHeight: h + 'px',
                    width: current[0].offsetWidth + 'px',
                    height: current[0].offsetHeight - ck.headerHeight + 'px'
                });
                modalCard.event.done('frameOnload', function(){
                    var iframe_body = $(modalCard._iframeWindow[0].document.body);
                    iframe_body.bind('touchstart', prevent_window_scroll);
                    ck.initView(iframe_body, {
                        isModal: true
                    });
                });
            }
            modalCard._content.css('minHeight', h + 'px');
            modalCard.event.once('close', function(){
                ck.changeView(prev);
            });
        }, 200);
    });

    bus.bind('actionView:open', function(actionCard){
        ck.disableView = true;
        var prev = ck.viewport,
            current = actionCard._wrapper;
        ck.changeView(current, { 
            isModal: true 
        });
        var h = current[0].offsetHeight;
        actionCard._wrapperContent.css({
            height: h + 'px',
        });
        actionCard._node.css({
            height: h + 'px'
        });
        actionCard.event.once('close', function(){
            ck.changeView(prev);
        });
    });

    var ck = {

        init: function(opt){
            var root = this.root = opt.root;
            this.wrapper = $('.ck-wrapper', root);
            this.header = $('.ck-header', root);
            this.footer = $('.ck-footer', root);
            this.raw = $('.ck-raw', root);
            this.loadingCard = $('#ckLoading');
            this.defaultCard = $('#ckDefault');
            this.globalMask = $(TPL_MASK).appendTo(body);
            this.headerHeight = this.header.height();
            this.windowFullHeight = Infinity;
            this.inited = false;
            this.viewportGarbage = {};

            this.scrollGesture = momoScroll(document);
            momoTap(document);

            if (!SUPPORT_OVERFLOWSCROLL) {
                $(body).addClass('no-overflow-scrolling');
            }
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

            $(document).bind('scrolldown', function(){
                if (topbar_holded) {
                    return;
                }
                setTimeout(function(){
                    ck.hideAddressbar();
                }, 0);
                if (ck.viewport[0].scrollTop >= ck.headerHeight) {
                    ck.hideTopbar();
                } else {
                    $(document).bind('touchmove', delay_hide_topbar)
                        .bind('touchend', delay_hide_topbar);
                }
            }).bind('scrollup', function(){
                ck.showTopbar();
            }).bind('scrollstart', function(){
                ck.globalMask.show();
            }).bind('scrollend', function(){
                ck.globalMask.hide();
                prevent_window_scroll();
            }).bind('scroll', function(){
                if (modalCard.isOpened) {
                    var y = window.scrollY;
                    ck.hideAddressbar();
                    if (y > 40) {
                        ck.viewport[0].scrollTop = ck.viewport[0].scrollTop + y - 40;
                    }
                }
            });

            $(document).bind('touchstart', prevent_window_scroll);

            var startY,
                hold_timer,
                topbar_holded,
                cancel_hold = function(){
                    clearTimeout(hold_timer);
                    if (topbar_holded) {
                        topbar_holded = false;
                        growl.tip.close();
                    }
                };
            this.header.bind('touchstart', function(e){
                startY = e.touches[0].clientY;
                hold_timer = setTimeout(function(){
                    topbar_holded = true;
                    ck.viewport[0].scrollTop = 0;
                    growl.tip.set({
                        content: '向下拖动显示地址栏'
                    }).open();
                }, 200);
            }).bind('touchmove', function(e){
                clearTimeout(hold_timer);
                if (topbar_holded && e.touches[0].clientY < startY) {
                    cancel_hold();
                    topbar_holded = true;
                    ck.windowFullHeight = Infinity;
                    ck.hideAddressbar();
                }
            }).bind('touchend', cancel_hold).bind('touchcancel', cancel_hold);

        },

        initState: function(){

            $(window).bind("popstate", function(e){
                clearTimeout(back_timeout);
                var loading = ck.viewport[0].id === 'ckLoading'; // alert(['pop', e.state && [e.state.prev, e.state.next], ck.viewport && ck.viewport[0].id].join(', '))
                if (e.state) {
                    if (e.state.next === '_modal_') {
                        // 11. forward from normal card, show modal card.  alert(11)
                        modalCard.set(e.state.opt).open();
                    } else if (modalCard.isOpened) {
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
                modalCard.set(history.state.opt).open();
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

        initView: function(card, opt){
            if (!card.data('rendered')) {
                render(card, this.raw, this.footer, opt);
                if (!opt.isModal) {
                    card.data('rendered', '1');
                }
            }
            this.watchScroll(card);
        },

        releaseView: function(){
            control.gc(check_gc);
            picker.gc(check_gc);
            this.viewportGarbage = {};
            gc_id = 0;
        },

        changeView: function(card, opt){
            opt = opt || {};
            //this.releaseView(); // @TODO release when modal open
            if (typeof card === 'string') {
                card = $('#' + card);
            }
            this.initView(card, opt);
            this.viewport = card.show();
            if (card !== this.loadingCard) {
                this.updateSize();
            }
            if (!opt.isModal) {
                this.updateHeader();
            }
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

        updateHeader: function(){
            var top_submit = this.header.find('.ck-top-create').empty();
            var create_btn = this.viewport.find('.ckd-top-create').html();
            if (create_btn) {
                top_submit.append(create_btn);
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
            this.hideAddressbar();
            if (!modalCard.isOpened) {
                push_history(ck.viewport[0].id, '_modal_', false, opt);
            }
            modalCard.set(opt).open();
        },

        closeModal: function(){
            ck.disableView = false;
            $(body).removeClass('modal-view');
            choreo.transform(modalCard._wrapper[0], 'translateY', '100%');
            setTimeout(function(){
                $(body).removeClass('bg');
                modalCard.close();
            }, 400);
        },

        control: control,
        picker: picker,
        modalCard: modalCard,
        actionView: actionView 

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
            } else if ($(me).attr('target')) {
                return;
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
        if (actionView.current) {
            actionView.current.close();
        }
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
                back_timeout = setTimeout(function(){
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
        if (vp.scrollTop < 1) {
            vp.scrollTop = 1;
        } else if (vp.scrollTop > (bottom = vp.scrollHeight 
                - vp.offsetHeight - 1)) {
            vp.scrollTop = bottom;
        }
    }

    function delay_hide_topbar(){
        if (ck.viewport[0].scrollTop >= ck.headerHeight) {
            ck.hideTopbar();
            $(document).unbind('touchmove', delay_hide_topbar)
                .unbind('touchend', delay_hide_topbar);
        }
    }

    function check_gc(controller){
        return ck.viewportGarbage[controller.parentId];
    }

    return ck;

});
