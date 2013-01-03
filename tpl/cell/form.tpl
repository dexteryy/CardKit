
<article>

    {% if (data.hd) { %}
    <header>
        {% if (data.hd_url) { %}
        <a href="{%= data.hd_url %}" class="ck-link">{%= data.hd %}</a>
        {% } else { %}
        <span>{%= data.hd %}</span>
        {% } %}
        {% if (data.subtitle) { %}
        <span class="ck-subtitle">{%= data.subtitle %}</span>
        {% } %}
        {% if (data.info) { %}
        <span class="ck-info">{%= data.info %}</span>
        {% } %}
    </header>
    {% } %}

    <fieldset>
    {% data.items.forEach(function(item){ %}
        {% if (item.label) { %}
        <label>{%= item.label %}</label>
        {% } %}
        {%= item.field %}
    {% }); %}
    </fieldset>

    {% if (data.ft) { %}
    <footer>{%= data.ft %}</footer>
    {% } %}

</article>

