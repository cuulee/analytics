from django.conf.urls import patterns, url

from geonode.urls import *
from django.views.generic import TemplateView

urlpatterns = patterns('',

    # Static pages
    url(r'^$', TemplateView.as_view(template_name='site_base.html'), name='index'),
 ) + urlpatterns
