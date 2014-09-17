$.ajaxSetup({async:false});

function delay(a){var b=(new Date).getTime()+a;while(b>(new Date).getTime());}

var Query = {

  dataset : "/static/analytics/data/dataVC.json",

  getSchemas : function (a) {
    return {"fr" : "français", "en" : "anglais"};
  },

  getCubesAndMeasures : function (a) {
    return {
      "aCube" : {
        "caption": "Goods Quantity",
        "measures" : {
          'Raised' : {"caption" :'Loaded'},
          'unloaded' : {"caption" :'Unloaded'}
        }
      }
    };
  },

  getLevels : function (a, b, c, d) {
    return {"a" : "b", "b" : "c"};
  },

  getGeoDimension : function (a, b) {
    return "geo";
  },

  getTimeDimension : function (a, b) {
    return "RoundClassDescr";
  },

  getHierarchies : function (schema, cube, dim) {
    return {"hier1" : "Hier 1" , "hier2" : "Hier 2"};
  },

  getGeoProperty : function (schema, cube, dim, hier) {
    return "geom";
  },

  getDimensions : function (schema, cube) {
      return {"RoundClassDescr":{type:"geo",caption:"Piechart"},
      "geo":{type:"geo", caption:"Map"},
      "types":{type:"geo", caption:"Types"},
      "secteurs":{type:"geo", caption:"Secteurs"}
    };
  },

  getMembers : function (schema, cube, dim, hier, level, prop) {

    if (dim == 'RoundClassDescr') {
      return {
        "First Round" : { "caption" : "Jan  2014" },
        "Seed Round" : { "caption" : "Fev  2014" },
        "Later Stage" : { "caption" : "Mar  2014" },
        "Second Round" : { "caption" : "Avr  2014" },
        "Corporate" : { "caption" : "Mai  2014" },
        "Individual" : { "caption" : "Juin 2014" },
        "ACQ Financing" : { "caption" : "Juil 2014" },
        "Restart" : { "caption" : "Aout 2014" },
        "Unclassified" : { "caption" : "Sept 2014" }
      };
    } else {
      var data;

      if (level == 0) {
        $.get("/static/analytics/data/europe.geo.json", function (data2) {data = data2});
      }
      else {
        $.get("/static/analytics/data/france.geo.json", function (data2) {data = data2});
      }
      return data;
    }
  },

  getProperties : function (schema, cube, dim, hier, level, members) {

    if (dim == 'RoundClassDescr') {
      return {
        "First Round" : { "caption" : "Jan  2014" },
        "Seed Round" : { "caption" : "Fev  2014" },
        "Later Stage" : { "caption" : "Mar  2014" },
        "Second Round" : { "caption" : "Avr  2014" },
        "Corporate" : { "caption" : "Mai  2014" },
        "Individual" : { "caption" : "Juin 2014" },
        "ACQ Financing" : { "caption" : "Juil 2014" },
        "Restart" : { "caption" : "Aout 2014" },
        "Unclassified" : { "caption" : "Sept 2014" }
      };
    } else {
      var data;

      if (level == 0) {
        $.get("/static/analytics/data/europe.geo.json", function (data2) {data = data2});
      }
      else {
        $.get("/static/analytics/data/france.geo.json", function (data2) {data = data2});
      }
      return data;
    }
  },

  drill : function(cube) {
  },

  push : function(measure) {
  },

  pull : function(measure) {
  },

  slice : function(hierarchy, members, range) {
    if ($.inArray("FR1", members) >= 0) {
      this.dataset = "/static/analytics/data/dataVCFr.json";
    }

    if ($.inArray("FR", members) >= 0) {
      this.dataset = "/static/analytics/data/dataVC.json";
    }
  },

  project : function(hierarchy) {
  },

  switch : function(hierarchies) {
  },

  filter : function(hierarchy, members, range) {
  },

  rank : function(hierarchy) {
  },

  execute : function() {
    var data;
    $.get(this.dataset, function (data2) {data = data2});
    return data;
  },

  clear : function() {
  },

  explore : function(id) {
  }
}
