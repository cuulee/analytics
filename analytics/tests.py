

from django.test import TestCase
from django.test.client import Client
from django.core.urlresolvers import reverse

class AnalyticsTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = 'admin'
        self.passwd = 'admin'

    def test_analytics_tab(self):
        response = self.client.get(reverse('analyses_browse'))
        self.assertEqual(response.status_code, 200)
