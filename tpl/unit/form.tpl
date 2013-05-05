
<article>

    {% if (data.hd) { %}
    <header>

        <span class="ck-hd {%= (data.hd_url && 'clickable' || '') %}">
            {% if (data.hd_url) { %}
            <a href="{%= data.hd_url %}" class="ck-link ck-link-mask"></a>
            {% } %}
            <span>{%= data.hd %}</span>
        </span>

        {% if (data.hd_opt) { %}
        <div class="ck-hdopt">{%=data.hd_opt%}</div>
        {% } %}

    </header>
    {% } %}

    <section>
    {% if (!data.items.length) { %}
    <div class="ck-item blank">{%=(data.config.blank || '目前还没有内容')%}</div>
    {% } %}
    {% data.items.forEach(function(item){ %}
        <div class="ck-item">
            {%= item.content %}
        </div>
    {% }); %}
    </section>

    {% if (data.ft) { %}
    <footer>{%= data.ft %}</footer>
    {% } %}

</article>

