
require.config({
    baseUrl: 'vendor/',
    aliases: {
        cardkit: '../../cardkit/'
    }
});

define('mo/easing/functions', [], function(){});
define('mo/mainloop', [], function(){});
define('cardkit', '../../cardkit.js');

require(['cardkit'], function(){});

