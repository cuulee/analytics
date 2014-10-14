# -*- coding: utf-8 -*-
#########################################################################
#
# Copyright (C) 2014 Loganalysis
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

from analytics.models import Analysis, ChartTip
from django.contrib import admin

class AnalysisAdmin(admin.ModelAdmin):
    pass

class ChartTipAdmin(admin.ModelAdmin):
    list_display = ('chart_type', 'message')

admin.site.register(Analysis, AnalysisAdmin)
admin.site.register(ChartTip, ChartTipAdmin)
