define([
    'dollar',
    'mo/lang',
    'mo/browsers',
    'mo/template',
    'soviet',
    'choreo',
    'momo/base',
    'momo/tap',
    'momo/swipe',
    'momo/drag',
    'momo/scroll',
    './view/control',
    './view/picker',
    './view/stars',
    './view/modalcard',
    './view/actionview',
    './view/growl',
    './view/slidelist',
    './bus',
    './render',
    './supports',
    'mo/domready'
], function($, _, browsers, tpl, soviet, choreo, 
    momoBase, momoTap, momoSwipe, momoDrag, momoScroll, 
    control, picker, stars, modalCard, actionView, growl, slidelist,
    bus, render, supports){

    var window = this,
        history = window.history,
        location = window.location,
        document = window.document,
        body = document.body,
        back_timeout,
        gc_id = 0,

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

        '.ck-segment .ck-option': function(){
            var p = picker(this.parentNode, {
                ignoreRepeat: true
            });
            p.select(this);
        },

        '.ck-tagselector .ck-option': function(){
            var p = picker(this.parentNode);
            p.select(this);
        },

        '.ck-actions .ck-option': function(){
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
            opt.options = $(opt.options || '.ck-option', me);
            actionView(me, opt).open();
        },

        '.ck-modal-button': open_modal_card,
        '.ck-modal-link': open_modal_card,

        '.ck-growl-button': function(){
            growl(this).open();
        },

        '.ck-actionview article > .ck-option': function(){
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

        '.ck-top-title': function(){
            if (this.href) {
                ck.openURL(this.href);
            }
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

    function respond_stars(e, method) {
        var rater = stars(this),
            score = rater.calc(e);
        rater[method](score);
    }

    function mark_gc(com){
        if (!com.parentId) {
            com.parentId = ++gc_id;
        }
        ck.viewportGarbage[com.parentId] = 1;
    }

    modalCard.event.bind('open', function(modalCard){
        ck.disableView = true;
        //ck.showTopbar();
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
            } else if (!modalCard._content.html()) { // @TODO 换更靠谱的方法
                modalCard.event.done('contentchange', function(){
                    ck.initView(current, {
                        isModal: true
                    });
                });
            }
            modalCard._content.css('minHeight', h + 'px');
            modalCard.event.once('close', function(){
                ck.changeView(prev);
            });
        }, 200);
    }).bind('needclose', function(){
        ck.closeModal();
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
            height: h + 'px'
        });
        actionCard._node.css({
            height: h + 'px'
        });
        actionCard.event.once('close', function(){
            ck.changeView(prev);
        });
    }).bind('actionView:jump', function(actionCard, href, target){
        actionCard.event.once('close', function(){
            ck.openURL(href, { target: target });
        });
    });

    var ck = {

        init: function(opt){
            var root = this.root = opt.root;
            this.wrapper = $('.ck-wrapper', root);
            this.header = $('.ck-header', root);
            this.footer = $('.ck-footer', root);
            this.raw = $('.ck-raw', root);
            this.loadingCard = $('#ckLoading').data('rendered', '1');
            this.defaultCard = $('#ckDefault');
            this.globalMask = $(TPL_MASK).appendTo(body);
            this.headerHeight = this.header.height();
            this.sizeInited = false;
            this.viewportGarbage = {};
            this.sessionLocked = true;
            this.initWindow();

            this.scrollGesture = momoScroll(document);
            momoTap(document);

            if (!supports.OVERFLOWSCROLL) {
                $(body).addClass('no-overflow-scrolling');
            }
            if (supports.SAFARI_TOPBAR) {
                $(body).addClass('mobilesafari-bar');
            }
            this.initState();

            setTimeout(function(){
                ck.hideAddressbar();
                ck.hideLoading();
            }, 0);

            $(window).bind('resize', function(){
                var current = ck.isLandscape();
                if (current !== ck.landscapeMode) {
                    ck.initWindow();
                    ck.hideAddressbar(); // @TODO 无效
                }
            });

            soviet(document, {
                matchesSelector: true,
                preventDefault: true
            }).on('click', {
                'a': nothing,
                'a *': nothing
            }).on('tap', tap_events).on('touchend', {
                '.ck-stars': function(e) {
                    respond_stars.call(this, e, 'val');
                },
                '.ck-stars .slider-selected': function(e) {
                    respond_stars.call(this.parentNode, e, 'val');
                }
            }).on('touchmove', {
                '.ck-stars': function(e) {
                    respond_stars.call(this, e, 'pretend');
                },
                '.ck-stars .slider-selected': function(e) {
                    respond_stars.call(this.parentNode, e, 'pretend');
                }
            });

            $(document).bind('scrolldown', function(){
                if (topbar_holded) {
                    return;
                }
                setTimeout(function(){
                    ck.hideAddressbar();
                }, 0);
                //if (ck.viewport[0].scrollTop >= ck.headerHeight) {
                    //ck.hideTopbar();
                //} else {
                    //$(document).bind('touchmove', delay_hide_topbar)
                        //.bind('touchend', delay_hide_topbar);
                //}
            //}).bind('scrollup', function(){
                //ck.showTopbar();
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

            if (supports.SAFARI_TOPBAR) {

                var startY,
                    hold_timer,
                    topbar_holded,
                    topbar_tips = growl({
                        expires: -1,
                        keepalive: true,
                        content: '向下拖动显示地址栏'
                    }),
                    cancel_hold = function(){
                        clearTimeout(hold_timer);
                        if (topbar_holded) {
                            topbar_holded = false;
                            topbar_tips.close();
                        }
                    };
                this.header.bind('touchstart', function(e){
                    startY = e.touches[0].clientY;
                    hold_timer = setTimeout(function(){
                        topbar_holded = true;
                        ck.viewport[0].scrollTop = 0;
                        topbar_tips.open();
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

            }

        },

        initWindow: function(){
            this.landscapeMode = this.isLandscape();
            this.windowFullHeight = Infinity;
        },

        initState: function(){

            ck.sessionLocked = false;

            var travel_history, restore_state;

            if (supports.HISTORY) {
                $(window).bind("popstate", function(e){
                    // alert(['pop', e.state && [e.state.prev, e.state.next].join('-'), ck.viewport && ck.viewport[0].id].join(', '))
                    if (ck.sessionLocked) {
                        location.reload(true);
                        return;
                    }
                    clearTimeout(back_timeout);
                    var loading = ck.viewport[0].id === 'ckLoading'; 
                    if (e.state) {
                        if (e.state.next === '_modal_') {
                            // 11. forward from normal card, show modal card.  alert(11)
                            if (modalCard.isOpened || loading || !ck.viewport) {
                                history.back();
                            } else {
                                modalCard.set(e.state.opt).open();
                            }
                        } else if (modalCard.isOpened) {
                            // 12. back from modal card.  alert(12)
                            ck.closeModal();
                        } else if (loading) {
                            if (e.state.next === 'ckLoading') {
                                // 6. back from other page, no GC. 
                                //    go to 2.  alert(6)
                                history.back();
                            } else if (e.state.next) {
                                // 7. from 6, hide loading immediately.  alert(7)
                                ck.changeView(e.state.next);
                                ck.hideLoading();
                            }
                        } else if (e.state.prev === ck.viewport[0].id) {
                            // 3. forward from normal card.  alert(3)
                            link_handler(e.state.next, e.state.link);
                        } else if (e.state.next === ck.viewport[0].id){ // @TODO hotfix for chrome
                            history.back();
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

                //console.info('is_back: ', is_back)
                //console.info('is_lastadd: ', is_lastadd)
                //console.info('is_refresh: ', is_refresh)
                //console.info('url: ', url)
                //console.info('ref: ', ref)
                //console.warn('lasturl: ', lasturl)
                //console.info('index: ', current, footprint.indexOf(url))
                //console.info('data: ', footprint)

                travel_history = check_footprint();

                var current_state = history.state,
                    restore_state = current_state && current_state.next; // alert(['init', current_state && [current_state.prev, current_state.next].join('-'), ck.viewport && ck.viewport[0].id].join(', '))
                if (restore_state === '_modal_') { // @TODO
                    restore_state = current_state.prev;
                    if (!modalCard.isOpened && ck.viewport) {
                        modalCard.set(history.state.opt).open();
                    }
                }

                //console.info(travel_history, restore_state, current_state)

            } else if (supports.PREVENT_CACHE) {

                $(window).bind("popstate", function(){
                    window.location.reload(true);
                });

            }

            if (restore_state) {
                // 1. reload from normal card.  alert(1)
                ck.changeView(restore_state);
                if (restore_state === 'ckLoading') {
                    // 9.  alert(9)
                    history.back();
                }
            } else {
                if (travel_history) {
                    // 8.  alert(8)
                    ck.changeView(ck.loadingCard);
                    history.forward();
                    setTimeout(function(){
                        if (ck.viewport === ck.loadingCard) {
                            ck.initNewPage();
                        }
                    }, 100);
                } else {
                    // 0.  alert(0)
                    ck.initNewPage();
                }
            }

        },

        initNewPage: function(){
            ck.changeView(ck.defaultCard);
            push_history(ck.loadingCard[0].id, ck.defaultCard[0].id);
        },

        initView: function(card, opt){
            if (!card.data('rendered')) {
                render.initCard(card, this.raw, this.footer, opt);
                if (!opt.isModal) {
                    card.data('rendered', '1');
                }
                card.find('.ck-mini-unit').forEach(function(unit){
                    var slide = $('.ck-inslide', unit);
                    if (slide[0]) {
                        var pagers = $('.ck-page span', unit);
                        slidelist(slide).event.bind('change', function(n){
                            pagers.removeClass('enable');
                            pagers.eq(n).addClass('enable');
                        });
                    }
                });
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
            sessionStorage['ck_lasturl'] = location.href;
            bus.fire('readycardchange', [card]);
        },

        updateSize: function(){
            this.viewport[0].style.height = (this.sizeInited ? 
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

        renderUnit: function(node){
            render.initUnit(node, this.raw);
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
                if (!this.sizeInited) {
                    this.sizeInited = true;
                }
                this.loadingCard.find('div')[0].style.visibility = 'hidden';
                if (supports.SAFARI_TOPBAR) {
                    window.scrollTo(0, 1);
                }
                this.windowFullHeight = window.innerHeight;
                ck.updateSize();
                this.loadingCard.find('div')[0].style.visibility = '';
            }
        },

        isLandscape: function() {
            return window.innerWidth / window.innerHeight > 1.1;
        },

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

        openURL: open_url,

        delegate: soviet(document, {
            autoOverride: true,
            matchesSelector: true,
            preventDefault: true
        }),

        event: bus,

        control: control,
        picker: picker,
        modalCard: modalCard,
        actionView: actionView, 
        growl: growl

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
            } else if (/(^|\s)ck-\w+/.test(me.className)) {
                return;
            } else if (me.target) {
                open_url(me.href, me);
                return;
            }
        }
        var next = next_id && $('#' + next_id);
        if (!next) {
            if (me) {
                next_id = 'ckLoading';
                next = ck.loadingCard;
                true_link = me.href;
            } else {
                return;
            }
        }
        if (supports.PREVENT_CACHE && next === ck.loadingCard) {
            if (true_link) {
                location.href = true_link;
            }
            return;
        }
        ck.sessionLocked = true;
        var current = ck.viewport;
        if (!is_forward) {
            push_history(current[0].id, next_id, true_link);
        }
        ck.globalMask.show();
        //ck.showTopbar();
        next.addClass('moving');
        ck.changeView(next);
        choreo().play().actor(ck.wrapper[0], {
            'transform': 'translateX(' + (0 - window.innerWidth) + 'px)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide();
            choreo.transform(ck.wrapper[0], 'translateX', '0');
            next.removeClass('moving');
            ck.globalMask.hide();
            ck.sessionLocked = false;
            if (true_link) {
                if (is_forward && supports.HISTORY) {
                    history.forward();
                } else {
                    location.href = true_link;
                }
            }
        });
    }

    function back_handler(prev_id){
        ck.sessionLocked = true;
        var prev = $('#' + prev_id);
        var current = ck.viewport;
        if (actionView.current) {
            actionView.current.close();
        }
        //if (supports.PREVENT_CACHE && prev === ck.loadingCard) {
            //ck.sessionLocked = false;
            //history.back();
            //return;
        //}
        ck.globalMask.show();
        //ck.showTopbar();
        choreo.transform(ck.wrapper[0], 'translateX', 0 - window.innerWidth + 'px');
        current.addClass('moving');
        prev.show();
        ck.changeView(prev);
        choreo().play().actor(ck.wrapper[0], {
            'transform': 'translateX(0)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide().removeClass('moving');
            ck.globalMask.hide();
            ck.sessionLocked = false;
            if (prev_id === 'ckLoading') {
                history.back();
                back_timeout = setTimeout(function(){
                    location.reload(true);
                }, 800);
            }
        });
    }

    function push_history(prev_id, next_id, link, opt){
        if (supports.HISTORY) {
            history.pushState({
                prev: prev_id,
                next: next_id,
                link: link,
                opt: opt,
                i: history.length
            }, document.title, location.href);
        }
    }

    function check_footprint(){
        var footprint = sessionStorage['ck_footprint'];
        try {
            footprint = footprint && JSON.parse(footprint) || [];
        } catch(ex) {
            footprint = [];
        }
        var url = location.href,
            ref = document.referrer,
            lasturl = sessionStorage['ck_lasturl'],
            current = footprint.lastIndexOf(url),
            is_refresh = lasturl === url && ref !== url,
            is_first = url === footprint[0],
            is_lastadd = url === footprint[footprint.length - 1],
            is_back = lasturl && lasturl !== ref && !is_refresh;
        if ((is_back || is_refresh) && is_first) {
            return;
        }
        if (ref) {
            if (ref === url) {
                footprint.length = 0;
                footprint.push(url);
            } else if (!is_back && ref === footprint[footprint.length - 1]) {
                if (current !== -1) { 
                    footprint.splice(0, current + 1);
                }
                footprint.push(url);
            } else if (is_back && lasturl === footprint[0]) {
                if (current !== -1) { 
                    footprint.length = current - 1;
                }
                footprint.unshift(url);
            } else if (ref === footprint[current - 1]) {
                return true; // travel_history
            } else if (ref === footprint[footprint.length - 2]
                    && is_lastadd && !is_back) {
                return;
            } else {
                footprint.length = 0;
                footprint.push(url);
            }
        } else if (is_lastadd) {
            return;
        } else {
            footprint.length = 0;
            footprint.push(url);
        }
        sessionStorage['ck_footprint'] = JSON.stringify(footprint);
        //console.warn('changed: ', sessionStorage['ck_footprint'])
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

    //function delay_hide_topbar(){
        //if (ck.viewport[0].scrollTop >= ck.headerHeight) {
            //ck.hideTopbar();
            //$(document).unbind('touchmove', delay_hide_topbar)
                //.unbind('touchend', delay_hide_topbar);
        //}
    //}

    function open_url(true_link, opt){
        opt = opt || { target: '_self' };
        if (modalCard.isOpened) {
            modalCard.event.once('close', function(){
                open_url(true_link, opt);
            });
            ck.closeModal();
            return;
        }
        if (opt.target !== '_self') {
            window.open(true_link, opt.target);
        } else {
            if (supports.PREVENT_CACHE) {
                location.href = true_link;
                return;
            }
            ck.sessionLocked = true;
            var next_id = 'ckLoading';
            var next = ck.loadingCard;
            var current = ck.viewport;
            ck.globalMask.show();
            push_history(current[0].id, next_id, true_link);
            ck.changeView(next);
            setTimeout(function(){
                current.hide();
                ck.globalMask.hide();
                ck.sessionLocked = false;
                location.href = true_link;
            }, 10);
        }
    }

    function check_gc(controller){
        return ck.viewportGarbage[controller.parentId];
    }

    return ck;

});
