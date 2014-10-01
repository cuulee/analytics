var Display = {

  /**
   * schema, cube, measure represents the current measure shown
   *
   * @private
   */
  schema : null,
  cube : null,
  measure : null,

  /**
   * Contains the list of the slices done on the dimensions. See example for scheme of each element.
   *
   * @example
   *   <idDimension> : {
   *      'caption' : caption, // caption of the dimension
   *      'hierarchy' : hierarchy, // current hierarchy
   *      'membersStack' : [], // stack of all slice done on this hierarchy
   *      'membersSelected' : [] // list of selected elements on the screen for the last level of the stack
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
      'options' : {"geoProperty" : undefined}
    },
    'timeline' : {
      'selector' : '#timeline',
      'type' : 'timeline',
      'element' : undefined,
      'dimensions' : [],
      'options' : {}
    },
    'rightChart' : {
      'selector' : '#rightChart',
      'type' : 'pie',
      'element' : undefined,
      'dimensions' : [],
      'options' : {}
    },
    'table' : {
      'selector' : '#table',
      'type' : 'table',
      'element' : undefined,
      'dimensions' : [],
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
    zoomSelector : '#zoom',
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
    }
    else {
      this.setMeasure(measure);
    }

    this.getData();
    this.displayCharts(true);
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
   * @return {string} current shown level
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
      var slice = this.getSliceFromStack(dimension);
      nb *= Object.keys(slice.members).length
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
   * @return {Object} dimension and group
   */
  getCrossfilterDimensionAndGroup : function (dimension) {

    var that = this;

    if (this.dimensions[dimension].crossfilter === undefined) {
      this.dimensions[dimension].crossfilter = this.dataCrossfilter.dimension(function(d) { return d[dimension]; });
    }

    if (this.dimensions[dimension].crossfilterGroup === undefined) {
      this.dimensions[dimension].crossfilterGroup = this.dimensions[dimension].crossfilter.group().reduceSum(function(d) { return d[that.measure]; });
    }

    return {
      "dimension" : this.dimensions[dimension].crossfilter,
      "group" : this.dimensions[dimension].crossfilterGroup
    };
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
    }
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
        for (var geoHierarchy  in Query.getHierarchies(this.schema, this.cube, geoDimension)) break;
        var geoLevels = Query.getLevels(this.schema, this.cube, geoDimension, geoHierarchy);
        var geoProperty = Query.getGeoProperty(this.schema, this.cube, geoDimension, geoHierarchy);

        // slice all dimensions (because they are all used in charts)
        var dimensions = Query.getDimensions(this.schema, this.cube);
        for (var dimension in dimensions) {
          for (var hierarchy  in Query.getHierarchies(this.schema, this.cube, dimension)) break;
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
        this.charts.table.dimensions.push(geoDimension);

        // instanciate wordclouds (1 per dimension except time)
        var i = 0;
        for (var dimension in dimensions) {
          if (dimension != timeDimension) {
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
      }
    } catch(err) {
      new PNotify({
        title: 'An error occured',
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
      if (this.isClientSideAggrPossible())
        return this.getDataClientAgregates();
      else
        return this.getDataServerAgregates();
    } catch(err) {
      new PNotify({
        title: 'An error occured',
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
    // set cube & measure
    Query.clear();
    Query.drill(this.cube);
    Query.push(this.measure);

    // Select first data
    var dimensionsList = this.getDimensions();
    var hierachiesList = [];
    for (var i in dimensionsList) {
      var dimension = dimensionsList[i];
      var slice = this.getSliceFromStack(dimension);
      var hierarchy = this.getDimensionHierarchy(dimension);
      hierachiesList.push(hierarchy);
      Query.slice(hierarchy, Object.keys(slice.members));
    }
    Query.dice(hierachiesList);

    var data = Query.execute();

    return this.setCrossfilterData(data);
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
      "measure" : this.measure,
      "dimensions" : {}
    };

    for (var dimension in this.dimensions) {
      var slice = this.getSliceFromStack(dimension);
      metadata.dimensions[dimension] = {
        "hierarchy" : this.getDimensionHierarchy(dimension),
        "level" : slice.level,
        "members" : Object.keys(slice.members)
      };
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

    switch(this.charts[chart].type) {

      case "map":
        this.displayMap(chart);
        break;

      case "pie":
        this.displayPie(chart);
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
    var dimension = this.charts[chart].dimensions[0];
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimension);
    var metadata = this.getSliceFromStack(dimension);

    /// create element if needed
    if (this.charts[chart].element === undefined) {

      $(this.options.cloudsSelector).append('<div class="wordcloud">'+
          '<div class="wordcloud-title">'+this.getDimensionCaption(dimension)+'</div>'+
          '<div class="wordcloud-chart" id="'+chart+'"></div>'+
        '</div>');

      this.charts[chart].element = dc.wordCloudChart(this.charts[chart].selector)

        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d ? that.charts[chart].element.colors()(d) : '#ccc'; })

        .callbackZoomIn(function(el) { that.drillDown(dimension, el); })
        .callbackZoomOut(function () { that.rollUp(dimension); })

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); });
    }

    /// display data
    var format = d3.format(".3s");

    this.charts[chart].element
      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)

      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group))

      .label(function (d) { return metadata.members[d.key].caption; })

      .title(function (d) {
        if (metadata.members[d.key] == undefined) return (d.value ? format(d.value) : '');
        return metadata.members[d.key].caption + "\nValue: " + (d.value ? format(d.value) : 0); // + "[unit]";
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
    var dimension = this.charts[chart].dimensions[0];
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimension);
    var metadata = this.getSliceFromStack(dimension);
    var spatialData = this.transformSpatialMetadata(metadata.members, this.charts[chart].options.geoProperty);

    /// create element if needed
    if (this.charts[chart].element === undefined) {

      var width = $(this.charts[chart].selector).width() - 30;
      var height = $(this.charts[chart].selector).height();

      this.charts[chart].element = dc.geoChoroplethChart(this.charts[chart].selector)
        .width(width)
        .height(height)

        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d ? that.charts[chart].element.colors()(d) : '#ccc'; })

        .projection(d3.geo.mercator())

        .callbackZoomIn(function(el) { that.drillDown(dimension, el); })
        .callbackZoomOut(function () { that.rollUp(dimension); })

        .setNbZoomLevels(this.charts[chart].options.nbLevels)

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); })

        .showLegend('#legend');

        d3.select(this.options.zoomSelector).append("a")
            .attr("class","btn btn-primary fa fa-search-plus")
            .attr("href","#")
            .on("click", function () { that.charts[chart].element.addScale(1.35, 700); return false; });
        d3.select(this.options.zoomSelector).append("a")
            .attr("class","btn btn-primary fa fa-search-minus")
            .attr("href","#")
            .on("click", function () { that.charts[chart].element.addScale(1/1.35, 700); return false; });
    }

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

    /// display data
    var format = d3.format(".3s");

    this.charts[chart].element
      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)
      .setNbZoomLevels(this.charts[chart].options.nbLevels)

      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group))

      .title(function (d) {
        if (metadata.members[d.key] === undefined) return (d.value ? format(d.value) : '');
        return metadata.members[d.key].caption + "\nValue: " + (d.value ? format(d.value) : 0); // + "[unit]";
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

    if (this.charts[chart].element === undefined) {

      var width = $(this.charts[chart].selector).width() - 30;
      var height = $(this.charts[chart].selector).height();

      this.charts[chart].element = dc.pieChart(this.charts[chart].selector)
        .ordering(function (d) { return d.value; })
        .width(width)
        .height(height)
        .minAngleForLabel(0.3)

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); })

        .colors(d3.scale.quantize().range(this.options.colors))
        .colorCalculator(function (d) { return d.value ? that.charts[chart].element.colors()(d.value) : '#ccc'; });

    }

    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(this.charts[chart].dimensions[0]);

    var metadata = this.getSliceFromStack(this.charts[chart].dimensions[0]);

    var format = d3.format(".3s");



    this.charts[chart].element
      .dimension(crossfilterDimAndGroup.dimension)
      .group(crossfilterDimAndGroup.group)
      .colorDomain(this.niceDomain(crossfilterDimAndGroup.group))
      .label(function (d) { return metadata.members[d.key].caption; })
      .title(function (d) {
        var key = d.key ? d.key : d.data.key;
        if (metadata.members[key] === undefined) return (d.value ? format(d.value) : '');
        return metadata.members[key].caption + "\nValue: " + (d.value ? format(d.value) : 0); // + "[unit]";
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
    var dimension = this.charts[chart].dimensions[0];
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(dimension);
    var metadata = this.getSliceFromStack(dimension);

    /// display element if needed
    if (this.charts[chart].element === undefined) {

      var width = $(this.charts[chart].selector).width() - 30;
      var height = $(this.charts[chart].selector).height();

      this.charts[chart].element = dc.barChart(this.charts[chart].selector)
        .width(width)
        .height(height)

        .callbackZoomIn(function(el) { that.drillDown(dimension, el); })
        .callbackZoomOut(function () { that.rollUp(dimension); })

        .margins({top: 10, right: 10, bottom: 20, left: 40})
        .transitionDuration(500)
        .centerBar(false)
        .gap(1)
        .elasticY(true)
        .elasticX(true)

        .on("filtered", function (ch, filter) { that.setFilter(chart, that.charts[chart].dimensions[0], filter); });
    }

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

      .title(function (d) {
        var key = d.key ? d.key : d.data.key;
        if (metadata.members[key] === undefined) return (d.value ? format(d.value) : '');
        return metadata.members[key].caption + "\nValue: " + (d.value ? format(d.value) : 0); // + "[unit]";
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
    if (this.charts[chart].element === undefined) {
      d3.select(this.charts[chart].selector).html("<thead><tr><th>Element</th><th>Value</th></tr></thead>");
      this.charts[chart].element = dc.dataTable(this.charts[chart].selector);
    }
    var crossfilterDimAndGroup = this.getCrossfilterDimensionAndGroup(this.charts[chart].dimensions[0]);
    var metadata = this.getSliceFromStack(this.charts[chart].dimensions[0]);
    var format = d3.format(".3s");

    this.charts[chart].element
        .dimension(crossfilterDimAndGroup.group)
        .group(function(d){return "";})
        .order(d3.descending)
        .sortBy(function(d) { return d.value; })
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
         ]);
  },

  /**
   * Get a crossfilter's group domain with nice values (rounded)
   *
   * @private
   * @param {Object} crossfilterGroup - group of which you want a nice domain
   */
  niceDomain : function (crossfilterGroup) {
    var min = crossfilterGroup.order(function (d) {return -d;}).top(1)[0];
    var max = crossfilterGroup.orderNatural(). top(1)[0];

    if (min.value != undefined && max.value != undefined) {
      min = min.value;
      max = max.value;
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
              .radius(0) // reset radius for pie so that it's recomputed
              .width(width - 30)
              .height(height);

            if (render)
              this.charts[chart].element.render();
            break;

          case "map":
            this.charts[chart].element
              .width(width)
              .height(height);

            if (render)
              this.charts[chart].element.render();
            break;

          // timeline will take the remaining space in it's container
          case "timeline":
            var domEl = $(this.charts[chart].selector);
            domEl.css('height', 'auto'); // remove css
            height = domEl.parent().height() - 10; // future height
            domEl.parent().children().each(function () {
              if (!$(this).is(domEl)) height -= $(this).height(); // remote siblings height
            });
            this.charts[chart].element
              .width(width)
              .height(height);

            if (render)
              this.charts[chart].element.render();
            break;
        }
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
  },

  /**
   * Initialize all the display
   * @public
   */
  init : function () {

    this.initMeasure();
    this.initMetadata();
    this.getData();
    this.displayCharts(true);
    this.initResize();


    d3.select(this.options.resetSelector).append("a")
        .attr("class","btn btn-primary fa fa-refresh")
        .attr("href","#")
        .text(" Reset Filters")
        .on("click", function () {
          dc.filterAll();
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
   */
  drillDown : function (dimension, member) {
    try {
      var hierarchy = this.getDimensionHierarchy(dimension);
      var oldLevel = this.getDimensionCurrentLevel(dimension);

      nbLevels = Object.keys(Query.getLevels(this.schema, this.cube, dimension, hierarchy)).length;

      if (oldLevel < nbLevels - 1) {
        var newLevel = oldLevel + 1;

        var newMembers = Query.getMembers(this.schema, this.cube, dimension, hierarchy, oldLevel, true, member);

        // add slice to stack
        this.addSliceToStack(dimension, '', hierarchy, newLevel, newMembers, true);

        // reset filter on charts using this dimension
        this.filterAllChartsUsingDimension(dimension);
        this.getData();
        this.displayCharts();
      }
    } catch(err) {
      new PNotify({
        title: 'An error occured',
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
   */
  rollUp : function (dimension) {

    // do not allow full projection of a dimension
    if (this.getDimensionCurrentLevel(dimension) > 0) {
      // remove last slice
      this.removeLastSliceFromStack(dimension);

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
   * - zoomSelector (#zoom) : zoom buttons for map CSS selector
   * - factSelector (#facts) : facts selector CSS selector
   * - factCubesIntro (Cubes available:) : Introduction of the list of cubes
   * - factMeasuresIntro (Measures available:) : Introdcution of the list of measures
   *
   * - charts.map (#map) : map chart CSS selector
   * - charts.timeline (#timeline) : timeline chart CSS selector
   * - charts.rightChart (#rightChart) : right chart CSS selector
   * - charts.table (#table) : table chart CSS selector
   *
   * @public
   */
  setOptions : function (options) {

    this.options.colors            = options.colors            || this.options.colors;
    this.options.resetSelector     = options.resetSelector     || this.options.resetSelector;
    this.options.cloudsSelector    = options.cloudsSelector    || this.options.cloudsSelector;
    this.options.zoomSelector      = options.zoomSelector      || this.options.zoomSelector;
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
