
from django.db import models
from django.db.models import signals
from geonode.base.models import ResourceBase, resourcebase_post_save
from geonode.api.resourcebase_api import CommonModelApi, CommonMetaApi
from django.core.urlresolvers import reverse
from agon_ratings.models import OverallRating

from django.contrib.contenttypes.models import ContentType


class Analysis(ResourceBase):
    data = models.TextField()

    def get_absolute_url(self):
        return reverse('analytics.views.analysis_detail', None, [str(self.id)])

class AnalysisResource(CommonModelApi):
    class Meta(CommonMetaApi):
        queryset = Analysis.objects.distinct().order_by('-date')
        resource_name = 'analysis'

def pre_delete_analysis(instance, sender, **kwrargs):
    ct = ContentType.objects.get_for_model(instance)
    OverallRating.objects.filter(
        content_type=ct,
        object_id=instance.id).delete()

signals.pre_delete.connect(pre_delete_analysis, sender=Analysis)
signals.post_save.connect(resourcebase_post_save, sender=Analysis)
