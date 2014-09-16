from django.conf.urls import patterns, url

from geonode.urls import *
from django.views.generic import TemplateView
from geonode.api.urls import api

from analytics.models import AnalysisResource

api.register(AnalysisResource())

urlpatterns = patterns('',
    url(r'^analytics/$', TemplateView.as_view(template_name='analytics/analysis_list.html'), name='analyses_browse'),
    url(r'', include(api.urls))
 ) + urlpatterns
