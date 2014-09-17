

from django.utils.translation import ugettext as _
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from django.http import HttpResponse, HttpResponseRedirect
from django.core.exceptions import PermissionDenied
from geonode.utils import resolve_object
from analytics.models import Analysis
from django.shortcuts import render

_PERMISSION_MSG_DELETE = _("You are not permitted to delete this analysis.")
_PERMISSION_MSG_GENERIC = _('You do not have permissions for this analysis.')
_PERMISSION_MSG_LOGIN = _("You must be logged in to save this analysis")
_PERMISSION_MSG_METADATA = _("You are not allowed to modify this analysis' metadata.")
_PERMISSION_MSG_VIEW = _("You are not allowed to view this analysis.")

def _resolve_analysis(request, identifier, permission='base.change_resourcebase',
                      msg=_PERMISSION_MSG_GENERIC, **kwargs):
    """
    Resolve the Analysis by the provided typename and check the optional permission.
    """
    return resolve_object(request, Analysis, {'pk':identifier}, permission=permission,
                          permission_msg=msg, **kwargs)

def new_analysis(request, template='analytics/analysis_view.html'):
    """ Show a new analysis. """
    return render(request, template, {})

def analysis_view(request, analysisid, template='analytics/analysis_view.html'):
    """ The view that show the analytics main viewer. """
    try:
        analysis_obj = _resolve_analysis(request, analysisid, 'base.view_resourcebase', _PERMISSION_MSG_VIEW)

        return render(request, template, {
            'analysis' : analysis_obj
        })
    except PermissionDenied:
        if not request.user.is_authenticated():
            # If the user is not authenticated raising a PermissionDenied redirects him to the login page
            raise PermissionDenied

        return HttpResponse('You are not allowed to view this analysis', status=401, mimetype='text/plain')

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
