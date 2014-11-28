Analytics
=========


Testing Installation
--------------------

If you just want to test the application, we provide fixtures data that you can use. They are enabled by default so you just need to: 

Install Geonode in the development version 2.4 following the instructions [here](https://github.com/GeoNode/geonode).
Don't install the package, it is not the 2.4 version.


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


Full installation
-----------------

If you want to run the full application, you will also need:

Some geo-business intelligence data in a postgreSQL database, and a
GeoMondrian installed. To install GeoMondrian, yu can follow [this](https://github.com/loganalysis/analytics/wiki/GeoMondrian) guide.

To install the [solap4py-java](https://github.com/loganalysis/solap4py-java) component and
start it.

You can configure the data you will use in the settings.py with the flag *FIXTURES*:

- Set it to true to use sample data
- Set it to false to use your GeoMondrian
