from django.test import TestCase
from django.test.client import Client

from django.core.urlresolvers import reverse
from django.contrib.auth import get_user_model

from geonode.base.populate_test_data import create_models

from analytics.models import Analysis

import json

from functools import wraps
from itertools import repeat

def loggedIn(func):
    """ This decorator adds login before the test and logout after """
    @wraps(func)
    def wrapper(self):
        self.client.login(username=self.user, password=self.passwd)
        result = func(self)
        self.client.logout()
        return result
    return wrapper

def _analyses_json(nb):
    for i in range(1,nb):
        yield {
            "title": "%d" % i,
            "abstract": "abstract %d" % i,
            "data": { "testData": "..." }
        }

def populate_test_db():
    u, _ = get_user_model().objects.get_or_create(username='admin', is_superuser=True, first_name='admin')

    test_analyses = {}

    # Create 5 analyses
    for a in _analyses_json(5):
        analysis = Analysis(owner=u, **a)
        analysis.save()
        test_analyses[analysis.title] = analysis.id

    return test_analyses

class AnalyticsTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = 'admin'
        self.passwd = 'admin'

    def test_analytics_tab(self):
        response = self.client.get(reverse('analyses_browse'))
        self.assertEqual(response.status_code, 200)
