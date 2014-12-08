from modeltranslation.translator import TranslationOptions
from analytics.models import Analysis
from geonode.base.models import ResourceBase
# We need to retrieve the translator after ResourceBase was added to it
from geonode.base.translation import translator

class AnalysisTranslationOptions(TranslationOptions):
    fields = (
        'title',
        'abstract',
    )

translator.register(Analysis, AnalysisTranslationOptions)
