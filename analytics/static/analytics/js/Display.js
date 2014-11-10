var Display = {

  /**
   * schema, cube, measure represents the current measure shown
   *
   * @private
   */
  schema : null,
  cube : null,
  measure : null,
  measuresLoaded : [],

  /**
   * Contains the list of the slices done on the dimensions. See example for scheme of each element.
   *
   * @example
   *   <idDimension> : {
   *      'caption' : caption, // caption of the dimension
   *      'hierarchy' : hierarchy, // current hierarchy
   *      'membersStack' : [], // stack of all slice done on this hierarchy
   *      'membersSelected' : [], // list of selected elements on the screen for the last level of the stack
   *      'aggregate' : false, // the dimension is to aggregate
   *      'properties' : false, // do we need to get the properties for this dimension ?
   *      'crossfilter' : undefined, // crossfilter element for this dimension
   *      'crossfilterGroup' : undefined // crossfilter element for the group of this dimension
   *   }
   *
   * @private
   */
  dimensions : {},

  /**
   * Current charts list describing their parameters and their state. See example for scheme of each element.
   *
   * @example
   *  'selector' : '#map', // CSS selector to get HTML element containing the chart
   *  'type' : 'map', // type of chart
   *  'element' : <dc element>, // dc.js element
   *  'dimensions' : ["geography"], // dimensions shown of the axes of the chart
   *  'sort': "valueasc" // sorting data by value ascending("valueasc"), by value descending("valuedesc") or by key ("key")  
   *  'options' : {"geoProperty" : "geom"}, // options of the chart if needed
   *
   * @private
   */

  charts : {
    'map' : {
      'selector' : '#map',
      'type' : 'map',
      'element' : undefined,
      'dimensions' : [],
      'sort' : undefined,
      'lbChoice' : true,
      'options' : {"geoProperty" : undefined}
    },
    'timeline' : {
      'selector' : '#timeline',
      'type' : 'timeline',
      'element' : undefined,
      'dimensions' : [],
      'sort' : undefined,
      'lbChoice' : true,
      'options' : {}
    },
    'rightChart' : {
      'selector' : '#rightChart1',
      'type' : 'pie',
      'element' : undefined,
      'dimensions' : [],
      'sort' : undefined,
      'lbChoice' : true,
      'options' : {}
    },
    'barChart' : {
      'selector' : '#rightChart2',
      'type' : 'bar',
      'element' : undefined,
      'dimensions' : [],
      'sort' : undefined,
      'lbChoice' : true,
      'options' : {}
    },
    'table' : {
      'selector' : '#table',
      'type' : 'table',
      'element' : undefined,
      'dimensions' : [],
      'sort' : undefined,
      'lbChoice' : true,
      'options' : {}
    }
  },

  /**
   * Options for the display
   *
   * @private
   */
  options : {
    colors : ["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"],
    cloudsSelector : '#clouds',
    zoomId : 'zoom',
    resetSelector : '#reset',
    factSelector : '#fact-selector',
    factCubesIntro : 'Cubes available:',
    factMeasuresIntro : 'Measures available:'
  },

  /**
   * Crossfilter dataset curently used on charts
   *
   * @private
   */
  dataCrossfilter : null,

  /**
   * Resizable columns object
   *
   * @private
   */
  resizableColumns : null,

  /**
   * Callback function to call when changing the cube and measure to display
   *
   * @private
   * @param {string} cube
   * @param {string} measure
   */
  setCubeAndMeasureCallback : function (cube, measure) {

    // changing cube = reset all
    if (cube != this.cube) {
      this.setCubeAndMeasure(cube, measure);
      this.resetStack();
      this.resetWordClouds();
      this.initMetadata();
      this.getData();
      this.displayCharts(true);
    }
    else {
      this.setMeasure(measure);
      this.getData();
      this.displayCharts();
    }

  },

  /**
   * Set the cube and measure curently used
   *
   * @private
   * @param {string} cube
   * @param {string} measure
   */
  setCubeAndMeasure : function (cube, measure) {

    // changing cube = reset all
    if (cube != this.cube) {
      Query.clear();
      Query.drill(cube);
      this.cube = cube;
    }

    // change measure
    this.setMeasure(measure);
  },

  /**
   * Set the measure curently used
   *
   * @private
   * @param {string} measure
   */
  setMeasure : function (measure) {

    Query.pull(this.measure);
    Query.push(measure);
    this.measure = measure;
  },

  /**
   * Get the list of currently sliced dimensions
   *
   * @private
   * @return {Array<string>} list of dimensions id
   */
  getDimensions : function () {

    return Object.keys(this.dimensions);
  },

  /**
   * Get the hierarchy of a dimension
   *
   * @private
   * @param {string} dimension
   * @return {string} hierarchy used
   */
  getDimensionHierarchy : function (dimension) {
    if (this.dimensions[dimension] === undefined) {
      return null;
    }

    return this.dimensions[dimension].hierarchy;
  },

  /**
   * Get the caption of a dimension
   *
   * @private
   * @param {string} dimension
   * @return {string} caption
   */
  getDimensionCaption : function (dimension) {
    if (this.dimensions[dimension] === undefined) {
      return null;
    }

    return this.dimensions[dimension].caption;
  },

  /**
   * Get the current shown level of a dimension
   *
   * @private
   * @param {string} dimension
   * @return {int|null} current shown level
   */
  getDimensionCurrentLevel : function (dimension) {
    if (this.dimensions[dimension] === undefined) {
      return null;
    }

    return this.dimensions[dimension].membersStack.length - 1;
  },

  /**
   * Do a slice on a dimension and add it to the slice
   *
   * @private
   * @param {string} dimension
   * @param {string} caption
   * @param {string} hierarchy
   * @param {int} level
   * @param {Object} members list of members and informations comming from Query
   * @param {boolean} properties
   */
  addSliceToStack : function (dimension, caption, hierarchy, level, members, properties) {

    if (this.dimensions[dimension] === undefined) {
      this.dimensions[dimension] = {
        'caption' : caption,
        'hierarchy' : hierarchy,
        'membersStack' : [],
        'membersSelected' : [],
        'aggregate' : false,
        'properties' : false,
        'crossfilter' : undefined,
        'crossfilterGroup' : undefined
      };
    }

    this.dimensions[dimension].membersStack[level] = members;

    if (properties !== undefined) {
      this.dimensions[dimension].properties = properties;
    }
  },

  /**
   * Get the current slice on a dimension. See example for return scheme.
   *
   * @example
   * {
   *   "properties" : true | false,  // do we use properties
   *   "level" :      2,             // current level
   *   "members" :    {              // object describing members comming from DB
   *     <memberId> : {"caption" : <memberCaption>, <propertyId1> : <value>, <propertyId2> : <value>},
   *     <memberId> : {"caption" : <memberCaption>, <propertyId1> : <value>, <propertyId2> : <value>},
   *     ...
   *   }
   * }
   *
   * @private
   * @param {string} dimension
   * @param {string} [level] - the level of the slice you want, specify only if you don't want the current slice
   * @return {Object} slice
   */
  getSliceFromStack : function (dimension, level) {

    if (this.dimensions[dimension] === undefined || level !== undefined && level > this.dimensions[dimension].membersStack.length - 1) {
      return null;
    }

    if (level === undefined) {
      level = this.dimensions[dimension].membersStack.length - 1;
    }

    return {
      "properties" : this.dimensions[dimension].properties,
      "level" :      level,
      "members" :    this.dimensions[dimension].membersStack[level]
    };
  },

  /**
   * Remove the current slice of a dimension from the stack and goes back to the previous one
   *
   * @private
   * @param {string} dimension
   * @return {Object} slice removed
   */
  removeLastSliceFromStack : function (dimension) {

    // get slicing infos
    var properties = this.dimensions[dimension].properties;
    var level = this.dimensions[dimension].membersStack.length - 1;
    var members = this.dimensions[dimension].membersStack.pop();

    // remove sliced dimension if removing first level slicing
    if (level === 0) {
      delete this.dimensions[dimension];
    }

    // return remove slicing just in case...
    return {
      "properties" : properties,
      "level" : level,
      "members" : members
    };

  },

  /**
   * Get the number of crossed members that is to say the number of possible combinations of members
   *
   * @private
   * @return {int} number of combinations
   *
   */
  numberOfCrossedMembers: function () {
    var nb = 1;
    for (var dimension in this.dimensions) {
      if (!this.isAggregated(dimension)) {
        var slice = this.getSliceFromStack(dimension);
        nb *= Object.keys(slice.members).length;
      }
    }
    return nb;
  },

  /**
   * Indicate if we should use client or server side aggregates.
   *
   * @private
   * @return {boolean} true if client side, false if server side
   *
   */
  isClientSideAggrPossible : function () {
    return this.numberOfCrossedMembers() < 20000;
  },

  /**
   * Reset the stack
   *
   * @private
   */
  resetStack : function () {

    // remove slices
    this.dimensions = {};

    // remove dimension elements
    for (var chartID in this.charts) {
      this.charts[chartID].dimensions = [];
    }
  },

  /**
   * Flag the dimension whose members are to aggregate
   *
   * @private
   * @param {string} dimension
   */
  aggregateDimension : function (dimension) {
    this.dimensions[dimension].aggregate = true;
  },

  /**
   * Flag the dimension whose members are to deaggregate
   *
   * @private
   * @param {string} dimension
   */
  deaggregateDimension : function (dimension) {
    this.dimensions[dimension].aggregate = false;
  },

  /**
   * Indicate if a dimension is aggregated
   *
   * @private
   * @param {string} dimension
   */
  isAggregated : function (dimension) {
    return this.dimensions[dimension].aggregate;
  },

  /**
   * Get the crossfilter objects describing the dimension and the group for the dimension. See example for scheme.
   *
   * @example
   * {
   *    'dimension' : <crossfilter dimension>,
   *    'group' : <crossfilter group>,
   * }
   *
   * @private
   * @param {string} dimension
   * @param {Array} [measures=[this.measure]] - list of measures we want to aggregate. By default it is only the currently selected measure.
   * @return {Object} dimension and group
   */
  getCrossfilterDimensionAndGroup : function (dimension, measures) {

    var that = this;

    if (this.dimensions[dimension].crossfilter === undefined) {
      this.dimensions[dimension].crossfilter = this.dataCrossfilter.dimension(function(d) { return d[dimension]; });
    }

    var out = {
      "dimension" : this.dimensions[dimension].crossfilter,
      "group" : undefined
    };

    if (measures === undefined) {
      if (this.dimensions[dimension].crossfilterGroup === undefined) {
        this.dimensions[dimension].crossfilterGroup = this.dimensions[dimension].crossfilter.group().reduceSum(function(d) { return d[that.measure]; });
      }
      out.group = this.dimensions[dimension].crossfilterGroup;
    }

    // if we have a custom list of measures, we compute the group
    else {
      measureToGroup = [this.measure];
      for (var i in measures)
        if (measureToGroup.indexOf(measures[i]) < 0)
          measureToGroup.push(measures[i]);

      out.group = this.dimensions[dimension].crossfilter.group().reduce(
        function (p, v) {
          for (var i in measureToGroup)
            p[measureToGroup[i]] += v[measureToGroup[i]];
          return p;
        },
        function (p, v) {
          for (var i in measureToGroup)
            p[measureToGroup[i]] -= v[measureToGroup[i]];
          return p;
        },
        function () {
          var p = {};
          for (var i in measureToGroup)
            p[measureToGroup[i]] = 0;
          return p;
        }
      );
    }

    return out;
  },

  /**
   * Set the crossfilter dataset and dispose of all previous dimensions and groups because they are linked to old data.
   *
   * @private
   * @param {string} JSON data
   * @return {crossfilter} crosfilter dataset
   */
  setCrossfilterData : function (data) {

    for (var dimension in this.dimensions) {
      if (this.dimensions[dimension].crossfilterGroup !== undefined) {
        this.dimensions[dimension].crossfilterGroup.dispose();
        this.dimensions[dimension].crossfilterGroup = undefined;
      }
      if (this.dimensions[dimension].crossfilter !== undefined) {
        this.dimensions[dimension].crossfilter.dispose();
        this.dimensions[dimension].crossfilter = undefined;
      }
    }
    if (this.isClientSideAggrPossible())
      this.dataCrossfilter = crossfilter(data);
    else
      this.dataCrossfilter = crossfilterServer(data);

    return this.dataCrossfilter;
  },

  /**
   * Get the charts associated to a dimension
   *
   * @private
   * @param {string} dimension
   * @return {Array<string>} charts ID using the input dimension
   */
  getChartsUsingDimension : function (dimension) {

    var out = [];
    for (var chart in this.charts) {
      if ($.inArray(dimension, this.charts[chart].dimensions) >= 0) {
        out.push(chart);
      }
    }

    return out;
  },


  /**
   * Filter all elements on the charts associated to a dimension
   *
   * @private
   * @param {string} dimension
   */
  filterAllChartsUsingDimension : function (dimension) {

    var charts = this.getChartsUsingDimension(dimension);
    for (var i in charts) {
      this.charts[charts[i]].element.filterAll();
    }

  },

  /**
   * Callback for when we filter an element on a chart
   *
   * @param {string} dimension - id of the concerned dimension
   * @param {string} element - id of the element on which we filtered
   */
  setFilter : function (chart, dimension, element) {
    // reset
    if (element === null) {
      this.dimensions[dimension].membersSelected = [];
    }

    // add or remove
    else {

      var indice = $.inArray(element, this.dimensions[dimension].membersSelected);
      var add = this.charts[chart].element.hasFilter(element);

      // add to list if needed
      if (add && indice < 0) {
        this.dimensions[dimension].membersSelected.push(element);
      }

      // remove from list if needed
      if (!add && indice >= 0) {
        this.dimensions[dimension].membersSelected.splice(indice, 1);
      }

      // update other charts
      var charts = this.getChartsUsingDimension(dimension);
      for (var i in charts) {
        if (this.charts[charts[i]].element.hasFilter(element) != add) {
          this.charts[charts[i]].element.filter(element);
        }
      }
      // Update the colors
      for (var chart in this.charts) {
        if (charts.indexOf(this.charts[chart]) < 0 && this.charts[chart].type != "placeholder") {
          if (this.charts[chart].element.colorDomain !== undefined) {
            var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(this.charts[chart].dimensions[0]);
            this.charts[chart].element.colorDomain(this.niceDomain(crossfilterDimAndGroup.group));
          }
          if (this.charts[chart].element.r !== undefined) {
            var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(this.charts[chart].dimensions[0], this.charts[chart].dimensions.slice(1));
            this.charts[chart].element
              .xAxisPadding(this.niceDomain(crossfilterDimAndGroup.group, this.charts[chart].dimensions[1])[1]*0.1)
              .yAxisPadding(this.niceDomain(crossfilterDimAndGroup.group, this.charts[chart].dimensions[2])[1]*0.1);
          }
        }
      }
    }
  },

  /**
   * Play a chart's dimension, it filters the dimension member by member
   * to be able to see easily the evolution of the dimension.
   *
   * @param {String} chart, id of the chart on which to play the data
   */
  playChart : function (chart, members, old_member) {
    // The params members and old_member are used only for the recursion
    var that = this;
    var dimension = this.charts[chart].dimensions[0];
    if (members == undefined) {
      // retrieve all the members of the chart's dimension if the members parameter
      // is undefined = not in the recursion
      members = Object.keys(this.getSliceFromStack(dimension).members);
      members.sort();
    }

    if (members.length === 0) {
      // Exit once we've gone through all the members
      return;
    }

    // filter the current member
    this.setFilter(chart, dimension, members[0]);
    if (old_member !== undefined) {
      // unfilter the previsou one
      this.setFilter(chart, dimension, old_member);
      this.charts[chart].element.filter(old_member);
    }
    this.charts[chart].element.filter(members[0]);
    var current_member = members[0];
    dc.redrawAll();

    // remove current member from the members list
    members.shift();
    setTimeout(function() { that.playChart(chart, members, current_member); }, 300);
  },

  /**
   * Set the filters of the charts and crossfilter data according to those defined in the state of this object.
   * This is usefull to filter the charts according to a loaded state with loadState, but also to keep filters
   * applied from one dataset to another when using drill-down/roll-up.
   *
   * @private
   */
  setFilters : function () {

    // for each dimension, if there is filters to process
    for (var dimension in this.dimensions) {
      var filters = this.dimensions[dimension].membersSelected;
      if (filters.length > 0) {

        // if at least 1 chart is using this dimension
        var charts = this.getChartsUsingDimension(dimension);
        if (charts.length > 0) {

          // if chart not well set (happends in case of state load)
          // tell dc to filter each element
          var firstEl = filters[0];
          if (!this.charts[charts[0]].element.hasFilter(firstEl)) {
            for (var i in filters) {
              var el = filters[i];
              this.charts[charts[0]].element.filter(el);
            }
          }

          // else, chart is good, so let's filter the dataset
          // (happends in case of drill-down/roll-up)
          else {
            var CF = this.getCrossfilterDimensionAndGroup(dimension);
            CF.dimension.filterFunction(function (d) {
              for(var i = 0; i < filters.length; i++) {
                if (filters[i] == d)
                  return true;
              }
              return false;
            });
          }
        }
      }
    }
  },

  /**
   * Initialise schema, cube and measure and display the fact selector
   * Selects first schema, cube and measure if not set by setState
   *
   * @private
   */
  initMeasure : function () {

    // select first schema if unset of unexistant
    try {
    var schemas = Query.getSchemas();
    if (this.schema === null || schemas[this.schema] === undefined) {
      for (this.schema in schemas) break;
    }

    // get measures by cubes
    var cubesAndMeasures = Query.getCubesAndMeasures(this.schema);
    var cube = this.cube;
    var measure = this.measure;

    // select first cube if unset of unexistant
    if (cube === null || cubesAndMeasures[cube] === undefined) {
      for (cube in cubesAndMeasures) break;
    }

    // select first measure if unset of unexistant
    if (measure === null || cubesAndMeasures[cube].measures[measure] === undefined) {
      for (measure in cubesAndMeasures[cube].measures) break;
    }

    // select measure and cube
    this.setCubeAndMeasure(cube, measure);

    // show fact selector
    var that = this;
    FactSelector.init(this.options.factSelector, this.options.factCubesIntro, this.options.factMeasuresIntro);
    FactSelector.setMetadata(cubesAndMeasures);
    FactSelector.setCallback(function(cubeCallback, measureCallback) { return that.setCubeAndMeasureCallback(cubeCallback, measureCallback); });
    FactSelector.setSelectedCube(cube);
    FactSelector.setSelectedMeasure(measure);
    } catch(err) {
      new PNotify({
        title: 'An error occured',
        type: 'error',
        text: err.message
      });
    }
  },

  /**
   * Initialize the metadatas according to the selected cube, ie get dimensions (standard and particular ones),
   * hierarchies, assign them to the charts.
   *
   * Slice the dimensions on for the members of the first level
   *
   * @private
   */
  initMetadata : function () {

    var initNecessary = false;
    for (var chart in this.charts) {
      if (this.charts[chart].dimensions.length === 0) {
        initNecessary = true;
        break;
      }
    }
    try {
      if (initNecessary) {

        // get specific infos
        var geoDimension  = Query.getGeoDimension(this.schema, this.cube);
        var timeDimension = Query.getTimeDimension(this.schema, this.cube);
        var geoHierarchy = Object.keys(Query.getHierarchies(this.schema, this.cube, geoDimension))[0];
        var geoLevels = Query.getLevels(this.schema, this.cube, geoDimension, geoHierarchy);
        var geoProperty = Query.getGeoProperty(this.schema, this.cube, geoDimension, geoHierarchy);

        // slice all dimensions (because they are all used in charts)
        var dimensions = Query.getDimensions(this.schema, this.cube);
        for (var dimension in dimensions) {
          var hierarchy = Object.keys(Query.getHierarchies(this.schema, this.cube, dimension))[0];
          var properties = dimension == geoDimension;
          var levels = Query.getLevels(this.schema, this.cube, dimension, hierarchy);
          var members  = Query.getMembers(this.schema, this.cube, dimension, hierarchy, 0, properties);

          this.addSliceToStack(dimension, dimensions[dimension].caption, hierarchy, 0, members, properties);
        }

        // init charts
        this.charts.map.dimensions.push(geoDimension);
        this.charts.map.options.geoProperty = geoProperty;
        this.charts.map.options.nbLevels = Object.keys(geoLevels).length - 1;
        this.charts.timeline.dimensions.push(timeDimension);
        this.charts.rightChart.dimensions.push(geoDimension);
        this.charts.barChart.dimensions.push(geoDimension);
        this.charts.table.dimensions.push(geoDimension);

        // instanciate wordclouds (1 per dimension except time)
        var i = 0;
        for (var dimension in dimensions) {
          this.charts["wordcloud"+i] = {
            'selector' : '#wordcloud'+i,
            'type' : 'wordcloud',
            'element' : undefined,
            'dimensions' : [dimension],
            'options' : {}
          };
          i++;
        }
      }
    } catch(err) {
      new PNotify({
        title: 'An error occured',
        type: 'error',
        text: err.message
      });
     }
  },

  /**
   * Reset the wordcloud
   * @private
   */
  resetWordClouds : function() {
    for (var chart in this.charts) {
      if (this.charts[chart].type == 'wordcloud') {
        dc.deregisterChart(this.charts[chart].element);
        delete this.charts[chart];
        $('#'+chart).parent().remove();
      }
    }
  },

  /**
   * Get the data from the cube according to the last slices defined in the dimensions attribute of the class and run them throw crossfilter.
   *
   * @private
   * @return {Object} crossfilter dataset
   */
  getData : function () {
    try {
      if (this.isClientSideAggrPossible()) {
        return this.getDataClientAgregates();
      } else {
        return this.getDataServerAgregates();
      }
    } catch(err) {
      new PNotify({
        title: 'An error occured',
        type: 'error',
        text: err.message
      });
    }
  },

  /**
   * Get the data for client side agregates
   *
   * @private
   * @return {Object} crossfilter dataset
   */
  getDataClientAgregates : function () {
    Query.clear();

    // set cube
    Query.drill(this.cube);

    // set dimensions to get
    var dimensionsList = this.getDimensions();
    var hierachiesList = [];
    for (var i in dimensionsList) {
      var dimension = dimensionsList[i];

      if (!this.isAggregated(dimension)) {
        var slice = this.getSliceFromStack(dimension);
        var hierarchy = this.getDimensionHierarchy(dimension);
        hierachiesList.push(hierarchy);
        Query.slice(hierarchy, Object.keys(slice.members));
      } else {
        while(this.getDimensionCurrentLevel(dimension) > 0) {
          this.removeLastSliceFromStack(dimension);
        }
      }
    }
    Query.dice(hierachiesList);

    // set measures
    // (dimensions used in chart that are not in dimensionsList are measures)
    this.measuresLoaded = [this.measure];
    Query.push(this.measure);
    for (var chart in this.charts) {
      var chartDimensions = this.charts[chart].dimensions;
      for (var i in chartDimensions) {
        if (dimensionsList.indexOf(chartDimensions[i]) < 0) {
          Query.push(chartDimensions[i]);
          this.measuresLoaded.push(chartDimensions[i]);
        }
      }
    }

    // get data
    var data = Query.execute();

    return this.setCrossfilterData(data);
  },

  /**
   * Find out whether we can drill-down on a given dimension or not
   *
   * @param {string} A dimension
   * @return {boolean} True if we can drill-down on the dimension
   */
  isDrillPossible : function (dimension) {
    var hierarchy = Object.keys(Query.getHierarchies(this.schema, this.cube, dimension))[0];
    var nbLevels = Query.getLevels(this.schema, this.cube, dimension, hierarchy).length;
    return (this.getSliceFromStack(dimension).level + 1) !== nbLevels;
  },

  /**
   * Find out whether we can roll-up on a given dimension or not
   *
   * @param {string} A dimension
   * @return {boolean} True if we can roll-up on the dimension
   */
  isRollPossible : function (dimension) {
    return this.getSliceFromStack(dimension).level > 0;
  },

  /**
   * Get the data for client side agregates
   *
   * @private
   * @return {Object} crossfilter dataset
   */
  getDataServerAgregates : function () {
    var metadata = {
      "api" : Query,
      "schema" : this.schema,
      "cube" : this.cube,
      "measures" : [this.measure],
      "dimensions" : {}
    };

    // set dimensions to get
    var dimensionsList = this.getDimensions();
    for (var i in dimensionsList) {
      var dimension = dimensionsList[i];
      var slice = this.getSliceFromStack(dimension);
      metadata.dimensions[dimension] = {
        "hierarchy" : this.getDimensionHierarchy(dimension),
        "level" : slice.level,
        "members" : Object.keys(slice.members)
      };
    }

    // set measures
    // (dimensions used in chart that are not in dimensionsList are measures)
    this.measuresLoaded = [this.measure];
    for (var chart in this.charts) {
      var chartDimensions = this.charts[chart].dimensions;
      for (var i in chartDimensions) {
        if (dimensionsList.indexOf(chartDimensions[i]) < 0) {
          metadata.measures.push(chartDimensions[i]);
          this.measuresLoaded.push(chartDimensions[i]);
        }
      }
    }

    return this.setCrossfilterData(metadata);
  },

  /**
   * Display all the charts
   *
   * @private
   * @param {boolean} true to render all the chart or false to redraw them
   */
  displayCharts : function (init) {

    for (var chart in this.charts) {
      this.displayChart(chart);
    }

    this.setFilters();

    if (init === true) {
      this.resizeCharts();
      dc.renderAll();
    }
    else {
      dc.redrawAll();
    }
  },

  /**
   * Display a particular chart
   *
   * @private
   * @param {string} chart id of the chart in the charts attribute
   */
  displayChart : function (chart) {

    $(this.charts[chart].selector).addClass("dc-"+this.charts[chart].type);

    switch(this.charts[chart].type) {

      case "map":
        this.displayMap(chart);
        break;

      case "pie":
        this.displayPie(chart);
        break;

      case "bar":
        this.displayBar(chart);
        break;

      case "table":
        this.displayTable(chart);
        break;

      case "timeline":
        this.displayTimeline(chart);
        break;

      case "wordcloud":
        this.displayWordCloud(chart);
        break;

      case "bubble":
        this.displayBubble(chart);
        break;

      case "placeholder":
        this.displayPlaceholder(chart);
        break;
    }
  },

  /**
   * Display the container for meta infos on charts
   * @private
   * @param  {DOMObject} DOM Object in which we will put meta infos
   */
  displayChartMetaContainer : function (element) {
    $(element).attr("class", "chart-header").html(
      '<div class="chart-meta">'+
      '<span class="chart-infos"></span><span class="chart-levels-icons"></span><span class="chart-levels"></span><span class="btn-params"></span><span class="chart-play"></span>'+
      '</div>'+
      '<div class="chart-title"></div>');
  },

  /**
   * Display and configure the params tool
   * @param  {String} chart id of the chart of which we want to display params tool
   * @private
   * @todo Update the content of the modal form to put real values in the fields and preselect current values
   */
  displayParams : function(chart) {
    var that = this;
    var el = $('<span class="btn-params btn btn-xs btn-default"><i class="fa fa-nomargin fa-cog"></i></span>');

    $(this.charts[chart].selector+' .chart-meta .btn-params').replaceWith(el);

    el.click(function() {

        // Add dimensions to the select in the chartparams form
        $('#chartparam-dimension').empty();
        for (var dimension in that.dimensions) {
          $('#chartparam-dimension').append('<option value="'+dimension+'">'+that.getDimensionCaption(dimension)+'</option>');
        }

        // Add measures to the selects in the chartparams form
        var dimx = $('#chartparam-dimension-x').parent().parent().hide();
        var dimy = $('#chartparam-dimension-y').parent().parent().hide();
        var labelChoice = $('#chartparam-labelChoice').parent().parent().hide();
        var sort = $('#chartparam-sort').parent().parent().hide();
        $('#chartparam-dimension-x').empty();
        $('#chartparam-dimension-y').empty();
        var measures = Query.getMesures(that.schema, that.cube);
        for (var measure in measures) {
          $('#chartparam-dimension-x').append('<option value="'+measure+'">'+measures[measure].caption+'</option>');
          $('#chartparam-dimension-y').append('<option value="'+measure+'">'+measures[measure].caption+'</option>');
        }

        // autoset infos, update of the setting mini page for the corresponding graph
        $('#chartparam-type').val(that.charts[chart].type);
        $('#chartparam-dimension').val(that.charts[chart].dimensions[0]);
        $('#chartparam-dimension-x').val(that.charts[chart].dimensions[1]);
        $('#chartparam-dimension-y').val(that.charts[chart].dimensions[2]);
        $('#chartparam-labelChoice').prop("checked",that.charts[chart].lbChoice);
        $('#chartparam-sort').val(that.charts[chart].sort);

        // update form dynamically depending on type
        function updateForm(chartType, duration) {
          $('#chartparam-dimension option').removeAttr('disabled');
          if (chartType == 'map') {
            $('#chartparam-dimension').val(Query.getGeoDimension(that.schema, that.cube));
            $('#chartparam-dimension option[value!="'+Query.getGeoDimension(that.schema, that.cube)+'"]').attr('disabled', 'disabled');
          }

          if(chartType == 'bubble' || chartType == 'pie')
            labelChoice.slideDown(duration);
          else
            labelChoice.slideUp(duration);

          if (chartType == 'bubble') {
            dimx.slideDown(duration);
            dimy.slideDown(duration);
          }
          else {
            dimx.slideUp(duration);
            dimy.slideUp(duration);
          }
         			 
          if (chartType == 'pie' || chartType == 'bar' || chartType == 'table')
            sort.slideDown(duration);
          else{
            sort.slideUp(duration);
		  }
        }
        updateForm($('#chartparam-type').val(), 0);
        $('#chartparam-type').change(function() { updateForm($(this).val(), 400); });

        // set callback for save, update the graph according to the changes set on the setting mini page(On click on the update button)
        $('#chartparams-set').unbind('click').click(function() {
          $('#chartparams').modal('hide');

          var options = {};
          options.dimension = $('#chartparam-dimension').val();
          options.dimensionx = $('#chartparam-dimension-x').val();
          options.dimensiony = $('#chartparam-dimension-y').val();
          options.sort      = $('#chartparam-sort').val();
          options.lbChoice   = $('#chartparam-labelChoice').prop("checked");
          options.type      = $('#chartparam-type').val();

          that.updateChart(chart, options);
        });

        // show modal
        $('#chartparams').modal('show');
      });

  },

  displayTitle : function (chart) {
    var dimension   = this.charts[chart].dimensions[0];
    var hierarchy   = this.getDimensionHierarchy(dimension);
    var level       = this.getDimensionCurrentLevel(dimension);

    var levelCapt   = Query.getLevels(this.schema, this.cube, dimension, hierarchy)[level];
    var dimCapt     = this.getDimensionCaption(dimension);
    var cubesAndMes = Query.getCubesAndMeasures(this.schema);
    var cube        = cubesAndMes[this.cube].caption;
    var mes         = cubesAndMes[this.cube].measures[this.measure].caption;

    $(this.charts[chart].selector+' .chart-title').html(cube + " &bull; " + dimCapt + " &bull; " + levelCapt + " &bull; " + mes);
  },

  displayPlay : function (chart) {
    var that = this;
    var el = $('<span class="btn-params btn btn-xs btn-default"><i class="fa fa-nomargin fa-play"></i></span>');
    $(this.charts[chart].selector+' .chart-meta .chart-play').replaceWith(el);
    el.click(function () {
      that.playChart(chart);
    });
  },

  displayTip : function (chart) {
    var chartType = this.charts[chart].type;
    if (Object.keys(this.tips).indexOf(chartType) >= 0) {
      var el = $('<span data-toggle="tooltip" class ="chart-infos" data-placement="bottom" title="'+this.tips[this.charts[chart].type]+'">'+
        '<i class="fa fa-nomargin fa-info-circle"></i></span>');

      $(this.charts[chart].selector+' .chart-meta .chart-infos').replaceWith(el);
      el.tooltip({'container': 'body', 'html': true});
    }
  },

  /**
   * Display an icon whether we can drill-down or roll-up on the chart
   * @param {string} chart Chart id
   */
  displayCanDrillRoll : function (chart) {
    var dimension = this.charts[chart].dimensions[0];

    var el = $(this.charts[chart].selector + ' .chart-meta .chart-levels-icons');
    if (el.html().length === 0) {
      el.html('<span class="fa fa-nomargin fa-caret-up"></span><span class="fa fa-nomargin fa-caret-down"></span>');
    }

    var caretDown = el.find('.fa-caret-down');
    var caretUp = el.find('.fa-caret-up');

    if (this.isRollPossible(dimension))
      caretUp.css('color', 'inherit');
    else
      caretUp.css('color', '#999999');

    if (this.isDrillPossible(dimension))
      caretDown.css('color', 'inherit');
    else
      caretDown.css('color', '#999999');
  },

  /**
   * Display the number of levels and the current level
   * @param {string} chart Chart id
   */
  displayLevels : function (chart) {
    var dimension = this.charts[chart].dimensions[0];

    // Display the number of levels and the current level
    var hierarchy = this.getDimensionHierarchy(dimension);
    var nbLevels = Query.getLevels(this.schema, this.cube, dimension, hierarchy).length;
    var currentLevel = this.getSliceFromStack(dimension).level;

    $(this.charts[chart].selector + ' .chart-meta .chart-levels').html((currentLevel+1)+'/'+nbLevels);
  },

  /**
   * Display a placeholder using the space and shows the param fa-cog
   *
   * @param {string} chart id
   */
  displayPlaceholder : function (chart) {
    if($('.dc-'+chart+' .chart-meta').length === 0) {
      this.displayChartMetaContainer(d3.select(this.charts[chart].selector).append("div")[0]);
      this.displayParams(chart);
    }
  },

  /**
   * Update the configuration of a chart
   * @param  {String} chart   Chart id
   * @param  {Object} options New config
   * @todo implement code actually process something
   */
  updateChart : function (chart, options) {
    console.log("update", chart, options);
	
    var doRender = false;
    var doRedraw = false;
    var updateData = false;
    
    //Options of showing the labels on the graph (bubble or pie chart)
    if((options.type == "bubble" || options.type == "pie") && options.lbChoice != this.charts[chart].lbChoice){
		this.charts[chart].lbChoice = options.lbChoice;
		doRedraw = true;
	}

    // Bubble chart must have 3 dimensions
    if (options.type == "bubble" && (!options.dimensionx || !options.dimensiony)) {
      new PNotify({
        'title' : 'Impossible to use a bubble chart',
        'text': 'You must set the X and Y axes to use a bubble chart'
      });
    }
    // Check if we are trying something else than a geographical dimension on the map
    else if (options.type == "map" && options.dimension != Query.getGeoDimension(this.schema, this.cube)) {
      new PNotify({
        'title' : 'Impossible to use a map chart',
        'text': 'Map can only show geographical dimensions'
      });
    }
    else {
      // Dimensions change
      if (options.dimension != this.charts[chart].dimensions[0]) {
        this.charts[chart].dimensions[0] = options.dimension;
        doRedraw = true;
      }
      // Chart type change
      if (this.charts[chart].type != options.type) {
        // remove old chart
        $(this.charts[chart].selector).empty();
        if (this.charts[chart].type != "placeholder") {
          dc.deregisterChart(this.charts[chart].element);
          delete this.charts[chart].element;
        }
        // set new type
        this.charts[chart].type = options.type;
        doRender = true;
      }

      // bubble : checks X and Y dimensions
      if (this.charts[chart].type == "bubble") {
        if (options.dimensionx != this.charts[chart].dimensions[1]) {
          this.charts[chart].dimensions[1] = options.dimensionx;
          doRedraw = true;
          if (this.measuresLoaded.indexOf(options.dimensionx) < 0)
            updateData = true;
        }
        if (options.dimensiony != this.charts[chart].dimensions[2]) {
          this.charts[chart].dimensions[2] = options.dimensiony;
          doRedraw = true;
          if (this.measuresLoaded.indexOf(options.dimensiony) < 0)
            updateData = true;
        }
        this.charts[chart].dimensions = this.charts[chart].dimensions.slice(0, 3);
      }
      // not bubble = 1 dimension max
      else {
        this.charts[chart].dimensions = this.charts[chart].dimensions.slice(0, 1);
      }
    }

    // Sort order change
    if (this.charts[chart].sort != options.sort){
      this.charts[chart].sort = options.sort;
      doRedraw = true;
    }

    // Update data
    if (updateData) {
      this.getData();
      this.displayChart(chart);
      this.charts[chart].element.render();
      this.displayCharts();
    }
    // Update display
    else if (doRedraw || doRender) {
      this.displayChart(chart);
      if (doRender)
        this.charts[chart].element.render();
      else
        this.charts[chart].element.redraw();
    }
  },

  /**
   * Remove charts showing the given dimension
   * This keeps the params and tips
   *
   * @param {string} dimension
   */
  removeChartsWithDimension : function (dimension) {
    for (var chart in this.charts) {
      if (this.charts[chart].dimensions[0] === dimension) {
        $(this.charts[chart].selector).empty();
        if (this.charts[chart].type != "placeholder") {
          dc.deregisterChart(this.charts[chart].element);
          delete this.charts[chart].element;
          this.charts[chart].dimensions = [];
        }

        this.charts[chart].type = "placeholder";
        this.displayChart(chart);
      }
    }
  },

  /**
   * Display a wordcloud
   *
   * @private
   * @param {string} chart id of the chart in the charts attribute
   *
   */
  displayWordCloud : function (chart) {
    var that = this;

    /// get data
    var measures = Query.getMesures(this.schema, this.cube);
    var dimension = this.charts[chart].dimensions[0];
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimension);
    var metadata = this.getSliceFromStack(dimension);

    var chart_backup = this.charts[chart];

    /// create element if needed
    if (this.charts[chart].element === undefined) {

      $(this.options.cloudsSelector).append('<div class="wordcloud" id="'+chart+'-container">'+
          '<div class="wordcloud-title">'+this.getDimensionCaption(dimension)+'</div>'+
          '<div class="wordcloud-chart" id="'+chart+'"></div>'+
          '<div class="wordcloud-legend" id="'+chart+'-legend"></div>'+
        '</div>');

      $("#" + chart + "-container .wordcloud-title").click(function() {
        if (that.isAggregated(dimension)) {
          var oldClientPossible = that.isClientSideAggrPossible();
          that.deaggregateDimension(dimension);
          var newClientPossible = that.isClientSideAggrPossible();
          that.charts[chart] = chart_backup;
          dc.registerChart(chart_backup.element);
          that.charts[chart].element.showLegend('#'+chart+'-legend');
          if (oldClientPossible !== newClientPossible) {
            that.getData();
            that.displayCharts(false);
            that.setFilters();
          }
          that.charts[chart].element.render();
        } else {
          // Delete charts showing this dimension
          var oldClientPossible = that.isClientSideAggrPossible();
          that.aggregateDimension(dimension);
          var newClientPossible = that.isClientSideAggrPossible();

          dc.deregisterChart(that.charts[chart].element);
          delete that.charts[chart];
          $('#'+chart).empty();
          $('#'+chart+'-legend').empty();
          that.removeChartsWithDimension(dimension);

          if (oldClientPossible !== newClientPossible) {
            that.getData();
            that.displayCharts(false);
            that.setFilters();
          }
        }
      });

      // Add the div for metadata informations
      this.displayChartMetaContainer(d3.select(this.charts[chart].selector).append("div")[0]);

      this.displayTip(chart);
      this.displayPlay(chart);

      this.charts[chart].element = dc.wordCloudChart(this.charts[chart].selector)

        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d ? that.charts[chart].element.colors()(d) : '#ccc'; })

        .showLegend('#'+chart+'-legend')

        .callbackZoomIn(function(el, chartID) { that.drillDown(that.charts[chart].dimensions[0], el, chartID); })
        .callbackZoomOut(function (chartID) { that.rollUp(that.charts[chart].dimensions[0], chartID); })

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); });
    }

    this.displayTitle(chart);
    this.displayLevels(chart);
    this.displayCanDrillRoll(chart);

    /// display data
    var format = d3.format(".3s");

    this.charts[chart].element
      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)

      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group))

      .label(function (d) { return metadata.members[d.key].caption; })

      .title(function (d) {
        var key = d.key ? d.key : d.data.key;
        var valText = measures[that.measure].caption + ': ' + (d.value ? format(d.value) : 0);
        var keyText = that.getDimensionCaption(dimension) + ": " + (metadata.members[key] === undefined ? '' : metadata.members[key].caption);
        return keyText + "\n" + valText;
      });
  },

  /**
   * Display a map chart
   *
   * @private
   * @param {string} chart id of the chart in the charts attribute
   *
   * @todo improve domain. Support negative values for example.
   */
  displayMap : function (chart) {

    var that = this;

    /// get data
    var measures = Query.getMesures(this.schema, this.cube);
    var dimension = this.charts[chart].dimensions[0];
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimension);
    var metadata = this.getSliceFromStack(dimension);

    /// create element if needed
    if (this.charts[chart].element === undefined) {

      var geoHierarchy = Object.keys(Query.getHierarchies(this.schema, this.cube, dimension))[0];
      var geoLevels = Query.getLevels(this.schema, this.cube, dimension, geoHierarchy);
      var geoProperty = Query.getGeoProperty(this.schema, this.cube, dimension, geoHierarchy);

      this.charts[chart].options.geoProperty = geoProperty;
      this.charts[chart].options.nbLevels = Object.keys(geoLevels).length - 1;

      // Add the div for metadata informations
      this.displayChartMetaContainer(d3.select(this.charts[chart].selector).append("div")[0]);

      var width = $(this.charts[chart].selector).width() - 30;
      var height = $(this.charts[chart].selector).height();

      this.displayParams(chart);
      this.displayTip(chart);
      this.displayPlay(chart);

      this.charts[chart].element = dc.geoChoroplethChart(this.charts[chart].selector)
        .width(width)
        .height(height)

        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d ? that.charts[chart].element.colors()(d) : '#ccc'; })

        .projection(d3.geo.mercator())

        .callbackZoomIn(function(el, chartID) { that.drillDown(that.charts[chart].dimensions[0], el, chartID); })
        .callbackZoomOut(function (nbLevels, chartID) { that.rollUp(that.charts[chart].dimensions[0], chartID, nbLevels); })

        .setNbZoomLevels(this.charts[chart].options.nbLevels)

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); });

        var div = d3.select(this.charts[chart].selector).append("div")
          .attr("id", this.options.zoomId);

        div.append("a")
          .attr("class","btn btn-primary fa fa-search-plus")
          .attr("href","#")
          .on("click", function () { that.charts[chart].element.addScale(1.35, 700); return false; });
        div.append("a")
          .attr("class","btn btn-primary fa fa-search-minus")
          .attr("href","#")
          .on("click", function () { that.charts[chart].element.addScale(1/1.35, 700); return false; });
    }

    var spatialData = this.transformSpatialMetadata(metadata.members, this.charts[chart].options.geoProperty);

    /// update layers
    var layers = this.charts[chart].element.geoJsons();
    // remove layers > current level (if so, we most probably rolled up)
    for (var i = metadata.level; i < layers.length; i++) {
      this.charts[chart].element.removeGeoJson(layers[i].name);
    }
    // add layers < current level (if so, we loaded a saved state)
    for (var i = layers.length; i < metadata.level; i++) {
      var oldMetadata = this.getSliceFromStack(dimension, i);
      var oldSpatialData = this.transformSpatialMetadata(oldMetadata.members, this.charts[chart].options.geoProperty);
      this.charts[chart].element.overlayGeoJson(oldSpatialData, "geolayer-"+i, function (d) {
        return d.id;
      });
    }
    // add new layer
    this.charts[chart].element.overlayGeoJson(spatialData, "geolayer-"+metadata.level, function (d) {
      return d.id;
    });

    this.displayTitle(chart);
    this.displayLevels(chart);
    this.displayCanDrillRoll(chart);

    /// display data
    var format = d3.format(".3s");

    this.charts[chart].element
      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)
      .setNbZoomLevels(this.charts[chart].options.nbLevels)

      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group))

      .title(function (d) {
        var valText = measures[that.measure].caption + ': ' + (d.value ? format(d.value) : 0);
        var keyText = that.getDimensionCaption(dimension) + ": " + (metadata.members[d.key] === undefined ? '' : metadata.members[d.key].caption);
        return keyText + "\n" + valText;
      });
  },

  /**
   * Display a pie chart
   *
   * @private
   * @param {string} chart id of the chart in the charts attribute
   *
   * @todo improve domain. Support negative values for example.
   */
  displayPie : function (chart) {

    var that = this;
	var labelChoice = this.charts[chart].lbChoice;
	/// get data
    var measures = Query.getMesures(this.schema, this.cube);
    var dimension = this.charts[chart].dimensions[0];
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimension);
    var metadata = this.getSliceFromStack(dimension);

    if (this.charts[chart].element === undefined) {
      // Add the div for metadata informations
      this.displayChartMetaContainer(d3.select(this.charts[chart].selector).append("div")[0]);

      var width = $(this.charts[chart].selector).width() - 30;
      var height = $(this.charts[chart].selector).height();

      this.displayParams(chart);
      this.displayTip(chart);
      this.displayPlay(chart);

      this.charts[chart].element = dc.pieChart(this.charts[chart].selector)
        .ordering(function (d) { return d.value; })
        .width(width)
        .height(height)
        .minAngleForLabel(0.3)

        .callbackZoomIn(function(el, dcChartID) { that.drillDown(that.charts[chart].dimensions[0], el, dcChartID); })
        .callbackZoomOut(function (dcChartID) { that.rollUp(that.charts[chart].dimensions[0], dcChartID); })

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); })

        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d.value ? that.charts[chart].element.colors()(d.value) : '#ccc'; });
    }

    switch(this.charts[chart].sort) {
      case "key":
      this.charts[chart].element.ordering(function (d) { return  d.key;   });
      break;

      case "valueasc":
      this.charts[chart].element.ordering(function (d) { return  d.value; });
      break;

      default: // valuedesc
      this.charts[chart].element.ordering(function (d) { return -d.value; });
      this.charts[chart].sort = "valuedesc";
      break;
    }

    this.displayTitle(chart);
    this.displayLevels(chart);
    this.displayCanDrillRoll(chart);

    var format = d3.format(".3s");

    this.charts[chart].element
      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)
      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group))
      .label(function (d) { if(metadata.members[d.key] !== undefined && labelChoice) return metadata.members[d.key].caption; })
      .title(function (d) {
        var key = d.key ? d.key : d.data.key;
        var valText = measures[that.measure].caption + ': ' + (d.value ? format(d.value) : 0);
        var keyText = that.getDimensionCaption(dimension) + ": " + (metadata.members[key] === undefined ? '' : metadata.members[key].caption);
        return keyText + "\n" + valText;
      });
  },

  /**
   * Display a bar chart
   *
   * @private
   * @param {string} chart id of the chart in the charts attribute
   *
   * @todo improve domain. Support negative values for example.
   */
  displayBar : function (chart) {
    var that = this;

    // get data
    var measures = Query.getMesures(this.schema, this.cube);
    var dimension = this.charts[chart].dimensions[0];
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimension);
    var metadata = this.getSliceFromStack(dimension);

    if (this.charts[chart].element === undefined) {
      // Add the div for metadata informations
      this.displayChartMetaContainer(d3.select(this.charts[chart].selector).append("div")[0]);


      this.displayParams(chart);
      this.displayTip(chart);
      this.displayPlay(chart);

      var width = $(this.charts[chart].selector).width() - 30;
      var height = $(this.charts[chart].selector).height();

      this.charts[chart].element = dc.barChart(this.charts[chart].selector)
        .width(width)
        .height(height)

        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d.value ? that.charts[chart].element.colors()(d.value) : '#ccc'; })

        .callbackZoomIn(function(el, chartID) { that.drillDown(that.charts[chart].dimensions[0], el, chartID); })
        .callbackZoomOut(function (chartID) { that.rollUp(that.charts[chart].dimensions[0], chartID); })

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
        .elasticX(true)

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); });
    }

    // Generate sorted keys
    switch(this.charts[chart].sort) {
      case "valueasc":
        var keys = crossfilterDimAndGroup.group.order(function(d) { return -d; }).top(Infinity).map(function(d) { return d.key; });
      break;

      case "valuedesc":
        var keys = crossfilterDimAndGroup.group.order(function(d) { return d; }).top(Infinity).map(function(d) { return d.key; });
      break;

      default: // key
        var keys = d3.keys(metadata.members).sort();
        this.charts[chart].sort = "key";
      break;
    }

    this.displayTitle(chart);
    this.displayLevels(chart);
    this.displayCanDrillRoll(chart);

    var format = d3.format(".3s");

    this.charts[chart].element
      .x(d3.scale.ordinal().domain(keys))
      .xUnits(dc.units.ordinal)
      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)
      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group))
      .title(function (d) {
        var key = d.key ? d.key : d.data.key;
        var valText = measures[that.measure].caption + ': ' + (d.value ? format(d.value) : 0);
        var keyText = that.getDimensionCaption(dimension) + ": " + (metadata.members[key] === undefined ? '' : metadata.members[key].caption);
        return keyText + "\n" + valText;
      });
    this.charts[chart].element.xAxis().tickFormat(function(d) {return metadata.members[d].caption;});
    this.charts[chart].element.yAxis().tickFormat(function(d) { return format(d);});
  },


  /**
   * Display a bubble chart
   *
   * @private
   * @param {string} chart id of the chart in the charts attribute
   */
  displayBubble : function (chart) {
    var that = this;
	var labelChoice = this.charts[chart].lbChoice;
	
    // dimensions
    var measures = Query.getMesures(this.schema, this.cube);
    var extraMeasures = this.charts[chart].dimensions.slice(1);
    var dimensions = [this.charts[chart].dimensions[0], this.charts[chart].dimensions[1], this.charts[chart].dimensions[2], this.measure];

    // get data
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimensions[0], extraMeasures);
    var metadata = this.getSliceFromStack(dimensions[0]);
    var format = d3.format(".3s");

    if (this.charts[chart].element === undefined) {
      // Add the div for metadata informations
      this.displayChartMetaContainer(d3.select(this.charts[chart].selector).append("div")[0]);

      this.displayParams(chart);
      this.displayTip(chart);
      this.displayPlay(chart);

      var width = $(this.charts[chart].selector).width();
      var height = $(this.charts[chart].selector).height();

      this.charts[chart].element = dc.bubbleChart(this.charts[chart].selector)
        .width(width)
        .height(height)
        .margins({top: 0, right: 0, bottom: 30, left: 45})

        .elasticY(true)
        .elasticX(true)
        .elasticRadius(true)

        .renderHorizontalGridLines(true)
        .renderVerticalGridLines(true)

        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d.value[dimensions[3]] ? that.charts[chart].element.colors()(d.value[dimensions[3]]) : '#ccc'; })

        .maxBubbleRelativeSize(0.075)

        .callbackZoomIn(function(el, chartID) { that.drillDown(dimensions[0], el, chartID); })
        .callbackZoomOut(function (chartID) { that.rollUp(dimensions[0], chartID); })

        .on("filtered", function (ch, filter) { that.setFilter(chart, dimensions[0], filter); });

      this.charts[chart].element.yAxis().tickFormat(function (s) { return format(s); });
      this.charts[chart].element.xAxis().tickFormat(function (s) { return format(s); });
    }

    this.displayTitle(chart);
    this.displayLevels(chart);
    this.displayCanDrillRoll(chart);
    this.charts[chart].element
      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)

      .keyAccessor(function (p)         { return p.value[dimensions[1]]; })
      .valueAccessor(function (p)       { return p.value[dimensions[2]]; })
      .radiusValueAccessor(function (p) { return p.value[dimensions[3]]; })

      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group, dimensions[3]))

      .x(d3.scale.linear().domain(this.niceDomain(crossfilterDimAndGroup.group, dimensions[1])))
      .y(d3.scale.linear().domain(this.niceDomain(crossfilterDimAndGroup.group, dimensions[2])))
      .r(d3.scale.linear().domain(this.niceDomain(crossfilterDimAndGroup.group, dimensions[3])))

      .xAxisLabel(measures[dimensions[1]].caption)
      .yAxisLabel(measures[dimensions[2]].caption)

      .xAxisPadding(this.niceDomain(crossfilterDimAndGroup.group, dimensions[1])[1]*0.1)
      .yAxisPadding(this.niceDomain(crossfilterDimAndGroup.group, dimensions[2])[1]*0.1)

      .minRadiusWithLabel(14)

      .label(function (d) {if(metadata.members[d.key] !== undefined && labelChoice == true) return metadata.members[d.key].caption; })
      .title(function (d) {
        var key = d.key ? d.key : d.data.key;
        if (metadata.members[key] === undefined) return (d.value ? format(d.value) : '');
        var out = metadata.members[key].caption + "\n" +
                  measures[dimensions[1]].caption + ": " + (d.value[dimensions[1]] ? format(d.value[dimensions[1]]) : 0) + "\n";
        if (dimensions[2] != dimensions[1])
          out +=  measures[dimensions[2]].caption + ": " + (d.value[dimensions[2]] ? format(d.value[dimensions[2]]) : 0) + "\n";
        if (dimensions[3] != dimensions[1] && dimensions[3] != dimensions[2])
          out +=  measures[dimensions[3]].caption + ": " + (d.value[dimensions[3]] ? format(d.value[dimensions[3]]) : 0) + "\n";
        return out;
      });
  },


  /**
   * Display a timeline
   *
   * @private
   * @param {string} chart id of the chart in the charts attribute
   *
   */
  displayTimeline : function (chart) {
    var that = this;

    /// get data
    var measures = Query.getMesures(this.schema, this.cube);
    var dimension = this.charts[chart].dimensions[0];
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimension);
    var metadata = this.getSliceFromStack(dimension);

    /// display element if needed
    if (this.charts[chart].element === undefined) {
      // Add the div for metadata informations
      this.displayChartMetaContainer(d3.select(this.charts[chart].selector).append("div")[0]);

      this.displayTip(chart);
      this.displayPlay(chart);

      var width = $(this.charts[chart].selector).width() - 30;
      var height = $(this.charts[chart].selector).height();

      this.charts[chart].element = dc.barChart(this.charts[chart].selector)
        .width(width)
        .height(height)
        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d.value ? that.charts[chart].element.colors()(d.value) : '#ccc'; })
        .callbackZoomIn(function(el, chartID) { that.drillDown(that.charts[chart].dimensions[0], el, chartID); })
        .callbackZoomOut(function (chartID) { that.rollUp(that.charts[chart].dimensions[0], chartID); })

        .margins({top: 10, right: 10, bottom: 20, left: 40})
        .transitionDuration(500)
        .centerBar(false)
        .gap(1)
        .elasticY(true)
        .elasticX(true)

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); });
    }

    this.displayTitle(chart);
    this.displayLevels(chart);
    this.displayCanDrillRoll(chart);

    crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(this.charts[chart].dimensions[0]);

    var format = d3.format(".3s");

    // We consider that the keys are sortable data (and yes it will be strings of time)
    var keys = d3.keys(metadata.members).sort();
    var scale = d3.scale.ordinal().domain(keys);
    this.charts[chart].element
      .x(scale)
      .xUnits(dc.units.ordinal)

      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)
      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group))
      .title(function (d) {
        var key = d.key ? d.key : d.data.key;
        var valText = measures[that.measure].caption + ': ' + (d.value ? format(d.value) : 0);
        var keyText = that.getDimensionCaption(dimension) + ": " + (metadata.members[key] === undefined ? '' : metadata.members[key].caption);
        return keyText + "\n" + valText;
      });

     this.charts[chart].element.xAxis().tickFormat(function(d) {return metadata.members[d].caption;});
     this.charts[chart].element.yAxis().tickFormat(function(d) { return format(d);});
  },

  /**
   * Display a table
   *
   * @private
   * @param {string} chart id of the chart in the charts attribute
   *
   */
  displayTable : function (chart) {
    var that = this;

    /// get data
    var dimension = this.charts[chart].dimensions[0];
    var measures = Query.getMesures(this.schema, this.cube);

    if (this.charts[chart].element === undefined) {
      // Add the div for metadata informations
      this.displayChartMetaContainer(d3.select(this.charts[chart].selector).append("div")[0]);

      this.displayParams(chart);
      this.displayTip(chart);
      this.displayPlay(chart);

      d3.select(this.charts[chart].selector).attr('class', 'dc-chart');
      d3.select(this.charts[chart].selector).append('table');
      d3.select(this.charts[chart].selector + ' table').html("<thead><tr><th>Element</th><th>Value</th></tr></thead>");
      this.charts[chart].element = dc.dataTable(this.charts[chart].selector + ' table')
        .callbackZoomIn(function(el, dcChartID) { that.drillDown(that.charts[chart].dimensions[0], el, dcChartID); })
        .callbackZoomOut(function (dcChartID) { that.rollUp(that.charts[chart].dimensions[0], dcChartID); });
    }

    $(this.charts[chart].selector + " table th:first").html(this.getDimensionCaption(dimension));
    $(this.charts[chart].selector + " table th:last").html(measures[this.measure].caption);

    this.displayTitle(chart);
    this.displayLevels(chart);
    this.displayCanDrillRoll(chart);

    switch(this.charts[chart].sort) {
        case "key":
          this.charts[chart].element
            .order(d3.ascending)
            .sortBy(function(d) {return d.key; });
        break;

        case "valueasc":
          this.charts[chart].element
            .order(d3.descending)
            .sortBy(function(d) { return -d.value; });
        break;

        default: // valuedesc
          this.charts[chart].element
            .order(d3.descending)
            .sortBy(function(d) { return d.value; });
          this.charts[chart].sort = "valuedesc";
        break;
    }

    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(this.charts[chart].dimensions[0]);
    var metadata = this.getSliceFromStack(this.charts[chart].dimensions[0]);
    var format = d3.format(".3s");

    this.charts[chart].element
        .dimension(crossfilterDimAndGroup.group)
        .group(function(d){return "";})
        .size(Infinity)
        .columns([
          function(d){
            var key = d.key ? d.key : d.data.key;
            if (metadata.members[key] === undefined) {
              return key;
            }
            return metadata.members[key].caption;
          },
          function(d){ return (d.value ? format(d.value) : 0); }
         ])
        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); });
  },

  /**
   * Get a crossfilter's group domain with nice values (rounded)
   *
   * @private
   * @param {Object} crossfilterGroup - group of which you want a nice domain
   * @param {String} [measure] - name of the nested value accessor in `d.value`. Needed for group with more than 1 aggregated measure.
   * @return {Array} [min, max] rounded
   */
  niceDomain : function (crossfilterGroup, measure) {
    function getVal(d) {
      if (typeof measure == "undefined")
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
  },

  /**
   * Transform metadata from the geographical dimension to a list of GeoJSON.
   *
   * @private
   * @param {Object} data Metadata from the Query class
   * @param {string} geoProperty id of the property containing the geoJSON in the data
   * @return {Array<Object>} list of GeoJSON file with captions of the areas as the "name" property in each GeoJSON
   */
  transformSpatialMetadata : function (data, geoProperty) {

    var out = [];
    for (var el in data) {
      var outEl = $.extend({}, data[el][geoProperty]);
      outEl.id = el;
      outEl.properties = {"name" : data[el].caption};

      out.push(outEl);
    }
    return out;
  },


  /**
   * Resize the charts according to the window size.
   *
   * @param {boolean} [render=false] - do we render the charts after resizing
   * @private
   */
  resizeCharts : function (render) {

    for (var chart in this.charts) {
      if (this.charts[chart].element) {

        var width = $(this.charts[chart].selector).width();
        var height = $(this.charts[chart].selector).height();

        switch(this.charts[chart].type) {
          case "pie":
            this.charts[chart].element
              .radius(0); // reset radius for pie so that it's recomputed
          case "bar":
            this.charts[chart].element
              .width(width - 30)
              .height(height);
            break;

          default:
            this.charts[chart].element
              .width(width)
              .height(height);
            break;
        }
        if (render)
          this.charts[chart].element.render();
      }
    }
  },

  /**
   * Initialize the resize behavior
   *
   * @private
   */
  initResize : function () {

    var timer = window.setTimeout(function() {}, 0);
    $(window).on('resize', function() {
      window.clearTimeout(timer);
      timer = window.setTimeout(function() {
        $(window).trigger('resizeend');
      }, 350);
    });

    var that = this;
    $(window).on('resizeend', function () { return that.resizeCharts(true); });

    // init column resize
    $("#columns").resizableColumns();
    this.resizableColumns = $("#columns").data('resizableColumns');

    // restore columns widths
    if (typeof this.options.columnWidths != "undefined") {
      this.resizableColumns.restoreColumnWidths(this.options.columnWidths);
      delete this.options.columnWidths;
    }

    $(window).on('column:resize:stop', function () { return that.resizeCharts(true); });
  },

  /**
   * Initialize all the display
   * @public
   */
  init : function () {

    this.initMeasure();
    this.initMetadata();
    this.initResize();
    this.getData();
    this.displayCharts(true);

    var that = this;

    d3.select(this.options.resetSelector).on("click", function () {
          dc.filterAll();
          for (var chart in that.charts) {
            var crossfilterDimAndGroup = that.getCrossfilterDimensionAndGroup(that.charts[chart].dimensions[0]);
            if (that.charts[chart].element.colorDomain !== undefined) {
              that.charts[chart].element.colorDomain(that.niceDomain(crossfilterDimAndGroup.group));
            }
          }
          dc.redrawAll();
          return false;
        }
    );
  },

  /**
   * Drill down on the given dimension on a member. Should called inside callback functions.
   * Will update the charts consequently.
   *
   * @private
   * @param {string} dimension id of the dimension on which we want to drill down
   * @param {string} member id of the member on which we want to drill down
   * @param {string} dcChartID id of the dc chart on which the evenement was called
   */
  drillDown : function (dimension, member, dcChartID) {
    try {
      var hierarchy = this.getDimensionHierarchy(dimension);
      var oldLevel = this.getDimensionCurrentLevel(dimension);

      nbLevels = Object.keys(Query.getLevels(this.schema, this.cube, dimension, hierarchy)).length;

      if (oldLevel < nbLevels - 1) {
        var newLevel = oldLevel + 1;

        var newMembers = Query.getMembers(this.schema, this.cube, dimension, hierarchy, oldLevel, true, member);

        // add slice to stack
        this.addSliceToStack(dimension, '', hierarchy, newLevel, newMembers, true);

        var that = this;
        this.getChartsUsingDimension(dimension).forEach(function (chart) {
          if (that.charts[chart].element._onZoomIn !== undefined
              && that.charts[chart].element.chartID() !== dcChartID) {
            that.charts[chart].element._onZoomIn(member);
          }
        });

        // reset filter on charts using this dimension
        this.filterAllChartsUsingDimension(dimension);
        this.getData();
        this.displayCharts();
      }
    } catch(err) {
      new PNotify({
        title: 'An error occured',
        type: 'error',
          text: err.message
      });
    }
  },

  /**
   * Roll up on the given dimension. Should called inside callback functions.
   * Will update the charts consequently.
   *
   * @private
   * @param {string} dimension id of the dimension on which we want to roll up
   * @param {string} dcChartID id of the dc chart on which the evenement was called
   * @param {integer} nbLevels number of levels to roll up, 1 by default
   */
  rollUp : function (dimension, dcChartID, nbLevels) {

    if (nbLevels === undefined) {
      nbLevels = 1;
    }

    // do not allow full projection of a dimension
    if (this.getDimensionCurrentLevel(dimension) > 0) {

      for (var i = 1; i <= nbLevels; i++) {
        // remove last slice
        this.removeLastSliceFromStack(dimension);


        var that = this;
        this.getChartsUsingDimension(dimension).forEach(function (chart) {
          if (that.charts[chart].element._onZoomOut !== undefined
              && that.charts[chart].element.chartID() !== dcChartID) {
            that.charts[chart].element._onZoomOut();
          }
        });
      }

      // reset filter on charts using this dimension
      this.filterAllChartsUsingDimension(dimension);

      // regenerate all
      this.getData();
      this.displayCharts();
    }

  },

  /**
   * Set the state of the display to a saved state. Note that this must be called before calling init().
   *
   * @public
   * @param {Object} state as given when getting it
   */
  setState : function (state) {

    this.schema = state.schema;
    this.cube = state.cube;
    this.measure = state.measure;
    this.options.columnWidths = state.columnWidths;

    // list charts
    for (var chartID in state.charts) {
      var chart = state.charts[chartID];

      if (chart.type == "wordcloud") { // if wordcloud, create it
        this.charts[chartID] = {selector: '#'+chartID};
      }
      this.charts[chartID].type = chart.type;
      this.charts[chartID].dimensions = chart.dimensions;
      this.charts[chartID].options = chart.options;
    }

    // list dimensions
    var DBdimensions = Query.getDimensions(this.schema, this.cube);
    for (var dimensionID in state.dimensions) {
      var dimension = state.dimensions[dimensionID];

      this.dimensions[dimensionID] = {
        'caption' : DBdimensions[dimensionID].caption,
        'hierarchy' : dimension.hierarchy,
        'properties' : dimension.properties,
        'membersSelected' : dimension.membersSelected,
        'membersStack' : []
      };

      // simplifed stack
      for (var i in dimension.membersStack) {
        this.dimensions[dimensionID].membersStack[i] = Query.getMembersInfos(this.schema, this.cube, dimensionID, dimension.hierarchy, i, dimension.membersStack[i], dimension.properties);
      }
    }
  },

  /**
   * Get the state of the display for save
   *
   * @public
   * @return {Object} JSON describing the state (to save)
   */
  getState : function () {

    // init output
    var out = {
      "schema": this.schema,
      "cube": this.cube,
      "measure": this.measure,
      "charts" : {},
      "columnWidths" : this.resizableColumns.saveColumnWidths(),
      "dimensions" : {}
    };

    // list charts
    for (var chartID in this.charts) {
      var chart = this.charts[chartID];
      out.charts[chartID] = {
        'type' : chart.type,
        'dimensions' : chart.dimensions,
        'options' : chart.options
      };
    }

    // list dimensions
    for (var dimensionID in this.dimensions) {
      var dimension = this.dimensions[dimensionID];
      out.dimensions[dimensionID] = {
        'hierarchy' : dimension.hierarchy,
        'properties' : dimension.properties,
        'membersSelected' : dimension.membersSelected,
        'membersStack' : []
      };

      // simplifed stack
      for (var i in dimension.membersStack) {
        out.dimensions[dimensionID].membersStack[i] = Object.keys(dimension.membersStack[i]);
      }
    }

    return out;

  },

  /**
   * Set options to configure the display. Possible options and their default options are :
   *
   * - resetSelector (#reset) : reset filters button selector
   * - cloudsSelector (#cloud) : list of word clouds CSS selector
   * - factSelector (#facts) : facts selector CSS selector
   * - zoomId (zoom) : zoom buttons for map CSS selector
   * - factCubesIntro (Cubes available:) : Introduction of the list of cubes
   * - factMeasuresIntro (Measures available:) : Introdcution of the list of measures
   *
   * - charts.map (#map) : map chart CSS selector
   * - charts.timeline (#timeline) : timeline chart CSS selector
   * - charts.rightChart (#rightChart) : right chart CSS selector
   * - charts.barChart (#barChart) : bar chart CSS selector
   * - charts.table (#table) : table chart CSS selector
   *
   * @public
   */
  setOptions : function (options) {

    this.options.colors            = options.colors            || this.options.colors;
    this.options.resetSelector     = options.resetSelector     || this.options.resetSelector;
    this.options.cloudsSelector    = options.cloudsSelector    || this.options.cloudsSelector;
    this.options.zoomId            = options.zoomId            || this.options.zoomId;
    this.options.factSelector      = options.factSelector      || this.options.factSelector;
    this.options.factCubesIntro    = options.factCubesIntro    || this.options.factCubesIntro;
    this.options.factMeasuresIntro = options.factMeasuresIntro || this.options.factMeasuresIntro;

    if (options.charts !== undefined) {
      for (var chart in options.charts) {
        if (this.charts[chart] !== undefined) {
          this.charts[chart].selector = options.charts[chart];
        }
      }
    }
  }
};
