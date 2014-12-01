
from django.utils.html import strip_tags
from django.utils.translation import ugettext as _

from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response
from django.template import RequestContext

from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache

from django.shortcuts import render, redirect
from django.core.exceptions import PermissionDenied
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseRedirect
from django.conf import settings

from geonode.utils import resolve_object
from geonode.base.forms import CategoryForm
from geonode.base.models import TopicCategory
from geonode.people.forms import ProfileForm
from geonode.security.views import _perms_info_json
from geonode.documents.models import get_related_documents

from analytics.models import Analysis, ChartTip
from analytics.forms import AnalysisForm

from django.views.decorators.gzip import gzip_page

import json

_PERMISSION_MSG_DELETE = _("You are not permitted to delete this analysis.")
_PERMISSION_MSG_GENERIC = _('You do not have permissions for this analysis.')
_PERMISSION_MSG_LOGIN = _("You must be logged in to save this analysis")
_PERMISSION_MSG_METADATA = _("You are not allowed to modify this analysis' metadata.")
_PERMISSION_MSG_VIEW = _("You are not allowed to view this analysis.")
_NOT_A_VALID_JSON_DOC = _("Not a valid JSON document.")

def _resolve_analysis(request, identifier, permission='base.change_resourcebase',
                      msg=_PERMISSION_MSG_GENERIC, **kwargs):
    """
    Resolve the Analysis by the provided typename and check the optional permission.
    """
    return resolve_object(request, Analysis, {'pk':identifier}, permission=permission,
                          permission_msg=msg, **kwargs)

@gzip_page
def new_analysis(request, template='analytics/analysis_view.html'):
    """ Show a new analysis. A copy parameter can be given, this parameter is
    the id of an analysis from which we should copy the state to display on the
    new analysis """

    if request.method == 'GET' and 'copy' in request.GET:
        analysis_obj = _resolve_analysis(request, request.GET['copy'], 'base.view_resourcebase')
        config = analysis_obj.data
        return render(request, template, {'config': config})

    return render(request, template, {'chart_tips' : ChartTip.objects.all(), 'fixtures': settings.FIXTURES, 'csts': settings.CSTS})

def analysis_view(request, analysisid, template='analytics/analysis_view.html'):
    """ The view that show the analytics main viewer. """
    try:
        analysis_obj = _resolve_analysis(request, analysisid, 'base.view_resourcebase', _PERMISSION_MSG_VIEW)

        return render(request, template, {
            'analysis' : analysis_obj,
            'chart_tips' : ChartTip.objects.all(),
            'fixtures': settings.FIXTURES,
            'csts': settings.CSTS
        })
    except PermissionDenied:
        if not request.user.is_authenticated():
            # If the user is not authenticated raising a PermissionDenied redirects him to the login page
            raise PermissionDenied

        return HttpResponse(_PERMISSION_MSG_VIEW, status=401, mimetype='text/plain')

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
    return HttpResponse(_PERMISSION_MSG_VIEW, status=401, mimetype='text/plain')

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
                    _NOT_A_VALID_JSON_DOC,
                    mimetype="text/plain",
                    status=400
                )

        except PermissionDenied:
            return HttpResponse(
                _PERMISSION_MSG_GENERIC,
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
                _PERMISSION_MSG_LOGIN,
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
            _PERMISSION_MSG_DELETE,
            mimetype="text/plain",
            status=401
            )

@login_required
def analysis_metadata(request, analysisid, template='analytics/analysis_metadata.html'):

    analysis_obj = _resolve_analysis(request, analysisid, 'base.view_resourcebase', _PERMISSION_MSG_VIEW)

    poc = analysis_obj.poc

    metadata_author = analysis_obj.metadata_author

    topic_category = analysis_obj.category

    if request.method == "POST":
        analysis_form = AnalysisForm(request.POST, instance=analysis_obj, prefix="resource")
        category_form = CategoryForm(
            request.POST,
            prefix="category_choice_field",
            initial=int(
                request.POST["category_choice_field"]) if "category_choice_field" in request.POST else None)
    else:
        analysis_form = AnalysisForm(instance=analysis_obj, prefix="resource")
        category_form = CategoryForm(
            prefix="category_choice_field",
            initial=topic_category.id if topic_category else None)

    if request.method == "POST" and analysis_form.is_valid(
    ) and category_form.is_valid():
        new_poc = analysis_form.cleaned_data['poc']
        new_author = analysis_form.cleaned_data['metadata_author']
        new_keywords = analysis_form.cleaned_data['keywords']
        new_title = strip_tags(analysis_form.cleaned_data['title'])
        new_abstract = strip_tags(analysis_form.cleaned_data['abstract'])
        new_category = TopicCategory.objects.get(
            id=category_form.cleaned_data['category_choice_field'])

        if new_poc is None:
            if poc is None:
                poc_form = ProfileForm(
                    request.POST,
                    prefix="poc",
                    instance=poc)
            else:
                poc_form = ProfileForm(request.POST, prefix="poc")
            if poc_form.has_changed and poc_form.is_valid():
                new_poc = poc_form.save()

        if new_author is None:
            if metadata_author is None:
                author_form = ProfileForm(request.POST, prefix="author",
                                          instance=metadata_author)
            else:
                author_form = ProfileForm(request.POST, prefix="author")
            if author_form.has_changed and author_form.is_valid():
                new_author = author_form.save()

        if new_poc is not None and new_author is not None:
            the_analysis = analysis_form.save()
            the_analysis.poc = new_poc
            the_analysis.metadata_author = new_author
            the_analysis.title = new_title
            the_analysis.abstract = new_abstract
            the_analysis.save()
            the_analysis.keywords.clear()
            the_analysis.keywords.add(*new_keywords)
            the_analysis.category = new_category
            the_analysis.save()
            return HttpResponseRedirect(
                reverse(
                    'analysis_detail',
                    args=(
                        analysis_obj.id,
                    )))
    if poc is None:
        poc_form = ProfileForm(request.POST, prefix="poc")
    else:
        if poc is None:
            poc_form = ProfileForm(instance=poc, prefix="poc")
        else:
            analysis_form.fields['poc'].initial = poc.id
            poc_form = ProfileForm(prefix="poc")
            poc_form.hidden = True

    if metadata_author is None:
        author_form = ProfileForm(request.POST, prefix="author")
    else:
        if metadata_author is None:
            author_form = ProfileForm(
                instance=metadata_author,
                prefix="author")
        else:
            analysis_form.fields['metadata_author'].initial = metadata_author.id
            author_form = ProfileForm(prefix="author")
            author_form.hidden = True

    return render_to_response(template, RequestContext(request, {
        "analysis": analysis_obj,
        "analysis_form": analysis_form,
        "poc_form": poc_form,
        "author_form": author_form,
        "category_form": category_form,
    }))

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
        _NOT_A_VALID_JSON_DOC,
        mimetype="text/plain",
        status=200
    )
