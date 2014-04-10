<div class="ck-form-card {%= (state.blankText === 'false' ? 'no-blank' : '') %} {%= state.customClass %}"
        data-style="{%= state.subtype %}"
        {%= state.plainHdStyle ? 'data-cfg-plainhd="true" ' : '' %}>

    {% if (hasSplitHd) { %}
        {%= hdwrap %}
    {% } %}

    <article class="ck-card-wrap">

        {% if (!hasSplitHd) { %}
            {%= hdwrap %}
        {% } %}

        {% if (component.item.length) { %}
            {% component.item.forEach(function(item){ %}
                {%= item %}
            {% }); %}
        {% } else { %}
            <div class="ck-item blank">
            {% if (component.blank) { %}
                {%= component.blank %}
            {% } else { %}
                {%=(state.blankText || '目前还没有内容')%}
            {% } %}
            </div>
        {% } %}

        {%= component.ft %}

    </article>

</div>
