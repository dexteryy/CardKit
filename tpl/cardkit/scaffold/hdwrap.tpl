
{% if (component.hd) { %}
<header class="ck-hd-wrap">

    {%= component.hd %}

    {% if (component.hdOpt.length) { %}
        <div class="ck-hdopt-wrap">
            {%= component.hdOpt.join('') %}
        </div>
    {% } %}

</header>
{% } %}
