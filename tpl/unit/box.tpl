
<article>

    {% if (data.hd) { %}
    <header>
        {% if (data.hd_url) { %}
        <a href="{%= data.hd_url %}" class="ck-link">{%= data.hd %}</a>
        {% } else { %}
        <span>{%= data.hd %}</span>
        {% } %}
        {% if (data.hd_opt) { %}
        <div class="ck-hdopt">{%=data.hd_opt%}</div>
        {% } %}
    </header>
    {% } %}

    {% if (data.hasContent) { %}
    <section>{%= data.content %}</section>
    {% } %}

    {% if (data.ft) { %}
    <footer>{%= data.ft %}</footer>
    {% } %}

</article>
