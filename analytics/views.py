

from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from django.http import HttpResponse, HttpResponseRedirect

def new_analysis(request, template='analytics/analysis_view.html'):
    """ Show a new analysis. """
    return render(request, template, {})

@never_cache
@csrf_exempt
def solap4py_api(request):
    """
    View to communicate with solap4py.
    """
    if request.method == 'POST':
        from analytics.solap4py import solap4py
        import time
        start = time.time()
        data = solap4py.process(request.body)
        print time.time() - start
        return HttpResponse(data, mimetype='application/json', status=200)
    return HttpResponse(
        'Wrong use of the API',
        mimetype="text/plain",
        status=200
    )
