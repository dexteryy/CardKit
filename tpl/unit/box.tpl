
{% function hd(){ %}
    {% if (data.hd) { %}
    <header class="ck-hd-wrap">

        <span class="ck-hd {%= (data.hd_url && 'clickable' || '') %}">
            {% if (data.hd_url) { %}
            <a href="{%= data.hd_url %}" class="ck-link ck-link-mask {%= (data.hd_url_extern ? 'ck-link-extern' : '') %}"></a>
            {% } %}
            <span>{%= data.hd %}</span>
        </span>

        {% if (data.hd_opt) { %}
        <div class="ck-hdopt-wrap">{%=data.hd_opt%}</div>
        {% } %}

    </header>
    {% } %}
{% } %}

{% if (data.config.plain || data.config.plainhd) { %}
    {%= hd() %}
{% } %}

<article class="ck-unit-wrap">

    {% if (!data.config.plain && !data.config.plainhd) { %}
        {%= hd() %}
    {% } %}

    {% if (data.hasContent) { %}
    <section>
        {% if (data.config.disableReader) { %}
        <script type="text/template" class="ckd-delay-content">
        {%= data.content %}
        </script>
        {% } else { %}
        {%= data.content %}
        {% } %}
    </section>
    {% } %}

    {% if (data.ft) { %}
    <footer>{%= data.ft %}</footer>
    {% } %}

</article>
