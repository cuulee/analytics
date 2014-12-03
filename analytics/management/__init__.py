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

from django.conf import settings
from django.db.models import signals
from django.utils.translation import ugettext_noop as _
import logging
logger = logging.getLogger(__name__)

if "notification" in settings.INSTALLED_APPS:
    import notification

    if hasattr(notification, 'models'):
        def create_notice_types(app, created_models, verbosity, **kwargs):
            notification.models.NoticeType.create(
                "analysis_created",
                _("Analysis Created"),
                _("An Analysis was created"))
            notification.models.NoticeType.create(
                "analysis_updated",
                _("Analysis Updated"),
                _("An Analysis was updated"))
            notification.models.NoticeType.create(
                "analysis_deleted",
                _("Analysis Deleted"),
                _("An Analysis was deleted"))
            notification.models.NoticeType.create(
                "analysis_comment",
                _("Comment on Analyses"),
                _("An analysis was commented on"))
            notification.models.NoticeType.create(
                "analysis_rated",
                _("Rating for Analyses"),
                _("A rating was given to an analysis"))

        signals.post_syncdb.connect(
            create_notice_types,
            sender=notification.models)
        logger.info(
            "Notifications Configured for analytics.analysis.management.commands")
else:
    logger.info(
        "Skipping creation of NoticeTypes for analytics.analysis.management.commands, since notification app was not found.")
