
define('cardkit/env', ['mo/browsers'], function(){
    return {
        //showScrollMask: true,
        //showControlMask: true,
        //hideToolbars: true,
        enableConsole: true
    };
});

require([
    'mo/cookie',
    'cardkit/app',
    'cardkit/pageready'
], function(cookie, ck){

    ck.delegate.on('tap', '.ck-top-actions .ck-item.switchstyle', function(){
        ck.confirm('This is a demo', function(){
            cookie('_ck_desktop_mode', 1, {
                domain: location.host
            });
            location.reload();
        });
    });

});

(function(){

    SyntaxHighlighter.defaults['toolbar'] = false;

    var democodes = document.querySelectorAll('.democode');
    for (var i = 0, box, src, l = democodes.length; i < l; i++) {
        box = democodes[i];
        src = box.getAttribute('jssource');
        if (src) {
            box.innerHTML = '<script type="syntaxhighlighter" class="brush: js"><![CDATA['
                + (document.getElementById(src) || {}).innerHTML
                + ']]></script>';
        } else {
            src = document.getElementById(box.getAttribute('gsource') || 'none')
                || box.parentNode.parentNode.querySelectorAll('.' 
                    + (box.getAttribute('source') || 'demo'))[0] 
                || {};
            box.innerHTML = '<script type="syntaxhighlighter" class="brush: html"><![CDATA['
                + src.outerHTML
                + ']]></script>';
        }
    }

    SyntaxHighlighter.all();

})();
