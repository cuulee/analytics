/**
 * Retrieve metadata from the JS API provided with solap4py
 * Use the "query" singleton provided by this API as a dependency
 * This assume you loaded the files of the API elsewhere and use the init function of this Query
 *
 * As we don't have the queryAPI yet, we are using a mock avaliable in QueryAPIFixture.js
 * @namespace
 * @author Thomas Szymanski <develop@tszymanski.com>
 */
var Query = {

  queryAPI : null,

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
   * Initialize the QueryAPI dependency of Query
   *
   * @public
   * @param {Object} queryApi the api
   */
  init : function (queryApi) {
    if (queryApi === undefined)
      throw new Query.QueryAPINotProvidedError();
    this.queryAPI = queryApi;
  },

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

    if (this.queryAPI === null)
      throw new Query.QueryAPINotProvidedError();

    if (this.isCacheEmpty()) {
      var replySchemas = this.queryAPI.explore([]);
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

    if (this.queryAPI === null)
      throw new Query.QueryAPINotProvidedError();

    if (!this.isSchemaInCache(idSchema))
      this.getSchemas();

    if (this.isCubesListEmpty(idSchema)) {
      var replyCubes = this.queryAPI.explore(new Array(idSchema));
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
    if (this.queryAPI === null)
      throw new Query.QueryAPINotProvidedError();

    if (!this.isCubeInCache(idSchema, idCube))
      this.getCubes(idSchema);

    var dimensions;
    var dimensionsReturn = {};

    if (this.isDimensionsListEmpty(idSchema, idCube)) {
      var replyDimensions = this.queryAPI.explore(new Array(idSchema, idCube));
      this.checkAPIResponse(replyDimensions);

      for (var key in replyDimensions.data) {
        this.cacheDimension(idSchema, idCube, key, replyDimensions.data[key].type, replyDimensions.data[key].caption);
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
    if (this.queryAPI === null)
      throw new Query.QueryAPINotProvidedError();

    if (!this.isDimensionInCache(idSchema, idCube, idDimension))
      this.getDimensions(idSchema, idCube);

    if (this.isHierarchiesListEmpty(idSchema, idCube, idDimension)) {
      var replyHierarchies = this.queryAPI.explore(new Array(idSchema, idCube, idDimension));
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
    if (this.queryAPI === null)
      throw new Query.QueryAPINotProvidedError();

    if (!this.isHierarchyInCache(idSchema, idCube, idDimension, idHierarchy))
      this.getHierarchies(idSchema, idCube, idDimension);

    if (this.isLevelsListEmpty(idSchema, idCube, idDimension, idHierarchy)) {
      var reply = this.queryAPI.explore(new Array(idSchema, idCube, idDimension, idHierarchy), true);
      this.checkAPIResponse(reply);

      var out = [];
      for (var index=0; index < reply.data.length; index++) {
        this.cacheLevel(idSchema, idCube, idDimension, idHierarchy, reply.data[index].id, reply.data[index].caption);
        out.push(reply.data[index].caption);

        // Cache properties into the current level
        for(var key in reply.data[index]["list-properties"]) {
          this.cacheProperty(idSchema, idCube, idDimension, idHierarchy, index, key, reply.data[index]["list-properties"][key].caption, reply.data[index]["list-properties"][key].type);
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
    if (this.queryAPI === null)
      throw new Query.QueryAPINotProvidedError();

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
      reply = this.queryAPI.explore(new Array(idSchema, idCube, idDimension, idHierarchy, idLevel), withProperties);
    } else {
      reply = this.queryAPI.explore(new Array(idSchema, idCube, idDimension, idHierarchy, idLevel, parentMember), withProperties, descendingLevel);
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
    if (this.queryAPI === null)
      throw new Query.QueryAPINotProvidedError();

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

    var reply = this.queryAPI.explore(new Array(idSchema, idCube, idDimension, idHierarchy, idLevel, membersIds), withProperties, 0);
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
    this.queryAPI.drill(idCube);
  },

  /**
   * Add the given measure to the set of measures you want to work on
   *
   * @public
   * @param {string} idMeasure
   */
  push : function(idMeasure) {
    this.queryAPI.push(idMeasure);
  },

  /**
   * Remove the given measure to the set of measures you want to work on
   *
   * @public
   * @param {string} idMeasure
   */
  pull : function(idMeasure) {
    this.queryAPI.pull(idMeasure);
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
    this.queryAPI.slice(idHierarchy, members, range);
  },

  /**
   * Add dice behavior to a list of hierarchies, that is to say those hierarchies
   * won't be completely aggregated.
   *
   * @public
   * @param {Array<String>} hierarchies
   */
  dice : function (hierarchies) {
    this.queryAPI.dice(hierarchies);
  },

  /**
   * Remove the given hierarchy of the selected agregates
   *
   * @public
   * @param {string} idHierarchy
   */
  project : function(idHierarchy) {
    this.queryAPI.project(idHierarchy);
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
    this.queryAPI.filter(idHierarchy, members, range);
  },

  /**
   * Executes the request. This is a synchronous operation
   *
   * @return {Object} the structured reply
   */
  execute : function() {

    var response = this.queryAPI.execute();

    this.checkAPIResponse(response);
    return response.data;
  },

  /**
   * Flush all the request
   */
  clear : function() {
    this.queryAPI.clear();
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
  cacheCube : function(idSchema, idCube, caption) {
    if (!this.isCubeInCache(idSchema, idCube)) {
      if (this.metadatas.schemas[idSchema].cubes === undefined)
        this.metadatas.schemas[idSchema].cubes = {};

        this.metadatas.schemas[idSchema].cubes[idCube] = {"caption" : caption};
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
  cacheDimension : function(idSchema, idCube, idDimension, type, caption) {
    if (!this.isAllowedDimensionType(type))
      throw new Query.IllegalDimensionTypeError(type+" is not a valid dimension type!");

    if (!this.isDimensionInCache(idSchema, idCube, idDimension)) {
      if (this.metadatas.schemas[idSchema].cubes[idCube].dimensions === undefined)
        this.metadatas.schemas[idSchema].cubes[idCube].dimensions = {};

        this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension] = {"type" : type, "caption" : caption};
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
  cacheHierarchy : function(idSchema, idCube, idDimension, idHierarchy, caption) {
    if (!this.isHierarchyInCache(idSchema, idCube, idDimension, idHierarchy)) {
      if (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies === undefined)
        this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies = {};

        this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy] = {"caption" : caption};
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
  cacheLevel : function(idSchema, idCube, idDimension, idHierarchy, idLevel, caption) {
    if (!this.isLevelInCache(idSchema, idCube, idDimension, idHierarchy, idLevel)) {
      if (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels === undefined)
        this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels = [];

        this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels.push({"id" : idLevel, "caption" : caption});
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
  cacheProperty : function(idSchema, idCube, idDimension, idHierarchy, indexLevel, idProperty, caption, type) {
    if (!this.isPropertyInCache(idSchema, idCube, idDimension, idHierarchy, indexLevel, idProperty)) {
      if (this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties === undefined)
        this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties = {};

        this.metadatas.schemas[idSchema].cubes[idCube].dimensions[idDimension].hierarchies[idHierarchy].levels[indexLevel].properties[idProperty] = {"caption" : caption, "type" : type};
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
