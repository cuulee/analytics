
var cube = function (CubeId, Caption) {
  var _cubeId = CubeId;
  var _caption = Caption;

  var _currentDimension;
  var _currentHierarchy;

  var _dimensions = {};

  var _cube = {};

  function copyObject(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function except(obj, keys) {
    var filteredObj = {};
    for (var k in obj) {
      if (keys.indexOf(k) < 0) {
        filteredObj[k] = obj[k];
      }
    }
    return filteredObj;
  }

  _cube.id = function () {
    return CubeId;
  };

  _cube.caption = function () {
    return Caption;
  };

  _cube.size = function () {
    var n = 1;
    for (var dim in _dimensions) {
      var d = _dimensions[dim].hierarchies[Object.keys(_dimensions[dim].hierarchies)[0]];
      // Get the finest level of each dimension
      n *= Object.keys(d.levels[d.levels.length - 1].members).length;
    }
    return n;
  };


  _cube.dimensions = function () {
    var dims = {};
    for (var d in _dimensions) {
      dims[d] = except(_dimensions[d], ["hierarchies"]);
    }
    return dims;
  };


  _cube.dimensionFromHierarchy = function (hierarchy) {
    for (var dim in _dimensions) {
      if (_dimensions[dim].hierarchies[hierarchy] != undefined) {;
        return dim;
      }
    }
  };

  _cube.hierarchies = function (dim) {
    var hierarchies = {};
    for (var hie in _dimensions[dim].hierarchies) {
      hierarchies[hie] = except(_dimensions[dim].hierarchies[hie], ["levels"]);
    }
    return hierarchies;
  };

  _cube.members = function (dim, hie, lev, properties) {
    if (typeof lev == "string") {
      _dimensions[dim].hierarchies[hie].levels.map(function (level, index) {
        if (level.id === lev)
          lev = index;
      });
    }
    properties = properties || false;
    return _dimensions[dim].hierarchies[hie].levels[lev].members;
  };

  _cube.childs = function (dim, hie, lev, member) {
    if (typeof lev == "string") {
      _dimensions[dim].hierarchies[hie].levels.map(function (level, index) {
        if (level.id === lev)
          lev = index;
      });
    }
    var childMembers = {};
    _dimensions[dim].hierarchies[hie].levels[lev].members[member].children.forEach(function (c) {
      childMembers[c] = copyObject(_dimensions[dim].hierarchies[hie].levels[lev + 1].members[c]);
    });
    return childMembers;
  };

  _cube.levels = function (dim, hie) {
    return _dimensions[dim].hierarchies[hie].levels.map(function (l) { return except(l, ["members"]); });
  };

  // Cube building functions

  /**
   *
   * Adds a dimension to the cube
   *
   * @param {String} dimId
   *  The id of the dimension
   * @param {String} caption
   *  A caption describing the dimension
   * @param {String} type
   *  The type of the dimension (Geometry, Time, Standard)
   */
  _cube.dimension = function (dimId, caption, type) {
    _currentDimension = dimId;
    _dimensions[dimId] = {caption: caption, type: type, hierarchies: {}};
    return _cube;
  };

  /**
   * Adds a level to the last added hierarchy
   *
   * @param {String} hierarchyId
   *  The id of the hierarchy
   *
   * @param {String} caption
   *  A caption describing the hierarchy
   */
  _cube.hierarchy = function (hierarchyId, caption) {
    _currentHierarchy = hierarchyId;
    _dimensions[_currentDimension].hierarchies[hierarchyId] = {caption: caption, levels: []};
    return _cube;
  };

  /**
   * Adds a level to the last added dimension
   *
   * @param {String} levelId
   *  The id of the level
   *
   * @param {String} caption
   *  A caption describing the level
   */
  _cube.level = function (levelId, caption) {
    _dimensions[_currentDimension].hierarchies[_currentHierarchy]
      .levels.push({id: levelId, caption: caption, "list-properties" : {}, members: {}});
    return _cube;
  };

  /**
   * adds a property to the last added level in the last added dimension
   *
   * @param {string} propertyId
   *  the id of the property
   * @param {string} caption
   *  a caption describing the property
   * @param {string} type
   *  the type of the property (geometry, standard)
   */
  _cube.property = function (propertyId, caption, type) {
    var hie = _dimensions[_currentDimension].hierarchies[_currentHierarchy];
    hie.levels[hie.levels.length - 1]["list-properties"][propertyId] = {caption: caption, type: type};
    return _cube;
  };

  /**
   * Adds a member to the last added level in the last added dimension
   *
   * @param {String} memberId
   *  The id of the member
   * @param {String} caption
   *  A caption describing the member
   * @param {Object} properties
   *  The object containing the properties associated with the member
   *  {propertyId: value, ...}
   * @param {Array} children
   *  The list of the members id of the children members of this member
   */
  _cube.member = function (memberId, caption, properties, children) {
    var hie = _dimensions[_currentDimension].hierarchies[_currentHierarchy];
    var lev = hie.levels[hie.levels.length - 1]
    lev.members[memberId] = {"caption": caption, "children": children};
    for (var property in properties) {
      lev.members[memberId][property] = properties[property];
    }
    return _cube;
  };

  return _cube;
}

function fileContent (filepath) {
  var data;
  $.ajax({
    url: filepath,
    async: false,
    success: function (res) {
      data = res;
    },
  });

  return data;
}

function getData(cube, measures, hierarchies) {
  var out = [{}];
  // initialize the output to a list of measures with values (case with no dice)
  measures.forEach(function(d) {
    out[0][d] = cube.size();
    // [{measureId: CubeSize, ...}]
  });

  var nbValues = 1;

  // for each hierarchy
  Object.keys(hierarchies).forEach(function (hier) {
    var dimension = cube.dimensionFromHierarchy(hier);

    var members = cube.members(dimension, hier, cube.levels(dimension, hier).length - 1);
    var membersId = Object.keys(members);
    var n = Object.keys(members).length; // number of members in the given hierarchy

    // if we dice, split the value of the measures for each member
    if (hierarchies[hier].dice) {
      // Build the array containing cross-members values
      out = out.map(function(d) {
        // for each measure already in out
        var tmp = copyArray(hierarchies[hier].members).map(function(member, index) {
          di = copyObject(d);
          // for each member we want
          measures.forEach(function(mes) {
            di[mes] = di[mes] + index/n*10000;
            // update the measure
          });
          // add the member to the measure entry
          di[dimension] = member; // getHierarchyDimension(hier) = dimension name
          // di = {measureId: CubeSize/n, dimensionId: member}
          return di; // Replace the element of tmp (the member) by the measure entry
        });
        // tmp = [{measureId: CubeSize/n, dimensionId: membmer}, ...]
        return tmp; // Replace the element of out by the array of new measure entries
      });

      // flatten out
      out = [].concat.apply([], out);
    }
    // if we don't dice, just remove the values of members not in the filter
    else {
      var nFiltered = hierarchies[hier].members.length;

      out = out.map(function(d) {
        d = copyObject(d);
        measures.forEach(function(mes) {
          d[mes] = (membersId.indexOf(member)+1)/n;
        });
        return d;
      });
    }
  });

  return out;
}

function copyArray(arr) {
  return arr.slice(0, Infinity);
}

function copyObject(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function generateAPI(cubes) {
  var _cubes = {};
  cubes.forEach(function (c) {
    _cubes[c.id()] = c;
  });
  return {
    cube : null,
    measures : [],
    hierarchies : {},

    drill : function(idCube) {
      this.cube = idCube;
      return this;
    },
    push : function(idMeasure) {
      if (this.measures.indexOf(idMeasure) < 0)
        this.measures.push(idMeasure);
      return this;
    },
    pull : function(idMeasure) {
      index = this.measures.indexOf(idMeasure);
      if (index != -1) {
        this.measures.splice(index, 1);
      }
      return this;
    },
    slice : function(idHierarchy, members, range) {
      range = range || false;
      this.hierarchies[idHierarchy] = {"members" : members, "range" : range, "dice" : false};
      return this;
    },
    dice : function(hierarchies) {
      for (var i = 0; i < hierarchies.length; i++) {
        if (typeof this.hierarchies[hierarchies[i]] != "undefined")
          this.hierarchies[hierarchies[i]].dice = true;
      }
      return this;
    },
    project : function(idHierarchie) {
      delete this.hierarchies[idHierarchie];
      return this;
    },
    execute : function() {
      return {error: "OK", data: getData(_cubes[this.cube], this.measures, this.hierarchies)};
    },
    clear : function() {
      this.cube = null;
      this.measures = [];
      this.hierarchies = {};
      return this;
    },

    explore : function(root, withProperties, granularity) {
        switch (root.length) {
          case 0:
            return {error: "OK", data: {"Olap": {caption: "Olap Schema"}}};
          case 1:
            var cubes = {};
            for (var cube in _cubes) {
              cubes[_cubes[cube].id()] = {caption: _cubes[cube].caption()};
            }
            return {error: "OK", data: cubes};
          case 2:
            return {error: "OK", data: _cubes[root[1]].dimensions()};
          case 3:
            return {error: "OK", data: _cubes[root[1]].hierarchies(root[2])};
          case 4:
            return {error: "OK", data: _cubes[root[1]].levels(root[2], root[3])};
          case 5: // getMembers
            return {error: "OK", data: _cubes[root[1]].members(root[2], root[3], root[4])};
          case 6: // getMembers
            var allMembers = _cubes[root[1]].members(root[2], root[3], root[4]);
            var result = {};
            if (typeof root[5] == "object") {
              // If it is a list of members
              for (var member in allMembers) {
                if (root[5].indexOf(member) >= 0) {
                  result[member] = allMembers[member];
                }
              }
            } else {
              // If it is a given member
              result = _cubes[root[1]].childs(root[2], root[3], root[4], root[5]);
            }
            return {error: "OK", data: result};
        }
    },
  };
}

var baseUrl = "/static/analytics/js/helpers/";

var c = cube("C", "Le cube")
  .dimension("Measures", "Measures", "Measure")
    .hierarchy("M1", "Measure")
      .level("m", "measure")
        .member("E", "Export", {}, [])
        .member("I", "Import", {}, [])
  .dimension("[Zone]", "Zone", "Geometry")
    .hierarchy("Z1", "Nuts")
      .level("nuts0", "Nuts0")
        .property("Geom", "La Geometrie", "Geometry")
        .member("BE", "Belgium", {"Geom": fileContent(baseUrl+"geoData/BE")}, ["BE1","BE2","BE3"])
        .member("DE", "Germany", {"Geom": fileContent(baseUrl+"geoData/DE")}, ["DE7","DEC","DE9","DEB","DE3","DEG","DEF","DE8","DE4","DEA","DEE","DE1","DE2","DE6","DE5","DED"])
        .member("NL", "Netherlands", {"Geom": fileContent(baseUrl+"geoData/NL")}, ["NL4","NL3","NL1","NL2"])
        .member("LU", "Luxembourg", {"Geom": fileContent(baseUrl+"geoData/LU")}, ["LU0"])
        .member("UK", "United Kingdom", {"Geom": fileContent(baseUrl+"geoData/UK")}, ["UKI","UKC","UKM","UKG","UKD","UKF","UKH","UKL","UKN","UKJ","UKK","UKE"])
      .level("nuts1", "Nuts1")
        .property("Geom", "La Geometrie", "Geometry")
        .member("BE3", "RÉGION WALLONNE", {"Geom": fileContent(baseUrl+"geoData/BE3")}, [])
        .member("BE2", "VLAAMS GEWEST", {"Geom": fileContent(baseUrl+"geoData/BE2")}, [])
        .member("BE1", "RÉGION DE BRUXELLES-CAPITALE / BRUSSELS HOOFDSTEDELIJK GEWEST", {"Geom": fileContent(baseUrl+"geoData/BE1")}, [])
        .member("DE7", "HESSEN", {"Geom": fileContent(baseUrl+"geoData/DE7")}, [])
        .member("DEC", "SAARLAND", {"Geom": fileContent(baseUrl+"geoData/DEC")}, [])
        .member("DE9", "NIEDERSACHSEN", {"Geom": fileContent(baseUrl+"geoData/DE9")}, [])
        .member("DEB", "RHEINLAND-PFALZ", {"Geom": fileContent(baseUrl+"geoData/DEB")}, [])
        .member("DE3", "BERLIN", {"Geom": fileContent(baseUrl+"geoData/DE3")}, [])
        .member("DEG", "THÜRINGEN", {"Geom": fileContent(baseUrl+"geoData/DEG")}, [])
        .member("DEF", "SCHLESWIG-HOLSTEIN", {"Geom": fileContent(baseUrl+"geoData/DEF")}, [])
        .member("DE8", "MECKLENBURG-VORPOMMERN", {"Geom": fileContent(baseUrl+"geoData/DE8")}, [])
        .member("DE4", "BRANDENBURG", {"Geom": fileContent(baseUrl+"geoData/DE4")}, [])
        .member("DEA", "NORDRHEIN-WESTFALEN", {"Geom": fileContent(baseUrl+"geoData/DEA")}, [])
        .member("DEE", "SACHSEN-ANHALT", {"Geom": fileContent(baseUrl+"geoData/DEE")}, [])
        .member("DE1", "BADEN-WÜRTTEMBERG", {"Geom": fileContent(baseUrl+"geoData/DE1")}, [])
        .member("DE2", "BAYERN", {"Geom": fileContent(baseUrl+"geoData/DE2")}, [])
        .member("DE6", "HAMBURG", {"Geom": fileContent(baseUrl+"geoData/DE6")}, [])
        .member("DE5", "BREMEN", {"Geom": fileContent(baseUrl+"geoData/DE5")}, [])
        .member("DED", "SACHSEN", {"Geom": fileContent(baseUrl+"geoData/DED")}, [])
        .member("LU0", "LUXEMBOURG", {"Geom": fileContent(baseUrl+"geoData/LU0")}, [])
        .member("NL4", "ZUID-NEDERLAND", {"Geom": fileContent(baseUrl+"geoData/NL4")}, [])
        .member("NL3", "WEST-NEDERLAND", {"Geom": fileContent(baseUrl+"geoData/NL3")}, [])
        .member("NL1", "NOORD-NEDERLAND", {"Geom": fileContent(baseUrl+"geoData/NL1")}, [])
        .member("NL2", "OOST-NEDERLAND", {"Geom": fileContent(baseUrl+"geoData/NL2")}, [])
        .member("UKI", "LONDON", {"Geom": fileContent(baseUrl+"geoData/UKI")}, [])
        .member("UKC", "NORTH EAST (ENGLAND)", {"Geom": fileContent(baseUrl+"geoData/UKC")}, [])
        .member("UKM", "SCOTLAND", {"Geom": fileContent(baseUrl+"geoData/UKM")}, [])
        .member("UKG", "WEST MIDLANDS (ENGLAND)", {"Geom": fileContent(baseUrl+"geoData/UKG")}, [])
        .member("UKD", "NORTH WEST (ENGLAND)", {"Geom": fileContent(baseUrl+"geoData/UKD")}, [])
        .member("UKF", "EAST MIDLANDS (ENGLAND)", {"Geom": fileContent(baseUrl+"geoData/UKF")}, [])
        .member("UKH", "EAST OF ENGLAND", {"Geom": fileContent(baseUrl+"geoData/UKH")}, [])
        .member("UKL", "WALES", {"Geom": fileContent(baseUrl+"geoData/UKL")}, [])
        .member("UKN", "NORTHERN IRELAND", {"Geom": fileContent(baseUrl+"geoData/UKN")}, [])
        .member("UKJ", "SOUTH EAST (ENGLAND)", {"Geom": fileContent(baseUrl+"geoData/UKJ")}, [])
        .member("UKK", "SOUTH WEST (ENGLAND)", {"Geom": fileContent(baseUrl+"geoData/UKK")}, [])
        .member("UKE", "YORKSHIRE AND THE HUMBER", {"Geom": fileContent(baseUrl+"geoData/UKE")}, [])
  .dimension("[Time]", "Temps", "Time")
    .hierarchy("T1", "Years-Semesters")
      .level("Level0", "Years")
        .member("2010", "2010", {}, ["2010-S1", "2010-S2"])
        .member("2011", "2011", {}, ["2011-S1", "2011-S2"])
        .member("2012", "2012", {}, ["2012-S1", "2012-S2"])
        .member("2013", "2013", {}, ["2013-S1", "2013-S2"])
      .level("Level1", "Semester")
        .member("2010-S1", "2010-S1")
        .member("2010-S2", "2010-S2")
        .member("2011-S1", "2011-S1")
        .member("2011-S2", "2011-S2")
        .member("2012-S1", "2012-S1")
        .member("2012-S2", "2012-S2")
        .member("2013-S1", "2013-S1")
        .member("2013-S2", "2013-S2")
        .member("2014-S1", "2014-S1")
        .member("2014-S2", "2014-S2")
  .dimension("[Product]", "Product", "Standard")
    .hierarchy("P1", "Custom type")
      .level("Level0", "type")
        .member("F", "Food", {}, ["BG","P","S"])
        .member("NC", "Non-consumable", {}, ["H","F"])
      .level("Level1", "Semester")
        .member("BG", "Backing Goods")
        .member("P", "Produce")
        .member("S", "Snack Goods")
        .member("H", "Hammer")
        .member("F", "Fork");
