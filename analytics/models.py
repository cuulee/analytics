
from django.db import models
from django.db.models import signals
from geonode.base.models import ResourceBase, resourcebase_post_save
from geonode.api.resourcebase_api import CommonModelApi, CommonMetaApi
from django.core.urlresolvers import reverse


class Analysis(ResourceBase):
    data = models.TextField()

    def get_absolute_url(self):
        return reverse('analytics.views.analysis_detail', None, [str(self.id)])

class AnalysisResource(CommonModelApi):
    class Meta(CommonMetaApi):
        queryset = Analysis.objects.distinct().order_by('-date')
        resource_name = 'analysis'

signals.post_save.connect(resourcebase_post_save, sender=Analysis)
