

from geonode.security.views import _perms_info_json
from django.utils.translation import ugettext as _
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from geonode.documents.models import get_related_documents
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseRedirect
from django.core.exceptions import PermissionDenied
from geonode.utils import resolve_object
from analytics.models import Analysis
from django.shortcuts import render, redirect
import json

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
    """ Show a new analysis. A copy parameter can be given, this parameter is
    the id of an analysis from which we should copy the state to display on the
    new analysis """

    if request.method == 'GET' and 'copy' in request.GET:
        analysis_obj = _resolve_analysis(request, request.GET['copy'], 'base.view_resourcebase')
        config = analysis_obj.data
        return render(request, template, {'config': config})

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

def analysis_detail(request, analysisid, template='analytics/analysis_detail.html'):
    """ The view that show details of each analysis. """
    try:
        analysis_obj = _resolve_analysis(request, analysisid, 'base.view_resourcebase', _PERMISSION_MSG_VIEW)

        analysis_obj.popular_count += 1
        analysis_obj.save()

        return render(request, template, {
            'resource' : analysis_obj,
            'documents' : get_related_documents(analysis_obj),
            'permission_json' : _perms_info_json(analysis_obj),
        })
    except PermissionDenied:
        if not request.user.is_authenticated():
            # If the user is not authenticated raising a PermissionDenied redirects him to the login page
            raise PermissionDenied
    return HttpResponse('You are not allowed to view this analysis', status=401, mimetype='text/plain')

def analysis_data(request, analysisid):
    """ Update the analysis. """
    if request.method == 'PUT':
        try:
            analysis_obj = _resolve_analysis(request, analysisid, 'base.change_resourcebase',
                                             _PERMISSION_MSG_DELETE, permission_required=True)
            try:
                data = json.loads(request.body)
                analysis_obj.data = json.dumps(data['data'])
                analysis_obj.save()
                return HttpResponse("Analysis updated", mimetype="text/plain", status=200)
            except (ValueError, KeyError):
                return HttpResponse(
                    "This is not a valid json document",
                    mimetype="text/plain",
                    status=400
                )

        except PermissionDenied:
            return HttpResponse(
                "You are not allowed to modify this analysis.",
                mimetype="text/plain",
                status=401
            )
    else:
        return HttpResponse(status=405)

def new_analysis_json(request):
    """ The view that saves a new analysis in the database. """
    if request.method == 'POST':
        if not request.user.is_authenticated():
            return HttpResponse(
                'You must be logged in to save new analysis',
                mimetype="text/plain",
                status=401
            )
        try:
            data = json.loads(request.body)
            analysis_obj = Analysis(owner=request.user, title=data['title'], abstract=data['abstract'], data=json.dumps(data['data']))
            analysis_obj.save()
            analysis_obj.set_default_permissions() # This needs to be after .save() so that the analysis has an id.
            return HttpResponse(analysis_obj.id, status=200, mimetype='text/plain')

        except (ValueError, KeyError):
            return HttpResponse('Invalid data.', status=400, mimetype='text/plain')

    else:
        return HttpResponse(status=405)


@login_required
def analysis_remove(request, analysisid, template='analytics/analysis_remove.html'):
    """ Delete an analysis with the given analysisid. """
    try:
        analysis_obj = _resolve_analysis(request, analysisid, 'base.delete_resourcebase', _PERMISSION_MSG_DELETE, permission_required=True)
        if request.method == 'GET':
            return render(request, template, {
                "analysis": analysis_obj
                })
        elif request.method == 'POST':
            analysis_obj.delete()
            return redirect("analyses_browse")
    except PermissionDenied:
        return HttpResponse(
            "You are not allowed to remove this analysis.",
            mimetype="text/plain",
            status=401
            )

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
