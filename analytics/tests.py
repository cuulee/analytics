from django.test import TestCase
from django.test.client import Client

from django.core.urlresolvers import reverse
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.contenttypes.models import ContentType

from geonode.base.populate_test_data import create_models

from analytics.models import Analysis

import json

from functools import wraps
from itertools import repeat

from agon_ratings.models import OverallRating

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
    for i in range(1, nb):
        yield {
            "title": "%d" % i,
            "abstract": "abstract %d" % i,
            "data": {"testData": "%d" % i}
        }

def populate_db():
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

        create_models()
        self.fixtures = populate_db()

        self.analysis_json = """
        {
            "title": "Test title",
            "abstract": "Test abstract",
            "data": { "someData": "test data" }
        }
        """
        self.analysis_missing_element_json = """
        {
            "title": "Test title",
            "data": { "someData": "test data" }
        }
        """

    def test_analytics_tab(self):
        """ Test that the analytics tab view doesn't return an error code. """
        response = self.client.get(reverse('analyses_browse'))
        self.assertEqual(response.status_code, 200)

    def test_new_analysis(self):
        """ Test that the new analysis view doesn't return an error code. """
        response = self.client.get(reverse('new_analysis'))
        self.assertEqual(response.status_code, 200)

    @loggedIn
    def test_analysis_view(self):
        """ Test that the analysis view page doesn't return an error """
        a = self.fixtures['1']
        response = self.client.get(reverse('analysis_view', args=(a,)))
        self.assertEqual(response.status_code, 200)

    def test_logged_out_analysis_save(self):
        """ Test that we can't save an analysis when logged out. """
        response = self.client.post(reverse('new_analysis_json'), data='', content_type='text/json')
        self.assertEqual(response.status_code, 401)

    @loggedIn
    def test_successful_analysis_save(self):
        """ Test that we can successfully save an analysis. """
        response = self.client.post(reverse('new_analysis_json'), data=self.analysis_json, content_type='text/json')
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.isdigit())
        analysis = Analysis.objects.get(id=response.content)
        self.assertEquals(analysis.title, 'Test title')
        self.assertEquals(analysis.abstract, 'Test abstract')
        self.assertEquals(json.loads(analysis.data)['someData'], 'test data')

    @loggedIn
    def test_bad_request_analysis_save(self):
        """ Test the return code of the save view when the request is malformed. """
        response = self.client.post(reverse('new_analysis_json'), data='Bad request', content_type='text/json')
        self.assertEquals(response.status_code, 400)

    @loggedIn
    def test_missing_element_analysis_save(self):
        """ Test the return code of the save view if an element is missing. """
        response = self.client.post(reverse('new_analysis_json'), data=self.analysis_missing_element_json, content_type='text/json')
        self.assertEquals(response.status_code, 400)

    @loggedIn
    def test_invalid_method_analysis_save(self):
        """ Test the return code of the save view when the request use an unsupported method. """
        response = self.client.put(reverse('new_analysis_json'), data='', content_type='text/json')
        self.assertEquals(response.status_code, 405)

    def test_logged_out_analysis_update(self):
        """ Test that we can't update an analysis while logged out. """
        a = self.fixtures['3']
        response = self.client.put(reverse('analysis_data', args=(a,)), data='', content_type='text/json')
        self.assertEqual(response.status_code, 401)

    @loggedIn
    def test_successful_analysis_update(self):
        """ Test that we can update an analysis successfully. """
        a = self.fixtures['3']
        response = self.client.put(reverse('analysis_data', args=(a,)), data='{ "data": "test data" }', content_type='text/json')
        self.assertEquals(response.status_code, 200)
        analysis = Analysis.objects.get(id=a)
        self.assertEquals(analysis.data, '"test data"')

    @loggedIn
    def test_bad_request_analysis_update(self):
        """ Test the return code of the update view if the request is malformed. """
        a = self.fixtures['3']
        response = self.client.put(reverse('analysis_data', args=(a,)), data='Bad request', content_type='text/json')
        self.assertEquals(response.status_code, 400)

    @loggedIn
    def test_invalid_method_analysis_update(self):
        """ Test the return code of the update view if the request use an unsupported method. """
        a = self.fixtures['3']
        response = self.client.post(reverse('analysis_data', args=(a,)), data='', content_type='text/json')
        self.assertEquals(response.status_code, 405)

    @loggedIn
    def test_analysis_detail(self):
        """ Test accessing that the analysis detail view doesn't return an error. """
        a = self.fixtures['1']
        popular_count = Analysis.objects.get(id=a).popular_count
        response = self.client.get(reverse('analysis_detail', args=(a,)))
        self.assertEquals(response.status_code, 200)
        self.assertEquals(Analysis.objects.get(id=a).popular_count, popular_count + 1)

    @loggedIn
    def test_rating_analysis_remove(self):
        """ Test if rating is removed on analysis remove """
        a = self.fixtures['2']
        #Create the rating with the correct content type
        ctype = ContentType.objects.get(model='analysis')
        OverallRating.objects.create(category=3, object_id=a, content_type=ctype, rating=3)

        #Remove the analysis
        response = self.client.post(reverse('analysis_remove', args=(a,)))
        self.assertEquals(response.status_code, 302)

        #Check there are no ratings matching the removed map
        rating = OverallRating.objects.filter(category=3, object_id=a)
        self.assertEquals(rating.count(), 0)

    @loggedIn
    def test_rendering_metadata(self):
        """ Test if the edit metadata page doesn't return an error. """
        a = self.fixtures['1']
        response = self.client.get(reverse('analysis_metadata', args=(a,)))
        self.assertEquals(response.status_code, 200)

    @loggedIn
    def test_post_metadata(self):
        """ Test if posting a form to the metadata view doesn't return an error. """
        a = self.fixtures['1']
        response = self.client.post(reverse('analysis_metadata', args=(a,)))
        self.assertEquals(response.status_code, 200)

    @loggedIn
    def test_confirmation_page_analysis_remove(self):
        """ Test that trying to remove an analysis redirects to the confirmation page """
        a = self.fixtures['1']
        response = self.client.get(reverse('analysis_remove', args=(a,)))
        self.assertEquals(response.status_code, 200)

    @loggedIn
    def test_successful_analysis_remove(self):
        """ Test that we can successfully remove an analysis. """
        a = self.fixtures['4']
        response = self.client.post(reverse('analysis_remove', args=(a,)))
        self.assertEquals(response.status_code, 302)
        self.assertRaises(ObjectDoesNotExist, Analysis.objects.get, id=a)

    def test_loggedOut_analysis_remove(self):
        """ Test that unauthenticated users can't remove analyses. """
        a = self.fixtures['1']
        response = self.client.post(reverse('analysis_remove', args=(a,)))
        self.assertEquals(response.status_code, 302)
        self.assertTrue(len(Analysis.objects.filter(id=a)) > 0)

    @loggedIn
    def test_successful_analysis_copy(self):
        """ Test if we can load data from a save analysis into a new one using a copy parameter. """
        a = self.fixtures['1']
        response = self.client.get(reverse('new_analysis'), {'copy': a})
        print response.status_code
        self.assertIn('config', response.context)
        self.assertEqual(response.context['config'], u"{'testData': '1'}")
