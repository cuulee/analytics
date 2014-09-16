
from django.db import models
from geonode.base.models import ResourceBase
from geonode.api.resourcebase_api import CommonModelApi, CommonMetaApi


class Analysis(ResourceBase):
    data = models.TextField()

class AnalysisResource(CommonModelApi):
    class Meta(CommonMetaApi):
        queryset = Analysis.objects.distinct().order_by('-date')
        resource_name = 'analysis'

