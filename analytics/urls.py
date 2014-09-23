from django.conf.urls import patterns, url

from geonode.urls import *
from django.views.generic import TemplateView
from geonode.api.urls import api

from analytics.models import AnalysisResource

import views

api.register(AnalysisResource())

urlpatterns = patterns('',
    url(r'^analytics/$', TemplateView.as_view(template_name='analytics/analysis_list.html'), name='analyses_browse'),
    url(r'^analytics/new/$', 'analytics.views.new_analysis', name='new_analysis'),
    url(r'^analytics/new/data/$', 'analytics.views.new_analysis_json', name='new_analysis_json'),
    url(r'^analytics/(?P<analysisid>\d+)/view/$', 'analytics.views.analysis_view', name='analysis_view'),
    url(r'^analytics/(?P<analysisid>\d+)/$', 'analytics.views.analysis_detail', name='analysis_detail'),
    url(r'^analytics/(?P<analysisid>\d+)/data/$', 'analytics.views.analysis_data', name='analysis_data'),
    url(r'^analytics/(?P<analysisid>\d+)/remove/$', 'analytics.views.analysis_remove', name='analysis_remove'),
    url(r'^analytics/api/$', 'analytics.views.solap4py_api', name='solap4py_api'),
    url(r'', include(api.urls))
 ) + urlpatterns
