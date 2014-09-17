module("Etape 6");

QUnit.config.reorder = false;

var query = new QueryAPI();

function test41(){
  query.drill("[Sales]");
  query.push("[Measures].[Unit Sales]");
  query.push("[Measures].[Store Cost]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 225627.2336,
    "[Measures].[Unit Sales]": 266773
  }
]);
}

function test42(){
  query.slice("[Time]", ["[Time].[Year].[1997]","[Time].[Year].[1998]"], false);
  query.slice("[Store]", ["[Store].[Store Country].[USA]","[Store].[Store Country].[Canada]"], false);
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 225627.2336,
    "[Measures].[Unit Sales]": 266773,
    "[Store]": "[Store].[All Stores].[USA]",
    "[Time]": "[Time].[1997]"
  },
  {
    "[Measures].[Store Cost]": 0,
    "[Measures].[Unit Sales]": 0,
    "[Store]": "[Store].[All Stores].[Canada]",
    "[Time]": "[Time].[1997]"
  },
  {
    "[Measures].[Store Cost]": 220645.1136,
    "[Measures].[Unit Sales]": 259916,
    "[Store]": "[Store].[All Stores].[USA]",
    "[Time]": "[Time].[1998]"
  },
  {
    "[Measures].[Store Cost]": 39332.5705,
    "[Measures].[Unit Sales]": 46157,
    "[Store]": "[Store].[All Stores].[Canada]",
    "[Time]": "[Time].[1998]"
  }
]);
}

function test43(){
  query.slice("[Time]", ["[Time].[Year].[1997].[Q1]","[Time].[Year].[1997].[Q3]"], false);
  var result = query.execute()
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 55752.2405,
    "[Measures].[Unit Sales]": 66291,
    "[Store]": "[Store].[All Stores].[USA]",
    "[Time]": "[Time].[1997].[Q1]"
  },
  {
    "[Measures].[Store Cost]": 0,
    "[Measures].[Unit Sales]": 0,
    "[Store]": "[Store].[All Stores].[Canada]",
    "[Time]": "[Time].[1997].[Q1]"
  },
  {
    "[Measures].[Store Cost]": 55904.8694,
    "[Measures].[Unit Sales]": 65848,
    "[Store]": "[Store].[All Stores].[USA]",
    "[Time]": "[Time].[1997].[Q3]"
  },
  {
    "[Measures].[Store Cost]": 0,
    "[Measures].[Unit Sales]": 0,
    "[Store]": "[Store].[All Stores].[Canada]",
    "[Time]": "[Time].[1997].[Q3]"
  }
]);
}

function test44(){
  query.pull("[Measures].[Unit Sales]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 55752.2405,
    "[Store]": "[Store].[All Stores].[USA]",
    "[Time]": "[Time].[1997].[Q1]"
  },
  {
    "[Measures].[Store Cost]": 0,
    "[Store]": "[Store].[All Stores].[Canada]",
    "[Time]": "[Time].[1997].[Q1]"
  },
  {
    "[Measures].[Store Cost]": 55904.8694,
    "[Store]": "[Store].[All Stores].[USA]",
    "[Time]": "[Time].[1997].[Q3]"
  },
  {
    "[Measures].[Store Cost]": 0,
    "[Store]": "[Store].[All Stores].[Canada]",
    "[Time]": "[Time].[1997].[Q3]"
  }
]);
}

function test45(){
  query.slice("[Store]", ["[Store].[Store State].[BC]","[Store].[Store State].[CA]"], false);
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 0,
    "[Store]": "[Store].[All Stores].[Canada].[BC]",
    "[Time]": "[Time].[1997].[Q1]"
  },
  {
    "[Measures].[Store Cost]": 14431.0851,
    "[Store]": "[Store].[All Stores].[USA].[CA]",
    "[Time]": "[Time].[1997].[Q1]"
  },
  {
    "[Measures].[Store Cost]": 0,
    "[Store]": "[Store].[All Stores].[Canada].[BC]",
    "[Time]": "[Time].[1997].[Q3]"
  },
  {
    "[Measures].[Store Cost]": 15672.8256,
    "[Store]": "[Store].[All Stores].[USA].[CA]",
    "[Time]": "[Time].[1997].[Q3]"
  }
]);
}

function test46(){
  query.push("[Measures].[Unit Sales]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 0,
    "[Measures].[Unit Sales]": 0,
    "[Store]": "[Store].[All Stores].[Canada].[BC]",
    "[Time]": "[Time].[1997].[Q1]"
  },
  {
    "[Measures].[Store Cost]": 14431.0851,
    "[Measures].[Unit Sales]": 16890,
    "[Store]": "[Store].[All Stores].[USA].[CA]",
    "[Time]": "[Time].[1997].[Q1]"
  },
  {
    "[Measures].[Store Cost]": 0,
    "[Measures].[Unit Sales]": 0,
    "[Store]": "[Store].[All Stores].[Canada].[BC]",
    "[Time]": "[Time].[1997].[Q3]"
  },
  {
    "[Measures].[Store Cost]": 15672.8256,
    "[Measures].[Unit Sales]": 18370,
    "[Store]": "[Store].[All Stores].[USA].[CA]",
    "[Time]": "[Time].[1997].[Q3]"
  }
]);
}

function test47(){
  query.project("[Time]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"],[
  {
    "[Measures].[Store Cost]": 0,
    "[Measures].[Unit Sales]": 0,
    "[Store]": "[Store].[All Stores].[Canada].[BC]"
  },
  {
    "[Measures].[Store Cost]": 63530.4251,
    "[Measures].[Unit Sales]": 74748,
    "[Store]": "[Store].[All Stores].[USA].[CA]"
  }
]);
}

function test48(){
  query.slice("[Time]", ["[Time].[Year].[1997]","[Time].[Year].[1998]"], false);
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 0,
    "[Measures].[Unit Sales]": 0,
    "[Store]": "[Store].[All Stores].[Canada].[BC]",
    "[Time]": "[Time].[1997]"
  },
  {
    "[Measures].[Store Cost]": 63530.4251,
    "[Measures].[Unit Sales]": 74748,
    "[Store]": "[Store].[All Stores].[USA].[CA]",
    "[Time]": "[Time].[1997]"
  },
  {
    "[Measures].[Store Cost]": 39332.5705,
    "[Measures].[Unit Sales]": 46157,
    "[Store]": "[Store].[All Stores].[Canada].[BC]",
    "[Time]": "[Time].[1998]"
  },
  {
    "[Measures].[Store Cost]": 61936.3326,
    "[Measures].[Unit Sales]": 73017,
    "[Store]": "[Store].[All Stores].[USA].[CA]",
    "[Time]": "[Time].[1998]"
  }
]);
}

function test49(){
  query.pull("[Measures].[Unit Sales]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 0,
    "[Store]": "[Store].[All Stores].[Canada].[BC]",
    "[Time]": "[Time].[1997]"
  },
  {
    "[Measures].[Store Cost]": 63530.4251,
    "[Store]": "[Store].[All Stores].[USA].[CA]",
    "[Time]": "[Time].[1997]"
  },
  {
    "[Measures].[Store Cost]": 39332.5705,
    "[Store]": "[Store].[All Stores].[Canada].[BC]",
    "[Time]": "[Time].[1998]"
  },
  {
    "[Measures].[Store Cost]": 61936.3326,
    "[Store]": "[Store].[All Stores].[USA].[CA]",
    "[Time]": "[Time].[1998]"
  }
]);
}


function test50(){
  query.project("[Time]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [{"[Measures].[Store Cost]": 0,"[Store]": "[Store].[All Stores].[Canada].[BC]"},{"[Measures].[Store Cost]": 63530.4251,"[Store]": "[Store].[All Stores].[USA].[CA]"}]);
}

function test51(){
  query.push("[Measures].[Unit Sales]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 0,
    "[Measures].[Unit Sales]": 0,
    "[Store]": "[Store].[All Stores].[Canada].[BC]"
  },
  {
    "[Measures].[Store Cost]": 63530.4251,
    "[Measures].[Unit Sales]": 74748,
    "[Store]": "[Store].[All Stores].[USA].[CA]"
  }
]);
}

function test52(){
  query.project("[Store]");
  var result = query.execute();
  var props = Object.keys(result);
  equal(props.length, 2, "only error and data alright");
  equal(result["error"], "OK", "no error");
  notEqual(result["data"], null);
  deepEqual(result["data"], [
  {
    "[Measures].[Store Cost]": 225627.2336,
    "[Measures].[Unit Sales]": 266773
  }
]);
}

function runTest(f){
  test(f.toString(), f);
}

function runTests(){
  test(test41.name, test41);
  test(test42.name, test42);
  test(test43.name, test43);
  test(test44.name, test44);
  test(test45.name, test45);
  test(test46.name, test46);
  test(test47.name, test47);
  test(test48.name, test48);
  test(test49.name, test49);
  test(test50.name, test50);
  test(test51.name, test51);
  test(test52.name, test52);
}

runTests();


