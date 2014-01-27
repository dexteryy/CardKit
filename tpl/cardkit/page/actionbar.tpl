<div class="ck-top-actions">

    {% if (overflowActions.length) { %}
    <span class="ck-top-overflow"
            data-title="More actions...">
        {% overflowActions.forEach(function(action){ %}
            {%= action %}
        {% }); %}
    </span>
    {% } %}

    {% visibleActions.forEach(function(action){ %}
        {%= action %}
    {% }); %}

</div>
