Analytics
=========


Installation
------------

To use this application, you need some geo-business intelligence data in a postgreSQL database, and a
GeoMondrian installed. To install GeoMondrian, yu can follow [this](https://github.com/loganalysis/analytics/wiki/GeoMondrian) guide.

Then, you need to install Geonode in the development version 2.4 following the instructions [here](https://github.com/GeoNode/geonode).
Don't install the package, it is not the 2.4 version.

Once Geonode is installed, you need to install the [solap4py-java](https://github.com/loganalysis/solap4py-java) component and
start it. Then you need to be in the same environment as the one in which you have installed Geonode, so if you have installed
it in a virtualenv, place yourself in this virtualenv.

Then to install the analytics app:

    git clone https://github.com/loganalysis/analytics.git
    cd analytics

    # Synchronize the Geonode database to add the analytics data types
    python manage.py syncdb

To start the analytics app:

    # In the Geonode directory execute:
    paver start_geoserver
    # to start Geoserver (layer functionnalities)

    # In the analytics directory:
    python manage.py runserver

    # You can then access the analytics app at http://localhost:8000
    # If you want the application to be available to other hosts:
    python manage.py runserver 0.0.0.0:8000


