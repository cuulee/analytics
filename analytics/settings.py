# -*- coding: utf-8 -*-
#########################################################################
#
# Copyright (C) 2012 OpenPlans
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.
#
#########################################################################

# Django settings for the GeoNode project.
import os
from geonode.settings import *
#
# General Django development settings
#

SITENAME = 'analytics'

# Defines the directory that contains the settings file as the LOCAL_ROOT
# It is used for relative settings elsewhere.
LOCAL_ROOT = os.path.abspath(os.path.dirname(__file__))

WSGI_APPLICATION = "analytics.wsgi.application"


# Load more settings from a file called local_settings.py if it exists
try:
    from local_settings import *
except ImportError:
    pass

# Additional directories which hold static files
STATICFILES_DIRS.append(
    os.path.join(LOCAL_ROOT, "static"),
)


INSTALLED_APPS = ("analytics",) + INSTALLED_APPS

# Note that Django automatically includes the "templates" dir in all the
# INSTALLED_APPS, se there is no need to add maps/templates or admin/templates
TEMPLATE_DIRS = (
    os.path.join(LOCAL_ROOT, "templates"),
) + TEMPLATE_DIRS

# Location of url mappings
ROOT_URLCONF = 'analytics.urls'

# Location of locale files
LOCALE_PATHS = (
    os.path.join(LOCAL_ROOT, 'locale'),
    ) + LOCALE_PATHS

AGON_RATINGS_CATEGORY_CHOICES["analytics.Analysis"] = {"analysis": "How good is this analysis?"}

# Tell nose to measure coverage on the 'analytics' app
NOSE_ARGS = [
    '--with-coverage',
    '--cover-package=analytics',
    '--verbosity=2',
]

FIXTURES = True

# analytics-js settings
CSTS = {
    'crossfilterClientVsServerThreshold' : 20000,
    'resizeDelay' : 350,
    'css' : {
      'header'           : '.navbar',
      'columnsContainer' : '#columns',
      'columns'          : '.chart-columns',
      'columnsSortable'  : '.chart-columns-sortable',
      'charts'           : '.chart',
      'chartsClass'      : 'chart',
      'factSelector'     : '#fact-selector',
      'reset'            : '#reset',
      'resize'           : '#resize',
      'addchart'         : '#addchart',
      'zoom'             : 'zoom'
    },
    'palettes' : ['YlGn', 'GnBu', 'BuPu', 'RdPu', 'PuRd', 'OrRd', 'YlOrRd', 'YlOrBr', 'PuOr', 'BrBG', 'PRGn', 'PiYG', 'RdBu', 'RdGy', 'RdYlBu', 'RdYlGn'],
    'txts' : {
      'charts' : {
        'map' : 'Choropleth map',
        'bar' : 'Bar chart',
        'pie' : 'Pie chart',
        'timeline' : 'Timeline',
        'bubble' : 'Bubble chart',
        'table' : 'Table',
        'wordcloud' : 'Word cloud chart'
      },
      'factSelector' : {
        'cubes'    : 'Cubes available:',
        'measures' : 'Measures available:'
      },
      'hiddenChart' : 'This chart is hidden because the dimension shown is aggregated',
      'changeCube' : 'You are changing the cube beeing studied. If you continue, your current analysis of this cube will be lost. Do you want to continue?'
    },
    'tips' : {
      'charts' : {}
    }
  }

ROLES_ENABLED = False
ANONYMOUS_GEOMONDRIAN_ROLE= 'anonymous'

MANDOLINE_HOST = 'localhost'
MANDOLINE_PORT = 25335

JS_TESTING = False
