<div class="ck-box-card {%= state.customClass %}"
        data-style="{%= state.subtype %}"
        {%= state.paperStyle ? 'data-cfg-paper="true" ' : '' %}
        {%= state.plainStyle ? 'data-cfg-plain="true" ' : '' %}
        {%= state.plainHdStyle ? 'data-cfg-plainhd="true" ' : '' %}>

    {% if (hasSplitHd) { %}
        {%= hdwrap %}
    {% } %}

    <article class="ck-card-wrap">

        {% if (!hasSplitHd) { %}
            {%= hdwrap %}
        {% } %}

        {% if (!isBlank) { %}
            <section>{%= content %}</section>
        {% } %}

        {%= component.ft %}

    </article>

</div>
