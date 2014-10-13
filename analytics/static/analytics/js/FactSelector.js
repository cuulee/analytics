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
   * TODO
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

      if (addLinks) {
        element.list.append(
          $('<li></li>').append(
            $('<a'+linkClass+' href="#" data-id="'+elID+'">'+element.data[elID].caption+'</a>')
            .click(useCallback)
          )
        );
      }
      else {
        element.list.append(
          $('<li '+linkClass+' data-id="'+elID+'">'+element.data[elID].caption+'</li>')
          .click(useCallback)
        );
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
    this.callback(this.cube, measureID);
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
