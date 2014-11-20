/*!
 *  analytics 0.1.0
 *  https://github.com/loganalysis/analytics-js
 *  Copyright (c) 2014 LogAnalysis
 *
 * This program is released under the terms of the of the MIT licence.
 *
 * For the full copyright and licence information, please view the LICENCE
 * file that was distributed wih this source code.
 */

(function() {
  function _analytics(dc) {
    'use strict';

    ////////////////////////////////////////
/**
## General notes about *analytics.js*

Most of the objects in _analytics.js_ use the principle of having one function that can be both used as a getter and a setter.
If you pass a parameter to the function, it is a setter, it will save the given value and return the object itself for chaining.
If you don't pass a parameter, it will behave as a getter and return the saved value.

## **analytics** namespace

### analytics.**csts**

`analytics.csts` is a deep map containing various constants used by _analytics.js_. It contains mostly CSS selectors and texts (for internationalization).

The structure is as follows:

```js
analytics.csts = {
  resizeDelay : 350,
  css : { .. }, // CSS selectors
  txts : {
    charts : { // name of the charts
      chartId : 'Chart name',
      ...
    },
    factSelector : { ... } // titles used in the fact selector
  },
  tips : { // tips to show on the interface
    charts : {} // tips for the charts
  }
}
```
**/
var analytics = {
  version: '0.1.0',
  csts : {
    resizeDelay : 350,
    css : {
      header           : '.navbar',
      columnsContainer : '#columns',
      columns          : '.chart-columns',
      charts           : '.chart',
      chartsClass      : 'chart',
      factSelector     : '#fact-selector',
      reset            : '#reset',
      resize           : '#resize',
      zoom             : 'zoom'
    },
    txts : {
      charts : {
        map : 'Choropleth map',
        bar : 'Bar chart',
        pie : 'Pie chart',
        timeline : 'Timeline',
        bubble : 'Bubble chart',
        table : 'Table',
        wordcloud : 'Word cloud chart'
      },
      factSelector : {
        cubes    : 'Cubes available:',
        measures : 'Measures available:'
      }
    },
    tips : {
      charts : {}
    }
  }
};

/**
### analytics.**init**(*Object* queryAPI, [*Object* state])

This function will initialize the whole component thanks to a given`queryAPI` to query the OLAP database, and optionally
with a given state. Prior to it, you can set some constants.

For a standard user of the package, it is the only function you should call.
**/
analytics.init = function (queryAPI, state) {
  analytics.query.queryAPI(queryAPI);
  if (state)
    analytics.state(state);

  analytics.query.queryAPI(queryAPI);
  analytics.display.init();
  analytics.state.initMeasure();
  analytics.state.initDimensions();
  analytics.data.load();
  analytics.display.initRender();
};

/**
## analytics.**query** namespace

This namespace helps query the OLAP cube by specifying the API provided to it in order to perform the queries.
**/
analytics.query = (function() {

  var _queryAPI = null;

  var Query = {

    queryAPI : function (queryAPI) {
      if (arguments.length) {
        _queryAPI = queryAPI;
        return this;
      }
      else if (_queryAPI === null)
        throw new this.QueryAPINotProvidedError();
      else
        return _queryAPI;
    },

    //---------------------
    //---- METADATA -------
    //---------------------

    /**
     * List of metadatas already loaded from DB
     *
     * @private
     * @type {Object}
     */
    metadatas : {},

    /**
     * Transform a deep map<id:map<caption>> with a caption attribute into a flat map<id:caption>
     *
     * @private
     * @param {Object.<string, Object.<string, string>>} map - the deep map
     * @return {Object.<string, string>} the flat map
     */
    mapWithCaptionToSimpleMap : function (map) {
      var out = {};
      for (var key in map) {
        out[key] = map[key].caption;
      }

      return out;
    },

    /**
     * Get schemas list
     *
     * @public
     * @return {Object.<string, string>} a key-value map with one row by schema. {id: caption}
     *
     * @throws {Query.QueryAPINotProvidedError} The queryAPI is not provided to Query
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     */
    getSchemas : function () {

      if (this.isCacheEmpty()) {
        var replySchemas = this.queryAPI().explore([]);
        this.checkAPIResponse(replySchemas);

        var flatSchemasMap = this.mapWithCaptionToSimpleMap(replySchemas.data);
        for (var key in flatSchemasMap) {
          this.cacheSchema(key, flatSchemasMap[key]);
        }

        return flatSchemasMap;
      } else {
        return this.getSchemasFromCache();
      }
    },

    /**
     * Get cubes of a schema
     *
     * @public
     * @param {string} idSchema
     * @return {Object.<string, string>} a key-value map with one row by schema. {id: caption}
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     * @throws {Query.SchemaNotInDatabaseError}
     */
    getCubes : function(idSchema) {

      if (!this.isSchemaInCache(idSchema))
        this.getSchemas();

      if (this.isCubesListEmpty(idSchema)) {
        var replyCubes = this.queryAPI().explore(new Array(idSchema));
        this.checkAPIResponse(replyCubes);
        var flatCubesMap = this.mapWithCaptionToSimpleMap(replyCubes.data);

        for (var key in flatCubesMap) {
          this.cacheCube(idSchema, key, flatCubesMap[key]);
        }

        return flatCubesMap;
      } else {
        return this.getCubesFromCache(idSchema);
      }
    },

    /**
     * Get mesures of a cube and a schema
     *
     * Measures are members of the only level of the only hierarchy of the dimension
     * with type Measure
     * @summary Get mesures of a cube and a schema
     *
     * @example
     * {
     *   "idMeasure1" : {
     *       "caption" : "theMeasureOne",
     *       "unit" : "theUnit"
     *   },
     *   "idMeasure2" : {
     *       "caption" : "theMeasureTwo",
     *       "unit" : "theUnit"
     *   }
     * }
     *
     * @public
     * @param {string} idSchema
     * @param {string} idCube
     * @return {Object.<string, Object>} the map
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.LevelNotInDatabaseError}
     * @throws {Query.HierarchyNotInDatabaseError}
     * @throws {Query.DimensionNotInDatabaseError}
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    getMesures : function (idSchema, idCube) {

      if (this.isDimensionsListEmpty(idSchema, idCube))
        this.getDimensions(idSchema, idCube);

      var idDimension = this.getMeasureDimension(idSchema, idCube);
      var idHierarchy;

      var hierarchies = this.getHierarchies(idSchema, idCube, idDimension);
      for(var key in hierarchies) {
          idHierarchy = key;
      }

      // We need to load the levels
      this.getLevels(idSchema, idCube, idDimension, idHierarchy);
      if (this.isLevelsListEmpty(idSchema, idCube, idDimension, idHierarchy))
        throw new Query.LevelNotInDatabaseError("No level in Measure's hierarchy");

      return this.getMembers(idSchema, idCube, idDimension, idHierarchy, 0);
    },

    /**
     * Get a list of cubes and for each the measures of this cube
     *
     * @todo test this
     *
     * @param {string} idSchema
     * @return {Object<Object>}
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     * @throws {Query.DimensionNotInDatabaseError}
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    getCubesAndMeasures : function (idSchema) {
      var out = {};
      var cubes = this.getCubes(idSchema);

      for (var key in cubes) {
        out[key] = { "caption" : cubes[key] , "measures" : {}};
        var measures = this.getMesures(idSchema, key);
        for (var idMeasure in measures) {
          out[key].measures[idMeasure] = measures[idMeasure];
        }
      }

      return out;
    },

    /**
     * Get dimensions of a cube in a given schema
     *
     * This wil return a map of id : dimensionMap as the following example
     * @summary Get dimensions of a cube in a given schema
     *
     * @example
     * "idDimension" : {
     *     "caption" : "theCaption",
     *     "type" : "theType"
     * }
     *
     * @public
     * @param {string} idSchema
     * @param {string} idCube
     * @return {Object.<string, Object>} the map or {} if the dimensions list of the given cube is empty
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.IllegalDimensionTypeError}
     */
    getDimensions : function (idSchema, idCube) {

      if (!this.isCubeInCache(idSchema, idCube))
        this.getCubes(idSchema);

      var dimensions;
      var dimensionsReturn = {};

      if (this.isDimensionsListEmpty(idSchema, idCube)) {
        var replyDimensions = this.queryAPI().explore(new Array(idSchema, idCube));
        this.checkAPIResponse(replyDimensions);

        for (var key in replyDimensions.data) {
          this.cacheDimension(idSchema, idCube, key, replyDimensions.data[key].type, replyDimensions.data[key].caption, replyDimensions.data[key].description);
        }

        dimensions = replyDimensions.data;
      } else {
        dimensions = this.getDimensionsFromCache(idSchema, idCube);
      }

      for (var idDim in dimensions) {
        if (dimensions[idDim].type != 'Measure') {
          dimensionsReturn[idDim] = dimensions[idDim];
        }
      }
      return dimensionsReturn;
    },

    /**
     * Get the id of the geographic dimension
     *
     * @public
     * @param {string} idSchema
     * @param {string} idCube
     * @return {string} id of the geographic dimension
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.IllegalDimensionTypeError}
     */
    getGeoDimension : function (idSchema, idCube) {

      return this.getXXDimension(idSchema, idCube, "Geometry");

    },

    /**
     * Get the id of the time dimension
     *
     * @public
     * @param {string} idSchema
     * @param {string} idCube
     * @return {string} id of the time dimension
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.IllegalDimensionTypeError}
     */
    getTimeDimension : function (idSchema, idCube) {

      return this.getXXDimension(idSchema, idCube, "Time");

    },

    /**
     * Get the id of the measure dimension
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @return {string} id of the measure dimension
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.IllegalDimensionTypeError}
     */
    getMeasureDimension : function (idSchema, idCube) {

      return this.getXXDimension(idSchema, idCube, "Measure");

    },

    /**
     * Get the id of the XXXX dimension
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} type that we want to match
     * @return {string} id of the XXXX dimension
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.DimensionNotInDatabaseError}
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.IllegalDimensionTypeError} The given dimension type is not allowed
     */
    getXXDimension : function (idSchema, idCube, type) {
      if (!this.isAllowedDimensionType(type))
        throw new Query.IllegalDimensionTypeError();

      // Retrieve all dimensions to get it in cache
      this.getDimensions(idSchema, idCube);
      // Get from cache to have all dimensions, with the Measure one
      var dimensions = this.getDimensionsFromCache(idSchema, idCube);
      for (var key in dimensions) {
        if (dimensions[key].type == type)
          return key;
      }
      throw new Query.DimensionNotInDatabaseError("There's no dimension of type "+type+" in cube "+idCube+" of schema "+idSchema);
    },

    /**
     * Get the id of the geographical propery of a dimension
     *
     * @public
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @return {string} id of the geographical property or {null} if none found
     *
     * @throws {Query.QueryAPINotProvidedError}
     */
    getGeoProperty : function (idSchema, idCube, idDimension, idHierarchy) {

      var levels = this.getLevels(idSchema, idCube, idDimension, idHierarchy);

      for (var i=0; i< levels.length; i++) {
        var properties = this.getProperties(idSchema, idCube, idDimension, idHierarchy, i);

        for (var property in properties) {
          if (properties[property].type == 'Geometry')
              return property;
        }
      }
      return null;
    },

    /**
     *
     * Get the list of hierarchies of a dimension
     *
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     *
     * @return {Object<string, string>} map of dimensions associating id with caption.
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     *
     */
    getHierarchies : function (idSchema, idCube, idDimension) {

      if (!this.isDimensionInCache(idSchema, idCube, idDimension))
        this.getDimensions(idSchema, idCube);

      if (this.isHierarchiesListEmpty(idSchema, idCube, idDimension)) {
        var replyHierarchies = this.queryAPI().explore(new Array(idSchema, idCube, idDimension));
        this.checkAPIResponse(replyHierarchies);
        var flatHierarchiesMap = this.mapWithCaptionToSimpleMap(replyHierarchies.data);

        for (var key in flatHierarchiesMap) {
          this.cacheHierarchy(idSchema, idCube, idDimension, key, flatHierarchiesMap[key]);
        }

        return flatHierarchiesMap;
      } else {
        return this.getHierarchiesFromCache(idSchema, idCube, idDimension);
      }
    },

    /**
     *
     * Get the list of levels of a hierarchy. Note that Query hide the real level ID.
     * For Query users, a level is identified by its position in the list.
     * @summary Get the list of levels of a hierarchy
     *
     * @example
     * [
     *   "Countries", //caption of the level at 0 position
     *   "Regions"    //caption of the level at 1 position
     * ]
     *
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     *
     * @return {Array<string>} list of level captions
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.HierarchyNotInDatabaseError}
     * @throws {Query.DimensionNotInDatabaseError}
     * @throws {Query.CubeNotInDatabaseError}
     * @throws {Query.SchemaNotInDatabaseError}
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     */
    getLevels : function (idSchema, idCube, idDimension, idHierarchy) {

      if (!this.isHierarchyInCache(idSchema, idCube, idDimension, idHierarchy))
        this.getHierarchies(idSchema, idCube, idDimension);

      if (this.isLevelsListEmpty(idSchema, idCube, idDimension, idHierarchy)) {
        var reply = this.queryAPI().explore(new Array(idSchema, idCube, idDimension, idHierarchy), true);
        this.checkAPIResponse(reply);

        var out = [];
        for (var index=0; index < reply.data.length; index++) {
          this.cacheLevel(idSchema, idCube, idDimension, idHierarchy, reply.data[index].id, reply.data[index].caption, reply.data[index].description);
          out.push(reply.data[index].caption);

          // Cache properties into the current level
          for(var key in reply.data[index]["list-properties"]) {
            this.cacheProperty(idSchema, idCube, idDimension, idHierarchy, index, key, reply.data[index]["list-properties"][key].caption, reply.data[index]["list-properties"][key].description, reply.data[index]["list-properties"][key].type);
          }
        }

        return out;
      } else {
        return this.getLevelsFromCache(idSchema, idCube, idDimension, idHierarchy);
      }
    },

    /**
     * Get the list of members
     *
     * If parentMember parameter is not set, returns the map of all members of the specified level with or
     * without the properties values depending on the properties parameter.
     *
     * If parentMember parameter is set (parentMember being a member of the level idLevel), returns the map
     * of all members descending from this member from the level idlevel + descendingLevel.
     *
     * Note that Query hide the real level ID. For Query users, a level is identified by its position in the list.
     * @summary Get the list of members
     *
     * @todo cache
     *
     * @example
     * {
     *  "FR" : // member key
     *    {
     *      "caption" : "France",
     *      "geometry" : {<geoJSONofFrance>}, // property area value
     *      "area" : 123.5 // property area value
     *    },
     *  "BE" :
     *    {
     *      "caption" : "Belgium",
     *      "geometry" : {<geoJSONofBelgium>},
     *      "area" : 254.1
     *    },
     *    ...
     * }
     *
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel
     * @param {boolean} [withProperties=false] Return the properties values of the members
     * @param {string} [parentMember=] ID of the parent from which we want the childrens
     * @param {integer} [descendingLevel=1] Number of descending levels if parentMember is specified
     * @return {Object} list of level captions
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.LevelNotInDatabaseError}
     * @throws {Query.HierarchyNotInDatabaseError}
     * @throws {Query.DimensionNotInDatabaseError}
     * @throws {Query.CubeNotInDatabaseError}
     * @throws {Query.SchemaNotInDatabaseError}
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     */
    getMembers : function (idSchema, idCube, idDimension, idHierarchy, indexLevel, withProperties, parentMember, descendingLevel) {

      if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel)) {
        this.getLevels(idSchema, idCube, idDimension, idHierarchy);
        if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel))
          throw new Query.LevelNotInDatabaseError();
      }

      // Default values for parameters
      withProperties = typeof withProperties !== "undefined" ? withProperties : false;
      if (typeof parentMember !== "undefined")
        descendingLevel = typeof descendingLevel !== "undefined" ? descendingLevel : 1;

      var idLevel = this.getLevelIDFromIndex(idSchema, idCube, idDimension, idHierarchy, indexLevel);
      var reply;

      if (typeof parentMember === "undefined") {
        reply = this.queryAPI().explore(new Array(idSchema, idCube, idDimension, idHierarchy, idLevel), withProperties);
      } else {
        reply = this.queryAPI().explore(new Array(idSchema, idCube, idDimension, idHierarchy, idLevel, parentMember), withProperties, descendingLevel);
      }

      this.checkAPIResponse(reply);

      if (withProperties === true && reply.data != {}) {

        //Get the GeoProperty of this dimension
        var geoProperty = this.getGeoProperty(idSchema, idCube, idDimension, idHierarchy);

        // Every member got his geoProperty converted from WKT to GeoJson
        if (geoProperty !== undefined && geoProperty !== null) {
          var wkt = new Wkt.Wkt();
          for (var memberKey in reply.data) {
            // But he needs a geo attribute
            if (reply.data[memberKey][geoProperty] !== undefined) {
              wkt.read(reply.data[memberKey][geoProperty]);
              reply.data[memberKey][geoProperty] = wkt.toJson();
            }
          }
        }
      }

      return reply.data;
    },

    /**
     * Get the list of member objects from their IDs
     *
     * Note that Query hide the real level ID. For Query users, a level is identified by its position in the list.
     * @summary Get the list of member objects from their IDs
     *
     * @todo cache
     *
     * @example
     * {
     *  "FR" : // member key
     *    {
     *      "caption" : "France",
     *      "geometry" : {<geoJSONofFrance>}, // property area value
     *      "area" : 123.5 // property area value
     *    },
     *  "BE" :
     *    {
     *      "caption" : "Belgium",
     *      "geometry" : {<geoJSONofBelgium>},
     *      "area" : 254.1
     *    },
     *    ...
     * }
     *
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel
     * @param {Array.<string>} membersIds the IDs of the members
     * @param {boolean} [withProperties=false] Return the properties values of the members
     * @return {Object} list of level captions
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.LevelNotInDatabaseError}
     * @throws {Query.HierarchyNotInDatabaseError}
     * @throws {Query.DimensionNotInDatabaseError}
     * @throws {Query.CubeNotInDatabaseError}
     * @throws {Query.SchemaNotInDatabaseError}
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     */
    getMembersInfos : function (idSchema, idCube, idDimension, idHierarchy, indexLevel, membersIds, withProperties) {

      if(typeof membersIds != "object")
        throw new Error("You provided an illegal parameter. Array expected");

      if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel)) {
        this.getLevels(idSchema, idCube, idDimension, idHierarchy);
        if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel))
          throw new Query.LevelNotInDatabaseError();
      }

      // Default values for parameters
      withProperties = typeof withProperties !== "undefined" ? withProperties : false;

      var idLevel = this.getLevelIDFromIndex(idSchema, idCube, idDimension, idHierarchy, indexLevel);

      var reply = this.queryAPI().explore(new Array(idSchema, idCube, idDimension, idHierarchy, idLevel, membersIds), withProperties, 0);
      this.checkAPIResponse(reply);

      if (withProperties === true && reply.data != {}) {

        //Get the GeoProperty of this dimension
        var geoProperty = this.getGeoProperty(idSchema, idCube, idDimension, idHierarchy);

        // Every member got his geoProperty converted from WKT to GeoJson
        if (geoProperty !== undefined && geoProperty !== null) {
          var wkt = new Wkt.Wkt();
          for (var memberKey in reply.data) {
            // But he needs a geo attribute
            if (reply.data[memberKey][geoProperty] !== undefined) {
              wkt.read(reply.data[memberKey][geoProperty]);
              reply.data[memberKey][geoProperty] = wkt.toJson();
            }
          }
        }
      }

      return reply.data;
    },

    /**
     * Get the list of properties of a level
     *
     * @example
     * {
     *   "geom" : {
     *     "caption" : "Geom",
     *     "type" : "Geometry"
     *   },
     *   "surf" : {
     *     "caption" : "Surface",
     *     "type" : "Standard"
     *   }
     * }
     *
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel the index of the level in the array of hierarchy
     *
     * @return {Object<string, Object<string, string>>} list of properties
     *
     * @throws {Query.QueryAPINotProvidedError}
     * @throws {Query.LevelNotInDatabaseError}
     * @throws {Query.HierarchyNotInDatabaseError}
     * @throws {Query.DimensionNotInDatabaseError}
     * @throws {Query.CubeNotInDatabaseError}
     * @throws {Query.SchemaNotInDatabaseError}
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     */
    getProperties : function (idSchema, idCube, idDimension, idHierarchy, indexLevel) {
      if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel))
        this.getLevels(idSchema, idCube, idDimension, idHierarchy);

      //As we fetch properties with their level, we just have to load it from the cache
      return this.getPropertiesFromCache(idSchema, idCube, idDimension, idHierarchy, indexLevel);
    },

    //------------
    //--- DATA ---
    //------------

    /**
     * Specify the wube you want to work on
     *
     * @public
     * @param {string} idCube
     */
    drill : function(idCube) {
      this.queryAPI().drill(idCube);
    },

    /**
     * Add the given measure to the set of measures you want to work on
     *
     * @public
     * @param {string} idMeasure
     */
    push : function(idMeasure) {
      this.queryAPI().push(idMeasure);
    },

    /**
     * Remove the given measure to the set of measures you want to work on
     *
     * @public
     * @param {string} idMeasure
     */
    pull : function(idMeasure) {
      this.queryAPI().pull(idMeasure);
    },

    /**
     * Add the given hierarchy to the list of agregates and filter on the given members
     *
     * @public
     * @param {string} idHierarchy
     * @param {Array<string>} [members] the IDs of the members you want to aggregate. All members of the hierarchy if undefined
     * @param {boolean} [range=false] if you want all the members between only bound values you give in member's array
     */
    slice : function(idHierarchy, members, range) {
      this.queryAPI().slice(idHierarchy, members, range);
    },

    /**
     * Add dice behavior to a list of hierarchies, that is to say those hierarchies
     * won't be completely aggregated.
     *
     * @public
     * @param {Array<String>} hierarchies
     */
    dice : function (hierarchies) {
      this.queryAPI().dice(hierarchies);
    },

    /**
     * Remove the given hierarchy of the selected agregates
     *
     * @public
     * @param {string} idHierarchy
     */
    project : function(idHierarchy) {
      this.queryAPI().project(idHierarchy);
    },

    /**
     * Filter
     *
     * @public
     * @param {string} idHierarchy
     * @param {Array<string>} [members] the IDs of the members. All members of the hierarchy if undefined
     * @param {boolean} [range=false] if you want all the members between only bound values you give in member's array
     */
    filter : function(idHierarchy, members, range) {
      this.queryAPI().filter(idHierarchy, members, range);
    },

    /**
     * Executes the request. This is a synchronous operation
     *
     * @return {Object} the structured reply
     */
    execute : function() {

      var response = this.queryAPI().execute();

      this.checkAPIResponse(response);
      return response.data;
    },

    /**
     * Flush all the request
     */
    clear : function() {
      this.queryAPI().clear();
    },

    /**
     * Checks the given response from the QueryAPI component
     *
     * Throws exception is the given response from the QueryAPI is malformed
     * or contains an error code
     * @summary Checks the given response from the QueryAPI component
     *
     * @private
     * @param {Object} response the response from QueryAPI
     * @return {boolean} true for a regular response format
     *
     * @throws {Query.QueryAPIBadRequestError}
     * @throws {Query.QueryAPINotSupportedError}
     * @throws {Query.IllegalAPIResponseError}
     */
    checkAPIResponse : function(response) {
      if (response.error === 'BAD_REQUEST')
        throw new Query.QueryAPIBadRequestError();
      if (response.error === 'NOT_SUPPORTED')
        throw new Query.QueryAPINotSupportedError();
      if (response.error === 'SERVER_ERROR')
        throw new Query.QueryAPIServerError();
      if (response.error === undefined || response.data === undefined || response === {})
        throw new Query.IllegalAPIResponseError();

      return (true);
    },

    /**
     * Determines if the given type is a legal type of dimension
     *
     * @private
     * @param {string} type
     * @return {boolean} true for a legal dimension type
     */
    isAllowedDimensionType : function(type) {
      return ( (type === "Time") || (type == "Measure") || (type == "Standard") || (type == "Geometry") );
    },

    //---------------
    //CACHE FUNCTIONS
    //---------------

    /**
     * Store the given schema in the metadatas cache
     *
     * @private
     * @param {string} id the schema's id
     * @param {string} caption the schema's caption
     */
    cacheSchema : function(id, caption) {
      if( !this.isSchemaInCache(id) ) {
        if( this.isCacheEmpty() )
          this.metadatas.schemas = {};

        this.metadatas.schemas[id] = { "caption" : caption };
      }
    },

    /**
     * Store the given cube in the metadatas cache into the given schema
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} caption the cube's caption
     *
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    cacheCube : function(idSchema, idCube, caption, description) {
      if (!this.isCubeInCache(idSchema, idCube)) {
        if (this.metadatas.schemas[idSchema].cubes === undefined)
          this.metadatas.schemas[idSchema].cubes = {};

          this.metadatas.schemas[idSchema].cubes[idCube] = {"caption" : caption, "description" : description};
      }
    },

    /**
     * Store the given dimension in the metadatas cache into the given cube
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} type the dimension's type
     * @param {string} caption the dimension's caption
     *
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.IllegalDimensionTypeError} The given dimension type is not allowed
     */
    cacheDimension : function(idSchema, idCube, idDimension, type, caption, description) {
      if (!this.isAllowedDimensionType(type))
        throw new Query.IllegalDimensionTypeError(type+" is not a valid dimension type!");

      if (!this.isDimensionInCache(idSchema, idCube, idDimension)) {
        if (this.metadatas.schemas[idSchema].cubes[idCube].dimensions === undefined)
          this.metadatas.schemas[idSchema].cubes[idCube].dimensions = {};

          this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension] = {"type" : type, "caption" : caption, "description" : description};
      }
    },

    /**
     * Store the given hierarchy in the metadatas cache into the given dimension
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {string} caption the hierarchy's caption
     *
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    cacheHierarchy : function(idSchema, idCube, idDimension, idHierarchy, caption, description) {
      if (!this.isHierarchyInCache(idSchema, idCube, idDimension, idHierarchy)) {
        if (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies === undefined)
          this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies = {};

          this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy] = {"caption" : caption, "description" : description};
      }
    },

    /**
     * Store the given level in the metadatas cache into the given hierarchy
     *
     * @todo add unit test
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {string} idLevel
     * @param {string} caption the level's caption
     *
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    cacheLevel : function(idSchema, idCube, idDimension, idHierarchy, idLevel, caption, description) {
      if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, idLevel)) {
        if (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels === undefined)
          this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels = [];

          this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels.push({"id" : idLevel, "caption" : caption, "description": description});
      }
    },

    /**
     * Store the given property in the metadatas cache into the given level
     *
     * @todo add unit test
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel the index of the level in the array of hierarchy
     * @param {string} idProperty
     * @param {string} caption the property's caption
     * @param {string} type the property's type
     *
     * @throws {Query.LevelNotInDatabaseError} The given level doesn't exists
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    cacheProperty : function(idSchema, idCube, idDimension, idHierarchy, indexLevel, idProperty, caption, description, type) {
      if (!this.isPropertyInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel, idProperty)) {
        if (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties === undefined)
          this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties = {};

          this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties[idProperty] = {"caption" : caption, "description": description, "type" : type};
      }
    },

    //------------
    //CACHE SEARCH
    //------------

    /**
     * Determines if a schema with the given id is in the metadata cache
     *
     * @private
     * @param {string} id the id of the schema
     * @return {boolean} true if a schema is already cached with this id
     */
    isSchemaInCache : function(id) {
      if (this.isCacheEmpty())
        return false;
      for (var key in this.metadatas.schemas) {
        if(key == id)
          return true;
      }
      return false;
    },

    /**
     * Determines if a cube with the given id is in the given schema in the metadata cache
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @return {boolean} true if a cube is already cached with this idCube in this schema
     *
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isCubeInCache : function(idSchema, idCube) {
      if (this.isCubesListEmpty(idSchema))
        return false;

      for (var key in this.metadatas.schemas[idSchema].cubes) {
        if(key == idCube)
          return true;
      }
      return false;
    },

    /**
     * Determines if a dimension with the given id is in the given cube in the metadata cache
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @return {boolean} true if a dimension is already cached with this idDimension in this cube
     *
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isDimensionInCache : function(idSchema, idCube, idDimension) {
      if (this.isDimensionsListEmpty(idSchema, idCube))
        return false;

      for (var key in this.metadatas.schemas[idSchema].cubes[idCube].dimensions) {
        if(key == idDimension)
          return true;
      }
      return false;
    },

    /**
     * Determines if a hierarchy with the given id is in the given dimension in the metadata cache
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @return {boolean} true if a hierarchy is already cached with this idHierarchy in this dimension
     *
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isHierarchyInCache : function(idSchema, idCube, idDimension, idHierarchy) {
      if (this.isHierarchiesListEmpty(idSchema, idCube, idDimension))
        return false;

      for (var key in this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies) {
        if(key == idHierarchy)
          return true;
      }
      return false;
    },

    /**
     * Determines if a level with the given id is in the given hierarchy in the metadata cache
     *
     * @todo add unit test
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel the index of the level in the array of hierarchy
     * @return {boolean} true if a level is already cached with this idLevel in this hierarchy
     *
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isLevelInCache : function(idSchema, idCube, idDimension, idHierarchy, indexLevel) {
      return (
        !this.isLevelsListEmpty(idSchema, idCube, idDimension, idHierarchy) && (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel] !== undefined)
      );
    },

    /**
     * Determines if a property with the given id is in the given level in the metadata cache
     *
     * @todo add unit test
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel the index of the level in the array of hierarchy
     * @param {string} idProperty
     * @return {boolean} true if a property is already cached with this id in this level
     *
     * @throws {Query.LevelNotInDatabaseError} The given level doesn't exists
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isPropertyInCache : function(idSchema, idCube, idDimension, idHierarchy, indexLevel, idProperty) {
      if (this.isPropertiesListEmpty(idSchema, idCube, idDimension, idHierarchy, indexLevel))
        return false;

      for (var key in this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties) {
        if(key == idProperty)
          return true;
      }
      return false;
    },

    /**
     * Determines if the metadatas cache is absolutely empty
     *
     * @private
     * @return {boolean} true if the cache is empty
     */
    isCacheEmpty : function() {
      return ( (Object.keys(this.metadatas).length === 0) && (this.metadatas.schemas === undefined) );
    },

    /**
     * Determines if the given schema in  metadatas cache contains cubes
     *
     * @private
     * @param {string} idSchema
     * @return {boolean} true if the schema is empty
     *
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isCubesListEmpty : function(idSchema) {
      if (!this.isSchemaInCache(idSchema)) {
          this.getSchemas();
          if (!this.isSchemaInCache(idSchema))
            throw new Query.SchemaNotInDatabaseError("Query: The given schema is not in metadatas cache");
      }

      return (
        (this.metadatas.schemas[idSchema].cubes === undefined) || (Object.keys(this.metadatas.schemas[idSchema].cubes).length === 0)
      );
    },

    /**
     * Determines if the given cube in metadatas cache contains dimensions
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @return {boolean} true if the cube is empty
     *
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     */
    isDimensionsListEmpty : function(idSchema, idCube) {
      if (!this.isCubeInCache(idSchema, idCube)) {
        this.getCubes(idSchema);
        if (!this.isCubeInCache(idSchema, idCube))
          throw new Query.CubeNotInDatabaseError();
      }

      return (
        (this.metadatas.schemas[idSchema].cubes[idCube].dimensions === undefined) || (Object.keys(this.metadatas.schemas[idSchema].cubes[idCube].dimensions).length === 0)
      );
    },

    /**
     * Determines if the given dimension in metadatas cache contains hierarchies
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @return {boolean} true if the dimension is empty
     *
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isHierarchiesListEmpty : function(idSchema, idCube, idDimension) {
      if (!this.isDimensionInCache(idSchema, idCube, idDimension)) {
        this.getDimensions(idSchema, idCube);
        if (!this.isDimensionInCache(idSchema, idCube, idDimension))
          throw new Query.DimensionNotInDatabaseError();
      }

      return (
        (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies === undefined) || (Object.keys(this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies).length === 0)
      );
    },

    /**
     * Determines if the given hierarchy in metadatas cache contains levels
     *
     * @todo add unit test
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @return {boolean} true if the hierarchy is empty
     *
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isLevelsListEmpty : function(idSchema, idCube, idDimension, idHierarchy) {
      if (!this.isHierarchyInCache(idSchema, idCube, idDimension, idHierarchy)) {
        this.getHierarchies(idSchema, idCube, idDimension);
        if (!this.isHierarchyInCache(idSchema, idCube, idDimension, idHierarchy))
          throw new Query.HierarchyNotInDatabaseError();
      }

      return (
        (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels === undefined) || (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels.length === 0)
      );
    },

    /**
     * Determines if the given level in metadatas cache contains properties
     *
     * @todo add unit test
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel the index of the level in the array of hierarchy
     * @return {boolean} true if the hierarchy is empty
     *
     * @throws {Query.LevelNotInDatabaseError} The given level doesn't exists
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    isPropertiesListEmpty : function(idSchema, idCube, idDimension, idHierarchy, indexLevel) {
      if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel)) {
        this.getLevels(idSchema, idCube, idDimension, idHierarchy);
        if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel))
          throw new Query.LevelNotInDatabaseError();
      }

      return (
        (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties === undefined) || (Object.keys(this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties).length === 0)
      );
    },

    /**
     * Clear the metadatas cache and the schemas poperty
     *
     * @private
     * @example
     * >>>this.isCacheEmpty();
     * false
     * >>>this.clearCache();
     * >>>this.isCacheEmpty();
     * true
     */
    clearCache : function() {
      if(!this.isCacheEmpty())
        delete this.metadatas.schemas;
    },

    //-----------------------------
    //RETRIEVE FROM CACHE FUNCTIONS
    //-----------------------------

    /**
     * Retrieve the list of schemas from the cache as a flat map of strings idSchema : caption
     *
     * @private
     * @return {Object.<string, string>} the flat map or {} if the cache is empty
     */
    getSchemasFromCache : function() {
      if (this.isCacheEmpty())
        return {};
      else
        return this.mapWithCaptionToSimpleMap(this.metadatas.schemas);
    },

    /**
     * Retrieve the list of cubes of a schema from the cache as a flat map of strings idCube : caption
     *
     * @private
     * @param {string} idSchema
     * @return {Object.<string, string>} the flat map or {} if the cube list is empty
     *
     * @throws {Query.SchemaNotInDatabaseError} The given schema is not in metadatas cache
     */
    getCubesFromCache : function(idSchema) {
      if (this.isCubesListEmpty(idSchema))
        return {};
      else
        return this.mapWithCaptionToSimpleMap(this.metadatas.schemas[idSchema].cubes);
    },

    /**
     * Retrieve the list of dimensions of a cube from the cache as a map of strings
     *
     * @example
     * "idDimension" : {
     *     "caption" : "theCaption",
     *     "type" : "theType"
     * }
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @return {Object.<string, Object>} the map or {} if the dimensions list of the given cube is empty
     *
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     */
    getDimensionsFromCache : function(idSchema, idCube) {
      if (this.isDimensionsListEmpty(idSchema, idCube))
        return {};
      else
        return this.metadatas.schemas[idSchema].cubes[idCube].dimensions;
    },

    /**
     * Retrieve the list of hierarchies of a dimension from the cache as a map of strings
     *
     * @example
     * {
     * "idHierarchyA" : "captionHierarchyA",
     * "idHierarchyB" : "captionHierarchyB"
     * }
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @return {Object.<string, string>} the map or {} if the hierarchies list of the given dimension is empty
     *
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    getHierarchiesFromCache : function(idSchema, idCube, idDimension) {
      if (this.isHierarchiesListEmpty(idSchema, idCube, idDimension))
        return {};
      else {
        return this.mapWithCaptionToSimpleMap(this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies);
      }
    },

    /**
     * Retrieve the list of levels of a hierarchy from the cache as an array of strings
     * Note that the strings are the captions of the levels, not their id
     *
     * @example
     * [
     * "captionHierarchyA",
     * "captionHierarchyB"
     * ]
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @return {Array.<string>} the array or [] if the levels list of the given hierarchy is empty
     *
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    getLevelsFromCache : function(idSchema, idCube, idDimension, idHierarchy) {
      if (this.isLevelsListEmpty(idSchema, idCube, idDimension, idHierarchy))
        return [];
      else {
        var out = [];
        for (var index=0; index < this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels.length; index++) {
          out[index] = this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[index].caption;
        }
        return out;
      }
    },

    /**
     * Retrieve the list of properties of a level from the cache
     *
     * @example
     * {
     *   "geom" : {
     *     "caption" : "Geom",
     *     "type" : "Geometry"
     *   },
     *   "surf" : {
     *     "caption" : "Surface",
     *     "type" : "Standard"
     *   }
     * }
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel the index of the level in the array's hierarchy
     * @return {Object} list of properties
     *
     * @throws {Query.LevelNotInDatabaseError} The given level doesn't exists
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    getPropertiesFromCache : function(idSchema, idCube, idDimension, idHierarchy, indexLevel) {
      if (this.isPropertiesListEmpty(idSchema, idCube, idDimension, idHierarchy, indexLevel))
        return {};
      else
        return this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties;
    },

    /**
     * Get the level's ID from its index
     *
     * @private
     * @param {string} idSchema
     * @param {string} idCube
     * @param {string} idDimension
     * @param {string} idHierarchy
     * @param {integer} indexLevel the index of the level in the array's hierarchy
     * @return {string} the level's ID
     *
     * @throws {Query.LevelNotInDatabaseError} The given level doesn't exists
     * @throws {Query.HierarchyNotInDatabaseError} The given hierarchy doesn't exists
     * @throws {Query.DimensionNotInDatabaseError} The given dimension doesn't exists
     * @throws {Query.CubeNotInDatabaseError} The given cube doesn't exists
     * @throws {Query.SchemaNotInDatabaseError} The given schema doesn't exists
     */
    getLevelIDFromIndex : function(idSchema, idCube, idDimension, idHierarchy, indexLevel) {
      if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel))
        throw new Query.LevelNotInDatabaseError();

      return this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].id;
    },

    //---------------
    //EXCEPTIONS
    //---------------

    /**
     * @class
     */
    SchemaNotInDatabaseError : function (message) {
      this.name = "SchemaNotInDatabaseError";
      this.message = message || "The schema you tried to use does not exists in the database!";
    },

    /**
     * @class
     */
    CubeNotInDatabaseError : function (message) {
      this.name = "CubeNotInDatabaseError";
      this.message = message || "The cube you tried to use does not exists in the database!";
    },

    /**
     * @class
     */
    DimensionNotInDatabaseError : function (message) {
      this.name = "DimensionNotInDatabaseError";
      this.message = message || "The dimension you tried to use does not exists in the database!";
    },

    /**
     * @class
     */
    HierarchyNotInDatabaseError : function (message) {
      this.name = "HierarchyNotInDatabaseError";
      this.message = message || "The hierarchy you tried to use does not exists in the database!";
    },

    /**
     * @class
     */
    LevelNotInDatabaseError : function (message) {
      this.name = "LevelNotInDatabaseError";
      this.message = message || "The level you tried to use does not exists in the database!";
    },

    /**
     * @class
     */
    QueryAPINotProvidedError : function (message) {
      this.name = "QueryAPINotProvidedError";
      this.message = message || "Query have no queryAPI provided!";
    },

    /**
     * @class
     */
    QueryAPIServerError : function (message) {
      this.name = "QueryAPIServerError";
      this.message = message || "Query API indicates a Server error!";
    },

    /**
     * @class
     */
    QueryAPIBadRequestError : function (message) {
      this.name = "QueryAPIBadRequestError";
      this.message = message || "QueryAPI indicates a Bad Request error!";
    },

    /**
     * @class
     */
    QueryAPINotSupportedError : function (message) {
      this.name = "QueryAPINotSupportedError";
      this.message = message || "QueryAPI indicates a call to a not supported function!";
    },

    /**
     * @class
     */
    IllegalAPIResponseError : function (message) {
      this.name = "IllegalAPIResponseError";
      this.message = message || "QueryAPI has returned a response with wrong format!";
    },

    /**
     * @class
     */
    IllegalDimensionTypeError : function (message) {
      this.name = "IllegalDimensionTypeError";
      this.message = message || "You tried to use an illegal dimension type!";
    }
  };

  // Exceptions properties initialization
  Query.SchemaNotInDatabaseError.prototype = new Error();
  Query.SchemaNotInDatabaseError.prototype.constructor = Query.SchemaNotInDatabaseError;

  Query.CubeNotInDatabaseError.prototype = new Error();
  Query.CubeNotInDatabaseError.prototype.constructor = Query.CubeNotInDatabaseError;

  Query.DimensionNotInDatabaseError.prototype = new Error();
  Query.DimensionNotInDatabaseError.prototype.constructor = Query.DimensionNotInDatabaseError;

  Query.HierarchyNotInDatabaseError.prototype = new Error();
  Query.HierarchyNotInDatabaseError.prototype.constructor = Query.HierarchyNotInDatabaseError;

  Query.LevelNotInDatabaseError.prototype = new Error();
  Query.LevelNotInDatabaseError.prototype.constructor = Query.LevelNotInDatabaseError;

  Query.QueryAPIServerError.prototype = new Error();
  Query.QueryAPIServerError.prototype.constructor = Query.QueryAPIServerError;

  Query.QueryAPINotProvidedError.prototype = new Error();
  Query.QueryAPINotProvidedError.prototype.constructor = Query.QueryAPINotProvidedError;

  Query.QueryAPIBadRequestError.prototype = new Error();
  Query.QueryAPIBadRequestError.prototype.constructor = Query.QueryAPIBadRequestError;

  Query.QueryAPINotSupportedError.prototype = new Error();
  Query.QueryAPINotSupportedError.prototype.constructor = Query.QueryAPINotSupportedError;

  Query.IllegalAPIResponseError.prototype = new Error();
  Query.IllegalAPIResponseError.prototype.constructor = Query.IllegalAPIResponseError;

  Query.IllegalDimensionTypeError.prototype = new Error();
  Query.IllegalDimensionTypeError.prototype.constructor = Query.IllegalDimensionTypeError;

  return Query;

})();
/**
## analytics.**data** namespace

This namespace contains functions related to the retrial of OLAP data.
**/
analytics.data = (function() {

  // dataset returned by analytics.query
  var _data = {};

  // *analytics.data.measure[]* list of measures loaded
  var _measuresLoaded = [];

  // *crossfilter* crossfilter object containing the dataset
  var _dataCrossfilter;


  /**
  ### *int* data.**numberOfCrossedMembers**()

  Get the number of crossed members that is to say the number of possible combinations of members
  **/
  function numberOfCrossedMembers() {
    var nb = 1;
    var dimensions = analytics.state.dimensions();
    for (var i in dimensions) {
      if (!dimensions[i].aggregated()) {
        var members = dimensions[i].getLastSlice();
        nb *= Object.keys(members).length;
      }
    }
    return nb;
  }

  /**
  ### *boolean* data.**isClientSideAggrPossible**()

  Indicate if we should use client or server side aggregates.
  **/
  function isClientSideAggrPossible() {
    return numberOfCrossedMembers() < 20000;
  }

  /**
  ### *crossfilter* data.**setCrossfilterData**(*Object* data)

  Takes a dataset following [crossfilter's input requirements](https://github.com/square/crossfilter/wiki/API-Reference#crossfilter)
  and create a crossfilter dataset with it.

  It also disposes of all previous dimensions and groups because they are linked to old data.
  **/
  function setCrossfilterData(data) {
    var dimensions = analytics.state.dimensions();

    for (var i in dimensions) {
      // remove cf dimensions
      if (dimensions[i]._crossfilterDimension !== null)
        dimensions[i]._crossfilterDimension.dispose();
      dimensions[i]._crossfilterDimension = null;

      // remove cf groups
      for (var j in dimensions[i]._crossfilterGroups)
        dimensions[i]._crossfilterGroups[j].dispose();
      dimensions[i]._crossfilterGroups = [];
    }

    // create cf object
    if (isClientSideAggrPossible())
      _dataCrossfilter = crossfilter(data);
    else
      _dataCrossfilter = crossfilterServer(data);

    return _dataCrossfilter;
  }

  /**
  ### *Object* data.**getDataClientAggregates**()

  Get the data using client side agregates and returns a dataset matching *crossfilter's input requirements*
  **/
  function getDataClientAggregates() {
    analytics.query.clear();

    // set cube
    analytics.query.drill(analytics.state.cube().id());

    // set dimensions to get
    var dimensions = analytics.state.dimensions();
    var hierachiesList = [];

    for (var index in dimensions) {
      var dimension = dimensions[index];

      if (!dimension.aggregated()) {
        var members = dimension.getLastSlice();
        var hierarchy = dimension.hierarchy();
        hierachiesList.push(hierarchy);
        analytics.query.slice(hierarchy, Object.keys(members));
      }
    }
    analytics.query.dice(hierachiesList);

    _measuresLoaded = analytics.display.getExtraMeasuresUsed();
    _measuresLoaded.push(analytics.state.measure());
    for (var i in _measuresLoaded) {
      analytics.query.push(_measuresLoaded[i].id());
    }

    // get data
    var data = analytics.query.execute();

    return setCrossfilterData(data);
  }

  /**
  ### *Object* data.**getDataServerAggregates**()

  Get the data using server side agregates and returns a dataset matching *crossfilter's input requirements*
  **/
  function getDataServerAggregates() {
    var metadata = {
      "api" : analytics.query,
      "schema" : analytics.state.schema(),
      "cube" : analytics.state.cube().id(),
      "measures" : [],
      "dimensions" : {}
    };

    var i;

    // set dimensions to get
    var dimensions = analytics.state.dimensions();
    for (i in dimensions) {
      var dimension = dimensions[i];
      metadata.dimensions[dimension.id()] = {
        "hierarchy" : dimension.hierarchy(),
        "level" : dimension.currentLevel(),
        "members" : Object.keys(dimension.getLastSlice())
      };
    }

    // set measures
    _measuresLoaded = analytics.display.getExtraMeasuresUsed();
    _measuresLoaded.push(analytics.state.measure());
    for (i in _measuresLoaded) {
      metadata.measures.push(_measuresLoaded[i].id());
    }

    return setCrossfilterData(metadata);
  }

  /**
  ### *crossfilter* data.**load**()

  Load data from the cube according to the last slices & dices and creates a crossfitler dataset with it.
  **/
  // TODO add a try/catch around this
  _data.load = function() {
    if (isClientSideAggrPossible()) {
      return getDataClientAggregates();
    } else {
      return getDataServerAggregates();
    }
  };

  /**
  ### *crossfilter* data.**loadIfNeeded**()

  Calls `data.load()` if extra measures used in charts are not already loaded. Should be called if you changed
  extra measures used by charts.
  **/
  _data.loadIfNeeded = function() {
    var measuresLoadedIds = _measuresLoaded.map(function (m) { return m.id(); });
    var measuresToLoad = analytics.display.getExtraMeasuresUsed();

    for (var i in measuresToLoad) {
      // if we need to reload, do it and exit
      if (measuresLoadedIds.indexOf(measuresToLoad[i].id()) < 0) {
        _data.load();
        return true;
      }
    }

    return false;
  };

  /**
  ### *crossfilter.dimension* data.**getCrossfilterDimension**(*data.dimension* dimension, [*string[]* filters])

  Return the *crossfilter.dimension* object related to the current *crossfilter* dataset for the given `dimension`.
  Also preset filters on the dimension according to the given list of members in `filters` parameter (optional).
  **/
  _data.getCrossfilterDimension = function(dimension, filters) {

    if (dimension._crossfilterDimension === null) {
      dimension._crossfilterDimension = _dataCrossfilter.dimension(function(d) { return d[dimension.id()]; });
      if (filters.length) {
        dimension._crossfilterDimension.filterFunction(function (d) {
          for(var i = 0; i < filters.length; i++) {
            if (filters[i] == d)
              return true;
          }
          return false;
        });
      }
    }

    return dimension._crossfilterDimension;
  };

  /**
  ### *crossfilter.group* data.**getCrossfilterGroup**(*data.dimension* dimension, [*data.measure[]* extraMeasures])

  Return the *crossfilter.group* object related to the current *crossfilter* dataset for the given `dimension`.
  This group aggregates data by summing them.

  If a given list of extra measures is passed as `extraMeasures`, the group will contain multiple values for
  each key, one per i.e. for the current state measure and for each extra measure passed. In that case, each datum
  of the group will therefore be:

  ```js
  { key : "memberKey", value : {stateMeasureId : val1, extraMeasure1Id : val2, ...}}
  ```

  [See an example using the same principle in dc.js documentation](http://dc-js.github.io/dc.js/docs/stock.html#section-11)
  **/
  _data.getCrossfilterGroup = function(dimension, extraMeasures) {

    // simple grouping
    if (!Array.isArray(extraMeasures) || extraMeasures.length === 0) {
      if (dimension._crossfilterGroups.default === undefined) {
        dimension._crossfilterGroups.default = dimension
          .crossfilterDimension()
          .group()
          .reduceSum(function(d) { return d[analytics.state.measure().id()]; });
      }
      return dimension._crossfilterGroups.default;
    }

    // if we have a custom list of measures, we compute the group
    else {
      var measuresToGroup = [analytics.state.measure().id()];
      for (var i in extraMeasures)
        if (measuresToGroup.indexOf(extraMeasures[i].id()) < 0)
          measuresToGroup.push(extraMeasures[i].id());
      var key = measuresToGroup.sort().join(',');

      if (dimension._crossfilterGroups[key] === undefined) {
        dimension._crossfilterGroups[key] = dimension
          .crossfilterDimension()
          .group()
          .reduce(
            function (p, v) {
              for (var i in measuresToGroup)
                p[measuresToGroup[i]] += v[measuresToGroup[i]];
              return p;
            },
            function (p, v) {
              for (var i in measuresToGroup)
                p[measuresToGroup[i]] -= v[measuresToGroup[i]];
              return p;
            },
            function () {
              var p = {};
              for (var i in measuresToGroup)
                p[measuresToGroup[i]] = 0;
              return p;
            }
          );
      }
      return dimension._crossfilterGroups[key];
    }
  };

  // importTest "data-test-accessors.js"

  return _data;
})();

/**
## data.**cube**(*string* id, *string* caption)

This object describes an OLAP cube. It has the following functions:

* *mixed* data.cube.**id**([*string* id])
* *mixed* data.cube.**caption**([*string* caption])
* *boolean* data.cube.**equals**(*data.cube* other)

`id` and `caption` are getters/setters.
**/
analytics.data.cube = function (id, caption, description) {

  var _id = id;
  var _caption = caption;
  var _description = description;

  // returned object
  var _cube = {};

  _cube.id = function(id) {
    if (!arguments.length) return _id;
    _id = id;
    return _cube;
  };

  _cube.caption = function(caption) {
    if (!arguments.length) return _caption;
    _caption = caption;
    return _cube;
  };

   _cube.description = function(description) {
    if (!arguments.length) return _description;
    _description = description;
    return _cube;
  };

  _cube.equals = function (other) {
    return (typeof other.id == "function") && (_id === other.id());
  };

  return _cube;
};

/**
## data.**measure**(*string* id, *string* caption)

This object describes an OLAP measure. It has the following functions:

* *mixed* data.measure.**id**([*string* id])
* *mixed* data.measure.**caption**([*string* caption])
* *boolean* data.measure.**equals**(*data.measure* other)

`id` and `caption` are getters/setters.
**/
analytics.data.measure = function (id, caption, description) {

  var _id = id;
  var _caption = caption;
  var _description = description;

  // returned object
  var _measure = {};

  _measure.id = function(id) {
    if (!arguments.length) return _id;
    _id = id;
    return _measure;
  };

  _measure.caption = function(caption) {
    if (!arguments.length) return _caption;
    _caption = caption;
    return _measure;
  };

  _measure.description = function(description) {
    if (!arguments.length) return _description;
    _description = description;
    return _measure;
  };

  _measure.equals = function (other) {
    return (typeof other.id == "function") && (_id === other.id());
  };

  return _measure;
};

/**
## data.**property**(*string* id, *string* caption, *string* type)

This object describes an OLAP property. It has the following functions:

* *mixed* data.property.**id**([*string* id])
* *mixed* data.property.**caption**([*string* caption])
* *mixed* data.property.**type**([*string* type])
* *boolean* data.property.**equals**(*data.property* other)

`id`, `caption` and `type` are getters/setters.
**/
analytics.data.property = function (id, caption, type) {

  var _id = id;
  var _caption = caption;
  var _type = type;

  // returned object
  var _property = {};

  _property.id = function(id) {
    if (!arguments.length) return _id;
    _id = id;
    return _property;
  };

  _property.caption = function(caption) {
    if (!arguments.length) return _caption;
    _caption = caption;
    return _property;
  };

  _property.type = function(type) {
    if (!arguments.length) return _type;
    _type = type;
    return _property;
  };

  _property.equals = function (other) {
    return (typeof other.id == "function") && (_id === other.id());
  };

  return _property;
};

/**
## data.**dimension**(*string* id, *string* caption, *string* type, *string* hierarchy, *string[]* levels, [*data.property[]* properties])

This object describes an OLAP dimension. It is also used to store lots of informations about how the dimension is
analysed, by storing lots of things linked to the dimension, such as drill-down / roll-up and filters information.
**/
analytics.data.dimension = function (id, caption, description, type, hierarchy, levels, properties) {

  // returned object
  var _dimension = {};

  var _id          = id;
  var _caption     = caption;
  var _description = description;
  var _hierarchy   = hierarchy;
  var _type        = type;
  var _levels      = levels;
  var _properties  = properties;

  var _membersStack = []; // stack of all slice done on this hierarchy
  var _filters      = []; // list of selected elements on the screen for the last level of the stack
  var _filtersStack = []; // stack of all the filters slice done on this hierarchy
  
  var _colors = ["#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"];

  _dimension._crossfilterDimension = null; // crossfilter element for this dimension
  _dimension._crossfilterGroups = {}; // crossfilter element for the group of this dimension

  var _aggregated = false;

  /**
  This object has the following getters/setters:

  ### Simple getters

  This object have some simple getters:

  * *string* data.dimension.**id**()
  * *string* data.dimension.**caption**()
  * *string* data.dimension.**hierarchy**()
  * *string[]* data.dimension.**levels**() : captions of the levels of the dimension
  * *string* data.dimension.**type**()
  * *data.property[]* data.dimension.**properties**() : list of properties to load with members
  * *data.property* data.dimension.**getGeoProperty**() : return null or the geometrical property
  * *mixed* data.dimension.**colors**(colors) : get of set a color palette for this dimension
  * *mixed* data.dimension.**aggregated**(*boolean* aggregate) : getter / setter indicating if we need to aggregate the dimension or not
  * *boolean* data.dimension.**equals**(*data.dimension* other)
  **/
  _dimension.id = function() {
    return _id;
  };

  _dimension.caption = function() {
    return _caption;
  };

  _dimension.description = function() {
    return _description;
  };

  _dimension.hierarchy = function() {
    return _hierarchy;
  };

  _dimension.levels = function() {
    return _levels;
  };

  _dimension.type = function() {
    return _type;
  };

  _dimension.properties = function() {
    return _properties;
  };

  _dimension.filtersStack = function () {
    return _filtersStack;
  };

  _dimension.currentLevel = function() {
    return _membersStack.length - 1;
  };

  _dimension.currentLevelfiltersStack = function() {
    return _filtersStack.length - 1;
  };
  
  _dimension.maxLevel = function() {
    return _levels.length - 1;
  };

  _dimension.getGeoProperty = function () {
    for (var i in _properties) {
      if (_properties[i].type() == "Geometry")
        return _properties[i];
    }
    return null;
  };

  _dimension.colors = function (colors) {
    if (!arguments.length) return _colors;
    _colors = colors;
    return _dimension;
  };

  _dimension.aggregated = function (aggregate) {
    if (!arguments.length) return _aggregated;
    _aggregated = aggregate;
  };


  /**
  ### Drill-down / roll-up

  To handle drill-down / roll-up, the object stores a stack of the members shown
  for each level displayed. For example, at the beggining the stack will contain
  Europe's NUTS0. Then if you drill on Germany, we add Germany's NUTS1 to the stack.

  Note that members are always stored in an Object that associate the id of each member to
  and object containing the caption of the member and the property value if available.
  Here is an example of what members looks like:

  ```js
  {
  "FR" : // member key
    {
      "caption" : "France",
      "geometry" : {<geoJSONofFrance>}, // value of property "geometry"
      "area" : 123.5 // value of property "area"
    },
  "BE" :
    {
      "caption" : "Belgium",
      "geometry" : {<geoJSONofBelgium>},
      "area" : 254.1
    },
    ...
  }
  ```

  To handle this stack and the drill-down / roll-up functionnality, the following
  functions are available:

  * *Object[]* data.dimension.**membersStack**()
  * *this* data.dimension.**addSlice**(*Object* members)
  * *this* data.dimension.**removeLastSlice**()
  * *Object* data.dimension.**getLastSlice**()
  * *Object* data.dimension.**getSlice**(*int* level)
  * *int* data.dimension.**currentLevel**() : index of the current level displayed
  * *int* data.dimension.**maxLevel**() : index of the maximum level available
  * *boolean* data.dimension.**isDrillPossible**()
  * *boolean* data.dimension.**isRollPossible**()
  * *int* data.dimension.**nbRollPossible**() : number of roll we can do
  **/

  _dimension.membersStack = function () {
    return _membersStack;
  };

  _dimension.equals = function (other) {
    return (typeof other.id == "function") && (_id === other.id());
  };



  _dimension.addSlice = function (members) {
    _membersStack.push(members);
    return _dimension;
  };
  
  _dimension.addSliceToFiltersStack = function (filters) {
    _filtersStack.push(filters);
    return _dimension;
  };
  
  _dimension.removeLastSlice = function () {
    _membersStack = _membersStack.slice(0, -1);
    return _dimension;
  };

  _dimension.removeLastSliceFromFiltersStack = function () {
    _filtersStack = _filtersStack.slice(0, -1);
    return _dimension;
  };
  
  _dimension.getLastSlice = function () {
    return _membersStack[_membersStack.length - 1];
  };

  _dimension.getLastSliceFromFiltersStack = function () {
    return _filtersStack[_filtersStack.length - 1];
  };
  
  _dimension.getSlice = function (level) {
    return _membersStack[level];
  };
  
  _dimension.getSliceFromFiltersStack = function (level) {
    return _filtersStack[level];
  };

  _dimension.isDrillPossible = function () {
    return (_dimension.currentLevel() < _dimension.maxLevel());
  };

  _dimension.isRollPossible = function () {
    return (_dimension.currentLevel() > 0);
  };

  _dimension.nbRollPossible = function () {
    return _dimension.currentLevel();
  };

  /**
  ### Filters

  Filters on the dimensions are handled by the following functions:

  * *mixed* data.dimension.**filters**([*string[]* filters]) : get of set filtered members (identified by their ids)
  * *this* data.dimension.**filter**(*string* element, *boolean* add) : add (`add = true`) or remove (`add = false`) an element from the filters
  * *this* data.dimension.**addFilter**(*string* element)
  * *this* data.dimension.**removeFilter**(*string* element)
  **/
  _dimension.filters = function (filters) {
    if (!arguments.length) return _filters;
    _filters = filters;
    return _dimension;
  };

  _dimension.filter = function (element, add) {
    return add ? _dimension.addFilter(element) : _dimension.removeFilter(element);
  };

  _dimension.addFilter = function (element) {
    if (_filters.indexOf(element) < 0)
      _filters.push(element);
    return _dimension;
  };

  _dimension.removeFilter = function (element) {
    if (_filters.indexOf(element) >= 0)
      _filters.splice(_filters.indexOf(element));
    return _dimension;
  };

  /**
  ### Crossfilter objects

  You can get crossfilter objects related to this dimension using the following getters:

  * *crossfilter.dimension* data.dimension.**crossfilterDimension**()
  * *crossfilter.group* data.dimension.**crossfilterGroup**([*data.measure[]* extraMeasures]) :
    get a crossfilter group, optionally with extra measures (see data.getCrossfilterGroup for more details)
  **/
  _dimension.crossfilterDimension = function () {
    return analytics.data.getCrossfilterDimension(_dimension, _filters);
  };

  _dimension.crossfilterGroup = function (extraMeasures) {
    return analytics.data.getCrossfilterGroup(_dimension, extraMeasures);
  };

  return _dimension;
};

/**
## analytics.**state** namespace

This namespace contains functions related to the state of the analysis of the OLAP cube.

### *Object* analytics.**state**([*Object*])

`analytics.state()` is not only a namespace but also a function which is a getter/setter of
the state. It therefore allows you to get the state of the analysis and restore it later.
**/
analytics.state = (function() {

  var state = function (state) {
    if (!arguments.length) return getState();
    setState(state);
  };

  var _schema     = null;
  var _cube       = null;
  var _measure    = null;
  var _cubeObj    = null;
  var _measureObj = null;
  var _dimensions = [];

  /**
  ### OLAP state

  This namespace has the following simple getters / setters regarding the state of the analysis:

  * *mixed* state.**schema**([*string* schema])
  * *mixed* state.**cube**([*data.cube* cube])
  * *mixed* state.**measure**([*data.measure* measure])
  * *data.dimension[]* state.**dimensions**()
  * **setCubeAndMeasureCallback**(*data.cube* cube, *data.measure* measure)

  The function you should call to change the cube and / or measure of the state is `setCubeAndMeasureCallback`
  which will process the change and update the interface. The other getters/setters won't do anything with
  the new value except saving it.
  **/
  state.schema = function(schema) {
    if (!arguments.length) return _schema;
    _schema = schema;
  };

  state.cube = function(cube) {
    if (!arguments.length) return _cubeObj;
    _cubeObj = cube;
    _cube = cube.id();
  };

  state.measure = function(measure) {
    if (!arguments.length) return _measureObj;
    _measureObj = measure;
    _measure = measure.id();
  };

  state.dimensions = function() {
    return _dimensions;
  };

  function setCubeAndMeasureCallback(cube, measure) {

    // changing cube = reset all
    if (!state.cube().equals(cube)) {
      state.cube(cube);
      state.measure(measure);

      _dimensions = [];
      state.initDimensions();
      analytics.data.load();
      analytics.display.render();
    }
    else {
      state.measure(measure);

      analytics.data.load();
      analytics.display.redraw();
    }
  }

  /**
  ### Initialization

  To initialize the state, two functions are available:

  #### state.**initMeasure**()

  This function will initialize the schema, cube and measure of the state. If those values where
  set from a saved state, we will check that those are possible values.

  This function also renders the factSelector.
  **/
  state.initMeasure = function () {

    // select first schema if unset of unexistant
    var schemas = analytics.query.getSchemas();
    if (_schema === null || schemas[_schema] === undefined)
      _schema = Object.keys(schemas)[0];

    // get measures by cubes
    var cubesAndMeasures = analytics.query.getCubesAndMeasures(_schema);

    // select first cube if unset of unexistant
    if (_cube === null || cubesAndMeasures[_cube] === undefined) {
      var cubeId = Object.keys(cubesAndMeasures)[0];
      state.cube(analytics.data.cube(cubeId, cubesAndMeasures[cubeId].caption, cubesAndMeasures[cubeId].description));
    }

    // select first measure if unset of unexistant
    if (_measure === null || cubesAndMeasures[_cube].measures[_measure] === undefined) {
      var measureId = Object.keys(cubesAndMeasures[_cube].measures)[0];
      state.measure(analytics.data.measure(measureId, cubesAndMeasures[_cube].measures[measureId].caption, cubesAndMeasures[_cube].measures[measureId].description));
    }

    analytics.display.showFactSelector(cubesAndMeasures, state.cube(), state.measure(), setCubeAndMeasureCallback);
  };

  /**
  #### state.**initDimensions**()

  Load and prepare the dimensions of the current selected cube, if those are not already loaded from a saved state.
  Each dimension will be sliced on all the members of the first level.

  This function will also assign these dimensions to the charts by calling `analytics.display.assignDimensions()`,
  and will create the wordclouds by calling `analytics.display.createWordClouds()`
  **/
  state.initDimensions = function () {
    // TODO shouldn't creating dimension objects be done by analytics.query?

    if (!_dimensions.length) {
      // get specific infos
      var geoDimension  = analytics.query.getGeoDimension(_schema, _cube);
      var timeDimension = analytics.query.getTimeDimension(_schema, _cube);
      var geoDimensionObj, timeDimensionObj;

      // slice all dimensions by default
      var dimensions = analytics.query.getDimensions(_schema, _cube);
      for (var dimension in dimensions) {
        var hierarchy  = Object.keys(analytics.query.getHierarchies(_schema, _cube, dimension))[0];
        var properties = [];
        if (dimension == geoDimension) {
          var propertiesMap = analytics.query.getProperties(_schema, _cube, dimension, hierarchy, 0);
          var propertyId = analytics.query.getGeoProperty(_schema, _cube, dimension, hierarchy);
          properties.push(analytics.data.property(propertyId, propertiesMap[propertyId].caption, propertiesMap[propertyId].type));
        }
        var levels     = analytics.query.getLevels(_schema, _cube, dimension, hierarchy);
        var members    = analytics.query.getMembers(_schema, _cube, dimension, hierarchy, 0, properties.length > 0);

        var dimensionObj = analytics.data.dimension(dimension, dimensions[dimension].caption, dimensions[dimension].description, dimensions[dimension].type, hierarchy, levels, properties);
        dimensionObj.addSlice(members);
        _dimensions.push(dimensionObj);

        // save import dims
        if (dimensionObj.type() == "Geometry")
          geoDimensionObj = dimensionObj;
        else if (dimensionObj.type() == "Time")
          timeDimensionObj = dimensionObj;
      }

      // asign those dimensions to charts
      analytics.display.assignDimensions(_dimensions, geoDimensionObj, timeDimensionObj);
    }

    // create wordclouds
    analytics.display.createWordClouds(_dimensions);
  };

  /**
  ### Drill-down / roll-up

  Two functions are available to handle drill-down and roll-up of the current state.

  #### state.**drillDown**(*data.dimension* dimension, *string* member, *string* type)

  Drill down on a given member of the given dimension and reload data.

  You can choose the type of drill-down with the `type` parameter, which can be:

  * `simple`: Drill down on the given member, ie show the chidren of the given member (go from NUTS0 to Germany's NUTS1)
  * `selected`: Drill down on all the selected members, ie show the children of all these members at the same time (go from NUTS0 to Germany & France's NUTS1)
  * `partial`: Drill down on the given member and keep the current displayed members except the drilled one (go from NUTS0 to NUTS0 except Germany + Germany's NUTS1)

  `partial` drill-down is not implemented yet.
  **/
  state.drillDown = function (dimension, member, type) {

    if (dimension.isDrillPossible()) {
      var newMembers;

      switch (type) {
        case 'selected':
        var toDrill = dimension.filters().length ? dimension.filters() : Object.keys(dimension.getLastSlice());
        newMembers = {};
        toDrill.forEach(function (member) {
          var newMembersTemp = analytics.query.getMembers(_schema, _cube, dimension.id(), dimension.hierarchy(), dimension.currentLevel(), dimension.properties().length > 0, member);
          for (var newMember in newMembersTemp)
            newMembers[newMember] = newMembersTemp[newMember];
        });
        break;

        default:
        newMembers = analytics.query.getMembers(_schema, _cube, dimension.id(), dimension.hierarchy(), dimension.currentLevel(), dimension.properties().length > 0, member);
        break;
      }

      dimension.addSlice(newMembers);
      dimension.addSliceToFiltersStack(dimension.filters());
      analytics.data.load();
    }
  };

  /**
  ### state.**rollUp**(*data.dimension* dimension, [*int* nbLevels=1])

  Roll up on the given dimension, optionally `nbLevels` times, and reload data.
  **/
  state.rollUp = function (dimension, nbLevels) {
    nbLevels = nbLevels || 1;
    nbLevels = Math.min(nbLevels, dimension.nbRollPossible());

    if (nbLevels > 0) {
      var filtersLevelToApply = dimension.filtersStack().length - nbLevels;
      var filtersToApply = dimension.getSliceFromFiltersStack(filtersLevelToApply);
            
      // remove last slice nbLevels times
      for (var i = 0; i < nbLevels; i++){
        dimension.removeLastSlice();
        dimension.removeLastSliceFromFiltersStack();
      }

      dimension.filters(filtersToApply);
      // reload data
      analytics.data.load();
    }
  };

  function getState() {
    // init output
    var out = {
      "schema"       : analytics.state.schema(),
      "cube"         : analytics.state.cube().id(),
      "measure"      : analytics.state.measure().id(),
      "columnWidths" : analytics.display.columnWidths()
    };

    // list dimensions
    out.dimensions = analytics.state.dimensions().map(function (dimension) {
      return {
        id           : dimension.id(),
        hierarchy    : dimension.hierarchy(),
        filters      : dimension.filters(),
        properties   : dimension.properties().map(function (property) { return property.id(); }),
        membersStack : dimension.membersStack().map(function (members) { return Object.keys(members); }),
        filtersStack : dimension.membersStack().map(function (filters) { return Object.keys(filters); })
      };
    });

    // list charts
    out.charts = analytics.display.chartsInLayout().map(function (chartsCol, i) {
      if (i > 0) { // do not save wordclouds
        return chartsCol.map(function (chart) {
          return {
            type          : chart.type(),
            options       : chart.options(),
            dimensions    : chart.dimensions()   .map(function (dimension) { return dimension.id(); }),
            extraMeasures : chart.extraMeasures().map(function (measure)   { return measure  .id(); })
          };
        });
      }
      else {
        return [];
      }
    });

    return out;
  }

  function setState(savedState) {

    try {

      // schema
      state.schema(savedState.schema);

      // cube
      var cubes = analytics.query.getCubes(savedState.schema);
      state.cube(analytics.data.cube(savedState.cube, cubes[savedState.cube]));

      // measure
      var measuresMap = {};
      var measures = analytics.query.getMesures(savedState.schema, savedState.cube);
      for (var measure in measures) {
        measuresMap[measure] = analytics.data.measure(measure, measures[measure].caption);
      }
      state.measure(measuresMap[savedState.measure]);

      // columns
      analytics.display.columnWidths(savedState.columnWidths);

      // dimensions
      var dimensionsMap = {};
      var dimensions = analytics.query.getDimensions(savedState.schema, savedState.cube);
      savedState.dimensions.forEach(function (dimension) {
        var levels = analytics.query.getLevels(savedState.schema, savedState.cube, dimension.id, dimension.hierarchy);
        var propertiesMap = analytics.query.getProperties(savedState.schema, savedState.cube, dimension.id, dimension.hierarchy, 0);

        var properties = dimension.properties.map(function (property) {
          return analytics.data.property(property, propertiesMap[property].caption, propertiesMap[property].type);
        });

        var dimensionObj = analytics.data.dimension(
          dimension.id,
          dimensions[dimension.id].caption, dimensions[dimension.id].description, dimensions[dimension.id].type,
          dimension.hierarchy, levels, properties
        );
        dimensionObj.filters(dimension.filters);
        dimension.membersStack.forEach(function (members, levelId) {
          dimensionObj.addSlice(analytics.query.getMembersInfos(savedState.schema, savedState.cube, dimension.id, dimension.hierarchy, levelId, members, dimension.properties.length > 0));
        });

        _dimensions.push(dimensionObj);
        dimensionsMap[dimensionObj.id()] = dimensionObj;
      });

      // charts
      analytics.display.createCharts(savedState.charts, dimensionsMap, measuresMap);
    }
    catch(err) {
      new PNotify({
        title: 'Data for this analysis is unavailable',
        type: 'error'
      });
    }
  }

  return state;

})();

/**
## `analytics.display` namespace

This namespace contains functions related to the interface of the analysis and its rendering.
**/
analytics.display = (function() {

  var display = {};

  var _nextChartId = 0;

  var _charts = [[], [], []];

  var _resizableColumns;
  var _savedColumnWidths;

  /**
  ### Simple getters / setters

  A few simple getters/setters are available:

  * *mixed* display.**columnWidths**(*float[]* savedColumnWidths) : return the width of the columns (in percent of screen width)
  * *string* display.**getTip**(*string* tipType, *string* tipName) : return a tip string or an empty string if the tip does not exists
  **/
  display.columnWidths = function (savedColumnWidths) {
    if (!arguments.length) return _resizableColumns.saveColumnWidths();
    _savedColumnWidths = savedColumnWidths;
    return display;
  };


  display.getTip = function (tipType, tipName) {
    if (analytics.csts.tips[tipType] && analytics.csts.tips[tipType][tipName])
      return analytics.csts.tips[tipType][tipName];
    else
      return "";
  };

  /**
  ### Charts principle

  The main role of *display* is to organize and configure charts. The charts are organized in 3 columns, so each
  chart is positioned in a column *i* and at an offet *j*.

  ### Charts' getters

  To handle charts, the following getters are available:

  * *charts.chart[]* display.**charts**() : return a flat list of the charts on the interface
  * *charts.chart[][]* display.**chartsInLayout**() : return a list of columns, each column being a list of the charts in the columns
  * *jQueryObject* display.**getColumn**(*int* i) : return the jQuery object of the column
  * *charts.chart[]* display.**getChartsUsingDimension**(*data.dimension* dimension) : return the list of charts using a dimension
  * *{i: int, j: int}* display.**getChartPosition**(*charts.chart* chart) : return an object describing to column and offset of a chart
  * *data.measure[]* display.**getExtraMeasuresUsed**() : return the list of extra measures used by charts
  **/
  display.charts = function () {
    return Array.prototype.concat.apply([], _charts);
  };

  display.chartsInLayout = function () {
    return _charts;
  };

  function getColumn(i) {
    return $($(analytics.csts.css.columns)[i]);
  }

  display.getChartsUsingDimension = function (dimension) {

    var charts = display.charts();
    var out = [];
    for (var i in charts)
      if (charts[i].useDimension(dimension))
        out.push(charts[i]);

    return out;
  };

  function getChartPosition(chart) {
    for (var i in _charts)
      for (var j in _charts[i])
        if (chart.selector() == _charts[i][j].selector())
          return {i : i, j : j};

    return null;
  }

  display.getExtraMeasuresUsed = function () {

    var extraMeasuresMap = {};
    display.charts().forEach(function(chart) {
      chart.extraMeasures().forEach(function (measure) {
        extraMeasuresMap[measure.id()] = measure;
      });
    });
    var out = [];
    for (var measureId in extraMeasuresMap) {
      out.push(extraMeasuresMap[measureId]);
    }
    return out;
  };

  /**
  ### Charts' creation

  To create charts, the following functions are available:

  * *charts.chart* display.**insertChart**(*charts.chart* chart, *int* column, *int* offset) : insert a chart on the interface, at the given position
  * display.**replaceChart**(*charts.chart* chart, *string* newType) : replace a chart with a new chart of the given `type`
  * display.**emptyChartsColumn**(*int* i) : remove all charts of the *i*-th column
  * display.**initCharts**() : initialize the charts default layout (1 map, 1 timeline, 1 bar, 1 pie, 1 table)
  * display.**createCharts**(*Object[][]* charts, *Object<string, data.dimension>* dimensionsMap, *Object<string, data.measure>* measuresMap) :
      recreate charts from a given saved layout, using maps of dimensions and measures
  * display.**createWordClouds**(*data.dimension[]* dimensions) : create one wordcloud for each dimension of the dimensions given, and insert it in the first column
  * display.**assignDimensions**(*data.dimension[]* dimensions, *data.dimension* geoDimension, *data.dimension* timeDimension) : assign the dimensions to the charts
  **/
  function insertChart(chart, column, offset) {

    column = Math.max(0, Math.min(_charts.length - 1    , column)); // bound column between 0 and the nb of columns - 1
    offset = Math.max(0, Math.min(_charts[column].length, offset)); // bound column between 0 and the nb of charts

    // save chart object
    if (offset == _charts[column].length)
      _charts[column][offset] = chart;
    else
      _charts[column].splice(offset, 0, chart);

    // create container
    var columnCharts = getColumn(column).children("div");
    var container = '<div id="' + chart.selectorName() + '" class="'+analytics.csts.css.chartsClass+'"></div>';

    // insert as only chart of the column
    if (columnCharts.length === 0)
      getColumn(column).html(container);
    // insert as last chart
    if (columnCharts.length <= offset)
      $(columnCharts[columnCharts.length - 1]).after(container);
    // insert at offset position
    else
      $(columnCharts[offset]).before(container);
  }

    function replaceChart(chart, newType) {
    var pos = getChartPosition(chart);
    var selector = chart.selector();
    chart.delete();
    chart = analytics.charts[newType](selector);
    _charts[pos.i][pos.j] = chart;
    return chart;
  }

  function emptyChartsColumn(i) {
    _charts[i].forEach(function (chart) {
      var selector = chart.selector();
      chart.delete();
      $(selector).remove();
    });
    _charts[i] = [];
  }

  function initCharts () {
    if (display.charts().length === 0) {
      insertChart(analytics.charts.map("#chart-" + _nextChartId++), 1, 0);
      insertChart(analytics.charts.timeline("#chart-" + _nextChartId++), 1, 1);
      insertChart(analytics.charts.table("#chart-" + _nextChartId++), 1, 2);
      insertChart(analytics.charts.pie("#chart-" + _nextChartId++), 2, 0);
      insertChart(analytics.charts.bar("#chart-" + _nextChartId++), 2, 1);
    }
  }

  display.createCharts = function(charts, dimensionsMap, measuresMap) {
    charts.forEach(function (chartsCol, i) {
      chartsCol.forEach(function (chart, j) {
        var chartObj = analytics.charts[chart.type]("#chart-" + _nextChartId++)
          .dimensions   (chart.dimensions   .map(function (d) { return dimensionsMap[d]; }))
          .extraMeasures(chart.extraMeasures.map(function (m) { return measuresMap[m]; }));

        for (var option in chart.options) {
          chartObj.setOption(option, chart.options[option]);
        }

        insertChart(chartObj, i, j);
      });
    });
  };

  display.createWordClouds = function (dimensions) {
    // remove old wordclouds
    emptyChartsColumn(0);

    for (var i in dimensions) {
      var dimension = dimensions[i];
      insertChart(analytics.charts.wordcloudWithLegend("#chart-" + _nextChartId++, [dimension]), 0, Infinity);
    }
  };

  display.assignDimensions = function(dimensions, geoDimension, timeDimension) {

    var i;

    // assign dimensions to all charts
    var charts = display.charts();
    for (i in charts) {
      var chart = charts[i];
      if (chart.type() == "timeline")
        chart.dimensions([timeDimension]);
      else
        chart.dimensions([geoDimension]);
    }
  };

  /**
  ### Charts' update

  To modify the charts, the following functions are available:

  * display.**_displayParamsForm**(*charts.chart* chart) : show the form allowing to change the configuration of the given chart
  * display.**updateChart**(*charts.chart* chart, *Object* options) : modify the given chart with the given options
  * display.**freezeColorScales**()
  * display.**unfreezeColorScales**()
  **/
  display._displayParamsForm = function (chart) {

    var options = chart.options();

    var schema = analytics.state.schema();
    var cube   = analytics.state.cube().id();

    var dimensions = analytics.state.dimensions();
    var measures   = analytics.query.getMesures(schema, cube);
    var geoDimId   = analytics.query.getGeoDimension(schema, cube);

    // TODO extract creation of dimensionsMap to analytics.utils
    var dimensionsMap = {};
    dimensions.forEach(function (dimension) {
      dimensionsMap[dimension.id()] = dimension;
    });
    var measuresMap = {};
    for (var measureId in measures) {
      measuresMap[measureId] = analytics.data.measure(measureId, measures[measureId].caption);
    }

    var sortSelect             = $('#chartparam-sort');
    var typeSelect             = $('#chartparam-type');
    var playerTimeoutSelect    = $('#chartparam-playerTimeout');
    var labelChoiceSelect      = $('#chartparam-labelChoice');
    var dimensionsSelects      = $('.chartparam-dimension');
    var measuresSelects        = $('.chartparam-measure');
    var sortContainer          = sortSelect         .parent().parent();
    var playerTimeoutContainer = playerTimeoutSelect.parent().parent();
    var labelChoiceContainer   = labelChoiceSelect  .parent().parent();
    var dimensionsContainers   = dimensionsSelects  .parent().parent();
    var measuresContainers     = measuresSelects    .parent().parent();

    // hide all
    sortContainer         .hide();
    playerTimeoutContainer.hide();
    labelChoiceContainer  .hide();
    dimensionsContainers  .hide();
    measuresContainers    .hide();

    // add chart types once
    if (!typeSelect.children('option').length) {
      for (var chartType in analytics.charts) {
        if (chartType != 'chart' && typeof analytics.charts[chartType].params != 'undefined' && analytics.charts[chartType].params.displayParams === true) {
          var caption = analytics.csts.txts.charts[chartType] ? analytics.csts.txts.charts[chartType] : chartType;
          typeSelect.append('<option value="'+chartType+'">'+caption+'</option>');
        }
      }
    }

    // Add dimensions & measures to selects
    dimensionsSelects.empty().append('<option value=""></option>');
    measuresSelects  .empty().append('<option value=""></option>');

    var dimension, measure;
    dimensions.forEach(function (dimension) {
      dimensionsSelects.append('<option value="'+dimension.id()+'">'+dimension.caption()+'</option>');
    });
    for (measure in measures) {
      measuresSelects.append('<option value="'+measure+'">'+measures[measure].caption+'</option>');
    }

    // autoset infos
    typeSelect.val(chart.type());
    sortSelect.val(options.sort);
    playerTimeoutSelect.val(options.playerTimeout);
    labelChoiceSelect.prop("checked", options.labels);
    dimensionsSelects.each(function(i, el) {
      var dimension = chart.dimensions()[i];
      if (dimension)
        $(el).val(dimension.id());
    });
    measuresSelects.each(function(i, el) {
      var measure = chart.extraMeasures()[i];
      if (measure)
        $(el).val(measure.id());
    });

    // update form dynamically depending on type
    function updateForm(chartType, duration) {
      var nbDims            = analytics.charts[chartType].params.nbDimensionsMax;
      var nbMes             = analytics.charts[chartType].params.nbExtraMeasuresMax;
      var showSort          = analytics.charts[chartType].options.sort !== null;
      var showPlayerTimeout = analytics.charts[chartType].params.displayPlay;
      var showLabelChoice   = analytics.charts[chartType].options.labels !== null;

      // show dimensions & measures
      dimensionsContainers.slice(0, nbDims).slideDown(duration);
      measuresContainers  .slice(0, nbMes) .slideDown(duration);
      dimensionsContainers.slice(nbDims).slideUp(duration);
      measuresContainers  .slice(nbMes) .slideUp(duration);

      // show sort container
      if (showSort)
        sortContainer.slideDown(duration);
      else
        sortContainer.slideUp(duration);

      if (showPlayerTimeout)
        playerTimeoutContainer.slideDown(duration);
      else
        playerTimeoutContainer.slideUp(duration);

      if (showLabelChoice)
        labelChoiceContainer.slideDown(duration);
      else
        labelChoiceContainer.slideUp(duration);

      // disable impossibles dimensions & measures
      dimensionsSelects.children('option').removeAttr('disabled');
      for (dimension in dimensionsMap) {
        if (!analytics.charts[chartType].isPossibleDimension(dimensionsMap[dimension]))
          dimensionsSelects.children('option[value="'+dimensionsMap[dimension].id()+'"]').attr('disabled', 'disabled');
      }
      measuresSelects.children('option').removeAttr('disabled');
      for (measure in measuresMap) {
        if (!analytics.charts[chartType].isPossibleExtraMeasure(measuresMap[measure]))
          measuresSelects.children('option[value="'+measuresMap[measure].id()+'"]').attr('disabled', 'disabled');
      }
    }
    updateForm(typeSelect.val(), 0);

    typeSelect.change(function() { updateForm($(this).val(), 400); });

    // set callback for save
    $('#chartparams-set').unbind('click').click(function() {
      $('#chartparams').modal('hide');

      var options = {
        dimensions    : [],
        measures      : [],
        sort          : sortSelect.val(),
        type          : typeSelect.val(),
        labels        : labelChoiceSelect.prop("checked"),
        playerTimeout : playerTimeoutSelect.val(),
      };
      dimensionsSelects.each(function(i, el) {
        var dimension = dimensionsMap[$(el).val()];
        if (dimension)
          options.dimensions[i] = dimension;
      });
      measuresSelects.each(function(i, el) {
        var measure = measuresMap[$(el).val()];
        if (measure)
          options.measures[i] = measure;
      });

      updateChart(chart, options);
    });

    // show modal
    $('#chartparams').modal('show');
  };

  function updateChart (chart, options) {

    var doRender = false;
    var doRedraw = false;
    var loadData = false;

    // create dims & measures
    var nbDims = analytics.charts[options.type].params.nbDimensionsMax;
    var nbMes  = analytics.charts[options.type].params.nbExtraMeasuresMax;
    options.dimensions = options.dimensions.slice(0, nbDims).filter(function (d) { return typeof d.id != "undefined"; });
    options.measures   = options.measures  .slice(0, nbMes) .filter(function (d) { return typeof d.id != "undefined"; });

    // check coherence
    if (!analytics.charts[options.type].arePossibleDimensions(options.dimensions))
      new PNotify('Invalid dimensions selected');
    if (!analytics.charts[options.type].arePossibleExtraMeasures(options.measures))
      new PNotify('Invalid axes selected');

    // chart type change = new chart
    if (chart.type() != options.type) {
      chart = replaceChart(chart, options.type);
      doRender = true;
    }

    // new dimensions
    if (!arraysEquals(options.dimensions, chart.dimensions())) {
      chart.dimensions(options.dimensions);
      doRedraw = true;
    }

    // new measures
    if (!arraysEquals(options.measures, chart.extraMeasures())) {
      chart.extraMeasures(options.measures);
      doRedraw = true;
      loadData = true;
    }

    // sort order allowed & changed
    if (analytics.charts[options.type].options.sort !== null && chart.options().sort != options.sort) {
      chart.setOption("sort", options.sort);
      doRedraw = true;
    }

    // show labels
    if (analytics.charts[options.type].options.labels !== null && chart.options().labels != options.labels) {
      chart.setOption("labels", options.labels);
      doRender = true;
    }

    if (analytics.charts[options.type].params.displayPlay && chart.options().playerTimeout != options.playerTimeout) {
      if (options.playerTimeout < 50)
        options.playerTimeout = 50;
      chart.setOption("playerTimeout", options.playerTimeout);
      if (chart.player() !== undefined) {
        chart.player().timeout(options.playerTimeout);
      }
    }

    // Update display
    if (loadData) {
      var isLoaded = analytics.data.loadIfNeeded();
      chart.render();
      if (isLoaded)
        analytics.display.redraw();
    }
    else if (doRender)
      chart.render();
    else if (doRedraw)
      chart.redraw();
  }

  var _frozenColorScales = false;

  display.freezeColorScales = function () {
    _frozenColorScales = true;
  };

  display.unfreezeColorScales = function () {
    _frozenColorScales = false;
  };

  /**
  ### Charts' filters

  To handle chart's filtering, the following functions are available:

  * display.**filterAllChartsUsingDimension**(*data.dimension* dimension) : reset filters on the charts using the given dimension
  * display.**filterChartsAsDimensionsState**() : update the charts filters to match the filters set on the dimensions
  * display.**_updateFilter**(*data.dimension* dimension, *string* element, *boolean* addOrRemove) : update filters on charts
      using the given dimension to match the fact that `element` must be filtered (`addOrRemove = true`) or not (`addOrRemove = false`)
  **/
  display.filterAll = function () {
    analytics.state.dimensions().forEach(function (dimension) {
      dimension.filters([]);
    });
    dc.filterAll();
  };

  display.filterAllChartsUsingDimension = function (dimension) {
    dimension.filters([]);
    var charts = display.getChartsUsingDimension(dimension);
    for (var i in charts) {
      charts[i].element().filterAll();
    }
  };

  function filterChartsAsDimensionsState () {

    // for each dimension, if there is filters to process
    analytics.state.dimensions().forEach(function (dimension) {
      var filters = dimension.filters();
      var charts = display.getChartsUsingDimension(dimension);

      if (filters.length && charts.length) {
        var chart = charts[0];
        filters.forEach(function (filter) {
          if (!chart.element().hasFilter(filter)) {
            chart.element().filter(filter);
          }
        });
      }

    });
  }

  display._updateFilter = function (dimension, element, addOrRemove) {
    // update dimension
    dimension.filter(element, addOrRemove);

    // update charts using dimension
    var charts = display.getChartsUsingDimension(dimension);
    for (var i in charts) {
      if (charts[i].element().hasFilter(element) != addOrRemove) {
        charts[i].element().filter(element);
      }
    }

    if (!_frozenColorScales) {
      display.charts().map(function (chart) { chart.updateColors(); });
    }
  };

  /**
  ### Initialization

  To initialize display, the following functions are available:

  * display.**initButtons**() : initialize the reset and resize buttons
  * display.**initResize**() : initialize the resize behavior of the interface, to adapt charts when the window is resized
  * display.**init**() : initialize the whole interface (call the functions above)
  **/
  function initButtons () {

    // reset button
    $(analytics.csts.css.reset).click(function() {
        display.filterAll();
        display.redraw();
      }
    );

    // resize button
    var paddingTopInit = $('body').css('padding-top');
    var headerInitHeight = $(analytics.csts.css.header).height();
    var interfaceInitTop = $(analytics.csts.css.columns).cssUnit('top'); // ex : [100, 'px']

    $(analytics.csts.css.resize).click(function() {
      $(analytics.csts.css.header).toggle();

      if ($(analytics.csts.css.header).is(':hidden')) {
        $(analytics.csts.css.columns).css('top', interfaceInitTop[0] - headerInitHeight + interfaceInitTop[1]);
        $('body').css('padding-top', '0');
      }
      else {
        $(analytics.csts.css.columns).css('top', interfaceInitTop.join(''));
        $('body').css('padding-top', paddingTopInit);
      }

      resize();
    });
  }

  function initResize () {

    // init column resize
    $(analytics.csts.css.columnsContainer).resizableColumns();
    _resizableColumns = $(analytics.csts.css.columnsContainer).data('resizableColumns');

    // restore columns widths
    if (typeof _savedColumnWidths != 'undefined') {
      _resizableColumns.restoreColumnWidths(_savedColumnWidths);
    }

    // resize charts at end
    var timer = window.setTimeout(function() {}, 0);
    $(window).on('resize', function() {
      window.clearTimeout(timer);
      timer = window.setTimeout(function() {
        $(window).trigger('resizeend');
      }, 350);
    });
    $(window).on('resizeend', resize);
    $(window).on("column:resize:stop", resize);

    //$(analytics.csts.css.columns).sortable({ distance: 20, connectWith: analytics.csts.css.columns });
    //$(analytics.csts.css.columns).disableSelection();
  }



  display.init = function () {
    initCharts();
    initButtons();
    initResize();
  };

  /**
  ### Rendering

  For the rendering of the elements of the interface, display has the following functions:

  * display.**showFactSelector**(*Object* cubesAndMeasures, *data.cube* cube, *data.measure* measure, *function* callback)
  * display.**resize**() : resize the charts
  * display.**rebuild**() : rebuild the charts
  * display.**initRender**() : render the charts for the first time (will ask the charts to load the filters of the dimensions)
  * display.**render**() : render the charts
  * display.**redraw**() : redraw the charts
  **/
  display.showFactSelector = function(cubesAndMeasures, cube, measure, callback) {
    analytics.display.factSelector.init(analytics.csts.css.factSelector, analytics.csts.txts.factSelector.cubes, analytics.csts.txts.factSelector.measures);
    analytics.display.factSelector.setMetadata(cubesAndMeasures);
    analytics.display.factSelector.setCallback(callback);
    analytics.display.factSelector.setSelectedCube(cube.id());
    analytics.display.factSelector.setSelectedMeasure(measure.id());
  };

  function resize () {
    display.charts().forEach(function (chart) {
      chart.resize();
    });
  }

  function rebuild () {
    var charts = display.charts();
    for (var i in charts) {
      charts[i].build();
    }
  }

  display.initRender = function () {
    rebuild();
    filterChartsAsDimensionsState();
    dc.renderAll();
  };

  display.render = function () {
    rebuild();
    dc.renderAll();
  };

  display.redraw = function () {
    rebuild();
    dc.redrawAll();
  };

  /**
  ### Drill-down / roll-up

  When doing a drill-down / roll-up, the charts will have to call the following functions:

  * display.**drillDown**(*data.dimension* dimension, *string* member, *int* dcChartID, *Object* keys) : do a drill-down
     on the given member of the given dimension, knowning that the drill-down has been sent by the chart `dcChartID`,
     whith the `keys` pressed described like `{ctrl: <boolean>, alt: <boolean>, maj: <boolean>}`. Depending on the keys,
     the behavior can difer.
  * display.**rollUp**(*data.dimension* dimension, *int* dcChartID, [*int* nbLevels=1]) : Roll-up on the given dimension
     `nbLevels` times, knowning that the roll-up has been sent by the chart `dcChartID`.
  **/
  display.drillDown = function (dimension, member, dcChartID, keys) {

    if (dimension.isDrillPossible()) {

      // update display
      display.getChartsUsingDimension(dimension).forEach(function (chart) {
        if (chart.element()._onZoomIn !== undefined && chart.element().chartID() !== dcChartID) {
          chart.element()._onZoomIn(member);
        }
      });

      // update state
      if (keys.ctrl)
        analytics.state.drillDown(dimension, member, 'selected');
      else
        analytics.state.drillDown(dimension, member, 'simple');

      // reset filter on charts using this dimension
      display.filterAllChartsUsingDimension(dimension);

      // update interface
      display.render();
    }
  };

  display.rollUp = function (dimension, dcChartID, nbLevels) {
    nbLevels = nbLevels || 1;
    nbLevels = Math.min(nbLevels, dimension.nbRollPossible());

    if (nbLevels > 0) {

      // zoom out on charts
      for (var i = 0; i < nbLevels; i++) {
        display.getChartsUsingDimension(dimension).forEach(function (chart) {
          if (chart.element()._onZoomOut !== undefined && chart.element().chartID() !== dcChartID) {
            chart.element()._onZoomOut();
          }
        });
      }

      // reset filter on charts using this dimension
      display.filterAllChartsUsingDimension(dimension);

      // roll up state
      analytics.state.rollUp(dimension, nbLevels);

      filterChartsAsDimensionsState();

      // update interface
      display.render();
    }
  };

  // compare two arrays of objects having .equals() method
  function arraysEquals(array1, array2) {
    if (array1.length != array2.length)
      return false;

    for (var i in array1)
      if (!array1[i].equals(array2[i]))
        return false;

    return true;
  }

  return display;
})();

analytics.display.factSelector = (function () {
  
  var FactSelector = {

    /**
     * JQuery global container of fact selector
     */
    container : null,

    /**
     * Id of the cube
     */
    cube : null,

    /**
     * Id of the cube with a measure displayed
     */
    displayedCube : null,

    /**
     * Id of the measure displayed
     */
    measure : null,

    /**
     *
     */
    cubes : [],

    /**
     * 
     */
    measures : [],

    /**
     * Object containing cubes and measures
     */
    data : null,

    /**
     * Callback for display
     */
    callback : null,

    /**
     * Initialize the parameters of the fact selector
     *
     * @param {string} factSelector - CSS Selector
     * @param {string} introCubes - Text to introduce the list of cubes (for localization)
     * @param {string} introMeasures - Text to introduce the list of measures (for localization)
     * @public
     */
    init : function (factSelector, introCubes, introMeasures) {

      this.cubes.intro = introCubes;
      this.measures.intro = introMeasures;

      // create elements
      this.container = $(factSelector);

      this.cubes.container = $('<div></div>');
      this.measures.container = $('<div></div>');

      this.container.append(this.cubes.container);
      this.container.append(this.measures.container);

    },

    /**
     * Define the list of cubes and mesures in the cubes
     *
     * @param Object data : cubes and measures following this scheme:
     *  {
     *    cubeID :
     *    {
     *      "caption" : cubeCaption
     *      "measures" :
     *      {
     *        measureID : {"caption" : measureCaption},
     *        measureID2 : {"caption" : measureCaption2},
     *        ...
     *      }
     *    },
     *    cubeID2 : ...
     *  }
     *
     * @public
     */
    setMetadata : function (data) {

      this.data = data;

      this.showCubes();
      this.resetMeasures();

    },

    /**
     * Show the list of cubes stored in data
     * @param {boolean} [dropdown=false] indicate if we want a dropdown or a buttons list
     * @private
     */
    showCubes : function (dropdown) {

      var that = this;

      this.cubes.data = this.data;

      if (dropdown) {
        this.displayDropdown(this.cubes, function(d) { that.selectCube(d); });
      }
      else {
        this.displayButtons(this.cubes, function(d) { that.selectCube(d); });
      }
    },


    /**
     * Show the list of measures of the input cube
     *
     * @param {string} cubeID - cube of which the measures will be displayed
     * @private
     */
    showMeasures : function (cubeID) {

      var that = this;

      this.measures.data = this.data[cubeID].measures;

      // display with buttons
      this.displayButtons(this.measures, function(d) { that.selectMeasure(d); });

      if (this.measures.container.width() + this.cubes.container.width() > this.container.width()) {
        if (this.cubes.type != 'dropdown') {
          this.showCubes(true);
          this.setSelectedCube(this.cube);
          if (this.measures.container.width() + this.cubes.container.width() > this.container.width()) {
            this.displayDropdown(this.measures, function(d) { that.selectMeasure(d); });
          }
        }
        else {
          this.displayDropdown(this.measures, function(d) { that.selectMeasure(d); });
        }
      }
      else {
        if (this.cubes.type === 'dropdown') {
          this.showCubes(false);
          if (this.measures.container.width() + this.cubes.container.width() > this.container.width()) {
            this.showCubes(true);
          }
          this.setSelectedCube(this.cube);
        }
      }
    },


    /**
     * Display a list of elements as a bootstrap buttons list
     *
     * @param {Object} element - Object with the following attributes :
     *    "container" : a jQuery element that will contain the result
     *    "intro" : string describing the list
     *    "data" : Object with, for each key, a value as an Object with a caption attribute (see setMetadata)
     *
     *  element will be modified with these new attributes :
     *     "list" : a jQuery <ul> element that contains the elements shown
     *     "type" : "buttons" or "dropdown", depending on the type of display. Here "buttons".
     *
     * @param {function} callback - the function(id) that will be called when clicking on an element
     * @private
     */
    displayButtons : function (element, callback) {

      this.displayList(element, callback, "btn btn-group", "btn btn-default");
      element.container.empty();
      element.container.append(element.intro+' ');
      element.container.append(element.list);
      element.type = "buttons";
    },

    /**
     * Display a list of elements as a bootstrap dropdown element
     *
     * @param {Object} element - object with the attributes described in displayButtons
     * @param {function} callback - the function(id) that will be called when clicking on an element
     * @private
     */
    displayDropdown : function (element, callback) {

      this.displayList(element, callback, "dropdown-menu", "", true);
      element.container.empty();
      element.container.append(element.intro+' ');
      element.title = $('<a class="btn btn-default dropdown-toggle" data-toggle="dropdown" href="#">'+element.intro+' <span class="caret"></span></a>');
      element.container.append(
        $('<div class="btn-group btn-default"></div>')
          .append(element.title)
          .append(element.list)
      );
      element.type = "dropdown";

    },

    /**
     * Display a list of elements in an <ul>
     *
     * @param {Object} element - object with the attributes described in displayButtons
     * @param {function} callback - the function(id) that will be called when clicking on an element
     * @param {string} listClass - the class of the <ul> element
     * @param {string} linkClass - the class of the <li> or <a> element depending on addLinks param
     * @param {boolean} [addLinks] - indicate if we need to add an <a> element in each <li>
     * @private
     */
    displayList : function (element, callback, listClass, linkClass, addLinks) {

      listClass = listClass ? 'class="'+listClass+'"' : '';
      linkClass = linkClass ? 'class="'+linkClass+'"' : '';

      element.list = $('<ul '+listClass+'></ul>');

      var useCallback = function() { callback($(this).attr('data-id')); return false; };

      for (var elID in element.data) {
        var eltDescription = element.data[elID].description;
        var eltCaption = element.data[elID].caption;

        if (addLinks) {
          var aTag;
          if (typeof eltDescription != 'undefined' && eltDescription != eltCaption) {
            aTag = $('<a'+linkClass+' href="#" data-id="'+elID+'" data-toggle="tooltip" class="chart-infos" data-placement="bottom" title="' + eltDescription + '">'+eltCaption+'</a>')
                      .tooltip({'container': 'body', 'html': true});
          } else {
            aTag = $('<a'+linkClass+' href="#" data-id="'+elID+'">'+eltCaption+'</a>');
          }
          aTag.click(useCallback);
          element.list.append($('<li></li>').append(aTag));
        }
        else {
          var liTag;
          if (typeof eltDescription != 'undefined' && eltDescription != eltCaption) {
            liTag = $('<li '+linkClass+' data-id="'+elID+'" data-toggle="tooltip" class="chart-infos" data-placement="bottom" title="' + eltDescription + '">'+eltCaption+'</li>')
                      .tooltip({'container': 'body', 'html': true});
          } else {
            liTag = $('<li '+linkClass+' data-id="'+elID+'">'+eltCaption+'</li>');
          }
          liTag.click(useCallback);
          element.list.append(liTag);
        }

      }
    },

    /**
     * Reset the measures display
     * @private
     */
    resetMeasures : function() {
      this.measures.container.empty();
    },


    /**
     * Update the view to indicate that a cube is selected
     *
     * @param string cubeID : selected cube
     * @private
     */
    setSelectedCube : function (cubeID) {
      this.cube = cubeID;
      this.setSelectedElement(this.cubes, cubeID);
      this.showMeasures(cubeID);
      if (this.cube === this.displayedCube) {
        this.setSelectedMeasure(this.measure);
      }
    },

    /**
     * Update the view to indicate that a measure is selected
     *
     * @param string measureID : selected measure
     * @public
     */
    setSelectedMeasure : function (measureID) {
      this.setSelectedElement(this.measures, measureID);
      this.displayedCube = this.cube;
      this.measure = measureID;
    },

    /**
     * Update the view to indicate that a measure or a cube is selected
     * @param {Object} element - object with the attributes described in displayButtons
     * @param {string} id - the id of the selected element
     * @private
     */
    setSelectedElement : function (element, id) {

      // add selected class to the selected element
      element.list.children('li').each(function (i, el) {
        if ($(el).attr('data-id') == id) {
          $(el).addClass('active');
        }
        else {
          $(el).removeClass('active');
        }
      });

      // change dropdown title if needed
      if (element.type == 'dropdown') {
        element.title.html(element.data[id].caption+' <span class="caret"></span></a>');
      }
    },

    /**
     * Function called on click on a cube. Update the display (highlight).
     *
     * @param {string} cubeID - ID of the selected measure
     * @private
     *
     */
    selectCube : function (cubeID) {
      this.setSelectedCube(cubeID);
    },

    /**
     * Function called on click on a measure. Update the display (highlight) and inform the controller.
     *
     * @param {string} measureID - ID of the selected measure
     * @private
     */
    selectMeasure : function (measureID) {
      this.setSelectedMeasure(measureID);
      this.callback(analytics.data.cube(this.cube,    this.data[this.cube].caption),
                    analytics.data.measure(measureID, this.data[this.cube].measures[measureID].caption, this.data[this.cube].measures[measureID].description));
    },

    /**
     * Set the callback function that will be called when selecting a measure
     *
     * @param {function} f - function(cubeID, measureID) to be called
     * @public
     */
    setCallback : function(f) {
      this.callback = f;
    },

  };

  return FactSelector;

})();
analytics.charts = {};


/**
## analytics.charts.**player** class

This class represent an object that handles playing the data displayed on a chart.

### *Object* analytics.charts.**player**([*Object*])

Creates a player object for the given chart.
**/
analytics.charts.player = function (chart) {

  var _dimension = chart.dimensions()[0];
  var _members = Object.keys(_dimension.getLastSlice()).sort();
  var _currentMember = 0;
  var _timeout = chart.options().playerTimeout;
  var _running = true;
  var _callback = function () { };
  var _chart = chart;

  var _play = {};

  var _step = function() {
    if (_currentMember > _members.length - 1) {
      _callback();
      return;
    }

    if (!_running) {
      return;
    }

    _chart.element().filter(_members[_currentMember]);
    if (_currentMember - 1  >= 0) {
      _chart.element().filter(_members[_currentMember - 1]);
    }
    dc.redrawAll();

    _currentMember++;

    setTimeout(_step, _play.timeout());
  };

  /**
  ### Player object

  * *boolean* charts.player.**running**()
  * *mixed* charts.player.**timeout**([*integer* timeout])
  * *mixed* charts.player.**callback**([*function* cb])
  * *this* charts.player.**start**()
  * *this* charts.player.**pause**()

  The optional `callback` is called at the end of the play.
  The timeout is the time to wait between two members.

  **/

  _play.running = function () {
    return _running;
  };

  _play.timeout = function(timeout) {
    if (!arguments.length) return _timeout;
    _timeout = timeout;
    return _play;
  };

  _play.callback = function(cb) {
    if (!arguments.length) return _callback;
    _callback = cb;
    return _play;
  };

  _play.start = function() {
    _running = true;
    setTimeout(_step, _timeout);
    return _play;
  };

  _play.pause = function() {
    _running = false;
    return _play;
  };

  return _play;
};

/**
## analytics.charts.**chart** class

This class is an abstract class that is the base class for all charts in analytics.

### *Object* analytics.charts.**chart**(*string* selector, *data.dimension[]* dimensions)

**/
analytics.charts.chart = (function () {

  function charts_chart_nostatic (selector, dimensions) {

    // returned object
    var _chart = {};

    /**
    ### Chart object

    #### public methods
    * *string* charts.chart.**type**()
    * *mixed* charts.chart.**dimensions**([*data.dimension[]* dimensions])
    * *boolean* charts.chart.**useDimension**(*data.dimension[]* dimensions)
    * *mixed* charts.chart.**extraMeasures**(*data.measure[]* extraMeasures)
    * *string* charts.chart.**selector**()
    * *string* charts.chart.**selectorName**()
    * *integer* charts.chart.**width**()
    * *integer* charts.chart.**height**()
    * *object* charts.chart.**element**() : returns the dc.js chart associated with the chart
    * *object* charts.chart.**options**() : return the options of the chart
    * *this* charts.chart.**setOption**(*string* key, *mixed* value)
    * *object* charts.chart.**player**() : return the current player object of the chart
    * *this* charts.chart.**build**() : build and update the chart
    * *this* charts.chart.**render**() : render the dc.js chart
    * *this* charts.chart.**redraw**() : update the chart and redraw the dc.js chart
    * *this* charts.chart.**resize**()
    * *this* charts.chart.**updateColors**()
    * charts.chart.**delete**()
    **/

    // data
    var _dimensions    = dimensions ? dimensions : [];
    var _extraMeasures = [];
    var _player;

    // set/get data
    _chart.type = function() {
      return 'chart';
    };

    _chart.dimensions = function(dimensions) {
      if (!arguments.length) return _dimensions;
      _dimensions = dimensions;
      return _chart;
    };

    _chart.useDimension = function(dimension) {
      for (var i in _dimensions) {
        if (_dimensions[i].equals(dimension))
          return true;
      }
      return false;
    };

    _chart.extraMeasures = function(extraMeasures) {
      if (!arguments.length) return _extraMeasures;
      _extraMeasures = extraMeasures;
      return _chart;
    };


    // rendering
    var _selector   = selector;
    _chart._element = null; // dc.js chart object

    // set/get content
    _chart.selector = function() {
      return _selector;
    };

    _chart.selectorName = function() {
      return _selector.replace('#', '');
    };

    _chart.width = function() {
      return $(_selector).width();
    };

    _chart.height = function() {
      var height = $(_selector).height() - $(_selector+' .chart-header').height();
      optionsHeight(height);
      return height;
    };

    function optionsHeight (heightPx) {
      if (!arguments.length)
        return getPxFromRefVal(_chart.options().height, _chart.options().heightReference);

      _chart.setOption("height", getRefValFromPx(heightPx, _chart.options().heightReference));
    }

    function getPxFromRefVal(val, ref) {
      return val * getRefCoef(ref);
    }

    function getRefValFromPx(val, ref) {
      return val / getRefCoef(ref);
    }

    function getRefCoef(ref) {
      switch (ref) {
        case "columnWidthRatio":
        return $(_selector).parent().width();

        case "columnHeightRatio":
        return $(_selector).parent().height();

        default:
        return 1;
      }
    }

    _chart.element = function() {
      return _chart._element;
    };

    _chart.params = function() {
      return _chart._params;
    };

    _chart.options = function() {
      return _chart._options;
    };

    _chart.setOption = function(key, value) {
      if (typeof _chart._options[key] != 'undefined' && _chart._options[key] !== null)
        _chart._options[key] = value;
      return _chart;
    };

    _chart.player = function () {
      return _player;
    };

    // display main functions
    _chart.build = function () {
      if (!_chart.element()) {
                initContainer();    // jshint ignore:line
                initResize();       // jshint ignore:line
        _chart._initContainerSpecific();
                initHeader();       // jshint ignore:line
        _chart._createDcElement();
                initChartCommon();  // jshint ignore:line
        _chart._initChartSpecific();
      }

      updateHeader();
      updateChartCommon();
      _chart._updateChartSpecific();
      return _chart;
    };

    _chart.render = function() {
      _chart.build().element().render();
      return _chart;
    };

    _chart.redraw = function() {
      if (!_chart.element())
        return _chart.render();
      _chart.build().element().redraw();
      return _chart;
    };

    // display sub-functions
    function initContainer () {
      $(_selector).html('<div class="chart-header"></div><div class="chart-container"></div>');
    }

    function initResize() {
      $(_selector).resizable({ handles: 's' })
        .on('resize', function (e) { e.stopPropagation(); })
        .on('resizestop', function (e) { e.stopPropagation(); _chart.resize(); });
    }

    _chart.resize = function () {
      _chart.element()
        .width(_chart.width())
        .height(_chart.height());
      _chart._resizeSpecific();
      return _chart.render();
    };

    _chart.updateColors = function () {
      if (typeof _chart.element().colorDomain == 'function') {
        _chart.element()
          .colors(d3.scale.quantize().range(_dimensions[0].colors()))
          .colorDomain(_chart._niceDomain(_dimensions[0].crossfilterGroup(_extraMeasures), analytics.state.measure().id()));
      }
      return _chart;
    };

    _chart.delete = function () {
      dc.deregisterChart(_chart.element());
      $(_selector).empty();
    };

    /**
    #### abstract methods

    These methods are left for the children classes to implement.

    * charts.chart.**_resizeSpecific**() : called when the chart is resized
    * charts.chart.**_createDcElement**(): called to create the dc.js chart
    * charts.chart.**_initContainerSpecific**() : used to initialize elements aside from the dc.js chart
    * charts.chart.**_initChartSpecific**(): used to initialize the chart
    * charts.chart.**_updateChartSpecific**() : called when the chart is updated

    **/
    _chart._resizeSpecific        = function () {};
    _chart._createDcElement       = function () {};
    _chart._initContainerSpecific = function () {};
    _chart._initChartSpecific     = function () {};
    _chart._updateChartSpecific   = function () {};

    /**
    #### Internal functions

    * charts.chart.**initHeader**()
    * charts.chart.**initChartCommon**()
    * charts.chart.**updateHeader**()
    * charts.chart.**updateChartCommon**()
    * charts.chart.**displayChartMetaContainer**() : fill the header initialized with `initHeader`
    * charts.chart.**displayTip**() : add a tip icon in the chart's header
    * charts.chart.**displayPlay**(): add the play button in the chart's header
    * charts.chart.**displayCanDrillRoll**(): add an icon indicating if we can drill-down or roll-up on the chart
    * charts.chart.**displayLevels**(): add the display of the current level number as well as the total number of levels in the chart's header
    * charts.chart.**displayTitle**()
    * charts.chart.**displayParams**(): add the button to configure the chart in the chart's header
    * *[integer, integer]* charts.chart.**_niceDomain**(*crossfilter.group* crossfilterGroup, *data.measure* measure) : compute [min, max] values, from a crossfilter group and a measure, to generate the color scales
    **/
    function initHeader() {
      displayChartMetaContainer();
      displayTip();
      displayPlay();
      displayParams();
    }

    function initChartCommon() {
      _chart.element()
        .width(_chart.width())
        .height(optionsHeight())

        .on('filtered', function (chart, filter) { analytics.display._updateFilter(_chart.dimensions()[0], filter, chart.hasFilter(filter)); });

      // zoom callback
      if (typeof _chart.element().callbackZoomIn == 'function') {
        _chart.element()
          .callbackZoomIn(function (el, dcChartID, keys) { analytics.display.drillDown(_chart.dimensions()[0], el, dcChartID, keys); })
          .callbackZoomOut(function (dcChartID) { analytics.display.rollUp(_chart.dimensions()[0], dcChartID); });
      }

      // color chart
      if (typeof _chart.element().colors == 'function') {
        _chart.element()
          .colorCalculator(function (d) { return d.value ? _chart.element().colors()(d.value) : '#ccc'; });
      }
    }


    function updateHeader() {
      displayCanDrillRoll();
      displayLevels();
      displayTitle();
    }

    function updateChartCommon() {

      var dimension = _dimensions[0];
      var metadata  = dimension.getLastSlice();
      var format    = d3.format('.3s');

      _chart.element()
        .dimension(dimension.crossfilterDimension())
        .group    (dimension.crossfilterGroup(_extraMeasures))

        .label(function (d) {
          var key = d.key ? d.key : d.data.key;
          return metadata[key] ? metadata[key].caption : '';
        })
        .title(function (d) {
          var key = d.key ? d.key : d.data.key;
          var valText = analytics.state.measure().caption() + ': ' + (d.value       ? format(d.value)       : 0);
          var keyText = dimension.caption()                 + ': ' + (metadata[key] ? metadata[key].caption : '');
          return keyText + '\n' + valText;
        });

      _chart.updateColors();

      // sort
      switch(_chart.options().sort) {
        case 'key':
        _chart.element().ordering(function (d) { return  d.key !== undefined ? d.key : d.data.key;   });
        break;

        case 'valueasc':
        _chart.element().ordering(function (d) { return  d.value !== undefined ? d.value : d.data.value; });
        break;

        case 'valuedesc':
        _chart.element().ordering(function (d) { return d.value !== undefined ? -d.value : -d.data.value; });
        break;
      }

      // labels
      if (_chart.options().labels !== null) {
        _chart.element().renderLabel(_chart.options().labels);
      }
    }

    function displayChartMetaContainer () {
      $(_selector + ' .chart-header').html(
        '<div class="chart-meta">'+
        '<span class="chart-infos"></span><span class="chart-levels-icons"></span><span class="chart-levels"></span><span class="btn-params"></span><span class="chart-play"></span>'+
        '</div>'+
        '<div class="chart-title"></div>');
    }

    function displayTip () {
      if (_chart.params().displayTip) {
        var tip = analytics.display.getTip('chartType', _chart.type());
        if (tip) {
          var el = $('<span data-toggle="tooltip" class="chart-infos" data-placement="bottom" title="'+tip+'">'+
            '<i class="fa fa-nomargin fa-info-circle"></i></span>');

          $(_selector+' .chart-meta .chart-infos').replaceWith(el);
          el.tooltip({'container': 'body', 'html': true});
        }
      }
    }

    function displayPlay () {
      if (_chart.params().displayPlay) {
        var el = $('<span class="btn btn-xs btn-default"><i class="fa fa-nomargin fa-play"></i></span>');
        $(_selector+' .chart-meta .chart-play').replaceWith(el);
        el.click(function () {
          // change the button
          el.children().toggleClass('fa-play');
          el.children().toggleClass('fa-pause');

          if (_player === undefined) {
            _player = analytics.charts.player(_chart);
            _player.callback(function () {
              el.children().toggleClass('fa-play');
              el.children().toggleClass('fa-pause');

              _player = undefined;
            });
            _player.start();
          } else if (_player.running()) {
             _player.pause();
          } else {
             _player.start();
          }
        });
      }
    }

    function displayCanDrillRoll () {
      if (_chart.params().displayCanDrillRoll) {
        var el = $(_selector + ' .chart-meta .chart-levels-icons');
        if (el.html().length === 0) {
          el.html('<span class="fa fa-nomargin fa-caret-up"></span><span class="fa fa-nomargin fa-caret-down"></span>');
        }

        var caretDown = el.find('.fa-caret-down');
        var caretUp = el.find('.fa-caret-up');

        if (_dimensions[0].isRollPossible())
          caretUp.css('color', 'inherit');
        else
          caretUp.css('color', '#999999');

        if (_dimensions[0].isDrillPossible())
          caretDown.css('color', 'inherit');
        else
          caretDown.css('color', '#999999');
      }
    }

    function displayLevels () {
      if (_chart.params().displayLevels) {
        $(_selector + ' .chart-meta .chart-levels').html((_dimensions[0].currentLevel()+1)+'/'+(_dimensions[0].maxLevel()+1));
      }
    }

    function displayTitle () {
      if (_chart.params().displayTitle) {
        var measureTitle;
        var measureDescription = analytics.state.measure().description();
        var measureCaption = analytics.state.measure().caption();

        var dimensionTitle;
        var dimensionDescription = _dimensions[0].description();
        var dimensionCaption = _dimensions[0].caption();

        if (typeof measureDescription != 'undefined' && measureDescription != measureCaption) {
          measureTitle = $('<span data-toggle="tooltip" class="chart-infos" data-placement="bottom" title="'+
            measureDescription +
            '">' +
            measureCaption + ' </span>').tooltip({'container': 'body', 'html': true});
        } else {
          measureTitle = measureCaption;
        }

        if (typeof dimensionDescription != 'undefined' && dimensionDescription != dimensionCaption) {
          dimensionTitle = $('<span data-toggle="tooltip" class="chart-infos" data-placement="bottom" title="'+
            dimensionDescription +
            '">' +
            dimensionCaption + ' </span>').tooltip({'container': 'body', 'html': true});
        } else {
          dimensionTitle = dimensionCaption;
        }

        $(_selector + ' .chart-title').html(analytics.state.cube().caption() + ' &bull; ')
            .append(dimensionTitle).append(' &bull; ')
            .append(_dimensions[0].levels()[_dimensions[0].currentLevel()] + ' &bull; ')
            .append(measureTitle);
      }
    }

    function displayParams () {
      if (_chart.params().displayParams) {
        var el = $('<span class="btn-params btn btn-xs btn-default"><i class="fa fa-nomargin fa-cog"></i></span>');
        $(_selector+' .btn-params').replaceWith(el);
        el.click(function() { analytics.display._displayParamsForm(_chart); });
      }
    }

    _chart._niceDomain = function (crossfilterGroup, measure) {
      function getVal(d) {
        if (typeof measure == 'undefined' || typeof d[measure] == 'undefined')
          return d;
        else
          return d[measure];
      }

      var min = crossfilterGroup.order(function (d) {return -getVal(d);}).top(1)[0];
      var max = crossfilterGroup.order(function (d) {return  getVal(d);}).top(1)[0];

      if (getVal(min.value) !== undefined && getVal(max.value) !== undefined) {
        min = getVal(min.value);
        max = getVal(max.value);
        var nbDigitsMax = Math.floor(Math.log(max)/Math.LN10+1);
        min = Math.floor(min / Math.pow(10, nbDigitsMax - 2))*Math.pow(10, nbDigitsMax - 2);
        max = Math.ceil(max / Math.pow(10, nbDigitsMax - 2))*Math.pow(10, nbDigitsMax - 2);
        return [min, max];
      }

      return [0, 0];
    };

    return _chart;
  }

  charts_chart_nostatic.params = {
    nbDimensionsMin     : 1,
    nbDimensionsMax     : 1,
    nbExtraMeasuresMin  : 0,
    nbExtraMeasuresMax  : 0,
    displayTitle        : true,
    displayParams       : true,
    displayLevels       : true,
    displayCanDrillRoll : true,
    displayTip          : true,
    displayPlay         : false
  };

  charts_chart_nostatic.options = {
    sort            : null,
    labels          : null,
    playerTimeout   : 300,
    height          : 300,
    heightReference : "px"
  };

  charts_chart_nostatic.isPossibleDimension = function (dimension) {
    return true;
  };

  charts_chart_nostatic.isPossibleExtraMeasure = function (measure) {
    return true;
  };

  charts_chart_nostatic.arePossibleDimensionsSpecific = function (dimensions) {
    return true;
  };

  charts_chart_nostatic.arePossibleExtraMeasuresSpecific = function (measures) {
    return true;
  };


  function implementStaticAsNonStatic(chartConstructor) {

    var _newChartConstructor = function(selector, dimensions) {
      var _chart = chartConstructor(selector, dimensions);
      // add as non static all static variables & functions
      _chart._params                          = chartConstructor.params;
      _chart._options                         = JSON.parse(JSON.stringify(chartConstructor.options));
      _chart.isPossibleDimension              = _newChartConstructor.isPossibleDimension;
      _chart.isPossibleExtraMeasure           = _newChartConstructor.isPossibleExtraMeasure;
      _chart.arePossibleDimensions            = _newChartConstructor.arePossibleDimensions;
      _chart.arePossibleExtraMeasures         = _newChartConstructor.arePossibleExtraMeasures;
      _chart.arePossibleDimensionsSpecific    = _newChartConstructor.arePossibleDimensionsSpecific;
      _chart.arePossibleExtraMeasuresSpecific = _newChartConstructor.arePossibleExtraMeasuresSpecific;
      return _chart;
    };

    _newChartConstructor.arePossibleDimensions = function (dimensions) {
      for (var i in dimensions)
        if (!_newChartConstructor.isPossibleDimension(dimensions[i]))
          return false;

      return _newChartConstructor.arePossibleDimensionsSpecific(dimensions) &&
        dimensions.length >= _newChartConstructor.params.nbDimensionsMin &&
        dimensions.length <= _newChartConstructor.params.nbDimensionsMax;
    };
    _newChartConstructor.arePossibleExtraMeasures = function (measures) {
      for (var i in measures)
        if (!_newChartConstructor.isPossibleExtraMeasure(measures[i]))
          return false;

      return _newChartConstructor.arePossibleDimensionsSpecific(measures) &&
        measures.length >= _newChartConstructor.params.nbExtraMeasuresMin &&
        measures.length <= _newChartConstructor.params.nbExtraMeasuresMax;
    };

    // expose static functions on the new constructor, either comming from the specific chart or the common chart
    _newChartConstructor.params                           = chartConstructor.params;
    _newChartConstructor.options                          = chartConstructor.options;
    _newChartConstructor.isPossibleDimension              = chartConstructor.isPossibleDimension              || charts_chart_nostatic.isPossibleDimension;
    _newChartConstructor.isPossibleExtraMeasure           = chartConstructor.isPossibleExtraMeasure           || charts_chart_nostatic.isPossibleExtraMeasure;
    _newChartConstructor.arePossibleDimensionsSpecific    = chartConstructor.arePossibleDimensionsSpecific    || charts_chart_nostatic.arePossibleDimensionsSpecific;
    _newChartConstructor.arePossibleExtraMeasuresSpecific = chartConstructor.arePossibleExtraMeasuresSpecific || charts_chart_nostatic.arePossibleExtraMeasuresSpecific;


    return _newChartConstructor;
  }

  var charts_chart = implementStaticAsNonStatic(charts_chart_nostatic);

  charts_chart.extend = function (chartConstructor) {

    // coy static maps options & params that are not overriden
    var key;
    if (typeof chartConstructor.params == 'undefined')
      chartConstructor.params = JSON.parse(JSON.stringify(charts_chart_nostatic.params));
    else
      for (key in charts_chart_nostatic.params)
        if (typeof chartConstructor.params[key] == 'undefined')
          chartConstructor.params[key] = charts_chart_nostatic.params[key];

    if (typeof chartConstructor.options == 'undefined')
      chartConstructor.options = JSON.parse(JSON.stringify(charts_chart_nostatic.options));
    else
      for (key in charts_chart_nostatic.options)
        if (typeof chartConstructor.options[key] == 'undefined')
          chartConstructor.options[key] = charts_chart_nostatic.options[key];

    // embed the constructor in another constructor that will do the inheritance tasks
    var _newChartConstructor = implementStaticAsNonStatic(chartConstructor);

    return _newChartConstructor;
  };

  return charts_chart;
})();

/**
## analytics.charts.**map** class

This class represents a geo-choropleth map and inherits from analytics.charts.**chart**.

**/
analytics.charts.map = (function () {
  var map = function (selector, dimensions) {

    var _chart = analytics.charts.chart(selector, dimensions);

    //_chart.arePossibleDimensionsSpecific = analytics.charts.map.arePossibleDimensionsSpecific;

    _chart.type = function() {
      return "map";
    };

    _chart._initContainerSpecific = function () {
    };

    _chart._createDcElement = function () {
      _chart._element = dc.geoChoroplethChart(_chart.selector());
    };

    _chart._initChartSpecific = function () {
      _chart.element()
        .colorCalculator(function (d) { return d ? _chart.element().colors()(d) : '#ccc'; })

        .projection(d3.geo.mercator());

      var div = d3.select(_chart.selector()).append("div")
        .attr("id", analytics.csts.css.zoom);

      div.append("a")
        .attr("class","btn btn-primary fa fa-search-plus")
        .attr("href","#")
        .on("click", function () { _chart.element().addScale(1.35, 700); return false; });
      div.append("a")
        .attr("class","btn btn-primary fa fa-search-minus")
        .attr("href","#")
        .on("click", function () { _chart.element().addScale(1/1.35, 700); return false; });
    };

    _chart._updateChartSpecific = function () {
      var dimension = _chart.dimensions()[0];
      var members = dimension.getLastSlice();
      var spatialData = transformSpatialMetadata(members, dimension.getGeoProperty().id());

      /// update layers
      var layers = _chart.element().geoJsons();
      var i;
      // remove layers > current level (if so, we most probably rolled up)
      for (i = dimension.currentLevel(); i < layers.length; i++) {
        _chart.element().removeGeoJson(layers[i].name);
      }

      var getId = function (d) {
        return d.id;
      };

      // add layers < current level (if so, we loaded a saved state)
      for (i = layers.length; i < dimension.currentLevel(); i++) {
        var oldMembers = dimension.getSlice(i);
        var oldSpatialData = transformSpatialMetadata(oldMembers, dimension.getGeoProperty().id());
        _chart.element().overlayGeoJson(oldSpatialData, "geolayer-"+i, getId);
      }

      // add new layer
      _chart.element().overlayGeoJson(spatialData, "geolayer-"+dimension.currentLevel(), getId);

      // display data
      var format = d3.format(".3s");

      _chart.element()
        .dimension(dimension.crossfilterDimension())
        .group(dimension.crossfilterGroup())
        .setNbZoomLevels(dimension.maxLevel() + 1)

        .title(function (d) {
          if (members[d.key] === undefined) {
            return (d.value ? format(d.value) : '');
          }

          return members[d.key].caption + "\nValue: " + (d.value ? format(d.value) : 0); // + "[unit]";
        });
    };

    _chart.resizeSpecific = function () {
      var width = $(_chart.selector()).width() - 30;
      var height = $(_chart.selector()).height();

      _chart.element()
        .width(width)
        .height(height);
    };

    /**
    #### *object[]* **transformSpatialMetadata**(data, geoProperty)
    Transform metadata from the geographical dimension to a list of GeoJSON.

    * *data*: Metadata from the Query class
    * *geoProperty*: id of the property containing the geoJSON in the data

    Returns a list of GeoJSON files with captions of the areas as the "name" property in each GeoJSON

    **/
    function transformSpatialMetadata (data, geoProperty) {

      var out = [];
      for (var el in data) {
        var outEl = $.extend({}, data[el][geoProperty]);
        outEl.id = el;
        outEl.properties = {"name" : data[el].caption};

        out.push(outEl);
      }
      return out;
    }

    return _chart;
  };

  map.options = {
    sort            : null,
    height          : 0.7,
    heightReference : 'columnHeightRatio'
  };

  map.isPossibleDimension = function (dimension) {
    return dimension.type() == "Geometry";
  };

  return analytics.charts.chart.extend(map);
})();

/**
## analytics.charts.**pie** class

This class represents a pie chart and inherits from analytics.charts.**chart**.

**/
analytics.charts.pie = (function () {
  var pieChart = function (selector, dimensions) {

    var _chart = analytics.charts.chart(selector, dimensions);

    _chart.type = function() {
      return "pie";
    };

    _chart._createDcElement = function () {
      _chart._element = dc.pieChart(_chart.selector()+" .chart-container");
    };

    _chart._initChartSpecific = function () {
      _chart.element()
        .minAngleForLabel(0.3)
        .ordering(function (d) { return d.value; });
    };

    _chart._resizeSpecific = function () {
      _chart.element()
        .radius(0); // force computation of pie size, useful when resizing
    };

    return _chart;
  };

  pieChart.options = {
    sort   : "valueasc",
    labels : true,
  };

  return analytics.charts.chart.extend(pieChart);
})();

/**
## analytics.charts.**bar** class

This class represents a bar chart and inherits from analytics.charts.**chart**.

**/
analytics.charts.bar = (function () {
  var barChart = function (selector, dimensions) {

    var _chart = analytics.charts.chart(selector, dimensions);

    _chart.type = function() {
      return "bar";
    };

    _chart._createDcElement = function () {
      _chart._element = dc.barChart(_chart.selector()+" .chart-container");
    };

    _chart._initChartSpecific = function () {
      _chart.element()
        .margins({top: 10, right: 10, bottom: 125, left: 40})
        .renderlet(function (chart) {
                    chart.selectAll("g.x text")
                      .attr('dx', '-50')
                      .attr('transform', "translate(-20,0)")
                      .attr('transform', "rotate(-50)");
                })
        .transitionDuration(500)
        .centerBar(false)
        .gap(1)
        .elasticY(true)
        .elasticX(true);
    };

    _chart._updateChartSpecific = function () {
      var metadata = _chart.dimensions()[0].getLastSlice();

      var format = d3.format(".3s");
      _chart.element()
        .x(d3.scale.ordinal().domain(d3.keys(metadata)))
        .xUnits(dc.units.ordinal)
        .title(function (d) {
          var key = d.key ? d.key : d.data.key;
          if (metadata[key] === undefined) return (d.value ? format(d.value) : '');
          return metadata[key].caption + "\nValue: " + (d.value ? format(d.value) : 0); // + "[unit]";
        });
      _chart.element().xAxis().tickFormat(function(d) {return metadata[d].caption;});
      _chart.element().yAxis().tickFormat(function(d) { return format(d);});
    };

    return _chart;
  };

  barChart.options = {
    sort : "valueasc"
  };

  return analytics.charts.chart.extend(barChart);
})();

/**
## analytics.charts.**timeline** class

This class represents a timeline and inherits from analytics.charts.**bar**.

The timeline is a bar chart which:

* Is limited to the Time dimension
* Has play capabilities enabled

**/
analytics.charts.timeline = (function () {
  var timelineChart = function (selector, dimensions) {

    var _chart = analytics.charts.bar(selector, dimensions);

    _chart.type = function() {
      return "timeline";
    };

    return _chart;
  };

  timelineChart.options = {
    sort            : null,
    height          : 0.3,
    heightReference : 'columnHeightRatio'
  };

  timelineChart.params = {
    displayPlay : true
  };

  timelineChart.isPossibleDimension = function (dimension) {
    return dimension.type() == "Time";
  };

  return analytics.charts.chart.extend(timelineChart);
})();

/**
## analytics.charts.**table** class

This class represents a data table and inherits from analytics.charts.**chart**.

**/
analytics.charts.table = (function () {
  var table = function (selector, dimensions) {

    var _chart = analytics.charts.chart(selector, dimensions);

    _chart.type = function() {
      return "table";
    };

    _chart._initContainerSpecific = function () {
      d3.select(_chart.selector()).attr('class', 'chart dc-chart');
      d3.select(_chart.selector()).append('table');
      d3.select(_chart.selector() + ' table').html("<thead><tr><th>Element</th><th>Value</th></tr></thead>");
    };

    _chart._createDcElement = function () {
      _chart._element = dc.dataTable(_chart.selector()+" table");
    };

    _chart._initChartSpecific = function () {
      var dimension = _chart.dimensions()[0];
      var members = dimension.getLastSlice();
      var format = d3.format(".3s");

      _chart.element()
        .size(Infinity)
        .columns([
          function(d){
            var key = d.key ? d.key : d.data.key;
            if (members[key] === undefined) {
              return key;
            }
            return members[key].caption;
          },
          function(d){ return (d.value ? format(d.value) : 0); }
         ]);
    };

    _chart._updateChartSpecific = function () {
      var dimension = _chart.dimensions()[0];

      $(_chart.selector() + " table th:first").html(dimension.caption());
      $(_chart.selector() + " table th:last").html(analytics.state.measure().caption());

      _chart.element()
        .dimension(dimension.crossfilterGroup())
        .group(function(d){return "";});

      sortRows(_chart.options().sort);
    };

    function sortRows (method) {
      switch(method) {
          case "key":
            _chart.element()
              .order(d3.ascending)
              .sortBy(function(d) {return d.key; });
          break;

          case "valueasc":
            _chart.element()
              .order(d3.descending)
              .sortBy(function(d) { return -d.value; });
          break;

          default: // valuedesc
            _chart.element()
              .order(d3.descending)
              .sortBy(function(d) { return d.value; });
            _chart.setOption("sort", "valuedesc");
          break;
      }
    }

    return _chart;
  };

  table.options = {
    sort : "valuedesc"
  };

  return analytics.charts.chart.extend(table);
})();

/**
## analytics.charts.**wordcloud** class

This class represents a wordcloud and inherits from analytics.charts.**chart**.

**/
analytics.charts.wordcloud = (function () {
  var wordcloudChart = function (selector, dimensions) {

    var _chart = analytics.charts.chart(selector, dimensions);

    _chart.type = function() {
      return "wordcloud";
    };

    _chart._createDcElement = function () {
      _chart._element = dc.wordCloudChart(_chart.selector()+" .chart-container");
    };

    _chart._initChartSpecific = function () {
      _chart.element()
        .colorCalculator(function (d) { return d ? _chart.element().colors()(d) : '#ccc'; });
    };

    return _chart;
  };

  return analytics.charts.chart.extend(wordcloudChart);
})();

/**
## analytics.charts.**wordcloudWithLegend** class

This class represents a timeline and inherits from analytics.charts.**chart**.

The wordcloudWithLegend is a wordcloud chart which:

* Has a color legend
* Can't be configured

This chart is intended to be used in a dimension list.

**/
analytics.charts.wordcloudWithLegend = (function () {
  var wordcloudChart = function (selector, dimensions) {

    var _chart = analytics.charts.chart(selector, dimensions);

    _chart.type = function() {
      return "wordcloudWithLegend";
    };

    _chart._createDcElement = function () {
      _chart._element = dc.wordCloudChart(_chart.selector()+" .chart-container");
    };

    _chart._initChartSpecific = function () {
      _chart.element()
        .showLegend(_chart.selector()+'-legend')
        .colorCalculator(function (d) { return d ? _chart.element().colors()(d) : '#ccc'; });
    };

    _chart._initContainerSpecific = function () {
      $(_chart.selector()).append('<div class="wordcloud">'+
          '<div class="wordcloud-chart" id="'+_chart.selectorName()+'"></div>'+
          '<div class="wordcloud-legend" id="'+_chart.selectorName()+'-legend"></div>'+
        '</div>');
    };

    return _chart;
  };

  wordcloudChart.params = {
    displayParams : false
  };

  return analytics.charts.chart.extend(wordcloudChart);
})();

/**
## analytics.charts.**bubble** class

This class represents a bubble chart and inherits from analytics.charts.**chart**.

**/
analytics.charts.bubble = (function () {
  var bubbleChart = function (selector, dimensions) {

    var _chart = analytics.charts.chart(selector, dimensions);

    _chart.type = function() {
      return "bubble";
    };

    _chart._createDcElement = function () {
      _chart._element = dc.bubbleChart(_chart.selector()+" .chart-container");
    };

    _chart._initChartSpecific = function () {

      var format = d3.format('.3s');

      _chart.element()
        .colorCalculator(function (d) {
          var measureId = analytics.state.measure().id();
          return d.value[measureId] ? _chart.element().colors()(d.value[measureId]) : '#ccc';
        })

        .margins({top: 0, right: 0, bottom: 30, left: 45})

        .elasticY(true)
        .elasticX(true)

        .renderHorizontalGridLines(true)
        .renderVerticalGridLines(true)

        .maxBubbleRelativeSize(0.075);

      _chart.element().yAxis().tickFormat(function (s) { return format(s); });
      _chart.element().xAxis().tickFormat(function (s) { return format(s); });
    };

    _chart._updateChartSpecific = function () {

      var extraMeasures = _chart.extraMeasures(); // [x, y]
      var measures = [extraMeasures[0], extraMeasures[1], analytics.state.measure()]; // [x, y, r]
      var dimension = _chart.dimensions()[0];
      var metadata  = dimension.getLastSlice();
      var cfGroup = dimension.crossfilterGroup(extraMeasures);
      var format = d3.format(".3s");

      _chart.element()
        .keyAccessor(function (p)         { return p.value[measures[0].id()]; })
        .valueAccessor(function (p)       { return p.value[measures[1].id()]; })
        .radiusValueAccessor(function (p) { return p.value[measures[2].id()]; })

        .x(d3.scale.linear().domain(_chart._niceDomain(cfGroup, measures[0].id())))
        .y(d3.scale.linear().domain(_chart._niceDomain(cfGroup, measures[1].id())))
        .r(d3.scale.linear().domain(_chart._niceDomain(cfGroup, measures[2].id())))

        .xAxisLabel(measures[0].caption())
        .yAxisLabel(measures[1].caption())

        .xAxisPadding(_chart._niceDomain(cfGroup, measures[0].id())[0]*0.1)
        .yAxisPadding(_chart._niceDomain(cfGroup, measures[1].id())[0]*0.1)

        .minRadiusWithLabel(14)

        .title(function (d) {
          var key = d.key ? d.key : d.data.key;
          if (metadata[key] === undefined) return (d.value ? format(d.value) : '');
          var out = dimension.caption() + ': ' + (metadata[key] ? metadata[key].caption : '') + "\n" +
                    measures[0].caption() + ": " + (d.value[measures[0].id()] ? format(d.value[measures[0].id()]) : 0) + "\n";
          if (!measures[1].equals(measures[0]))
            out +=  measures[1].caption() + ": " + (d.value[measures[1].id()] ? format(d.value[measures[1].id()]) : 0) + "\n";
          if (!measures[2].equals(measures[0]) && !measures[2].equals(measures[1]))
            out +=  measures[2].caption() + ": " + (d.value[measures[2].id()] ? format(d.value[measures[2].id()]) : 0) + "\n";
          return out;
        });
    };

    return _chart;
  };

  bubbleChart.options = {
    labels : true,
    height : 500
  };

  bubbleChart.params = {
    nbExtraMeasuresMin  : 2,
    nbExtraMeasuresMax  : 2
  };

  return analytics.charts.chart.extend(bubbleChart);
})();


    ////////////////////////////////////////

    return analytics;
  }

  if(typeof define === "function" && define.amd) {
    define(["dc"], _analytics);
  } else if(typeof module === "object" && module.exports) {
    module.exports = _analytics(dc);
  } else {
    this.analytics = _analytics(dc);
  }
}
)();
